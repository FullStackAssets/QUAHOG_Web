import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeGrime } from "./textures";
import { sampleRoadEdges } from "./roadSamples";
import type { Road } from "../slice";

// Ground grime: oil stains + worn patches scattered on the streets near the core
// (Phase 2 weathering). Instanced flat quads just above the asphalt.

const RADIUS = 260;
const MAX = 400;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function Decals({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const tex = useMemo(() => makeGrime(), []);
  const spots = useMemo(() =>
    sampleRoadEdges(roads, center, { radius: RADIUS, step: 20, sparse: 3, max: MAX }).map((s) => ({
      x: s.x + (Math.random() - 0.5) * 2,
      z: s.z + (Math.random() - 0.5) * 2,
      r: 1.4 + Math.random() * 2.6,
      rot: Math.random() * Math.PI,
    })), [roads, center]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < spots.length; i++) {
      _e.set(-Math.PI / 2, spots[i].rot, 0);
      _q.setFromEuler(_e);
      _m.compose(_p.set(spots[i].x, 0.075, spots[i].z), _q, _s.setScalar(spots[i].r));
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, spots.length)]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-1} />
    </instancedMesh>
  );
}
