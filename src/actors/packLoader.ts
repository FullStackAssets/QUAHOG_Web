import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { reportModel } from "../debug/modelStatus";

// Shared cached pack loader for components that need the loaded scene itself
// (TrafficPackCar for WheelRig, RiggedPedestrian for its animation mixer).
// PackGLB covers fire-and-forget rendering; this hook covers the cases where
// a sibling component must share the exact cloned scene that is rendered.
// One parsed GLTF per URL, cloned per instance; in-flight loads deduped.
const cache = new Map<string, GLTF>();
const inflight = new Map<string, Promise<GLTF>>();

export function usePackGLB(path: string): { scene: THREE.Group | null; animations: THREE.AnimationClip[] } {
  const [gltf, setGltf] = useState<GLTF | null>(() => cache.get(path) ?? null);

  useEffect(() => {
    if (!path) return; // no-garment callers pass "" — nothing to load
    if (cache.has(path)) {
      setGltf(cache.get(path)!);
      return;
    }
    let alive = true;
    let p = inflight.get(path);
    if (!p) {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      reportModel(path, "loading");
      p = new Promise<GLTF>((res, rej) => loader.load(path, res, undefined, rej));
      inflight.set(path, p);
    }
    p.then((g) => {
      cache.set(path, g);
      inflight.delete(path);
      reportModel(path, "loaded");
      if (alive) setGltf(g);
    }).catch((err) => {
      inflight.delete(path);
      reportModel(path, "failed", err instanceof Error ? err.message : String(err));
      console.error("[usePackGLB] failed to load", path, err);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  const scene = useMemo(() => {
    if (!gltf) return null;
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.castShadow = true;
    });
    return cloned;
  }, [gltf]);

  return { scene, animations: gltf?.animations ?? [] };
}
