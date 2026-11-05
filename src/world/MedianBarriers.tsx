import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Road } from "../slice";

// Rt 18 programme (2026-11-02): the freeway's median barrier. Where the two
// motorway carriageways run side by side with a centerline gap >= 14 m, a
// low concrete barrier runs down the median — the thing that makes the
// divided carriageways READ as divided, and physically closes the
// median-parking hole. Only mainline motorway records pair with each other:
// ramps (motorway_link) never get a barrier against the mainline, or the
// freeway would be walled off from its own on-ramps. Gaps under 14 m get no
// barrier (narrow median, ribbons nearly touch); gaps over 22 m are the
// diverging terminus/interchange, not a median.

const MIN_GAP = 14;
const MAX_GAP = 22;
const HEIGHT = 0.9;
const WIDTH = 0.6;

export interface MedianPiece { x: number; z: number; rot: number; len: number }

export function buildMedianBarrierPieces(roads: Road[]): MedianPiece[] {
  const mains = roads.filter((r) => r.highway === "motorway" && r.points.length >= 2);
  const pieces: MedianPiece[] = [];
  for (let i = 0; i < mains.length; i++) {
    for (let j = i + 1; j < mains.length; j++) {
      const A = mains[i], B = mains[j];
      for (let a = 0; a < A.points.length - 1; a++) {
        const [ax1, an1] = A.points[a], [ax2, an2] = A.points[a + 1];
        const p1 = { x: ax1, z: -an1 }, p2 = { x: ax2, z: -an2 };
        const dx = p2.x - p1.x, dz = p2.z - p1.z;
        const lenA = Math.hypot(dx, dz);
        if (lenA < 1e-3) continue;
        const ux = dx / lenA, uz = dz / lenA; // travel direction of A
        const nx = -uz, nz = ux; // lateral normal
        for (let b = 0; b < B.points.length - 1; b++) {
          const [bx1, bn1] = B.points[b], [bx2, bn2] = B.points[b + 1];
          const q1 = { x: bx1, z: -bn1 }, q2 = { x: bx2, z: -bn2 };
          const ex = q2.x - q1.x, ez = q2.z - q1.z;
          const lenB = Math.hypot(ex, ez);
          if (lenB < 1e-3) continue;
          // Roughly parallel? (Rejects end-to-end continuations of one chain:
          // their midpoint vector runs ALONG travel, not across it.)
          const dot = Math.abs((ex * ux + ez * uz) / lenB);
          if (dot < 0.85) continue;
          const midA = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
          const midB = { x: (q1.x + q2.x) / 2, z: (q1.z + q2.z) / 2 };
          const mx = midB.x - midA.x, mz = midB.z - midA.z;
          const gap = Math.hypot(mx, mz);
          if (gap < MIN_GAP || gap > MAX_GAP) continue;
          // The midpoint vector must run mostly LATERAL (across the road),
          // not along it — otherwise this is two segments of one chain.
          if (Math.abs((mx * ux + mz * uz) / gap) > 0.35) continue;
          // Overlap of the two segments along the travel axis.
          const proj = (p: { x: number; z: number }) => (p.x - midA.x) * ux + (p.z - midA.z) * uz;
          const t0 = Math.max(Math.min(proj(p1), proj(p2)), Math.min(proj(q1), proj(q2)));
          const t1 = Math.min(Math.max(proj(p1), proj(p2)), Math.max(proj(q1), proj(q2)));
          if (t1 - t0 < 2) continue;
          const lat = ((midB.x - midA.x) * nx + (midB.z - midA.z) * nz) / 2;
          const x0 = midA.x + ux * t0 + nx * lat, z0 = midA.z + uz * t0 + nz * lat;
          const x1b = midA.x + ux * t1 + nx * lat, z1b = midA.z + uz * t1 + nz * lat;
          pieces.push({
            x: (x0 + x1b) / 2, z: (z0 + z1b) / 2,
            rot: Math.atan2(-uz, ux), // local +X along travel
            len: Math.hypot(x1b - x0, z1b - z0),
          });
        }
      }
    }
  }
  // Merge pieces that share a line (adjacent segment pairs overlap): sort by
  // rounded position+rotation and drop near-duplicates so the median does
  // not render double-thick where record pairs overlap.
  const seen = new Set<string>();
  return pieces.filter((p) => {
    const k = `${Math.round(p.x / 4)},${Math.round(p.z / 4)},${Math.round(p.rot * 10)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function MedianBarriers({ roads }: { roads: Road[] }) {
  const pieces = useMemo(() => buildMedianBarrierPieces(roads), [roads]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < pieces.length; i++) {
      _q.setFromAxisAngle(_up, pieces[i].rot);
      _m.compose(_p.set(pieces[i].x, 0.08 + HEIGHT / 2, pieces[i].z), _q, _s.set(pieces[i].len, 1, 1));
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = pieces.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [pieces]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, pieces.length)]} castShadow receiveShadow>
      <boxGeometry args={[1, HEIGHT, WIDTH]} />
      <meshStandardMaterial color="#b0aca4" roughness={0.95} />
    </instancedMesh>
  );
}
