import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Off the Hook / Long Island marina: a dock lined with moored small yachts —
// this stretch of Sconticut Neck is wealthy, so it's pleasure craft, not the
// working trawlers you get over in New Bedford harbor. Static + gentle bob.

const DOCK: [number, number, number] = [6092, 0, 4485];
const YACHTS: { x: number; z: number; rot: number; hull: string }[] = [
  { x: 6112, z: 4500, rot: 0.3, hull: "#f4f6f8" },
  { x: 6124, z: 4512, rot: 0.5, hull: "#eef1f4" },
  { x: 6136, z: 4524, rot: 0.2, hull: "#f0ece4" },
  { x: 6108, z: 4538, rot: -0.4, hull: "#f4f6f8" },
  { x: 6150, z: 4506, rot: 0.8, hull: "#eaeef2" },
];

function Yacht({ hull }: { hull: string }) {
  return (
    <group scale={0.85}>
      <mesh castShadow position={[0, 0.35, 0]}><boxGeometry args={[2.3, 0.9, 7]} /><meshStandardMaterial color={hull} roughness={0.3} metalness={0.1} /></mesh>
      <mesh castShadow position={[0, 0.35, 4]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[1.63, 0.9, 1.63]} /><meshStandardMaterial color={hull} roughness={0.3} /></mesh>
      <mesh position={[0, -0.02, 0]}><boxGeometry args={[2.36, 0.18, 6.9]} /><meshStandardMaterial color="#1f3a5f" roughness={0.4} /></mesh>
      <mesh castShadow position={[0, 1.3, -0.6]}><boxGeometry args={[1.9, 1.0, 3]} /><meshStandardMaterial color="#fbfcfd" roughness={0.25} /></mesh>
      <mesh position={[0, 1.4, 0.95]} rotation={[0.5, 0, 0]}><boxGeometry args={[1.8, 0.7, 0.05]} /><meshStandardMaterial color="#16242e" metalness={0.6} roughness={0.12} /></mesh>
      <mesh position={[0, 2.6, -1.5]}><torusGeometry args={[0.7, 0.05, 6, 12, Math.PI]} /><meshStandardMaterial color="#cfd4d8" metalness={0.6} roughness={0.3} /></mesh>
    </group>
  );
}

export function Marina() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    YACHTS.forEach((y, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.set(y.x, 0.35 + Math.sin(t * 1.1 + i) * 0.12, y.z);
      g.rotation.set(Math.sin(t * 0.9 + i) * 0.04, y.rot, Math.sin(t * 1.2 + i) * 0.05);
    });
  });
  return (
    <group>
      {/* timber dock + finger piers */}
      <mesh position={[DOCK[0] + 18, 0.6, DOCK[2] + 26]} rotation-y={0.5} castShadow receiveShadow>
        <boxGeometry args={[4, 0.3, 44]} />
        <meshStandardMaterial color="#9a8763" roughness={0.9} />
      </mesh>
      {YACHTS.map((y, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <Yacht hull={y.hull} />
        </group>
      ))}
    </group>
  );
}
