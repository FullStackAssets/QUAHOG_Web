import { beforeEach, describe, expect, it } from "vitest";
import { FLAG_KEYS, flag, resetFlags, setFlag } from "../flags";
import { BRAND, COORDS, EVENT_NAMES, SAVE_KEYS, isEventName } from "../registries";
import {
  emitTelemetry,
  resetTelemetryCounters,
  schemaEventNames,
  setTelemetrySink,
  validateTelemetrySchema,
} from "../telemetry/schema";

describe("§0 Foundations", () => {
  beforeEach(() => {
    resetFlags("stylized");
    resetTelemetryCounters();
  });

  it("flags have typed keys and accept overrides", () => {
    expect(FLAG_KEYS).toContain("pedGraph");
    expect(flag("pedGraph")).toBe(true);
    setFlag("helicopter", true);
    expect(flag("helicopter")).toBe(true);
  });

  it("registries expose branding, coords, save keys, events", () => {
    expect(BRAND.name).toBe("Mount Hope");
    expect(COORDS.toWorld([10, 20], 1)).toEqual([10, 1, -20]);
    expect(SAVE_KEYS.mission).toBe("mounthope.mission.v1");
    expect(isEventName("mission.fail")).toBe(true);
    expect(Object.keys(EVENT_NAMES).length).toBeGreaterThan(5);
  });

  it("telemetry schema validates and samples always-events", () => {
    expect(validateTelemetrySchema()).toEqual([]);
    const seen: string[] = [];
    setTelemetrySink((name) => seen.push(name));
    emitTelemetry("mission.fail", { reason: "test" });
    expect(seen).toContain("mission.fail");
    expect(schemaEventNames()).toContain("sim.loop.overrun");
  });
});
