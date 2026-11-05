import { describe, expect, it } from "vitest";
import type { Road } from "../slice";
import {
  buildFreewayCorridor,
  isCorridorName,
  removeDeadEndForks,
  trimRoadAtFreeway,
} from "../world/freeway";
import { buildParkedCars } from "../world/ParkedCars";
import { buildHighMastPositions } from "../world/HighMasts";
import { buildMedianBarrierPieces } from "../world/MedianBarriers";

// Rt 18 programme (2026-11-02): the freeway guard, corridor geometry,
// fork cleanup and median/high-mast builders, tested against synthetic
// roads so the rules hold regardless of future map-data changes.

const road = (highway: string, name: string | null, points: [number, number][], width = 16): Road =>
  ({ highway, name, points, width });

const MOTORWAY: Road = road("motorway", "John F Kennedy Memorial Hwy", [[-100, 0], [100, 0]]);
// slice coords are [east, north]; world z = -north, so this motorway runs
// along world z = 0 and the corridor is |z| <= 13.

describe("Rt 18 parking guard", () => {
  it("rejects every car on a motorway record", () => {
    const cars = buildParkedCars([MOTORWAY], [0, 0]);
    expect(cars).toHaveLength(0);
  });
  it("rejects every car on JFK Boulevard (the corridor's surface continuation)", () => {
    const blvd = road("residential", "JFK Boulevard", [[-100, 60], [100, 60]], 10);
    expect(buildParkedCars([blvd], [0, 0])).toHaveLength(0);
  });
  it("rejects cross-street cars inside the 13 m corridor footprint", () => {
    // Elm-like crossing street: its curb offset lands 3.7 m from the
    // motorway centerline — the car that used to sit ON the carriageway.
    const elm = road("residential", "Elm St", [[0, -60], [0, 60]], 8);
    const cars = buildParkedCars([MOTORWAY, elm], [0, 0]);
    for (const c of cars) expect(Math.abs(c.z)).toBeGreaterThan(13);
  });
  it("keeps cars on an ordinary street away from the corridor", () => {
    const main = road("residential", "Main St", [[-100, 60], [100, 60]], 10);
    const cars = buildParkedCars([main], [0, 0]);
    expect(cars.length).toBeGreaterThan(0);
  });
});

describe("freeway helpers", () => {
  it("matches corridor names and rejects lookalikes", () => {
    expect(isCorridorName("John F Kennedy Memorial Hwy")).toBe(true);
    expect(isCorridorName("JFK Boulevard")).toBe(true);
    expect(isCorridorName("Rt 18")).toBe(true);
    expect(isCorridorName("Route 180")).toBe(false);
    expect(isCorridorName("Main St")).toBe(false);
    expect(isCorridorName(null)).toBe(false);
  });
  it("measures distance to the motorway centerline", () => {
    const corridor = buildFreewayCorridor([MOTORWAY]);
    expect(corridor.distanceToCenterline(0, 0)).toBeCloseTo(0, 5);
    expect(corridor.distanceToCenterline(0, 13)).toBeCloseTo(13, 5);
    expect(corridor.contains(0, 12.9)).toBe(true);
    expect(corridor.contains(0, 13.1)).toBe(false);
  });
  it("trims a crossing street at the freeway edge but never a freeway record", () => {
    const corridor = buildFreewayCorridor([MOTORWAY]);
    // Multi-point crossing street (real OSM ways have dense points): only
    // the segment straddling the freeway is dropped; the approaches survive
    // as separate pieces, each ending ~10 m short of the centerline.
    const pts: [number, number][] = [];
    for (let n = -60; n <= 60; n += 10) pts.push([0, n]);
    const crossing = road("residential", "Elm St", pts, 8);
    const pieces = trimRoadAtFreeway(crossing, corridor);
    expect(pieces.length).toBe(2);
    for (const p of pieces) {
      for (const pt of p.points) expect(Math.abs(-pt[1])).toBeGreaterThanOrEqual(8);
    }
    expect(trimRoadAtFreeway(MOTORWAY, corridor)).toEqual([MOTORWAY]);
  });
});

describe("dead-end fork cleanup", () => {
  it("deletes an unnamed service stub but keeps a named residential cul-de-sac", () => {
    const stub = road("service", null, [[200, 200], [200, 250]], 4);
    const culdesac = road("residential", "Maple Ct", [[300, 200], [300, 260]], 8);
    const kept = removeDeadEndForks([stub, culdesac], []);
    expect(kept).not.toContain(stub);
    expect(kept).toContain(culdesac);
  });
  it("protects ramps, links and bridges", () => {
    const ramp = road("motorway_link", "Ramp-Rt 18 Sb", [[400, 0], [400, 30]], 8);
    const bridge = { ...road("service", null, [[500, 0], [500, 30]], 4), bridge: true };
    const kept = removeDeadEndForks([ramp, bridge], []);
    expect(kept).toContain(ramp);
    expect(kept).toContain(bridge);
  });
  it("deletes a corridor micro-fragment but keeps long verify-first streets", () => {
    const loganFrag = road("residential", "Logan St", [[8, 2], [8, 10]], 8);
    const ashley = road("primary", "Ashley Blvd", [[600, 0], [600, 160]], 12);
    const acushnet = road("primary", "Acushnet Ave", [[700, 0], [700, 194]], 12);
    const kept = removeDeadEndForks([MOTORWAY, loganFrag, ashley, acushnet], []);
    expect(kept).not.toContain(loganFrag);
    expect(kept).toContain(ashley);
    expect(kept).toContain(acushnet);
  });
  it("keeps a stub whose name matches a landmark destination", () => {
    const named = road("footway", "Custom House", [[800, 0], [800, 30]], 3);
    expect(removeDeadEndForks([named], ["Custom House"])).toContain(named);
    // Same stub, no matching landmark: deleted.
    expect(removeDeadEndForks([named], [])).not.toContain(named);
  });
});

describe("freeway lighting and median", () => {
  it("places high masts only along motorway records, offset outside the edge", () => {
    const masts = buildHighMastPositions([MOTORWAY], [0, 0]);
    expect(masts.length).toBeGreaterThan(0);
    for (const m of masts) expect(Math.abs(m.z)).toBeCloseTo(16 / 2 + 2.5, 5);
  });
  it("builds a median barrier only where the carriageway gap allows", () => {
    const nb = road("motorway", "John F Kennedy Memorial Hwy", [[-100, 8], [100, 8]]);
    const sb = road("motorway", "John F Kennedy Memorial Hwy", [[-100, -8], [100, -8]]);
    const pieces = buildMedianBarrierPieces([nb, sb]);
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      expect(Math.abs(p.z)).toBeLessThan(2); // midway between the carriageways
      expect(p.len).toBeGreaterThan(0);
    }
    // Gap under 14 m: no barrier.
    const narrowNb = road("motorway", "X", [[-100, 5], [100, 5]]);
    const narrowSb = road("motorway", "X", [[-100, -5], [100, -5]]);
    expect(buildMedianBarrierPieces([narrowNb, narrowSb])).toHaveLength(0);
  });
});
