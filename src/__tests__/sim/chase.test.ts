import { describe, expect, it } from "vitest";
import { RoadGraph } from "../../sim/RoadGraph";
import { ChaseController } from "../../sim/ChaseController";
import type { Road } from "../../slice";

const roads: Road[] = [
  { highway: "primary", width: 10, name: "main", points: [[0, 0], [80, 0], [160, 0], [240, 0]] },
  { highway: "primary", width: 10, name: "cross", points: [[160, 0], [160, 80], [160, 160]] },
];

describe("ChaseController", () => {
  it("spawns on the road ring and closes distance along a path", () => {
    const g = RoadGraph.fromRoads(roads, { quantize: 4 });
    const chase = new ChaseController(g, { speed: 30, spawnRadius: 120, repathPeriod: 0.5 });
    const target = { x: 0, z: 0 };
    const unit = chase.spawnNear(target);
    expect(unit).not.toBeNull();
    const startD = Math.hypot(unit!.x - target.x, unit!.z - target.z);
    let d = startD;
    for (let i = 0; i < 80; i++) d = chase.step(unit!, 0.1, target);
    expect(d).toBeLessThan(startD);
  });
});
