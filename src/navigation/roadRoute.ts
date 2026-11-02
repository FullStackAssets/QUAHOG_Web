import type { Road } from "../slice";

// Small road-graph pathfinder for mission minimap guidance.
// Only returns a route if a contiguous path is actually found.
export type PointXZ = [number, number];
type Edge = { to: number; metres: number };
export type RoadGraph = { points: PointXZ[]; edges: Edge[][] };

const DRIVABLE = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential",
  "unclassified", "living_street", "service", "motorway_link", "trunk_link",
  "primary_link", "secondary_link", "tertiary_link",
]);

const distance = (a: PointXZ, b: PointXZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function buildRoadGraph(roads: Road[]): RoadGraph {
  const points: PointXZ[] = [];
  const edges: Edge[][] = [];
  const indices = new Map<string, number>();
  // Half-metre snapping connects shared OSM junction vertices without
  // automatically connecting unrelated roads passing near one another.
  const nodeId = (p: PointXZ) => {
    const key = String(Math.round(p[0] * 2)) + ":" + String(Math.round(p[1] * 2));
    const known = indices.get(key);
    if (known !== undefined) return known;
    const id = points.length;
    indices.set(key, id);
    points.push(p);
    edges.push([]);
    return id;
  };
  for (const road of roads) {
    if (!DRIVABLE.has(road.highway) || road.points.length < 2) continue;
    let prev = nodeId([road.points[0][0], -road.points[0][1]]);
    for (let i = 1; i < road.points.length; i++) {
      const cur = nodeId([road.points[i][0], -road.points[i][1]]);
      const metres = distance(points[prev], points[cur]);
      if (cur !== prev && metres > 0.01) {
        edges[prev].push({ to: cur, metres });
        edges[cur].push({ to: prev, metres });
      }
      prev = cur;
    }
  }
  return { points, edges };
}

// A* uses a binary min-heap; no per-frame pathfinding or map-wide scan.
export function findRoadRoute(graph: RoadGraph, from: PointXZ, to: PointXZ): PointXZ[] | null {
  if (!graph.points.length) return null;
  let start = 0, goal = 0, startD = Infinity, goalD = Infinity;
  for (let i = 0; i < graph.points.length; i++) {
    const d0 = distance(graph.points[i], from);
    const d1 = distance(graph.points[i], to);
    if (d0 < startD) { startD = d0; start = i; }
    if (d1 < goalD) { goalD = d1; goal = i; }
  }
  // An objective with no nearby drivable access should not get a fabricated route.
  if (startD > 90 || goalD > 90) return null;
  const costs = new Float64Array(graph.points.length).fill(Infinity);
  const prev = new Int32Array(graph.points.length).fill(-1);
  type Candidate = { id: number; score: number };
  const heap: Candidate[] = [];
  const push = (item: Candidate) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p].score <= heap[i].score) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): Candidate | undefined => {
    if (!heap.length) return undefined;
    const first = heap[0], tail = heap.pop()!;
    if (heap.length) {
      heap[0] = tail;
      for (let i = 0;;) {
        let n = i, a = 2 * i + 1, b = a + 1;
        if (a < heap.length && heap[a].score < heap[n].score) n = a;
        if (b < heap.length && heap[b].score < heap[n].score) n = b;
        if (n === i) break;
        [heap[i], heap[n]] = [heap[n], heap[i]];
        i = n;
      }
    }
    return first;
  };
  const heuristic = (id: number) => distance(graph.points[id], graph.points[goal]);
  costs[start] = 0;
  push({ id: start, score: heuristic(start) });
  let visited = 0;
  while (heap.length && visited++ < graph.points.length * 5) {
    const cur = pop()!;
    if (cur.score > costs[cur.id] + heuristic(cur.id) + 0.01) continue;
    if (cur.id === goal) {
      const path: PointXZ[] = [to];
      let id = goal;
      while (id !== -1) { path.push(graph.points[id]); id = prev[id]; }
      path.push(from);
      return path.reverse();
    }
    for (const edge of graph.edges[cur.id]) {
      const candidate = costs[cur.id] + edge.metres;
      if (candidate + 0.001 < costs[edge.to]) {
        costs[edge.to] = candidate;
        prev[edge.to] = cur.id;
        push({ id: edge.to, score: candidate + heuristic(edge.to) });
      }
    }
  }
  return null;
}
