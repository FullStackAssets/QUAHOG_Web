// Geometric camera obstruction against building footprints.
//
// WHY THIS EXISTS (camera-inside-building bug, video evidence 2026-11-02):
// FollowCamera's Rapier sweep (cameraObstruction.ts) only sees FIXED physics
// bodies, but building colliders exist only in bounded zones: New Bedford
// tiles within COLLIDE_R=1 (500 m tiles) of the player's tile, GIS buildings
// within 400 m of the GIS center, and fallback-district buildings within
// 230 m of the district center. Everywhere else buildings are visual-only —
// the player can walk straight through a wall (by design in Fall River v1:
// Cove ~692 m and Lizzie ~297 m from center are visual-only), and the chase
// camera, 8–16 m behind the player, follows the segment straight through the
// volume because the sweep sees no body at all.
//
// This module closes that hole geometrically: it indexes the SHIPPED
// footprints (slice buildings, GIS buildings, streamed tile buildings — never
// invented geometry) as world-space boxes [minX,maxX] x [0,height] x
// [minZ,maxZ] and clamps the camera segment against them. It covers both
// districts at once, including visual-only buildings, with no physics cost
// (no new colliders — mobile perf is why the collider radius exists).
//
// Coordinate frame: footprints are slice-local [east, north]; world is
// [east, -north], exactly like toWorld / buildingAvoid.

import type { Vector3 } from "three";
import type { Building } from "../slice";

interface CamBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number; // building height; volume spans y in [0, top]
}

const CELL = 128; // grid cell size (metres)
const MAX_CELLS_PER_AXIS = 8; // wider boxes go to the overflow list, not every cell

const sources = new Map<string, CamBox[]>();
let grid = new Map<string, CamBox[]>();
let overflow: CamBox[] = [];
let dirty = true;

function toBoxes(buildings: Building[]): CamBox[] {
  const out: CamBox[] = [];
  for (const b of buildings) {
    if (b.footprint.length < 3) continue;
    if (!Number.isFinite(b.height) || b.height <= 0) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [e, n] of b.footprint) {
      const z = -n; // world z = -north
      if (e < minX) minX = e;
      if (e > maxX) maxX = e;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX) || maxX - minX < 0.5 || maxZ - minZ < 0.5) continue;
    out.push({ minX, maxX, minZ, maxZ, top: b.height });
  }
  return out;
}

/**
 * Register (or re-register) a named set of building footprints. Idempotent
 * per source name; pass [] to unregister. Safe to call on remount.
 */
export function setCameraBuildings(source: string, buildings: Building[]): void {
  sources.set(source, toBoxes(buildings));
  dirty = true;
}

/** Drop every registered source (district switch / unmount safety net). */
export function clearCameraBuildings(): void {
  sources.clear();
  dirty = true;
}

function rebuild(): void {
  grid = new Map();
  overflow = [];
  for (const list of sources.values()) {
    for (const b of list) {
      const cx0 = Math.floor(b.minX / CELL), cx1 = Math.floor(b.maxX / CELL);
      const cz0 = Math.floor(b.minZ / CELL), cz1 = Math.floor(b.maxZ / CELL);
      if (cx1 - cx0 > MAX_CELLS_PER_AXIS || cz1 - cz0 > MAX_CELLS_PER_AXIS) {
        overflow.push(b);
        continue;
      }
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const key = `${cx},${cz}`;
          let arr = grid.get(key);
          if (!arr) { arr = []; grid.set(key, arr); }
          arr.push(b);
        }
      }
    }
  }
  dirty = false;
}

function candidates(minX: number, maxX: number, minZ: number, maxZ: number): Set<CamBox> {
  if (dirty) rebuild();
  const out = new Set<CamBox>(overflow);
  const cx0 = Math.floor(minX / CELL), cx1 = Math.floor(maxX / CELL);
  const cz0 = Math.floor(minZ / CELL), cz1 = Math.floor(maxZ / CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const arr = grid.get(`${cx},${cz}`);
      if (arr) for (const b of arr) out.add(b);
    }
  }
  return out;
}

// Segment-vs-AABB slab test on the box expanded by `r` on all sides.
// Returns [entryT, exitT] in segment-param units, or null on a miss.
function slab(
  px: number, py: number, pz: number,
  dx: number, dy: number, dz: number,
  b: CamBox, r: number,
): [number, number] | null {
  let tmin = 0, tmax = 1;
  const axes: [number, number, number, number][] = [
    [px, dx, b.minX - r, b.maxX + r],
    [py, dy, -r, b.top + r],
    [pz, dz, b.minZ - r, b.maxZ + r],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return [tmin, tmax];
}

const EPS_DIST = 0.06; // matches the physics sweep's pull-back margin

/**
 * Clamp `end` (mutated) so the pivot→end segment never sits inside a
 * registered building volume. Handles both failure shapes:
 * - pivot OUTSIDE, segment crosses a box: clamp to just before entry;
 * - pivot INSIDE a box (player walked through a wall): jump to just past
 *   the exit, so the camera waits outside the wall instead of inside it.
 * No-op when the segment is clear. Only ever shortens the segment.
 */
export function resolveCameraBuildingObstruction(pivot: Vector3, end: Vector3, radius: number): void {
  const dx = end.x - pivot.x, dy = end.y - pivot.y, dz = end.z - pivot.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.0001) return;
  const minX = Math.min(pivot.x, end.x) - radius, maxX = Math.max(pivot.x, end.x) + radius;
  const minZ = Math.min(pivot.z, end.z) - radius, maxZ = Math.max(pivot.z, end.z) + radius;
  const cands = candidates(minX, maxX, minZ, maxZ);
  if (!cands.size) return;

  // Step 1: escape containment at the pivot. If the player is inside a
  // building, points just past the pivot are inside too — advance past the
  // farthest exit among containing boxes (iterate for overlaps).
  let tStart = 0;
  for (let i = 0; i < 8; i++) {
    const x = pivot.x + dx * tStart, y = pivot.y + dy * tStart, z = pivot.z + dz * tStart;
    let farExit = -1;
    for (const b of cands) {
      if (x < b.minX - radius || x > b.maxX + radius || z < b.minZ - radius || z > b.maxZ + radius) continue;
      if (y < -radius || y > b.top + radius) continue;
      const hit = slab(pivot.x, pivot.y, pivot.z, dx, dy, dz, b, radius);
      if (hit && hit[1] > farExit) farExit = hit[1];
    }
    if (farExit < 0) break;
    tStart = farExit + EPS_DIST / len;
    if (tStart >= 1) { tStart = 1; break; }
  }

  // Step 2: earliest entry into any box after tStart.
  let tEnd = 1;
  for (const b of cands) {
    const hit = slab(pivot.x, pivot.y, pivot.z, dx, dy, dz, b, radius);
    if (!hit) continue;
    const entry = hit[0];
    if (entry > tStart + 1e-6 && entry < tEnd) tEnd = entry;
  }

  let tFinal = tEnd < 1 ? tEnd - EPS_DIST / len : 1;
  if (tFinal < tStart) tFinal = tStart;
  if (tFinal >= 1 && tStart <= 0) return; // clear segment, untouched
  if (tFinal < 0) tFinal = 0;
  end.set(pivot.x + dx * tFinal, pivot.y + dy * tFinal, pivot.z + dz * tFinal);
}

/**
 * Backstop: if `pos` is inside a registered building volume (camera closer
 * than `radius` to a wall, below the roof), push it horizontally out along
 * the smallest-penetration axis. Covers the both-inside case where no
 * along-segment point is outside (overlapping buildings).
 */
export function pushCameraOutOfBuildings(pos: Vector3, radius: number): void {
  for (let i = 0; i < 6; i++) {
    if (dirty) rebuild();
    const cands = candidates(pos.x - radius, pos.x + radius, pos.z - radius, pos.z + radius);
    let moved = false;
    for (const b of cands) {
      if (pos.y > b.top + radius) continue;
      const minX = b.minX - radius, maxX = b.maxX + radius;
      const minZ = b.minZ - radius, maxZ = b.maxZ + radius;
      if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;
      const pl = pos.x - minX, pr = maxX - pos.x, pt = pos.z - minZ, pb = maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = minX;
      else if (m === pr) pos.x = maxX;
      else if (m === pt) pos.z = minZ;
      else pos.z = maxZ;
      moved = true;
      break;
    }
    if (!moved) return;
  }
}
