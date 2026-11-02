import { describe, expect, it } from "vitest";
import type { Road } from "../slice";
import { buildRoadGraph, findRoadRoute } from "./roadRoute";

const road = (points: [number, number][]): Road => ({
  highway: "residential", width: 8, name: null, points,
});

describe("road-connected mission guidance", () => {
  it("connects shared OSM vertices and follows streets around a corner", () => {
    const graph = buildRoadGraph([
      road([[0, 0], [20, 0]]),
      road([[20, 0], [20, 20]]),
    ]);
    const route = findRoadRoute(graph, [0, 0], [20, -20]);
    expect(route).not.toBeNull();
    expect(route).toContainEqual([20, 0]);
    expect(route?.slice(-1)[0]).toEqual([20, -20]);
  });

  it("does not invent a straight route across disconnected streets", () => {
    const graph = buildRoadGraph([
      road([[0, 0], [20, 0]]),
      road([[100, 0], [120, 0]]),
    ]);
    expect(findRoadRoute(graph, [0, 0], [120, 0])).toBeNull();
  });

  it("ignores footways when constructing driving directions", () => {
    const footpath: Road = { highway: "footway", width: 2, name: null,
      points: [[20, 0], [100, 0]] };
    const graph = buildRoadGraph([road([[0, 0], [20, 0]]), footpath, road([[100, 0], [120, 0]])]);
    expect(findRoadRoute(graph, [0, 0], [120, 0])).toBeNull();
  });
});
