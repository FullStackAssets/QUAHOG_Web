import { describe, expect, it } from "vitest";
import sliceRaw from "../../public/slice-newbedford.json?raw";
import type { Road } from "../slice";
import { DRESSING_ENABLED } from "../world/dressing";
import {
  flagCausewayBridges,
  isMallServiceRoad,
  MALL_SERVICE_NAME,
  normalizeRoadNames,
} from "../world/roadPrep";
import { buildParkedCars } from "../world/ParkedCars";
import { sampleRoadEdges } from "../world/roadSamples";
import { FENCE_HIGHWAYS } from "../world/Fences";
import { DUMPSTER_HIGHWAYS } from "../world/Dumpsters";
import { computeTrafficLightPositions } from "../world/TrafficLights";

// Full-game plan (2026-11-02 audit) implementation: minimalist dressing
// switch, Dartmouth Mall exemption, name corrections, causeway flags,
// nearest-first parking, bridge guards, and the load-filter contract fix
// for Fences/Dumpsters. Synthetic fixtures throughout (same pattern as
// rt18.test.ts), plus one real-data premise check for the mall exemption.

const road = (
  highway: string,
  name: string | null,
  points: [number, number][],
  width = 8,
  bridge?: boolean,
): Road => ({ highway, name, points, width, bridge });

describe("minimalist dressing switch", () => {
  it("is OFF — dressing mounts render nothing until Nic flips it", () => {
    // Deliberately asserted: flipping this switch is a decision, not an
    // accident, so the test must be updated in the same change.
    expect(DRESSING_ENABLED).toBe(false);
  });
});

describe("mall service exemption", () => {
  it("matches exactly the mall's interior service records", () => {
    expect(isMallServiceRoad(road("service", MALL_SERVICE_NAME, [[0, 0], [10, 0]], 4.5))).toBe(true);
    expect(isMallServiceRoad(road("service", "Plaza Way", [[0, 0], [10, 0]], 4.5))).toBe(false);
    expect(isMallServiceRoad(road("secondary", MALL_SERVICE_NAME, [[0, 0], [10, 0]], 8))).toBe(false);
    expect(isMallServiceRoad(road("service", null, [[0, 0], [10, 0]], 4.5))).toBe(false);
  });
  it("the shipped slice holds exactly the 7 expected mall records", () => {
    const slice = JSON.parse(sliceRaw) as { roads: Road[] };
    const mall = slice.roads.filter(isMallServiceRoad);
    expect(mall).toHaveLength(7);
    for (const r of mall) expect(r.width).toBe(4.5);
  });
});

describe("highway name corrections", () => {
  it("fixes the two spelling/case splits", () => {
    const out = normalizeRoadNames([
      road("trunk", "Huttleson Avenue", [[0, 0], [10, 0]], 14),
      road("secondary", "Macarthur Drive", [[0, 0], [10, 0]], 10),
    ]);
    expect(out[0].name).toBe("Huttleston Avenue");
    expect(out[1].name).toBe("MacArthur Drive");
  });
  it("does NOT touch Route 6's real primary/trunk split", () => {
    const out = normalizeRoadNames([
      road("primary", "Route 6", [[0, 0], [10, 0]], 12),
      road("trunk", "Route 6", [[0, 0], [10, 0]], 14),
    ]);
    expect(out[0].name).toBe("Route 6");
    expect(out[1].name).toBe("Route 6");
    expect(out[0].highway).toBe("primary");
    expect(out[1].highway).toBe("trunk");
  });
});

describe("causeway flags", () => {
  // Water square [east 0..100, north 0..100]; slice points are [east, north].
  const water: [number, number][][] = [[[0, 0], [100, 0], [100, 100], [0, 100]]];
  it("flags a trunk record entirely over water", () => {
    const out = flagCausewayBridges(
      [road("trunk", "Popes Island", [[10, 10], [90, 90]], 14)],
      water,
    );
    expect(out[0].bridge).toBe(true);
  });
  it("leaves a trunk record straddling the shoreline alone (map-upgrade splits it)", () => {
    // Single segment from land (x=-100) into the water square; its midpoint
    // (-45, 50) is on land, so the all-segments-wet rule does not fire.
    const out = flagCausewayBridges(
      [road("trunk", "Shore Rd", [[-100, 50], [10, 50]], 14)],
      water,
    );
    expect(out[0].bridge).toBeUndefined();
  });
  it("never flags piers/promenades (pedestrian/footway in water)", () => {
    const out = flagCausewayBridges(
      [road("footway", "Pier Walk", [[10, 10], [90, 90]], 2.5)],
      water,
    );
    expect(out[0].bridge).toBeUndefined();
  });
});

describe("nearest-first parking", () => {
  it("sorts by distance so the quality slice keeps near cars, not file-order cars", () => {
    // Far street FIRST in file order, near street second — the old builder
    // would have served the far cars first.
    const far = road("residential", "Far St", [[-100, 200], [100, 200]], 8);
    const near = road("residential", "Near St", [[-100, 60], [100, 60]], 8);
    const cars = buildParkedCars([far, near], [0, 0]);
    expect(cars.length).toBeGreaterThan(0);
    const dists = cars.map((c) => Math.hypot(c.x, c.z));
    for (let i = 1; i < dists.length; i++) expect(dists[i]).toBeGreaterThanOrEqual(dists[i - 1]);
    expect(dists[0]).toBeLessThan(100);
  });
  it("collects beyond the old 46 cap (the quality budget is the cap now)", () => {
    const streets: Road[] = [];
    for (let k = 0; k < 8; k++) {
      streets.push(road("residential", `St ${k}`, [[-200, 60 + k * 10], [200, 60 + k * 10]], 8));
    }
    const cars = buildParkedCars(streets, [0, 0]);
    expect(cars.length).toBeGreaterThan(46);
  });
  it("puts no cars on bridge segments (was luck, now a guard)", () => {
    const bridge = road("residential", "Bridge St", [[-100, 60], [100, 60]], 8, true);
    expect(buildParkedCars([bridge], [0, 0])).toHaveLength(0);
  });
});

describe("load-filter contract: Fences and Dumpsters", () => {
  it("neither layer sources the filtered-out service class anymore", () => {
    expect(FENCE_HIGHWAYS).not.toContain("service");
    expect(DUMPSTER_HIGHWAYS).not.toContain("service");
  });
  it("both layers still place on live classes near the core", () => {
    const streets = [road("residential", "Main St", [[-100, 60], [100, 60]], 8)];
    const fences = sampleRoadEdges(streets, [0, 0], { radius: 240, step: 4, max: 1500, highways: FENCE_HIGHWAYS });
    const dumps = sampleRoadEdges(streets, [0, 0], { radius: 240, step: 34, max: 280, highways: DUMPSTER_HIGHWAYS });
    expect(fences.length).toBeGreaterThan(0);
    expect(dumps.length).toBeGreaterThan(0);
  });
});

describe("signal poles in the damage hook set", () => {
  it("exports positions for major roads within radius", () => {
    const spots = computeTrafficLightPositions(
      [road("primary", "Main St", [[0, 10], [100, 10]], 12)],
      [0, 0],
    );
    expect(spots.length).toBe(1);
    expect(spots[0].x).toBe(0);
    expect(spots[0].z).toBe(-10);
    const none = computeTrafficLightPositions(
      [road("residential", "Side St", [[0, 0], [100, 0]], 7)],
      [0, 0],
    );
    expect(none).toHaveLength(0);
  });
});
