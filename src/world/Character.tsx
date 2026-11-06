import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { gaitPose, gaitStep, type Gait } from "../actors/gait";

// A simple low-poly humanoid (head, torso, swinging arms + legs) built from
// primitives. Feet rest at local y=0; faces +z. Shared by the player and
// pedestrians so neither is a "blob". Walk cycle animates while `moving()`.

export interface CharacterProps {
  skin?: string;
  shirt?: string;
  pants?: string;
  hair?: string;
  hat?: boolean;
  moving?: () => boolean;
  pace?: () => Gait;
}

export function Character({
  skin = "#caa07a",
  shirt = "#3f6cc0",
  pants = "#2c2f3a",
  hair = "#2a2018",
  hat = false,
  moving = () => true,
  pace,
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
    const gaitName = pace ? pace() : (moving() ? "walk" : "idle");
    phase.current = gaitStep(phase.current, gaitName, step);
    const goal = gaitName === "idle" ? 0 : 1;
    gait.current += (goal - gait.current) * Math.min(1, step * 8);
    const pose = gaitPose(phase.current, gaitName);
    const blend = gait.current;
    if (legL.current) legL.current.rotation.x = pose.legL * blend;
    if (legR.current) legR.current.rotation.x = pose.legR * blend;
    if (armL.current) armL.current.rotation.x = pose.armL * blend;
    if (armR.current) armR.current.rotation.x = pose.armR * blend;
    if (bob.current) bob.current.position.y = pose.bob * blend;
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
      {hat && (
        <mesh position={[0, 1.98, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 12]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.7} />
        </mesh>
      )}
    </group>
  );
}
