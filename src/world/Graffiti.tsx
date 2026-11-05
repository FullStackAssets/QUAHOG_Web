import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeGraffiti } from "./textures";
import { sampleRoadEdges } from "./roadSamples";
import type { Building, Road } from "../slice";

// Wall graffiti (Phase 2 weathering): colourful spray tags that sit FLUSH on real
// building walls facing the street — never free-floating in open space. For each
// road-edge sample we find the nearest building wall within reach; if there's no
// wall there, no tag is placed. Instanced per texture variant; near-core only.

const RADIUS = 270;
const MAX = 150;
const VARIANTS = 5;
const REACH = 10; // max metres from the road edge to a wall worth tagging
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

interface Tag { x: number; z: number; yaw: number; w: number; h: number }

// nearest point on a wall segment (world coords) to p, plus how far it is.
function nearestOnSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  const wx = ax + dx * t, wz = az + dz * t;
  return { wx, wz, d: Math.hypot(px - wx, pz - wz) };
}

export function Graffiti({ roads, buildings, center }: { roads: Road[]; buildings: Building[]; center: [number, number] }) {
  const texes = useMemo(() => Array.from({ length: VARIANTS }, (_, i) => makeGraffiti(i)), []);

  // bucket tags straight into per-variant arrays (one bucket per texture)
  const byVariant = useMemo(() => {
    // building wall segments near the core, in world coords (x=east, z=-north)
    const walls: [number, number, number, number][] = [];
    for (const b of buildings) {
      const fp = b.footprint;
      if (fp.length < 2) continue;
      // cheap cull: first vertex near the core
      if (Math.hypot(fp[0][0] - center[0], -fp[0][1] - center[1]) > RADIUS + 30) continue;
      for (let i = 0; i < fp.length; i++) {
        const [ax, an] = fp[i];
        const [bx, bn] = fp[(i + 1) % fp.length];
        walls.push([ax, -an, bx, -bn]);
      }
    }

    const buckets: Tag[][] = Array.from({ length: VARIANTS }, () => []);
    let v = 0;
    for (const sm of sampleRoadEdges(roads, center, { radius: RADIUS, step: 22, startAt: 14, sparse: 2, max: MAX * 3 })) {
      // candidate point a little off the road edge, on a random side
      const sign = ((sm.x + sm.z) | 0) % 2 === 0 ? 1 : -1; // deterministic side
      const nx = -sm.dz * sign, nz = sm.dx * sign;
      const cx = sm.x + nx * 3, cz = sm.z + nz * 3;
      // find the nearest wall within reach
      let best: { wx: number; wz: number; d: number } | null = null;
      for (const w of walls) {
        const r = nearestOnSeg(cx, cz, w[0], w[1], w[2], w[3]);
        if (r.d < REACH && (!best || r.d < best.d)) best = r;
      }
      if (!best) continue; // no wall here → no floating tag
      // face from the wall back toward the road
      let fx = sm.x - best.wx, fz = sm.z - best.wz;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl; fz /= fl;
      buckets[v % VARIANTS].push({
        x: best.wx + fx * 0.12, z: best.wz + fz * 0.12, // flush on the wall, slight bias out
        yaw: Math.atan2(fx, fz),                        // plane +Z faces the road
        w: 3 + Math.random() * 2, h: 2 + Math.random() * 0.8,
      });
      v++;
      if (v >= MAX) break;
    }
    return buckets;
  }, [roads, buildings, center]);

  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    byVariant.forEach((list, v) => {
      const mesh = refs.current[v];
      if (!mesh) return;
      list.forEach((t, i) => {
        _e.set(0, t.yaw, 0);
        _q.setFromEuler(_e);
        _m.compose(_p.set(t.x, t.h / 2 + 0.5, t.z), _q, _s.set(t.w, t.h, 1));
        mesh.setMatrixAt(i, _m);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [byVariant]);

  return (
    <group>
      {byVariant.map((list, v) => (
        <instancedMesh key={v} ref={(el) => (refs.current[v] = el)} args={[undefined, undefined, Math.max(1, list.length)]} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial map={texes[v]} transparent depthWrite={false} roughness={1} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} />
        </instancedMesh>
      ))}
    </group>
  );
}
