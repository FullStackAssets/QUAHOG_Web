import { describe, expect, it } from "vitest";
import { makeClapboardMaps, makeClapboardBox } from "../world/bethelSurface";
import * as THREE from "three";

describe("procedural chapel siding", () => {
  it("uses light, deterministic albedo and linear relief data", () => {
    const a = makeClapboardMaps(), b = makeClapboardMaps();
    expect(a.albedo.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(a.bump.colorSpace).toBe(THREE.NoColorSpace);
    expect(a.albedo.image.data).toEqual(b.albedo.image.data);
    const pixels = a.albedo.image.data as Uint8Array;
    expect(pixels.reduce((min, value) => Math.min(min, value), 255)).toBeGreaterThan(160);
    expect(new Set(pixels).size).toBeGreaterThan(10);
    for (const maps of [a, b]) { maps.albedo.dispose(); maps.bump.dispose(); }
  });
  it("keeps siding course spacing equal on body and tower", () => {
    for (const [w,h,d] of [[18,7,12],[3.4,13,3.4]]) {
      const g = makeClapboardBox(w,h,d);
      const y = g.getAttribute("position"), uv = g.getAttribute("uv"), n = g.getAttribute("normal");
      for (let i = 0; i < y.count; i++) if (Math.abs(n.getY(i)) < 0.5) {
        expect(uv.getY(i)).toBeCloseTo(y.getY(i) / 1.6, 5);
      }
      g.dispose();
    }
  });
});
