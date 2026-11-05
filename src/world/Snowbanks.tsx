import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import type { Road } from "../slice";
import { PackGLB } from "../actors/PackGLB";

// Decorative roadside drifts for the February 2026 blizzard.
// Kept off the carriageway: no new hard colliders or impossible mission routes.
// Mount job (2026-11-03): the first 24 roadside banks render as real P007
// snow models (natural size, ground origin) instead of instanced spheres;
// the rest keep the one-draw-call instanced mesh. Mission dressing below is
// visual only — no colliders — so it can never block a mission step.

const ROAD_TYPES = new Set(["residential", "tertiary", "secondary", "unclassified", "living_street"]);
const MAX_BANKS = 210;
const CORE_E = -266, CORE_N = -100;
const CORE_RADIUS = 1150;
const HERO_BANKS = 24;

interface Bank { x: number; z: number; yaw: number; h: number; size: number }

function makeBanks(roads: Road[]): Bank[] {
  const out: Bank[] = [];
  for (const road of roads) {
    if (!ROAD_TYPES.has(road.highway)) continue;
    for (let i = 0; i + 1 < road.points.length && out.length < MAX_BANKS; i++) {
      const [ax, an] = road.points[i];
      const [bx, bn] = road.points[i + 1];
      const dx = bx - ax, dz = -(bn - an);
      const len = Math.hypot(dx, dz);
      if (len < 16) continue;
      const x = (ax + bx) / 2, z = -(an + bn) / 2;
      if (Math.hypot(x - CORE_E, -z - CORE_N) > CORE_RADIUS) continue;
      const side = ((i + Math.floor(Math.abs(x))) % 2) ? 1 : -1;
      const nx = -dz / len, nz = dx / len;
      const offset = Math.max(4, road.width / 2 + 2.4);
      const h = 0.55 + (out.length % 8) / 7 * 0.77; // tallest: 1.32 m = 52 in
      out.push({ x: x + nx * offset * side, z: z + nz * offset * side,
        yaw: -Math.atan2(dz, dx), h, size: 2.1 + out.length % 4 });
    }
    if (out.length >= MAX_BANKS) break;
  }
  return out;
}

// P007 snow models at natural size (all y_min 0, ground origin). The hero
// cycle rotates through the bank shapes; the roadblock kit dresses the two
// Blizzard mission areas (downtown delivery + Hurricane Barrier approach)
// so the snow mission reads as a snow emergency, not a clean road.
const HERO_BANK_MODELS = [
  "snowbank_small", "snowbank_medium", "snowbank_high",
  "plowed_berm", "sidewalk_snow_pile", "slush_pile",
];

interface Prop { path: string; x: number; y: number; z: number; rot: number }
const MISSION_PROPS: Prop[] = [
  // Blizzard downtown delivery [-560, 90]: roadblock kit on the street.
  { path: "snow_roadblock", x: -545, y: 0, z: 90, rot: 0 },
  { path: "detour_barricade", x: -575, y: 0, z: 90, rot: 0 },
  { path: "snow_traffic_cone", x: -552, y: 0, z: 98, rot: 0 },
  { path: "snow_traffic_cone", x: -568, y: 0, z: 82, rot: 0 },
  { path: "snow_emergency_sign", x: -560, y: 0, z: 105, rot: 0 },
  // Hurricane Barrier approach [860, 2000]: same kit, mirrored.
  { path: "snow_roadblock", x: 845, y: 0, z: 2000, rot: 0 },
  { path: "detour_barricade", x: 875, y: 0, z: 2000, rot: 0 },
  { path: "snow_traffic_cone", x: 852, y: 0, z: 2008, rot: 0 },
  { path: "snow_traffic_cone", x: 868, y: 0, z: 1992, rot: 0 },
  { path: "snow_emergency_sign", x: 860, y: 0, z: 2015, rot: 0 },
  // Marina dock (dock top 0.75): frozen rope + fender buoy on the dock.
  { path: "frozen_dock_rope", x: 6110, y: 0.8, z: 4511, rot: 0 },
  { path: "frozen_fender_buoy", x: 6112, y: 0.8, z: 4513, rot: 0 },
];

export function Snowbanks({ roads }: { roads: Road[] }) {
  const snowy = useGame((s) => s.weather === "snow");
  const bankData = useMemo(() => makeBanks(roads), [roads]);
  const heroBanks = bankData.slice(0, HERO_BANKS);
  const fieldBanks = bankData.slice(HERO_BANKS);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!snowy || !mesh.current) return;
    const dummy = new THREE.Object3D();
    fieldBanks.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.rotation.set(0, b.yaw, 0);
      dummy.scale.set(b.size, b.h / 2, 1.6);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [snowy, fieldBanks]);

  if (!snowy || bankData.length === 0) return null;
  return (
    <group>
      {heroBanks.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation-y={b.yaw}>
          <PackGLB path={`/packs/pack007/${HERO_BANK_MODELS[i % HERO_BANK_MODELS.length]}.glb`} />
        </group>
      ))}
      {/* Snow-covered cars abandoned at the roadside (bank positions 24-25). */}
      {bankData.slice(HERO_BANKS, HERO_BANKS + 2).map((b, i) => (
        <group key={`car${i}`} position={[b.x, 0, b.z]} rotation-y={b.yaw}>
          <PackGLB path="/packs/pack007/snowpack_car.glb" />
        </group>
      ))}
      {MISSION_PROPS.map((p, i) => (
        <group key={`m${i}`} position={[p.x, p.y, p.z]} rotation-y={p.rot}>
          <PackGLB path={`/packs/pack007/${p.path}.glb`} />
        </group>
      ))}
      <instancedMesh ref={mesh} args={[undefined, undefined, fieldBanks.length]} receiveShadow>
        <sphereGeometry args={[1, 8, 5]} />
        <meshStandardMaterial color="#e7eff5" roughness={0.98} />
      </instancedMesh>
    </group>
  );
}
