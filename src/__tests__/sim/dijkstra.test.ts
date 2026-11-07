import { describe, expect, it } from "vitest";
import { dijkstra, type GraphEdge } from "../../sim/Dijkstra";

function graph(edges: Record<number, GraphEdge[]>): Map<number, GraphEdge[]> {
  return new Map(Object.entries(edges).map(([k, v]) => [Number(k), v]));
}

describe("dijkstra", () => {
  it("finds the shortest path on a small directed graph", () => {
    const g = graph({
      0: [{ to: 1, weight: 2 }, { to: 2, weight: 5 }],
      1: [{ to: 2, weight: 1 }, { to: 3, weight: 4 }],
      2: [{ to: 3, weight: 1 }],
      3: [],
    });
    const r = dijkstra(g, 0, 3);
    expect(r).not.toBeNull();
    expect(r!.nodes).toEqual([0, 1, 2, 3]);
    expect(r!.cost).toBe(4);
  });

  it("returns a trivial path for start === goal", () => {
    const g = graph({ 1: [] });
    expect(dijkstra(g, 1, 1)).toEqual({ nodes: [1], cost: 0 });
  });

  it("returns null when disconnected", () => {
    const g = graph({ 0: [{ to: 1, weight: 1 }], 1: [], 2: [] });
    expect(dijkstra(g, 0, 2)).toBeNull();
  });
});
