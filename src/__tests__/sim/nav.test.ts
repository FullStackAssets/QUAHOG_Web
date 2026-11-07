import { describe, expect, it } from "vitest";
import { RoadGraph } from "../../sim/RoadGraph";
import { ObjectiveNav } from "../../sim/ObjectiveNav";
import type { Road } from "../../slice";

const roads: Road[] = [
  {
    highway: "residential",
    width: 8,
    name: "A",
    points: [
      [0, 0],
      [40, 0],
      [80, 0],
    ],
  },
  {
    highway: "residential",
    width: 8,
    name: "B",
    points: [
      [80, 0],
      [80, 40],
      [80, 80],
    ],
  },
];

describe("RoadGraph + ObjectiveNav", () => {
  it("builds a connected graph and routes around a corner", () => {
    const g = RoadGraph.fromRoads(roads, { quantize: 4 });
    expect(g.nodeCount).toBeGreaterThan(3);
    // world z = -north, so [80,80] → (80, -80)
    const path = g.route(0, 0, 80, -80);
    expect(path).not.toBeNull();
    expect(path!.points.length).toBeGreaterThan(2);
    expect(path!.length).toBeGreaterThan(100);
  });

  it("flags wrong-way when driving opposite the route", () => {
    const g = RoadGraph.fromRoads(roads, { quantize: 4 });
    const nav = new ObjectiveNav({ wrongWayMinSpeed: 1 });
    nav.setGraph(g);
    nav.setGoal({ x: 80, z: 0 });
    // Facing west (−x, yaw −π/2) while the goal is east (+x).
    const g1 = nav.update({ x: 10, z: 0 }, -Math.PI / 2, 10);
    expect(g1.wrongWay).toBe(true);
    // Facing east toward the goal (yaw +π/2).
    const g2 = nav.update({ x: 10, z: 0 }, Math.PI / 2, 10);
    expect(g2.wrongWay).toBe(false);
  });
});
