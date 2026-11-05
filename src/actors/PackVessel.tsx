import { PackGLB } from "./PackGLB";

// A P003 vessel mounted at a shipped boat position. P003 files are already
// in game frame (length along X, bow +X, keel at local y=0); the procedural
// boats they replace faced +Z with their hull bottom at group-relative
// -0.75, so the inner group rotates the bow to +Z and drops the keel to
// -0.75 (about 0.85 m below the water surface, matching the old dragger).
export function PackVessel({ path }: { path: string }) {
  return (
    <group rotation-y={-Math.PI / 2} position={[0, -0.75, 0]}>
      <PackGLB path={path} />
    </group>
  );
}
