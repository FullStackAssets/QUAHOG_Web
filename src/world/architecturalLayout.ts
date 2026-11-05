import type { Building } from "../slice";

/**
 * Deterministic, bounded South Coast architectural frontage details.
 * Existing geometry, coordinates and building colliders remain authoritative.
 * This is a decorative visual pass, not a new collision/navmesh surface.
 */
export type DetailKind =
  | "door"
  | "storefront"
  | "awning"
  | "shopSign"
  | "fireLanding"
  | "fireRail"
  | "roofTank";

export interface ArchitecturalDetail {
  kind: DetailKind;
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
  colorIndex: number;
}

const HERO = new Set([
  "Seamen's Bethel", "New Bedford Whaling Museum", "Mariner's Home",
  "Double Bank Building", "Rodman Candleworks",
]);
const MAX_PER_TILE = 90;

function stableHash(a: number, b: number, c: number): number {
  // Use positions, rather than input indices, to keep details stable across
  // GIS tile reordering and saved-game reloads.
  let h = Math.imul(Math.round(a * 5), 73856093)
    ^ Math.imul(Math.round(b * 5), 19349663)
    ^ Math.imul(Math.round(c * 7), 83492791);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
}

interface Frontage {
  x: number;
  z: number;
  nx: number;
  nz: number;
  yaw: number;
  width: number;
  cx: number;
  cz: number;
}

export function findFrontage(building: Building): Frontage | null {
  const fp = building.footprint;
  if (!fp || fp.length < 3 || fp.some((point) =>
    !Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
  )) return null;
  const cx = fp.reduce((sum, p) => sum + p[0], 0) / fp.length;
  const cz = -fp.reduce((sum, p) => sum + p[1], 0) / fp.length;
  let best: Frontage | null = null;
  for (let i = 0; i < fp.length; i++) {
    const [ax, an] = fp[i];
    const [bx, bn] = fp[(i + 1) % fp.length];
    const az = -an, bz = -bn;
    const dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 4 || (best && length <= best.width)) continue;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let nx = -dz / length, nz = dx / length;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) {
      nx = -nx; nz = -nz;
    }
    // Local +Z is outward, local X runs along the facade.
    const yaw = Math.atan2(nx, nz);
    best = { x: mx, z: mz, nx, nz, yaw, width: length, cx, cz };
  }
  return best;
}

export function generateArchitecturalDetails(
  buildings: Building[],
  limit = MAX_PER_TILE,
): ArchitecturalDetail[] {
  const results: ArchitecturalDetail[] = [];
  const candidates = buildings
    .filter((b) => b.height >= 3.4 && !(b.name && HERO.has(b.name)))
    .map((b) => {
      const f = findFrontage(b);
      return f ? { b, f, seed: stableHash(f.cx, f.cz, b.height) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.seed - b.seed);

  const pieceLimit = Math.min(MAX_PER_TILE, Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0)));
  if (!pieceLimit) return [];
  for (const { b, f, seed } of candidates) {
    const begin = results.length;
    const colorIndex = seed % 5;
    const at = (distance: number, y: number): [number, number, number] =>
      [f.x + f.nx * distance, y, f.z + f.nz * distance];
    const add = (kind: DetailKind, pos: [number, number, number], scale: [number, number, number]) => {
      results.push({ kind, position: pos, rotationY: f.yaw, scale, colorIndex });
    };
    const w = Math.min(4.8, f.width - 1.0);
    // Shops and harbor-facing warehouses receive ground-floor glass with
    // an actual projecting canopy. Houses receive smaller entries instead.
    if (b.height <= 22 && seed % 4 === 0 && w >= 3.1) {
      add("storefront", at(0.13, 1.45), [w, 2.65, 0.12]);
      add("awning", at(0.59, 3.04), [w + 0.32, 0.20, 1.05]);
      add("shopSign", at(0.16, 3.42), [w + 0.05, 0.35, 0.12]);
    } else if (seed % 3 !== 0) {
      add("door", at(0.12, 1.2), [1.15, 2.35, 0.13]);
    }

    // Real depth and self-shadowing in upper-floor fire escapes. Caps keep
    // these details within the near-tile budget on iPhone.
    if (b.height >= 11 && seed % 5 === 1) {
      const n = Math.min(4, Math.floor((b.height - 2) / 3.4));
      for (let floor = 1; floor <= n; floor++) {
        const y = floor * 3.3;
        add("fireLanding", at(0.67, y), [2.5, 0.12, 1.15]);
        add("fireRail", at(1.30, y + 0.74), [2.45, 0.09, 0.09]);
      }
    }

    if (b.height >= 11 && b.height <= 38 && seed % 9 === 2) {
      // Cylinder tank meshes use the same world coordinate convention.
      const x = f.cx + (seed % 7 - 3) * 0.4;
      const z = f.cz + (seed % 11 - 5) * 0.3;
      add("roofTank", [x, b.height + 1.3, z], [1.2, 2.3, 1.2]);
    }
    // Preserve coherent awning/storefront and fire-escape clusters: if the
    // last building would exceed the cap, keep the previous complete block.
    if (results.length > pieceLimit) { results.length = begin; continue; }
    if (results.length === pieceLimit) break;
  }
  return results;
}
