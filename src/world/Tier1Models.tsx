import { PackGLB } from "../actors/PackGLB";
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
export function Tier1Models() {
  return (
    <group>
      {TIER1_MODELS.map((m) => (
        <group key={m.id} position={m.position}>
          <PackGLB path={m.file} />
        </group>
      ))}
    </group>
  );
}
