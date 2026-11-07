import { StreamedTier1 } from "./StreamedTier1";
import { TIER1_MODELS } from "./tier1Models";

// Tier-1 approved-model mount (batches 2 + 3, Nic 2026-11-03). Visual-only
// by construction: PackGLB creates plain meshes, no RigidBody, no colliders
// — driving/physics behavior is unchanged by this mount. Mounted OUTSIDE
// <Physics> and OUTSIDE <CullByDistance> in Experience (Fall River models
// sit kilometres from the New Bedford core, beyond the cull radius), gated
// on the Fall River district. The 10 generic slice extrusions these replace
// are filtered out of the StreamingBuildings fallback list (withoutTier1),
// so no coincident walls z-fight. Camera sweeps, ped avoidance, and graffiti
// keep using the full slice list — only the fallback render list changes.
// DISTANCE STREAMING (2026-11-07, iPhone jetsam fix): StreamedTier1
// mounts only entries within 150 m of the camera and disposes past
// 250 m (hard cap 48 mounted) — see tier1Stream.ts for the measured
// radii. The manifest, positions and counts are untouched.
export function Tier1Models() {
  return <StreamedTier1 entries={TIER1_MODELS} />;
}
