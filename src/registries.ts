/**
 * §0.6 Registries — single source of truth for save keys, branding, coords, events.
 * Grep should find zero duplicated literals for these domains outside this file.
 */

/** Canonical product branding. */
export const BRAND = {
  name: "Mount Hope",
  tagline: "SouthCoast open world",
  packageName: "quahog-web",
  legacyAliases: ["THE NARROWS", "Quahog", "QUAHOG_Web"] as const,
} as const;

/** World coordinate conventions (slice-local metres). */
export const COORDS = {
  units: "metres",
  axisEast: "+x",
  axisUp: "+y",
  axisNorth: "-z",
  /** Slice 2D [east, north] → world [x, y, z]. */
  toWorld(p: [number, number], y = 0): [number, number, number] {
    return [p[0], y, -p[1]];
  },
} as const;

/** Persist keys — never scatter string literals for these. */
export const SAVE_KEYS = {
  mission: "mounthope.mission.v1",
  saveV2: "mounthope.save.v2",
  settings: "mounthope.settings.v1",
  economy: "mounthope.economy.v1",
  /** Legacy stats blob used by Continue detection. */
  stats: "mounthope.save.v1",
  pos: "mounthope.pos.v1",
  inventory: "mounthope.inventory.v1",
  touchLayout: "mounthope.touch.v1",
  radio: "mounthope.radio.v1",
  raceBests: "mounthope.race.v1",
  scrimshaw: "mounthope.scrimshaw.v1",
} as const;

export type SaveKey = (typeof SAVE_KEYS)[keyof typeof SAVE_KEYS];

/** Shared event names for MissionRuntime bus + telemetry. */
export const EVENT_NAMES = {
  "mission.start": true,
  "mission.step": true,
  "mission.complete": true,
  "mission.fail": true,
  "mission.retry": true,
  "mission.abandon": true,
  "sim.loop.overrun": true,
  "sim.traffic.spawn": true,
  "sim.ped.spawn": true,
  "sim.streamer.evict": true,
  "sim.weather.change": true,
} as const;

export type EventName = keyof typeof EVENT_NAMES;

export function isEventName(s: string): s is EventName {
  return s in EVENT_NAMES;
}
