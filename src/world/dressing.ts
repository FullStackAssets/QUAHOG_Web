// Central dressing switch — full-game plan, minimalist directive (Nic,
// 2026-11-03, confirmed by him): most dressing and clutter is eliminated
// everywhere, FOR NOW. This is a switch, not a deletion: the dressing layer
// code stays intact and returns in one flip (set this to true) when Nic
// wants it back. Experience.tsx gates the dressing mounts on it; the one
// exception is HarborProps' land-side gear boxes, which read it inside the
// component because they are a sub-part of a mount that otherwise stays on.
//
// OFF (current) gates: Props, HighMasts, Awnings, StreetSigns, StreetExtras,
// RoadFixtures, Foliage, Fences, Billboards, Dumpsters, PortClutter, and the
// land-side gear boxes inside HarborProps — i.e. lamps, trees, hydrants,
// mailboxes, benches, cones, signs, awnings, foliage, fences, dumpsters,
// billboards, shipping containers / wharf crates, and the Rt 18 high masts
// (dark while off).
// HarborProps itself stays mounted (its pilings, buoys and boats are
// water-edge items, not street clutter); only its land-side gear boxes read
// this flag, so the "only Experience gates" line below no longer holds for
// that one sub-part.
// ALWAYS ON: roads, buildings (GIS + tiles), water, vehicles
// (player/traffic/parked), mission elements, car headlights, crosswalks,
// utility-pole visuals, traffic signals, and the debug overlay.
export const DRESSING_ENABLED = false;
