import { useContext, useLayoutEffect } from "react";
import * as THREE from "three";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { TilesRendererContext } from "3d-tiles-renderer/r3f";
import { applyTileMemoryCaps, type TileMemoryHost } from "./tileCaps";
import { buildTileBVH, disposeTileBVH, type BoundsNode } from "./tileBounds";

// Accelerate raycasts against streaming tiles and re-apply the memory caps.
// TileCompressionPlugin is intentionally not registered: it quantizes vertex
// positions, which is a visual change, and it does not build the raycast BVH.
// three-mesh-bvh falls back to the unaccelerated raycast when a mesh has no tree.

/* eslint-disable @typescript-eslint/no-explicit-any */
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export function TilesBVH() {
  const tiles = useContext(TilesRendererContext);
  useLayoutEffect(() => {
    if (!tiles) return;
    applyTileMemoryCaps(tiles as unknown as TileMemoryHost);

    const onLoad = (event: { scene?: BoundsNode }) => { buildTileBVH(event.scene); };
    const onDispose = (event: { scene?: BoundsNode }) => { disposeTileBVH(event.scene); };
    tiles.addEventListener("load-model", onLoad as (event: { type: string }) => void);
    tiles.addEventListener("dispose-model", onDispose as (event: { type: string }) => void);
    return () => {
      tiles.removeEventListener("load-model", onLoad as (event: { type: string }) => void);
      tiles.removeEventListener("dispose-model", onDispose as (event: { type: string }) => void);
    };
  }, [tiles]);
  return null;
}
