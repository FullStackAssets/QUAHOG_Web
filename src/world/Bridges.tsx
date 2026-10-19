import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { makeAsphaltTexture } from "./textures";
import type { Road } from "../slice";

// Drivable elevated bridges (§40). OSM bridge ways are stitched into continuous
// spans, then each span is built as a deck that ramps from grade at the ends up
// to a crest in the middle — with a trimesh collider so you can actually drive
// up and over, side rails, and piers into the water. The water barrier
// (waterZones/Hazards) makes these the only crossings.

const CREST = 7;          // metres at the high point (ordinary causeway)
const RAMP = 26;          // ramp-up length from each shore
const GREEN_CREST = 10;   // the Braga rides ~10 ft taller (shipping clearance)
const GREEN_RAMP = 40;    // …with a longer ramp so the grade stays drivable
const TILE = 8;
const PIER_EVERY = 16;

type Pt = [number, number]; // slice [east, north]

// stitch bridge polylines that share endpoints into longer chains
function stitchSpans(roads: Road[]): { pts: Pt[]; width: number; green: boolean }[] {
  const isGreen = (n: string | null) => !!n && /braga/i.test(n); // the iconic green bridge
  const lines = roads.filter((r) => r.bridge && r.points.length >= 2)
    .map((r) => ({ pts: r.points.slice() as Pt[], width: r.width, green: isGreen(r.name) }));
  const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const out: { pts: Pt[]; width: number; green: boolean }[] = [];
  while (lines.length) {
    const cur = lines.shift()!;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const head = cur.pts[0], tail = cur.pts[cur.pts.length - 1];
        if (d(tail, l.pts[0]) < 2) { cur.pts.push(...l.pts.slice(1)); }
        else if (d(tail, l.pts[l.pts.length - 1]) < 2) { cur.pts.push(...l.pts.slice().reverse().slice(1)); }
        else if (d(head, l.pts[l.pts.length - 1]) < 2) { cur.pts.unshift(...l.pts.slice(0, -1)); }
        else if (d(head, l.pts[0]) < 2) { cur.pts.unshift(...l.pts.slice().reverse().slice(0, -1)); }
        else continue;
        cur.width = Math.max(cur.width, l.width);
        cur.green = cur.green || l.green;
        lines.splice(i, 1); changed = true; break;
      }
    }
    out.push(cur);
  }
  return out;
}

function rampY(d: number, total: number, crest: number, ramp: number): number {
  const up = Math.min(d / ramp, 1), down = Math.min((total - d) / ramp, 1);
  return crest * Math.max(0, Math.min(up, down));
}

interface Built { deck: THREE.BufferGeometry; rail: THREE.BufferGeometry | null; piers: [number, number, number][] }
const RAIL = 1.1; // railing height

// real elevated bridges are long; anything shorter tagged bridge=yes (culverts,
// tiny overpasses) shouldn't hump up out of an otherwise flat road.
const MIN_ELEVATED = 55;

function buildSpan(pts: Pt[], width: number, crest: number, ramp: number): Built | null {
  const half = width / 2;
  // cumulative length + per-point height
  const wpt = pts.map(([e, n]) => new THREE.Vector3(e, 0, -n));
  let total = 0; const dist = [0];
  for (let i = 1; i < wpt.length; i++) { total += wpt[i].distanceTo(wpt[i - 1]); dist.push(total); }
  if (total < 4) return null;
  // keep short spans at grade so they don't read as random bumps "jutting out"
  if (total < MIN_ELEVATED) { crest = 0.4; ramp = total; }
  for (let i = 0; i < wpt.length; i++) wpt[i].y = rampY(dist[i], total, crest, ramp);

  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const rp: number[] = [], ri: number[] = []; // railing
  const piers: [number, number, number][] = [];
  let v = 0, rv = 0, sinceP = 0;
  for (let i = 0; i < wpt.length - 1; i++) {
    const a = wpt[i], b = wpt[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 1e-3) continue;
    const nx = (-dz / segLen) * half, nz = (dx / segLen) * half;
    pos.push(a.x + nx, a.y, a.z + nz, b.x + nx, b.y, b.z + nz, b.x - nx, b.y, b.z - nz, a.x - nx, a.y, a.z - nz);
    const v0 = dist[i] / TILE, v1 = dist[i + 1] / TILE;
    uv.push(0, v0, 0, v1, 1, v1, 1, v0);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
    // railings: a vertical strip along each deck edge
    for (const s of [1, -1]) {
      const ex = nx * s, ez = nz * s;
      rp.push(a.x + ex, a.y, a.z + ez, b.x + ex, b.y, b.z + ez, b.x + ex, b.y + RAIL, b.z + ez, a.x + ex, a.y + RAIL, a.z + ez);
      ri.push(rv, rv + 1, rv + 2, rv, rv + 2, rv + 3);
      rv += 4;
    }
    sinceP += segLen;
    if (sinceP >= PIER_EVERY && a.y > 1.5) { piers.push([a.x, a.y, a.z]); sinceP = 0; }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  let rail: THREE.BufferGeometry | null = null;
  if (rp.length) {
    rail = new THREE.BufferGeometry();
    rail.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3));
    rail.setIndex(ri);
    rail.computeVertexNormals();
  }
  return { deck: g, rail, piers };
}

export function Bridges({ roads }: { roads: Road[] }) {
  const tex = useMemo(() => makeAsphaltTexture(true), []);
  const spans = useMemo(() =>
    stitchSpans(roads)
      .map((s) => {
        const b = buildSpan(s.pts, s.width, s.green ? GREEN_CREST : CREST, s.green ? GREEN_RAMP : RAMP);
        return b ? { ...b, green: s.green } : null;
      })
      .filter(Boolean) as (Built & { green: boolean })[],
  [roads]);

  return (
    <group>
      {spans.map((s, i) => (
        <group key={i}>
          <RigidBody type="fixed" colliders="trimesh">
            <mesh geometry={s.deck} castShadow receiveShadow>
              <meshStandardMaterial map={tex} color="#74767f" roughness={0.82} side={THREE.DoubleSide} />
            </mesh>
          </RigidBody>
          {s.rail && (
            <mesh geometry={s.rail} castShadow>
              <meshStandardMaterial color={s.green ? "#3f7a3a" : "#3a3e44"} metalness={0.5} roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
          )}
          {/* green truss towers for the iconic Braga cantilever */}
          {s.green && s.piers.filter((_, k) => k % 3 === 0).map((p, k) => (
            <mesh key={`t${k}`} position={[p[0], p[1] + 7, p[2]]} castShadow>
              <boxGeometry args={[2, 16, 2]} />
              <meshStandardMaterial color="#3f7a3a" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
          {s.piers.map((p, k) => (
            <mesh key={k} position={[p[0], p[1] / 2 - 0.75, p[2]]} castShadow>
              <boxGeometry args={[1.1, p[1] + 1.5, 1.1]} />
              <meshStandardMaterial color="#6a5a44" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
