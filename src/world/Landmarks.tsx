import { useRef } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { toWorld, type Landmark } from "../slice";

// Nearby wayfinding, not a skyline of neon beams. Mission targets and map
// markers retain their existing logic; these labels are visual context only.
function NearbyLabel({ landmark }: { landmark: Landmark }) {
  const root = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const [x, , z] = toWorld(landmark.pos);
  useFrame(() => {
    if (root.current) root.current.visible = Math.hypot(camera.position.x - x, camera.position.z - z) < (landmark.hero ? 65 : 35);
  });
  return <group ref={root} position={[x, 0, z]}>
    <Billboard position={[0, landmark.hero ? 12 : 7, 0]}>
      <Text fontSize={landmark.hero ? 0.65 : 0.45} color="#ded9c6" outlineWidth={0.025} outlineColor="#273c43" anchorX="center" anchorY="middle">{landmark.name}</Text>
    </Billboard>
  </group>;
}
export function Landmarks({ landmarks }: { landmarks: Landmark[] }) {
  return <group>{landmarks.map((lm, i) => <NearbyLabel key={i} landmark={lm} />)}</group>;
}
