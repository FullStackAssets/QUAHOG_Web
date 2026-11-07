import { describe, expect, it } from "vitest";
import brocktonSliceRaw from "../../public/slice-brockton.json?raw";
import capeSliceRaw from "../../public/slice-cape.json?raw";
import manifestRaw from "../../public/tiles/manifest.json?raw";
import cappielloTileRaw from "../../public/tiles/b_-17_99.json?raw";
import marinaTileRaw from "../../public/tiles/b_107_3.json?raw";
import compoundTileRaw from "../../public/tiles/b_102_-2.json?raw";
import type { Building } from "../slice";
import { DISTRICTS, districtOfWorld, isCrossDistrictObjective, worldCenter } from "../districts";
import { FAST_TRAVEL } from "../places";
import { MISSIONS } from "../mission";

// Expansion (2026-11-07): Brockton + Cape zones — registry, fast-travel,
// tile manifest, shipped-slice data contract, and the Act II/III mission
// re-pointing to the real anchors (Cappiello Boxing Gym, Hyannis Marina,
// Kennedy Compound). Fast-travel only; no drivable corridor.

const inRing = (px: number, pn: number, ring: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
    if ((ni > pn) !== (nj > pn) && px < ((xj - xi) * (pn - ni)) / (nj - ni) + xi) inside = !inside;
  }
  return inside;
};

type SliceShape = {
  name: string;
  origin: { lat: number; lon: number };
  meters_per_degree: { lat: number; lon: number };
  buildings: Building[];
  buildingsStreamed: boolean;
  roads: { highway: string; name: string | null; points: [number, number][] }[];
  water: [number, number][][];
  parking: [number, number][][];
  landmarks: { name: string; kind: string; pos: [number, number]; hero?: boolean }[];
};
const brockton = JSON.parse(brocktonSliceRaw) as SliceShape;
const cape = JSON.parse(capeSliceRaw) as SliceShape;
const manifest = JSON.parse(manifestRaw) as { tile: number; origin: { lat: number; lon: number }; keys: string[]; count: number };

describe("expansion district registry", () => {
  it("registers Brockton (gym anchor center, slice file, Main St spawn)", () => {
    expect(DISTRICTS.brockton.center).toEqual([-8266.4, 49696.5]);
    expect(DISTRICTS.brockton.sliceFile).toBe("slice-brockton.json");
    expect(DISTRICTS.brockton.spawn).toEqual([-8280, -49681]);
  });
  it("registers Cape Cod — Hyannis (marina anchor center, slice file, Willow St spawn)", () => {
    expect(DISTRICTS.cape.center).toEqual([53822.1, 1616.7]);
    expect(DISTRICTS.cape.sliceFile).toBe("slice-cape.json");
    expect(DISTRICTS.cape.spawn).toEqual([53850, -1642]);
  });
  it("converts slice centers to world centers (north -> -z)", () => {
    expect(worldCenter(DISTRICTS.brockton)).toEqual([-8266.4, -49696.5]);
    expect(worldCenter(DISTRICTS.cape)).toEqual([53822.1, -1616.7]);
  });
  it("classifies world points by district", () => {
    // Brockton points (spawn, gym target, fast-travel point)
    expect(districtOfWorld(-8280, -49681)).toBe("brockton");
    expect(districtOfWorld(-8266, -49696)).toBe("brockton");
    // Cape points (spawn, marina, compound)
    expect(districtOfWorld(53850, -1642)).toBe("cape");
    expect(districtOfWorld(53822, -1617)).toBe("cape");
    expect(districtOfWorld(51428, 670)).toBe("cape");
    // Existing districts are unchanged by the new bounds
    expect(districtOfWorld(-256, 106)).toBe("newBedford");
    expect(districtOfWorld(-19972, -7348)).toBe("fallRiver");
    expect(districtOfWorld(-13280, 1781)).toBe("newBedford"); // Westport
    expect(districtOfWorld(-5887.3, -552.3)).toBe("newBedford"); // Dartmouth Mall
    expect(districtOfWorld(6092, 4470)).toBe("newBedford"); // Off the Hook
    expect(districtOfWorld(2048, 45)).toBe("newBedford"); // Fort Phoenix
  });
  it("bounded-district bboxes do not overlap", () => {
    const bs = [DISTRICTS.fallRiver.bounds!, DISTRICTS.brockton.bounds!, DISTRICTS.cape.bounds!];
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        const overlap = !(a.xMax < b.xMin || b.xMax < a.xMin || a.zMax < b.zMin || b.zMax < a.zMin);
        expect(overlap).toBe(false);
      }
    }
  });
});

describe("expansion fast travel", () => {
  it("adds one Brockton point and two Cape points", () => {
    const br = FAST_TRAVEL.find((d) => d.name === "Downtown Brockton");
    expect(br?.pos).toEqual([-8280, -49681]);
    expect(br?.district).toBe("brockton");
    const marina = FAST_TRAVEL.find((d) => d.name === "Hyannis Marina");
    expect(marina?.pos).toEqual([53850, -1642]);
    expect(marina?.district).toBe("cape");
    const compound = FAST_TRAVEL.find((d) => d.name === "Hyannis Port — Kennedy Compound");
    expect(compound?.pos).toEqual([51425, 686]);
    expect(compound?.district).toBe("cape");
  });
  it("counts fast-travel points per district", () => {
    expect(FAST_TRAVEL.filter((d) => d.district === "newBedford")).toHaveLength(9);
    expect(FAST_TRAVEL.filter((d) => d.district === "fallRiver")).toHaveLength(3);
    expect(FAST_TRAVEL.filter((d) => d.district === "brockton")).toHaveLength(1);
    expect(FAST_TRAVEL.filter((d) => d.district === "cape")).toHaveLength(2);
  });
  it("new fast-travel points sit on land, outside building footprints", () => {
    // Points were computed from the staged slices: nearest drivable road
    // vertex to the anchor, outside every footprint and water ring.
    const cases: { slice: SliceShape; tile: Building[]; pos: [number, number] }[] = [
      { slice: brockton, tile: JSON.parse(cappielloTileRaw) as Building[], pos: [-8280, -49681] },
      { slice: cape, tile: JSON.parse(marinaTileRaw) as Building[], pos: [53850, -1642] },
      { slice: cape, tile: JSON.parse(compoundTileRaw) as Building[], pos: [51425, 686] },
    ];
    for (const { slice, tile, pos } of cases) {
      const [x, z] = pos;
      const n = -z; // world z -> slice north
      expect(slice.water.some((ring) => inRing(x, n, ring))).toBe(false);
      expect(tile.some((b) => inRing(x, n, b.footprint))).toBe(false);
    }
  });
});

describe("expansion tile manifest", () => {
  it("extends the live manifest (keys + count)", () => {
    expect(manifest.tile).toBe(500);
    expect(manifest.keys).toHaveLength(1300);
    expect(manifest.count).toBe(106133);
    expect(new Set(manifest.keys).size).toBe(1300);
  });
  it("contains the new zone keys, including grid corners and anchor tiles", () => {
    for (const k of ["-17_99", "107_3", "102_-2", "-24_100", "-10_100", "108_-5", "100_8"]) {
      expect(manifest.keys).toContain(k);
    }
  });
});

describe("expansion slices (public/slice-brockton.json, slice-cape.json)", () => {
  it("shares the NB frame and the NB-schema top keys", () => {
    for (const s of [brockton, cape]) {
      expect(s.origin).toEqual({ lat: 41.636, lon: -70.9205 });
      expect(s.meters_per_degree).toEqual({ lat: 111320.0, lon: 83198.429 });
      expect(s.buildings).toHaveLength(0);
      expect(s.buildingsStreamed).toBe(true);
    }
  });
  it("has the staged counts", () => {
    expect(brockton.roads).toHaveLength(5791);
    expect(brockton.water).toHaveLength(27);
    expect(brockton.landmarks).toHaveLength(28);
    expect(brockton.parking).toHaveLength(219);
    expect(cape.roads).toHaveLength(4987);
    expect(cape.water).toHaveLength(65);
    expect(cape.landmarks).toHaveLength(28);
    expect(cape.parking).toHaveLength(567);
  });
  it("carries the real anchors as hero landmarks", () => {
    const gym = brockton.landmarks.find((l) => l.name === "Cappiello Boxing Gym");
    expect(gym?.hero).toBe(true);
    expect(gym?.pos).toEqual([-8266.35, 49696.48]);
    const marina = cape.landmarks.find((l) => l.name === "Hyannis Marina");
    expect(marina?.hero).toBe(true);
    expect(marina?.pos).toEqual([53822.06, 1616.7]);
    const compound = cape.landmarks.find((l) => l.name === "Kennedy Compound");
    expect(compound?.hero).toBe(true);
    expect(compound?.pos).toEqual([51428.28, -670.15]);
  });
  it("anchor points lie inside a real tile footprint (missions target real buildings)", () => {
    const cases: { tile: Building[]; point: [number, number] }[] = [
      { tile: JSON.parse(cappielloTileRaw) as Building[], point: [-8266.35, 49696.48] },
      { tile: JSON.parse(marinaTileRaw) as Building[], point: [53822.06, 1616.7] },
      { tile: JSON.parse(compoundTileRaw) as Building[], point: [51428.28, -670.15] },
    ];
    for (const { tile, point } of cases) {
      expect(tile.some((b) => inRing(point[0], point[1], b.footprint))).toBe(true);
    }
  });
});

describe("expansion mission re-pointing", () => {
  it("The Undefeated targets the real Cappiello Boxing Gym in Brockton", () => {
    const m = MISSIONS.find((x) => x.title === "The Undefeated")!;
    expect(m.steps).toHaveLength(2);
    for (const s of m.steps) {
      expect(s.target).toEqual([-8266, 0, -49696]);
      expect(districtOfWorld(s.target![0], s.target![2])).toBe("brockton");
      expect(isCrossDistrictObjective(s.target!, "newBedford")).toBe(true);
    }
  });
  it("Heritage Marina targets the real Hyannis Marina on the Cape", () => {
    const m = MISSIONS.find((x) => x.title === "Heritage Marina")!;
    expect(m.steps).toHaveLength(2);
    for (const s of m.steps) {
      expect(s.target).toEqual([53822, 0, -1617]);
      expect(districtOfWorld(s.target![0], s.target![2])).toBe("cape");
      expect(isCrossDistrictObjective(s.target!, "newBedford")).toBe(true);
    }
  });
  it("Compound Interest targets the real Kennedy Compound in Hyannis Port", () => {
    const m = MISSIONS.find((x) => x.title === "Compound Interest")!;
    expect(m.steps).toHaveLength(2);
    for (const s of m.steps) {
      expect(s.target).toEqual([51428, 0, 670]);
      expect(districtOfWorld(s.target![0], s.target![2])).toBe("cape");
      expect(isCrossDistrictObjective(s.target!, "newBedford")).toBe(true);
    }
  });
  it("no mission target keeps a fictional coordinate", () => {
    for (const m of MISSIONS) {
      for (const s of m.steps) {
        expect(s.target).not.toEqual([-8350, 0, 49620]);
        expect(s.target).not.toEqual([-10520, 0, 47420]);
        expect(s.target).not.toEqual([-8480, 0, 52100]);
      }
    }
  });
});
