import { describe, expect, it } from "vitest";
import { desiredCops, heatTier, HEAT_TIERS } from "../../sim/HeatTiers";

describe("HeatTiers", () => {
  it("escalates unit counts by star tier", () => {
    expect(desiredCops(0)).toBe(0);
    expect(desiredCops(1)).toBe(0);
    expect(desiredCops(2)).toBe(1);
    expect(desiredCops(3)).toBe(2);
    expect(desiredCops(4)).toBe(3);
    expect(desiredCops(5)).toBe(3);
  });

  it("freezes decay only at APB", () => {
    expect(heatTier(4).noDecay).toBe(false);
    expect(heatTier(5).noDecay).toBe(true);
    expect(HEAT_TIERS[5].helicopter).toBe(true);
  });
});
