import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleRoadEdges } from "./roadSamples";
import type { Road } from "../slice";

// Flat road-surface fixtures (§ streets pass): cast-iron manhole covers on the
// carriageway and rectangular storm grates at the curb. Instanced flat quads,
// polygon-offset just above the asphalt like the grime/crosswalk decals.

const RADIUS = 240;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

type P = { x: number; z: number; rot: number };

function lay(mesh: THREE.InstancedMesh | null, ps: P[], y: number) {
  if (!mesh) return;
  for (let i = 0; i < ps.length; i++) {
    _e.set(-Math.PI / 2, ps[i].rot, 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(ps[i].x, y, ps[i].z), _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.count = ps.length;
  mesh.instanceMatrix.needsUpdate = true;
}

export function RoadFixtures({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const L = useMemo(() => {
    const samples = sampleRoadEdges(roads, center, { radius: RADIUS, step: 22, sparse: 1, max: 1100 });
    const manholes: P[] = [], grates: P[] = [], patches: P[] = [];
    let n = 0;
    for (const s of samples) {
      const nx = -s.dz, nz = s.dx;
      const rot = Math.atan2(s.dx, s.dz);
      if (n % 3 === 0) manholes.push({ x: s.x, z: s.z, rot });          // on the lane
      if (n % 5 === 0) {                                                // at the curb
        const side = (n & 2) ? 1 : -1;
        grates.push({ x: s.x + nx * 4.6 * side, z: s.z + nz * 4.6 * side, rot });
      }
      if (n % 7 === 0) {                                                // repaved patch on the lane
        const off = ((n * 0.618) % 1 - 0.5) * 3;
        patches.push({ x: s.x + nx * off, z: s.z + nz * off, rot });
      }
      n++;
    }
    return { manholes, grates, patches };
  }, [roads, center]);

  const manhole = useRef<THREE.InstancedMesh>(null);
  const grate = useRef<THREE.InstancedMesh>(null);
  const patch = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    lay(manhole.current, L.manholes, 0.09);
    lay(grate.current, L.grates, 0.088);
    lay(patch.current, L.patches, 0.085);
  }, [L]);

  return (
    <group>
      <instancedMesh ref={manhole} args={[undefined, undefined, Math.max(1, L.manholes.length)]}>
        <circleGeometry args={[0.34, 14]} />
        <meshStandardMaterial color="#2a2c30" roughness={0.7} metalness={0.4} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
      <instancedMesh ref={grate} args={[undefined, undefined, Math.max(1, L.grates.length)]}>
        <planeGeometry args={[0.7, 0.45]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.8} metalness={0.5} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
      {/* repaved asphalt patches — slightly lighter/fresher than the road */}
      <instancedMesh ref={patch} args={[undefined, undefined, Math.max(1, L.patches.length)]}>
        <planeGeometry args={[2.6, 1.8]} />
        <meshStandardMaterial color="#6a6c74" roughness={0.95} polygonOffset polygonOffsetFactor={-1} />
      </instancedMesh>
    </group>
  );
}
