import type { Road } from "../slice";

// Visual road-marking cleanup only. Does not modify the navigable road graph,
// collision geometry, OSM source data, or sidewalk placement.
const DRIVEABLE = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary",
  "residential", "unclassified", "living_street",
]);

export type RoadPoint = [number, number];

const key = ([e, n]: RoadPoint) => `${Math.round(e / 4)}:${Math.round(n / 4)}`;
const length = (a: RoadPoint, b: RoadPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// An OSM way may end at an intersection. Count rounded road endpoints
// to distinguish genuine 3+ arm junctions from two-way segment splits.
export function junctionEndpoints(roads: Road[]): Set<string> {
  const degree = new Map<string, number>();
  for (const r of roads) {
    if (r.bridge || !DRIVEABLE.has(r.highway) || r.points.length < 2) continue;
    const ends = [r.points[0], r.points[r.points.length - 1]];
    for (const p of ends) degree.set(key(p), (degree.get(key(p)) ?? 0) + 1);
  }
  return new Set([...degree].filter(([, n]) => n >= 3).map(([k]) => k));
}

function interpolate(a: RoadPoint, b: RoadPoint, t: number): RoadPoint {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clipPolyline(points: RoadPoint[], start: number, end: number): RoadPoint[] {
  const segments = points.slice(1).map((p, i) => length(points[i], p));
  const total = segments.reduce((s, v) => s + v, 0);
  if (total <= start + end + 0.5) return [];
  const from = start, to = total - end;
  let cumulative = 0;
  const clipped: RoadPoint[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg < 0.0001) continue;
    const lo = Math.max(from, cumulative);
    const hi = Math.min(to, cumulative + seg);
    if (lo < hi) {
      const a = interpolate(points[i], points[i + 1], (lo - cumulative) / seg);
      const b = interpolate(points[i], points[i + 1], (hi - cumulative) / seg);
      if (!clipped.length || length(clipped[clipped.length - 1], a) > 0.01) clipped.push(a);
      clipped.push(b);
    }
    cumulative += seg;
  }
  return clipped;
}

// Stop painted center lines BEFORE the crosswalk/intersection polygon. On a
// very short link, omit the center line instead of drawing through the crosswalk.
export function trimmedCenterlines(roads: Road[], junctions: Set<string>): Road[] {
  const out: Road[] = [];
  for (const r of roads) {
    if (r.points.length < 2 || r.width < 8) continue;
    const distance = Math.max(8, r.width / 2 + 4);
    const start = junctions.has(key(r.points[0])) ? distance : 0;
    const end = junctions.has(key(r.points[r.points.length - 1])) ? distance : 0;
    const points = clipPolyline(r.points, start, end);
    if (points.length >= 2) out.push({ ...r, points });
  }
  return out;
}
