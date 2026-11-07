/**
 * Vehicle/on-foot objective navigation: road route, next-segment guidance,
 * distance remaining, and wrong-way detection for HUD / minimap.
 */

import type { RoadGraph } from "./RoadGraph";
import type { NavGuidance, NavPath, Vec2 } from "./types";
import { angleDelta, bearingTo, dist, normalize2 } from "./math";

export interface ObjectiveNavOptions {
  /** Rebuild the path when the actor strays this far from the polyline. */
  repathSlack?: number;
  /** Heading vs route angle (radians) beyond which we flag wrong-way. */
  wrongWayAngle?: number;
  /** Minimum speed (m/s) before wrong-way is reported (avoids idle noise). */
  wrongWayMinSpeed?: number;
  /** Snap progress when within this distance of the next vertex. */
  waypointReach?: number;
}

export class ObjectiveNav {
  private graph: RoadGraph | null = null;
  private goal: Vec2 | null = null;
  private path: NavPath | null = null;
  private cursor = 0;
  private repathSlack: number;
  private wrongWayAngle: number;
  private wrongWayMinSpeed: number;
  private waypointReach: number;
  private dirty = true;

  constructor(opts: ObjectiveNavOptions = {}) {
    this.repathSlack = opts.repathSlack ?? 28;
    this.wrongWayAngle = opts.wrongWayAngle ?? (100 * Math.PI) / 180;
    this.wrongWayMinSpeed = opts.wrongWayMinSpeed ?? 2.5;
    this.waypointReach = opts.waypointReach ?? 10;
  }

  setGraph(graph: RoadGraph | null): void {
    this.graph = graph;
    this.dirty = true;
  }

  setGoal(goal: Vec2 | null): void {
    if (
      (goal == null && this.goal == null) ||
      (goal && this.goal && goal.x === this.goal.x && goal.z === this.goal.z)
    ) {
      return;
    }
    this.goal = goal;
    this.dirty = true;
  }

  get currentPath(): NavPath | null {
    return this.path;
  }

  clear(): void {
    this.goal = null;
    this.path = null;
    this.cursor = 0;
    this.dirty = false;
  }

  /**
   * Update routing from actor pose. Safe to call every few frames;
   * repaths only when dirty, goal changes, or the actor leaves the corridor.
   */
  update(actor: Vec2, heading: number, speed: number): NavGuidance {
    if (!this.goal || !this.graph) {
      return emptyGuidance();
    }

    if (this.dirty || !this.path) {
      this.path = this.graph.route(actor.x, actor.z, this.goal.x, this.goal.z);
      this.cursor = 0;
      this.dirty = false;
    } else if (this.path.points.length > 0) {
      const near = nearestOnPolyline(actor, this.path.points);
      if (near.dist > this.repathSlack) {
        this.path = this.graph.route(actor.x, actor.z, this.goal.x, this.goal.z);
        this.cursor = 0;
      } else {
        // Progress is the end of the nearest segment (never rewind).
        this.cursor = Math.max(this.cursor, Math.min(near.seg + 1, this.path.points.length - 1));
      }
    }

    if (!this.path || this.path.points.length === 0) {
      // Fallback: straight-line to goal when off-network.
      const dir = normalize2(this.goal.x - actor.x, this.goal.z - actor.z);
      const bearing = bearingTo(actor, this.goal);
      const wrongWay =
        Math.abs(speed) >= this.wrongWayMinSpeed &&
        Math.abs(angleDelta(heading, bearing)) > this.wrongWayAngle;
      return {
        path: null,
        nextDir: dir,
        distanceRemaining: dist(actor.x, actor.z, this.goal.x, this.goal.z),
        wrongWay,
        bearing,
      };
    }

    // On a freshly built path, snap cursor to the segment under the actor so we
    // never guide toward a waypoint already behind the vehicle.
    {
      const near = nearestOnPolyline(actor, this.path.points);
      this.cursor = Math.max(this.cursor, Math.min(near.seg + 1, this.path.points.length - 1));
    }

    // Advance cursor past reached waypoints.
    while (
      this.cursor < this.path.points.length - 1 &&
      dist(actor.x, actor.z, this.path.points[this.cursor].x, this.path.points[this.cursor].z) <
        this.waypointReach
    ) {
      this.cursor++;
    }

    const next = this.path.points[Math.min(this.cursor, this.path.points.length - 1)];
    const nextDir = normalize2(next.x - actor.x, next.z - actor.z);
    const bearing = bearingTo(actor, next);
    const distanceRemaining = polylineRemaining(actor, this.path.points, this.cursor);
    const wrongWay =
      Math.abs(speed) >= this.wrongWayMinSpeed &&
      Math.abs(angleDelta(heading, bearing)) > this.wrongWayAngle;

    return {
      path: this.path,
      nextDir,
      distanceRemaining,
      wrongWay,
      bearing,
    };
  }
}

function emptyGuidance(): NavGuidance {
  return {
    path: null,
    nextDir: null,
    distanceRemaining: 0,
    wrongWay: false,
    bearing: 0,
  };
}

function nearestOnPolyline(p: Vec2, pts: Vec2[]): { seg: number; dist: number } {
  let bestSeg = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointSegDist(p, pts[i], pts[i + 1]);
    if (d < bestD) {
      bestD = d;
      bestSeg = i;
    }
  }
  // Also consider last point.
  const endD = dist(p.x, p.z, pts[pts.length - 1].x, pts[pts.length - 1].z);
  if (endD < bestD) return { seg: pts.length - 1, dist: endD };
  return { seg: bestSeg, dist: bestD };
}

function pointSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  if (len2 < 1e-8) return dist(p.x, p.z, a.x, a.z);
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p.x, p.z, a.x + abx * t, a.z + abz * t);
}

function polylineRemaining(actor: Vec2, pts: Vec2[], cursor: number): number {
  if (pts.length === 0) return 0;
  const i0 = Math.min(cursor, pts.length - 1);
  let rem = dist(actor.x, actor.z, pts[i0].x, pts[i0].z);
  for (let i = i0; i < pts.length - 1; i++) {
    rem += dist(pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
  }
  return rem;
}
