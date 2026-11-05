import { describe, expect, it } from "vitest";
import { trackWrongWay, type DistSample } from "../ui/wrongWay";
import { gearForSpeed } from "../ui/gear";
import { computeUtilityPolePositions } from "../world/UtilityPoles";
import { filterAwningsToFacades, type AwningPlace } from "../world/Awnings";
import { buildParkedCars } from "../world/ParkedCars";
import { edgeArrowForBearing, normalizeRelativeBearing } from "../ui/edgeArrow";
import { computeLampPositions } from "../world/Props";
import { buildStreetExtrasLayout } from "../world/StreetExtras";

// Playtest 2026-11-02 fixes: wrong-way warning + utility-pole colliders.
describe("trackWrongWay", () => {
  it("flags driving away from the objective", () => {
    const hist: DistSample[] = [];
    expect(trackWrongWay(hist, 0, 100)).toBe("same");
    expect(trackWrongWay(hist, 2000, 130)).toBe("wrong");
  });
  it("clears once distance shrinks again", () => {
    const hist: DistSample[] = [{ t: 0, d: 130 }];
    expect(trackWrongWay(hist, 1000, 120)).toBe("clear");
  });
  it("ignores small drift and near-objective distances", () => {
    const hist: DistSample[] = [];
    trackWrongWay(hist, 0, 20);
    expect(trackWrongWay(hist, 2000, 25)).toBe("same"); // <30 m: no warning
  });
  it("prunes samples older than 5 s", () => {
    const hist: DistSample[] = [{ t: 0, d: 100 }];
    expect(trackWrongWay(hist, 6000, 130)).toBe("same"); // old sample pruned, only one left
  });
});

describe("gearForSpeed", () => {
  it("maps signed speed to D/R/N", () => {
    expect(gearForSpeed(5)).toBe("D");
    expect(gearForSpeed(-5)).toBe("R");
    expect(gearForSpeed(0)).toBe("N");
    expect(gearForSpeed(0.4)).toBe("N");
  });
});

describe("filterAwningsToFacades", () => {
  const buildings = [{ footprint: [[0, 0], [20, 0], [20, 10], [0, 10]] as [number, number][], height: 8 }];
  it("keeps awnings near a facade, drops ones over open lots", () => {
    const places: AwningPlace[] = [
      { x: 10, z: 1.5, rot: 0, c: 0 }, // 1.5 m from the south edge
      { x: 10, z: 40, rot: 0, c: 1 }, // far from any facade
    ];
    const kept = filterAwningsToFacades(places, buildings);
    expect(kept).toHaveLength(1);
    expect(kept[0].c).toBe(0);
  });
  it("keeps everything when no building data is supplied", () => {
    const places: AwningPlace[] = [{ x: 10, z: 40, rot: 0, c: 1 }];
    expect(filterAwningsToFacades(places, [])).toHaveLength(1);
  });
});

describe("edgeArrowForBearing", () => {
  it("is null inside the camera's forward cone", () => {
    expect(edgeArrowForBearing(0.2, 100)).toBeNull();
    expect(edgeArrowForBearing(-0.5, 100)).toBeNull();
  });
  it("points to the side the objective lies toward when off-screen", () => {
    expect(edgeArrowForBearing(1.2, 214)).toEqual({ side: "right", dist: 214 });
    expect(edgeArrowForBearing(-2.5, 80)).toEqual({ side: "left", dist: 80 });
  });
  it("wraps bearings past ±π", () => {
    expect(normalizeRelativeBearing(3.5)).toBeCloseTo(3.5 - Math.PI * 2);
    expect(edgeArrowForBearing(3.5, 50)?.side).toBe("left");
  });
});

describe("computeLampPositions", () => {
  const roads = [{ points: [[0, 0], [400, 0]] as [number, number][], width: 10, highway: "residential", bridge: false }];
  it("places lamps along roadsides within the core radius", () => {
    const lamps = computeLampPositions(roads as never, [0, 0]);
    expect(lamps.length).toBeGreaterThan(0);
    for (const p of lamps) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(240);
  });
});

describe("buildStreetExtrasLayout", () => {
  const roads = [{ points: [[0, 0], [400, 0]] as [number, number][], width: 10, highway: "residential", bridge: false }];
  it("produces stop and meter poles near the core", () => {
    const L = buildStreetExtrasLayout(roads as never, [0, 0]);
    expect(L.stops.length + L.meters.length).toBeGreaterThan(0);
    for (const p of [...L.stops, ...L.meters]) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(240);
  });
  it("keeps traffic cones out of the carriageway (R-05)", () => {
    // Regression: the old code nudged cones 3.4 m back toward the centerline,
    // landing them 1.8 m from it — mid-lane on any road wider than 3.6 m.
    // Cones must sit at the curbside offset like the other extras.
    const L = buildStreetExtrasLayout(roads as never, [0, 0]);
    expect(L.cones.length).toBeGreaterThan(0);
    for (const p of L.cones) expect(Math.abs(p.z)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("buildParkedCars", () => {
  const roads = [
    { points: [[0, 0], [300, 0]] as [number, number][], width: 10, highway: "residential", bridge: false },
  ];
  it("caps at 46 and stays near the core", () => {
    const cars = buildParkedCars(roads as never, [0, 0]);
    expect(cars.length).toBeGreaterThan(0);
    expect(cars.length).toBeLessThanOrEqual(46);
    for (const c of cars) expect(Math.hypot(c.x, c.z)).toBeLessThanOrEqual(240);
  });
});
describe("computeUtilityPolePositions", () => {
  const roads = [
    { points: [[0, 0], [200, 0]] as [number, number][], width: 10, highway: "residential", bridge: false },
  ];
  it("places poles along roadsides within the radius cap", () => {
    const poles = computeUtilityPolePositions(roads as never, [0, 0]);
    expect(poles.length).toBeGreaterThan(0);
    expect(poles.length).toBeLessThanOrEqual(360);
    for (const p of poles) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(260);
  });
  it("skips non-qualifying highways", () => {
    const motorway = [{ points: [[0, 0], [200, 0]] as [number, number][], width: 10, highway: "motorway", bridge: false }];
    expect(computeUtilityPolePositions(motorway as never, [0, 0])).toEqual([]);
  });
});
