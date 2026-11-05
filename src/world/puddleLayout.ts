import type { Road } from "../slice";

export type Puddle = { x: number; z: number; rx: number; rz: number; angle: number };
const VEHICULAR = new Set(["residential", "living_street", "tertiary", "secondary", "primary", "unclassified", "road"]);

// Fixed-coordinate hash: the same road data gives identical puddles regardless
// of input order, avoiding visual flicker when tiles are reloaded.
function hash(x: number, y: number, i: number): number {
  let n = (Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(y * 10), 19349663) ^ Math.imul(i + 17, 83492791)) >>> 0;
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15; n = Math.imul(n, 0x846ca68b); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export function layoutPuddles(roads: readonly Road[], center: [number, number], cap: number, radius = 240): Puddle[] {
  if (cap <= 0 || !Number.isFinite(radius) || radius <= 0) return [];
  const candidates: { p: Puddle; score: number }[] = [];
  const [cx, cz] = center;
  for (const r of roads) {
    if (r.bridge || r.width < 4 || !VEHICULAR.has(r.highway)) continue;
    const pts = r.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, an] = pts[i], [bx, bn] = pts[i + 1];
      const dx = bx - ax, dn = bn - an, length = Math.hypot(dx, dn);
      if (length < 9 || !Number.isFinite(length)) continue;
      const steps = Math.min(18, Math.floor(length / 14));
      for (let k = 0; k < steps; k++) {
        const t = (k + 0.5) / steps;
        const e = ax + dx * t, north = an + dn * t, z = -north;
        if (Math.hypot(e - cx, z - cz) > radius) continue;
        const h = hash(e, north, k);
        if (h < 0.48) continue; // slightly over half of sampled road locations
        const side = hash(e, north, k + 43) * 2 - 1;
        const shoulder = Math.min(r.width * 0.31, 2.0) * side;
        const nx = -dn / length, nn = dx / length;
        const x = e + nx * shoulder, worldZ = -(north + nn * shoulder);
        const size = 0.55 + hash(e, north, k + 137) * 0.78;
        const p: Puddle = {
          x, z: worldZ,
          rx: size * (0.95 + hash(e, north, k + 88) * 0.6),
          rz: size * (0.48 + hash(e, north, k + 89) * 0.25),
          angle: -Math.atan2(dn, dx),
        };
        candidates.push({ p, score: h - Math.hypot(x - cx, worldZ - cz) * 0.0003 });
      }
    }
  }
  // A quality cap bounds transparent overdraw and GPU instances on phones.
  candidates.sort((a, b) => b.score - a.score || a.p.x - b.p.x || a.p.z - b.p.z);
  return candidates.slice(0, Math.min(128, Math.trunc(cap))).map((x) => x.p);
}
