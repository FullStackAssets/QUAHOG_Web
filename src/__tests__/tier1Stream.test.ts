import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { disposeGltfScene } from "../actors/PackGLB";
import {
  TIER1_STREAM_LOAD_RADIUS,
  TIER1_STREAM_MAX_MOUNTED,
  TIER1_STREAM_MOUNTS_PER_FRAME,
  TIER1_STREAM_UNLOAD_RADIUS,
  TIER1_STREAM_UNMOUNTS_PER_FRAME,
  nextStreamedIds,
  resolveStreamedTier1File,
  settleStreamedIds,
  type Tier1StreamEntry,
} from "../world/tier1Stream";
import { DOWNTOWN_TIER1_MODELS } from "../world/downtownTier1Models";
import { NB_TIER1_MODELS } from "../world/nbTier1Models";
import { TIER1_MODELS } from "../world/tier1Models";

// All tier1 GLBs visible to Vite, keyed by their relative path — used to
// prove every streamed fallback target exists without node:fs imports
// (@types/node is not installed in this project).
const tier1Files = import.meta.glob("../../public/tier1/*.glb");

const entry = (id: string, x: number, z: number): Tier1StreamEntry => ({
  id,
  position: [x, 0, z],
  file: `/tier1/${id}.glb`,
});

describe("tier1Stream radii and caps", () => {
  it("pins the measured radii and caps", () => {
    // Measured from the manifests (see tier1Stream.ts header): NB spawn
    // mounts 41/83 at 150 m, the densest downtown point holds 42 within
    // 150 m, and the FR spawn's nearest model is 202 m out.
    expect(TIER1_STREAM_LOAD_RADIUS).toBe(150);
    expect(TIER1_STREAM_UNLOAD_RADIUS).toBe(250);
    expect(TIER1_STREAM_MAX_MOUNTED).toBe(48);
    expect(TIER1_STREAM_MOUNTS_PER_FRAME).toBe(4);
    expect(TIER1_STREAM_UNMOUNTS_PER_FRAME).toBe(8);
    expect(TIER1_STREAM_LOAD_RADIUS).toBeLessThan(TIER1_STREAM_UNLOAD_RADIUS);
  });

  it("mounts entries within the load radius (boundary inclusive)", () => {
    const entries = [
      entry("a", 0, 0),
      entry("b", 50, 0),
      entry("c", 100, 0),
      entry("d", 150, 0),
      entry("e", 151, 0),
      entry("f", 250, 0),
      entry("g", 400, 0),
    ];
    const next = settleStreamedIds(entries, 0, 0);
    expect([...next].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps mounted entries through the hysteresis band, unmounts past it", () => {
    const entries = [entry("a", 0, 0)];
    let cur = settleStreamedIds(entries, 0, 0);
    expect(cur.has("a")).toBe(true);
    // 200 m: inside the band — stays mounted.
    cur = nextStreamedIds(cur, entries, 200, 0);
    expect(cur.has("a")).toBe(true);
    // Exactly 250 m: unmount only when PAST the unload radius — stays.
    cur = nextStreamedIds(cur, entries, 250, 0);
    expect(cur.has("a")).toBe(true);
    // 251 m: past the unload radius — unmounts.
    cur = nextStreamedIds(cur, entries, 251, 0);
    expect(cur.has("a")).toBe(false);
    // Back to 200 m: inside the band but unmounted — does NOT remount.
    cur = nextStreamedIds(cur, entries, 200, 0);
    expect(cur.has("a")).toBe(false);
    // Back to 150 m: within the load radius — remounts.
    cur = nextStreamedIds(cur, entries, 150, 0);
    expect(cur.has("a")).toBe(true);
  });

  it("returns the same Set when nothing changes (no re-render churn)", () => {
    const entries = [entry("a", 0, 0), entry("b", 100, 0), entry("c", 500, 0)];
    const settled = settleStreamedIds(entries, 0, 0);
    expect(nextStreamedIds(settled, entries, 0, 0)).toBe(settled);
    // Wobbling inside the band changes nothing either.
    expect(nextStreamedIds(settled, entries, 30, 0)).toBe(settled);
  });

  it("admits at most MOUNTS_PER_FRAME per call, nearest first", () => {
    const entries = Array.from({ length: 10 }, (_, i) => entry(`m${(i + 1) * 10}`, (i + 1) * 10, 0));
    let cur: ReadonlySet<string> = new Set();
    cur = nextStreamedIds(cur, entries, 0, 0);
    expect([...cur].sort()).toEqual(["m10", "m20", "m30", "m40"]);
    cur = nextStreamedIds(cur, entries, 0, 0);
    expect(cur.size).toBe(8);
    expect([...cur].sort()).toEqual([
      "m10", "m20", "m30", "m40", "m50", "m60", "m70", "m80",
    ]);
    cur = nextStreamedIds(cur, entries, 0, 0);
    expect(cur.size).toBe(10);
  });

  it("unmounts at most UNMOUNTS_PER_FRAME per call, farthest first", () => {
    const entries = Array.from({ length: 20 }, (_, i) => entry(`m${i * 10}`, i * 10, 0));
    const prev = new Set(entries.map((e) => e.id));
    // Teleport 1000 m east: everything is past the unload radius.
    const next = nextStreamedIds(prev, entries, 1000, 0);
    expect(next.size).toBe(20 - TIER1_STREAM_UNMOUNTS_PER_FRAME);
    // Farthest from the camera (smallest x) dropped first.
    for (const id of ["m0", "m10", "m20", "m30", "m40", "m50", "m60", "m70"]) {
      expect(next.has(id)).toBe(false);
    }
    expect(next.has("m190")).toBe(true);
    // Settles to empty over a few frames.
    expect(settleStreamedIds(entries, 1000, 0).size).toBe(0);
  });

  it("hard cap evicts the farthest band models, never the within-load core", () => {
    // 40 within load + 10 in the band, all mounted: over the 48 cap.
    const entries = [
      ...Array.from({ length: 40 }, (_, i) => entry(`core${i}`, i * 2, 0)),
      ...Array.from({ length: 10 }, (_, i) => entry(`band${i}`, 160 + i * 10, 0)),
    ];
    const prev = new Set(entries.map((e) => e.id));
    const next = nextStreamedIds(prev, entries, 0, 0);
    expect(next.size).toBe(TIER1_STREAM_MAX_MOUNTED);
    // The 2 farthest band models (250 m, 240 m) were evicted.
    expect(next.has("band9")).toBe(false);
    expect(next.has("band8")).toBe(false);
    // The whole within-load core survived.
    for (let i = 0; i < 40; i++) expect(next.has(`core${i}`)).toBe(true);
  });

  it("soft-cap limit: a set that is entirely within load radius cannot be capped", () => {
    // Documented in tier1Stream.ts: the cap only trims the band. If a
    // future manifest ever packed >48 models within load radius, the set
    // would stay over the cap — the real manifests pin that case at 42
    // (see the spawn-budget test below), so this cannot happen in-game.
    const entries = Array.from({ length: 50 }, (_, i) => entry(`c${i}`, i * 2, 0));
    const prev = new Set(entries.map((e) => e.id));
    expect(nextStreamedIds(prev, entries, 0, 0).size).toBe(50);
  });
});

describe("tier1Stream on the real manifests", () => {
  const NB = [...DOWNTOWN_TIER1_MODELS, ...NB_TIER1_MODELS];

  it("settles to 41 mounted at the Bethel spawn (not 83)", () => {
    // The crash point: before streaming, all 83 NB models mounted at
    // spawn. Now the settled spawn set is exactly the 41 within 150 m.
    const settled = settleStreamedIds(NB, -256, 106);
    expect(settled.size).toBe(41);
    for (const e of NB) {
      const d = Math.hypot(e.position[0] + 256, e.position[2] - 106);
      expect(settled.has(e.id)).toBe(d <= TIER1_STREAM_LOAD_RADIUS);
    }
  });

  it("settles to 42 at the densest downtown point (cap headroom holds)", () => {
    // Worst within-load cluster anywhere downtown is 42 < 48, so the
    // cap never has to evict a within-load model at a standstill.
    expect(settleStreamedIds(NB, -240, 70).size).toBe(42);
  });

  it("settles to 0 at the FR fast-travel spawn (nearest model 202 m out)", () => {
    // Honest limit (tier1Stream.ts header): the FR spawn's nearest model
    // is ships_cove at 202 m, outside the load radius. Generic
    // extrusions still render there; landmarks pop in on approach.
    expect(settleStreamedIds(TIER1_MODELS, -19972, -7348).size).toBe(0);
  });

  it("never exceeds the cap on a drive through downtown, and sheds the east", () => {
    // The proven killer: Nic's crash happened while DRIVING, not at
    // spawn — memory filled as new areas loaded in. Driving west from
    // the Bethel through the core must keep the resident set bounded
    // and actually drop the models left behind.
    let cur: ReadonlySet<string> = new Set();
    const path: [number, number][] = [];
    for (let x = -256; x >= -556; x -= 50) path.push([x, 106]);
    for (const [x, z] of path) {
      cur = nextStreamedIds(cur, NB, x, z);
      expect(cur.size).toBeLessThanOrEqual(TIER1_STREAM_MAX_MOUNTED);
    }
    // Settle at the west end: the eastern spawn-area models are gone…
    cur = settleStreamedIds(NB, -556, 106);
    expect(cur.size).toBeLessThanOrEqual(TIER1_STREAM_MAX_MOUNTED);
    for (const e of NB) {
      if (e.position[0] > -150) expect(cur.has(e.id)).toBe(false);
    }
    // …and the models near the new position are mounted.
    const nearEnd = NB.filter(
      (e) => Math.hypot(e.position[0] + 556, e.position[2] - 106) <= 150,
    );
    expect(nearEnd.length).toBeGreaterThan(0);
    for (const e of nearEnd) expect(cur.has(e.id)).toBe(true);
  });
});

describe("disposeGltfScene", () => {
  it("disposes shared clone/original resources exactly once", () => {
    const geo = new THREE.BufferGeometry();
    const texA = new THREE.Texture();
    const texB = new THREE.Texture();
    const matA = new THREE.MeshStandardMaterial({ map: texA, normalMap: texB });
    const matB = new THREE.MeshStandardMaterial();
    const mesh1 = new THREE.Mesh(geo, matA);
    const mesh2 = new THREE.Mesh(geo, [matA, matB]);
    const child = new THREE.Group();
    child.add(mesh2);
    const original = new THREE.Group();
    original.add(mesh1, child);
    // three's clone() shares geometry/material references with the
    // original — exactly the PackGLB situation.
    const clone = original.clone(true);

    const counts = new Map<string, number>();
    const watch = (key: string, obj: { dispose: () => void }) => {
      const orig = obj.dispose.bind(obj);
      obj.dispose = () => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        orig();
      };
    };
    watch("geo", geo);
    watch("matA", matA);
    watch("matB", matB);
    watch("texA", texA);
    watch("texB", texB);

    disposeGltfScene(clone, original);
    expect(counts.get("geo")).toBe(1);
    expect(counts.get("matA")).toBe(1);
    expect(counts.get("matB")).toBe(1);
    expect(counts.get("texA")).toBe(1);
    expect(counts.get("texB")).toBe(1);
  });

  it("tolerates null roots and empty scenes", () => {
    expect(() => disposeGltfScene(null, undefined)).not.toThrow();
    expect(() => disposeGltfScene(new THREE.Group())).not.toThrow();
  });
});

describe("streamed mounts keep the mobile _detail fallback", () => {
  it("maps every manifest _detail entry to its original on mobile", () => {
    const detailEntries = [...DOWNTOWN_TIER1_MODELS, ...NB_TIER1_MODELS].filter((m) =>
      m.file.endsWith("_detail.glb"),
    );
    expect(detailEntries.length).toBe(14);
    for (const m of detailEntries) {
      const base = m.file.slice(0, -"_detail.glb".length) + ".glb";
      expect(resolveStreamedTier1File(m.file, true)).toBe(base);
      expect(resolveStreamedTier1File(m.file, false)).toBe(m.file);
      expect(`../../public${base}` in tier1Files).toBe(true);
    }
  });

  it("every streamed entry resolves to a real file on mobile and desktop", () => {
    for (const m of [...DOWNTOWN_TIER1_MODELS, ...NB_TIER1_MODELS, ...TIER1_MODELS]) {
      for (const mobile of [true, false]) {
        const resolved = resolveStreamedTier1File(m.file, mobile);
        expect(`../../public${resolved}` in tier1Files).toBe(true);
      }
    }
  });
});
