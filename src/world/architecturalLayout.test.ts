import { describe, expect, it } from "vitest";
import type { Building } from "../slice";
import { findExteriorFace, generateArchitecturalDetails } from "./architecturalLayout";

const rect = (x: number, north: number, height = 16): Building => ({
  height,
  footprint: [[x, north], [x + 12, north], [x + 12, north + 8], [x, north + 8]],
});

describe("photorealistic near-field architectural details", () => {
  it("uses a real exterior edge, directed outside the source footprint", () => {
    const f = findExteriorFace(rect(10, 20));
    expect(f).not.toBeNull();
    expect(f!.width).toBe(12);
    const exteriorDot = (f!.x - f!.cx) * f!.nx + (f!.z - f!.cz) * f!.nz;
    expect(exteriorDot).toBeGreaterThan(0);
  });

  it("is deterministic when tile building order changes", () => {
    const buildings = Array.from({ length: 18 }, (_, i) => rect(i * 20, i * 7));
    const first = generateArchitecturalDetails(buildings, 90);
    const shuffled = generateArchitecturalDetails([...buildings].reverse(), 90);
    expect(first).toEqual(shuffled);
    expect(first.length).toBeGreaterThan(0);
  });

  it("respects mobile caps without splitting a building cluster", () => {
    const buildings = Array.from({ length: 24 }, (_, i) => rect(i * 30, 0));
    for (const cap of [0, 4, 18, 48, 100]) {
      const output = generateArchitecturalDetails(buildings, cap);
      expect(output.length).toBeLessThanOrEqual(cap);
      expect(output.every(d => d.scale.every(v => Number.isFinite(v) && v > 0))).toBe(true);
    }
  });

  it("excludes hand-modeled hero architecture and invalid coordinates", () => {
    const hero = { ...rect(0, 0), name: "Seamen's Bethel" };
    expect(generateArchitecturalDetails([hero])).toEqual([]);
    expect(findExteriorFace({ height: 8, footprint: [[0, 0], [5, 0], [Infinity, 5]] })).toBeNull();
    expect(findExteriorFace({ height: 8, footprint: [[0, 0], [1, 0], [1, 1]] })).toBeNull();
  });

  it("does not produce unauthorized awnings or high-cost details on low quality", () => {
    const allowed = new Set(["door", "storefront", "sill"] as const);
    const output = generateArchitecturalDetails(Array.from({ length: 20 }, (_, i) => rect(i * 20, 0)), 18, allowed);
    expect(output.every(d => allowed.has(d.kind as "door" | "storefront" | "sill"))).toBe(true);
    expect(output.length).toBeLessThanOrEqual(18);
  });
});
