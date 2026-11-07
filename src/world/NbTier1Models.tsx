import { StreamedTier1 } from "./StreamedTier1";
import { NB_TIER1_MODELS } from "./nbTier1Models";

// New Bedford Tier-1 approved-model mount (batches 4–8, bulk job
// 2026-11-03). Visual-only by construction: PackGLB creates plain meshes,
// no RigidBody, no colliders — driving/physics behavior is unchanged by
// this mount. Mounted OUTSIDE <Physics> and OUTSIDE <CullByDistance> in
// Experience (same pattern as Tier1Models), gated on the New Bedford
// district. The generic extrusions these replace are excluded twice over:
// GIS records via the GisDistrict HANDLED filter (by record id) and
// streamed-tile duplicates via the GIS district file's `replaces` map
// (withoutReplaced) — see nbTier1Models.ts for the per-entry exclusion.
// DISTANCE STREAMING (2026-11-07, iPhone jetsam fix): StreamedTier1
// mounts only entries within 150 m of the camera and disposes past
// 250 m (hard cap 48 mounted) — see tier1Stream.ts for the measured
// radii. The manifest, positions and counts are untouched.
export function NbTier1Models() {
  return <StreamedTier1 entries={NB_TIER1_MODELS} />;
}
