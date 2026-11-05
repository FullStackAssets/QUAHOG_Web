// Debug telemetry state: model-load registry, console ring buffer, parked
// count, screenshot-capture handshake, beacon payload builder. Pure module
// state, no React — usable from loaders, HUD, and the beacon alike, and
// unit-testable without rendering anything.

export type ModelLoadState = "loading" | "loaded" | "failed";
export interface ModelEntry {
  path: string;
  state: ModelLoadState;
  error?: string;
  updatedAt: number;
}

const models = new Map<string, ModelEntry>();
const modelListeners = new Set<() => void>();

// Called by every manual GLB loader on start, success, and error. The error
// path is what the panel's failure field shows — a failed load must land
// here, never just in the console.
export function reportModel(path: string, state: ModelLoadState, error?: string): void {
  models.set(path, {
    path,
    state,
    error: error ? String(error).slice(0, 300) : undefined,
    updatedAt: Date.now(),
  });
  modelListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener failure must never break a loader */
    }
  });
}

export function getModelSnapshot(): ModelEntry[] {
  return [...models.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function subscribeModels(fn: () => void): () => void {
  modelListeners.add(fn);
  return () => {
    modelListeners.delete(fn);
  };
}

// Console ring buffer (error + warn only). Always calls through to the
// originals, so capturing never silences real output.
export interface ConsoleEntry {
  t: number;
  level: "error" | "warn";
  msg: string;
}

const consoleEntries: ConsoleEntry[] = [];
let consoleInstalled = false;
let origError: typeof console.error | null = null;
let origWarn: typeof console.warn | null = null;

function pushConsole(level: "error" | "warn", args: unknown[]): void {
  const msg = args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try {
        return typeof a === "string" ? a : JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ")
    .slice(0, 300);
  consoleEntries.push({ t: Date.now(), level, msg });
  if (consoleEntries.length > 40) consoleEntries.splice(0, consoleEntries.length - 40);
}

export function installConsoleCapture(): () => void {
  if (consoleInstalled) return restoreConsoleCapture;
  consoleInstalled = true;
  origError = console.error.bind(console);
  origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    pushConsole("error", args);
    if (origError) origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    pushConsole("warn", args);
    if (origWarn) origWarn(...args);
  };
  return restoreConsoleCapture;
}

export function restoreConsoleCapture(): void {
  if (!consoleInstalled) return;
  if (origError) console.error = origError;
  if (origWarn) console.warn = origWarn;
  consoleInstalled = false;
}

export function getConsoleEntries(): ConsoleEntry[] {
  return [...consoleEntries];
}

// Parked-car count, reported by <ParkedCars/> (visual list, post quality
// slice). -1 means "not reported yet".
let parkedCount = -1;
export function setParkedCount(n: number): void {
  parkedCount = n;
}
export function getParkedCount(): number {
  return parkedCount;
}

// Screenshot handshake between the DOM overlay and the in-Canvas capture
// helper. WebGL pixels are only readable synchronously during a frame (the
// game does not set preserveDrawingBuffer), so the overlay requests a
// capture and the helper fulfils it on the next driven frame.
let captureRequested = false;
let capturedFrame: string | null = null;
export function requestCapture(): void {
  captureRequested = true;
  capturedFrame = null;
}
export function consumeCaptureRequest(): boolean {
  if (!captureRequested) return false;
  captureRequested = false;
  return true;
}
export function setCapturedFrame(dataUrl: string | null): void {
  capturedFrame = dataUrl;
}
export function takeCapturedFrame(): string | null {
  const f = capturedFrame;
  capturedFrame = null;
  return f;
}

// Beacon payload builder (pure — unit-tested). Kept under 1 KB for typical
// input: short field names, rounded numbers, errors truncated to the last 3.
export interface BeaconInput {
  buildId: string;
  ts: number;
  mode: string;
  pos: { x: number; y: number; z: number } | null;
  speed: number;
  headingDeg: number;
  carType: string;
  carModel: string;
  damage: number;
  objective: string;
  objectiveDist: number | null;
  fps: number;
  quality: number | string;
  hour: number;
  traffic: number;
  parked: number;
  errors: { level: string; msg: string }[];
  // Water/wall probes (2026-11-03 diagnosis) — all optional so older
  // callers keep working. Null means "no position / no stop to report".
  waterBlocked?: boolean | null;
  waterRings?: number;
  waterRoadSegs?: number;
  hazardWet?: number;
  lastStop?: {
    kind: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    dist: number | null;
    handle: number | null;
  } | null;
  nearTraf?: [number, number, number] | null; // [dist m, x, z]
}

export function buildBeaconPayload(i: BeaconInput): Record<string, unknown> {
  return {
    v: 1,
    ts: i.ts,
    build: i.buildId,
    mode: i.mode,
    pos: i.pos ? [Math.round(i.pos.x), Math.round(i.pos.y), Math.round(i.pos.z)] : null,
    speed: Math.round(i.speed * 10) / 10,
    hdg: Math.round(i.headingDeg),
    car: i.carType,
    carModel: i.carModel,
    dmg: Math.round(i.damage),
    obj: i.objective.slice(0, 80),
    objDist: i.objectiveDist === null ? null : Math.round(i.objectiveDist),
    fps: i.fps,
    q: i.quality,
    hr: Math.round(i.hour * 10) / 10,
    traf: i.traffic,
    parked: i.parked,
    err: i.errors.slice(-3).map((e) => `${e.level}:${e.msg.slice(0, 120)}`),
    ...(i.waterBlocked !== undefined ? { waterBlocked: i.waterBlocked } : {}),
    ...(i.waterRings !== undefined ? { waterRings: i.waterRings } : {}),
    ...(i.waterRoadSegs !== undefined ? { waterRoadSegs: i.waterRoadSegs } : {}),
    ...(i.hazardWet !== undefined ? { hazardWet: Math.round(i.hazardWet * 10) / 10 } : {}),
    ...(i.lastStop !== undefined
      ? {
          lastStop: i.lastStop
            ? {
                kind: i.lastStop.kind,
                pos: [Math.round(i.lastStop.x), Math.round(i.lastStop.y), Math.round(i.lastStop.z)],
                yaw: Math.round(i.lastStop.yaw * 180 / Math.PI),
                dist: i.lastStop.dist === null ? null : Math.round(i.lastStop.dist * 100) / 100,
                handle: i.lastStop.handle,
              }
            : null,
        }
      : {}),
    ...(i.nearTraf !== undefined
      ? { nearTraf: i.nearTraf ? [Math.round(i.nearTraf[0] * 10) / 10, Math.round(i.nearTraf[1]), Math.round(i.nearTraf[2])] : null }
      : {}),
  };
}

export function beaconPayloadSize(payload: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}
