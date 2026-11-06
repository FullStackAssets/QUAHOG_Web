import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { shared } from "../shared";

// Recognizable low-poly road cars built from primitives. Silhouettes are tuned
// per model (ride height, hood/cabin proportions) so a Bronco reads boxy/tall, a
// Mustang long-hood/low, the Z a wedge, etc. Bodies are rounded (not raw boxes)
// and paint is reflective (metalness + IBL) for a more realistic read.

export type VehicleType = "bronco" | "mustang" | "infiniti" | "nissanz" | "rav4";
export const VEHICLE_TYPES: VehicleType[] = ["bronco", "mustang", "infiniti", "nissanz", "rav4"];

interface Spec {
  L: number; W: number; H: number; y: number; // body box + center height
  cabL: number; cabH: number; cabZ: number; cabW?: number; // greenhouse
  ride: number; wheelR: number; // axle height + wheel radius
  glass: string; hood?: number; // optional long-hood block length
}

const _wp = new THREE.Vector3();

const SPECS: Record<VehicleType, Spec> = {
  bronco:   { L: 4.3, W: 2.0, H: 1.3, y: 1.15, cabL: 2.4, cabH: 0.9, cabZ: -0.2, ride: 0.55, wheelR: 0.52, glass: "#20303a" },
  mustang:  { L: 4.7, W: 1.95, H: 0.8, y: 0.78, cabL: 1.7, cabH: 0.62, cabZ: -0.7, ride: 0.34, wheelR: 0.46, glass: "#141a1f", hood: 1.6 },
  infiniti: { L: 4.7, W: 1.85, H: 0.85, y: 0.82, cabL: 2.1, cabH: 0.66, cabZ: -0.1, ride: 0.34, wheelR: 0.44, glass: "#1a2128" },
  nissanz:  { L: 4.4, W: 1.85, H: 0.72, y: 0.7, cabL: 1.4, cabH: 0.55, cabZ: -0.6, ride: 0.3, wheelR: 0.45, glass: "#0f1418", hood: 1.7 },
  rav4:     { L: 4.4, W: 1.9, H: 1.15, y: 1.0, cabL: 2.2, cabH: 0.82, cabZ: -0.15, ride: 0.48, wheelR: 0.48, glass: "#212a30" },
};

export function Vehicle({ type, color, brake }: { type: VehicleType; color: string; brake?: () => boolean }) {
  const s = SPECS[type];
  const halfL = s.L / 2;
  const wheelZ = halfL - 0.95;
  const wheelX = s.W / 2 - 0.05;
  const cabW = s.cabW ?? s.W - 0.25;
  const head = useRef<THREE.MeshStandardMaterial>(null);
  const tail = useRef<THREE.MeshStandardMaterial>(null);
  const root = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const prev = useRef<THREE.Vector3 | null>(null);

  // headlights/taillights come up at dusk; taillights flare under braking; and
  // wheels roll by self-measured world speed (works for any vehicle).
  useFrame(() => {
    const night = 1 - shared.dayT;
    if (head.current) head.current.emissiveIntensity = 0.3 + night * 1.6;
    if (tail.current) tail.current.emissiveIntensity = 0.3 + night * 0.9 + (brake?.() ? 2.2 : 0);
    if (root.current) {
      root.current.getWorldPosition(_wp);
      if (prev.current) {
        const roll = prev.current.distanceTo(_wp) / s.wheelR;
        if (roll > 1e-4) for (const w of wheels.current) if (w) w.rotation.x += roll;
        prev.current.copy(_wp);
      } else prev.current = _wp.clone();
    }
  });

  return (
    <group ref={root} position={[0, s.ride - s.wheelR, 0]}>
      {/* body — rounded shell, reflective automotive paint */}
      <RoundedBox args={[s.W, s.H, s.L]} radius={Math.min(0.16, s.H * 0.35)} smoothness={3} position={[0, s.y, 0]} castShadow>
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} envMapIntensity={1.2} />
      </RoundedBox>
      {/* long hood accent for sports cars */}
      {s.hood && (
        <mesh position={[0, s.y + s.H / 2 - 0.04, halfL - s.hood / 2 - 0.1]} castShadow>
          <boxGeometry args={[s.W - 0.2, 0.1, s.hood]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} envMapIntensity={1.2} />
        </mesh>
      )}
      {/* greenhouse / cabin glass — rounded, dark, glossy */}
      <RoundedBox args={[cabW, s.cabH, s.cabL]} radius={0.1} smoothness={3} position={[0, s.y + s.H / 2 + s.cabH / 2 - 0.02, s.cabZ]} castShadow>
        <meshStandardMaterial color={s.glass} metalness={0.35} roughness={0.12} envMapIntensity={1.6} />
      </RoundedBox>
      {/* roof cap (body color) */}
      <mesh position={[0, s.y + s.H / 2 + s.cabH - 0.04, s.cabZ]}>
        <boxGeometry args={[cabW + 0.02, 0.08, s.cabL]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.34} envMapIntensity={1.2} />
      </mesh>
      {/* belt line trim along each flank (subtle chrome) */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (s.W / 2 - 0.01), s.y + s.H / 2 - 0.04, s.cabZ * 0.3]}>
          <boxGeometry args={[0.03, 0.05, s.L * 0.78]} />
          <meshStandardMaterial color="#cdd2d8" metalness={0.9} roughness={0.25} envMapIntensity={1.5} />
        </mesh>
      ))}
      {/* bumpers (front + rear) */}
      {[halfL - 0.02, -halfL + 0.02].map((bz, i) => (
        <mesh key={i} position={[0, s.y - s.H / 2 + 0.18, bz]} castShadow>
          <boxGeometry args={[s.W - 0.06, 0.26, 0.18]} />
          <meshStandardMaterial color="#2a2d31" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      {/* side mirrors */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (cabW / 2 + 0.12), s.y + s.H / 2 + s.cabH * 0.3, s.cabZ + s.cabL / 2 - 0.1]} castShadow>
          <boxGeometry args={[0.18, 0.1, 0.08]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {/* headlights */}
      <mesh position={[0, s.y, halfL + 0.01]}>
        <boxGeometry args={[s.W - 0.3, 0.18, 0.05]} />
        <meshStandardMaterial ref={head} color="#fdf6d0" emissive="#fde9a0" emissiveIntensity={0.5} />
      </mesh>
      {/* taillights */}
      <mesh position={[0, s.y, -halfL - 0.01]}>
        <boxGeometry args={[s.W - 0.3, 0.16, 0.05]} />
        <meshStandardMaterial ref={tail} color="#7a1010" emissive="#c01818" emissiveIntensity={0.5} />
      </mesh>
      {/* wheels — tire + lighter alloy hub */}
      {[
        [-wheelX, 0, wheelZ], [wheelX, 0, wheelZ],
        [-wheelX, 0, -wheelZ], [wheelX, 0, -wheelZ],
      ].map((p, i) => (
        <group key={i} ref={(el) => (wheels.current[i] = el)} position={[p[0], s.wheelR, p[2]]}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[s.wheelR, s.wheelR, 0.32, 18]} />
            <meshStandardMaterial color="#0d0d0f" roughness={0.92} />
          </mesh>
          {/* hub / rim on the outboard face */}
          <mesh position={[p[0] < 0 ? -0.17 : 0.17, 0, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[s.wheelR * 0.55, s.wheelR * 0.55, 0.03, 12]} />
            <meshStandardMaterial color="#b9bdc4" metalness={0.85} roughness={0.3} envMapIntensity={1.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
