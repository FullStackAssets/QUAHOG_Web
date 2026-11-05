import { describe, expect, it } from "vitest";
import { GRADE_SIZE, createGradingLut, gradeCurve } from "../world/gradingLut";

describe("gradingLut (TRD piece)", () => {
  it("curve is a gentle S: darkens shadows, brightens highlights, fixes endpoints", () => {
    expect(gradeCurve(0)).toBe(0);
    expect(gradeCurve(1)).toBe(1);
    expect(gradeCurve(0.25)).toBeLessThan(0.25);
    expect(gradeCurve(0.75)).toBeGreaterThan(0.75);
    expect(Math.abs(gradeCurve(0.25) - 0.25)).toBeLessThan(0.03);
    expect(Math.abs(gradeCurve(0.75) - 0.75)).toBeLessThan(0.03);
  });
  it("builds a 32^3 RGBA8 3D texture, memoized", () => {
    const lut = createGradingLut();
    expect(lut.image.width).toBe(GRADE_SIZE);
    expect(lut.image.height).toBe(GRADE_SIZE);
    expect(lut.image.depth).toBe(GRADE_SIZE);
    expect((lut.image.data as Uint8Array).length).toBe(GRADE_SIZE ** 3 * 4);
    expect(createGradingLut()).toBe(lut);
  });
});
