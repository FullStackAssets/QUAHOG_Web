import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { shared } from "../shared";
import { BUSINESSES } from "../economy";

// Coastal-neon dusk (Phase 3): each business front gets a glowing sign + a spill
// point light that ramps on as night falls — bloom turns them into neon.
const COLORS = ["#ff4fa3", "#ffcf4a", "#5ad0ff", "#7CFC00", "#ff7a3a", "#c08bff"];

export function NeonSigns() {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(() => {
    const night = 1 - shared.dayT;
    for (let i = 0; i < BUSINESSES.length; i++) {
      if (mats.current[i]) mats.current[i]!.emissiveIntensity = 0.2 + night * 2.6;
      if (lights.current[i]) lights.current[i]!.intensity = night * 6;
    }
  });

  return (
    <group>
      {BUSINESSES.map((b, i) => {
        const c = COLORS[i % COLORS.length];
        return (
          <group key={b.id} position={[b.pos[0], 0, b.pos[2]]}>
            <mesh position={[0, 4.6, 0]}>
              <boxGeometry args={[5, 1.1, 0.3]} />
              <meshStandardMaterial ref={(m) => (mats.current[i] = m)} color={c} emissive={c} emissiveIntensity={0.2} toneMapped={false} />
            </mesh>
            <Text position={[0, 4.6, 0.18]} fontSize={0.62} color="#1a1020" anchorX="center" anchorY="middle" maxWidth={4.7}>
              {b.name.toUpperCase()}
            </Text>
            <pointLight ref={(l) => (lights.current[i] = l)} position={[0, 4.2, 1.5]} color={c} intensity={0} distance={22} decay={2} />
          </group>
        );
      })}
    </group>
  );
}
