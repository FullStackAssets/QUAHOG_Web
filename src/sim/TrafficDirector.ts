/**
 * Budgeted ambient traffic on the Mount Hope road graph.
 * Assigns Dijkstra routes, advances agents along polylines, and respawns
 * stolen/despawned cars near the player within a frame-time budget.
 */

import type { RoadGraph } from "./RoadGraph";
import type { Vec2 } from "./types";
import { dist } from "./math";

export interface TrafficAgent {
  id: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  path: Vec2[];
  cursor: number;
  stop: number;
  stolen: boolean;
  /** Seconds until a stolen slot may respawn. */
  respawnIn: number;
}

export interface TrafficDirectorOptions {
  speed?: number;
  waypointReach?: number;
  minRoute?: number;
  maxRoute?: number;
  respawnDelay?: number;
  spawnMin?: number;
  spawnMax?: number;
}

export class TrafficDirector {
  private graph: RoadGraph;
  private speed: number;
  private waypointReach: number;
  private minRoute: number;
  private maxRoute: number;
  private respawnDelay: number;
  private spawnMin: number;
  private spawnMax: number;

  constructor(graph: RoadGraph, opts: TrafficDirectorOptions = {}) {
    this.graph = graph;
    this.speed = opts.speed ?? 9;
    this.waypointReach = opts.waypointReach ?? 6;
    this.minRoute = opts.minRoute ?? 60;
    this.maxRoute = opts.maxRoute ?? 280;
    this.respawnDelay = opts.respawnDelay ?? 8;
    this.spawnMin = opts.spawnMin ?? 55;
    this.spawnMax = opts.spawnMax ?? 160;
  }

  setGraph(graph: RoadGraph): void {
    this.graph = graph;
  }

  /** Seed a fleet of agents around a focus point. */
  spawnFleet(count: number, focus: Vec2): TrafficAgent[] {
    const out: TrafficAgent[] = [];
    for (let i = 0; i < count; i++) {
      const a = this.makeAgent(i, focus);
      if (a) out.push(a);
    }
    return out;
  }

  private makeAgent(id: number, focus: Vec2): TrafficAgent | null {
    const startId = this.graph.randomNodeNear(focus.x, focus.z, this.spawnMin * 0.4, this.spawnMax);
    if (startId == null) return null;
    const start = this.graph.node(startId)!;
    const agent: TrafficAgent = {
      id,
      x: start.x,
      z: start.z,
      yaw: 0,
      speed: this.speed * (0.85 + Math.random() * 0.3),
      path: [],
      cursor: 0,
      stop: 0,
      stolen: false,
      respawnIn: 0,
    };
    this.assignRoute(agent, focus);
    return agent;
  }

  /** Assign a fresh route away from / around the player focus. */
  assignRoute(agent: TrafficAgent, focus: Vec2): boolean {
    const startId = this.graph.nearestNode(agent.x, agent.z, 120);
    if (startId == null) return false;
    // Prefer destinations away from the player so traffic circulates.
    const goalId =
      this.graph.randomNodeNear(focus.x, focus.z, this.minRoute, this.maxRoute) ??
      this.graph.randomNodeNear(agent.x, agent.z, this.minRoute, this.maxRoute);
    if (goalId == null || goalId === startId) return false;
    const path = this.graph.routeNodes(startId, goalId);
    if (!path || path.points.length < 2) return false;
    agent.path = path.points;
    agent.cursor = 1;
    const n = agent.path[agent.cursor];
    agent.yaw = Math.atan2(n.x - agent.x, n.z - agent.z);
    return true;
  }

  /**
   * Advance agents. When `budgetMs` is exhausted, remaining agents freeze
   * (graceful fidelity reduction under mobile load).
   */
  update(dt: number, player: Vec2, budgetMs: number, agents: TrafficAgent[], now = performance.now()): void {
    const start = now;
    for (const a of agents) {
      if (performance.now() - start > budgetMs) break;

      if (a.stolen) {
        a.respawnIn -= dt;
        if (a.respawnIn <= 0) this.respawnNear(a, player);
        continue;
      }

      if (a.stop > 0) {
        a.stop = Math.max(0, a.stop - dt);
        continue;
      }

      if (a.path.length < 2 || a.cursor >= a.path.length) {
        if (!this.assignRoute(a, player)) continue;
      }

      const target = a.path[Math.min(a.cursor, a.path.length - 1)];
      const dx = target.x - a.x;
      const dz = target.z - a.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < this.waypointReach) {
        a.cursor++;
        if (a.cursor >= a.path.length) {
          this.assignRoute(a, player);
        }
        continue;
      }
      const step = Math.min(d, a.speed * dt);
      a.x += (dx / d) * step;
      a.z += (dz / d) * step;
      a.yaw = Math.atan2(dx, dz);
    }
  }

  markStolen(agent: TrafficAgent): void {
    agent.stolen = true;
    agent.respawnIn = this.respawnDelay;
    agent.path = [];
  }

  /** Place a free slot on a road ring around the player. */
  respawnNear(agent: TrafficAgent, player: Vec2): void {
    const id = this.graph.nodeOnRing(player.x, player.z, (this.spawnMin + this.spawnMax) * 0.5);
    if (id == null) return;
    const n = this.graph.node(id)!;
    // Keep clear of the player.
    if (dist(n.x, n.z, player.x, player.z) < 25) return;
    agent.x = n.x;
    agent.z = n.z;
    agent.stolen = false;
    agent.stop = 0;
    agent.respawnIn = 0;
    this.assignRoute(agent, player);
  }
}
