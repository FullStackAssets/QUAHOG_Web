import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { bumpAssetGeneration, clearAssetNotices, reportAssetNotice } from "./assetNotices";
import { createGltfLoadSession, type GltfLoadSession } from "./gltfLoadSession";
import { ensureMainGameMeshopt, meshoptStatus, retryMainGameMeshopt } from "./mainGameMeshopt";
import { MAIN_GAME_MODELS } from "./modelRegistry";

type ReactEntry =
  | { state: "pending"; promise: Promise<void> }
  | { state: "ready"; value: GLTF }
  | { state: "error"; error: Error };

const reactCache = new Map<string, ReactEntry>();
let cacheGeneration = 0;
let session: GltfLoadSession<GLTF> | null = null;

function getSession(): GltfLoadSession<GLTF> {
  if (session) return session;
  session = createGltfLoadSession<GLTF>({
    fetchBytes: async (url, signal) => {
      const response = await fetch(url, { signal });
      if (!response.ok) return { ok: false, status: response.status, bytes: null };
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { ok: true, status: response.status, bytes };
    },
    decoderStatus: () => meshoptStatus(),
    prepareDecoder: () => ensureMainGameMeshopt(),
    parse: (url, bytes) => parseWithMeshopt(url, bytes),
  });
  return session;
}

async function parseWithMeshopt(url: string, bytes: Uint8Array): Promise<GLTF> {
  const loader = new GLTFLoader();
  const status = meshoptStatus();
  // Attach the live decoder while it is usable. GLTFLoader waits inside
  // decodeGltfBufferAsync, so a still-pending ready promise is safe. A failed
  // init is left detached; meshopt files never reach this function in that case.
  if ((status === "ready" || status === "pending") && MeshoptDecoder.supported !== false) {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return loader.parseAsync(buffer, resourcePath(url));
}

function resourcePath(url: string): string {
  const slash = url.lastIndexOf("/");
  return slash >= 0 ? url.slice(0, slash + 1) : "";
}

export async function loadMainGameGltf(url: string): Promise<GLTF> {
  const outcome = await getSession().load(url);
  if (outcome.phase === "ready" && outcome.value) return outcome.value;
  throw new Error(`${url}: ${outcome.message}`);
}

function prime(url: string): void {
  if (reactCache.has(url)) return;
  const generation = cacheGeneration;
  const promise = loadMainGameGltf(url).then(
    (value) => {
      if (generation !== cacheGeneration) return;
      reactCache.set(url, { state: "ready", value });
    },
    (error: unknown) => {
      if (generation !== cacheGeneration) return;
      const err = error instanceof Error ? error : new Error(String(error));
      reactCache.set(url, { state: "error", error: err });
      reportAssetNotice({ key: url, level: "error", message: err.message });
    },
  );
  reactCache.set(url, { state: "pending", promise });
}

export function useMainGameGltf(url: string): GLTF {
  prime(url);
  const entry = reactCache.get(url);
  if (!entry) throw new Error(`${url}: loader cache was cleared during load`);
  if (entry.state === "pending") throw entry.promise;
  if (entry.state === "error") throw entry.error;
  return entry.value;
}

export function preloadMainGameModels(): void {
  if (typeof fetch !== "function") return;
  for (const model of MAIN_GAME_MODELS) prime(model.url);
}

export async function retryMainGameAssets(): Promise<void> {
  clearAssetNotices();
  await retryMainGameMeshopt();
  cacheGeneration += 1;
  reactCache.clear();
  getSession().forgetAll();
  bumpAssetGeneration();
  for (const model of MAIN_GAME_MODELS) prime(model.url);
}

export function clearMainGameGltfForTests(): void {
  session?.forgetAll();
  session = null;
  reactCache.clear();
}
