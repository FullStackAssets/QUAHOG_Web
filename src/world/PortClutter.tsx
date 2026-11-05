import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Road } from "../slice";

// Working-port cargo on the wharf (§ waterfront pass): stacked shipping
// containers, crates and barrels along the LAND side of the harbour edge near
// the core. Instanced + capped; containers get per-instance colour.

const RADIUS = 360;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _c = new THREE.Color();
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

const CONTAINER_COLORS = ["#9c3b2f", "#2f5a7a", "#3a6a45", "#8a8f96", "#b5862b", "#6a4a8c",
  "#7a2f25", "#274a66", "#2f5a38", "#6a6e72", "#9c7424", "#3a4a8c"];

export function PortClutter({ polys, center }: { polys: [number, number][][]; center: [number, number] }) {
  const L = useMemo(() => {
    const containers: P[] = [], crates: P[] = [], barrels: P[] = [];
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
        const nx = -uz, nz = ux;
        for (let d = 0; d < len; d += 20) {
          const ex = ax + ux * d, ez = az + uz * d;
          if (Math.hypot(ex - center[0], ez - center[1]) > RADIUS) continue;
          // land side = the side NOT inside the water ring
          const probeE = ex + nx * 8, probeN = -(ez + nz * 8);
          const land = inRing(probeE, probeN, ring) ? -1 : 1;
          const off = 9;
          const x = ex + nx * off * land, z = ez + nz * off * land;
          const rot = Math.atan2(ux, uz) + (((n * 0.618) % 1) - 0.5) * 0.3;
          n++;
          const kind = n % 4;
          if (kind === 0 || kind === 1) containers.push({ x, z, rot });
          else if (kind === 2) crates.push({ x, z, rot });
          else barrels.push({ x: x + nx * land * 2, z: z + nz * land * 2, rot });
          if (containers.length > 300) break;
        }
        if (containers.length > 300) break;
      }
      if (containers.length > 300) break;
    }
    return { containers, crates, barrels };
  }, [polys, center]);

  const container = useRef<THREE.InstancedMesh>(null);
  const crate = useRef<THREE.InstancedMesh>(null);
  const barrel = useRef<THREE.InstancedMesh>(null);

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
    fill(container.current, L.containers, 1.3);
    fill(crate.current, L.crates, 0.6);
    fill(barrel.current, L.barrels, 0.55);
    if (container.current) {
      for (let i = 0; i < L.containers.length; i++)
        container.current.setColorAt(i, _c.set(CONTAINER_COLORS[(i * 2654435761) % CONTAINER_COLORS.length]));
      if (container.current.instanceColor) container.current.instanceColor.needsUpdate = true;
    }
  }, [L]);

  return (
    <group>
      <instancedMesh ref={container} args={[undefined, undefined, Math.max(1, L.containers.length)]} castShadow>
        <boxGeometry args={[6, 2.6, 2.5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.75} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={crate} args={[undefined, undefined, Math.max(1, L.crates.length)]} castShadow>
        <boxGeometry args={[1.2, 1.1, 1.2]} />
        <meshStandardMaterial color="#6a4a2c" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={barrel} args={[undefined, undefined, Math.max(1, L.barrels.length)]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 1.1, 10]} />
        <meshStandardMaterial color="#3a4a3a" roughness={0.7} metalness={0.3} />
      </instancedMesh>
    </group>
  );
}
