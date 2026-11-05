import { describe, expect, it } from "vitest";
import gisRaw from "../../public/gis-district-newbedford.json?raw";
import tile11Raw from "../../public/tiles/b_-1_-1.json?raw";
import tile10Raw from "../../public/tiles/b_-1_0.json?raw";
import tile21Raw from "../../public/tiles/b_-2_-1.json?raw";
import tile20Raw from "../../public/tiles/b_-2_0.json?raw";
import { districtOfWorld } from "../districts";
import { DOWNTOWN_TIER1_MODELS, DOWNTOWN_TIER1_GIS_IDS } from "../world/downtownTier1Models";
import s01_gis_248020_820714Raw from "../../public/tier1/s01_gis_248020_820714.glb?raw";
import s02_gis_248022_820728Raw from "../../public/tier1/s02_gis_248022_820728.glb?raw";
import s03_gis_248012_820742Raw from "../../public/tier1/s03_gis_248012_820742.glb?raw";
import s04_gis_248011_820793Raw from "../../public/tier1/s04_gis_248011_820793.glb?raw";
import s05_gis_248006_820660Raw from "../../public/tier1/s05_gis_248006_820660.glb?raw";
import s06_tile_tile__1_0_21Raw from "../../public/tier1/s06_tile_tile__1_0_21.glb?raw";
import s07_gis_247989_820841Raw from "../../public/tier1/s07_gis_247989_820841.glb?raw";
import s08_gis_247986_820733Raw from "../../public/tier1/s08_gis_247986_820733_detail.glb?raw";
import s09_gis_247981_820805Raw from "../../public/tier1/s09_gis_247981_820805.glb?raw";
import s10_gis_247975_820830Raw from "../../public/tier1/s10_gis_247975_820830.glb?raw";
import s11_gis_247972_820844Raw from "../../public/tier1/s11_gis_247972_820844.glb?raw";
import s12_gis_247954_820579Raw from "../../public/tier1/s12_gis_247954_820579.glb?raw";
import s13_gis_247962_820648Raw from "../../public/tier1/s13_gis_247962_820648.glb?raw";
import s14_gis_247953_820768Raw from "../../public/tier1/s14_gis_247953_820768_detail.glb?raw";
import s15_gis_247929_820913Raw from "../../public/tier1/s15_gis_247929_820913.glb?raw";
import s16_gis_247933_820644Raw from "../../public/tier1/s16_gis_247933_820644_detail.glb?raw";
import s17_gis_247929_820785Raw from "../../public/tier1/s17_gis_247929_820785_detail.glb?raw";
import s18_gis_247927_820805Raw from "../../public/tier1/s18_gis_247927_820805.glb?raw";
import s19_gis_247924_820723Raw from "../../public/tier1/s19_gis_247924_820723.glb?raw";
import s20_gis_247898_820658Raw from "../../public/tier1/s20_gis_247898_820658.glb?raw";
import s21_gis_247897_820477Raw from "../../public/tier1/s21_gis_247897_820477.glb?raw";
import s22_gis_247874_820578Raw from "../../public/tier1/s22_gis_247874_820578.glb?raw";
import s23_gis_247838_820787Raw from "../../public/tier1/s23_gis_247838_820787.glb?raw";
import s24_gis_247859_820649Raw from "../../public/tier1/s24_gis_247859_820649.glb?raw";
import s25_gis_247819_820872Raw from "../../public/tier1/s25_gis_247819_820872.glb?raw";
import s26_gis_247819_820504Raw from "../../public/tier1/s26_gis_247819_820504.glb?raw";
import s27_tile_tile__1__1_74Raw from "../../public/tier1/s27_tile_tile__1__1_74.glb?raw";
import s28_tile_tile__1__1_78Raw from "../../public/tier1/s28_tile_tile__1__1_78.glb?raw";
import s29_tile_tile__2__1_0Raw from "../../public/tier1/s29_tile_tile__2__1_0_detail.glb?raw";
import s30_tile_tile__2_0_2Raw from "../../public/tier1/s30_tile_tile__2_0_2.glb?raw";
import s31_gis_248030_820646Raw from "../../public/tier1/s31_gis_248030_820646.glb?raw";
import s32_gis_248031_820658Raw from "../../public/tier1/s32_gis_248031_820658.glb?raw";
import s33_tile_tile__1_0_27Raw from "../../public/tier1/s33_tile_tile__1_0_27.glb?raw";
import s34_gis_248056_820832Raw from "../../public/tier1/s34_gis_248056_820832_detail.glb?raw";
import s35_gis_248062_820786Raw from "../../public/tier1/s35_gis_248062_820786.glb?raw";
import s36_gis_248098_820737Raw from "../../public/tier1/s36_gis_248098_820737_detail.glb?raw";
import s37_gis_248103_820706Raw from "../../public/tier1/s37_gis_248103_820706_detail.glb?raw";
import s38_gis_248109_820692Raw from "../../public/tier1/s38_gis_248109_820692.glb?raw";
import s39_gis_248115_820708Raw from "../../public/tier1/s39_gis_248115_820708.glb?raw";
import s40_tile_tile__1_0_23Raw from "../../public/tier1/s40_tile_tile__1_0_23.glb?raw";
import s41_gis_248126_820567Raw from "../../public/tier1/s41_gis_248126_820567_detail.glb?raw";
import s42_gis_248126_820711Raw from "../../public/tier1/s42_gis_248126_820711.glb?raw";
import s43_gis_248127_820664Raw from "../../public/tier1/s43_gis_248127_820664.glb?raw";
import s44_tile_tile__1_0_26Raw from "../../public/tier1/s44_tile_tile__1_0_26.glb?raw";
import s45_gis_248150_820747Raw from "../../public/tier1/s45_gis_248150_820747.glb?raw";
import s46_gis_248141_820715Raw from "../../public/tier1/s46_gis_248141_820715.glb?raw";
import s47_gis_248154_820664Raw from "../../public/tier1/s47_gis_248154_820664.glb?raw";
import s48_gis_248145_820625Raw from "../../public/tier1/s48_gis_248145_820625_detail.glb?raw";
import s49_gis_248151_820780Raw from "../../public/tier1/s49_gis_248151_820780.glb?raw";
import s50_gis_248160_820712Raw from "../../public/tier1/s50_gis_248160_820712.glb?raw";
import s51_gis_248164_820698Raw from "../../public/tier1/s51_gis_248164_820698.glb?raw";
import s52_gis_248169_820665Raw from "../../public/tier1/s52_gis_248169_820665.glb?raw";
import s53_tile_tile__1__1_10Raw from "../../public/tier1/s53_tile_tile__1__1_10.glb?raw";
import s54_gis_248208_820877Raw from "../../public/tier1/s54_gis_248208_820877.glb?raw";
import s55_gis_248218_820836Raw from "../../public/tier1/s55_gis_248218_820836.glb?raw";
import s56_gis_248221_820893Raw from "../../public/tier1/s56_gis_248221_820893.glb?raw";
import s57_gis_248223_820929Raw from "../../public/tier1/s57_gis_248223_820929.glb?raw";
import s58_gis_248224_820800Raw from "../../public/tier1/s58_gis_248224_820800.glb?raw";
import s59_gis_248232_820774Raw from "../../public/tier1/s59_gis_248232_820774.glb?raw";
import s60_gis_248232_820881Raw from "../../public/tier1/s60_gis_248232_820881.glb?raw";
import d_695_pleasantRaw from "../../public/tier1/d_695_pleasant.glb?raw";
import d_700_pleasantRaw from "../../public/tier1/d_700_pleasant.glb?raw";
import d_regency_towerRaw from "../../public/tier1/d_regency_tower.glb?raw";
import d_147_8thRaw from "../../public/tier1/d_147_8th.glb?raw";
import d_150_8thRaw from "../../public/tier1/d_150_8th.glb?raw";
import d_162_elmRaw from "../../public/tier1/d_162_elm.glb?raw";
import d_629_purchaseRaw from "../../public/tier1/d_629_purchase.glb?raw";
import d_636_purchaseRaw from "../../public/tier1/d_636_purchase.glb?raw";
import d_289_acushnetRaw from "../../public/tier1/d_289_acushnet.glb?raw";
import d_first_baptistRaw from "../../public/tier1/d_first_baptist.glb?raw";
import d_walgreensRaw from "../../public/tier1/d_walgreens.glb?raw";
import d_nb_city_hallRaw from "../../public/tier1/d_nb_city_hall.glb?raw";

// Downtown New Bedford regular-building mount (upgrade round 2026-11-03).
// Same JSON-chunk recovery pattern as nbTier1Models.test.ts: only the JSON
// chunk is parsed, so the ?raw UTF-8 read of the BIN bytes cannot corrupt
// it. Downtown rules differ from the landmarks in two documented ways:
// (1) these GLBs are UNCOMPRESSED (no EXT_meshopt_compression) — PackGLB
// handles uncompressed GLBs natively; the Meshopt decoder only engages
// for compressed buffers. No Meshopt assertion here, by design.
// (2) Y range is [0, height + 0.35] (ground-flush base + roof cap), not
// the landmarks' [-0.30, height + 0.30] skirt; and span tolerance is
// 0.16 m (documented detail-box protrusion past wall planes), not the
// landmarks' 0.01/0.11 — mass spans are exact, detail boxes protrude.
// DETAIL PASS (2026-11-03 mount): 10 imports repointed to _detail files
// and 12 new d_* imports added. The bounds test splits on the
// detail-pass flag: non-detail entries keep the 0.16 m overall check;
// detail entries pin their MASS mesh(es) position- and span-exact
// (0.01 m) with an overall-span cap of footprint + 3.5 m (the
// detail-pass verifier contract — porticos, steps, turrets and balconies
// protrude past the wall plane by design). The count test is 72, the
// file test allows _detail files for detail-pass upgrades, and the flags
// test splits by height provenance (ESTIMATE vs LIDAR) — each change is
// marked "Deliberate change" at its site.
type Gltf = {
  accessors: { min?: number[]; max?: number[] }[];
  meshes: { name?: string; primitives: { attributes: { POSITION: number } }[] }[];
};
function parseGltfJson(raw: string): Gltf {
  // Anchor on the JSON chunk marker, NOT the first "{" in the file: a GLB
  // header byte can equal 0x7B ("{") — proven by s57, whose chunk-length
  // bytes contain 0x7B, which breaks the naive indexOf("{") pattern used
  // by the landmark test (none of the 11 landmark headers contain it).
  const start = raw.indexOf("JSON{") + 4;
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  expect(end).toBeGreaterThan(start);
  return JSON.parse(raw.slice(start, end)) as Gltf;
}
function glbBounds(raw: string): { min: number[]; max: number[] } {
  const g = parseGltfJson(raw);
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
// Per-mesh bounds (for the detail-pass mass-mesh check below): the mass
// mesh(es) are named mass* (s29 splits into base_mesh + upper_mesh).
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
function uniqMean(fp: [number, number][]): [number, number] {
  const u = fp.length > 1 && fp[0][0] === fp[fp.length - 1][0] && fp[0][1] === fp[fp.length - 1][1] ? fp.slice(0, -1) : fp;
  return [u.reduce((s, p) => s + p[0], 0) / u.length, u.reduce((s, p) => s + p[1], 0) / u.length];
}
function uniq(fp: [number, number][]): [number, number][] {
  return fp.length > 1 && fp[0][0] === fp[fp.length - 1][0] && fp[0][1] === fp[fp.length - 1][1] ? fp.slice(0, -1) : fp;
}
const gis = JSON.parse(gisRaw as unknown as string) as {
  buildings: { id: string; footprints: [number, number][][]; height: number; name?: string }[];
  replaces: Record<string, { index: number; cx: number; cy: number }[]>;
};
const tiles: Record<string, { footprint: [number, number][]; height: number; name?: string }[]> = {
  "-1_-1": JSON.parse(tile11Raw as unknown as string),
  "-1_0": JSON.parse(tile10Raw as unknown as string),
  "-2_-1": JSON.parse(tile21Raw as unknown as string),
  "-2_0": JSON.parse(tile20Raw as unknown as string),
};
const gisById = new Map(gis.buildings.map((b) => [b.id, b]));
const GLB_RAW: Record<string, string> = {
  s01_gis_248020_820714: s01_gis_248020_820714Raw as unknown as string,
  s02_gis_248022_820728: s02_gis_248022_820728Raw as unknown as string,
  s03_gis_248012_820742: s03_gis_248012_820742Raw as unknown as string,
  s04_gis_248011_820793: s04_gis_248011_820793Raw as unknown as string,
  s05_gis_248006_820660: s05_gis_248006_820660Raw as unknown as string,
  s06_tile_tile__1_0_21: s06_tile_tile__1_0_21Raw as unknown as string,
  s07_gis_247989_820841: s07_gis_247989_820841Raw as unknown as string,
  s08_gis_247986_820733: s08_gis_247986_820733Raw as unknown as string,
  s09_gis_247981_820805: s09_gis_247981_820805Raw as unknown as string,
  s10_gis_247975_820830: s10_gis_247975_820830Raw as unknown as string,
  s11_gis_247972_820844: s11_gis_247972_820844Raw as unknown as string,
  s12_gis_247954_820579: s12_gis_247954_820579Raw as unknown as string,
  s13_gis_247962_820648: s13_gis_247962_820648Raw as unknown as string,
  s14_gis_247953_820768: s14_gis_247953_820768Raw as unknown as string,
  s15_gis_247929_820913: s15_gis_247929_820913Raw as unknown as string,
  s16_gis_247933_820644: s16_gis_247933_820644Raw as unknown as string,
  s17_gis_247929_820785: s17_gis_247929_820785Raw as unknown as string,
  s18_gis_247927_820805: s18_gis_247927_820805Raw as unknown as string,
  s19_gis_247924_820723: s19_gis_247924_820723Raw as unknown as string,
  s20_gis_247898_820658: s20_gis_247898_820658Raw as unknown as string,
  s21_gis_247897_820477: s21_gis_247897_820477Raw as unknown as string,
  s22_gis_247874_820578: s22_gis_247874_820578Raw as unknown as string,
  s23_gis_247838_820787: s23_gis_247838_820787Raw as unknown as string,
  s24_gis_247859_820649: s24_gis_247859_820649Raw as unknown as string,
  s25_gis_247819_820872: s25_gis_247819_820872Raw as unknown as string,
  s26_gis_247819_820504: s26_gis_247819_820504Raw as unknown as string,
  s27_tile_tile__1__1_74: s27_tile_tile__1__1_74Raw as unknown as string,
  s28_tile_tile__1__1_78: s28_tile_tile__1__1_78Raw as unknown as string,
  s29_tile_tile__2__1_0: s29_tile_tile__2__1_0Raw as unknown as string,
  s30_tile_tile__2_0_2: s30_tile_tile__2_0_2Raw as unknown as string,
  s31_gis_248030_820646: s31_gis_248030_820646Raw as unknown as string,
  s32_gis_248031_820658: s32_gis_248031_820658Raw as unknown as string,
  s33_tile_tile__1_0_27: s33_tile_tile__1_0_27Raw as unknown as string,
  s34_gis_248056_820832: s34_gis_248056_820832Raw as unknown as string,
  s35_gis_248062_820786: s35_gis_248062_820786Raw as unknown as string,
  s36_gis_248098_820737: s36_gis_248098_820737Raw as unknown as string,
  s37_gis_248103_820706: s37_gis_248103_820706Raw as unknown as string,
  s38_gis_248109_820692: s38_gis_248109_820692Raw as unknown as string,
  s39_gis_248115_820708: s39_gis_248115_820708Raw as unknown as string,
  s40_tile_tile__1_0_23: s40_tile_tile__1_0_23Raw as unknown as string,
  s41_gis_248126_820567: s41_gis_248126_820567Raw as unknown as string,
  s42_gis_248126_820711: s42_gis_248126_820711Raw as unknown as string,
  s43_gis_248127_820664: s43_gis_248127_820664Raw as unknown as string,
  s44_tile_tile__1_0_26: s44_tile_tile__1_0_26Raw as unknown as string,
  s45_gis_248150_820747: s45_gis_248150_820747Raw as unknown as string,
  s46_gis_248141_820715: s46_gis_248141_820715Raw as unknown as string,
  s47_gis_248154_820664: s47_gis_248154_820664Raw as unknown as string,
  s48_gis_248145_820625: s48_gis_248145_820625Raw as unknown as string,
  s49_gis_248151_820780: s49_gis_248151_820780Raw as unknown as string,
  s50_gis_248160_820712: s50_gis_248160_820712Raw as unknown as string,
  s51_gis_248164_820698: s51_gis_248164_820698Raw as unknown as string,
  s52_gis_248169_820665: s52_gis_248169_820665Raw as unknown as string,
  s53_tile_tile__1__1_10: s53_tile_tile__1__1_10Raw as unknown as string,
  s54_gis_248208_820877: s54_gis_248208_820877Raw as unknown as string,
  s55_gis_248218_820836: s55_gis_248218_820836Raw as unknown as string,
  s56_gis_248221_820893: s56_gis_248221_820893Raw as unknown as string,
  s57_gis_248223_820929: s57_gis_248223_820929Raw as unknown as string,
  s58_gis_248224_820800: s58_gis_248224_820800Raw as unknown as string,
  s59_gis_248232_820774: s59_gis_248232_820774Raw as unknown as string,
  s60_gis_248232_820881: s60_gis_248232_820881Raw as unknown as string,
  d_695_pleasant: d_695_pleasantRaw as unknown as string,
  d_700_pleasant: d_700_pleasantRaw as unknown as string,
  d_regency_tower: d_regency_towerRaw as unknown as string,
  d_147_8th: d_147_8thRaw as unknown as string,
  d_150_8th: d_150_8thRaw as unknown as string,
  d_162_elm: d_162_elmRaw as unknown as string,
  d_629_purchase: d_629_purchaseRaw as unknown as string,
  d_636_purchase: d_636_purchaseRaw as unknown as string,
  d_289_acushnet: d_289_acushnetRaw as unknown as string,
  d_first_baptist: d_first_baptistRaw as unknown as string,
  d_walgreens: d_walgreensRaw as unknown as string,
  d_nb_city_hall: d_nb_city_hallRaw as unknown as string,
};
describe("downtown tier1 mount manifest", () => {
  it("mounts exactly the 72 downtown models (no Bethel hero replacement)", () => {
    // Deliberate change (detail pass 2026-11-03): 60 + 12 new tile models.
    expect(DOWNTOWN_TIER1_MODELS).toHaveLength(72);
    expect(DOWNTOWN_TIER1_MODELS.find((m) => m.id === "bethel")).toBeUndefined();
    for (const m of DOWNTOWN_TIER1_MODELS) {
      // Detail-pass upgrades keep their id but mount the _detail file;
      // new detail entries use their filename stem as id, so their file
      // is still /tier1/<id>.glb. Either way the file is exactly derived
      // from the id — no free-form paths.
      const detailUpgrade = (m.flag ?? "").includes("detail-pass") && !m.id.startsWith("d_");
      expect(m.file).toBe(detailUpgrade ? `/tier1/${m.id}_detail.glb` : `/tier1/${m.id}.glb`);
      expect(m.position[1]).toBe(0);
      expect(districtOfWorld(m.position[0], m.position[2])).toBe("newBedford");
      expect(m.position[0]).toBeCloseTo(m.centroid[0], 2);
      expect(m.position[2]).toBeCloseTo(-m.centroid[1], 2);
    }
    expect([...DOWNTOWN_TIER1_GIS_IDS].sort()).toEqual(
      DOWNTOWN_TIER1_MODELS.filter((m) => m.gisId).map((m) => m.gisId as string).sort(),
    );
    expect(DOWNTOWN_TIER1_GIS_IDS).toHaveLength(51);
  });
  it("derives every entry from its GIS record or tile footprint", () => {
    for (const m of DOWNTOWN_TIER1_MODELS) {
      if (m.centroidSource === "gis") {
        const g = gisById.get(m.gisId as string);
        expect(g, `no GIS record for ${m.id}`).toBeTruthy();
        expect(m.height).toBe(g!.height);
        const c = uniqMean(g!.footprints[0]);
        expect(Math.abs(c[0] - m.centroid[0])).toBeLessThan(0.01);
        expect(Math.abs(c[1] - m.centroid[1])).toBeLessThan(0.01);
      } else {
        const t = tiles[m.tileKey as string][m.tileIdx as number];
        const c = uniqMean(t.footprint);
        expect(Math.abs(c[0] - m.centroid[0])).toBeLessThan(0.01);
        expect(Math.abs(c[1] - m.centroid[1])).toBeLessThan(0.01);
      }
    }
  });
  it("GLB bounds match the footprint spans (detail protrusion <= 0.16 m)", () => {
    for (const m of DOWNTOWN_TIER1_MODELS) {
      const b = glbBounds(GLB_RAW[m.id]);
      const fp = m.centroidSource === "gis"
        ? gisById.get(m.gisId as string)!.footprints[0]
        : tiles[m.tileKey as string][m.tileIdx as number].footprint;
      const u = uniq(fp);
      const es = u.map((p) => p[0]);
      const ns = u.map((p) => p[1]);
      const c = uniqMean(fp);
      const wantX = [Math.min(...es) - c[0], Math.max(...es) - c[0]];
      const wantZ = [c[1] - Math.max(...ns), c[1] - Math.min(...ns)];
      if ((m.flag ?? "").includes("detail-pass")) {
        // Detail-pass models carry protruding front-face detail (porticos,
        // steps, turrets, balconies — measured, ≤3.5 m past the footprint
        // per the detail-pass verifier contract in verify_detail.py), so
        // the 0.16 m overall-bounds tolerance no longer describes them.
        // The exact contract is pinned instead on the MASS mesh(es)
        // (named mass*, or s29's base_mesh/upper_mesh): position- and
        // span-exact vs the footprint (0.01 m), plus an overall-span cap
        // of footprint + 3.5 m per axis. Y range is unchanged.
        const masses = glbMeshBounds(GLB_RAW[m.id]).filter(
          (mm) => mm.name.toLowerCase().startsWith("mass") || mm.name === "base_mesh" || mm.name === "upper_mesh",
        );
        expect(masses.length, `no mass mesh in ${m.id}`).toBeGreaterThan(0);
        expect(Math.abs(Math.min(...masses.map((mm) => mm.min[0])) - wantX[0])).toBeLessThan(0.01);
        expect(Math.abs(Math.max(...masses.map((mm) => mm.max[0])) - wantX[1])).toBeLessThan(0.01);
        expect(Math.abs(Math.min(...masses.map((mm) => mm.min[2])) - wantZ[0])).toBeLessThan(0.01);
        expect(Math.abs(Math.max(...masses.map((mm) => mm.max[2])) - wantZ[1])).toBeLessThan(0.01);
        expect(b.max[0] - b.min[0]).toBeLessThanOrEqual((wantX[1] - wantX[0]) + 3.5);
        expect(b.max[2] - b.min[2]).toBeLessThanOrEqual((wantZ[1] - wantZ[0]) + 3.5);
      } else {
        const tol = 0.16;
        expect(Math.abs(b.min[0] - wantX[0])).toBeLessThan(tol);
        expect(Math.abs(b.max[0] - wantX[1])).toBeLessThan(tol);
        expect(Math.abs(b.min[2] - wantZ[0])).toBeLessThan(tol);
        expect(Math.abs(b.max[2] - wantZ[1])).toBeLessThan(tol);
      }
      expect(Math.abs(b.min[1] - 0)).toBeLessThan(0.01);
      expect(Math.abs(b.max[1] - (m.height + 0.35))).toBeLessThan(0.01);
    }
  });
  it("carries height-provenance flags on all 72 (estimate or detail-pass)", () => {
    // Deliberate change (detail pass 2026-11-03): the 22 photo-matched
    // detail entries no longer all say ESTIMATE — s29 + the 12 new tile
    // models carry landed LIDAR heights, while the 9 GIS upgrades keep
    // ESTIMATE. The invariant is preserved and split by provenance: every
    // entry must document its height source, and every detail-pass entry
    // must say PHOTO-MATCHED.
    for (const m of DOWNTOWN_TIER1_MODELS) {
      if ((m.flag ?? "").includes("detail-pass")) {
        expect(m.flag).toMatch(/PHOTO-MATCHED/);
        expect(m.flag).toMatch(/LIDAR|ESTIMATE/);
      } else {
        expect(m.flag).toMatch(/ESTIMATE/);
      }
    }
  });
  it("every tile exclusion drops via the replaces guard (< 1.0 m)", () => {
    const dupMean = (fp: [number, number][]): [number, number] => [
      fp.reduce((s, p) => s + p[0], 0) / fp.length,
      fp.reduce((s, p) => s + p[1], 0) / fp.length,
    ];
    for (const m of DOWNTOWN_TIER1_MODELS) {
      if (m.tileKey === null || m.tileIdx === null) continue;
      const t = tiles[m.tileKey][m.tileIdx];
      const entry = (gis.replaces[m.tileKey] ?? []).find((r) => r.index === m.tileIdx);
      expect(entry, `no replaces entry for ${m.id} (${m.tileKey} idx ${m.tileIdx})`).toBeTruthy();
      const c = dupMean(t.footprint);
      const d = Math.hypot(c[0] - entry!.cx, c[1] - entry!.cy);
      expect(d).toBeLessThan(1.0);
    }
    // The 2 extra tile-duplicate entries (no manifest entry of their own:
    // the GIS model is the mount) must also drop via the same guard.
    for (const [key, idx] of [["-1_-1", 80], ["-1_0", 24]] as const) {
      const t = tiles[key][idx];
      const entry = (gis.replaces[key] ?? []).find((r) => r.index === idx);
      expect(entry, `no extra replaces entry for ${key} idx ${idx}`).toBeTruthy();
      const c = dupMean(t.footprint);
      expect(Math.hypot(c[0] - entry!.cx, c[1] - entry!.cy)).toBeLessThan(1.0);
    }
  });
});
