/**
 * Directed road graph built from OSM-style polylines (Mount Hope slice roads).
 * Nodes are quantized polyline vertices; edges follow travel direction.
 */

import type { Road } from "../slice";
import type { NavPath, RoadEdge, RoadNode, Vec2 } from "./types";
import { dijkstra, type GraphEdge } from "./Dijkstra";
import { dist } from "./math";

const DRIVABLE = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
]);

export interface RoadGraphOptions {
  /** Quantize vertices to this grid (metres) to merge nearby junctions. */
  quantize?: number;
  /** Skip tiny segments. */
  minEdge?: number;
}

export class RoadGraph {
  readonly nodes: RoadNode[] = [];
  readonly edges: RoadEdge[] = [];
  private adjacency = new Map<number, GraphEdge[]>();
  private quantize: number;
  private keyToId = new Map<string, number>();

  constructor(opts: RoadGraphOptions = {}) {
    this.quantize = opts.quantize ?? 4;
  }

  static fromRoads(roads: Road[], opts?: RoadGraphOptions): RoadGraph {
    const g = new RoadGraph(opts);
    const minEdge = opts?.minEdge ?? 2;
    for (const road of roads) {
      if (!DRIVABLE.has(road.highway) || road.bridge) continue;
      if (road.points.length < 2) continue;
      let prevId = -1;
      let prevX = 0;
      let prevZ = 0;
      for (let i = 0; i < road.points.length; i++) {
        const [e, n] = road.points[i];
        const x = e;
        const z = -n; // world: z = -north
        const id = g.ensureNode(x, z);
        if (prevId >= 0) {
          const len = dist(prevX, prevZ, x, z);
          if (len >= minEdge) {
            g.addEdge(prevId, id, len);
            // Undirected travel for city streets unless marked one-way (OSM
            // one-way not currently in Slice Road type — treat as two-way).
            g.addEdge(id, prevId, len);
          }
        }
        prevId = id;
        prevX = x;
        prevZ = z;
      }
    }
    return g;
  }

  private ensureNode(x: number, z: number): number {
    const qx = Math.round(x / this.quantize) * this.quantize;
    const qz = Math.round(z / this.quantize) * this.quantize;
    const key = `${qx},${qz}`;
    const existing = this.keyToId.get(key);
    if (existing !== undefined) return existing;
    const id = this.nodes.length;
    this.nodes.push({ id, x: qx, z: qz });
    this.keyToId.set(key, id);
    this.adjacency.set(id, []);
    return id;
  }

  private addEdge(from: number, to: number, length: number): void {
    if (from === to) return;
    const list = this.adjacency.get(from)!;
    if (list.some((e) => e.to === to)) return;
    list.push({ to, weight: length });
    this.edges.push({ from, to, length });
  }

  nearestNode(x: number, z: number, maxDist = 80): number | null {
    let best = -1;
    let bestD = maxDist * maxDist;
    for (const n of this.nodes) {
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best >= 0 ? best : null;
  }

  /** Random graph node within [minR, maxR] of (x,z). Falls back to any node. */
  randomNodeNear(x: number, z: number, minR = 40, maxR = 180): number | null {
    if (this.nodes.length === 0) return null;
    const min2 = minR * minR;
    const max2 = maxR * maxR;
    const hits: number[] = [];
    for (const n of this.nodes) {
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d >= min2 && d <= max2) hits.push(n.id);
    }
    if (hits.length === 0) {
      // Prefer connected nodes with degree > 0.
      const deg = this.nodes.filter((n) => (this.adjacency.get(n.id)?.length ?? 0) > 0);
      const pool = deg.length ? deg : this.nodes;
      return pool[Math.floor(Math.random() * pool.length)].id;
    }
    return hits[Math.floor(Math.random() * hits.length)];
  }

  /** Pick a random node roughly `radius` metres from (x,z) (ring sample). */
  nodeOnRing(x: number, z: number, radius: number, slack = 35): number | null {
    return this.randomNodeNear(x, z, Math.max(10, radius - slack), radius + slack);
  }

  neighbors(id: number): readonly GraphEdge[] {
    return this.adjacency.get(id) ?? [];
  }

  node(id: number): RoadNode | undefined {
    return this.nodes[id];
  }

  route(fromX: number, fromZ: number, toX: number, toZ: number): NavPath | null {
    const start = this.nearestNode(fromX, fromZ);
    const goal = this.nearestNode(toX, toZ);
    if (start == null || goal == null) return null;
    return this.routeNodes(start, goal);
  }

  routeNodes(start: number, goal: number): NavPath | null {
    const result = dijkstra(this.adjacency, start, goal);
    if (!result) return null;
    const points: Vec2[] = result.nodes.map((id) => {
      const n = this.nodes[id];
      return { x: n.x, z: n.z };
    });
    return { nodes: result.nodes, points, length: result.cost };
  }

  get nodeCount(): number {
    return this.nodes.length;
  }

  get edgeCount(): number {
    return this.edges.length;
  }
}
