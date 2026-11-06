/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MeshoptEncoder } from "meshoptimizer";
import { probeGlb, MESHOPT_EXTENSION } from "../assets/glbProbe";
import {
  assessAssetHandoff,
  INTEGRATION_DOC_NAME,
  readIntegrationDocCount,
} from "../assets/handoffAssessment";
import { createGltfLoadSession } from "../assets/gltfLoadSession";
import { classifyGltfLoadError, planGltfLoad } from "../assets/gltfLoadPlan";
import { createMeshoptLifecycle, MeshoptLifecycleError } from "../assets/meshoptLifecycle";
import { checkModelManifest, parseModelManifest } from "../assets/modelManifest";
import { MAIN_GAME_MODELS } from "../assets/modelRegistry";
import { ensureMainGameMeshopt, meshoptStatus } from "../assets/mainGameMeshopt";

const root = process.cwd();

function makeGlb(json: object, bin = new Uint8Array([0, 0, 0, 0])): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunk = new Uint8Array(jsonBytes.length + jsonPad);
  jsonChunk.set(jsonBytes);
  jsonChunk.fill(0x20, jsonBytes.length);
  const binPad = (4 - (bin.length % 4)) % 4;
  const binChunk = new Uint8Array(bin.length + binPad);
  binChunk.set(bin);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  const binAt = 20 + jsonChunk.length;
  view.setUint32(binAt, binChunk.length, true);
  view.setUint32(binAt + 4, 0x004e4942, true);
  out.set(binChunk, binAt + 8);
  return out;
}

const plainJson = { asset: { version: "2.0", generator: "test" }, meshes: [{ primitives: [] }] };
const meshoptJson = {
  asset: { version: "2.0", generator: "test" },
  extensionsUsed: [MESHOPT_EXTENSION],
  extensionsRequired: [MESHOPT_EXTENSION],
  meshes: [{ primitives: [] }],
};

function findNamed(dir: string, name: string, out: string[], depth = 0): void {
  if (depth > 8) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findNamed(full, name, out, depth + 1);
    else if (entry.name === name) out.push(full);
  }
}

describe("glb probe", () => {
  it("reads a GLB without meshopt", () => {
    const probed = probeGlb(makeGlb(plainJson));
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.probe.meshopt).toBe(false);
    expect(probed.probe.meshoptRequired).toBe(false);
    expect(probed.probe.generator).toBe("test");
    expect(probed.probe.version).toBe(2);
    expect(probed.probe.meshCount).toBe(1);
  });

  it("flags required meshopt", () => {
    const probed = probeGlb(makeGlb(meshoptJson));
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.probe.meshopt).toBe(true);
    expect(probed.probe.meshoptRequired).toBe(true);
  });

  it("flags optional meshopt", () => {
    const probed = probeGlb(makeGlb({ ...meshoptJson, extensionsRequired: [] }));
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.probe.meshopt).toBe(true);
    expect(probed.probe.meshoptRequired).toBe(false);
  });

  it("rejects truncated, non-GLB, and broken JSON bytes", () => {
    const tiny = probeGlb(new Uint8Array([1, 2, 3]));
    expect(tiny.ok).toBe(false);
    if (tiny.ok) return;
    expect(tiny.reason).toBe("too-small");
    const bad = makeGlb(plainJson);
    bad[0] = 0;
    expect(probeGlb(bad).ok).toBe(false);
    const broken = makeGlb(plainJson);
    broken[20] = 0x7b;
    broken[21] = 0x00;
    const brokenProbe = probeGlb(broken);
    expect(brokenProbe.ok).toBe(false);
    if (brokenProbe.ok) return;
    expect(brokenProbe.reason).toBe("bad-json");
  });
});

describe("meshopt lifecycle", () => {
  it("shares one init across concurrent callers", async () => {
    let started = 0;
    let release: (value: unknown) => void = () => {};
    const life = createMeshoptLifecycle(() => {
      started += 1;
      return new Promise((resolve) => { release = resolve; });
    });
    const first = life.ensure();
    const second = life.ensure();
    expect(started).toBe(1);
    expect(life.status()).toBe("pending");
    release(undefined);
    await first;
    await second;
    expect(life.status()).toBe("ready");
    await life.ensure();
    expect(started).toBe(1);
  });

  it("keeps a failed init failed until retry", async () => {
    let started = 0;
    const life = createMeshoptLifecycle(() => {
      started += 1;
      return Promise.reject(new MeshoptLifecycleError("wasm missing", "unsupported"));
    });
    await expect(life.ensure()).rejects.toThrow(/wasm missing/);
    expect(life.status()).toBe("unsupported");
    await expect(life.ensure()).rejects.toThrow(/wasm missing/);
    expect(started).toBe(1);
    await expect(life.retry()).rejects.toThrow(/wasm missing/);
    expect(started).toBe(2);
  });

  it("does not start a second init while one is pending", () => {
    let started = 0;
    const life = createMeshoptLifecycle(() => {
      started += 1;
      return new Promise(() => {});
    });
    void life.ensure();
    void life.retry();
    expect(started).toBe(1);
    expect(life.status()).toBe("pending");
  });
});

describe("load plan and session", () => {
  it("parses ordinary GLBs even when the decoder failed", () => {
    const probed = probeGlb(makeGlb(plainJson));
    if (!probed.ok) throw new Error("probe");
    expect(planGltfLoad(probed.probe, "failed").action).toBe("parse");
  });

  it("falls back when a meshopt GLB meets a dead decoder", () => {
    const probed = probeGlb(makeGlb(meshoptJson));
    if (!probed.ok) throw new Error("probe");
    expect(planGltfLoad(probed.probe, "failed")).toEqual({ action: "fallback", reason: "meshopt-decoder-failed" });
    expect(planGltfLoad(probed.probe, "unsupported").reason).toBe("meshopt-decoder-unsupported");
    expect(planGltfLoad(probed.probe, "ready").action).toBe("parse");
    expect(planGltfLoad(probed.probe, "pending").action).toBe("parse");
  });

  it("classifies loader errors", () => {
    expect(classifyGltfLoadError("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files").code).toBe("meshopt-decoder-missing");
    expect(classifyGltfLoadError("Malformed buffer data: -1").code).toBe("meshopt-decode-failed");
    expect(classifyGltfLoadError("Could not load /models/missing.glb: 404").code).toBe("http-404");
  });

  it("dedupes an in-flight load and parses a plain GLB once", async () => {
    let parsed = 0;
    const bytes = makeGlb(plainJson);
    const session = createGltfLoadSession<number>({
      fetchBytes: async () => ({ ok: true, status: 200, bytes }),
      decoderStatus: () => "ready",
      parse: async () => {
        parsed += 1;
        return parsed;
      },
    });
    const [a, b] = await Promise.all([session.load("/models/a.glb"), session.load("/models/a.glb")]);
    expect(parsed).toBe(1);
    expect(a.phase).toBe("ready");
    expect(b.value).toBe(a.value);
    await session.load("/models/a.glb");
    expect(parsed).toBe(1);
  });

  it("does not parse a meshopt GLB when the decoder failed", async () => {
    let parsed = 0;
    const session = createGltfLoadSession({
      fetchBytes: async () => ({ ok: true, status: 200, bytes: makeGlb(meshoptJson) }),
      decoderStatus: () => "failed",
      prepareDecoder: async () => {},
      parse: async () => {
        parsed += 1;
        return { ok: true };
      },
    });
    const result = await session.load("/models/compressed.glb");
    expect(parsed).toBe(0);
    expect(result.phase).toBe("fallback");
    expect(result.reason).toBe("meshopt-decoder-failed");
    expect(result.message).toMatch(/Meshopt decoder failed/);
  });

  it("falls back on HTTP 404 and on a bad file", async () => {
    const missing = createGltfLoadSession({
      fetchBytes: async () => ({ ok: false, status: 404, bytes: null }),
      decoderStatus: () => "ready",
      parse: async () => ({}),
    });
    const gone = await missing.load("/models/missing.glb");
    expect(gone.reason).toBe("http-404");
    const garbage = createGltfLoadSession({
      fetchBytes: async () => ({ ok: true, status: 200, bytes: new Uint8Array([1, 2, 3, 4]) }),
      decoderStatus: () => "ready",
      parse: async () => ({}),
    });
    expect((await garbage.load("/models/bad.glb")).reason).toBe("too-small");
  });

  it("aborts an in-flight fetch and can be forgotten for a retry", async () => {
    let parsed = 0;
    const bytes = makeGlb(plainJson);
    const session = createGltfLoadSession<number>({
      fetchBytes: (_url, signal) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ ok: true, status: 200, bytes }), 30);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
      decoderStatus: () => "ready",
      parse: async () => {
        parsed += 1;
        return 1;
      },
      release: () => { parsed -= 1; },
    });
    const pending = session.load("/models/slow.glb");
    session.abort("/models/slow.glb");
    const aborted = await pending;
    expect(aborted.phase).toBe("aborted");
    expect(parsed).toBe(0);
    const loaded = await session.load("/models/slow.glb");
    expect(loaded.phase).toBe("ready");
    loaded.dispose();
    loaded.dispose();
    expect(parsed).toBe(0);
  });

  it("turns a meshopt loader failure into a fallback and releases once", async () => {
    let released = 0;
    const session = createGltfLoadSession<{ id: number }>({
      fetchBytes: async () => ({ ok: true, status: 200, bytes: makeGlb(meshoptJson) }),
      decoderStatus: () => "ready",
      parse: async () => {
        throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");
      },
      release: () => { released += 1; },
    });
    const result = await session.load("/models/compressed.glb");
    expect(result.phase).toBe("fallback");
    expect(result.reason).toBe("meshopt-decoder-missing");
    expect(released).toBe(0);
    result.dispose();
    result.dispose();
    expect(released).toBe(0);
  });
});

describe("repo model manifest", () => {
  it("matches public/models and the loader registry", () => {
    const dir = join(root, "public", "models");
    const glbs = readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".glb")).sort();
    const records = glbs.map((file) => {
      const bytes = new Uint8Array(readFileSync(join(dir, file)));
      const probed = probeGlb(bytes);
      expect(probed.ok).toBe(true);
      if (!probed.ok) throw new Error(file);
      expect(probed.probe.byteLength).toBe(statSync(join(dir, file)).size);
      expect(probed.probe.declaredLength).toBe(bytes.byteLength);
      return { file, bytes: bytes.byteLength, meshopt: probed.probe.meshopt, meshoptRequired: probed.probe.meshoptRequired, probe: probed.probe };
    });
    const parsed = parseModelManifest(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")));
    expect(parsed.issues).toEqual([]);
    if (!parsed.manifest) throw new Error("manifest");
    expect(parsed.manifest.handoffArchiveAttached).toBe(false);
    expect(parsed.manifest.integrationDoc).toBeNull();
    const issues = checkModelManifest({
      manifest: parsed.manifest,
      files: records.map(({ file, bytes, meshopt, meshoptRequired }) => ({ file, bytes, meshopt, meshoptRequired })),
      registry: MAIN_GAME_MODELS,
    });
    expect(issues).toEqual([]);
    const cesium = parsed.manifest.entries.find((entry) => entry.id === "cesium-man");
    const cesiumProbe = records.find((record) => record.file === "CesiumMan.glb");
    expect(cesium).toBeTruthy();
    expect(cesiumProbe).toBeTruthy();
    expect(cesium?.meshopt).toBe(false);
    expect(cesium?.generator).toBe(cesiumProbe?.probe.generator);
    expect(cesium?.bytes).toBe(cesiumProbe?.bytes);
    expect(cesiumProbe?.probe.meshCount).toBe(1);
    expect(cesiumProbe?.probe.animationCount).toBe(1);
  });

  it("reports missing files, unlisted files, flag drift, and registry drift", () => {
    const manifest = parseModelManifest({
      kind: "main-game-models",
      source: "repo-public-models",
      integrationDoc: null,
      handoffArchiveAttached: false,
      entries: [
        {
          id: "cesium-man",
          file: "CesiumMan.glb",
          bytes: 10,
          meshopt: true,
          meshoptRequired: true,
          extensionsUsed: [MESHOPT_EXTENSION],
          extensionsRequired: [MESHOPT_EXTENSION],
          role: "prop",
          generator: null,
        },
        {
          id: "cesium-man",
          file: "CesiumMan.glb",
          bytes: 10,
          meshopt: true,
          meshoptRequired: true,
          extensionsUsed: [],
          extensionsRequired: [],
          role: "character",
          generator: null,
        },
      ],
    }).manifest;
    if (!manifest) throw new Error("manifest");
    const codes = checkModelManifest({
      manifest,
      files: [
        { file: "CesiumMan.glb", bytes: 438044, meshopt: false, meshoptRequired: false },
        { file: "extra.glb", bytes: 4, meshopt: false, meshoptRequired: false },
      ],
      registry: MAIN_GAME_MODELS,
    }).map((issue) => issue.code);
    expect(codes).toContain("duplicate-id");
    expect(codes).toContain("duplicate-file");
    expect(codes).toContain("byte-mismatch");
    expect(codes).toContain("meshopt-flag-mismatch");
    expect(codes).toContain("meshopt-required-mismatch");
    expect(codes).toContain("unlisted-file");
    expect(codes).toContain("role-mismatch");
  });

  it("rejects a manifest that is not the main-game model list", () => {
    expect(parseModelManifest({ station: "whale", tracks: [] }).issues[0].code).toBe("kind-mismatch");
  });
});

describe("handoff claim versus the repo", () => {
  it("reads an explicit count and leaves prose uncounted", () => {
    expect(readIntegrationDocCount("glb_count: 12\n")).toEqual({ count: 12, ambiguous: false });
    expect(readIntegrationDocCount("The pack is large.\n")).toEqual({ count: null, ambiguous: false });
    expect(readIntegrationDocCount("glb_count: 12\nmodel_count: 40\n").ambiguous).toBe(true);
  });

  it("keeps a described 344-GLB handoff unverified when the doc and archive are absent", () => {
    const docs = findNamedFiles(INTEGRATION_DOC_NAME);
    const looseGlbs = readdirSync(join(root, "public", "models")).filter((name) => name.toLowerCase().endsWith(".glb"));
    const docText = docs.length === 1 ? readFileSync(docs[0], "utf8") : "";
    const stated = docs.length === 1 ? readIntegrationDocCount(docText) : { count: null, ambiguous: false };
    const assessment = assessAssetHandoff({
      describedGlbCount: 344,
      integrationDocPresent: docs.length > 0,
      integrationDocStatedCount: stated.count,
      integrationDocCountAmbiguous: stated.ambiguous,
      archiveAttached: false,
      repoGlbFiles: looseGlbs,
    });
    expect(assessment.archiveAttached).toBe(false);
    expect(assessment.status).toBe("unverified");
    expect(assessment.verifiedRepoGlbCount).toBe(looseGlbs.length);
    expect(assessment.describedGlbCount).toBe(344);
    expect(assessment.blockers.some((line) => line.includes("archive"))).toBe(true);
    if (docs.length === 0) {
      expect(assessment.integrationDocPresent).toBe(false);
      expect(assessment.blockers.some((line) => line.includes(INTEGRATION_DOC_NAME))).toBe(true);
    }
    const zipListing = execFileSync("unzip", ["-l", join(root, "quahog-web-preview 2.zip")], { encoding: "utf8" });
    const zipGlbs = zipListing.split("\n").map((line) => line.trim()).filter((line) => line.toLowerCase().endsWith(".glb"));
    expect(zipGlbs.map((line) => basename(line.split(/\s+/).pop() ?? ""))).toEqual(["CesiumMan.glb"]);
  });

  it("compares a doc count to repo files only when an archive is attached", () => {
    const mismatch = assessAssetHandoff({
      describedGlbCount: 344,
      integrationDocPresent: true,
      integrationDocStatedCount: 5,
      archiveAttached: true,
      repoGlbFiles: ["a.glb", "b.glb"],
    });
    expect(mismatch.status).toBe("mismatch");
    expect(mismatch.verifiedRepoGlbCount).toBe(2);
    const verified = assessAssetHandoff({
      describedGlbCount: null,
      integrationDocPresent: true,
      integrationDocStatedCount: 2,
      archiveAttached: true,
      repoGlbFiles: ["a.glb", "b.glb"],
    });
    expect(verified.status).toBe("verified");
  });
});

describe("meshopt decoder module", () => {
  it("roundtrips a buffer through the encoder and three's decoder", async () => {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    const count = 4;
    const size = 4;
    const source = new Uint8Array(count * size);
    for (let i = 0; i < source.length; i += 1) source[i] = (i * 17) & 255;
    const encoded = MeshoptEncoder.encodeGltfBuffer(source, count, size, "ATTRIBUTES");
    const decoded = new Uint8Array(source.length);
    MeshoptDecoder.decodeGltfBuffer(decoded, count, size, encoded, "ATTRIBUTES", "NONE");
    expect(Array.from(decoded)).toEqual(Array.from(source));
    const asyncDecoder = MeshoptDecoder as typeof MeshoptDecoder & {
      decodeGltfBufferAsync: (count: number, size: number, source: Uint8Array, mode: string, filter?: string) => Promise<Uint8Array>;
    };
    const asyncDecoded = await asyncDecoder.decodeGltfBufferAsync(count, size, encoded, "ATTRIBUTES", "NONE");
    expect(Array.from(asyncDecoded)).toEqual(Array.from(source));
  });

  it("reports the main-game decoder ready", async () => {
    await ensureMainGameMeshopt();
    expect(meshoptStatus()).toBe("ready");
  });

  it("parses the in-repo CesiumMan GLB with the decoder attached", async () => {
    const bytes = new Uint8Array(readFileSync(join(root, "public/models/CesiumMan.glb")));
    (globalThis as { self?: unknown }).self ??= globalThis;
    await ensureMainGameMeshopt();
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "/models/");
    expect(gltf.animations).toHaveLength(1);
    expect(gltf.scene.children.length).toBeGreaterThan(0);
  });
});

function findNamedFiles(name: string): string[] {
  const found: string[] = [];
  findNamed(root, name, found);
  return found;
}
