import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import type { Road } from "../slice";

// Decorative period traffic signals (§7/§33): mast-arm signal heads at a handful
// of major-road points near the core, cycling red→green→amber on a timer.

const RADIUS = 210;
const MAX = 24;
const MAJOR = new Set(["primary", "secondary", "tertiary"]);

export function TrafficLights({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const spots = useMemo(() => {
    const out: { x: number; z: number; rot: number; phase: number }[] = [];
    let n = 0;
    for (const r of roads) {
      if (!MAJOR.has(r.highway) || r.points.length < 2) continue;
      const [ax, an] = r.points[0];
      const [bx, bn] = r.points[1];
      const x = ax, z = -an;
      if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
      // world-space road bearing: world z = -northing, so dz = -(bn-an) = an-bn.
      // (must match the car heading atan2(dir.x, dir.z) that redAhead compares to)
      out.push({ x, z, rot: Math.atan2(bx - ax, an - bn), phase: (n % 3) * 2.6 });
      if (++n >= MAX) break;
    }
    return out;
  }, [roads, center]);

  const reds = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const ambers = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const greens = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  // publish stop-lines so traffic can halt at red (§7/§14)
  useEffect(() => {
    shared.stopZones = spots.map((s) => ({ x: s.x, z: s.z, rot: s.rot, red: false }));
    return () => { shared.stopZones = []; };
  }, [spots]);

  useFrame(({ clock }) => {
    spots.forEach((s, i) => {
      const p = (clock.elapsedTime + s.phase) % 7.8; // 4s red, 3s green, 0.8 amber
      const red = p < 4, green = p >= 4 && p < 7, amber = p >= 7;
      if (reds.current[i]) reds.current[i]!.emissiveIntensity = red ? 3 : 0.05;
      if (greens.current[i]) greens.current[i]!.emissiveIntensity = green ? 3 : 0.05;
      if (ambers.current[i]) ambers.current[i]!.emissiveIntensity = amber ? 3 : 0.05;
      // amber counts as "stop if you can" → treat as red for the AI hold
      const z = shared.stopZones[i];
      if (z) z.red = red || amber;
    });
  });

  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rot}>
          <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 5, 6]} />
            <meshStandardMaterial color="#2a2e35" metalness={0.5} roughness={0.6} />
          </mesh>
          <mesh position={[0, 4.8, 0]}>
            <boxGeometry args={[0.34, 1.05, 0.3]} />
            <meshStandardMaterial color="#15181d" />
          </mesh>
          <mesh position={[0, 5.15, 0.17]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial ref={(m) => (reds.current[i] = m)} color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={0.05} /></mesh>
          <mesh position={[0, 4.8, 0.17]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial ref={(m) => (ambers.current[i] = m)} color="#ffb020" emissive="#ffb020" emissiveIntensity={0.05} /></mesh>
          <mesh position={[0, 4.45, 0.17]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial ref={(m) => (greens.current[i] = m)} color="#28d24a" emissive="#28d24a" emissiveIntensity={0.05} /></mesh>
        </group>
      ))}
    </group>
  );
}
