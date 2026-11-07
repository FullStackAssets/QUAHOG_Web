import { describe, expect, it } from "vitest";
import { ClockWeather } from "../../sim/ClockWeather";
import { validateManifest, manifestFromSlice } from "../../sim/WorldManifest";
import type { Slice } from "../../slice";

describe("ClockWeather", () => {
  it("wet asphalt is slipperier than dry", () => {
    const c = new ClockWeather();
    const dry = c.friction("asphalt");
    c.wetness = 0.8;
    const wet = c.friction("asphalt");
    expect(wet).toBeLessThan(dry * 0.9);
  });

  it("cycles clear → rain → fog", () => {
    const c = new ClockWeather();
    expect(c.cycleWeather()).toBe("rain");
    c.setWeather("rain", 0);
    expect(c.cycleWeather()).toBe("fog");
  });

  it("streamRadiusScale shortens the far ring in fog/rain", () => {
    const c = new ClockWeather();
    expect(c.streamRadiusScale()).toBe(1);
    c.setWeather("rain", 0);
    expect(c.streamRadiusScale()).toBe(0.9);
    c.setWeather("fog", 0);
    expect(c.streamRadiusScale()).toBe(0.7);
  });

  it("wet braking friction is ≥20% lower than dry (§1.4.T1)", () => {
    const c = new ClockWeather();
    const dry = c.friction("asphalt");
    c.wetness = 1;
    const wet = c.friction("asphalt");
    expect(wet).toBeLessThanOrEqual(dry * 0.8);
  });
});

describe("WorldManifest", () => {
  it("validates a slice-derived manifest", () => {
    const slice = {
      name: "test",
      origin: { lat: 0, lon: 0 },
      buildings: [],
      roads: [{ highway: "residential", width: 8, name: null, points: [[0, 0], [10, 0]] }],
      water: [],
      landmarks: [],
      attribution: "",
    } as Slice;
    const m = manifestFromSlice(slice);
    const v = validateManifest(m);
    expect(v.ok).toBe(true);
  });
});
