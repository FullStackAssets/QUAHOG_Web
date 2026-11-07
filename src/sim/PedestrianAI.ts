/**
 * Budgeted pedestrian LOD: near agents update every frame, mid/far less often.
 * Uses SpatialIndex for radius queries (combat / threats).
 */

import { SpatialIndex } from "./SpatialIndex";
import type { Vec2 } from "./types";
import { dist } from "./math";

export type PedLod = "near" | "mid" | "far";

export interface PedAgent {
  id: number;
  x: number;
  z: number;
  goalX: number;
  goalZ: number;
  heading: number;
  down: number;
  dead: boolean;
}

export interface PedestrianAIOptions {
  nearR?: number;
  midR?: number;
  wander?: number;
  speed?: number;
  midHz?: number;
  farHz?: number;
}

export class PedestrianAI {
  readonly index = new SpatialIndex<PedAgent>({ sectorSize: 32 });
  private nearR: number;
  private midR: number;
  private wander: number;
  private speed: number;
  private midPeriod: number;
  private farPeriod: number;
  private midAcc = 0;
  private farAcc = 0;
  private center: Vec2 = { x: 0, z: 0 };

  constructor(opts: PedestrianAIOptions = {}) {
    this.nearR = opts.nearR ?? 40;
    this.midR = opts.midR ?? 90;
    this.wander = opts.wander ?? 32;
    this.speed = opts.speed ?? 1.5;
    this.midPeriod = 1 / (opts.midHz ?? 8);
    this.farPeriod = 1 / (opts.farHz ?? 3);
  }

  setCenter(c: Vec2): void {
    this.center = c;
  }

  rebuildIndex(agents: PedAgent[]): void {
    this.index.clear();
    for (const a of agents) {
      if (!a.dead) this.index.insert(a, a.x, a.z);
    }
  }

  lodOf(agent: PedAgent, player: Vec2): PedLod {
    const d = dist(agent.x, agent.z, player.x, player.z);
    if (d <= this.nearR) return "near";
    if (d <= this.midR) return "mid";
    return "far";
  }

  /**
   * Tick wander for agents allowed by LOD + budget.
   * Returns how many agents were fully simulated this frame.
   */
  update(
    dt: number,
    player: Vec2,
    agents: PedAgent[],
    budgetMs: number,
    fleeFrom: Vec2 | null,
    now = performance.now(),
  ): number {
    const t0 = now;
    this.midAcc += dt;
    this.farAcc += dt;
    const runMid = this.midAcc >= this.midPeriod;
    const runFar = this.farAcc >= this.farPeriod;
    if (runMid) this.midAcc = 0;
    if (runFar) this.farAcc = 0;

    let simulated = 0;
    for (const a of agents) {
      if (performance.now() - t0 > budgetMs) break;
      if (a.dead || a.down > 0) continue;

      const lod = this.lodOf(a, player);
      if (lod === "mid" && !runMid) continue;
      if (lod === "far" && !runFar) continue;

      const step = lod === "near" ? dt : lod === "mid" ? this.midPeriod : this.farPeriod;
      this.stepAgent(a, step, fleeFrom);
      this.index.insert(a, a.x, a.z);
      simulated++;
    }
    return simulated;
  }

  private stepAgent(a: PedAgent, dt: number, fleeFrom: Vec2 | null): void {
    if (fleeFrom && dist(a.x, a.z, fleeFrom.x, fleeFrom.z) < 26) {
      let dx = a.x - fleeFrom.x;
      let dz = a.z - fleeFrom.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      a.x += dx * this.speed * 2.2 * dt;
      a.z += dz * this.speed * 2.2 * dt;
      a.heading = Math.atan2(dx, dz);
      return;
    }

    let dx = a.goalX - a.x;
    let dz = a.goalZ - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) {
      a.goalX = this.center.x + (Math.random() * 2 - 1) * this.wander;
      a.goalZ = this.center.z + (Math.random() * 2 - 1) * this.wander;
      return;
    }
    dx /= d;
    dz /= d;
    a.x += dx * this.speed * dt;
    a.z += dz * this.speed * dt;
    a.heading = Math.atan2(dx, dz);
  }

  queryNear(x: number, z: number, radius: number): PedAgent[] {
    return this.index.queryRadius(x, z, radius, (a) => ({ x: a.x, z: a.z }));
  }

  randomInWander(): Vec2 {
    return {
      x: this.center.x + (Math.random() * 2 - 1) * this.wander,
      z: this.center.z + (Math.random() * 2 - 1) * this.wander,
    };
  }
}
