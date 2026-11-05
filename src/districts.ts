// District registry (Fall River integration, 2026-11-03). Phase 1: two
// districts, fast-travel only between them — no drivable corridor.
// Coordinates: `center` is slice [east, north] (the frame of TRANSFORM.md:
// origin lat 41.636 / lon -70.9205); world coords are [east, -north].
// `bounds` is the Fall River bbox in WORLD coords, used ONLY to classify a
// world point's district for the minimap/beacon cross-district gate —
// anything outside it is New Bedford (the original district).

export type DistrictId = "newBedford" | "fallRiver";

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
};

/** Slice center -> world [x, z] center (what ParkedCars, StreetLife,
 *  RoadPuddles and the harbor layers take). */
export function worldCenter(d: District): [number, number] {
  return [d.center[0], -d.center[1]];
}

/** Which district a world point belongs to (for the cross-district gate).
 *  Fall River's bbox decides; everything else is New Bedford. */
export function districtOfWorld(x: number, z: number): DistrictId {
  const fr = DISTRICTS.fallRiver.bounds!;
  if (x >= fr.xMin && x <= fr.xMax && z >= fr.zMin && z <= fr.zMax) return "fallRiver";
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
