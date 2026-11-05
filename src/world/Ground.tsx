import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { makeTerrainTexture } from "./textures";

// Region-wide land base. The visual plane sits at y=0 and the collider top is at
// y=0, so roads (0.05–0.08) and water (0.45) sit cleanly ABOVE it — otherwise
// they z-fight the ground and flicker. Spans the whole ~32 km slice.
const SIZE = 60000;

export function Ground() {
  const tex = useMemo(() => {
    const t = makeTerrainTexture();
    t.repeat.set(1200, 1200); // ~50 m per tile across the region
    return t;
  }, []);

  return (
    <RigidBody type="fixed">
      <CuboidCollider args={[SIZE / 2, 0.1, SIZE / 2]} position={[0, -0.1, 0]} friction={1} />
      {/* visual sits just below y=0 so the aerial drape (y=0.03) and roads win
          the depth test cleanly instead of fighting this region-wide plane */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.15, 0]} receiveShadow>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshStandardMaterial map={tex} color="#919a72" roughness={1} />
      </mesh>
    </RigidBody>
  );
}
