/** Allocation-light math helpers for the simulation layer. */

import type { Vec2, Vec3 } from "./types";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Shortest-path angular lerp. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function expSmooth(dt: number, rate: number): number {
  return 1 - Math.exp(-dt * rate);
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(bx - ax, bz - az);
}

export function normalize2(x: number, z: number): Vec2 {
  const len = Math.hypot(x, z);
  if (len < 1e-8) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

export function dot2(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

export function bearingTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function angleDelta(from: number, to: number): number {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function copyVec3(out: Vec3, src: Vec3): Vec3 {
  out.x = src.x;
  out.y = src.y;
  out.z = src.z;
  return out;
}
