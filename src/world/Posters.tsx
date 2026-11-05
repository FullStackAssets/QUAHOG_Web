import { useMemo } from "react";
import * as THREE from "three";
import { makePoster } from "./textures";

// Environmental storytelling (§8): wheat-pasted flyers on board stands around the
// core — radio-station promos and the Feast of the Blessed Sacrament banner.

const SPOTS: { pos: [number, number, number]; rot: number; variant: number }[] = [
  { pos: [-268, 0, 100], rot: 0.4, variant: 0 },
  { pos: [-238, 0, 86], rot: -1.1, variant: 1 },
  { pos: [-296, 0, 112], rot: 0.9, variant: 2 },
  { pos: [-252, 0, 132], rot: 2.4, variant: 3 },
  { pos: [-222, 0, 116], rot: -0.5, variant: 0 },
  { pos: [-312, 0, 92], rot: 1.7, variant: 2 },
];

export function Posters() {
  const texes = useMemo(() => [0, 1, 2, 3].map((v) => makePoster(v)), []);
  return (
    <group>
      {SPOTS.map((s, i) => (
        <group key={i} position={s.pos} rotation-y={s.rot}>
          {/* board */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[1.5, 1.7, 0.08]} />
            <meshStandardMaterial color="#2a2622" roughness={0.9} />
          </mesh>
          {/* poster face */}
          <mesh position={[0, 1.55, 0.05]}>
            <planeGeometry args={[1.3, 1.3]} />
            <meshStandardMaterial map={texes[s.variant]} roughness={0.85} />
          </mesh>
          {/* legs */}
          <mesh position={[-0.5, 0.4, 0]}><boxGeometry args={[0.08, 0.9, 0.08]} /><meshStandardMaterial color="#3a352e" /></mesh>
          <mesh position={[0.5, 0.4, 0]}><boxGeometry args={[0.08, 0.9, 0.08]} /><meshStandardMaterial color="#3a352e" /></mesh>
        </group>
      ))}
    </group>
  );
}
