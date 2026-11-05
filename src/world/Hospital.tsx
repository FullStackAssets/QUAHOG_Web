import { useMemo } from "react";
import * as THREE from "three";
import { dressFootprint } from "./districtStyle";
import { districtFacadeMaps } from "./districtMaterials";
import { HOSPITAL } from "../places";

// Stand-in St. Luke's Hospital (§37 civic): where the player wakes after being
// WASTED. A pale block with a red cross; re-anchored to the real building once
// the slice grows north (see places.ts).
export function Hospital() {
  const geometry = useMemo(() => dressFootprint(new THREE.BoxGeometry(14, 8, 10), {
    name: "civic-clinic", footprint: [[-7,-5],[7,-5],[7,5],[-7,5]], height: 8,
  }), []);
  const maps = useMemo(() => districtFacadeMaps("granite"), []);
  return (
    // sit on the ground (HOSPITAL[1] is the respawn height, not the building base)
    <group position={[HOSPITAL[0], 0, HOSPITAL[2]]}>
      <mesh geometry={geometry} position={[0, 4, -14]} castShadow receiveShadow>
        {/* mid grey, not near-white: a #dfe3e6 face blew out to a glowing white
            block under the sun + bloom */}
        <meshStandardMaterial vertexColors map={maps.albedo} roughness={0.9} />
      </mesh>
      {/* red cross sign */}
      <group position={[0, 6.5, -8.9]}>
        <mesh><boxGeometry args={[1.6, 0.5, 0.1]} /><meshStandardMaterial color="#d33" emissive="#d33" emissiveIntensity={0.5} /></mesh>
        <mesh><boxGeometry args={[0.5, 1.6, 0.1]} /><meshStandardMaterial color="#d33" emissive="#d33" emissiveIntensity={0.5} /></mesh>
      </group>
    </group>
  );
}
