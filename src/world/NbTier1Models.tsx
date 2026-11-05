import { PackGLB } from "../actors/PackGLB";
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
export function NbTier1Models() {
  return (
    <group>
      {NB_TIER1_MODELS.map((m) => (
        <group key={m.id} position={m.position}>
          <PackGLB path={m.file} />
        </group>
      ))}
    </group>
  );
}
