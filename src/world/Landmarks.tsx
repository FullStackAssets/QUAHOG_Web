import { Billboard, Text } from "@react-three/drei";
import { toWorld } from "../slice";
import type { Landmark } from "../slice";

// Floating labels for named landmarks; hero landmarks get a neon marker beam.
export function Landmarks({ landmarks }: { landmarks: Landmark[] }) {
  return (
    <group>
      {landmarks.map((lm, i) => {
        const [x, , z] = toWorld(lm.pos);
        const hero = !!lm.hero;
        return (
          <group key={i} position={[x, 0, z]}>
            {hero && (
              <mesh position={[0, 18, 0]}>
                <cylinderGeometry args={[0.4, 0.4, 36, 8]} />
                <meshBasicMaterial color="#ff2e88" transparent opacity={0.35} />
              </mesh>
            )}
            <Billboard position={[0, hero ? 14 : 9, 0]}>
              <Text
                fontSize={hero ? 3.2 : 2}
                color={hero ? "#ffd166" : "#9fd8ff"}
                outlineWidth={0.12}
                outlineColor="#0a0a14"
                anchorX="center"
                anchorY="middle"
              >
                {lm.name}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
