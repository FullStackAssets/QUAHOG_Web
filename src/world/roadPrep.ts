// Load-time road preparation — full-game plan (2026-11-02 audit), applied
// in Experience.tsx between the load filter and setSlice. All three
// functions are pure (roads in, roads out) so the rules hold regardless of
// future map-data changes. No data files are edited: every fix here is a
// code-level rule over the shipped slice.

import type { Road } from "../slice";
import type { DistrictId } from "../districts";
import { removeDeadEndForks } from "./freeway";

/** OSM highway types that are not real streets and only added stray
 * pavement to the city (driveways, parking-lot aisles, alleys, indoor
 * corridors, etc.). Single source of truth — Experience.tsx imports this
 * set; do not fork a second copy. */
export const SKIP_HIGHWAY = new Set([
  "service", "construction", "corridor", "track", "proposed", "raceway",
  "bus_guideway", "busway", "escape",
]);

/** Dartmouth Mall interior circulation. These 7 records are the ONLY
 * service-class roads exempt from the load filter — the mall's interior
 * drives are the one place where filtering service roads deletes a real
 * site instead of stray pavement. A blanket named-service exemption was
 * REJECTED: the slice holds 121 named service records, including
 * drive-throughs ("Dunkin' Donuts Drive-Through") and lot aisles
 * ("Plaza Way") — re-admitting them would restore exactly the stray
 * pavement the filter exists to remove. The exemption is therefore by
 * exact site name, and the exempt records skip fork cleanup too (they are
 * a site's circulation, not forks to prune). */
export const MALL_SERVICE_NAME = "North Dartmouth Mall";
export function isMallServiceRoad(r: Road): boolean {
  return r.highway === "service" && r.name === MALL_SERVICE_NAME;
}

/** Data-safe highway name corrections (MassDOT tie-breakers from the
 * map-upgrade package: Huttleston 9 segs vs Huttleson 0, MacArthur 8 segs).
 * Route 6's primary/trunk split is REAL (same road, two classes in OSM)
 * and is deliberately NOT normalized — "fixing" it would invent data. */
const NAME_FIXES: Record<string, string> = {
  "Huttleson Avenue": "Huttleston Avenue",
  "Macarthur Drive": "MacArthur Drive",
};
export function normalizeRoadNames(roads: Road[]): Road[] {
  return roads.map((r) =>
    r.name && NAME_FIXES[r.name] ? { ...r, name: NAME_FIXES[r.name] } : r,
  );
}

function pointInRing(px: number, pn: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
    if ((ni > pn) !== (nj > pn) && px < ((xj - xi) * (pn - ni)) / (nj - ni) + xi) inside = !inside;
  }
  return inside;
}

/** Causeway flags (audit item 8): a trunk record whose ENTIRE polyline
 * sits over water is a causeway/bridge approach OSM forgot to tag
 * bridge=yes — Popes Island (406 m, 15/15 segments wet) and Fish Island
 * (64 m, 5/5 wet) are the whole set in the shipped data. Flagging them
 * whole-record is exact for both (no land segments to over-elevate).
 * Pedestrian/footway in-water segments are piers/promenades and are
 * deliberately NOT flagged; partial land+water trunk records are left
 * for the map-upgrade worker to split. Flagging runs BEFORE fork
 * cleanup so the causeways also gain the bridge protection there. */
export function flagCausewayBridges(roads: Road[], water: [number, number][][]): Road[] {
  if (!water.length) return roads;
  return roads.map((r) => {
    if (r.highway !== "trunk" || r.bridge || r.points.length < 2) return r;
    for (let i = 0; i < r.points.length - 1; i++) {
      const mx = (r.points[i][0] + r.points[i + 1][0]) / 2;
      const my = (r.points[i][1] + r.points[i + 1][1]) / 2;
      if (!water.some((ring) => pointInRing(mx, my, ring))) return r;
    }
    return { ...r, bridge: true };
  });
}

/**
 * The load-time road pipeline, extracted from Experience.tsx so it is
 * unit-testable (Fall River integration, 2026-11-03). Order matters and is
 * preserved exactly: exempt capture -> SKIP filter -> causeway flags ->
 * fork cleanup -> name normalization -> exempt re-insertion. For
 * newBedford the output is bit-identical to the old inline code.
 *
 * Fall River SKIP-filter decision (required by the integration spec):
 * district-scoped exemption for the SIX named service access streets
 * (Front, Granite, Purchase, Borden, 17th, Battleship Cove Drive). FR's
 * named service streets are real streets — filtering them would delete
 * the Cove access road and the downtown grid's named streets. The
 * exemption is by exact name, not a blanket named-service rule: a
 * blanket rule would re-admit any future named drive-through or lot
 * aisle in FR data, and would even re-admit a mall-named record (the
 * test guards this). This is NOT the blanket exemption roadPrep
 * rejected for NB: it applies to fallRiver only, so NB's 121 named
 * service records (drive-throughs, lot aisles) stay filtered. The
 * alternative (reclassifying the six in the package data) was rejected
 * to keep the shipped data untouched. Exempt records skip fork cleanup
 * too, mirroring the mall exemption.
 */
export const FR_SERVICE_EXEMPT = new Set([
  "Front Street",
  "Granite Street",
  "Purchase Street",
  "Borden Street",
  "17th Street",
  "Battleship Cove Drive",
]);
export function prepareRoads(
  roads: Road[],
  water: [number, number][][],
  landmarkNames: string[],
  districtId: DistrictId,
): Road[] {
  const mallRoads = districtId === "newBedford" ? roads.filter(isMallServiceRoad) : [];
  const frServiceRoads =
    districtId === "fallRiver"
      ? roads.filter((r) => r.highway === "service" && !!r.name && FR_SERVICE_EXEMPT.has(r.name))
      : [];
  let out = roads.filter((r) => !SKIP_HIGHWAY.has(r.highway));
  out = flagCausewayBridges(out, water);
  out = removeDeadEndForks(out, landmarkNames);
  out = normalizeRoadNames(out);
  return [...out, ...mallRoads, ...frServiceRoads];
}
