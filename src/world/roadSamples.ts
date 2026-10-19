import type { Road } from "../slice";

// Shared road-edge sampler used by the instanced near-core prop/decal layers
// (Decals, Graffiti, …). Walks each drivable street by arc-length and yields
// clean centerline points + the unit travel direction; callers add their own
// jitter / perpendicular offset / orientation. Keeps the placement math in one
// place so spacing, the highway whitelist, and the radius cull stay in sync.

export interface RoadSample { x: number; z: number; dx: number; dz: number }

const DEFAULT_HIGHWAYS = ["primary", "secondary", "tertiary", "residential", "unclassified"];

export function sampleRoadEdges(
  roads: Road[],
  center: [number, number],
  opts: { radius: number; step: number; startAt?: number; sparse?: number; max: number; highways?: string[] },
): RoadSample[] {
  const { radius, step, startAt = 8, sparse = 1, max } = opts;
  const hw = opts.highways ?? DEFAULT_HIGHWAYS;
  const out: RoadSample[] = [];
  let n = 0;
  for (const r of roads) {
    if (r.bridge || r.points.length < 2) continue;
    if (!hw.includes(r.highway)) continue;
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
      const x1 = ax, z1 = -an, x2 = bx, z2 = -bn; // world: z = -northing
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 1e-3) continue;
      const dx = (x2 - x1) / len, dz = (z2 - z1) / len;
      for (let d = startAt; d < len; d += step) {
        n++;
        if (sparse > 1 && n % sparse !== 0) continue; // thin the field out
        const t = d / len;
        const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
        if (Math.hypot(x - center[0], z - center[1]) > radius) continue;
        out.push({ x, z, dx, dz });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}
