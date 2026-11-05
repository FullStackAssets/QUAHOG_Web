/** GIS shoreline helpers. Input ring and points are in world X/Z meters. */
export type WorldXZ = [number, number];

export function insidePolygon(point: WorldXZ, ring: WorldXZ[]): boolean {
  if (ring.length < 3) return false;
  const [x, z] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Determine water side from actual polygon containment, not ring winding.
 * 1 = left normal, -1 = right normal, 0 = unknown/ambiguous.
 */
export function waterSide(a: WorldXZ, b: WorldXZ, ring: WorldXZ[], probe = 3): -1 | 0 | 1 {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.5) return 0;
  const nx = -dz / length, nz = dx / length;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  const left = insidePolygon([mx + nx * probe, mz + nz * probe], ring);
  const right = insidePolygon([mx - nx * probe, mz - nz * probe], ring);
  return left === right ? 0 : left ? 1 : -1;
}
