// Tier-1 approved-model mount manifest (batches 2 + 3, approved by Nic
// 2026-11-03 ~04:56 EST; batches 4–8 added 2026-11-03 under Nic's bulk
// build order ~06:11 EST). GENERATED from the offline slice match — do not
// hand-edit positions: the test in tier1Models.test.ts re-derives every
// slice entry from public/slice-fallriver.json and fails if it drifts.
// The ONE exception is Lizzie (sliceIdx -1): the slice carries no Lizzie
// footprint, so its position is derived from OSM way 213035398 (see below)
// and the test pins it separately instead of re-deriving it from the slice.
//
// Placement: pipeline local axes are X = east - cx, Y = north - cy,
// Z = up, so the exported glTF (Y-up) lands at x = east, z = -north
// in game space. Group position is (cx, 0, -cy) with identity rotation.
// Slice entries use (cx, cy) = slice footprint centroid = vertex mean
// INCLUDING the closing duplicate point (the pipeline convention, verified
// against the Gift Shop footprints.json entry). Lizzie uses the
// UNIQUE-vertex mean of the OSM quad instead: for that parallelogram the
// unique mean is the bbox centre, and it is the centre the pipeline GLB
// was built around (span-exact to 0.01 m; the dup-inclusive mean sits
// 1.67 m west of it and would misplace the walls by that much).
// GLB bounds were checked against the slice footprint spans (x and z exact,
// y = -0.30 plinth to height + 0.30 roof slab) for all slice entries
// before this manifest was written.
// All models are Meshopt-compressed: load ONLY via the PackGLB manual
// GLTFLoader + MeshoptDecoder path (drei useGLTF has no Meshopt decoder).
// Visual-only: no physics bodies are created for these models anywhere.
//
// Tier-2 swap (bulk job 2026-11-03): the 10 batches 2 + 3 entries now point
// at their Tier-2 files (public/tier1/<id>_tier2.glb). Tier-2 spans sit
// within +0.05 m of the Tier-1 spans (flush applique); heights and
// positions are unchanged, and the original Tier-1 files stay on disk.
import type { Building } from "../slice";

export interface Tier1Model {
  id: string;
  name: string;
  file: string;
  /** World [x, y, z]: (slice centroid east, 0, -slice centroid north). */
  position: [number, number, number];
  height: number;
  /** Index into public/slice-fallriver.json buildings (for tests); -1 when
   *  the entry has no slice footprint (Lizzie: OSM-sourced, see `source`). */
  sliceIdx: number;
  /** Footprint centroid [east, north] the position was derived from
   *  (dup-inclusive mean for slice entries, unique-vertex mean for Lizzie). */
  centroidSlice: [number, number];
  /** Unique footprint point count (closing duplicate stripped). */
  pointCount: number;
  /** Carried flag, if any (height disputes, overpass caveat). */
  flag?: string;
  /** Non-slice provenance, when sliceIdx is -1 (e.g. "osm:way:213035398"). */
  source?: string;
}

export const TIER1_MODELS: Tier1Model[] = [
  { id: "city_hall", name: "Fall River City Hall", file: "/tier1/city_hall_tier2.glb", position: [-19474.989, 0, -7216.406], height: 32.26, sliceIdx: 1505, centroidSlice: [-19474.989, 7216.406], pointCount: 6, flag: "I-195 overpass void NOT modeled (solid massing, interim) — overpass-void treatment is separate Phase-2 work" },
  { id: "portugalia", name: "Portugalia Marketplace", file: "/tier1/portugalia_tier2.glb", position: [-18851.650, 0, -7100.608], height: 8.13, sliceIdx: 2770, centroidSlice: [-18851.650, 7100.608], pointCount: 10 },
  { id: "plumbers_supply", name: "Plumbers' Supply Company", file: "/tier1/plumbers_supply_tier2.glb", position: [-19241.528, 0, -6375.996], height: 9.64, sliceIdx: 3306, centroidSlice: [-19241.528, 6375.996], pointCount: 4 },
  { id: "tecumseh_mill", name: "Tecumseh Mill No.1", file: "/tier1/tecumseh_mill_tier2.glb", position: [-19308.917, 0, -6801.877], height: 24.36, sliceIdx: 3442, centroidSlice: [-19308.917, 6801.877], pointCount: 27 },
  { id: "bank_armory", name: "Bank Street Armory", file: "/tier1/bank_armory_tier2.glb", position: [-19610.196, 0, -7503.994], height: 21.9, sliceIdx: 20, centroidSlice: [-19610.196, 7503.994], pointCount: 13 },
  { id: "academy", name: "Academy Building", file: "/tier1/academy_tier2.glb", position: [-19556.311, 0, -7183.083], height: 24.15, sliceIdx: 65, centroidSlice: [-19556.311, 7183.083], pointCount: 23, flag: "lidar 24.15 m vs ~12 m documented, unsmoothed" },
  { id: "justice_center", name: "Fall River Justice Center", file: "/tier1/justice_center_tier2.glb", position: [-19640.742, 0, -7075.893], height: 30.91, sliceIdx: 67, centroidSlice: [-19640.742, 7075.893], pointCount: 32, flag: "lidar 30.91 m vs ~15 m documented, unsmoothed" },
  { id: "cove", name: "The Cove Restaurant & Marina", file: "/tier1/cove_tier2.glb", position: [-19847.929, 0, -8165.201], height: 7.49, sliceIdx: 376, centroidSlice: [-19847.929, 8165.201], pointCount: 34 },
  { id: "riverview", name: "Riverview Towers", file: "/tier1/riverview_tier2.glb", position: [-20016.612, 0, -7095.321], height: 47.15, sliceIdx: 518, centroidSlice: [-20016.612, 7095.321], pointCount: 28 },
  { id: "ships_cove", name: "Ship's Cove", file: "/tier1/ships_cove_tier2.glb", position: [-20074.450, 0, -7173.732], height: 49.83, sliceIdx: 613, centroidSlice: [-20074.450, 7173.732], pointCount: 4 },
  // Batches 4–8 (bulk job 2026-11-03). Same derivation as above.
  { id: "carousel", name: "Fall River Carousel", file: "/tier1/carousel.glb", position: [-20075.818, 0, -7671.896], height: 13.96, sliceIdx: 643, centroidSlice: [-20075.818, 7671.896], pointCount: 25 },
  { id: "narrows", name: "Narrows Center for the Arts", file: "/tier1/narrows.glb", position: [-20164.149, 0, -7469.976], height: 15.25, sliceIdx: 760, centroidSlice: [-20164.149, 7469.976], pointCount: 16 },
  { id: "sweet_rose", name: "Sweet Rose Cafe", file: "/tier1/sweet_rose.glb", position: [-18905.988, 0, -8228.833], height: 9.53, sliceIdx: 2868, centroidSlice: [-18905.988, 8228.833], pointCount: 9 },
  { id: "remington_borden", name: "Remington-Borden House", file: "/tier1/remington_borden.glb", position: [-19180.364, 0, -8071.807], height: 10.7, sliceIdx: 3320, centroidSlice: [-19180.364, 8071.807], pointCount: 6 },
  { id: "robeson", name: "Andrew Robeson House", file: "/tier1/robeson.glb", position: [-19197.182, 0, -7974.301], height: 14.23, sliceIdx: 3348, centroidSlice: [-19197.182, 7974.301], pointCount: 8, flag: "NAME-MATCH CAVEAT: photo is the FRHS building at 451 Rock St; same-building assertion vs this slice footprint UNVERIFIED (batch-7 caveat carried)" },
  { id: "antioch", name: "Antioch School", file: "/tier1/antioch.glb", position: [-19198.175, 0, -8242.209], height: 12.79, sliceIdx: 3364, centroidSlice: [-19198.175, 8242.209], pointCount: 14 },
  { id: "childrens_museum", name: "Children’s Museum of Greater Fall River", file: "/tier1/childrens_museum.glb", position: [-19423.274, 0, -8014.744], height: 18.88, sliceIdx: 3731, centroidSlice: [-19423.274, 8014.744], pointCount: 30, flag: "lidar 18.88 m vs ~6 m documented, unsmoothed (lidar p90 likely catches the tower)" },
  { id: "baycoast", name: "Baycoast Bank", file: "/tier1/baycoast.glb", position: [-18469.014, 0, -8289.236], height: 5.27, sliceIdx: 4016, centroidSlice: [-18469.014, 8289.236], pointCount: 4 },
  // Lizzie Borden House: NO slice footprint (nearest slice buildings are
  // unnamed placeholders 23+ m away — none substituted). Position from OSM
  // way 213035398 ("Lizzie Borden House", 230 Second Street), fetched from
  // the OSM API 2026-11-03: 4 corners converted with origin lat 41.636 /
  // lon -70.9205, 111320 m/deg lat, 83198.429 m/deg lon; placement centroid
  // is the UNIQUE-vertex mean (east -19610.77, north 7005.84), which the
  // pipeline GLB was built around (span-exact). Height 10.14 m is the FR
  // lidar report figure (reported, not re-verified — batch-7 caveat).
  { id: "lizzie", name: "Lizzie Borden House", file: "/tier1/lizzie.glb", position: [-19610.77, 0, -7005.84], height: 10.14, sliceIdx: -1, centroidSlice: [-19610.77, 7005.84], pointCount: 4, flag: "height 10.14 m reported from FR lidar summary, underlying record not re-located; no slice footprint — OSM-sourced, no slice filter entry", source: "osm:way:213035398" },
];

function dupMean(fp: [number, number][]): [number, number] {
  let x = 0, y = 0;
  for (const [e, n] of fp) { x += e; y += n; }
  return [x / fp.length, y / fp.length];
}
function uniqCount(fp: [number, number][]): number {
  return fp.length > 1 && fp[0][0] === fp[fp.length - 1][0] && fp[0][1] === fp[fp.length - 1][1] ? fp.length - 1 : fp.length;
}
// True when a slice building is one of the slice-derived Tier-1
// replacements: same unique-point count, same dup-inclusive centroid
// (within 1 cm), same height (within 1 cm). Non-slice entries (Lizzie,
// sliceIdx -1) never match — there is nothing to filter for them. The test
// pins the exact indices this removes from the shipped slice, so a future
// slice change fails loudly instead of silently double-rendering or
// dropping a building.
export function isTier1Building(b: Building): boolean {
  const c = dupMean(b.footprint);
  return TIER1_MODELS.some(
    (t) =>
      t.sliceIdx >= 0 &&
      uniqCount(b.footprint) === t.pointCount &&
      Math.abs(c[0] - t.centroidSlice[0]) < 0.01 &&
      Math.abs(c[1] - t.centroidSlice[1]) < 0.01 &&
      Math.abs(b.height - t.height) < 0.01,
  );
}

// Remove the 18 replaced generic extrusions so the GLBs do not
// double-render (coincident walls would z-fight). Camera sweeps, ped
// avoidance, and graffiti keep using the FULL slice list elsewhere —
// only the StreamingBuildings fallback list is filtered, and only
// for the models this manifest mounts.
export function withoutTier1(buildings: Building[]): Building[] {
  return buildings.filter((b) => !isTier1Building(b));
}
