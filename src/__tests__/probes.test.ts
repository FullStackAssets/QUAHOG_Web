// Water + wall probes (2026-11-03 diagnosis): regression tests for the
// playtest defects at BLOCK [8, 1, -189] and H2O [9, 1, -194].
//
// Coordinate convention, read carefully: the slice stores (east, north).
// The game world uses (x = east, z = -north). isBlockedWater takes WORLD
// coords, so slice point (8, 189) is tested as isBlockedWater(8, -189).
// The beacon positions from the 03:41 playtest window are world coords.
import { describe, expect, it, beforeAll } from "vitest";
import sliceJson from "../../public/slice-newbedford.json";
import islandsJson from "../../public/islands-newbedford.json";
import barrierJson from "../../public/barrier-newbedford.json";
import gisJson from "../../public/gis-district-newbedford.json";
import tileM1M1 from "../../public/tiles/b_-1_-1.json";
import tileM10 from "../../public/tiles/b_-1_0.json";
import tileM11 from "../../public/tiles/b_-1_1.json";
import tile0M1 from "../../public/tiles/b_0_-1.json";
import tile00 from "../../public/tiles/b_0_0.json";
import tile01 from "../../public/tiles/b_0_1.json";
import tile10 from "../../public/tiles/b_1_0.json";
import tile11 from "../../public/tiles/b_1_1.json";
import { prepareRoads } from "../world/roadPrep";
import {
  isBlockedWater,
  setWaterZones,
  getWaterRingCount,
  getWaterRoadSegCount,
} from "../world/waterZones";
import { hazardTimerTick } from "../world/Hazards";
import { buildParkedCars } from "../world/ParkedCars";
import { BATTLESHIP_COVE, LIZZIE_BORDEN, DARTMOUTH_MALL } from "../places";
import { buildBeaconPayload, type BeaconInput } from "../debug/modelStatus";

type SliceRoad = {
  highway: string;
  name: string | null;
  width: number;
  bridge?: boolean;
  points: [number, number][];
};
type SliceData = {
  roads: SliceRoad[];
  water: [number, number][][];
  landmarks: { name: string }[];
};
type TileBuilding = { footprint: [number, number][]; height: number };
type GisRow = { footprints: [number, number][][] };

const slice = sliceJson as unknown as SliceData;
const islands = islandsJson as unknown as [number, number][][];
const barrier = barrierJson as unknown as [number, number][][];
const gisRaw = gisJson as unknown;
const gisRows: GisRow[] = Array.isArray(gisRaw)
  ? (gisRaw as GisRow[])
  : ((gisRaw as { buildings?: GisRow[] }).buildings ?? []);

// --- 2D geometry helpers (slice coords: x = east, y = north) ---
function pointInRing(px: number, pn: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
    if ((ni > pn) !== (nj > pn) && px < ((xj - xi) * (pn - ni)) / (nj - ni) + xi) inside = !inside;
  }
  return inside;
}
function pointSegDist(px: number, pn: number, ax: number, an: number, bx: number, bn: number): number {
  const dx = bx - ax, dn = bn - an;
  const len2 = dx * dx + dn * dn || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pn - an) * dn) / len2));
  return Math.hypot(px - (ax + dx * t), pn - (an + dn * t));
}
function segSegDist(
  ax: number, an: number, bx: number, bn: number,
  cx: number, cn: number, dx: number, dn: number,
): number {
  // Zero when the segments intersect; otherwise the min endpoint-to-segment distance.
  const d1x = bx - ax, d1n = bn - an, d2x = dx - cx, d2n = dn - cn;
  const denom = d1x * d2n - d1n * d2x;
  if (Math.abs(denom) > 1e-12) {
    const t = ((cx - ax) * d2n - (cn - an) * d2x) / denom;
    const u = ((cx - ax) * d1n - (cn - an) * d1x) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(
    pointSegDist(ax, an, cx, cn, dx, dn),
    pointSegDist(bx, bn, cx, cn, dx, dn),
    pointSegDist(cx, cn, ax, an, bx, bn),
    pointSegDist(dx, dn, ax, an, bx, bn),
  );
}
function polySegDist(poly: [number, number][], sx: number, sn: number, ex: number, en: number): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, an] = poly[i], [bx, bn] = poly[(i + 1) % poly.length];
    best = Math.min(best, segSegDist(ax, an, bx, bn, sx, sn, ex, en));
  }
  return best;
}

// The wall-probe segment west of BLOCK, in slice coords: world [8, -189]
// heading west 3.17 m (Revuelto CLEAR = 4.94/2 + 0.7). The car sat at world
// [8, 1, -189] facing 269° (west) in the 03:41 screenshots.
const PROBE_SX = 8, PROBE_SN = 189, PROBE_EX = 8 - 3.17, PROBE_EN = 189;
// BLOCK / H2O in world coords (what isBlockedWater takes).
const BLOCK_W: [number, number] = [8, -189];
const H2O_W: [number, number] = [9, -194];
const POCKET_W: [number, number] = [5, -186];

describe("water pipeline points (shipped slice + prepareRoads + setWaterZones)", () => {
  beforeAll(() => {
    const prepared = prepareRoads(
      slice.roads as never,
      slice.water,
      slice.landmarks.map((l) => l.name),
      "newBedford",
    );
    setWaterZones(slice.water, prepared as never, islands, barrier);
    // Stash the prepared roads for the bridge check below.
    (globalThis as unknown as { __probeRoads: unknown }).__probeRoads = prepared;
  }, 120000);

  // DIAGNOSIS CORRECTION (2026-11-03, found by this test): the 03:41
  // BLOCK/H2O pocket is NOT blocked water in the shipped data — it sits
  // inside island ring 2 (islands-newbedford.json, 13 verts, east 3–161,
  // north 176–460), so isBlockedWater correctly returns false there. The
  // earlier "runtime water state" verdict missed the island exemption
  // (it reported "Islands: 0" against a file with 5 rings). The open
  // question is now a DATA question — whether ring 2's shape is
  // geographically correct for that pocket — not a runtime-state hunt.
  // The probes in this job still matter: on-device they will show
  // waterBlocked=false at a water-looking spot, which is exactly the
  // evidence that names the data cause.
  it("reads the playtest pocket as island land, not blocked water", () => {
    expect(isBlockedWater(...BLOCK_W)).toBe(false);
    expect(isBlockedWater(...H2O_W)).toBe(false);
    expect(isBlockedWater(...POCKET_W)).toBe(false);
    // ...because island ring 2 covers all three (same ray-cast rule the
    // shipped code uses).
    const ring2 = islands[2];
    for (const [e, n] of [[8, 189], [9, 194], [5, 186]]) {
      expect(pointInRing(e, n, ring2)).toBe(true);
    }
  });
  it("reads open corridors on the approach roads (footway + trunk)", () => {
    // Slice (65, 263) = footway corridor, (74, 281) = Route 6 trunk corridor:
    // the car drove both before reaching the pocket.
    expect(isBlockedWater(65, -263)).toBe(false);
    expect(isBlockedWater(74, -281)).toBe(false);
  });
  it("reads genuinely open harbor water as blocked (mechanism works)", () => {
    // Slice (-100, 1400): inside ring 129, outside every island, far from
    // any road — the control point that proves the water logic itself is
    // intact. The pocket failure is data (island ring 2), not mechanism.
    expect(isBlockedWater(-100, -1400)).toBe(true);
  });
  it("loads a non-empty water state (the runtime fault is NOT this pipeline)", () => {
    expect(getWaterRingCount()).toBe(197);
    expect(getWaterRoadSegCount()).toBeGreaterThan(0);
  });
});

describe("hazard sink timer", () => {
  it("fires the fish-out only after strictly more than 1.1 s wet", () => {
    let s = hazardTimerTick(0, true, 0.6);
    expect(s).toEqual({ wetSeconds: 0.6, fishOut: false });
    s = hazardTimerTick(s.wetSeconds, true, 0.6);
    expect(s.fishOut).toBe(true);
    expect(s.wetSeconds).toBe(0);
  });
  it("does not fire at exactly 1.1 s, and dry resets", () => {
    const at = hazardTimerTick(0.55, true, 0.55);
    expect(at.fishOut).toBe(false);
    expect(at.wetSeconds).toBeCloseTo(1.1);
    expect(hazardTimerTick(at.wetSeconds, false, 0.1)).toEqual({ wetSeconds: 0, fishOut: false });
  });
});

describe("collider inventory west of BLOCK (documents the ruled-out state)", () => {
  const tiles = [tileM1M1, tileM10, tileM11, tile0M1, tile00, tile01, tile10, tile11] as unknown as TileBuilding[][];

  it("no collider-tile building footprint touches the probe segment", () => {
    // Collider tiles = the player's tile (0, 0) + COLLIDE_R = 1 neighbours.
    // b_1_-1 has no file (no buildings there) and is covered by the same
    // 3x3 neighbourhood argument.
    let minDist = Infinity;
    let minSpotDist = Infinity;
    for (const tile of tiles) {
      for (const b of tile) {
        minDist = Math.min(minDist, polySegDist(b.footprint, PROBE_SX, PROBE_SN, PROBE_EX, PROBE_EN));
        for (const [e, n] of b.footprint) minSpotDist = Math.min(minSpotDist, Math.hypot(e - 8, n - 189));
        expect(pointInRing(8, 189, b.footprint)).toBe(false);
      }
    }
    expect(minDist).toBeGreaterThan(0);
    // Diagnosis margin: no tile building within 12 m of the BLOCK spot.
    expect(minSpotDist).toBeGreaterThan(12);
  });
  it("no GIS footprint touches the probe segment or contains the spot", () => {
    // GisDistrict builds no physics bodies at all (no RigidBody in the
    // file); this documents the data side — a footprint here would still
    // be suspicious even without a collider.
    let minDist = Infinity;
    for (const row of gisRows) {
      for (const poly of row.footprints ?? []) {
        minDist = Math.min(minDist, polySegDist(poly, PROBE_SX, PROBE_SN, PROBE_EX, PROBE_EN));
        expect(pointInRing(8, 189, poly)).toBe(false);
      }
    }
    expect(minDist).toBeGreaterThan(0);
  });
  it("no parked car can exist at the spot (builder radius exclusion)", () => {
    // buildParkedCars drops everything beyond RADIUS = 240 from the NB hub
    // center [-266, 100] (world). The BLOCK spot is ~398 m out.
    expect(Math.hypot(8 - -266, -189 - 100)).toBeGreaterThan(240);
    // And the filter itself works on a synthetic far road (no placements).
    const farRoad = {
      highway: "residential",
      name: null,
      width: 7,
      points: [[1000, 1000], [1200, 1000]],
    };
    expect(buildParkedCars([farRoad] as never, [-266, 100])).toHaveLength(0);
  });
  it("no bridge deck segment touches the probe segment", () => {
    const prepared = (globalThis as unknown as { __probeRoads: SliceRoad[] }).__probeRoads ?? [];
    let minDist = Infinity;
    for (const r of prepared) {
      if (!r.bridge || r.points.length < 2) continue;
      for (let i = 0; i < r.points.length - 1; i++) {
        const [ax, an] = r.points[i], [bx, bn] = r.points[i + 1];
        minDist = Math.min(minDist, segSegDist(ax, an, bx, bn, PROBE_SX, PROBE_SN, PROBE_EX, PROBE_EN));
      }
    }
    // Diagnosis margin: nearest bridge records were 41–51 m away.
    expect(minDist).toBeGreaterThan(10);
  });
  it("hero colliders are kilometres from the spot", () => {
    for (const [hx, , hz] of [BATTLESHIP_COVE, LIZZIE_BORDEN, DARTMOUTH_MALL]) {
      // Battleship's cuboid is the largest (100 m z half-length); 1000 m
      // center distance clears every hero collider with room to spare.
      expect(Math.hypot(hx - 8, hz - -189)).toBeGreaterThan(1000);
    }
  });
});

describe("beacon probe fields", () => {
  const base: BeaconInput = {
    buildId: "dev · 2026-11-03",
    ts: 1762140000000,
    mode: "car",
    pos: { x: 8, y: 1, z: -189 },
    speed: 0,
    headingDeg: 269,
    carType: "revuelto",
    carModel: "loaded",
    damage: 12,
    objective: "Meet Deacon Mealy at Seamen's Bethel",
    objectiveDist: 407,
    fps: 55,
    quality: 0,
    hour: 17.5,
    traffic: 8,
    parked: 12,
    errors: [],
  };
  it("carries water state, last stop, and nearest traffic", () => {
    const p = buildBeaconPayload({
      ...base,
      waterBlocked: true,
      waterRings: 197,
      waterRoadSegs: 12345,
      hazardWet: 0.4,
      lastStop: { kind: "wall", x: 8, y: 1, z: -189, yaw: 4.69, dist: 2.5, handle: 42 },
      nearTraf: [41.2, 50, -180],
    });
    expect(p.waterBlocked).toBe(true);
    expect(p.waterRings).toBe(197);
    expect(p.waterRoadSegs).toBe(12345);
    expect(p.hazardWet).toBe(0.4);
    expect(p.lastStop).toEqual({ kind: "wall", pos: [8, 1, -189], yaw: 269, dist: 2.5, handle: 42 });
    expect(p.nearTraf).toEqual([41.2, 50, -180]);
  });
  it("omits probe fields when the caller does not supply them", () => {
    const p = buildBeaconPayload(base);
    expect("waterBlocked" in p).toBe(false);
    expect("lastStop" in p).toBe(false);
    expect("nearTraf" in p).toBe(false);
  });
});
