import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeZebra } from "./textures";
import type { Road } from "../slice";

// Painted crosswalks at intersections (Phase 2). Junctions are road points where
// 3+ drivable ends meet; each gets a flat zebra patch. Instanced + capped near
// the core. Approximate orientation — reads right in motion.

const RADIUS = 320;
const MAX = 240;
const DRIVABLE = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street"]);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export function Crosswalks({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const tex = useMemo(() => makeZebra(), []);
  const spots = useMemo(() => {
    // count road-ends per rounded point to find junctions, keeping the
    // direction and width of one incident road so each patch can align to
    // the carriageway it crosses (playtest 2026-11-02, E-05: the old fixed
    // 13×13 m squares alternated orientation by index and spilled onto
    // sidewalks, covering parts of several roads at once).
    const deg = new Map<string, { x: number; z: number; n: number; ux: number; uz: number; w: number }>();
    const add = (e: number, n: number, ux: number, uz: number, w: number) => {
      const key = `${Math.round(e / 4)}_${Math.round(n / 4)}`;
      const d = deg.get(key) ?? { x: e, z: -n, n: 0, ux, uz, w };
      d.n++; deg.set(key, d);
    };
    for (const r of roads) {
      if (r.bridge || !DRIVABLE.has(r.highway) || r.points.length < 2) continue;
      const [ax, an] = r.points[0], [bx, bn] = r.points[1];
      const [cx, cn] = r.points[r.points.length - 2], [dx, dn] = r.points[r.points.length - 1];
      const d1 = Math.hypot(bx - ax, bn - an) || 1, d2 = Math.hypot(dx - cx, dn - cn) || 1;
      add(r.points[0][0], r.points[0][1], (bx - ax) / d1, -(bn - an) / d1, r.width);
      add(r.points[r.points.length - 1][0], r.points[r.points.length - 1][1], (dx - cx) / d2, -(dn - cn) / d2, r.width);
    }
    const out: { x: number; z: number; rot: number; w: number }[] = [];
    for (const d of deg.values()) {
      if (d.n < 3) continue;
      if (Math.hypot(d.x - center[0], d.z - center[1]) > RADIUS) continue;
      out.push({ x: d.x, z: d.z, rot: Math.atan2(d.ux, d.uz), w: d.w });
      if (out.length >= MAX) break;
    }
    return out;
  }, [roads, center]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const flatQ = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < spots.length; i++) {
      // yaw to the road direction, then lay flat; size spans the
      // carriageway width across and 5 m along the road (was a fixed
      // 13×13 m square at an arbitrary alternating angle).
      _q.setFromAxisAngle(_p.set(0, 1, 0), spots[i].rot).multiply(flatQ);
      _s.set(Math.max(6, spots[i].w) / 13, 5 / 13, 1);
      _m.compose(_p.set(spots[i].x, 0.085, spots[i].z), _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots, flatQ]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, spots.length)]}>
      <planeGeometry args={[13, 13]} />
      <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={0.9} polygonOffset polygonOffsetFactor={-4} />
    </instancedMesh>
  );
}
