import * as THREE from "three";

// One shared raycaster and a per-actor sample clock. Ground heights update at
// ~10 Hz (NPCs slower) and ease between samples. Wall probes update at ~20 Hz.
// Non-priority actors share a per-frame cap so a crowd cannot stampede the BVH.

export const GROUND_INTERVAL_S = 0.1;
export const NPC_GROUND_INTERVAL_S = 0.5;
export const WALL_INTERVAL_S = 0.05;
export const MAX_RAYCASTS_PER_FRAME = 4;
export const COLLISION_CACHE_MAX = 64;

interface HeightSlot {
  from: number;
  to: number;
  t0: number;
  has: boolean;
}

interface WallSlot {
  dist: number;
  t: number;
}

export interface SampleOptions {
  priority?: boolean;
  interval?: number;
}

export function lerpSample(from: number, to: number, t0: number, now: number, interval: number): number {
  if (!(interval > 0)) return to;
  const alpha = Math.min(1, Math.max(0, (now - t0) / interval));
  return from + (to - from) * alpha;
}

export class CollisionBudget {
  readonly ray = new THREE.Raycaster();
  casts = 0;
  private readonly maxPerFrame: number;
  private readonly maxEntries: number;
  private stamp = Number.NEGATIVE_INFINITY;
  private used = 0;
  private readonly ground = new Map<string, HeightSlot>();
  private readonly walls = new Map<string, WallSlot>();

  constructor(opts?: { maxPerFrame?: number; maxEntries?: number }) {
    this.maxPerFrame = opts?.maxPerFrame ?? MAX_RAYCASTS_PER_FRAME;
    this.maxEntries = opts?.maxEntries ?? COLLISION_CACHE_MAX;
    (this.ray as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  }

  beginFrame(stamp: number) {
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.used = 0;
  }

  clear() {
    this.ground.clear();
    this.walls.clear();
    this.used = 0;
    this.stamp = Number.NEGATIVE_INFINITY;
  }

  private take(priority: boolean): boolean {
    if (priority) {
      this.casts += 1;
      return true;
    }
    if (this.used >= this.maxPerFrame) return false;
    this.used += 1;
    this.casts += 1;
    return true;
  }

  private remember<T>(map: Map<string, T>, id: string, value: T) {
    if (map.has(id)) map.delete(id);
    map.set(id, value);
    while (map.size > this.maxEntries) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }

  sampleGround(
    id: string,
    now: number,
    measure: () => number | null,
    opts?: SampleOptions,
  ): number | null {
    const priority = opts?.priority ?? false;
    const interval = opts?.interval ?? GROUND_INTERVAL_S;
    const slot = this.ground.get(id);
    if (!slot || !slot.has) {
      if (slot && now - slot.t0 < interval) return null;
      if (!this.take(priority)) return null;
      const y = measure();
      this.remember(this.ground, id, { from: y ?? 0, to: y ?? 0, t0: now, has: y !== null });
      return y;
    }
    if (now - slot.t0 < interval) {
      this.remember(this.ground, id, slot);
      return lerpSample(slot.from, slot.to, slot.t0, now, interval);
    }
    if (!this.take(priority)) return lerpSample(slot.from, slot.to, slot.t0, now, interval);
    const shown = lerpSample(slot.from, slot.to, slot.t0, now, interval);
    const y = measure();
    if (y === null) {
      this.remember(this.ground, id, { from: shown, to: shown, t0: now, has: true });
      return shown;
    }
    this.remember(this.ground, id, { from: shown, to: y, t0: now, has: true });
    return shown;
  }

  sampleWall(
    id: string,
    now: number,
    measure: () => number,
    opts?: SampleOptions,
  ): number {
    const priority = opts?.priority ?? false;
    const interval = opts?.interval ?? WALL_INTERVAL_S;
    const slot = this.walls.get(id);
    if (slot && now - slot.t < interval) {
      this.remember(this.walls, id, slot);
      return slot.dist;
    }
    if (!this.take(priority)) return slot ? slot.dist : Infinity;
    const dist = measure();
    this.remember(this.walls, id, { dist, t: now });
    return dist;
  }
}

export const tileCollision = new CollisionBudget();
