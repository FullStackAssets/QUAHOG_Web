import { describe, expect, it } from "vitest";
import { headlightNightFactor } from "../actors/CarHeadlights";

// Night fix (playtest 2026-11-02, R4 review): headlight beams fade with darkness.
describe("headlightNightFactor", () => {
  it("is dark by day and full at night", () => {
    expect(headlightNightFactor(1)).toBe(0);
    expect(headlightNightFactor(0)).toBe(1);
  });
  it("fades linearly through dusk", () => {
    expect(headlightNightFactor(0.5)).toBe(0.5);
    expect(headlightNightFactor(0.25)).toBe(0.75);
  });
  it("clamps out-of-range day values", () => {
    expect(headlightNightFactor(1.4)).toBe(0);
    expect(headlightNightFactor(-0.3)).toBe(1);
  });
});
