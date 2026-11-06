import { afterEach, describe, expect, it } from "vitest";
import { moveAxis, setVirtualMove } from "../input";
import { tileImpostor, viewRadius, type Quality } from "../quality";
import { toWorld } from "../slice";
import {
  assertNoDeviceMetrics,
  buildReport,
  CHECKSUM_MOD,
  classifySurface,
  collectEnvironment,
  MAX_ITERATIONS,
  MAX_SAMPLES,
  mixChecksum,
  PHYSICAL_IPHONE_TRAVERSAL,
  R3_ARCHIVE,
  runBoundedSample,
  type HarnessReport,
} from "../testing/perfHarness";
import { isBlockedWater, setWaterZones } from "../world/waterZones";

const HANG_GUARD_MS = 5_000;

afterEach(() => {
  setWaterZones([], [], []);
  setVirtualMove(0, 0);
});

function independentChecksum(iterations: number, fn: (index: number) => unknown): number {
  const n = Math.min(Math.max(1, Math.floor(iterations)), MAX_ITERATIONS);
  let acc = 0;
  for (let i = 0; i < n; i++) acc = mixChecksum(acc, fn(i));
  return acc;
}

describe("isolated performance harness", () => {
  it("keeps the physical 10-minute traversal as an open human gate", () => {
    expect(PHYSICAL_IPHONE_TRAVERSAL).toEqual({
      status: "human-gate",
      minutesPerQuality: 10,
      qualities: ["Low", "Medium", "High"],
      performedInThisRun: false,
      note: "Requires a person on a physical iPhone in Safari. This harness cannot close it.",
    });
    expect(R3_ARCHIVE.attachedToWorkspace).toBe(false);
    expect(R3_ARCHIVE.inspected).toBe(false);
  });

  it("never classifies emulation, WebKit, SwiftShader, or a phone name as a device pass", () => {
    const requested = [
      "webkit",
      "WebKit",
      "swiftshader",
      "SwiftShader",
      "browser-emulation",
      "headless-chromium",
      "chrome",
      "physical-iphone-safari",
      "iPhone",
      "Safari",
      "node-harness",
      "something-else",
    ];
    for (const surface of requested) {
      const found = classifySurface(surface);
      expect(found.label).toBe("not-physical-iphone-safari");
      expect(found.acceptedAsPhysicalIphoneSafari).toBe(false);
      expect(found.requestedSurface).toBe(surface);
    }
    expect(classifySurface("SwiftShader").reason).toMatch(/software renderer/i);
    expect(classifySurface("WebKit").reason).toMatch(/browser tooling/i);
    expect(classifySurface("browser-emulation").reason).toMatch(/not a physical phone session/i);
    expect(classifySurface("physical-iphone-safari").reason).toMatch(/human gate/i);
  });

  it("caps iterations and publishes wall-clock without frame-rate or thermal fields", () => {
    const fn = (i: number) => viewRadius((i % 3) as Quality);
    const sample = runBoundedSample("viewRadius", 1_000_000, fn);
    expect(sample.iterations).toBe(MAX_ITERATIONS);
    expect(sample.checksum).toBe(independentChecksum(1_000_000, fn));
    expect(sample.checksum).toBeLessThan(CHECKSUM_MOD);

    const one = runBoundedSample("toWorld", 0, (i) => toWorld([i, i])[0]);
    expect(one.iterations).toBe(1);

    const report = buildReport({
      samples: [sample, one],
      surface: "node-harness",
      workload: "quality-and-coords",
    });
    expect(report.fps).toBeNull();
    expect(report.thermal).toBeNull();
    expect(report.physicalIphoneSafari).toBe(false);
    expect(report.readsRenderer).toBe(false);
    expect(report.environment.renderer).toBe("none");
    expect(report.environment.browser).toBeNull();
    expect(report.samples[0]).toEqual({
      name: "viewRadius",
      iterations: MAX_ITERATIONS,
      elapsedMs: sample.elapsedMs,
    });
    expect(report.samples[0]).not.toHaveProperty("checksum");
    expect(report.samples[0].elapsedMs).toBeGreaterThanOrEqual(0);
    expect(report.samples[0].elapsedMs).toBeLessThan(HANG_GUARD_MS);
    assertNoDeviceMetrics(report);
  });

  it("times touch, streaming, and water predicates inside the hang guard", () => {
    setWaterZones(
      [[[0, 0], [20, 0], [20, 20], [0, 20]]],
      [],
      [],
      [[[0, 10], [20, 10]]],
    );
    setVirtualMove(0.25, -0.5);

    const jobs: { name: string; fn: (index: number) => unknown }[] = [
      { name: "viewRadius", fn: (i) => viewRadius((i % 3) as Quality) },
      {
        name: "tileImpostor",
        fn: (i) => (tileImpostor((i % 3) as Quality, i % 5, 3) ? 1 : 0),
      },
      { name: "moveAxis", fn: () => moveAxis().x + moveAxis().y },
      { name: "toWorld", fn: (i) => toWorld([i, 4], 1)[2] },
      { name: "isBlockedWater", fn: (i) => (isBlockedWater(10, i % 2 === 0 ? -10 : -18) ? 1 : 0) },
    ];

    const samples = jobs.map((job) => {
      const sample = runBoundedSample(job.name, 2_000, job.fn);
      expect(sample.iterations).toBe(2_000);
      expect(sample.checksum).toBe(independentChecksum(2_000, job.fn));
      expect(Number.isFinite(sample.elapsedMs)).toBe(true);
      expect(sample.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(sample.elapsedMs).toBeLessThan(HANG_GUARD_MS);
      return sample;
    });

    const report = buildReport({
      samples,
      surface: "node-harness",
      environment: collectEnvironment(),
      workload: "main-game-pure-functions",
    });
    expect(report.bounds.sampleCount).toBe(jobs.length);
    expect(report.physicalTraversal.performedInThisRun).toBe(false);
    expect(report.r3Archive.inspected).toBe(false);
    // Visible in the test log. These numbers are harness wall-clock only.
    console.info(`HARNESS_REPORT ${JSON.stringify(report)}`);
  });

  it("drops samples past the publish cap and rejects a broken function", () => {
    const samples = Array.from({ length: MAX_SAMPLES + 3 }, (_, i) =>
      runBoundedSample(`s${i}`, 1, () => i),
    );
    const report = buildReport({ samples, workload: "cap" });
    expect(report.samples).toHaveLength(MAX_SAMPLES);
    expect(report.bounds.sampleCount).toBe(MAX_SAMPLES);
    expect(() => runBoundedSample("", 10, () => 1)).toThrow(/name/);
    expect(() => runBoundedSample("x", 10, undefined as unknown as () => unknown)).toThrow(/function/);
    expect(() => runBoundedSample("x", Number.NaN, () => 1)).toThrow(/finite/);
    expect(() => runBoundedSample("x", 4, () => {
      throw new Error("boom");
    })).toThrow(/boom/);
  });

  it("refuses a report that was edited into a device claim", () => {
    const report = buildReport({
      samples: [runBoundedSample("n", 2, () => 1)],
      workload: "guard",
    });
    const forged = {
      ...report,
      physicalIphoneSafari: true,
    } as unknown as HarnessReport;
    expect(() => assertNoDeviceMetrics(forged)).toThrow(/physical iPhone Safari/);
  });

});
