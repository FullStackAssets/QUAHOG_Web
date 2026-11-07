import { describe, expect, it } from "vitest";
import { RoadGraph } from "../../sim/RoadGraph";
import { TrafficDirector } from "../../sim/TrafficDirector";
import type { Road } from "../../slice";

const gridRoads: Road[] = [
  { highway: "residential", width: 8, name: "E", points: [[0, 0], [100, 0], [200, 0]] },
  { highway: "residential", width: 8, name: "N", points: [[100, 0], [100, 100], [100, 200]] },
  { highway: "residential", width: 8, name: "W", points: [[0, 100], [100, 100], [200, 100]] },
];

describe("TrafficDirector", () => {
  it("spawns a fleet on the road graph and advances along routes", () => {
    const g = RoadGraph.fromRoads(gridRoads, { quantize: 4 });
    const dir = new TrafficDirector(g, { speed: 20, waypointReach: 8 });
    const agents = dir.spawnFleet(4, { x: 0, z: 0 });
    expect(agents.length).toBeGreaterThan(0);
    const before = agents.map((a) => ({ x: a.x, z: a.z }));
    for (let i = 0; i < 30; i++) dir.update(0.1, { x: 0, z: 0 }, 16, agents);
    const moved = agents.some((a, i) => Math.hypot(a.x - before[i].x, a.z - before[i].z) > 0.5);
    expect(moved).toBe(true);
  });

  it("respawns a stolen agent after the delay", () => {
    const g = RoadGraph.fromRoads(gridRoads, { quantize: 4 });
    const dir = new TrafficDirector(g, { respawnDelay: 0.5, spawnMin: 10, spawnMax: 250 });
    const agents = dir.spawnFleet(1, { x: 50, z: 0 });
    expect(agents.length).toBe(1);
    dir.markStolen(agents[0]);
    expect(agents[0].stolen).toBe(true);
    dir.update(0.6, { x: 50, z: 0 }, 16, agents);
    expect(agents[0].stolen).toBe(false);
  });
});
