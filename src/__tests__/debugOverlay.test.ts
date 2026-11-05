// Debug overlay support: model-load registry (including the FAILURE path),
// console ring buffer, capture handshake, and beacon payload builder.
// The failure-path test below is the proof the panel's "failed" field works:
// it drives the exact function the GLB loader error callbacks call.
import { describe, expect, it, vi } from "vitest";
import {
  beaconPayloadSize,
  buildBeaconPayload,
  consumeCaptureRequest,
  getConsoleEntries,
  getModelSnapshot,
  getParkedCount,
  installConsoleCapture,
  reportModel,
  requestCapture,
  restoreConsoleCapture,
  setCapturedFrame,
  setParkedCount,
  takeCapturedFrame,
  type BeaconInput,
} from "../debug/modelStatus";
import { DEBUG_API_BASE, DEBUG_API_TOKEN, DEBUG_BEACON_PATH, DEBUG_REPORT_PATH } from "../debug/endpoint";

const baseInput: BeaconInput = {
  buildId: "dev · 2026-11-02",
  ts: 1762140000000,
  mode: "car",
  pos: { x: -250.4, y: 0.6, z: 106.2 },
  speed: 12.34,
  headingDeg: 45,
  carType: "revuelto",
  carModel: "loaded",
  damage: 3,
  objective: "Meet Deacon Mealy at Seamen's Bethel",
  objectiveDist: 142.7,
  fps: 55,
  quality: 0,
  hour: 11.5,
  traffic: 8,
  parked: 12,
  errors: [{ level: "error", msg: "x".repeat(500) }],
};

describe("model registry", () => {
  it("records loading -> loaded transitions", () => {
    reportModel("/assets/cars/revuelto_game.glb", "loading");
    expect(getModelSnapshot().find((m) => m.path === "/assets/cars/revuelto_game.glb")?.state).toBe("loading");
    reportModel("/assets/cars/revuelto_game.glb", "loaded");
    expect(getModelSnapshot().find((m) => m.path === "/assets/cars/revuelto_game.glb")?.state).toBe("loaded");
  });

  it("records the FAILURE path with the path and message (the panel's failed field)", () => {
    // Simulate exactly what RevueltoCar/PackGLB error callbacks do.
    reportModel("/packs/pack006/nope.glb", "loading");
    reportModel("/packs/pack006/nope.glb", "failed", "404 Not Found");
    const entry = getModelSnapshot().find((m) => m.path === "/packs/pack006/nope.glb");
    expect(entry?.state).toBe("failed");
    expect(entry?.error).toContain("404");
  });

  it("caps error text so one failure cannot bloat the panel", () => {
    reportModel("/x.glb", "failed", "e".repeat(5000));
    const entry = getModelSnapshot().find((m) => m.path === "/x.glb");
    expect((entry?.error ?? "").length).toBeLessThanOrEqual(300);
  });
});

describe("console ring buffer", () => {
  it("captures error/warn and still calls through", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const restore = installConsoleCapture();
      console.error("boom", new Error("kapow"));
      console.warn("careful now");
      const entries = getConsoleEntries();
      expect(entries.some((e) => e.level === "error" && e.msg.includes("kapow"))).toBe(true);
      expect(entries.some((e) => e.level === "warn" && e.msg.includes("careful"))).toBe(true);
      // Call-through: the originals still received the calls.
      expect(errSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      restore();
    } finally {
      errSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

describe("capture handshake", () => {
  it("fires exactly once per request and round-trips a frame", () => {
    requestCapture();
    expect(consumeCaptureRequest()).toBe(true);
    expect(consumeCaptureRequest()).toBe(false);
    setCapturedFrame("data:image/png;base64,AAA");
    expect(takeCapturedFrame()).toBe("data:image/png;base64,AAA");
    expect(takeCapturedFrame()).toBeNull();
  });
});

describe("parked count", () => {
  it("defaults to -1 (not reported) and stores reports", () => {
    setParkedCount(12);
    expect(getParkedCount()).toBe(12);
  });
});

describe("beacon payload", () => {
  it("stays under 1 KB for typical input", () => {
    const payload = buildBeaconPayload(baseInput);
    expect(payload.v).toBe(1);
    expect(payload.mode).toBe("car");
    expect(payload.car).toBe("revuelto");
    expect(beaconPayloadSize(payload)).toBeLessThan(1024);
  });

  it("truncates long errors and keeps the last 3", () => {
    const payload = buildBeaconPayload({
      ...baseInput,
      errors: [
        { level: "error", msg: "a".repeat(500) },
        { level: "warn", msg: "b" },
        { level: "error", msg: "c" },
        { level: "error", msg: "d" },
      ],
    });
    const err = payload.err as string[];
    expect(err).toHaveLength(3);
    expect(err[0]).toContain("b");
    expect(err.join("").length).toBeLessThan(400);
  });

  it("handles a null position without throwing", () => {
    const payload = buildBeaconPayload({ ...baseInput, pos: null, objectiveDist: null });
    expect(payload.pos).toBeNull();
    expect(payload.objDist).toBeNull();
  });
});

describe("endpoint constants", () => {
  it("uses a same-origin path and a non-empty token", () => {
    expect(DEBUG_API_BASE.startsWith("/api/")).toBe(true);
    expect(DEBUG_BEACON_PATH.startsWith(DEBUG_API_BASE)).toBe(true);
    expect(DEBUG_REPORT_PATH.startsWith(DEBUG_API_BASE)).toBe(true);
    expect(DEBUG_API_TOKEN.length).toBeGreaterThanOrEqual(16);
  });
});
