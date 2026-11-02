import type { Building } from "../slice";

// Geometry-only, deterministic facade detailing on actual GIS/OSM footprints.
// No fabricated building footprints, navigation surfaces, or physics colliders.
export type DetailKind = "door" | "storefront" | "sill" | "lintel" | "fireLanding" | "fireRail" | "roofUnit";
export interface ArchitecturalDetail {
  kind: DetailKind;
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
  colorIndex: number;
}

const HERO = new Set(["Seamen's Bethel", "New Bedford Whaling Museum", "Mariner's Home", "Double Bank Building", "Rodman Candleworks"]);
export const DETAIL_KINDS: readonly DetailKind[] = ["door", "storefront", "sill", "lintel", "fireLanding", "fireRail", "roofUnit"];

function stableHash(x: number, z: number, height: number): number {
  let h = Math.imul(Math.round(x * 4), 73856093) ^
    Math.imul(Math.round(z * 4), 19349663) ^
    Math.imul(Math.round(height * 4), 83492791);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
}

export interface Frontage {
  x: number; z: number; nx: number; nz: number;
  yaw: number; width: number; cx: number; cz: number;
}

// Prefer a long actual exterior face. Do not infer a road, street address,
// navigable door, or awning attachment from unsurveyed footprint geometry.
export function findExteriorFace(building: Building): Frontage | null {
  const fp = building.footprint;
  if (!Array.isArray(fp) || fp.length < 3 || !Number.isFinite(building.height) || building.height <= 0 ||
    fp.some(p => !Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return null;
  const cx = fp.reduce((s, p) => s + p[0], 0) / fp.length;
  const cz = -fp.reduce((s, p) => s + p[1], 0) / fp.length;
  let best: Frontage | null = null;
  for (let i = 0; i < fp.length; i++) {
    const [ax, an] = fp[i];
    const [bx, bn] = fp[(i + 1) % fp.length];
    const az = -an, bz = -bn;
    const dx = bx - ax, dz = bz - az;
    const width = Math.hypot(dx, dz);
    if (width < 4 || (best && width <= best.width)) continue;
    const x = (ax + bx) / 2, z = (az + bz) / 2;
    let nx = -dz / width, nz = dx / width;
    if ((x - cx) * nx + (z - cz) * nz < 0) { nx = -nx; nz = -nz; }
    best = { x, z, nx, nz, yaw: Math.atan2(nx, nz), width, cx, cz };
  }
  return best;
}

export function generateArchitecturalDetails(
  buildings: Building[], limit = 64, allowed?: ReadonlySet<DetailKind>,
): ArchitecturalDetail[] {
  const maximum = Math.max(0, Math.min(120, Math.floor(Number.isFinite(limit) ? limit : 0)));
  if (!maximum) return [];
  const output: ArchitecturalDetail[] = [];
  const faces = buildings
    .filter(b => b.height >= 3.6 && !(b.name && HERO.has(b.name)))
    .map(b => { const f = findExteriorFace(b); return f ? { b, f, seed: stableHash(f.cx, f.cz, b.height) } : null; })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => a.seed - b.seed || a.f.cx - b.f.cx || a.f.cz - b.f.cz);

  for (const { b, f, seed } of faces) {
    const start = output.length;
    const colorIndex = seed % 5;
    const face = (offset: number, y: number): [number, number, number] =>
      [f.x + f.nx * offset, y, f.z + f.nz * offset];
    const add = (kind: DetailKind, position: [number, number, number], scale: [number, number, number]) => {
      if (!allowed || allowed.has(kind)) output.push({ kind, position, rotationY: f.yaw, scale, colorIndex });
    };
    const usable = Math.min(4.6, f.width - 1.0);
    if (b.height < 18 && seed % 5 === 0 && usable >= 3.2) {
      add("storefront", face(0.09, 1.45), [usable, 2.65, 0.11]);
      add("lintel", face(0.24, 2.90), [usable + 0.25, 0.16, 0.32]);
    } else if (seed % 3 !== 0) {
      add("door", face(0.11, 1.15), [1.12, 2.2, 0.14]);
    }
    // Actual raised sill and coping bands add shading depth to flat window maps.
    if (b.height >= 6.8) {
      add("sill", face(0.15, 3.0), [Math.min(2.3, f.width * 0.45), 0.12, 0.36]);
      if (b.height >= 10.1) add("sill", face(0.15, 6.2), [Math.min(2.3, f.width * 0.45), 0.12, 0.36]);
    }
    if (b.height >= 11 && seed % 7 === 1) {
      const floors = Math.min(3, Math.floor((b.height - 2) / 3.3));
      for (let floor = 1; floor <= floors; floor++) {
        const y = floor * 3.3;
        add("fireLanding", face(0.63, y), [2.35, 0.13, 1.12]);
        add("fireRail", face(1.19, y + 0.70), [2.35, 0.10, 0.10]);
      }
    }
    if (b.height >= 11 && b.height < 38 && seed % 11 === 3) {
      add("roofUnit", [f.cx, b.height + 0.60, f.cz], [1.3, 1.20, 1.15]);
    }
    // Keep a complete building's cluster or none, even at the budget boundary.
    if (output.length > maximum) output.length = start;
    if (output.length === maximum) break;
  }
  return output;
}
