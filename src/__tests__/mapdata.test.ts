// Map-data upgrade (2026-11-03): landed GIS names/heights and road lane
// fields, plus the freeway divider helper. These tests guard the landed
// data itself — if a future data edit changes these values, the failure
// names the exact row to re-check instead of silently shipping a regression.
import { describe, expect, it } from "vitest";
import { freewayDividers } from "../world/freeway";
import gis from "../../public/gis-district-newbedford.json";
import slice from "../../public/slice-newbedford.json";

type GisRow = {
  id: string;
  height: number;
  heightSource: string;
  name?: string;
  osmId?: string;
  footprints: [number, number][][];
};
type SliceRoad = {
  highway: string;
  name: string | null;
  points: [number, number][];
  lanes?: number;
  ref?: string;
  oneway?: boolean;
};

const gisRows = (gis as unknown as { buildings: GisRow[] }).buildings;
const roads = (slice as unknown as { roads: SliceRoad[] }).roads;

describe("freewayDividers", () => {
  it("keeps the legacy 2-divider texture when no lane data exists", () => {
    expect(freewayDividers(undefined)).toBe(2);
    expect(freewayDividers(null)).toBe(2);
  });
  it("maps lane counts to dividers (lanes - 1)", () => {
    expect(freewayDividers(1)).toBe(0);
    expect(freewayDividers(2)).toBe(1);
    expect(freewayDividers(3)).toBe(2);
    expect(freewayDividers(4)).toBe(3);
  });
  it("clamps absurd counts instead of drawing absurd textures", () => {
    expect(freewayDividers(9)).toBe(3);
    expect(freewayDividers(0)).toBe(0);
  });
});

describe("GIS upgrade (landed 2026-11-03)", () => {
  it("has 14 named rows", () => {
    expect(gisRows.filter((b) => b.name)).toHaveLength(14);
  });
  it("lands Bethel at Nic's 15 m total height", () => {
    const bethel = gisRows.find((b) => b.id === "massgis:201:248015_820696")!;
    expect(bethel.height).toBe(15.0);
    expect(bethel.heightSource).toContain("nic:2026-11-02");
    expect(bethel.name).toBe("Seamen's Bethel");
    expect(bethel.osmId).toBe("node:12437200636");
  });
  it("lands the two levels-estimates, labelled as estimates", () => {
    const star = gisRows.find((b) => b.id === "massgis:201:247810_820563")!;
    expect(star.height).toBe(18.0);
    expect(star.heightSource).toContain("levels_x3m_estimate");
    expect(star.name).toBe("Star Store");
    const visitor = gisRows.find((b) => b.id === "massgis:201:248010_820776")!;
    expect(visitor.height).toBe(9.0);
    expect(visitor.heightSource).toContain("levels_x3m_estimate");
  });
  it("does NOT assign Standard Times to the wrong footprint", () => {
    // Geometric verification (2026-11-03): the source OSM way's centroid
    // sits inside footprint 247929_820913 (the Elm Street Garage parcel)
    // with zero overlap with 247972_820844. The upgrade table's
    // nearest-centroid assignment to 247972 was wrong; this row must stay
    // an unnamed 8.0 m placeholder until the Standard Times building is
    // resolved against the parcel polygon.
    const row = gisRows.find((b) => b.id === "massgis:201:247972_820844")!;
    expect(row.name).toBeUndefined();
    expect(row.height).toBe(8.0);
  });
  it("keeps the two gap footprints as gaps", () => {
    for (const id of ["massgis:201:247962_820648", "massgis:201:248020_820714"]) {
      const row = gisRows.find((b) => b.id === id)!;
      expect(row.name).toBeUndefined();
      expect(row.height).toBe(8.0);
    }
  });
  it("keeps every footprint non-empty with a finite positive height", () => {
    expect(gisRows).toHaveLength(62);
    for (const b of gisRows) {
      expect(b.footprints.length).toBeGreaterThan(0);
      expect(Number.isFinite(b.height)).toBe(true);
      expect(b.height).toBeGreaterThan(0);
    }
  });
});

describe("slice road lanes (landed 2026-11-03)", () => {
  it("keeps all 16,167 road records", () => {
    expect(roads).toHaveLength(16167);
  });
  it("keeps every lane value in a sane range", () => {
    for (const r of roads) {
      if (r.lanes !== undefined) {
        expect(Number.isInteger(r.lanes)).toBe(true);
        expect(r.lanes).toBeGreaterThanOrEqual(1);
        expect(r.lanes).toBeLessThanOrEqual(6);
      }
    }
  });
  it("gives every named JFK motorway record ref MA 18 and 2 or 3 lanes", () => {
    const jfk = roads.filter(
      (r) => r.highway === "motorway" && r.name !== null && r.name.includes("Kennedy"),
    );
    expect(jfk).toHaveLength(16);
    for (const r of jfk) {
      expect(r.ref).toBe("MA 18");
      expect([2, 3]).toContain(r.lanes);
      expect(r.oneway).toBe(true);
    }
  });
  it("keeps motorway lanes at 2 or 3 (no merge-flare 4)", () => {
    for (const r of roads) {
      if (r.highway === "motorway" && r.lanes !== undefined) {
        expect([2, 3]).toContain(r.lanes);
      }
    }
  });
  it("never invents ref MA 18 for JFK Boulevard", () => {
    const blvd = roads.filter((r) => r.name === "JFK Boulevard");
    expect(blvd.length).toBeGreaterThan(0);
    for (const r of blvd) expect(r.ref).toBeUndefined();
  });
  it("leaves the 7 Dartmouth Mall service records without lane data", () => {
    const mall = roads.filter((r) => r.name === "North Dartmouth Mall");
    expect(mall).toHaveLength(7);
    for (const r of mall) expect(r.lanes).toBeUndefined();
  });
});
