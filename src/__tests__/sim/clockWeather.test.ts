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
