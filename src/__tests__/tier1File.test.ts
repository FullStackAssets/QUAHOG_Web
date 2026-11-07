import { describe, expect, it } from "vitest";
import { tier1FileForDevice } from "../world/tier1File";
import { DOWNTOWN_TIER1_MODELS } from "../world/downtownTier1Models";
import { NB_TIER1_MODELS } from "../world/nbTier1Models";

// All tier1 GLBs visible to Vite, keyed by their relative path — used to
// prove every _detail fallback target exists without node:fs imports
// (@types/node is not installed in this project).
const tier1Files = import.meta.glob("../../public/tier1/*.glb");

// iPhone Safari jetsam guard (2026-11-07): on mobile the detail-pass
// _detail models fall back to the original Tier-1 files (same footprint,
// position and height, lighter geometry). Desktop keeps the _detail files.
describe("tier1FileForDevice", () => {
  it("leaves every file untouched on desktop", () => {
    expect(tier1FileForDevice("/tier1/rodman_detail.glb", false)).toBe(
      "/tier1/rodman_detail.glb",
    );
    expect(tier1FileForDevice("/tier1/rodman.glb", false)).toBe("/tier1/rodman.glb");
    // _tier2 (Fall River) files must never be rewritten either.
    expect(tier1FileForDevice("/tier1/city_hall_tier2.glb", false)).toBe(
      "/tier1/city_hall_tier2.glb",
    );
  });

  it("falls back from _detail to the original on mobile", () => {
    expect(tier1FileForDevice("/tier1/rodman_detail.glb", true)).toBe(
      "/tier1/rodman.glb",
    );
    expect(tier1FileForDevice("/tier1/s29_tile_tile__2__1_0_detail.glb", true)).toBe(
      "/tier1/s29_tile_tile__2__1_0.glb",
    );
  });

  it("leaves non-_detail files untouched on mobile", () => {
    expect(tier1FileForDevice("/tier1/rodman.glb", true)).toBe("/tier1/rodman.glb");
    expect(tier1FileForDevice("/tier1/city_hall_tier2.glb", true)).toBe(
      "/tier1/city_hall_tier2.glb",
    );
    // A name that merely contains "detail" elsewhere must not be rewritten.
    expect(tier1FileForDevice("/tier1/detail_house.glb", true)).toBe(
      "/tier1/detail_house.glb",
    );
  });

  it("every manifest _detail entry has its original file on disk", () => {
    const detailEntries = [...DOWNTOWN_TIER1_MODELS, ...NB_TIER1_MODELS].filter((m) =>
      m.file.endsWith("_detail.glb"),
    );
    // 10 downtown upgrades + 4 NB landmark upgrades (detail pass 2026-11-03).
    expect(detailEntries.length).toBe(14);
    for (const m of detailEntries) {
      const base = m.file.slice(0, -"_detail.glb".length) + ".glb";
      // The fallback target must be a real file Vite can see, or mobile
      // would mount a missing model (PackGLB renders nothing on 404).
      expect(`../../public${base}` in tier1Files).toBe(true);
    }
  });
});
