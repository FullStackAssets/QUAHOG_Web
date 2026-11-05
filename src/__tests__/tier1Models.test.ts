import { describe, expect, it } from "vitest";
import frSliceRaw from "../../public/slice-fallriver.json?raw";
import type { Building } from "../slice";
import { DISTRICTS, districtOfWorld } from "../districts";
import {
  TIER1_MODELS,
  isTier1Building,
  withoutTier1,
} from "../world/tier1Models";
import cityHallRaw from "../../public/tier1/city_hall_tier2.glb?raw";
import portugaliaRaw from "../../public/tier1/portugalia_tier2.glb?raw";
import plumbersRaw from "../../public/tier1/plumbers_supply_tier2.glb?raw";
import tecumsehRaw from "../../public/tier1/tecumseh_mill_tier2.glb?raw";
import armoryRaw from "../../public/tier1/bank_armory_tier2.glb?raw";
import academyRaw from "../../public/tier1/academy_tier2.glb?raw";
import justiceRaw from "../../public/tier1/justice_center_tier2.glb?raw";
import coveRaw from "../../public/tier1/cove_tier2.glb?raw";
import riverviewRaw from "../../public/tier1/riverview_tier2.glb?raw";
import shipsCoveRaw from "../../public/tier1/ships_cove_tier2.glb?raw";
import carouselRaw from "../../public/tier1/carousel.glb?raw";
import narrowsRaw from "../../public/tier1/narrows.glb?raw";
import sweetRoseRaw from "../../public/tier1/sweet_rose.glb?raw";
import remingtonRaw from "../../public/tier1/remington_borden.glb?raw";
import robesonRaw from "../../public/tier1/robeson.glb?raw";
import antiochRaw from "../../public/tier1/antioch.glb?raw";
import childrensRaw from "../../public/tier1/childrens_museum.glb?raw";
import baycoastRaw from "../../public/tier1/baycoast.glb?raw";
import lizzieRaw from "../../public/tier1/lizzie.glb?raw";

// Tier-1 approved-model mount (batches 2 + 3, Nic 2026-11-03): the manifest
// must stay exactly derivable from the shipped Fall River slice. Placement
// convention (pipeline): centroid = vertex mean INCLUDING the closing
// duplicate point; group position = (cx, 0, -cy) with identity rotation, so
// the glTF (Y-up) lands at x = east, z = -north in game space. GLB bounds
// are checked against the slice footprint spans — a drifted manifest fails
// here instead of silently double-rendering or misplacing a building.
// Only the JSON chunk is parsed: the header/BIN bytes may not survive the
// ?raw UTF-8 read, but the JSON chunk is ASCII, so brace-matching from the
// first '{' recovers it exactly (same pattern as revueltoWheels.test.ts).

type Gltf = {
  extensionsUsed?: string[];
  accessors: { min?: number[]; max?: number[] }[];
  meshes: { primitives: { attributes: { POSITION: number } }[] }[];
};

function parseGltfJson(raw: string): Gltf {
  const start = raw.indexOf("{");
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  expect(end).toBeGreaterThan(start);
  return JSON.parse(raw.slice(start, end)) as Gltf;
}

const slice = JSON.parse(frSliceRaw as unknown as string) as {
  buildings: Building[];
};

const GLB_RAW: Record<string, string> = {
  city_hall: cityHallRaw as unknown as string,
  portugalia: portugaliaRaw as unknown as string,
  plumbers_supply: plumbersRaw as unknown as string,
  tecumseh_mill: tecumsehRaw as unknown as string,
  bank_armory: armoryRaw as unknown as string,
  academy: academyRaw as unknown as string,
  justice_center: justiceRaw as unknown as string,
  cove: coveRaw as unknown as string,
  riverview: riverviewRaw as unknown as string,
  ships_cove: shipsCoveRaw as unknown as string,
  carousel: carouselRaw as unknown as string,
  narrows: narrowsRaw as unknown as string,
  sweet_rose: sweetRoseRaw as unknown as string,
  remington_borden: remingtonRaw as unknown as string,
  robeson: robesonRaw as unknown as string,
  antioch: antiochRaw as unknown as string,
  childrens_museum: childrensRaw as unknown as string,
  baycoast: baycoastRaw as unknown as string,
  lizzie: lizzieRaw as unknown as string,
};

// The 10 batches 2 + 3 entries now point at Tier-2 files (bulk job
// 2026-11-03); their spans carry up to 0.05 m of flush applique, so the
// bounds test below allows 0.11 m on X/Z for exactly those files.
const TIER2_IDS = new Set([
  "city_hall", "portugalia", "plumbers_supply", "tecumseh_mill",
  "bank_armory", "academy", "justice_center", "cove", "riverview",
  "ships_cove",
]);

function dupMean(fp: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [e, n] of fp) {
    x += e;
    y += n;
  }
  return [x / fp.length, y / fp.length];
}

function uniqCount(fp: [number, number][]): number {
  return fp.length > 1 &&
    fp[0][0] === fp[fp.length - 1][0] &&
    fp[0][1] === fp[fp.length - 1][1]
    ? fp.length - 1
    : fp.length;
}

describe("tier1 mount manifest", () => {
  it("mounts exactly the 19 approved models (batches 2 + 3 Tier-2 + batches 4–8, no Bethel 24, no batch-1)", () => {
    expect(TIER1_MODELS).toHaveLength(19);
    expect(TIER1_MODELS.map((m) => m.id).sort()).toEqual(
      [
        "academy",
        "antioch",
        "bank_armory",
        "baycoast",
        "carousel",
        "childrens_museum",
        "city_hall",
        "cove",
        "justice_center",
        "lizzie",
        "narrows",
        "plumbers_supply",
        "portugalia",
        "remington_borden",
        "riverview",
        "robeson",
        "ships_cove",
        "sweet_rose",
        "tecumseh_mill",
      ].sort(),
    );
    for (const m of TIER1_MODELS) {
      expect(m.file).toBe(
        TIER2_IDS.has(m.id) ? `/tier1/${m.id}_tier2.glb` : `/tier1/${m.id}.glb`,
      );
      expect(m.position[1]).toBe(0);
      expect(districtOfWorld(m.position[0], m.position[2])).toBe("fallRiver");
    }
    expect(DISTRICTS.fallRiver).toBeTruthy();
    // Lizzie is the ONE documented non-slice entry: no slice index, OSM
    // source recorded, never a faked sliceIdx.
    const lizzie = TIER1_MODELS.find((m) => m.id === "lizzie")!;
    expect(lizzie.sliceIdx).toBe(-1);
    expect(lizzie.source).toBe("osm:way:213035398");
    expect(TIER1_MODELS.filter((m) => m.sliceIdx < 0)).toEqual([lizzie]);
  });

  it("re-derives every slice manifest entry from its slice building", () => {
    for (const m of TIER1_MODELS) {
      if (m.sliceIdx < 0) continue; // Lizzie: pinned separately below
      const b = slice.buildings[m.sliceIdx];
      expect(b).toBeTruthy();
      expect(b.name).toBe(m.name);
      expect(Math.abs(b.height - m.height)).toBeLessThan(0.01);
      expect(uniqCount(b.footprint)).toBe(m.pointCount);
      const c = dupMean(b.footprint);
      expect(Math.abs(c[0] - m.centroidSlice[0])).toBeLessThan(0.01);
      expect(Math.abs(c[1] - m.centroidSlice[1])).toBeLessThan(0.01);
      expect(m.position[0]).toBeCloseTo(c[0], 2);
      expect(m.position[2]).toBeCloseTo(-c[1], 2);
    }
  });

  it("pins the Lizzie entry to its OSM source (no slice footprint)", () => {
    // OSM way 213035398, fetched 2026-11-03: 4 corners, converted with
    // origin lat 41.636 / lon -70.9205, 111320 m/deg lat, 83198.429 m/deg
    // lon. The slice carries no Lizzie footprint, so no slice building
    // may match this entry (checked in the filter test: removed == the 18
    // slice indices, Lizzie excluded).
    const osmLatLon: [number, number][] = [
      [41.6989337, -71.1563112],
      [41.6990022, -71.1562540],
      [41.6989348, -71.1561104],
      [41.6988663, -71.1561677],
    ];
    const fp = osmLatLon.map(([lat, lon]): [number, number] => [
      (lon + 70.9205) * 83198.429,
      (lat - 41.636) * 111320,
    ]);
    const uniq = fp; // OSM way closes by repeating the first node; the 4 corners are unique
    const cx = uniq.reduce((s, p) => s + p[0], 0) / uniq.length;
    const cy = uniq.reduce((s, p) => s + p[1], 0) / uniq.length;
    const m = TIER1_MODELS.find((x) => x.id === "lizzie")!;
    expect(m.position[0]).toBeCloseTo(cx, 2);
    expect(m.position[2]).toBeCloseTo(-cy, 2);
    expect(m.centroidSlice[0]).toBeCloseTo(cx, 2);
    expect(m.centroidSlice[1]).toBeCloseTo(cy, 2);
    expect(m.pointCount).toBe(4);
    expect(m.height).toBe(10.14);
    // GLB spans (accessor bounds) match the OSM footprint spans exactly
    // at the unique-mean placement — the dup-inclusive mean would sit
    // 1.67 m west and misplace the walls.
    const g = parseGltfJson(GLB_RAW["lizzie"]);
    const es = uniq.map((p) => p[0]);
    const ns = uniq.map((p) => p[1]);
    const wantX = [Math.min(...es) - cx, Math.max(...es) - cx];
    const wantZ = [cy - Math.max(...ns), cy - Math.min(...ns)];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const mesh of g.meshes) {
      for (const prim of mesh.primitives) {
        const acc = g.accessors[prim.attributes.POSITION];
        const [ax, ay, az] = acc.min!;
        const [bx, by, bz] = acc.max!;
        minX = Math.min(minX, ax); maxX = Math.max(maxX, bx);
        minY = Math.min(minY, ay); maxY = Math.max(maxY, by);
        minZ = Math.min(minZ, az); maxZ = Math.max(maxZ, bz);
      }
    }
    expect(Math.abs(minX - wantX[0])).toBeLessThan(0.01);
    expect(Math.abs(maxX - wantX[1])).toBeLessThan(0.01);
    expect(Math.abs(minZ - wantZ[0])).toBeLessThan(0.01);
    expect(Math.abs(maxZ - wantZ[1])).toBeLessThan(0.01);
    expect(Math.abs(minY - -0.3)).toBeLessThan(0.01);
    expect(Math.abs(maxY - (m.height + 0.3))).toBeLessThan(0.01);
  });

  it("filters exactly the 18 slice entries out of the shipped slice (4025 -> 4007)", () => {
    const removed: number[] = [];
    slice.buildings.forEach((b, i) => {
      if (isTier1Building(b)) removed.push(i);
    });
    const sliceIdxs = TIER1_MODELS.filter((m) => m.sliceIdx >= 0).map((m) => m.sliceIdx);
    expect(removed.sort((a, b) => a - b)).toEqual(
      sliceIdxs.sort((a, b) => a - b),
    );
    expect(withoutTier1(slice.buildings)).toHaveLength(
      slice.buildings.length - 18,
    );
  });

  it("carries the height flags, the City Hall overpass caveat, and the Robeson caveat", () => {
    const byId = new Map(TIER1_MODELS.map((m) => [m.id, m]));
    expect(byId.get("academy")!.flag).toMatch(/24\.15.*12/);
    expect(byId.get("justice_center")!.flag).toMatch(/30\.91.*15/);
    expect(byId.get("city_hall")!.flag).toMatch(/overpass void NOT modeled/);
    // Mounted at lidar height despite the flags (flags are carried, not smoothed).
    expect(byId.get("academy")!.height).toBe(24.15);
    expect(byId.get("justice_center")!.height).toBe(30.91);
    expect(byId.get("robeson")!.flag).toMatch(/UNVERIFIED/);
    expect(byId.get("childrens_museum")!.flag).toMatch(/18\.88.*6/);
  });

  it("GLB bounds match the slice footprint spans (Meshopt, Y-up)", () => {
    for (const m of TIER1_MODELS) {
      if (m.sliceIdx < 0) continue; // Lizzie: pinned separately above
      const g = parseGltfJson(GLB_RAW[m.id]);
      expect(g.extensionsUsed).toContain("EXT_meshopt_compression");
      const b = slice.buildings[m.sliceIdx];
      const up = b.footprint.slice(
        0,
        uniqCount(b.footprint) === b.footprint.length
          ? b.footprint.length
          : b.footprint.length - 1,
      );
      const es = up.map((p) => p[0]);
      const ns = up.map((p) => p[1]);
      const c = dupMean(b.footprint);
      const wantX = [Math.min(...es) - c[0], Math.max(...es) - c[0]];
      const wantZ = [c[1] - Math.max(...ns), c[1] - Math.min(...ns)];
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const mesh of g.meshes) {
        for (const prim of mesh.primitives) {
          const acc = g.accessors[prim.attributes.POSITION];
          const [ax, ay, az] = acc.min!;
          const [bx, by, bz] = acc.max!;
          minX = Math.min(minX, ax);
          maxX = Math.max(maxX, bx);
          minY = Math.min(minY, ay);
          maxY = Math.max(maxY, by);
          minZ = Math.min(minZ, az);
          maxZ = Math.max(maxZ, bz);
        }
      }
      // Tier-2 files carry up to 0.05 m of flush applique; Tier-1 files
      // are span-exact. Y is exact for both ([-0.30, h+0.30]).
      const tol = TIER2_IDS.has(m.id) ? 0.11 : 0.01;
      expect(Math.abs(minX - wantX[0])).toBeLessThan(tol);
      expect(Math.abs(maxX - wantX[1])).toBeLessThan(tol);
      expect(Math.abs(minZ - wantZ[0])).toBeLessThan(tol);
      expect(Math.abs(maxZ - wantZ[1])).toBeLessThan(tol);
      // Plinth base -0.30, roof slab to height + 0.30 (pipeline builder).
      expect(Math.abs(minY - -0.3)).toBeLessThan(0.01);
      expect(Math.abs(maxY - (m.height + 0.3))).toBeLessThan(0.01);
    }
  });
});
