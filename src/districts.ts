// District registry (Fall River integration, 2026-11-03; expansion,
// 2026-11-07: Brockton + Cape added). Phase 1: two districts, fast-travel
// only between them — no drivable corridor. Expansion keeps that rule:
// four districts, fast-travel only between them.
// Coordinates: `center` is slice [east, north] (the frame of TRANSFORM.md:
// origin lat 41.636 / lon -70.9205); world coords are [east, -north].
// `bounds` is the Fall River bbox in WORLD coords, used ONLY to classify a
// world point's district for the minimap/beacon cross-district gate —
// anything outside it is New Bedford (the original district).

export type DistrictId = "newBedford" | "fallRiver" | "brockton" | "cape";

export interface District {
  id: DistrictId;
  name: string;
  /** Slice [east, north] center: drives StreamingBuildings, CullByDistance,
   *  and the building-avoidance box. */
  center: [number, number];
  sliceFile: string;
  /** World [x, z] spawn for the district (its Battleship Cove point). */
  spawn: [number, number];
  /** World bbox for districtOfWorld; null = default district. */
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number } | null;
}

export const DISTRICTS: Record<DistrictId, District> = {
  newBedford: {
    id: "newBedford",
    name: "New Bedford",
    center: [-266, -100],
    sliceFile: "slice-newbedford.json",
    spawn: [-256, 106],
    bounds: null,
  },
  fallRiver: {
    id: "fallRiver",
    name: "Fall River",
    // Package center (FALL-RIVER-PLAN-2026-11-03 §1/§7).
    center: [-19309.9, 7144.6],
    sliceFile: "slice-fallriver.json",
    // Battleship Cove fast-travel point (existing entry, kept).
    spawn: [-19972, -7348],
    // Slice bbox x [-21272.5, -17347.3], north [5268.4, 9020.9] -> world
    // z = -north. 500 m margin so road bleed past the bbox still counts.
    bounds: { xMin: -21772.5, xMax: -16847.3, zMin: -9520.9, zMax: -4768.4 },
  },
  brockton: {
    id: "brockton",
    name: "Brockton",
    // Downtown center = Cappiello Boxing Gym anchor (162 Main St,
    // 42.082429, -71.019857 — real position, expansion 2026-11-07).
    center: [-8266.4, 49696.5],
    sliceFile: "slice-brockton.json",
    // Main Street fast-travel point (20.7 m from the gym, on the road,
    // outside footprints/water — same care as the FR Government Center).
    spawn: [-8280, -49681],
    // Brockton bbox lat 42.055–42.11, lon -71.06–-70.975 -> world
    // x [-11606.2, -4534.3], z [-52765.7, -46643.1]; 500 m margin.
    bounds: { xMin: -12106.2, xMax: -4034.3, zMin: -53265.7, zMax: -46143.1 },
  },
  cape: {
    id: "cape",
    name: "Cape Cod — Hyannis",
    // Center = Hyannis Marina anchor (1 Willow St, 41.650523, -70.273588
    // — real position, expansion 2026-11-07).
    center: [53822.1, 1616.7],
    sliceFile: "slice-cape.json",
    // Willow Street fast-travel point (37.6 m from the marina, on the
    // road, outside footprints/water).
    spawn: [53850, -1642],
    // Hyannis bbox lat 41.615–41.675, lon -70.33–-70.24 -> world
    // x [49128.7, 56616.5], z [-4341.5, 2337.7]; 500 m margin.
    bounds: { xMin: 48628.7, xMax: 57116.5, zMin: -4841.5, zMax: 2837.7 },
  },
};

/** Slice center -> world [x, z] center (what ParkedCars, StreetLife,
 *  RoadPuddles and the harbor layers take). */
export function worldCenter(d: District): [number, number] {
  return [d.center[0], -d.center[1]];
}

/** Which district a world point belongs to (for the cross-district gate).
 *  The three bounded districts decide; everything else is New Bedford
 *  (the default). Bounds do not overlap (verified at registration). */
export function districtOfWorld(x: number, z: number): DistrictId {
  const fr = DISTRICTS.fallRiver.bounds!;
  if (x >= fr.xMin && x <= fr.xMax && z >= fr.zMin && z <= fr.zMax) return "fallRiver";
  const br = DISTRICTS.brockton.bounds!;
  if (x >= br.xMin && x <= br.xMax && z >= br.zMin && z <= br.zMax) return "brockton";
  const cp = DISTRICTS.cape.bounds!;
  if (x >= cp.xMin && x <= cp.xMax && z >= cp.zMin && z <= cp.zMax) return "cape";
  return "newBedford";
}

/** True when a mission target sits in a different district than the player's
 *  active district — the HUD objective readout gate (playtest fix,
 *  2026-11-03). The beacon and minimap already gate on districtOfWorld;
 *  the HUD readout did not, so it showed cross-district straight-line
 *  distances ("Meet Deacon Mealy at Seamen's Bethel · 20632 m" while the
 *  player was in the other district). The HUD matches the beacon/minimap
 *  presentation: hide the readout, don't print a meaningless number. */
export function isCrossDistrictObjective(target: [number, number, number], district: DistrictId): boolean {
  return districtOfWorld(target[0], target[2]) !== district;
}
