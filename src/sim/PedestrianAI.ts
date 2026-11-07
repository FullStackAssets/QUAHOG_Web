/**
 * Budgeted pedestrian LOD: near agents update every frame, mid/far less often.
 * Uses SpatialIndex for radius queries (combat / threats).
 * When a PedGraph is bound, agents follow sidewalk routes instead of open wander.
 */

import { SpatialIndex } from "./SpatialIndex";
import type { PedGraph } from "./PedGraph";
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
  /** Sidewalk polyline when PedGraph is active. */
  path?: Vec2[] | null;
  pathCursor?: number;
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
  private graph: PedGraph | null = null;

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

  setGraph(g: PedGraph | null): void {
    this.graph = g;
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
   * Tick wander / sidewalk follow for agents allowed by LOD + budget.
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
      // Fleeing leaves the sidewalk briefly; repath when calm.
      a.path = null;
      a.pathCursor = 0;
      return;
    }

    if (this.graph && (!a.path || a.path.length === 0)) {
      this.assignSidewalkRoute(a);
    }

    if (a.path && a.path.length > 0) {
      const cursor = a.pathCursor ?? 0;
      const wp = a.path[Math.min(cursor, a.path.length - 1)];
      a.goalX = wp.x;
      a.goalZ = wp.z;
      let dx = a.goalX - a.x;
      let dz = a.goalZ - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.7) {
        if (cursor + 1 >= a.path.length) {
          this.assignSidewalkRoute(a);
          return;
        }
        a.pathCursor = cursor + 1;
        return;
      }
      dx /= d;
      dz /= d;
      a.x += dx * this.speed * dt;
      a.z += dz * this.speed * dt;
      a.heading = Math.atan2(dx, dz);
      return;
    }

    let dx = a.goalX - a.x;
    let dz = a.goalZ - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) {
      const g = this.randomInWander();
      a.goalX = g.x;
      a.goalZ = g.z;
      return;
    }
    dx /= d;
    dz /= d;
    a.x += dx * this.speed * dt;
    a.z += dz * this.speed * dt;
    a.heading = Math.atan2(dx, dz);
  }

  private assignSidewalkRoute(a: PedAgent): void {
    const g = this.graph;
    if (!g || g.nodeCount < 2) {
      const p = this.randomInWander();
      a.goalX = p.x;
      a.goalZ = p.z;
      a.path = null;
      a.pathCursor = 0;
      return;
    }
    const start = g.nearestNode(a.x, a.z) ?? g.randomNodeNear(a.x, a.z, 0, 200);
    const goal = g.randomNodeNear(a.x, a.z, 18, this.wander * 2.5);
    if (start == null || goal == null || start === goal) {
      const n = g.node(goal ?? start ?? 0);
      if (n) {
        a.goalX = n.x;
        a.goalZ = n.z;
      }
      a.path = null;
      a.pathCursor = 0;
      return;
    }
    const path = g.routeNodes(start, goal);
    if (!path || path.points.length < 2) {
      const n = g.node(goal);
      a.goalX = n?.x ?? a.x;
      a.goalZ = n?.z ?? a.z;
      a.path = null;
      a.pathCursor = 0;
      return;
    }
    a.path = path.points;
    a.pathCursor = 1;
    a.goalX = path.points[1].x;
    a.goalZ = path.points[1].z;
  }

  /** Snap an agent onto the nearest sidewalk node (spawn helper). */
  snapToGraph(a: PedAgent): void {
    const g = this.graph;
    if (!g) return;
    const id = g.nearestNode(a.x, a.z) ?? g.randomNodeNear(this.center.x, this.center.z, 0, 200);
    if (id == null) return;
    const n = g.node(id)!;
    a.x = n.x;
    a.z = n.z;
    this.assignSidewalkRoute(a);
  }

  queryNear(x: number, z: number, radius: number): PedAgent[] {
    return this.index.queryRadius(x, z, radius, (a) => ({ x: a.x, z: a.z }));
  }

  randomInWander(): Vec2 {
    if (this.graph && this.graph.nodeCount > 0) {
      const id = this.graph.randomNodeNear(this.center.x, this.center.z, 0, this.wander * 2);
      if (id != null) {
        const n = this.graph.node(id)!;
        return { x: n.x, z: n.z };
      }
    }
    return {
      x: this.center.x + (Math.random() * 2 - 1) * this.wander,
      z: this.center.z + (Math.random() * 2 - 1) * this.wander,
    };
  }
}
