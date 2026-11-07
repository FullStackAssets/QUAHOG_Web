import { StreamedTier1 } from "./StreamedTier1";
import { DOWNTOWN_TIER1_MODELS } from "./downtownTier1Models";

// Downtown New Bedford regular-building mount (upgrade round 2026-11-03).
// Visual-only by construction: PackGLB creates plain meshes, no RigidBody,
// no colliders — driving/physics behavior is unchanged by this mount.
// Mounted OUTSIDE <Physics> and OUTSIDE <CullByDistance> in Experience
// (same pattern as NbTier1Models), gated on the New Bedford district.
// The generic extrusions these replace are excluded twice over: GIS
// records via the GisDistrict HANDLED filter (by record id) and
// streamed-tile duplicates via the GIS district file's `replaces` map
// (withoutReplaced) — see downtownTier1Models.ts for the per-entry
// exclusion. Heights are estimates except the 13 detail-pass lidar
// heights (s29 + the 12 new tile models — see the manifest header).
// No area gate: every manifest entry renders district-wide (mounted
// for the whole NB district in Experience), including the 12 new
// out-of-boundary detail-pass entries, whose flags say so.
// DISTANCE STREAMING (2026-11-07, iPhone jetsam fix): StreamedTier1
// mounts only entries within 150 m of the camera and disposes past
// 250 m (hard cap 48 mounted) — see tier1Stream.ts for the measured
// radii. The manifest, positions and counts are untouched.
export function DowntownTier1Models() {
  return <StreamedTier1 entries={DOWNTOWN_TIER1_MODELS} />;
}
