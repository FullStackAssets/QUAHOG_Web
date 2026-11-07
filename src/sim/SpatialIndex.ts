/**
 * Uniform sector grid for spatially pruned queries.
 * Independent design: Mount Hope world units (metres), not a port of any
 * proprietary sector constants.
 */

import type { SectorCoord, Vec2 } from "./types";
import { dist2 } from "./math";

export interface SpatialIndexOptions {
  sectorSize?: number;
  /** Inclusive world min X / Z used only for diagnostics. */
  originX?: number;
  originZ?: number;
}

export class SpatialIndex<T> {
  readonly sectorSize: number;
  readonly originX: number;
  readonly originZ: number;
  private buckets = new Map<string, T[]>();
  private itemSector = new Map<T, string>();

  constructor(opts: SpatialIndexOptions = {}) {
    this.sectorSize = opts.sectorSize ?? 64;
    this.originX = opts.originX ?? 0;
    this.originZ = opts.originZ ?? 0;
  }

  sectorOf(x: number, z: number): SectorCoord {
    return {
      sx: Math.floor(x / this.sectorSize),
      sz: Math.floor(z / this.sectorSize),
    };
  }

  private key(sx: number, sz: number): string {
    return `${sx},${sz}`;
  }

  clear(): void {
    this.buckets.clear();
    this.itemSector.clear();
  }

  insert(item: T, x: number, z: number): void {
    this.remove(item);
    const { sx, sz } = this.sectorOf(x, z);
    const k = this.key(sx, sz);
    let list = this.buckets.get(k);
    if (!list) {
      list = [];
      this.buckets.set(k, list);
    }
    list.push(item);
    this.itemSector.set(item, k);
  }

  remove(item: T): void {
    const k = this.itemSector.get(item);
    if (!k) return;
    const list = this.buckets.get(k);
    if (list) {
      const i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1);
      if (list.length === 0) this.buckets.delete(k);
    }
    this.itemSector.delete(item);
  }

  /** Items in the sector containing (x,z) plus Chebyshev ring `ring`. */
  querySector(x: number, z: number, ring = 0): T[] {
    const { sx, sz } = this.sectorOf(x, z);
    const out: T[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        const list = this.buckets.get(this.key(sx + dx, sz + dz));
        if (list) out.push(...list);
      }
    }
    return out;
  }

  /** Radius query using sector pruning + exact distance filter. */
  queryRadius(
    x: number,
    z: number,
    radius: number,
    getPos: (item: T) => Vec2,
  ): T[] {
    const ring = Math.ceil(radius / this.sectorSize);
    const r2 = radius * radius;
    const candidates = this.querySector(x, z, ring);
    const out: T[] = [];
    for (const item of candidates) {
      const p = getPos(item);
      if (dist2(x, z, p.x, p.z) <= r2) out.push(item);
    }
    return out;
  }

  /**
   * §1.8.5 corridor / LOS query: items within `halfWidth` of segment (x0,z0)→(x1,z1).
   * Sector-pruned via the segment AABB expanded by halfWidth.
   */
  querySegment(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    halfWidth: number,
    getPos: (item: T) => Vec2,
  ): T[] {
    const minX = Math.min(x0, x1) - halfWidth;
    const maxX = Math.max(x0, x1) + halfWidth;
    const minZ = Math.min(z0, z1) - halfWidth;
    const maxZ = Math.max(z0, z1) + halfWidth;
    const sx0 = Math.floor(minX / this.sectorSize);
    const sx1 = Math.floor(maxX / this.sectorSize);
    const sz0 = Math.floor(minZ / this.sectorSize);
    const sz1 = Math.floor(maxZ / this.sectorSize);
    const seen = new Set<T>();
    const out: T[] = [];
    const hw2 = halfWidth * halfWidth;
    for (let sx = sx0; sx <= sx1; sx++) {
      for (let sz = sz0; sz <= sz1; sz++) {
        const list = this.buckets.get(this.key(sx, sz));
        if (!list) continue;
        for (const item of list) {
          if (seen.has(item)) continue;
          seen.add(item);
          const p = getPos(item);
          if (dist2ToSegment(p.x, p.z, x0, z0, x1, z1) <= hw2) out.push(item);
        }
      }
    }
    return out;
  }

  get size(): number {
    return this.itemSector.size;
  }

  get sectorCount(): number {
    return this.buckets.size;
  }
}

/** Squared distance from point (px,pz) to segment (ax,az)→(bx,bz). */
function dist2ToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const ab2 = abx * abx + abz * abz;
  if (ab2 < 1e-12) return apx * apx + apz * apz;
  let t = (apx * abx + apz * abz) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + abx * t - px;
  const cz = az + abz * t - pz;
  return cx * cx + cz * cz;
}
