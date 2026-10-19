import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import type { Road } from "../slice";

// Street furniture + vegetation (§7): lamp posts (glow at night), hydrants,
// mailboxes, benches, and street trees, laid out along the road edges near the
// playable core. Everything is instanced so density stays cheap.

const RADIUS = 240; // metres from core to dress
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

type Place = { x: number; z: number; rot: number };

interface Layout {
  lamps: Place[];
  hydrants: Place[];
  mailboxes: Place[];
  benches: Place[];
  trees: Place[];
}

function buildLayout(roads: Road[], center: [number, number]): Layout {
  const lamps: Place[] = [];
  const hydrants: Place[] = [];
  const mailboxes: Place[] = [];
  const benches: Place[] = [];
  const trees: Place[] = [];
  let n = 0; // deterministic-ish cycling counter

  for (const r of roads) {
    if (r.points.length < 2) continue;
    const off = r.width / 2 + 1.1; // sidewalk offset from centerline
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i];
      const [bx, bn] = r.points[i + 1];
      const x1 = ax, z1 = -an, x2 = bx, z2 = -bn;
      const dx = x2 - x1, dz = z2 - z1;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 8) continue;
      const ux = dx / segLen, uz = dz / segLen;
      const nx = -uz, nz = ux; // left normal
      const spacing = 22;
      for (let d = 6; d < segLen; d += spacing) {
        const cx = x1 + ux * d, cz = z1 + uz * d;
        if (Math.hypot(cx - center[0], cz - center[1]) > RADIUS) continue;
        const side = (n & 1) ? 1 : -1;
        const px = cx + nx * off * side;
        const pz = cz + nz * off * side;
        const rot = Math.atan2(nx * side, nz * side);
        // cycle furniture types so the street feels stocked but not repetitive
        const kind = n % 6;
        if (kind === 0 || kind === 3) lamps.push({ x: px, z: pz, rot });
        else if (kind === 1) trees.push({ x: px, z: pz, rot });
        else if (kind === 2) hydrants.push({ x: px, z: pz, rot });
        else if (kind === 4) mailboxes.push({ x: px, z: pz, rot });
        else benches.push({ x: px, z: pz, rot });
        n++;
        if (lamps.length + trees.length > 1400) break; // hard cap
      }
    }
  }
  return { lamps, hydrants, mailboxes, benches, trees };
}

function fill(mesh: THREE.InstancedMesh | null, places: Place[], y: number) {
  if (!mesh) return;
  for (let i = 0; i < places.length; i++) {
    _q.setFromAxisAngle(_p.set(0, 1, 0), places[i].rot);
    _m.compose(_p.set(places[i].x, y, places[i].z), _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = places.length;
}

export function Props({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const L = useMemo(() => buildLayout(roads, center), [roads, center]);

  const poles = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const hydrants = useRef<THREE.InstancedMesh>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const benches = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const crowns2 = useRef<THREE.InstancedMesh>(null);
  const headMat = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    fill(poles.current, L.lamps, 2.6);
    fill(heads.current, L.lamps, 5.4);
    fill(hydrants.current, L.hydrants, 0.45);
    fill(boxes.current, L.mailboxes, 0.65);
    fill(benches.current, L.benches, 0.35);
    fill(trunks.current, L.trees, 1.6);
    fill(crowns.current, L.trees, 4.2);
    fill(crowns2.current, L.trees, 5.3); // upper canopy tuft
  }, [L]);

  // lamp heads glow warmer as night falls (bloom in Effects picks this up)
  useFrame(() => {
    if (headMat.current) headMat.current.emissiveIntensity = 0.1 + (1 - shared.dayT) * 2.4;
  });

  return (
    <group>
      {/* lamp posts */}
      <instancedMesh ref={poles} args={[undefined, undefined, Math.max(1, L.lamps.length)]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 5.2, 6]} />
        <meshStandardMaterial color="#23272e" roughness={0.7} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, Math.max(1, L.lamps.length)]}>
        <boxGeometry args={[0.42, 0.32, 0.42]} />
        <meshStandardMaterial ref={headMat} color="#fff3cf" emissive="#ffcf7a" emissiveIntensity={0.1} />
      </instancedMesh>

      {/* hydrants */}
      <instancedMesh ref={hydrants} args={[undefined, undefined, Math.max(1, L.hydrants.length)]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.9, 8]} />
        <meshStandardMaterial color="#b22222" roughness={0.6} />
      </instancedMesh>

      {/* mailboxes (USPS blue, 1986) */}
      <instancedMesh ref={boxes} args={[undefined, undefined, Math.max(1, L.mailboxes.length)]} castShadow>
        <boxGeometry args={[0.5, 1.0, 0.5]} />
        <meshStandardMaterial color="#1f4e79" roughness={0.55} metalness={0.3} />
      </instancedMesh>

      {/* benches */}
      <instancedMesh ref={benches} args={[undefined, undefined, Math.max(1, L.benches.length)]} castShadow>
        <boxGeometry args={[1.6, 0.18, 0.5]} />
        <meshStandardMaterial color="#5a3d28" roughness={0.85} />
      </instancedMesh>

      {/* street trees */}
      <instancedMesh ref={trunks} args={[undefined, undefined, Math.max(1, L.trees.length)]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 3.2, 6]} />
        <meshStandardMaterial color="#4a3526" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, Math.max(1, L.trees.length)]} castShadow>
        <icosahedronGeometry args={[1.95, 1]} />
        <meshStandardMaterial color="#3f6b34" roughness={1} />
      </instancedMesh>
      {/* upper canopy tuft — a smaller, lighter lobe for fuller, rounder foliage */}
      <instancedMesh ref={crowns2} args={[undefined, undefined, Math.max(1, L.trees.length)]} castShadow>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshStandardMaterial color="#4f7d3e" roughness={1} />
      </instancedMesh>
    </group>
  );
}
