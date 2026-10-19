import type { Road } from "../slice";

// Water as a barrier (§6 road mechanics): you can't drive/walk across the open
// harbor or the Acushnet — but a road surface is never "open water". Any road
// (a bridge, a causeway, or a span OSM forgot to tag bridge=yes) carries you
// over; only water that's off the road network blocks you. Coordinates are
// slice-local [east, north]; a world point (wx, wz) has east=wx, north=-wz.

let waterRings: [number, number][][] = [];
let islandRings: [number, number][][] = []; // land cut out of the water (islands/wharves)
let roadSegs: number[] = []; // flattened ax,an,bx,bn,halfWidth, …

export function setWaterZones(
  water: [number, number][][],
  roads: Road[],
  islands: [number, number][][] = [],
  barriers: [number, number][][] = [],
) {
  waterRings = water ?? [];
  islandRings = islands ?? [];
  roadSegs = [];
  // The hurricane-barrier dike is a drivable/walkable corridor over the water.
  for (const path of barriers ?? []) {
    for (let i = 0; i < path.length - 1; i++) {
      roadSegs.push(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], 7);
    }
  }
  // Every road becomes a "safe corridor": if you're on one you never sink, even
  // where it crosses water. Road-proximity is only ever evaluated while a point
  // is already inside a water polygon (see isBlockedWater), so scanning the full
  // set is cheap — it runs for the few frames you're actually over the water.
  for (const r of roads) {
    if (r.points.length < 2) continue;
    const hw = r.width / 2 + 5; // generous so you stay "on the road" lane + shoulder
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
      roadSegs.push(ax, an, bx, bn, hw);
    }
  }
}

function pointInRing(px: number, pn: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
    if ((ni > pn) !== (nj > pn) && px < ((xj - xi) * (pn - ni)) / (nj - ni) + xi) inside = !inside;
  }
  return inside;
}

function nearRoad(px: number, pn: number): boolean {
  for (let i = 0; i < roadSegs.length; i += 5) {
    const ax = roadSegs[i], an = roadSegs[i + 1], bx = roadSegs[i + 2], bn = roadSegs[i + 3], hw = roadSegs[i + 4];
    const dx = bx - ax, dn = bn - an;
    const len2 = dx * dx + dn * dn || 1;
    let t = ((px - ax) * dx + (pn - an) * dn) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + dx * t, cn = an + dn * t;
    if (Math.hypot(px - cx, pn - cn) < hw) return true;
  }
  return false;
}

/** True if this world point is open water you may not cross (not on a road). */
export function isBlockedWater(wx: number, wz: number): boolean {
  if (!waterRings.length) return false;
  const px = wx, pn = -wz; // world → slice [east, north]
  // On a derived island/wharf (land cut out of the water) → never blocked.
  for (const isl of islandRings) if (pointInRing(px, pn, isl)) return false;
  // Fast path: if you're not inside any water polygon you're fine (the common
  // case on land), and we skip the road scan entirely.
  let inWater = false;
  for (const ring of waterRings) if (pointInRing(px, pn, ring)) { inWater = true; break; }
  if (!inWater) return false;
  // Over water: blocked only if you're NOT on a road surface.
  return !nearRoad(px, pn);
}
