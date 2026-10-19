import { useMemo } from "react";
import { Text } from "@react-three/drei";
import type { Road } from "../slice";

// Real street-name signs (§33): green MUTCD-style blades on poles at named-road
// endpoints near the core. One sign per unique name, capped for performance.

const RADIUS = 290;
const MAX_SIGNS = 90;

interface Sign { x: number; z: number; rot: number; name: string }

function buildSigns(roads: Road[], center: [number, number]): Sign[] {
  const out: Sign[] = [];
  const seen = new Set<string>();
  for (const r of roads) {
    if (!r.name || seen.has(r.name) || r.points.length < 2) continue;
    // anchor near the start of the road
    const [ax, an] = r.points[0];
    const [bx, bn] = r.points[1];
    // world: x=east, z=-north
    const x0 = ax, z0 = -an;
    const dxw = bx - ax, dzw = -(bn - an);
    const len = Math.hypot(dxw, dzw);
    if (len < 1e-3) continue;
    const ux = dxw / len, uz = dzw / len; // unit travel direction (world)
    // push the post to the right-hand curb (perpendicular) AND a few metres in
    // along the road so it lands on the corner, never in the middle of the street.
    const off = r.width / 2 + 0.7;
    const x = x0 + ux * 3 + uz * off; // right normal = (uz, -ux)
    const z = z0 + uz * 3 - ux * off;
    if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
    seen.add(r.name);
    // align the blade's local +X with the road direction
    const rot = Math.atan2(bn - an, bx - ax);
    out.push({ x, z, rot, name: r.name });
    if (out.length >= MAX_SIGNS) break;
  }
  return out;
}

export function StreetSigns({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const signs = useMemo(() => buildSigns(roads, center), [roads, center]);

  return (
    <group>
      {signs.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rot}>
          {/* pole */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 3, 6]} />
            <meshStandardMaterial color="#3a3f47" roughness={0.7} metalness={0.5} />
          </mesh>
          {/* green blade */}
          <mesh position={[0, 3.05, 0]} castShadow>
            <boxGeometry args={[2.6, 0.42, 0.06]} />
            <meshStandardMaterial color="#13632f" roughness={0.6} />
          </mesh>
          {/* name, both faces */}
          <Text position={[0, 3.05, 0.05]} fontSize={0.26} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={2.4}>
            {s.name.toUpperCase()}
          </Text>
          <Text position={[0, 3.05, -0.05]} rotation-y={Math.PI} fontSize={0.26} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={2.4}>
            {s.name.toUpperCase()}
          </Text>
        </group>
      ))}
    </group>
  );
}
