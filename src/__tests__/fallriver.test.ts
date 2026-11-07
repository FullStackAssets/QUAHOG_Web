import { describe, expect, it } from "vitest";
import frSliceRaw from "../../public/slice-fallriver.json?raw";
import type { Building, Road } from "../slice";
import { DISTRICTS, districtOfWorld, worldCenter } from "../districts";
import { FAST_TRAVEL } from "../places";
import { prepareRoads } from "../world/roadPrep";

// Fall River district integration (2026-11-03): registry, fast-travel,
// SKIP-filter decision, shipped-slice data contract (heights, Lizzie trap,
// lanes), and the cross-district gate helper.

const road = (
  highway: string,
  name: string | null,
  points: [number, number][],
  width = 8,
  bridge?: boolean,
): Road => ({ highway, name, points, width, bridge });

describe("district registry", () => {
  it("keeps New Bedford exactly (center, file, spawn)", () => {
    expect(DISTRICTS.newBedford.center).toEqual([-266, -100]);
    expect(DISTRICTS.newBedford.sliceFile).toBe("slice-newbedford.json");
    expect(DISTRICTS.newBedford.spawn).toEqual([-256, 106]);
  });
  it("registers Fall River (package center, slice file, Cove spawn)", () => {
    expect(DISTRICTS.fallRiver.center).toEqual([-19309.9, 7144.6]);
    expect(DISTRICTS.fallRiver.sliceFile).toBe("slice-fallriver.json");
    expect(DISTRICTS.fallRiver.spawn).toEqual([-19972, -7348]);
  });
  it("converts slice center to world center (north -> -z)", () => {
    expect(worldCenter(DISTRICTS.fallRiver)).toEqual([-19309.9, -7144.6]);
    expect(worldCenter(DISTRICTS.newBedford)).toEqual([-266, 100]);
  });
  it("classifies world points by district", () => {
    // Fall River fast-travel points (world coords)
    expect(districtOfWorld(-19972, -7348)).toBe("fallRiver");
    expect(districtOfWorld(-19599, -7060)).toBe("fallRiver");
    expect(districtOfWorld(-19492.1, -7191.2)).toBe("fallRiver");
    // New Bedford points — including far ones (Westport, Dartmouth Mall)
    expect(districtOfWorld(-256, 106)).toBe("newBedford");
    expect(districtOfWorld(-13280, 1781)).toBe("newBedford");
    expect(districtOfWorld(-5887.3, -552.3)).toBe("newBedford");
    // A New Bedford mission target must never classify as Fall River
    expect(districtOfWorld(-272.23, 106.5)).toBe("newBedford");
  });
});

describe("fast travel", () => {
  it("keeps the two existing Fall River points exactly", () => {
    const cove = FAST_TRAVEL.find((d) => d.name === "Fall River — Battleship Cove");
    const lizzie = FAST_TRAVEL.find((d) => d.name === "Lizzie Borden House");
    expect(cove?.pos).toEqual([-19972, -7348]);
    expect(lizzie?.pos).toEqual([-19599, -7060]);
    expect(cove?.district).toBe("fallRiver");
    expect(lizzie?.district).toBe("fallRiver");
  });
  it("adds Government Center snapped to Sullivan Drive, NOT the freeway", () => {
    const gov = FAST_TRAVEL.find((d) => d.name === "Downtown Fall River — Government Center");
    expect(gov?.pos).toEqual([-19492.1, -7191.2]);
    expect(gov?.district).toBe("fallRiver");
    // Deliberately asserted: I-195 passes 6.8 m from City Hall. A
    // nearest-road snap would strand the player on the freeway, so this
    // point is a fixed coordinate, never recomputed from roads.
  });
  it("moves Dartmouth Mall from Route 6 to the mall's interior drive", () => {
    const mall = FAST_TRAVEL.find((d) => d.name === "Dartmouth Mall");
    expect(mall?.pos).toEqual([-5887.3, -552.3]);
    expect(mall?.district).toBe("newBedford");
    // Deliberately asserted: the old Route 6 point ([-3921, 360]) was
    // ~2.1 km from the building. The new point is the nearest drivable
    // road to the tile-building centroid (110.1 m), outside the
    // footprint (7.5 m clear) — NOT the centroid itself, which sits
    // inside the footprint. Exactly one Dartmouth Mall entry exists.
    expect(FAST_TRAVEL.filter((d) => d.name === "Dartmouth Mall")).toHaveLength(1);
  });
  it("every entry carries a district", () => {
    for (const d of FAST_TRAVEL) {
      expect(["newBedford", "fallRiver", "brockton", "cape"]).toContain(d.district);
    }
    expect(FAST_TRAVEL.filter((d) => d.district === "fallRiver")).toHaveLength(3);
  });
});

describe("SKIP-filter decision (prepareRoads)", () => {
  it("NB: mall exemption preserved, other named service still filtered", () => {
    const roads = [
      road("service", "North Dartmouth Mall", [[0, 0], [60, 0]], 4.5),
      road("service", "Plaza Way", [[0, 0], [60, 0]], 4.5),
      road("service", null, [[0, 0], [60, 0]], 4.5),
      road("residential", "Main Street", [[0, 0], [60, 0]], 8),
    ];
    const out = prepareRoads(roads, [], [], "newBedford");
    expect(out.some((r) => r.name === "North Dartmouth Mall")).toBe(true);
    expect(out.some((r) => r.name === "Plaza Way")).toBe(false);
    expect(out.some((r) => r.highway === "service" && !r.name)).toBe(false);
    expect(out.some((r) => r.name === "Main Street")).toBe(true);
  });
  it("FR: named service access roads survive, unnamed service filtered", () => {
    const roads = [
      road("service", "Battleship Cove Drive", [[0, 0], [60, 0]], 7),
      road("service", "Front Street", [[0, 0], [60, 0]], 7),
      road("service", null, [[0, 0], [60, 0]], 4.5),
      road("motorway", null, [[0, 0], [600, 0]], 16),
    ];
    const out = prepareRoads(roads, [], [], "fallRiver");
    expect(out.some((r) => r.name === "Battleship Cove Drive")).toBe(true);
    expect(out.some((r) => r.name === "Front Street")).toBe(true);
    expect(out.some((r) => r.highway === "service" && !r.name)).toBe(false);
    expect(out.some((r) => r.highway === "motorway")).toBe(true);
  });
  it("FR: mall exemption does NOT leak into Fall River", () => {
    const out = prepareRoads(
      [road("service", "North Dartmouth Mall", [[0, 0], [60, 0]], 4.5)],
      [], [], "fallRiver",
    );
    expect(out).toHaveLength(0);
  });
});

describe("shipped Fall River slice (public/slice-fallriver.json)", () => {
  const slice = JSON.parse(frSliceRaw) as {
    buildings: Building[];
    buildingsStreamed: boolean;
    roads: Road[];
    water: [number, number][][];
    parking: [number, number][][];
    landmarks: { name: string; pos: [number, number] }[];
  };

  it("has the NB-schema counts (buildings stream from tiles)", () => {
    // Expansion (2026-11-07): FR re-exported in the NB schema — buildings
    // live in tiles, the slice carries roads/water/landmarks/parking only.
    // The 4,025 inline buildings (26 lidar + 1 measured heights) are
    // preserved in ~/workspace/quahog-expansion/stage/fr/slice-fallriver-legacy.json.
    expect(slice.buildings).toHaveLength(0);
    expect(slice.buildingsStreamed).toBe(true);
    expect(slice.roads).toHaveLength(1603);
    expect(slice.landmarks).toHaveLength(15);
    // 3 OSM water ways + 1 coastline-derived bay/river ring (Nov 3 water fix:
    // Mt. Hope Bay / Taunton water is mapped as coastline, not water polygons)
    expect(slice.water).toHaveLength(4);
    expect(slice.parking).toHaveLength(7);
  });
  it("drops the unverified Lizzie landmark pin (buildings stream from tiles)", () => {
    // The Lizzie footprint check lived on slice.buildings, which is empty
    // by schema now; the landmark pins must still be absent.
    expect(slice.landmarks.some((l) => l.name === "Lizzie Borden House")).toBe(false);
    expect(slice.landmarks.some((l) => l.name === "Seamen's Bethel")).toBe(false);
  });
  it("carries no zero lanes and no invented lane values", () => {
    for (const r of slice.roads) {
      if (r.lanes !== undefined) expect(r.lanes).toBeGreaterThan(0);
      if (r.oneway !== undefined) expect(r.oneway).toBe(true);
    }
    // I-195 mainline carries MassDOT's 3 lanes; interchange fragments gap
    const mainline = slice.roads.filter((r) => r.ref === "I 195" && r.lanes !== undefined);
    expect(mainline.length).toBeGreaterThan(0);
    for (const r of mainline) expect(r.lanes).toBe(3);
  });
  it("fast-travel points sit on land, not in a water ring", () => {
    const inRing = (px: number, pn: number, ring: [number, number][]) => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
        if ((ni > pn) !== (nj > pn) && px < ((xj - xi) * (pn - ni)) / (nj - ni) + xi) inside = !inside;
      }
      return inside;
    };
    // slice [east, north] coords of the three FT points
    for (const [x, n] of [[-19972, 7348], [-19599, 7080], [-19492.1, 7191.2]] as const) {
      expect(slice.water.some((ring) => inRing(x, n, ring))).toBe(false);
    }
  });
  it("bay/river ring is closed and the Braga span crosses it", () => {
    const inRing = (px: number, pn: number, ring: [number, number][]) => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
        if ((ni > pn) !== (nj > pn) && px < ((xj - xi) * (pn - ni)) / (nj - ni) + xi) inside = !inside;
      }
      return inside;
    };
    // new ring is closed like the shipped ways
    const bay = slice.water[slice.water.length - 1];
    expect(bay.length).toBeGreaterThan(100);
    expect(bay[0]).toEqual(bay[bay.length - 1]);
    // The museum-ship centroid check lived on slice.buildings, which is
    // empty by schema now (expansion 2026-11-07); the ships' footprints
    // still exist in the tiles. The ring shape itself is unchanged.
    // at least one motorway vertex sits over the new water (Braga span in-bbox)
    const over = slice.roads
      .filter((r) => r.highway === "motorway")
      .flatMap((r) => r.points)
      .some(([x, n]) => slice.water.some((ring) => inRing(x, n, ring)));
    expect(over).toBe(true);
  });
  it("the real slice keeps all six named service streets for the exemption", () => {
    const out = prepareRoads(
      slice.roads,
      slice.water,
      slice.landmarks.map((l) => l.name),
      "fallRiver",
    );
    for (const name of ["17th Street", "Battleship Cove Drive", "Borden Street", "Front Street", "Granite Street", "Purchase Street"]) {
      expect(out.some((r) => r.name === name)).toBe(true);
    }
    // motorway records survive the pipeline (I-195 + links)
    expect(out.some((r) => r.highway === "motorway")).toBe(true);
    expect(out.some((r) => r.highway === "motorway_link")).toBe(true);
    // bridges survive
    expect(out.some((r) => r.bridge)).toBe(true);
  });
});
