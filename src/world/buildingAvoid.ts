// Kinematic ped/actor push-out against building footprints.
//
// Pedestrians are kinematic by design (no rigid bodies, so they can never shove
// the player's physics car). This module gives them cheap building avoidance:
// registered footprints become world-space AABBs, and pushOutOfBuildings()
// nudges a circle out of any overlap. AABB (not exact polygon) is plenty for
// keeping feet out of walls.
import type { Building } from "../slice";

interface Box { minX: number; maxX: number; minZ: number; maxZ: number; }

const sources = new Map<string, Box[]>();
let boxes: Box[] = [];

function toBoxes(buildings: Building[]): Box[] {
  const out: Box[] = [];
  for (const b of buildings) {
    if (b.footprint.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [e, n] of b.footprint) {
      const z = -n; // world z = -north (matches toWorld / StreetLife)
      if (e < minX) minX = e;
      if (e > maxX) maxX = e;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX) || maxX - minX < 0.5 || maxZ - minZ < 0.5) continue;
    out.push({ minX, maxX, minZ, maxZ });
  }
  return out;
}

/**
 * Register (or re-register) a named set of slice-local building footprints.
 * Idempotent per source name — safe to call on remount.
 */
export function setBuildingFootprints(source: string, buildings: Building[]): void {
  sources.set(source, toBoxes(buildings));
  boxes = [...sources.values()].flat();
}

/** Push a circle at (x,z) with radius r out of every registered building box. */
export function pushOutOfBuildings(x: number, z: number, r = 0.45): [number, number] {
  for (const b of boxes) {
    if (x + r < b.minX || x - r > b.maxX || z + r < b.minZ || z - r > b.maxZ) continue;
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // center inside the box: exit along the smallest penetration axis
      const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = b.minX - r;
      else if (m === pr) x = b.maxX + r;
      else if (m === pt) z = b.minZ - r;
      else z = b.maxZ + r;
    }
  }
  return [x, z];
}
