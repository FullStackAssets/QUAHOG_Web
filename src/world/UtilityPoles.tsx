import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Road } from "../slice";

// Utility poles + slung wires along the streets near the core (§7). Poles are
// instanced; wires are one merged catenary line set. Cheap period set-dressing.

const RADIUS = 260;
const MAX = 360;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);

export function UtilityPoles({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const { poles, wireGeo } = useMemo(() => {
    const poles: { x: number; z: number }[] = [];
    for (const r of roads) {
      if (r.bridge || r.points.length < 2) continue;
      if (!["primary", "secondary", "tertiary", "residential", "unclassified"].includes(r.highway)) continue;
      const off = r.width / 2 + 1.6;
      for (let i = 0; i < r.points.length - 1; i++) {
        const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
        const x1 = ax, z1 = -an, x2 = bx, z2 = -bn;
        const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
        if (len < 24) continue;
        const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
        for (let d = 10; d < len; d += 32) {
          const x = x1 + ux * d + nx * off, z = z1 + uz * d + nz * off;
          if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
          poles.push({ x, z });
          if (poles.length >= MAX) break;
        }
      }
      if (poles.length >= MAX) break;
    }
    // wires: connect consecutive nearby poles with a drooping segment
    const pos: number[] = [];
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i], b = poles[i + 1];
      const dd = Math.hypot(a.x - b.x, a.z - b.z);
      if (dd > 45) continue;
      const sag = 0.8;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      pos.push(a.x, 6.2, a.z, mx, 6.2 - sag, mz, mx, 6.2 - sag, mz, b.x, 6.2, b.z);
    }
    const wireGeo = pos.length ? new THREE.BufferGeometry() : null;
    if (wireGeo) wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return { poles, wireGeo };
  }, [roads, center]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < poles.length; i++) {
      _m.compose(_p.set(poles[i].x, 3.2, poles[i].z), _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = poles.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [poles]);

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, poles.length)]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 7, 6]} />
        <meshStandardMaterial color="#5a4632" roughness={0.95} />
      </instancedMesh>
      {/* crossarms */}
      <instancedMesh args={[undefined, undefined, Math.max(1, poles.length)]} ref={(m) => {
        if (!m) return;
        for (let i = 0; i < poles.length; i++) { _m.compose(_p.set(poles[i].x, 6, poles[i].z), _q, _s); m.setMatrixAt(i, _m); }
        m.count = poles.length; m.instanceMatrix.needsUpdate = true;
      }}>
        <boxGeometry args={[1.6, 0.12, 0.12]} />
        <meshStandardMaterial color="#4a3826" roughness={0.95} />
      </instancedMesh>
      {wireGeo && (
        <lineSegments geometry={wireGeo}>
          <lineBasicMaterial color="#15151a" transparent opacity={0.6} />
        </lineSegments>
      )}
    </group>
  );
}
