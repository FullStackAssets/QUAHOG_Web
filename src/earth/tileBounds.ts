// Build / drop a mesh BVH on a tile scene graph. The three-mesh-bvh prototype
// patch lives in bvh.ts; this module only walks the graph so it can be tested
// without patching Mesh.raycast.

export interface BoundsGeometry {
  boundsTree?: unknown;
  computeBoundsTree?: () => void;
  disposeBoundsTree?: () => void;
}

export interface BoundsNode {
  geometry?: BoundsGeometry;
  traverse?: (fn: (node: BoundsNode) => void) => void;
}

export function buildTileBVH(root: BoundsNode | null | undefined): { built: number; skipped: number } {
  let built = 0;
  let skipped = 0;
  const visit = (node: BoundsNode) => {
    const geometry = node.geometry;
    if (!geometry?.computeBoundsTree) return;
    if (geometry.boundsTree) {
      skipped += 1;
      return;
    }
    try {
      geometry.computeBoundsTree();
      built += 1;
    } catch {
      skipped += 1;
    }
  };
  if (!root) return { built, skipped };
  if (root.traverse) root.traverse(visit);
  else visit(root);
  return { built, skipped };
}

export function disposeTileBVH(root: BoundsNode | null | undefined): number {
  let disposed = 0;
  const visit = (node: BoundsNode) => {
    const geometry = node.geometry;
    if (!geometry?.disposeBoundsTree) return;
    geometry.disposeBoundsTree();
    disposed += 1;
  };
  if (!root) return 0;
  if (root.traverse) root.traverse(visit);
  else visit(root);
  return disposed;
}
