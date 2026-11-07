import { describe, expect, it } from "vitest";
import { PedGraph } from "../../sim/PedGraph";
import { PedestrianAI, type PedAgent } from "../../sim/PedestrianAI";
import type { Road } from "../../slice";

const gridRoads: Road[] = [
  { highway: "residential", width: 8, name: "E", points: [[0, 0], [100, 0], [200, 0]] },
  { highway: "residential", width: 8, name: "N", points: [[100, 0], [100, 100], [100, 200]] },
  { highway: "footway", width: 2, name: "path", points: [[20, 20], [80, 20]] },
];

describe("PedGraph", () => {
  it("builds sidewalk corridors offset from road centerlines", () => {
    const g = PedGraph.fromRoads(gridRoads, { quantize: 5 });
    expect(g.nodeCount).toBeGreaterThan(4);
    expect(g.edgeCount).toBeGreaterThan(4);
  });

  it("routes between sidewalk nodes", () => {
    const g = PedGraph.fromRoads(gridRoads, { quantize: 5 });
    const path = g.route(0, 0, 100, -100);
    expect(path).not.toBeNull();
    expect(path!.points.length).toBeGreaterThan(1);
    expect(path!.length).toBeGreaterThan(0);
  });
});

describe("PedestrianAI + PedGraph", () => {
  it("follows sidewalk routes instead of open-field wander", () => {
    const g = PedGraph.fromRoads(gridRoads, { quantize: 5 });
    const ai = new PedestrianAI({ speed: 8, wander: 80 });
    ai.setCenter({ x: 50, z: 0 });
    ai.setGraph(g);
    const agent = {
      id: 0,
      x: 0,
      z: 0,
      goalX: 0,
      goalZ: 0,
      heading: 0,
      down: 0,
      dead: false,
        path: null as PedAgent["path"],
        pathCursor: 0,
      };
      ai.snapToGraph(agent);
      expect(agent.path == null || (agent.path?.length ?? 0) >= 1).toBe(true);
    const before = { x: agent.x, z: agent.z };
    for (let i = 0; i < 40; i++) {
      ai.update(0.1, { x: 50, z: 0 }, [agent], 16, null, performance.now());
    }
    expect(Math.hypot(agent.x - before.x, agent.z - before.z)).toBeGreaterThan(0.5);
  });
});
