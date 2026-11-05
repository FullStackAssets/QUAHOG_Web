import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Road } from "../slice";

// Rt 18 programme (2026-11-02): sparse high-mast lighting for the freeway,
// replacing the curbside lamp posts the dressing exclusion removed from the
// corridor. A freeway does not get a lamp every 22 m at the curb — it gets
// tall masts, far apart, outside the carriageway. Mounted inside
// <CullByDistance> next to <Props>; visual only (no collider — street
// furniture is drivable-through under the new rule, and a 12 m mast has no
// car-scale collision box worth keeping).

const RADIUS = 240;
const STEP = 80; // metres between masts along the freeway
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

type Mast = { x: number; z: number; rot: number };

export function buildHighMastPositions(roads: Road[], center: [number, number]): Mast[] {
  const out: Mast[] = [];
  let n = 0;
  for (const r of roads) {
    if (r.highway !== "motorway" || r.points.length < 2) continue;
    const off = r.width / 2 + 2.5; // on the shoulder, outside the edge line
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
      const x1 = ax, z1 = -an, x2 = bx, z2 = -bn;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
      for (let d = 10; d < len; d += STEP) {
        const side = (n & 1) ? 1 : -1;
        const x = x1 + ux * d + nx * off * side;
        const z = z1 + uz * d + nz * off * side;
        if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
        out.push({ x, z, rot: Math.atan2(nx * side, nz * side) });
        n++;
      }
    }
  }
  return out;
}

function fill(mesh: THREE.InstancedMesh | null, masts: Mast[], y: number) {
  if (!mesh) return;
  for (let i = 0; i < masts.length; i++) {
    _q.setFromAxisAngle(_p.set(0, 1, 0), masts[i].rot);
    _m.compose(_p.set(masts[i].x, y, masts[i].z), _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = masts.length;
}

export function HighMasts({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const masts = useMemo(() => buildHighMastPositions(roads, center), [roads, center]);
  const poles = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    fill(poles.current, masts, 6);
    fill(heads.current, masts, 12.2);
  }, [masts]);
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, Math.max(1, masts.length)]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 12, 8]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.7} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, Math.max(1, masts.length)]}>
        <boxGeometry args={[1.4, 0.3, 0.6]} />
        <meshStandardMaterial color="#fff3cf" emissive="#ffcf7a" emissiveIntensity={0.4} />
      </instancedMesh>
    </group>
  );
}
