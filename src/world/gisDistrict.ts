// Build 002: GIS district integration helpers.
// Loads the New Bedford waterfront GIS district (real MassGIS roofprints,
// converted to slice-local metres) and filters the OSM blockouts it replaces
// out of the streamed tiles, so no building renders twice.
import type { Building } from "../slice";

export interface GisReplacement {
  index: number;
  cx: number;
  cy: number;
}

interface GisDistrictFile {
  name: string;
  center: [number, number];
  replaces: Record<string, GisReplacement[]>;
  buildings: {
    id: string;
    footprints: [number, number][][];
    height: number;
    heightSource: string;
    /**
     * Map-data upgrade (2026-11-03): real-world name from the OSM match
     * (verified by centroid containment — see the Standard Times rejection
     * in mapdata.test.ts) and the matched OSM object ("way:<id>",
     * "relation:<id>", or "node:<id>"). Optional: 14 of 62 rows carry one.
     * NOTE: this is NOT the identity used by the render pipeline.
     * ensureGisBuildings() still maps Building.name to the GIS id, because
     * the Bethel/Mariners guards (GisDistrict filter, Buildings hidden
     * flag, DistrictDetails skip) key on the id string. Do not "fix" that
     * mapping to the real name without updating all three guards — the
     * Bethel hull would render twice.
     */
    name?: string;
    osmId?: string;
  }[];
}

let replacesCache: Record<string, GisReplacement[]> | null = null;
let districtCache: GisDistrictFile | null = null;
let inflight: Promise<void> | null = null;

function loadOnce(): Promise<void> {
  if (!inflight) {
    inflight = fetch("gis-district-newbedford.json")
      .then((r) => {
        if (!r.ok) throw new Error(`GIS district HTTP ${r.status}`);
        return r.json();
      })
      .then((d: GisDistrictFile) => {
        districtCache = d;
        replacesCache = d.replaces ?? {};
      })
      .catch(() => {
        // District is an enhancement layer: if it fails to load, the game
        // runs on the original OSM blockouts with no duplicates to filter.
        replacesCache = {};
        districtCache = null;
      });
  }
  return inflight;
}

/** Resolve before any tile fetch so filtering is deterministic. */
export function ensureGisReplacements(): Promise<Record<string, GisReplacement[]>> {
  return loadOnce().then(() => replacesCache ?? {});
}

/**
 * Drop OSM blockouts superseded by the GIS district. A replacement entry is
 * honoured only when the tile building's centroid still matches the recorded
 * one (guards against stale indices if tile data ever changes).
 */
export function withoutReplaced(key: string, buildings: Building[]): Building[] {
  const reps = (replacesCache ?? {})[key];
  if (!reps || reps.length === 0) return buildings;
  const drop = new Set<number>();
  for (const r of reps) {
    const b = buildings[r.index];
    if (!b || b.footprint.length < 3) continue;
    let cx = 0, cy = 0;
    for (const [x, y] of b.footprint) { cx += x; cy += y; }
    cx /= b.footprint.length; cy /= b.footprint.length;
    if (Math.hypot(cx - r.cx, cy - r.cy) < 1.0) drop.add(r.index);
  }
  if (drop.size === 0) return buildings;
  return buildings.filter((_, i) => !drop.has(i));
}

/** Flattened Building[] for the <Buildings> renderer (one entry per polygon). */
export function ensureGisBuildings(): Promise<{ buildings: Building[]; center: [number, number] }> {
  return loadOnce().then(() => {
    const d = districtCache;
    if (!d) return { buildings: [], center: [0, 0] as [number, number] };
    const out: Building[] = [];
    for (const b of d.buildings) {
      for (const fp of b.footprints) {
        if (fp.length >= 3) out.push({ footprint: fp, height: b.height, name: b.id });
      }
    }
    return { buildings: out, center: d.center };
  });
}
