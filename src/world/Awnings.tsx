import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Road } from "../slice";

// Storefront awnings (Phase 2 street-level). Striped canvas awnings hung along
// commercial frontages near the core — instanced, two-tone, angled out over the
// "sidewalk". Cheap way to make streets read as shops, not blank walls.

const RADIUS = 260;
const MAX = 360;
const COMMERCIAL = new Set(["primary", "secondary", "tertiary", "unclassified", "living_street"]);
const COLORS = ["#9c2b2b", "#1f5e3a", "#21456e", "#7a4a8c", "#b5862b", "#2a6f6f",
  "#8a3a1f", "#3a5a8c", "#6a2a4a", "#2a6a3a", "#a8902b", "#444a55"];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _c = new THREE.Color();

export function Awnings({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const places = useMemo(() => {
    const out: { x: number; z: number; rot: number; c: number }[] = [];
    let n = 0;
    for (const r of roads) {
      if (r.bridge || !COMMERCIAL.has(r.highway) || r.points.length < 2) continue;
      const off = r.width / 2 + 1.2;
      for (let i = 0; i < r.points.length - 1; i++) {
        const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
        const x1 = ax, z1 = -an, x2 = bx, z2 = -bn;
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 10) continue;
        const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
        for (let d = 6; d < len; d += 12) {
          const side = (n & 1) ? 1 : -1;
          const x = x1 + ux * d + nx * off * side;
          const z = z1 + uz * d + nz * off * side;
          if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
          out.push({ x, z, rot: Math.atan2(nx * side, nz * side), c: n });
          if (out.length >= MAX) return out;
          n++;
        }
      }
    }
    return out;
  }, [roads, center]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < places.length; i++) {
      _e.set(-0.5, places[i].rot, 0); // tilt the awning down/out
      _q.setFromEuler(_e);
      _s.set(0.82 + ((i * 0.6180339887) % 1) * 0.5, 1, 0.85 + ((i * 0.382) % 1) * 0.4); // width/depth variety
      _m.compose(_p.set(places[i].x, 3, places[i].z), _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(COLORS[places[i].c % COLORS.length]));
    }
    mesh.count = places.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [places]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, places.length)]} castShadow>
      <boxGeometry args={[3, 0.12, 1.6]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}
