// New Bedford Tier-1 approved-model mount manifest (batches 4–8, bulk job
// 2026-11-03 under Nic's bulk build order ~06:11 EST). Companion to
// tier1Models.ts (Fall River); kept separate because NB buildings do NOT
// come from the slice array (the NB slice buildings array is empty) — they
// render via GisDistrict (public/gis-district-newbedford.json, 62 records)
// plus streamed tiles, so each entry below names its footprint source and
// the exclusion that keeps it from double-rendering.
//
// Placement convention (same as Fall River): pipeline local axes X = east
// - cx, Y = north - cy, Z = up, so the exported glTF (Y-up) lands at
// x = east, z = -north in game space. Group position is (cx, 0, -cy) with
// identity rotation. NOTE the centroid convention differs from Fall River:
// the NB pipeline GLBs were built around the UNIQUE-vertex mean of their
// footprint (closing duplicate stripped), NOT the dup-inclusive mean —
// verified span-exact (≤0.01 m) for the 8 GIS-matched entries. The two
// tile-built entries (Custom House, Visitor Center) are placed at their
// TILE footprint's centroid (tile footprints are unclosed, so unique and
// dup means coincide there) and are span-exact against the tile.
// Visual-only: no physics bodies for these models anywhere.
// Front-face orientation is a modeling assumption from photo composition
// (same caveat as the Fall River batch) — no orientation changes without
// evidence.
//
// Exclusions, per entry:
// - gisId: the GIS record filtered out of GisDistrict rendering (HANDLED
//   set in GisDistrict.tsx, matched by record id — names can be null or
//   duplicated, so the id is the key).
// - tileKey/tileIdx: the streamed-tile building dropped via the GIS
//   district file's `replaces` map (withoutReplaced in gisDistrict.ts).
//   Four entries need no tile exclusion because their tile building was
//   already dropped by the shipped replaces map (guard distance ~0.00):
//   cherry, carters, double_bank, cork. The other six tile duplicates had
//   STALE replaces centroids (guard distances 2.46–14.58 m, so the tiles
//   still rendered alongside the GIS extrusions); the bulk job corrected
//   those centroids to the current tile dup-mean centroids, and added the
//   bus_terminal entry (tile -2_-1 idx 10, previously absent). YMCA and
//   Whaling Museum tile polygons are shifted ~9 m / ~13 m vs their GIS
//   polygons (different source vintage, same named building) — dropping
//   them follows the replaces map's recorded intent; verify on staging
//   that no annex mass vanishes with them.
// DETAIL PASS (2026-11-03 mount): rodman, double_bank, cork, and
// whaling_museum point at their photo-matched _detail files (positions,
// heights, gisIds, tile exclusions unchanged; original GLBs stay on disk).
// Heights stay 8.0 ESTIMATED — photo-matching the model does not verify
// the height. Rodman's stale facade-informative/unconfirmed flag is
// replaced: the detail model is photo-matched from rodman-confirmed.jpg.
// Double Bank keeps its likely-taller caveat; Whaling keeps its TOO LOW
// caveat (both flags stay open). Detail-pass GLBs carry protruding
// front-face detail (steps, columns — measured, ≤3.5 m past the footprint
// per the detail-pass verifier contract); their MASS spans are
// footprint-exact, which is what the mount tests pin for detail entries.
// No photo is baked or redistributed; signage text is never reproduced
// (blank bands/plaques only).
//
// - Bethel (model 24) is NOT here: HELD. A hand-detailed hero chapel
//   already renders (SeamensBethel.tsx, Experience.tsx:241, MODELED set,
//   GIS record already filtered via HANDLED). Mounting pipeline bethel.glb
//   would double-render the same building; the hero mesh is not replaced
//   by the massing (that would be a downgrade).

export interface NbTier1Model {
  id: string;
  name: string;
  file: string;
  /** World [x, y, z]: (footprint centroid east, 0, -footprint centroid north). */
  position: [number, number, number];
  height: number;
  /** Footprint centroid [east, north] the position was derived from. */
  centroid: [number, number];
  /** "gis" (GIS record) or "tile" (streamed tile building) — which footprint
   *  the GLB spans were verified against. */
  centroidSource: "gis" | "tile";
  /** GIS record id filtered from GisDistrict rendering (null when the GLB
   *  has no GIS record — bus_terminal is tile-only). */
  gisId: string | null;
  /** Streamed-tile exclusion via the replaces map (null when the tile was
   *  already dropped by the shipped map or no tile duplicate exists). */
  tileKey: string | null;
  tileIdx: number | null;
  /** Carried flag, if any. */
  flag?: string;
}

export const NB_TIER1_MODELS: NbTier1Model[] = [
  { id: "rodman", name: "Rodman Candleworks", file: "/tier1/rodman_detail.glb", position: [-188.051, 0, -1.355], height: 8.0, centroid: [-188.051, 1.355], centroidSource: "gis", gisId: "massgis:201:248097_820802", tileKey: "-1_0", tileIdx: 8, flag: "height 8.0 ESTIMATED — PHOTO-MATCHED detail-pass model (rodman-confirmed.jpg: pink south front, green door + BLANK arched band, 3 attic fanlights, stone quoins); replaces the stale facade-informative/unconfirmed flag — the detail model IS photo-matched; the 4 Mapillary frames in refs/72-n-water-st were context only (distant neighbouring mill, not Rodman)" },
  { id: "star_store", name: "Star Store", file: "/tier1/star_store.glb", position: [-486.383, 0, 249.053], height: 18.0, centroid: [-486.383, -249.053], centroidSource: "gis", gisId: "massgis:201:247810_820563", tileKey: "-1_-1", tileIdx: 79, flag: "batch-5 rebuild at GIS 18.0 m (OSM levels estimate) — NOT the batch-4 21.0 m tile version; tile height 21.0 m discarded" },
  { id: "cherry", name: "Cherry Building", file: "/tier1/cherry.glb", position: [-426.065, 0, 86.878], height: 8.0, centroid: [-426.065, -86.878], centroidSource: "gis", gisId: "massgis:201:247859_820715", tileKey: null, tileIdx: null, flag: "height 8.0 ESTIMATED — historic photo shows 3 stories, true height likely taller; NB lidar may correct" },
  { id: "carters", name: "Carter's Clothing", file: "/tier1/carters.glb", position: [-375.562, 0, 39.444], height: 8.0, centroid: [-375.562, -39.444], centroidSource: "gis", gisId: "massgis:201:247909_820762", tileKey: null, tileIdx: null, flag: "height 8.0 ESTIMATED — photo shows 3 stories, true height likely taller; NB lidar may correct" },
  { id: "custom_house", name: "U.S. Custom House", file: "/tier1/custom_house.glb", position: [-328.261, 0, 68.18], height: 8.0, centroid: [-328.261, -68.18], centroidSource: "tile", gisId: "massgis:201:247952_820735", tileKey: "-1_-1", tileIdx: 50, flag: "height 8.0 ESTIMATED — photo shows 2 tall stories, true height likely taller; GLB spans match the TILE footprint (21.25x18.00 m), not the GIS polygon (20.94x17.57 m) — placed at the tile centroid" },
  { id: "visitor_center", name: "New Bedford Whaling National Historical Park Visitor Center", file: "/tier1/visitor_center.glb", position: [-295.347, 0, 22.5], height: 9.0, centroid: [-295.347, -22.5], centroidSource: "tile", gisId: "massgis:201:248010_820776", tileKey: "-1_-1", tileIdx: 45, flag: "height 9.0 GIS (OSM levels estimate); GLB spans match the TILE footprint (55.37x30.46 m), not the GIS polygon (52.85x30.48 m) — placed at the tile centroid; tile height 10.5 m discarded" },
  { id: "ymca", name: "New Bedford YMCA", file: "/tier1/ymca.glb", position: [-252.251, 0, 230.056], height: 8.0, centroid: [-252.251, -230.056], centroidSource: "gis", gisId: "massgis:201:248035_820578", tileKey: "-1_-1", tileIdx: 37, flag: "height 8.0 ESTIMATED — postcard shows 4-5 stories + tower, true height likely much taller; NB lidar may correct; tile polygon shifted ~9 m vs GIS (see header)" },
  { id: "whaling_museum", name: "New Bedford Whaling Museum", file: "/tier1/whaling_museum_detail.glb", position: [-212.74, 0, 92.987], height: 8.0, centroid: [-212.74, -92.987], centroidSource: "gis", gisId: "massgis:201:248068_820708", tileKey: "-1_-1", tileIdx: 31, flag: "height 8.0 ESTIMATED and TOO LOW by the photo's own evidence (historic block ridge 12 m, modern wing 18 m per the parked pilot) — PHOTO-MATCHED detail-pass model (entrance wing photo: west long edge = entrance-wing front, stone frame + tall glass + canopy + round-window accent); rest of the complex kept as simple massing, NO unseen facades invented; interim massing; split-height Tier-2 or NB lidar correction needed; tile polygon shifted ~13 m vs GIS (see header)" },
  { id: "double_bank", name: "Double Bank Building", file: "/tier1/double_bank_detail.glb", position: [-178.351, 0, 29.691], height: 8.0, centroid: [-178.351, -29.691], centroidSource: "gis", gisId: "massgis:201:248106_820774", tileKey: null, tileIdx: null, flag: "height 8.0 ESTIMATED — PHOTO-MATCHED detail-pass model (temple front views: 8 white Ionic columns, steps, entablature, pediment triangle; pediment lettering as BLANK plaque only); photo shows 2 tall stories + pediment, true height likely taller" },
  { id: "cork", name: "Cork Wine and Tapas", file: "/tier1/cork_detail.glb", position: [-123.248, 0, 123.723], height: 8.0, centroid: [-123.248, -123.723], centroidSource: "gis", gisId: "massgis:201:248162_820683", tileKey: null, tileIdx: null, flag: "height 8.0 ESTIMATED — PHOTO-MATCHED detail-pass model (Cork exterior: north stone front, red ground storefront band + door, white-trim windows above); plausible for the 2-story storefront in the photo" },
  { id: "bus_terminal", name: "New Bedford Bus Terminal, 134 Elm Street", file: "/tier1/bus_terminal.glb", position: [-534.993, 0, 3.08], height: 8.0, centroid: [-534.993, -3.08], centroidSource: "tile", gisId: null, tileKey: "-2_-1", tileIdx: 10, flag: "height 8.0 ESTIMATED — photo shows 2 stories + bay level, 8.0 m plausible; footprint is the long narrow tile rect at slice (-535.0, -3.1); bus openings on TWO facades are the Tier-2 upgrade (Tier-1 cannot model openings)" },
];

/** GIS record ids this manifest replaces (for the GisDistrict HANDLED filter). */
export const NB_TIER1_GIS_IDS: string[] = NB_TIER1_MODELS.filter(
  (m) => m.gisId !== null,
).map((m) => m.gisId as string);
