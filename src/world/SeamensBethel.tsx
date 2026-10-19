import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { toWorld } from "../slice";
import type { Landmark } from "../slice";

// Hand-detailed hero landmark: the Seamen's Bethel ("Whaleman's Chapel", 1832) on
// Johnny Cake Hill — a white New England clapboard chapel with a gable front,
// square belfry + spire, arched windows, and double doors over stone steps.
// Built procedurally from primitives; front facade faces +x (the approach).

const WHITE = "#eae6dc";
const TRIM = "#f3f0e8";
const ROOF = "#2e2e33";
const STONE = "#8c8a84";
const DOOR = "#3a281a";
const GLASS = "#ffdda0";

export function SeamensBethel({ landmark }: { landmark: Landmark }) {
  const [wx, , wz] = toWorld(landmark.pos);

  // Gable roof as a triangular prism (ridge runs front→back along x).
  const roofGeom = useMemo(() => {
    const tri = new THREE.Shape();
    tri.moveTo(-6.3, 7.5);
    tri.lineTo(6.3, 7.5);
    tri.lineTo(0, 10.8);
    tri.closePath();
    const g = new THREE.ExtrudeGeometry(tri, { depth: 19, bevelEnabled: false });
    g.rotateY(Math.PI / 2); // extrude axis (z) -> world x
    g.translate(-9.5, 0, 0); // center along x
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <RigidBody type="fixed" colliders={false} position={[wx, 0, wz]}>
      {/* solid mass collider (body + projecting tower) */}
      <CuboidCollider args={[9.0, 4, 6.2]} position={[0, 4, 0]} />
      <CuboidCollider args={[1.8, 6.5, 1.8]} position={[8.4, 6.5, 0]} />

      {/* foundation */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[18.8, 0.5, 12.8]} />
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>

      {/* main body */}
      <mesh position={[0, 4.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[18, 7, 12]} />
        <meshStandardMaterial color={WHITE} roughness={0.85} />
      </mesh>

      {/* roof */}
      <mesh geometry={roofGeom} castShadow receiveShadow>
        <meshStandardMaterial color={ROOF} roughness={0.8} flatShading />
      </mesh>

      {/* corner pilasters (white trim) */}
      {[
        [9, 6], [9, -6], [-9, 6], [-9, -6],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 4, z]} castShadow>
          <boxGeometry args={[0.5, 7.2, 0.5]} />
          <meshStandardMaterial color={TRIM} roughness={0.8} />
        </mesh>
      ))}

      {/* front entablature / cornice across the gable base (Greek-revival) */}
      <mesh position={[9.05, 7.55, 0]} castShadow>
        <boxGeometry args={[0.5, 0.55, 12.6]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>

      {/* full square bell tower projecting from the front centre, rising through
          the roofline — the dominant feature of the real chapel */}
      <mesh position={[8.4, 9.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 13, 3.4]} />
        <meshStandardMaterial color={WHITE} roughness={0.85} />
      </mesh>
      {/* tower cornice cap */}
      <mesh position={[8.4, 13.4, 0]} castShadow>
        <boxGeometry args={[3.9, 0.4, 3.9]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>
      {/* belfry louvered arched openings near the top of the tower */}
      {[
        [10.12, 0, 0],
        [6.68, 0, 0],
        [8.4, 1.72, Math.PI / 2],
        [8.4, -1.72, Math.PI / 2],
      ].map(([x, z, ry], i) => (
        <mesh key={i} position={[x, 11.8, z]} rotation-y={ry}>
          <boxGeometry args={[0.12, 2.2, 1.6]} />
          <meshStandardMaterial color="#20242c" roughness={0.6} />
        </mesh>
      ))}
      {/* octagonal spire + gilded finial */}
      <mesh position={[8.4, 15.6, 0]} castShadow>
        <coneGeometry args={[2.2, 4.2, 8]} />
        <meshStandardMaterial color={ROOF} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[8.4, 18.0, 0]} castShadow>
        <sphereGeometry args={[0.24, 8, 8]} />
        <meshStandardMaterial color="#d8c270" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* double doors on the tower's front face */}
      <mesh position={[10.16, 2.0, 0]} castShadow>
        <boxGeometry args={[0.25, 3, 2.2]} />
        <meshStandardMaterial color={DOOR} roughness={0.7} />
      </mesh>
      <mesh position={[10.18, 3.6, 0]}>
        <boxGeometry args={[0.2, 0.55, 2.6]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>

      {/* stone steps up to the tower entrance */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[10.7 + i * 0.5, 0.45 - i * 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.3, 3.2 + i * 0.6]} />
          <meshStandardMaterial color={STONE} roughness={0.95} />
        </mesh>
      ))}

      {/* side windows */}
      {[-4.5, 0, 4.5].map((x) => (
        <ArchWindow key={`r${x}`} position={[x, 3.6, 6.06]} axis="z" />
      ))}
      {[-4.5, 0, 4.5].map((x) => (
        <ArchWindow key={`l${x}`} position={[x, 3.6, -6.06]} axis="z" />
      ))}
      {/* front windows flanking the door */}
      <ArchWindow position={[9.06, 3.6, 3.2]} axis="x" />
      <ArchWindow position={[9.06, 3.6, -3.2]} axis="x" />

      {/* grass lawn the chapel sits on (set back from the street, like the photos) */}
      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[21, 16]} />
        <meshStandardMaterial color="#4c6a3a" roughness={1} />
      </mesh>
      {/* flagpole + flag on the side lawn */}
      <group position={[4, 0, 7]}>
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 7, 6]} />
          <meshStandardMaterial color="#d8d8d0" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0.9, 6.2, 0]} castShadow>
          <boxGeometry args={[1.8, 1.0, 0.04]} />
          <meshStandardMaterial color="#b22234" roughness={0.7} />
        </mesh>
      </group>

      {/* brick walkway from the street up to the steps */}
      <mesh position={[13.8, 0.07, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[7.5, 2.6]} />
        <meshStandardMaterial color="#8a5a44" roughness={0.95} />
      </mesh>
      {/* foundation shrubs flanking the front */}
      {[[-1, 4.6], [-1, -4.6], [3.5, 5.6], [3.5, -5.6]].map(([x, z], i) => (
        <mesh key={`shrub${i}`} position={[x, 0.6, z]} castShadow>
          <icosahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#3f6630" roughness={1} flatShading />
        </mesh>
      ))}

      {/* name board over the door */}
      <Text
        position={[10.2, 5.4, 0]}
        rotation-y={Math.PI / 2}
        fontSize={0.46}
        color="#2a2118"
        anchorX="center"
        anchorY="middle"
        maxWidth={6}
        textAlign="center"
      >
        SEAMEN'S BETHEL
      </Text>
    </RigidBody>
  );
}

// A tall arched window: warm-glowing glass with a half-round top.
function ArchWindow({
  position,
  axis,
}: {
  position: [number, number, number];
  axis: "x" | "z";
}) {
  const ry = axis === "x" ? Math.PI / 2 : 0;
  return (
    <group position={position} rotation-y={ry}>
      <mesh>
        <boxGeometry args={[1.2, 2.6, 0.12]} />
        <meshStandardMaterial
          color={GLASS}
          emissive={GLASS}
          emissiveIntensity={0.4}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 1.3, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.6, 0.6, 0.12, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color={GLASS}
          emissive={GLASS}
          emissiveIntensity={0.4}
          roughness={0.3}
        />
      </mesh>
      {/* simple white frame */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[1.5, 3.0, 0.08]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>
    </group>
  );
}
