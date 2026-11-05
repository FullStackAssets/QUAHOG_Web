import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// A simple low-poly humanoid (head, torso, swinging arms + legs) built from
// primitives. Feet rest at local y=0; faces +z. Shared by the player and
// pedestrians so neither is a "blob". Walk cycle animates while `moving()`.

export interface CharacterProps {
  skin?: string;
  shirt?: string;
  pants?: string;
  hair?: string;
  moving?: () => boolean;
}

export function Character({
  skin = "#caa07a",
  shirt = "#3f6cc0",
  pants = "#2c2f3a",
  hair = "#2a2018",
  moving = () => true,
}: CharacterProps) {
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const gait = useRef(0);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    const want = moving() ? 1 : 0;
    gait.current += (want - gait.current) * Math.min(1, step * 8);
    phase.current += step * 9 * gait.current;
    const s = Math.sin(phase.current) * 0.6 * gait.current;
    if (legL.current) legL.current.rotation.x = s;
    if (legR.current) legR.current.rotation.x = -s;
    if (armL.current) armL.current.rotation.x = -s * 0.8;
    if (armR.current) armR.current.rotation.x = s * 0.8;
    if (bob.current) bob.current.position.y = Math.abs(Math.sin(phase.current)) * 0.05 * gait.current;
  });

  return (
    <group ref={bob}>
      {/* legs (pivot at hips) */}
      <group ref={legL} position={[-0.12, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <boxGeometry args={[0.18, 0.9, 0.2]} />
          <meshStandardMaterial color={pants} roughness={0.8} />
        </mesh>
      </group>
      <group ref={legR} position={[0.12, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <boxGeometry args={[0.18, 0.9, 0.2]} />
          <meshStandardMaterial color={pants} roughness={0.8} />
        </mesh>
      </group>

      {/* torso */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[0.5, 0.72, 0.28]} />
        <meshStandardMaterial color={shirt} roughness={0.7} />
      </mesh>

      {/* arms (pivot at shoulders) */}
      <group ref={armL} position={[-0.32, 1.55, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.13, 0.62, 0.15]} />
          <meshStandardMaterial color={shirt} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <boxGeometry args={[0.12, 0.12, 0.14]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>
      <group ref={armR} position={[0.32, 1.55, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.13, 0.62, 0.15]} />
          <meshStandardMaterial color={shirt} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <boxGeometry args={[0.12, 0.12, 0.14]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>

      {/* neck + head */}
      <mesh position={[0, 1.66, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.12, 8]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.82, 0]} castShadow>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* hair cap */}
      <mesh position={[0, 1.88, -0.02]} castShadow>
        <sphereGeometry args={[0.155, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hair} roughness={0.85} />
      </mesh>
    </group>
  );
}
