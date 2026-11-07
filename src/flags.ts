/**
 * §0.2 Feature flags — typed registry with per-build defaults.
 * Dev-only URL overrides: ?flag.helicopter=0
 */

export type BuildTarget = "stylized" | "earth" | "diagnostic";

export interface FlagDefs {
  /** Expensive heli pursuit tier. */
  helicopter: boolean;
  /** Load CC0 GLB actor meshes when available. */
  glbActors: boolean;
  /** Full weather FSM (vs clear↔rain toggle). */
  weather: boolean;
  /** MissionRuntime fail timers. */
  missionTimers: boolean;
  /** PedGraph sidewalk routing for ambient peds. */
  pedGraph: boolean;
  /** Telemetry overlay / dumps. */
  telemetry: boolean;
  /** Deterministic RNG in sim systems. */
  deterministicSim: boolean;
}

const DEFAULTS: Record<BuildTarget, FlagDefs> = {
  stylized: {
    helicopter: false,
    glbActors: true,
    weather: true,
    missionTimers: true,
    pedGraph: true,
    telemetry: false,
    deterministicSim: true,
  },
  earth: {
    helicopter: false,
    glbActors: true,
    weather: true,
    missionTimers: true,
    pedGraph: false,
    telemetry: false,
    deterministicSim: true,
  },
  diagnostic: {
    helicopter: true,
    glbActors: true,
    weather: true,
    missionTimers: true,
    pedGraph: true,
    telemetry: true,
    deterministicSim: true,
  },
};

function detectBuild(): BuildTarget {
  if (typeof document !== "undefined") {
    const page = document.documentElement?.dataset?.build as BuildTarget | undefined;
    if (page && page in DEFAULTS) return page;
    if (typeof location !== "undefined" && /earth\.html/i.test(location.pathname)) return "earth";
  }
  return "stylized";
}

function parseUrlOverrides(): Partial<FlagDefs> {
  if (typeof location === "undefined") return {};
  const out: Partial<FlagDefs> = {};
  try {
    const params = new URLSearchParams(location.search);
    for (const key of Object.keys(DEFAULTS.stylized) as (keyof FlagDefs)[]) {
      const raw = params.get(`flag.${key}`);
      if (raw == null) continue;
      out[key] = raw === "1" || raw === "true" || raw === "yes";
    }
  } catch {
    /* ignore */
  }
  return out;
}

let build: BuildTarget = detectBuild();
let flags: FlagDefs = { ...DEFAULTS[build], ...parseUrlOverrides() };

export function getBuildTarget(): BuildTarget {
  return build;
}

export function getFlags(): Readonly<FlagDefs> {
  return flags;
}

export function flag<K extends keyof FlagDefs>(key: K): FlagDefs[K] {
  return flags[key];
}

/** Test / diagnostic override. Does not require reload for pure consumers. */
export function setFlag<K extends keyof FlagDefs>(key: K, value: FlagDefs[K]): void {
  flags = { ...flags, [key]: value };
}

export function resetFlags(target: BuildTarget = detectBuild()): void {
  build = target;
  flags = { ...DEFAULTS[target] };
}

export const FLAG_KEYS = Object.keys(DEFAULTS.stylized) as (keyof FlagDefs)[];
