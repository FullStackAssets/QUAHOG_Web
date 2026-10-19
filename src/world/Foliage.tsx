import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleRoadEdges } from "./roadSamples";
import type { Road } from "../slice";

// Low greenery (§ streets pass): frontage bushes + curb grass tufts along the
// road edges near the core, instanced with per-instance green variety. Sits
// under the <Props> street trees to fill the ground plane with life.

const RADIUS = 250;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

type P = { x: number; z: number; rot: number; sc: number };
const GREENS = ["#3a6630", "#46763a", "#2f5a2c", "#548040", "#356a34", "#608a46",
  "#2a5226", "#5a8a42", "#3f6e38", "#4a7a30"];

function place(mesh: THREE.InstancedMesh | null, ps: P[], y: number) {
  if (!mesh) return;
  for (let i = 0; i < ps.length; i++) {
    _q.setFromAxisAngle(_up, ps[i].rot);
    _m.compose(_p.set(ps[i].x, y * ps[i].sc, ps[i].z), _q, _s.setScalar(ps[i].sc));
    mesh.setMatrixAt(i, _m);
    mesh.setColorAt(i, _c.set(GREENS[(i * 2654435761) % GREENS.length]));
  }
  mesh.count = ps.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function Foliage({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const L = useMemo(() => {
    const samples = sampleRoadEdges(roads, center, { radius: RADIUS, step: 11, sparse: 1, max: 1800 });
    const bushes: P[] = [], tufts: P[] = [];
    let n = 0;
    for (const s of samples) {
      const nx = -s.dz, nz = s.dx;
      const side = (n & 1) ? 1 : -1;
      const rot = (n * 1.2) % (Math.PI * 2);
      if (n % 3 === 0) {
        const o = 7.4; // building frontage
        bushes.push({ x: s.x + nx * o * side, z: s.z + nz * o * side, rot, sc: 0.8 + ((n * 0.618) % 1) * 0.7 });
      } else if (n % 3 === 1) {
        const o = 4.2; // curb edge
        tufts.push({ x: s.x + nx * o * side, z: s.z + nz * o * side, rot, sc: 0.7 + ((n * 0.382) % 1) * 0.6 });
      }
      n++;
    }
    return { bushes, tufts };
  }, [roads, center]);

  const bush = useRef<THREE.InstancedMesh>(null);
  const tuft = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    place(bush.current, L.bushes, 0.6);
    place(tuft.current, L.tufts, 0.3);
  }, [L]);

  return (
    <group>
      <instancedMesh ref={bush} args={[undefined, undefined, Math.max(1, L.bushes.length)]} castShadow>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={tuft} args={[undefined, undefined, Math.max(1, L.tufts.length)]}>
        <coneGeometry args={[0.3, 0.5, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
