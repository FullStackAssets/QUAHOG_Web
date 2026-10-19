import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Hides its children when the camera is far from a centre point. The near-core
// dressing layers (street furniture, decals, parked cars, peds, …) only populate
// a ~250 m radius around the core anyway, so once the player drives well away
// (e.g. out to the harbour) we can stop traversing/rendering all of them — a
// cheap, meaningful perf win on mobile now that the city is densely dressed.
// `center` is slice [east, north]; world z = -north.

export function CullByDistance({
  center, radius, children,
}: {
  center: [number, number];
  radius: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const cx = center[0], cz = -center[1];
  const r2 = radius * radius;
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const p = s.camera.position;
    const dx = p.x - cx, dz = p.z - cz;
    g.visible = dx * dx + dz * dz < r2;
  });
  return <group ref={ref}>{children}</group>;
}
