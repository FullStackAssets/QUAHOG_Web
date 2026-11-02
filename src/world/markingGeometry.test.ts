import { describe, expect, it } from "vitest";
import type { Road } from "../slice";
import { junctionEndpoints, trimmedCenterlines } from "./markingGeometry";

const road = (points: [number, number][], width = 10): Road => ({
  highway: "residential", width, name: null, points,
});

describe("painted road markings", () => {
  it("clips the painted line before a three-arm junction", () => {
    const roads = [
      road([[0, 0], [30, 0]]),
      road([[0, 0], [0, 30]]),
      road([[0, 0], [0, -30]]),
    ];
    const junctions = junctionEndpoints(roads);
    const [main] = trimmedCenterlines([roads[0]], junctions);
    expect(junctions.size).toBe(1);
    expect(main.points[0][0]).toBeGreaterThanOrEqual(8);
    expect(main.points[main.points.length - 1]).toEqual([30, 0]);
  });

  it("does not add gaps to an ordinary two-way road split", () => {
    const roads = [road([[0, 0], [30, 0]]), road([[30, 0], [60, 0]])];
    const junctions = junctionEndpoints(roads);
    expect(junctions.size).toBe(0);
    const [main] = trimmedCenterlines([roads[0]], junctions);
    expect(main.points).toEqual(roads[0].points);
  });

  it("omits center lines too short to fit before a junction", () => {
    const short = road([[0, 0], [5, 0]]);
    const roads = [short, road([[0, 0], [0, 20]]), road([[0, 0], [0, -20]])];
    const clipped = trimmedCenterlines([short], junctionEndpoints(roads));
    expect(clipped).toEqual([]);
  });
});
