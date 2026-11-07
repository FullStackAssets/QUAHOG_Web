/**
 * §0.4 Telemetry schema — domain.entity.action naming, typed payloads.
 * Sinks are console / no-op for now; endpoint wiring is §17.
 */

import type { EventName } from "../registries";
import { EVENT_NAMES } from "../registries";
import { flag } from "../flags";

export type SamplePolicy = "always" | "dev" | "oneInN";

export interface TelemetryEventDef {
  name: EventName | string;
  policy: SamplePolicy;
  /** When policy is oneInN. */
  n?: number;
  description: string;
}

/** Schema catalogue — every entry should be emitted by ≥ 1 code path. */
export const TELEMETRY_SCHEMA: readonly TelemetryEventDef[] = [
  { name: "mission.start", policy: "always", description: "Mission began" },
  { name: "mission.step", policy: "always", description: "Mission step advanced" },
  { name: "mission.complete", policy: "always", description: "Mission finished" },
  { name: "mission.fail", policy: "always", description: "Mission failed" },
  { name: "mission.retry", policy: "always", description: "Mission retried" },
  { name: "mission.abandon", policy: "always", description: "Mission abandoned" },
  { name: "sim.loop.overrun", policy: "always", description: "GameLoop hit step cap" },
  { name: "sim.traffic.spawn", policy: "oneInN", n: 20, description: "Traffic agent spawned" },
  { name: "sim.ped.spawn", policy: "oneInN", n: 20, description: "Pedestrian spawned" },
  { name: "sim.streamer.evict", policy: "dev", description: "Streamer evicted a tile" },
  { name: "sim.weather.change", policy: "always", description: "Weather kind changed" },
];

export type TelemetrySink = (name: string, payload?: unknown) => void;

const schemaIndex = new Map(TELEMETRY_SCHEMA.map((d) => [d.name, d]));

let sink: TelemetrySink = () => undefined;
let counters = new Map<string, number>();

export function setTelemetrySink(next: TelemetrySink): void {
  sink = next;
}

export function resetTelemetryCounters(): void {
  counters = new Map();
}

function shouldSample(def: TelemetryEventDef | undefined): boolean {
  if (!def) return flag("telemetry");
  if (def.policy === "always") return true;
  if (def.policy === "dev") return flag("telemetry");
  const n = def.n ?? 10;
  const c = (counters.get(def.name) ?? 0) + 1;
  counters.set(def.name, c);
  return c % n === 0;
}

/** Emit a schema event (sampled per policy). Unknown names only fire when telemetry flag is on. */
export function emitTelemetry(name: string, payload?: unknown): void {
  const def = schemaIndex.get(name);
  if (!shouldSample(def)) return;
  try {
    sink(name, payload);
  } catch {
    /* sinks must never break sim */
  }
}

/** Dev helper: ensure schema keys are known EventNames where applicable. */
export function validateTelemetrySchema(): string[] {
  const errors: string[] = [];
  for (const def of TELEMETRY_SCHEMA) {
    if (def.name in EVENT_NAMES) continue;
    // Allow future domains not yet in EVENT_NAMES.
    if (!def.name.includes(".")) errors.push(`${def.name}: missing domain.entity.action form`);
  }
  return errors;
}

export function schemaEventNames(): string[] {
  return TELEMETRY_SCHEMA.map((d) => d.name);
}
