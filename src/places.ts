// Fixed civic locations in the slice (world coords: x=east, z=-north).
// Used for respawns and map markers. Picked on inland streets near the core.
//
// POLICE_STATION is now the REAL downtown New Bedford Police Station footprint
// captured in the expanded slice. HOSPITAL is still a stand-in — St. Luke's
// (101 Page St, ~41.6306,-70.9419) sits just west of the current bbox; widen
// the pull westward and re-anchor HOSPITAL to it (see make_slice.py bbox).

import type { DistrictId } from "./districts";

export interface Civic { name: string; kind: "hospital" | "police"; pos: [number, number, number] }

export const HOSPITAL: [number, number, number] = [-264.2, 3, 106.5]; // stand-in by the Bethel, nudged W off the roadway
export const POLICE_STATION: [number, number, number] = [-513, 3, 147]; // real NB Police Station

export const CIVIC: Civic[] = [
  { name: "St. Luke's Hospital", kind: "hospital", pos: HOSPITAL },
  { name: "New Bedford Police Station", kind: "police", pos: POLICE_STATION },
];

// Fast-travel destinations (world x,z) — town centers + hero spots.
// `district` is the district the point belongs to: selecting a point in
// another district switches districts (slice reload + teleport) instead
// of teleporting 20 km across the gap. Existing Fall River points are
// kept exactly; the Government Center point is new (Fall River plan §2).
// It is deliberately snapped to Sullivan Drive, NOT the nearest road:
// I-195 passes 6.8 m from City Hall, and a nearest-road snap would
// strand the player on the freeway.
export const FAST_TRAVEL: { name: string; pos: [number, number]; district: DistrictId }[] = [
  { name: "New Bedford Waterfront", pos: [-256, 106], district: "newBedford" },
  { name: "Downtown New Bedford", pos: [-560, 90], district: "newBedford" },
  { name: "Seamen's Bethel", pos: [-250, 106], district: "newBedford" },
  { name: "Fort Phoenix (Fairhaven)", pos: [2048, 45], district: "newBedford" },
  { name: "Hurricane Barrier", pos: [860, 2000], district: "newBedford" },
  { name: "Buttonwood Park", pos: [-2040, -2560], district: "newBedford" },
  { name: "Off the Hook (Long Island)", pos: [6092, 4470], district: "newBedford" },
  { name: "Dartmouth Mall", pos: [-5887.3, -552.3], district: "newBedford" }, // moved 2026-11-03 from Route 6 ([-3921, 360]) to the mall's interior drive: slice (-5887.3, 552.3), 110.1 m from the tile-building centroid, outside the footprint (7.5 m clear), car point 10.7 m clear — NOT the centroid itself (inside the footprint)
  { name: "Westport", pos: [-13280, 1781], district: "newBedford" },
  { name: "Fall River — Battleship Cove", pos: [-19972, -7348], district: "fallRiver" }, // off the Braga deck/ramps (was under it), beside a surface road
  { name: "Lizzie Borden House", pos: [-19599, -7060], district: "fallRiver" },
  { name: "Downtown Fall River — Government Center", pos: [-19492.1, -7191.2], district: "fallRiver" },
];

// Hero landmarks (world coords from real lat/lon via the slice origin).
export const BATTLESHIP_COVE: [number, number, number] = [-20273, 0, -7625]; // USS Massachusetts, Fall River
export const LIZZIE_BORDEN: [number, number, number] = [-19599, 0, -7080];   // 92 Second St, Fall River
export const DARTMOUTH_MALL: [number, number, number] = [-3921, 0, 378];     // Route 6, Dartmouth
