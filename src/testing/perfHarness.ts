// Isolated main-game performance harness.
//
// This module is not part of the game runtime. Nothing under src/ except
// src/testing and src/__tests__ may import it. It does not create a renderer,
// read WebGL, or talk to a device.
//
// elapsedMs is process wall-clock for a bounded call loop. It is not a frame
// time, not a frame rate, and not a thermal reading. Browser emulation, WebKit,
// and SwiftShader must never be recorded as a physical iPhone Safari session.
// The 10-minute Low / Medium / High traversal on a physical iPhone stays a
// human gate; this module cannot close that gate.

export const HARNESS_SCHEMA = "main-game-isolated-harness/v1";

/** Hard stop so a caller cannot turn the sampler into an unbounded soak. */
export const MAX_ITERATIONS = 20_000;

/** Hard stop on how many samples one report will publish. */
export const MAX_SAMPLES = 8;

export const CHECKSUM_MOD = 1_000_003;

export const PHYSICAL_IPHONE_TRAVERSAL = {
  status: "human-gate" as const,
  minutesPerQuality: 10,
  qualities: ["Low", "Medium", "High"] as const,
  performedInThisRun: false,
  note: "Requires a person on a physical iPhone in Safari. This harness cannot close it.",
};

/**
 * The task described an R3 archive that was not attached to this workspace.
 * Do not flip these flags because some other zip happens to be on disk.
 */
export const R3_ARCHIVE = {
  attachedToWorkspace: false,
  inspected: false,
  note: "Described in the task, not attached here, not inspected by this harness.",
};

export interface HarnessSample {
  name: string;
  iterations: number;
  elapsedMs: number;
  checksum: number;
}

export interface PublishedSample {
  name: string;
  iterations: number;
  elapsedMs: number;
}

export interface SurfaceClassification {
  requestedSurface: string;
  /** Always this value. The harness has no path that stores a device pass. */
  label: "not-physical-iphone-safari";
  acceptedAsPhysicalIphoneSafari: false;
  reason: string;
}

export interface HarnessEnvironment {
  runtime: "node";
  node: string;
  platform: string;
  arch: string;
  renderer: "none";
  browser: null;
}

export interface HarnessReport {
  schema: typeof HARNESS_SCHEMA;
  label: "not-physical-iphone-safari";
  physicalIphoneSafari: false;
  readsRenderer: false;
  fps: null;
  thermal: null;
  classification: SurfaceClassification;
  physicalTraversal: typeof PHYSICAL_IPHONE_TRAVERSAL;
  r3Archive: typeof R3_ARCHIVE;
  environment: HarnessEnvironment;
  workload: string;
  bounds: {
    maxIterations: number;
    maxSamples: number;
    sampleCount: number;
  };
  samples: PublishedSample[];
}

export function mixChecksum(acc: number, value: unknown): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return (acc + num) % CHECKSUM_MOD;
}

function clampIterations(iterations: number): number {
  if (!Number.isFinite(iterations)) {
    throw new Error("iterations must be a finite number");
  }
  return Math.min(Math.max(1, Math.floor(iterations)), MAX_ITERATIONS);
}

/**
 * Time `fn` for a bounded number of iterations.
 * The checksum is only there so the loop result stays observable.
 */
export function runBoundedSample(
  name: string,
  iterations: number,
  fn: (index: number) => unknown,
): HarnessSample {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("sample name is required");
  }
  if (typeof fn !== "function") {
    throw new Error("sample function is required");
  }
  const n = clampIterations(iterations);
  const started = performance.now();
  let checksum = 0;
  for (let i = 0; i < n; i++) checksum = mixChecksum(checksum, fn(i));
  const elapsedMs = performance.now() - started;
  return { name, iterations: n, elapsedMs, checksum };
}

export function classifySurface(surface: string): SurfaceClassification {
  const requestedSurface = String(surface ?? "").trim();
  const key = requestedSurface.toLowerCase();
  let reason: string;
  if (
    key.includes("iphone") ||
    key.includes("ios") ||
    key === "safari" ||
    key.includes("physical")
  ) {
    reason =
      "A phone or Safari name was requested. This harness rejects that claim. The 10-minute Low, Medium, and High traversal stays a human gate.";
  } else if (key.includes("swiftshader")) {
    reason = "SwiftShader is a software renderer. It is not a physical phone session.";
  } else if (key.includes("webkit")) {
    reason = "WebKit here is browser tooling. It is not a physical phone session.";
  } else if (key.includes("emulat") || key.includes("headless") || key.includes("chromium") || key.includes("chrome")) {
    reason = "Browser emulation or a desktop browser is not a physical phone session.";
  } else if (key === "node" || key === "node-harness" || key === "harness") {
    reason = "Process wall-clock only. No display and no device.";
  } else {
    reason = "Unrecognized surface. Not recorded as a physical phone session.";
  }
  return {
    requestedSurface,
    label: "not-physical-iphone-safari",
    acceptedAsPhysicalIphoneSafari: false,
    reason,
  };
}

export function collectEnvironment(): HarnessEnvironment {
  const proc = (globalThis as { process?: { version?: string; platform?: string; arch?: string } }).process;
  return {
    runtime: "node",
    node: proc?.version ?? "unknown",
    platform: proc?.platform ?? "unknown",
    arch: proc?.arch ?? "unknown",
    renderer: "none",
    browser: null,
  };
}

export function buildReport(opts: {
  samples: readonly HarnessSample[];
  surface?: string;
  environment?: HarnessEnvironment;
  workload: string;
}): HarnessReport {
  const classification = classifySurface(opts.surface ?? "node-harness");
  const samples = opts.samples.slice(0, MAX_SAMPLES).map((sample) => ({
    name: sample.name,
    iterations: sample.iterations,
    elapsedMs: sample.elapsedMs,
  }));
  const report: HarnessReport = {
    schema: HARNESS_SCHEMA,
    label: "not-physical-iphone-safari",
    physicalIphoneSafari: false,
    readsRenderer: false,
    fps: null,
    thermal: null,
    classification,
    physicalTraversal: PHYSICAL_IPHONE_TRAVERSAL,
    r3Archive: R3_ARCHIVE,
    environment: opts.environment ?? collectEnvironment(),
    workload: opts.workload,
    bounds: {
      maxIterations: MAX_ITERATIONS,
      maxSamples: MAX_SAMPLES,
      sampleCount: samples.length,
    },
    samples,
  };
  assertNoDeviceMetrics(report);
  return report;
}

/** Throw if a report was mutated into a device, frame-rate, or thermal claim. */
export function assertNoDeviceMetrics(report: HarnessReport): void {
  if (report.physicalIphoneSafari !== false) {
    throw new Error("harness must not claim a physical iPhone Safari session");
  }
  if (report.label !== "not-physical-iphone-safari") {
    throw new Error("harness label was changed");
  }
  if (report.classification.acceptedAsPhysicalIphoneSafari !== false) {
    throw new Error("surface classification accepted a device claim");
  }
  if (report.fps !== null || report.thermal !== null) {
    throw new Error("harness must not record frame rate or thermal");
  }
  if (report.readsRenderer !== false || report.environment.renderer !== "none") {
    throw new Error("harness must not claim a renderer");
  }
  if (report.physicalTraversal.performedInThisRun !== false) {
    throw new Error("human gate cannot be closed by the harness");
  }
  if (report.samples.length > MAX_SAMPLES) {
    throw new Error("sample cap exceeded");
  }
  for (const sample of report.samples) {
    if (!Number.isFinite(sample.elapsedMs) || sample.elapsedMs < 0) {
      throw new Error("sample elapsedMs must be a non-negative finite number");
    }
    if (sample.iterations > MAX_ITERATIONS || sample.iterations < 1) {
      throw new Error("sample iteration count is outside the harness bounds");
    }
    if ("fps" in sample || "thermal" in sample || "checksum" in sample) {
      throw new Error("published sample carries a field that is not wall-clock");
    }
  }
}
