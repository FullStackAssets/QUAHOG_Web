import { afterEach, describe, expect, it } from "vitest";
import { toWorld, type Road } from "../slice";
import { sampleRoadEdges } from "../world/roadSamples";
import { isBlockedWater, setWaterZones } from "../world/waterZones";

afterEach(() => {
  setWaterZones([], [], []);
});

function road(partial: Pick<Road, "highway" | "points"> & Partial<Road>): Road {
  return {
    width: 4,
    name: null,
    ...partial,
  };
}

describe("slice coordinates", () => {
  it("maps east to +x and north to -z", () => {
    expect(toWorld([12, 7], 3)).toEqual([12, 3, -7]);
    expect(Object.is(toWorld([12, 0])[2], -0)).toBe(true);
  });
});

describe("water barrier", () => {
  it("blocks open water, lets a road through, and keeps an island walkable", () => {
    setWaterZones(
      [[[0, 0], [30, 0], [30, 30], [0, 30]]],
      [road({ highway: "primary", width: 2, points: [[0, 0], [30, 0]] })],
      [[[20, 20], [24, 20], [24, 24], [20, 24]]],
    );

    // On the road centerline (north 0 → world z 0). Shoulder is width/2 + 5 = 6.
    expect(isBlockedWater(10, 0)).toBe(false);
    // Open water, 20 m north of that road: blocked.
    expect(isBlockedWater(10, -20)).toBe(true);
    // Island cut out of the water, also 22 m off the road: not blocked.
    expect(isBlockedWater(22, -22)).toBe(false);
    // On land outside the polygon: not blocked.
    expect(isBlockedWater(80, 0)).toBe(false);
  });

  it("treats the hurricane-barrier polyline as a walkable corridor", () => {
    setWaterZones(
      [[[0, 0], [20, 0], [20, 20], [0, 20]]],
      [],
      [],
      [[[0, 10], [20, 10]]],
    );
    expect(isBlockedWater(10, -10)).toBe(false);
    expect(isBlockedWater(10, -18)).toBe(true);
  });

  it("blocks nothing when no water is loaded", () => {
    expect(isBlockedWater(10, -16)).toBe(false);
  });
});

describe("road edge sampling", () => {
  it("walks a northbound street in stable world space and honors the cap", () => {
    const roads = [
      road({ highway: "residential", name: "Union", points: [[0, 0], [0, 40]] }),
    ];
    const opts = { radius: 100, step: 10, startAt: 10, max: 2, highways: ["residential"] };
    const first = sampleRoadEdges(roads, [0, 0], opts);
    const second = sampleRoadEdges(roads, [0, 0], opts);
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({ x: 0, z: -10, dx: 0, dz: -1 });
    expect(first[1]).toMatchObject({ x: 0, z: -20, dx: 0, dz: -1 });
  });

  it("skips bridges and highways outside the whitelist, and culls by radius", () => {
    const roads = [
      road({ highway: "residential", bridge: true, points: [[0, 0], [0, 40]] }),
      road({ highway: "footway", points: [[0, 0], [30, 0]] }),
    ];
    expect(sampleRoadEdges(roads, [0, 0], { radius: 100, step: 10, max: 10 })).toEqual([]);

    const far = [
      road({ highway: "primary", points: [[0, 0], [0, 40]] }),
    ];
    expect(sampleRoadEdges(far, [500, 500], { radius: 20, step: 10, max: 10 })).toEqual([]);
  });
});
