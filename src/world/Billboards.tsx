import { useMemo } from "react";
import { makePoster } from "./textures";
import { sampleRoadEdges } from "./roadSamples";
import type { Road } from "../slice";

// Roadside billboards on arterial frontages — big boards on twin posts carrying
// the era radio/feast posters (reuses makePoster). A handful, spaced out, facing
// the road. Cheap: a few textured quads, not instanced.

const RADIUS = 320;
const MAX = 18;

export function Billboards({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const posters = useMemo(() => [0, 1, 2, 3].map((v) => makePoster(v)), []);
  const boards = useMemo(() => {
    const samples = sampleRoadEdges(roads, center, {
      radius: RADIUS, step: 120, sparse: 1, max: MAX, highways: ["primary", "secondary", "tertiary"],
    });
    return samples.map((s, i) => {
      const nx = -s.dz, nz = s.dx;
      const side = (i & 1) ? 1 : -1;
      const o = 11;
      return {
        x: s.x + nx * o * side, z: s.z + nz * o * side,
        rot: Math.atan2(nx * side, nz * side),
        v: i % 4,
      };
    });
  }, [roads, center]);

  return (
    <group>
      {boards.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation-y={b.rot}>
          {/* posts */}
          <mesh position={[-2.4, 2.0, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.14, 4.0, 6]} />
            <meshStandardMaterial color="#3a3f47" roughness={0.7} metalness={0.5} />
          </mesh>
          <mesh position={[2.4, 2.0, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.14, 4.0, 6]} />
            <meshStandardMaterial color="#3a3f47" roughness={0.7} metalness={0.5} />
          </mesh>
          {/* board backing */}
          <mesh position={[0, 4.4, -0.05]} castShadow>
            <boxGeometry args={[6.4, 3.4, 0.12]} />
            <meshStandardMaterial color="#1a1a1e" roughness={0.8} />
          </mesh>
          {/* poster face */}
          <mesh position={[0, 4.4, 0.02]}>
            <planeGeometry args={[6.0, 3.0]} />
            <meshStandardMaterial map={posters[b.v]} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
