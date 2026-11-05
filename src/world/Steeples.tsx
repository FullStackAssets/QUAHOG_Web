import { toWorld } from "../slice";

// A simple white belfry + dark spire + gilt cross at each real OSM church
// (amenity=place_of_worship), so New Bedford's many steeples poke above the
// rooftops. Points are church centroids in slice [east, north].

export function Steeples({ points }: { points?: [number, number][] }) {
  if (!points || points.length === 0) return null;
  return (
    <group>
      {points.map((p, i) => {
        const [x, , z] = toWorld(p);
        return (
          <group key={i} position={[x, 0, z]}>
            {/* belfry box above the roofline */}
            <mesh position={[0, 11, 0]} castShadow>
              <boxGeometry args={[2.6, 3.4, 2.6]} />
              <meshStandardMaterial color="#e6e2d8" roughness={0.85} />
            </mesh>
            {/* spire */}
            <mesh position={[0, 15.6, 0]} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[1.9, 5.6, 4]} />
              <meshStandardMaterial color="#3a4a44" roughness={0.7} metalness={0.2} flatShading />
            </mesh>
            {/* gilt cross finial */}
            <mesh position={[0, 18.9, 0]}>
              <boxGeometry args={[0.12, 1.0, 0.12]} />
              <meshStandardMaterial color="#d8c270" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 18.95, 0]}>
              <boxGeometry args={[0.6, 0.12, 0.12]} />
              <meshStandardMaterial color="#d8c270" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
