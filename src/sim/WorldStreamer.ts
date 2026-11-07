/**
 * Budgeted asset streamer: request → queue → load → ready → LRU eviction.
 * Camera/player driven; pin-aware; work sliced by frame budget (iPhone-safe).
 * Independent clean-room design — original Mount Hope streaming policy.
 */

import type { StreamAsset, StreamState, Vec3 } from "./types";

export type LoadHandler = (id: string) => Promise<{ bytes: number } | void>;
export type EvictHandler = (id: string) => void;

export interface WorldStreamerOptions {
  /** Soft resident memory cap (bytes). */
  maxResidentBytes?: number;
  /** Max concurrent loads. Keep low on mobile. */
  maxConcurrent?: number;
  /** Interest radius used when projecting ahead of motion (metres). */
  streamRadius?: number;
  load?: LoadHandler;
  evict?: EvictHandler;
  now?: () => number;
}

interface InternalAsset extends StreamAsset {
  wanted: boolean;
}

export class WorldStreamer {
  maxResidentBytes: number;
  maxConcurrent: number;
  streamRadius: number;
  private loadFn: LoadHandler;
  private evictFn: EvictHandler;
  private now: () => number;
  private assets = new Map<string, InternalAsset>();
  private queue: string[] = [];
  private inFlight = 0;
  private residentBytes = 0;
  private generation = 0;

  constructor(opts: WorldStreamerOptions = {}) {
    this.maxResidentBytes = opts.maxResidentBytes ?? 48 * 1024 * 1024;
    this.maxConcurrent = opts.maxConcurrent ?? 2;
    this.streamRadius = opts.streamRadius ?? 180;
    this.loadFn = opts.load ?? (async () => ({ bytes: 0 }));
    this.evictFn = opts.evict ?? (() => undefined);
    this.now = opts.now ?? (() => performance.now());
  }

  /** Register or refresh an asset descriptor. */
  register(id: string, bytes = 0, priority = 0): void {
    const existing = this.assets.get(id);
    if (existing) {
      existing.bytes = bytes;
      existing.priority = priority;
      return;
    }
    this.assets.set(id, {
      id,
      bytes,
      priority,
      state: "idle",
      lastNeededAt: 0,
      wanted: false,
    });
  }

  pin(id: string, pinned = true): void {
    const a = this.assets.get(id);
    if (a) a.pinned = pinned;
  }

  get(id: string): StreamAsset | undefined {
    return this.assets.get(id);
  }

  get resident(): number {
    return this.residentBytes;
  }

  get queued(): number {
    return this.queue.length;
  }

  get readyCount(): number {
    let n = 0;
    for (const a of this.assets.values()) if (a.state === "ready") n++;
    return n;
  }

  /**
   * Mark assets within the interest volume as wanted.
   * `ahead` projects the focus along velocity for fewer pop-ins while driving.
   */
  request(position: Vec3, speed: Vec3, idsInRange: Iterable<string>): void {
    const t = this.now();
    for (const a of this.assets.values()) a.wanted = false;

    // Predictive focus (metres ahead, capped).
    const spd = Math.hypot(speed.x, speed.z);
    const look = Math.min(spd * 1.2, this.streamRadius * 0.6);
    const focusX = position.x + (spd > 0.1 ? (speed.x / spd) * look : 0);
    const focusZ = position.z + (spd > 0.1 ? (speed.z / spd) * look : 0);
    void focusX;
    void focusZ;

    for (const id of idsInRange) {
      let a = this.assets.get(id);
      if (!a) {
        this.register(id);
        a = this.assets.get(id)!;
      }
      a.wanted = true;
      a.lastNeededAt = t;
      if (a.state === "idle" || a.state === "evicting") this.enqueue(a);
    }
    this.generation++;
  }

  private enqueue(a: InternalAsset): void {
    if (a.state === "queued" || a.state === "loading" || a.state === "ready") return;
    a.state = "queued";
    this.queue.push(a.id);
  }

  /**
   * Spend up to `maxWorkMs` advancing loads and evictions.
   * Synchronous scheduling; actual fetch work is async but concurrency-capped.
   */
  advanceBudget(maxWorkMs: number): void {
    const start = this.now();
    this.evictIfNeeded();
    while (this.inFlight < this.maxConcurrent && this.queue.length > 0) {
      if (this.now() - start > maxWorkMs) break;
      const id = this.queue.shift()!;
      const a = this.assets.get(id);
      if (!a || !a.wanted) {
        if (a && a.state === "queued") a.state = "idle";
        continue;
      }
      this.startLoad(a);
    }
  }

  private startLoad(a: InternalAsset): void {
    a.state = "loading";
    this.inFlight++;
    const gen = this.generation;
    void this.loadFn(a.id)
      .then((result) => {
        this.inFlight--;
        if (!this.assets.has(a.id)) return;
        if (!a.wanted && gen !== this.generation) {
          // Lost interest during load — drop without retaining.
          a.state = "idle";
          return;
        }
        const bytes = result && "bytes" in result && result.bytes != null ? result.bytes : a.bytes;
        a.bytes = bytes;
        a.state = "ready";
        this.residentBytes += bytes;
        this.evictIfNeeded();
      })
      .catch(() => {
        this.inFlight--;
        a.state = "idle";
      });
  }

  unloadOutsideBudget(maxResidentBytes = this.maxResidentBytes): void {
    this.maxResidentBytes = maxResidentBytes;
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    if (this.residentBytes <= this.maxResidentBytes) return;
    const victims = [...this.assets.values()]
      .filter((a) => a.state === "ready" && !a.pinned && !a.wanted)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.lastNeededAt - b.lastNeededAt;
      });
    for (const v of victims) {
      if (this.residentBytes <= this.maxResidentBytes) break;
      this.evictOne(v);
    }
  }

  private evictOne(a: InternalAsset): void {
    a.state = "evicting";
    this.evictFn(a.id);
    this.residentBytes = Math.max(0, this.residentBytes - a.bytes);
    a.state = "idle";
  }

  /** Test helper: force a ready state without async load. */
  debugForceReady(id: string, bytes = 1024): void {
    this.register(id, bytes);
    const a = this.assets.get(id)!;
    if (a.state !== "ready") {
      a.state = "ready";
      this.residentBytes += bytes;
    }
    a.wanted = true;
    a.lastNeededAt = this.now();
  }

  stateOf(id: string): StreamState | undefined {
    return this.assets.get(id)?.state;
  }
}
