import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Road } from "../slice";

// Waterfront dressing (§ waterfront pass): weathered timber pilings along the
// harbour shoreline and a scatter of mooring buoys on the water just inside the
// edge. Both instanced, capped, and limited to the shoreline near the core.

const RADIUS = 380;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

type P = { x: number; z: number; rot: number };

function inRing(e: number, n: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
    if ((ni > n) !== (nj > n) && e < ((xj - xi) * (n - ni)) / (nj - ni) + xi) inside = !inside;
  }
  return inside;
}

export function Waterfront({ polys, center }: { polys: [number, number][][]; center: [number, number] }) {
  const L = useMemo(() => {
    const pilings: P[] = [], buoys: P[] = [];
    let n = 0;
    for (const ring of polys) {
      if (ring.length < 3) continue;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const ax = a[0], az = -a[1], bx = b[0], bz = -b[1];
        const dx = bx - ax, dz = bz - az;
        const len = Math.hypot(dx, dz);
        if (len < 1e-3) continue;
        const ux = dx / len, uz = dz / len;
        const nx = -uz, nz = ux; // perpendicular
        for (let d = 0; d < len; d += 7) {
          const x = ax + ux * d, z = az + uz * d;
          if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
          n++;
          if (n % 2 === 0) pilings.push({ x, z, rot: Math.atan2(nx, nz) });
          // a mooring buoy a few metres into the water (whichever side is inside)
          if (n % 11 === 0) {
            const e1 = x + nx * 6, n1 = -(z + nz * 6);
            const into = inRing(e1, n1, ring) ? 1 : -1;
            buoys.push({ x: x + nx * 6 * into, z: z + nz * 6 * into, rot: 0 });
          }
          if (pilings.length > 900) break;
        }
        if (pilings.length > 900) break;
      }
      if (pilings.length > 900) break;
    }
    return { pilings, buoys };
  }, [polys, center]);

  const piling = useRef<THREE.InstancedMesh>(null);
  const buoy = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const fill = (mesh: THREE.InstancedMesh | null, ps: P[], y: number) => {
      if (!mesh) return;
      for (let i = 0; i < ps.length; i++) {
        _q.setFromAxisAngle(_up, ps[i].rot);
        _m.compose(_p.set(ps[i].x, y, ps[i].z), _q, _s);
        mesh.setMatrixAt(i, _m);
      }
      mesh.count = ps.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    fill(piling.current, L.pilings, 0.9);
    fill(buoy.current, L.buoys, 0.6);
  }, [L]);

  return (
    <group>
      <instancedMesh ref={piling} args={[undefined, undefined, Math.max(1, L.pilings.length)]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 2.4, 6]} />
        <meshStandardMaterial color="#43352a" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={buoy} args={[undefined, undefined, Math.max(1, L.buoys.length)]}>
        <sphereGeometry args={[0.45, 8, 6]} />
        <meshStandardMaterial color="#c2402f" roughness={0.5} emissive="#3a0d08" emissiveIntensity={0.2} />
      </instancedMesh>
    </group>
  );
}
