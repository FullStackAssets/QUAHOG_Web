import { describe, expect, it } from "vitest";
import gisRaw from "../../public/gis-district-newbedford.json?raw";
import tile11Raw from "../../public/tiles/b_-1_-1.json?raw";
import tile10Raw from "../../public/tiles/b_-1_0.json?raw";
import tile21Raw from "../../public/tiles/b_-2_-1.json?raw";
import { districtOfWorld } from "../districts";
import { NB_TIER1_MODELS, NB_TIER1_GIS_IDS } from "../world/nbTier1Models";
import rodmanRaw from "../../public/tier1/rodman_detail.glb?raw";
import starRaw from "../../public/tier1/star_store.glb?raw";
import cherryRaw from "../../public/tier1/cherry.glb?raw";
import cartersRaw from "../../public/tier1/carters.glb?raw";
import customRaw from "../../public/tier1/custom_house.glb?raw";
import visitorRaw from "../../public/tier1/visitor_center.glb?raw";
import ymcaRaw from "../../public/tier1/ymca.glb?raw";
import whalingRaw from "../../public/tier1/whaling_museum_detail.glb?raw";
import doubleRaw from "../../public/tier1/double_bank_detail.glb?raw";
import corkRaw from "../../public/tier1/cork_detail.glb?raw";
import busRaw from "../../public/tier1/bus_terminal.glb?raw";

// New Bedford Tier-1 mount (batches 4–8, bulk job 2026-11-03). Same
// JSON-chunk recovery pattern as tier1Models.test.ts: only the JSON chunk
// is parsed, so the ?raw UTF-8 read of the BIN bytes cannot corrupt it.
// NB placement convention differs from Fall River: the pipeline GLBs were
// built around the UNIQUE-vertex mean of their footprint (not the
// dup-inclusive mean) — verified span-exact below.
// DETAIL PASS (2026-11-03 mount): rodman, double_bank, cork, and
// whaling_museum imports repointed to _detail files. Two deliberate
// changes, each marked at its site: (1) the meshopt assertion is skipped
// for detail entries — the _detail GLBs are uncompressed Blender exports
// (PackGLB handles uncompressed natively, per the downtown test header),
// so meshopt pins the old pipeline's compression, not a placement
// contract; (2) the bounds test pins detail entries' MASS mesh(es)
// position- and span-exact (0.01 m) with an overall-span cap of
// footprint + 3.5 m (the detail-pass verifier contract), because temple
// steps, columns and quoins protrude past the wall plane by design.
// The flags test is unchanged: detail flags still carry ESTIMATED
// (rodman/double_bank/cork) and TOO LOW (whaling_museum).

type Gltf = {
  extensionsUsed?: string[];
  accessors: { min?: number[]; max?: number[] }[];
  meshes: { name?: string; primitives: { attributes: { POSITION: number } }[] }[];
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

function glbBounds(raw: string, isDetail = false): { min: number[]; max: number[] } {
  const g = parseGltfJson(raw);
  // Deliberate change (detail pass 2026-11-03): detail-pass GLBs are
  // uncompressed Blender exports, so the meshopt assertion is skipped for
  // them — it pins the old pipeline's compression, not a placement
  // contract, and PackGLB handles uncompressed GLBs natively.
  if (!isDetail) expect(g.extensionsUsed).toContain("EXT_meshopt_compression");
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
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function uniqMean(fp: [number, number][]): [number, number] {
  const u = fp.length > 1 && fp[0][0] === fp[fp.length - 1][0] && fp[0][1] === fp[fp.length - 1][1]
    ? fp.slice(0, -1)
    : fp;
  return [u.reduce((s, p) => s + p[0], 0) / u.length, u.reduce((s, p) => s + p[1], 0) / u.length];
}
// Per-mesh bounds (for the detail-pass mass-mesh check below).
function glbMeshBounds(raw: string): { name: string; min: number[]; max: number[] }[] {
  const g = parseGltfJson(raw);
  return g.meshes.map((mesh) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const prim of mesh.primitives) {
      const acc = g.accessors[prim.attributes.POSITION];
      const [ax, ay, az] = acc.min!;
      const [bx, by, bz] = acc.max!;
      minX = Math.min(minX, ax); maxX = Math.max(maxX, bx);
      minY = Math.min(minY, ay); maxY = Math.max(maxY, by);
      minZ = Math.min(minZ, az); maxZ = Math.max(maxZ, bz);
    }
    return { name: mesh.name ?? "", min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  });
}

function uniq(fp: [number, number][]): [number, number][] {
  return fp.length > 1 && fp[0][0] === fp[fp.length - 1][0] && fp[0][1] === fp[fp.length - 1][1]
    ? fp.slice(0, -1)
    : fp;
}

const gis = JSON.parse(gisRaw as unknown as string) as {
  buildings: { id: string; footprints: [number, number][][]; height: number; name?: string }[];
  replaces: Record<string, { index: number; cx: number; cy: number }[]>;
};
const tiles: Record<string, { footprint: [number, number][]; height: number; name?: string }[]> = {
  "-1_-1": JSON.parse(tile11Raw as unknown as string),
  "-1_0": JSON.parse(tile10Raw as unknown as string),
  "-2_-1": JSON.parse(tile21Raw as unknown as string),
};
const gisById = new Map(gis.buildings.map((b) => [b.id, b]));

const GLB_RAW: Record<string, string> = {
  rodman: rodmanRaw as unknown as string,
  star_store: starRaw as unknown as string,
  cherry: cherryRaw as unknown as string,
  carters: cartersRaw as unknown as string,
  custom_house: customRaw as unknown as string,
  visitor_center: visitorRaw as unknown as string,
  ymca: ymcaRaw as unknown as string,
  whaling_museum: whalingRaw as unknown as string,
  double_bank: doubleRaw as unknown as string,
  cork: corkRaw as unknown as string,
  bus_terminal: busRaw as unknown as string,
};

describe("nb tier1 mount manifest", () => {
  it("mounts exactly the 11 NB models (no Bethel 24 hero replacement)", () => {
    expect(NB_TIER1_MODELS).toHaveLength(11);
    expect(NB_TIER1_MODELS.map((m) => m.id).sort()).toEqual(
      [
        "bus_terminal", "carters", "cherry", "cork", "custom_house",
        "double_bank", "rodman", "star_store", "visitor_center",
        "whaling_museum", "ymca",
      ].sort(),
    );
    expect(NB_TIER1_MODELS.find((m) => m.id === "bethel")).toBeUndefined();
    for (const m of NB_TIER1_MODELS) {
      // Deliberate change (detail pass 2026-11-03): detail-pass entries
      // mount their _detail file; all other entries keep /tier1/<id>.glb.
      const detailUpgrade = (m.flag ?? "").includes("detail-pass");
      expect(m.file).toBe(detailUpgrade ? `/tier1/${m.id}_detail.glb` : `/tier1/${m.id}.glb`);
      expect(m.position[1]).toBe(0);
      expect(districtOfWorld(m.position[0], m.position[2])).toBe("newBedford");
      expect(m.position[0]).toBeCloseTo(m.centroid[0], 2);
      expect(m.position[2]).toBeCloseTo(-m.centroid[1], 2);
    }
    // GIS filter list = exactly the 10 GIS-backed entries (bus is tile-only).
    expect([...NB_TIER1_GIS_IDS].sort()).toEqual(
      NB_TIER1_MODELS.filter((m) => m.gisId).map((m) => m.gisId as string).sort(),
    );
    expect(NB_TIER1_GIS_IDS).toHaveLength(10);
  });

  it("derives every GIS entry from its GIS record (unique-mean centroid, height)", () => {
    for (const m of NB_TIER1_MODELS) {
      if (m.centroidSource !== "gis") continue;
      const g = gisById.get(m.gisId as string);
      expect(g, `no GIS record for ${m.id}`).toBeTruthy();
      expect(m.height).toBe(g!.height);
      const c = uniqMean(g!.footprints[0]);
      expect(Math.abs(c[0] - m.centroid[0])).toBeLessThan(0.01);
      expect(Math.abs(c[1] - m.centroid[1])).toBeLessThan(0.01);
    }
    // Custom House + Visitor Center are tile-built: their GLB spans match
    // the tile footprint, not the GIS polygon (checked in the bounds test).
    for (const m of NB_TIER1_MODELS) {
      if (m.centroidSource !== "tile" || m.gisId === null) continue;
      const t = tiles[m.tileKey as string][m.tileIdx as number];
      const c = uniqMean(t.footprint);
      expect(Math.abs(c[0] - m.centroid[0])).toBeLessThan(0.01);
      expect(Math.abs(c[1] - m.centroid[1])).toBeLessThan(0.01);
    }
  });

  it("GLB bounds match the footprint spans (GIS or tile, unique-mean placement)", () => {
    for (const m of NB_TIER1_MODELS) {
      const isDetail = (m.flag ?? "").includes("detail-pass");
      const b = glbBounds(GLB_RAW[m.id], isDetail);
      const fp = m.centroidSource === "gis"
        ? gisById.get(m.gisId as string)!.footprints[0]
        : tiles[m.tileKey as string][m.tileIdx as number].footprint;
      const u = uniq(fp);
      const es = u.map((p) => p[0]);
      const ns = u.map((p) => p[1]);
      const c = uniqMean(fp);
      const wantX = [Math.min(...es) - c[0], Math.max(...es) - c[0]];
      const wantZ = [c[1] - Math.max(...ns), c[1] - Math.min(...ns)];
      if (isDetail) {
        // Deliberate change (detail pass 2026-11-03): temple steps,
        // columns and quoins protrude past the wall plane by design, so
        // the 0.01 m overall-bounds tolerance no longer describes these
        // four. The exact contract is pinned instead on the MASS mesh
        // (named mass*): position- and span-exact vs the footprint
        // (0.01 m), plus an overall-span cap of footprint + 3.5 m per
        // axis (the detail-pass verifier contract). Y range is unchanged.
        const masses = glbMeshBounds(GLB_RAW[m.id]).filter(
          (mm) => mm.name.toLowerCase().startsWith("mass"),
        );
        expect(masses.length, `no mass mesh in ${m.id}`).toBeGreaterThan(0);
        expect(Math.abs(Math.min(...masses.map((mm) => mm.min[0])) - wantX[0])).toBeLessThan(0.01);
        expect(Math.abs(Math.max(...masses.map((mm) => mm.max[0])) - wantX[1])).toBeLessThan(0.01);
        expect(Math.abs(Math.min(...masses.map((mm) => mm.min[2])) - wantZ[0])).toBeLessThan(0.01);
        expect(Math.abs(Math.max(...masses.map((mm) => mm.max[2])) - wantZ[1])).toBeLessThan(0.01);
        expect(b.max[0] - b.min[0]).toBeLessThanOrEqual((wantX[1] - wantX[0]) + 3.5);
        expect(b.max[2] - b.min[2]).toBeLessThanOrEqual((wantZ[1] - wantZ[0]) + 3.5);
      } else {
        // GIS-matched: span-exact (0.01). Tile-matched: bus_terminal GLB is
        // 19.60x44.00 vs tile 19.53x43.98 (0.07/0.02 rounding), custom/visitor
        // exact — 0.11 covers all three.
        const tol = m.centroidSource === "gis" ? 0.01 : 0.11;
        expect(Math.abs(b.min[0] - wantX[0])).toBeLessThan(tol);
        expect(Math.abs(b.max[0] - wantX[1])).toBeLessThan(tol);
        expect(Math.abs(b.min[2] - wantZ[0])).toBeLessThan(tol);
        expect(Math.abs(b.max[2] - wantZ[1])).toBeLessThan(tol);
      }
      expect(Math.abs(b.min[1] - -0.3)).toBeLessThan(0.01);
      expect(Math.abs(b.max[1] - (m.height + 0.3))).toBeLessThan(0.01);
    }
    // Star Store must be the batch-5 rebuild at 18.0 m, not the batch-4
    // 21.0 m tile version.
    const star = NB_TIER1_MODELS.find((m) => m.id === "star_store")!;
    expect(star.height).toBe(18.0);
    expect(glbBounds(GLB_RAW["star_store"]).max[1]).toBeCloseTo(18.3, 2);
  });

  it("carries the estimated-height flags", () => {
    const byId = new Map(NB_TIER1_MODELS.map((m) => [m.id, m]));
    for (const id of ["rodman", "cherry", "carters", "custom_house", "ymca", "double_bank", "cork", "bus_terminal"]) {
      expect(byId.get(id)!.flag).toMatch(/ESTIMATED/);
    }
    expect(byId.get("whaling_museum")!.flag).toMatch(/TOO LOW/);
  });

  it("every tile exclusion in the manifest drops via the replaces guard (< 1.0 m)", () => {
    // withoutReplaced() drops a tile building only when the recorded
    // replaces centroid matches the tile building's dup-inclusive centroid
    // within 1.0 m. Six shipped centroids were stale (2.46–14.58 m off) and
    // one entry was missing; the bulk job corrected/added them. This pins
    // the shipped gis-district-newbedford.json data itself.
    const dupMean = (fp: [number, number][]): [number, number] => [
      fp.reduce((s, p) => s + p[0], 0) / fp.length,
      fp.reduce((s, p) => s + p[1], 0) / fp.length,
    ];
    for (const m of NB_TIER1_MODELS) {
      if (m.tileKey === null || m.tileIdx === null) continue;
      const t = tiles[m.tileKey][m.tileIdx];
      const entry = (gis.replaces[m.tileKey] ?? []).find((r) => r.index === m.tileIdx);
      expect(entry, `no replaces entry for ${m.id} (${m.tileKey} idx ${m.tileIdx})`).toBeTruthy();
      const c = dupMean(t.footprint);
      const d = Math.hypot(c[0] - entry!.cx, c[1] - entry!.cy);
      expect(d).toBeLessThan(1.0);
    }
  });
});
