/**
 * §0.3 Determinism service — seeded splitmix64 streams.
 * Named streams keep traffic / peds / weather / missions / combat independent.
 * No Math.random in sim code paths that opt into these streams.
 */

export type RngStream =
  | "traffic"
  | "peds"
  | "weather"
  | "missions"
  | "combat"
  | "world"
  | "default";

/** splitmix64 → [0, 1) float. */
function nextU64(state: bigint): { state: bigint; value: number } {
  state = (state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  let z = state;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
  z = z ^ (z >> 31n);
  // Top 53 bits → float in [0,1)
  const u = Number(z >> 11n);
  return { state, value: u / 0x1fffffffffffff };
}

export class Rng {
  private state: bigint;
  readonly stream: RngStream;

  constructor(seed: number | bigint = 1, stream: RngStream = "default") {
    // Avoid zero seed collapse.
    const s = typeof seed === "bigint" ? seed : BigInt(seed >>> 0 || 1);
    this.state = (s ^ BigInt(streamKey(stream))) & 0xffffffffffffffffn;
    if (this.state === 0n) this.state = 1n;
    this.stream = stream;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const r = nextU64(this.state);
    this.state = r.state;
    return r.value;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Pick one element. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Advance N draws (for step-scoped alignment). */
  advance(n: number): void {
    for (let i = 0; i < n; i++) this.next();
  }

  clone(): Rng {
    const c = new Rng(1, this.stream);
    c.state = this.state;
    return c;
  }

  /** Opaque digest for replay hashing. */
  digest(): string {
    return `${this.stream}:${this.state.toString(16)}`;
  }
}

function streamKey(s: RngStream): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Process-wide named streams, reseedable for replays. */
export class RngService {
  private seed: number;
  private streams = new Map<RngStream, Rng>();

  constructor(seed = 0x4d4f554e) {
    this.seed = seed >>> 0;
  }

  reseed(seed: number): void {
    this.seed = seed >>> 0;
    this.streams.clear();
  }

  stream(name: RngStream): Rng {
    let r = this.streams.get(name);
    if (!r) {
      r = new Rng(this.seed, name);
      this.streams.set(name, r);
    }
    return r;
  }

  /** Combined digest of all touched streams (for replay asserts). */
  digest(): string {
    const parts: string[] = [`seed:${this.seed.toString(16)}`];
    for (const [k, v] of [...this.streams.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      parts.push(v.digest());
      void k;
    }
    return parts.join("|");
  }
}

/** Shared singleton — safe across HMR. */
const g = globalThis as unknown as { __mounthopeRng?: RngService };
export const rng: RngService = g.__mounthopeRng ?? (g.__mounthopeRng = new RngService());
