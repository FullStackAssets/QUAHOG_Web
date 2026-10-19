import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleRoadEdges } from "./roadSamples";
import type { Road } from "../slice";

// Chain-link fence panels along service / back-lot frontages near the core
// (industrial yards, parking lots). Approximated as thin translucent grey panels
// on posts — instanced and limited to service/unclassified roads so most streets
// keep their building frontage.

const RADIUS = 240;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

type P = { x: number; z: number; rot: number };

function fill(mesh: THREE.InstancedMesh | null, ps: P[], y: number) {
  if (!mesh) return;
  for (let i = 0; i < ps.length; i++) {
    _q.setFromAxisAngle(_up, ps[i].rot);
    _m.compose(_p.set(ps[i].x, y, ps[i].z), _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.count = ps.length;
  mesh.instanceMatrix.needsUpdate = true;
}

export function Fences({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const L = useMemo(() => {
    const samples = sampleRoadEdges(roads, center, {
      radius: RADIUS, step: 4, sparse: 1, max: 1500, highways: ["service", "unclassified"],
    });
    const panels: P[] = [], posts: P[] = [];
    let n = 0;
    for (const s of samples) {
      const nx = -s.dz, nz = s.dx;
      const side = (n & 1) ? 1 : -1;
      const o = 6.5;
      const x = s.x + nx * o * side, z = s.z + nz * o * side;
      const rot = Math.atan2(s.dx, s.dz);
      panels.push({ x, z, rot });
      if (n % 2 === 0) posts.push({ x, z, rot });
      n++;
    }
    return { panels, posts };
  }, [roads, center]);

  const panel = useRef<THREE.InstancedMesh>(null);
  const post = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    fill(panel.current, L.panels, 0.95);
    fill(post.current, L.posts, 1.0);
  }, [L]);

  return (
    <group>
      {/* mesh panel (translucent grey) — one per ~4 m of run */}
      <instancedMesh ref={panel} args={[undefined, undefined, Math.max(1, L.panels.length)]}>
        <boxGeometry args={[4, 1.8, 0.03]} />
        <meshStandardMaterial color="#9fa3a8" roughness={0.6} metalness={0.5} transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
      {/* posts */}
      <instancedMesh ref={post} args={[undefined, undefined, Math.max(1, L.posts.length)]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.0, 6]} />
        <meshStandardMaterial color="#73767c" roughness={0.6} metalness={0.6} />
      </instancedMesh>
    </group>
  );
}
