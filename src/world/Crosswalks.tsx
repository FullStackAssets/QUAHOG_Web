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
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export function Crosswalks({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const tex = useMemo(() => makeZebra(), []);
  const spots = useMemo(() => {
    // count road-ends per rounded point to find junctions
    const deg = new Map<string, { x: number; z: number; n: number }>();
    const add = (e: number, n: number) => {
      const key = `${Math.round(e / 4)}_${Math.round(n / 4)}`;
      const d = deg.get(key) ?? { x: e, z: -n, n: 0 };
      d.n++; deg.set(key, d);
    };
    for (const r of roads) {
      if (r.bridge || !DRIVABLE.has(r.highway) || r.points.length < 2) continue;
      add(r.points[0][0], r.points[0][1]);
      add(r.points[r.points.length - 1][0], r.points[r.points.length - 1][1]);
    }
    const out: { x: number; z: number }[] = [];
    for (const d of deg.values()) {
      if (d.n < 3) continue;
      if (Math.hypot(d.x - center[0], d.z - center[1]) > RADIUS) continue;
      out.push({ x: d.x, z: d.z });
      if (out.length >= MAX) break;
    }
    return out;
  }, [roads, center]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < spots.length; i++) {
      _e.set(-Math.PI / 2, (i % 2) * Math.PI / 2, 0); // lie flat, alternate orientation
      _q.setFromEuler(_e);
      _s.set(0.85 + ((i * 0.618) % 1) * 0.4, 0.85 + ((i * 0.382) % 1) * 0.4, 1); // size variety per junction
      _m.compose(_p.set(spots[i].x, 0.085, spots[i].z), _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, spots.length)]}>
      <planeGeometry args={[13, 13]} />
      <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
    </instancedMesh>
  );
}
