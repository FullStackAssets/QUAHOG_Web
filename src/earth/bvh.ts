import { useContext, useEffect } from "react";
import * as THREE from "three";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { TilesRendererContext } from "3d-tiles-renderer/r3f";

// Accelerate raycasts (ground/wall collision) against the streaming photoreal
// tiles with a BVH, and hard-bound tile memory so the GPU doesn't OOM / lose its
// WebGL context. This is the core of the crash fix.

// patch three so every BufferGeometry can build a BVH and meshes use it
/* eslint-disable @typescript-eslint/no-explicit-any */
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

const MB = 1024 * 1024;

export function TilesBVH() {
  const tiles = useContext(TilesRendererContext);
  useEffect(() => {
    if (!tiles) return;
    const t = tiles as any;

    // bound memory: evict tiles aggressively (defaults are ~0.4 GB / 8000)
    if (t.lruCache) {
      t.lruCache.minBytesSize = 180 * MB;
      t.lruCache.maxBytesSize = 280 * MB;
      t.lruCache.maxSize = 3500;
    }
    // smaller concurrent load/parse spikes
    if (t.downloadQueue) t.downloadQueue.maxJobs = 6;
    if (t.parseQueue) t.parseQueue.maxJobs = 3;

    const onLoad = (e: any) => {
      e.scene?.traverse((o: any) => {
        if (o.geometry?.computeBoundsTree && !o.geometry.boundsTree) {
          try { o.geometry.computeBoundsTree(); } catch { /* skip odd geometry */ }
        }
      });
    };
    const onDispose = (e: any) => {
      e.scene?.traverse((o: any) => {
        if (o.geometry?.disposeBoundsTree) o.geometry.disposeBoundsTree();
      });
    };
    tiles.addEventListener("load-model", onLoad);
    tiles.addEventListener("dispose-model", onDispose);
    return () => {
      tiles.removeEventListener("load-model", onLoad);
      tiles.removeEventListener("dispose-model", onDispose);
    };
  }, [tiles]);
  return null;
}
