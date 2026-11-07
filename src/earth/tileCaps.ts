// Hard memory bounds for the photoreal tiles renderer. These are caps, not
// measured quality settings: the screen-space error target stays the detail
// knob, and the depth cap only stops runaway refinement.
//
// 3d-tiles-renderer treats maxDepth as exclusive of the next child:
// refinement stops when `tile.internal.depth + 1 >= maxDepth`.
// GoogleCloudAuthPlugin's default `useRecommendedSettings` overwrites
// errorTarget to 20 during init. Callers pass `useRecommendedSettings: false`
// and apply this object afterwards so the explicit target sticks.

export const TILE_MEMORY = {
  /** Coarser than the library default (16). Street-level blank ground was the failure this avoids; not a device measurement. */
  errorTarget: 32,
  minBytes: 180 * 1024 * 1024,
  maxBytes: 280 * 1024 * 1024,
  /** Must stay below maxCount. The library default minSize is 6000, which is above our max and skips count eviction. */
  minCount: 2500,
  maxCount: 3500,
  maxDepth: 24,
  downloadJobs: 6,
  parseJobs: 3,
} as const;

export interface TileMemoryHost {
  errorTarget?: number;
  maxDepth?: number;
  lruCache?: { minBytesSize: number; maxBytesSize: number; minSize: number; maxSize: number };
  downloadQueue?: { maxJobs: number };
  parseQueue?: { maxJobs: number };
}

export function applyTileMemoryCaps(tiles: TileMemoryHost, caps: typeof TILE_MEMORY = TILE_MEMORY): void {
  tiles.errorTarget = caps.errorTarget;
  tiles.maxDepth = caps.maxDepth;
  if (tiles.lruCache) {
    tiles.lruCache.minBytesSize = caps.minBytes;
    tiles.lruCache.maxBytesSize = caps.maxBytes;
    tiles.lruCache.minSize = caps.minCount;
    tiles.lruCache.maxSize = caps.maxCount;
  }
  if (tiles.downloadQueue) tiles.downloadQueue.maxJobs = caps.downloadJobs;
  if (tiles.parseQueue) tiles.parseQueue.maxJobs = caps.parseJobs;
}
