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

  get size(): number {
    return this.itemSector.size;
  }

  get sectorCount(): number {
    return this.buckets.size;
  }
}
