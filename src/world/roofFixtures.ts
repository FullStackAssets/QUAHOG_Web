import type { Building } from "../slice";

/**
 * Bounded, deterministic rooftop silhouettes. The selected fixtures are purely
 * cosmetic; collisions and GIS roofprints remain unchanged. Low's selection
 * is a subset of Medium's, which is a subset of High's.
 */
export interface RoofFixture {
  position: [number, number, number];
  seed: number;
}

export function selectRoofFixtures(buildings: readonly Building[], limit: number): RoofFixture[] {
  const max = Math.min(90, Math.max(0, Math.trunc(Number.isFinite(limit) ? limit : 0)));
  if (max === 0) return [];
  const candidates: RoofFixture[] = [];
  for (const b of buildings) {
    if (!Number.isFinite(b.height) || b.height < 7 || b.height > 45) continue;
    const fp = b.footprint;
    if (!Array.isArray(fp) || fp.length < 3 || fp.some(
      (p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
    )) continue;
    let x = 0, n = 0;
    for (const [east, north] of fp) { x += east; n += north; }
    x /= fp.length; n /= fp.length;
    if (!Number.isFinite(x) || !Number.isFinite(n)) continue;
    const z = -n;
    // No random state, clock or array position: changes in tile ordering do
    // not shuffle which roofs retain their fixtures on a saved-game reload.
    const seed = Math.abs(Math.round(x * 13 + z * 7 + b.height * 19));
    candidates.push({ position: [x, b.height, z], seed });
  }
  candidates.sort((a, b) => a.seed - b.seed || a.position[0] - b.position[0]
    || a.position[2] - b.position[2] || a.position[1] - b.position[1]);
  return candidates.slice(0, max);
}
