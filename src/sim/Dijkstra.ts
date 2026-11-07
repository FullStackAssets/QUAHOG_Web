/**
 * Deterministic Dijkstra shortest-path on a directed weighted graph.
 * Used for vehicle objective routing on the Mount Hope road network.
 */

export interface GraphEdge {
  to: number;
  weight: number;
}

export interface PathResult {
  nodes: number[];
  cost: number;
}

/**
 * Binary-heap Dijkstra. Returns null when start/goal disconnected or invalid.
 * `maxNodes` caps expansion for mobile frame safety on huge graphs.
 */
export function dijkstra(
  adjacency: ReadonlyMap<number, readonly GraphEdge[]>,
  start: number,
  goal: number,
  maxNodes = 8_000,
): PathResult | null {
  if (start === goal) return { nodes: [start], cost: 0 };
  if (!adjacency.has(start) || !adjacency.has(goal)) return null;

  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const heap = new MinHeap();
  dist.set(start, 0);
  heap.push(start, 0);

  let expanded = 0;
  while (heap.size > 0) {
    const { id, priority: d } = heap.pop()!;
    if (d !== dist.get(id)) continue; // stale
    if (id === goal) break;
    if (++expanded > maxNodes) return null;
    const edges = adjacency.get(id);
    if (!edges) continue;
    for (const e of edges) {
      const nd = d + e.weight;
      const cur = dist.get(e.to);
      if (cur === undefined || nd < cur) {
        dist.set(e.to, nd);
        prev.set(e.to, id);
        heap.push(e.to, nd);
      }
    }
  }

  if (!dist.has(goal)) return null;
  const nodes: number[] = [];
  for (let at: number | undefined = goal; at !== undefined; at = prev.get(at)) {
    nodes.push(at);
    if (at === start) break;
  }
  nodes.reverse();
  if (nodes[0] !== start) return null;
  return { nodes, cost: dist.get(goal)! };
}

class MinHeap {
  private data: { id: number; priority: number }[] = [];

  get size(): number {
    return this.data.length;
  }

  push(id: number, priority: number): void {
    this.data.push({ id, priority });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): { id: number; priority: number } | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].priority <= this.data[i].priority) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.data.length;
    for (;;) {
      let best = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < n && this.data[l].priority < this.data[best].priority) best = l;
      if (r < n && this.data[r].priority < this.data[best].priority) best = r;
      if (best === i) break;
      [this.data[best], this.data[i]] = [this.data[i], this.data[best]];
      i = best;
    }
  }
}
