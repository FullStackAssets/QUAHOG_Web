// Rt 18 freeway programme (2026-11-02 audit implementation) — shared helpers
// for the corridor rules. Nic's standing directives:
//   - 0 parked cars on Rt 18, EVER (median AND shoulders/sides).
//   - Rt 18 is a freeway: divided carriageways, highway lanes/barriers/lighting.
//   - Street furniture is drivable-through with tiny damage, not a barrier.
//   - No dressing/debris on the freeway corridor.
// All distance tests here are in WORLD coords (x = east, z = -north), the
// same frame every placement builder uses.

import type { Road } from "../slice";

/** OSM highway types that make a record part of the freeway itself. */
export const FREEWAY_TYPES = new Set(["motorway", "motorway_link"]);

/** Playable-core center in world coords (Experience CORE [-266,-100] slice). */
export const CORE_WORLD: [number, number] = [-266, 100];

/** Corridor half-width for the permanent rules (m): carriageway half-width
 *  5.76 + apron 2.6 + car half-length ~2.1 + margin. A radius this wide
 *  around EITHER carriageway centerline covers the whole median (the
 *  carriageway gap is only ~12-16 m centerline-to-centerline) as well as
 *  both shoulders — so one test enforces the 0-ever rule everywhere. */
export const CORRIDOR_RADIUS = 13;

/** Ribbon trim at freeway crossings (m): crossing-street ribbons stop this
 *  far short of the motorway centerline on each side, so through streets
 *  stop reading as at-grade forks turning off Rt 18. */
export const CROSSING_TRIM = 8;

export function isFreewayRecord(r: Road): boolean {
  return FREEWAY_TYPES.has(r.highway);
}

/** Lane-divider count for a highway ribbon texture from a road's lane
 *  count. Null/undefined (no data) keeps the legacy 2-divider texture so
 *  gaps stay visually unchanged, not wrong. Counts above 4 clamp to 3
 *  dividers — the widest sourced record in the shipped data is 4 lanes. */
export function freewayDividers(lanes: number | null | undefined): number {
  if (lanes == null) return 2;
  return Math.max(0, Math.min(3, lanes - 1));
}

/** Normalize a road name for corridor matching: lowercase, drop punctuation,
 *  collapse whitespace. */
export function normalizeRoadName(name: string | null): string {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** True for any road that IS the Rt 18 corridor in the player's reading:
 *  the Kennedy highway names, the Rt 18 ramps, and JFK Boulevard — the
 *  corridor's surface continuation, which holds most of the junction
 *  parking and shares the motorway's southern endpoint. Token-based so
 *  "Route 180" or similar can never false-positive on "route 18". */
export function isCorridorName(name: string | null): boolean {
  const tokens = normalizeRoadName(name).split(" ").filter(Boolean);
  if (tokens.includes("kennedy") || tokens.includes("jfk")) return true;
  for (let i = 0; i < tokens.length - 1; i++) {
    if ((tokens[i] === "rt" || tokens[i] === "route") && tokens[i + 1] === "18") return true;
  }
  return false;
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export interface FreewayCorridor {
  /** Segments of every motorway record, in world coords. */
  segments: [number, number, number, number][];
  /** Minimum distance (m) from a world point to any motorway centerline. */
  distanceToCenterline(x: number, z: number): number;
  /** True when a world point sits inside the corridor footprint. */
  contains(x: number, z: number, radius?: number): boolean;
}

/** Build the geometric corridor from the road list. Motorway LINK ramps are
 *  included: their footprints are freeway surface too, and a parked car or
 *  dressing item on a ramp is on Rt 18 just as surely as one on the mainline. */
export function buildFreewayCorridor(roads: Road[]): FreewayCorridor {
  const segments: [number, number, number, number][] = [];
  for (const r of roads) {
    if (!FREEWAY_TYPES.has(r.highway)) continue;
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
      segments.push([ax, -an, bx, -bn]);
    }
  }
  const distanceToCenterline = (x: number, z: number): number => {
    let best = Infinity;
    for (const [ax, az, bx, bz] of segments) {
      const d = distToSegment(x, z, ax, az, bx, bz);
      if (d < best) best = d;
    }
    return best;
  };
  return {
    segments,
    distanceToCenterline,
    contains: (x, z, radius = CORRIDOR_RADIUS) => distanceToCenterline(x, z) <= radius,
  };
}

/** Split a road's polyline at segments whose midpoint falls inside the
 *  corridor trim zone, returning the surviving sub-polylines. Used for
 *  crossing streets only (never for freeway records themselves): the
 *  through street keeps both of its sides, but its ribbon stops short of
 *  the motorway centerline instead of drawing a flat at-grade junction. */
export function trimRoadAtFreeway(r: Road, corridor: FreewayCorridor, trim = CROSSING_TRIM): Road[] {
  if (isFreewayRecord(r) || r.points.length < 2) return [r];
  const out: Road[] = [];
  let run: [number, number][] = [r.points[0]];
  for (let i = 0; i < r.points.length - 1; i++) {
    const a = r.points[i], b = r.points[i + 1];
    const mx = (a[0] + b[0]) / 2, mz = -((a[1] + b[1]) / 2);
    if (corridor.contains(mx, mz, trim)) {
      // End the current run at a (if it has length) and resume after b.
      if (run.length >= 2) out.push({ ...r, points: run });
      run = [b];
    } else {
      run.push(b);
    }
  }
  if (run.length >= 2) out.push({ ...r, points: run });
  return out;
}

// ---------------------------------------------------------------------------
// Fork cleanup, phase 1 (audit §8): delete dead-end stubs, protect everything
// that is real. A record is deleted iff ALL of:
//   (a) it is a stub: an endpoint with no connection within 5 m (T-touch
//       counts — an endpoint touching another record's segment is connected);
//   (b) length < 100 m;
//   (c) type in {service, footway, path, steps} OR unnamed;
//   (d) it serves no named destination (its name appears in no landmark);
//   (e) it is not a ramp/link type, not a bridge, and not a freeway record.
// Plus the corridor micro-fragment rule: a stub shorter than 12 m with an
// endpoint within 12 m of a motorway centerline is a way-split artifact
// (the 8 m Logan fragment), deleted regardless of type/name — ramps, links
// and bridges are still never deleted.
// Named residential cul-de-sacs fail (c) and are always kept. Ashley
// Boulevard (160 m) and Acushnet Avenue (194 m) fail (b) and are kept.
// ---------------------------------------------------------------------------

const STUB_TYPES = new Set(["service", "footway", "path", "steps"]);
const SNAP = 5;

function roadLength(r: Road): number {
  let len = 0;
  for (let i = 0; i < r.points.length - 1; i++) {
    len += Math.hypot(r.points[i + 1][0] - r.points[i][0], r.points[i + 1][1] - r.points[i][1]);
  }
  return len;
}

export function removeDeadEndForks(roads: Road[], landmarkNames: string[]): Road[] {
  const dest = new Set(landmarkNames.map((n) => normalizeRoadName(n)).filter(Boolean));
  // Spatial hash of segments (world coords, 10 m cells) for the snap test.
  const cell = 10;
  const grid = new Map<string, [number, number, number, number][]>();
  const cellKey = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (const r of roads) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
      const seg: [number, number, number, number] = [ax, -an, bx, -bn];
      const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
      const minZ = Math.min(-an, -bn), maxZ = Math.max(-an, -bn);
      for (let gx = Math.floor(minX / cell); gx <= Math.floor(maxX / cell); gx++) {
        for (let gz = Math.floor(minZ / cell); gz <= Math.floor(maxZ / cell); gz++) {
          const k = `${gx},${gz}`;
          const arr = grid.get(k);
          if (arr) arr.push(seg); else grid.set(k, [seg]);
        }
      }
    }
  }
  const corridor = buildFreewayCorridor(roads);
  const touchesOther = (x: number, z: number, self: Road): boolean => {
    // Closed loop: first point == last point counts as connected.
    if (self.points.length > 2) {
      const f = self.points[0], l = self.points[self.points.length - 1];
      if (Math.hypot(f[0] - x, f[1] + z) < 1e-6 && Math.hypot(l[0] - x, l[1] + z) < 1e-6) return true;
    }
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const [ax, az, bx, bz] of grid.get(`${gx},${gz}`) ?? []) {
          if (distToSegment(x, z, ax, az, bx, bz) <= SNAP) {
            // A segment of the record itself does not count as a connection
            // (its own endpoints are trivially on its own segments).
            let own = false;
            for (let i = 0; i < self.points.length - 1; i++) {
              const [sx, sn] = self.points[i], [ex, en] = self.points[i + 1];
              if (Math.abs(sx - ax) < 1e-6 && Math.abs(-sn - az) < 1e-6 && Math.abs(ex - bx) < 1e-6 && Math.abs(-en - bz) < 1e-6) { own = true; break; }
            }
            if (!own) return true;
          }
        }
      }
    }
    return false;
  };

  const out: Road[] = [];
  for (const r of roads) {
    if (r.points.length < 2) { out.push(r); continue; }
    // Never delete: freeway records, ramps/links, bridges.
    if (isFreewayRecord(r) || r.bridge) { out.push(r); continue; }
    const f = r.points[0], l = r.points[r.points.length - 1];
    const fw = [f[0], -f[1]], lw = [l[0], -l[1]];
    const stub = !touchesOther(fw[0], fw[1], r) || !touchesOther(lw[0], lw[1], r);
    if (!stub) { out.push(r); continue; }
    const len = roadLength(r);
    const unnamed = !r.name;
    const servesDestination = !!r.name && dest.has(normalizeRoadName(r.name));
    const corridorFragment =
      len < 12 &&
      (corridor.distanceToCenterline(fw[0], fw[1]) <= 12 || corridor.distanceToCenterline(lw[0], lw[1]) <= 12);
    if (corridorFragment) continue; // way-split artifact at the interchange
    if (len < 100 && (STUB_TYPES.has(r.highway) || unnamed) && !servesDestination) continue;
    out.push(r);
  }
  return out;
}
