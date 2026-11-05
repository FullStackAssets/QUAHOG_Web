import { describe,expect,it } from "vitest";
import { markerFade } from "../world/markerVisual";
describe("cinematic marker styling",()=>{
  it("keeps objectives and activities visible up close without altering interaction radii",()=>{
    expect(markerFade(0)).toBe(1);expect(markerFade(20)).toBe(1);
    expect(markerFade(40)).toBeGreaterThan(.8);
  });
  it("fades distant beams out smoothly",()=>{
    expect(markerFade(45)).toBeGreaterThan(markerFade(85));
    expect(markerFade(85)).toBeGreaterThan(markerFade(120));
    expect(markerFade(125)).toBe(0);expect(markerFade(200)).toBe(0);
  });
  it("does not expose invalid positions",()=>{
    expect(markerFade(NaN)).toBe(0);expect(markerFade(-1)).toBe(0);
    expect(markerFade(Infinity)).toBe(0);
  });
});
