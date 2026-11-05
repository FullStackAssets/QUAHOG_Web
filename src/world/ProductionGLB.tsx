import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useGame } from "../store";
import { isMobileDevice } from "../mobile/profile";
import {
  ASSET_FAILURE_BACKOFF_MS,
  ASSET_LOAD_CONCURRENCY,
  shouldRenderDetailedModel,
  sourceBasisRotation,
  mobileModelRadius,
} from "./AssetRuntimePolicy";

/**
 * Production-only on-demand GLB loader. Only a few near-camera details are
 * downloaded at once. Stream A (2026-11-03): NOTHING renders while loading,
 * outside the detail radius, or after failure — there is no procedural
 * stand-in. A caller that needs a placeholder must pass a GLB-based node
 * as `fallback`; never a procedural mesh. No game state or physics changes.
 * NOTE: this component currently has no JSX callers in src (verified
 * 2026-11-03), so this change alters no rendered output today; it fixes
 * the contract and the log wording for future callers.
 */
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const MAX_RESOLVED_MODEL_CACHE = 96;
const cache = new Map<string, Promise<THREE.Group>>();
const resolved = new Set<string>();
function trimResolvedCache(): void {
  if (cache.size <= MAX_RESOLVED_MODEL_CACHE) return;
  for (const path of cache.keys()) {
    if (cache.size <= MAX_RESOLVED_MODEL_CACHE) break;
    if (!resolved.has(path)) continue; // never evict an in-flight request
    cache.delete(path);
    resolved.delete(path);
  }
}
const failureUntil = new Map<string, number>();
const queue: Array<() => void> = [];
let inFlight = 0;
const metrics = { attempts: 0, successes: 0, failures: 0, lastFailedPath: "" };

function dispatch(): void {
  while (inFlight < ASSET_LOAD_CONCURRENCY && queue.length) {
    inFlight++;
    queue.shift()!();
  }
}

/** Read-only local diagnostics for browser test instrumentation; no telemetry egress. */
export function productionAssetMetrics() {
  return { ...metrics, queued: queue.length, activeDownloads: inFlight, cachedModels: cache.size };
}

function loadModel(path: string): Promise<THREE.Group> {
  const existing = cache.get(path);
  if (existing) { cache.delete(path); cache.set(path, existing); return existing; }
  if ((failureUntil.get(path) ?? 0) > Date.now()) {
    return Promise.reject(new Error(`Asset temporarily unavailable: ${path}`));
  }
  const task = new Promise<THREE.Group>((resolve, reject) => {
    queue.push(() => {
      metrics.attempts++;
      MeshoptDecoder.ready
        .then(() => new Promise<THREE.Group>((done, failed) => {
          loader.load(path, gltf => done(gltf.scene), undefined, failed);
        }))
        .then(scene => {
          metrics.successes++;
          failureUntil.delete(path);
          resolved.add(path);
          trimResolvedCache();
          resolve(scene);
        }, error => {
          metrics.failures++;
          metrics.lastFailedPath = path;
          failureUntil.set(path, Date.now() + ASSET_FAILURE_BACKOFF_MS);
          reject(error);
        })
        .finally(() => { inFlight--; dispatch(); });
    });
    dispatch();
  });
  cache.set(path, task);
  task.catch(() => {
    if (cache.get(path) === task) cache.delete(path);
    resolved.delete(path);
  });
  return task;
}

export function ProductionGLB({ path, fallback = null, rotation = [0, 0, 0], scale = 1, detailRadius = 175 }: {
  path: `/quahog-assets/${string}.glb`;
  /** GLB-based placeholder only (or null = render nothing). Never a
   *  procedural mesh — the old "procedural fallback" contract is removed. */
  fallback?: ReactNode;
  rotation?: [number, number, number];
  scale?: number;
  detailRadius?: number;
}) {
  const anchor = useRef<THREE.Group>(null);
  const frameCount = useRef(0);
  const world = useRef(new THREE.Vector3());
  const cameraWorld = useRef(new THREE.Vector3());
  const [near, setNear] = useState(false);
  const nearRef = useRef(false);
  const quality = useGame(s => s.quality);
  const radius = mobileModelRadius(detailRadius, quality, isMobileDevice());
  // The path travels with the model. Never draw a previously fetched model if
  // a parent reuses this component with a different path during streaming.
  const [model, setModel] = useState<{ path: string; scene: THREE.Group } | null>(null);

  // One distance check every 12 frames avoids per-object React updates per frame.
  useFrame(({ camera }) => {
    if (++frameCount.current % 12 !== 1 || !anchor.current) return;
    anchor.current.getWorldPosition(world.current);
    camera.getWorldPosition(cameraWorld.current);
    const dx = world.current.x - cameraWorld.current.x;
    const dz = world.current.z - cameraWorld.current.z;
    const visible = shouldRenderDetailedModel(Math.hypot(dx, dz), nearRef.current, radius);
    if (visible !== nearRef.current) { nearRef.current = visible; setNear(visible); }
  });

  useEffect(() => {
    if (!near) return;
    let mounted = true;
    loadModel(path).then(scene => {
      if (mounted) setModel({ path, scene: scene.clone(true) });
    }).catch(error => {
      if (mounted) console.warn(`[QUAHOG asset] load failed, rendering nothing (no procedural fallback): ${path}`, error);
    });
    return () => { mounted = false; };
  }, [path, near]);

  // Source coordinate correction is applied only to P006 GLBs. Call-site yaw
  // rotations remain unchanged, preserving vehicle placement and navigation.
  const corrected = sourceBasisRotation(path);
  return (
    <group ref={anchor}>
      {near && model?.path === path ? (
        <group rotation={rotation} scale={scale}>
          <primitive object={model.scene} rotation={corrected} />
        </group>
      ) : <>{fallback}</>}
    </group>
  );
}
