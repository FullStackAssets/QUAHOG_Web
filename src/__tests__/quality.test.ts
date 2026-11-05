import { describe, expect, it } from "vitest";
import { collideRadius, QUALITY_LABELS, tileImpostor, viewRadius, type Quality } from "../quality";

describe("quality presets", () => {
  it("has a label per level", () => {
    expect(QUALITY_LABELS).toEqual(["Low", "Medium", "High"]);
  });

  it("viewRadius grows with quality", () => {
    expect(viewRadius(0)).toBe(2);
    expect(viewRadius(1)).toBe(3);
    expect(viewRadius(2)).toBe(4);
  });

  it("collideRadius is capped at the two lower tiers", () => {
    expect(collideRadius(0)).toBe(1);
    expect(collideRadius(1)).toBe(1);
    expect(collideRadius(2)).toBe(2);
  });

  it("tileImpostor: high quality never impostors", () => {
    expect(tileImpostor(2, 10, 4)).toBe(false);
  });

  it("tileImpostor: low/medium impostor tiles at or beyond the view ring", () => {
    const q: Quality = 1;
    expect(tileImpostor(q, 3, 3)).toBe(true);  // ring >= viewR
    expect(tileImpostor(q, 2, 3)).toBe(false); // ring < viewR
  });
});
