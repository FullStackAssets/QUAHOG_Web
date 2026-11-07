/**
 * Road-snapped pursuit helpers for police (and similar chasers).
 * Uses RoadGraph Dijkstra routes with a repath cadence suitable for mobile.
 */

import type { RoadGraph } from "./RoadGraph";
import type { Vec2 } from "./types";
import { dist } from "./math";

export interface ChaseUnit {
  x: number;
  z: number;
  yaw: number;
  path: Vec2[];
  cursor: number;
  repathIn: number;
}

export interface ChaseControllerOptions {
  speed?: number;
  repathPeriod?: number;
  waypointReach?: number;
  spawnRadius?: number;
}

export class ChaseController {
  private graph: RoadGraph;
  private speed: number;
  private repathPeriod: number;
  private waypointReach: number;
  private spawnRadius: number;

  constructor(graph: RoadGraph, opts: ChaseControllerOptions = {}) {
    this.graph = graph;
    this.speed = opts.speed ?? 12.5;
    this.repathPeriod = opts.repathPeriod ?? 1.1;
    this.waypointReach = opts.waypointReach ?? 7;
    this.spawnRadius = opts.spawnRadius ?? 120;
  }

  setGraph(graph: RoadGraph): void {
    this.graph = graph;
  }

  /** Spawn on a road node near the spawn ring around the target. */
  spawnNear(target: Vec2): ChaseUnit | null {
    const id = this.graph.nodeOnRing(target.x, target.z, this.spawnRadius, 40);
    if (id == null) return null;
    const n = this.graph.node(id)!;
    if (dist(n.x, n.z, target.x, target.z) < 40) return null;
    const unit: ChaseUnit = {
      x: n.x,
      z: n.z,
      yaw: 0,
      path: [],
      cursor: 0,
      repathIn: 0,
    };
    this.repath(unit, target);
    return unit;
  }

  repath(unit: ChaseUnit, target: Vec2): boolean {
    const path = this.graph.route(unit.x, unit.z, target.x, target.z);
    if (!path || path.points.length < 2) {
      // Fallback: aim straight if graph disconnect (rare at map edges).
      unit.path = [{ x: target.x, z: target.z }];
      unit.cursor = 0;
      unit.repathIn = this.repathPeriod;
      return false;
    }
    unit.path = path.points;
    unit.cursor = 1;
    unit.repathIn = this.repathPeriod;
    return true;
  }

  /**
   * Advance one chase unit along its road path. Falls back to direct steer
   * when the path is empty so pursuits never soft-lock.
   */
  step(unit: ChaseUnit, dt: number, target: Vec2): number {
    unit.repathIn -= dt;
    if (unit.repathIn <= 0 || unit.cursor >= unit.path.length) {
      this.repath(unit, target);
    }

    let tx = target.x;
    let tz = target.z;
    if (unit.path.length > 0 && unit.cursor < unit.path.length) {
      tx = unit.path[unit.cursor].x;
      tz = unit.path[unit.cursor].z;
    }

    const dx = tx - unit.x;
    const dz = tz - unit.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < this.waypointReach && unit.cursor < unit.path.length) {
      unit.cursor++;
    }
    const step = Math.min(d, this.speed * dt);
    unit.x += (dx / d) * step;
    unit.z += (dz / d) * step;
    unit.yaw = Math.atan2(dx, dz);
    return dist(unit.x, unit.z, target.x, target.z);
  }
}
