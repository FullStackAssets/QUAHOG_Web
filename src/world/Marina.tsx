import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PackVessel } from "../actors/PackVessel";

// Off the Hook / Long Island marina: a dock lined with moored small yachts —
// this stretch of Sconticut Neck is wealthy, so it's pleasure craft, not the
// working trawlers you get over in New Bedford harbor. Static + gentle bob.
// Mount job (2026-11-03): P003 pleasure vessels at the same slips (visual
// swap only — the bob/roll group is untouched).

const DOCK: [number, number, number] = [6092, 0, 4485];
const YACHTS: { x: number; z: number; rot: number }[] = [
  { x: 6112, z: 4500, rot: 0.3 },
  { x: 6124, z: 4512, rot: 0.5 },
  { x: 6136, z: 4524, rot: 0.2 },
  { x: 6108, z: 4538, rot: -0.4 },
  { x: 6150, z: 4506, rot: 0.8 },
];
export const MARINA_VESSELS = [
  "cabin_cruiser", "marina_sailboat", "center_console_boat",
  "dockside_skiff", "utility_launch",
];

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
          <PackVessel path={`/packs/pack003/${MARINA_VESSELS[i % MARINA_VESSELS.length]}.glb`} />
        </group>
      ))}
    </group>
  );
}
