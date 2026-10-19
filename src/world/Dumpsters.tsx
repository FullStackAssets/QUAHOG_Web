import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleRoadEdges } from "./roadSamples";
import type { Road } from "../slice";

// Back-lot clutter: dumpsters + stacked wooden pallets along service/back roads.
// Instanced, capped, with per-instance colour on the dumpsters.

const RADIUS = 240;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);
const DUMP_COLORS = ["#2f4a32", "#3a4a55", "#5a3a2a", "#4a4540", "#2a3a4a", "#264028", "#4a4a3a", "#3a2f2a", "#2a4a4a"];

type P = { x: number; z: number; rot: number };

function fill(mesh: THREE.InstancedMesh | null, ps: P[], y: number, tint?: string[]) {
  if (!mesh) return;
  for (let i = 0; i < ps.length; i++) {
    _q.setFromAxisAngle(_up, ps[i].rot);
    _m.compose(_p.set(ps[i].x, y, ps[i].z), _q, _s);
    mesh.setMatrixAt(i, _m);
    if (tint) mesh.setColorAt(i, _c.set(tint[(i * 2654435761) % tint.length]));
  }
  mesh.count = ps.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (tint && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function Dumpsters({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const L = useMemo(() => {
    const samples = sampleRoadEdges(roads, center, {
      radius: RADIUS, step: 34, sparse: 1, max: 280, highways: ["service", "unclassified", "residential"],
    });
    const dumps: P[] = [], pallets: P[] = [];
    let n = 0;
    for (const s of samples) {
      const nx = -s.dz, nz = s.dx;
      const side = (n & 1) ? 1 : -1;
      const o = 6.2;
      const x = s.x + nx * o * side, z = s.z + nz * o * side;
      const rot = Math.atan2(s.dx, s.dz) + (((n * 0.618) % 1) - 0.5) * 0.3;
      if (n % 2 === 0) dumps.push({ x, z, rot });
      else pallets.push({ x, z, rot });
      n++;
    }
    return { dumps, pallets };
  }, [roads, center]);

  const dump = useRef<THREE.InstancedMesh>(null);
  const pallet = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    fill(dump.current, L.dumps, 0.7, DUMP_COLORS);
    fill(pallet.current, L.pallets, 0.18);
  }, [L]);

  return (
    <group>
      <instancedMesh ref={dump} args={[undefined, undefined, Math.max(1, L.dumps.length)]} castShadow>
        <boxGeometry args={[2.0, 1.4, 1.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={pallet} args={[undefined, undefined, Math.max(1, L.pallets.length)]} castShadow>
        <boxGeometry args={[1.2, 0.34, 1.0]} />
        <meshStandardMaterial color="#7a5a36" roughness={0.95} />
      </instancedMesh>
    </group>
  );
}
