/** Lightweight, versioned, bounded local world memory.
 * The world remembers observed game events, not arbitrary NPC simulations.
 * Pure functions stay independent of React, Three, Rapier and browser APIs.
 */
export const WORLD_LEDGER_VERSION = 1;
export const MAX_WORLD_EVENTS = 64;
export const MAX_OFFLINE_GAME_HOURS = 6;
export const GAME_DAY_SECONDS = 600; // preserve the current live game's clock

export type WorldEventKind =
  | "weather" | "business" | "revenue" | "police" | "mission" | "day" | "return";

export interface WorldEvent {
  id: number;
  day: number;
  hour: number;
  kind: WorldEventKind;
  text: string;
}

export interface WorldLedger {
  version: 1;
  nextId: number;
  events: WorldEvent[];
}

export function emptyWorldLedger(): WorldLedger {
  return { version: WORLD_LEDGER_VERSION, nextId: 1, events: [] };
}

const kinds: ReadonlySet<string> = new Set<WorldEventKind>([
  "weather", "business", "revenue", "police", "mission", "day", "return",
]);

/** Reject malformed or oversized saves rather than crashing Safari on launch. */
export function decodeWorldLedger(raw: string | null): WorldLedger | null {
  if (!raw || raw.length > 45000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const s = parsed as Partial<WorldLedger>;
    if (s.version !== WORLD_LEDGER_VERSION || !Number.isSafeInteger(s.nextId) || (s.nextId ?? 0) < 1 || !Array.isArray(s.events) || s.events.length > MAX_WORLD_EVENTS) return null;
    let previous = 0;
    const events: WorldEvent[] = [];
    for (const e of s.events as WorldEvent[]) {
      if (!e || !Number.isSafeInteger(e.id) || e.id <= previous || e.id >= s.nextId! ||
        !Number.isSafeInteger(e.day) || e.day < 1 || e.day > 100000 ||
        !Number.isFinite(e.hour) || e.hour < 0 || e.hour >= 24 ||
        !kinds.has(e.kind) || typeof e.text !== "string" || e.text.length > 180) return null;
      events.push({ id: e.id, day: e.day, hour: e.hour, kind: e.kind, text: e.text });
      previous = e.id;
    }
    return { version: 1, nextId: s.nextId!, events };
  } catch { return null; }
}

export function addWorldEvent(
  state: WorldLedger,
  event: Omit<WorldEvent, "id">,
): WorldLedger {
  if (!Number.isSafeInteger(event.day) || event.day < 1 || !Number.isFinite(event.hour) || event.hour < 0 || event.hour >= 24 ||
    !kinds.has(event.kind) || typeof event.text !== "string" || !event.text.trim()) return state;
  if (!Number.isSafeInteger(state.nextId) || state.nextId >= Number.MAX_SAFE_INTEGER) return state;
  const next: WorldEvent = { ...event, text: event.text.slice(0, 180), id: state.nextId };
  return { version: 1, nextId: state.nextId + 1, events: [...state.events, next].slice(-MAX_WORLD_EVENTS) };
}

export interface GameClock { day: number; hour: number }
export interface OfflineAdvance extends GameClock { elapsedGameHours: number }

/** Coarse time-only catch-up: no simulated physics, missions, or offline income.
 * Capped to stop clock exploits and unrealistic multi-year jumps after absence.
 */
export function catchUpWorldClock(
  clock: GameClock,
  savedAtMs: number | undefined,
  nowMs: number,
): OfflineAdvance {
  const initial = {
    day: Number.isSafeInteger(clock.day) && clock.day >= 1 ? clock.day : 1,
    hour: Number.isFinite(clock.hour) && clock.hour >= 0 && clock.hour < 24 ? clock.hour : 9,
  };
  const unchanged = { ...initial, elapsedGameHours: 0 };
  if (!Number.isFinite(savedAtMs) || !Number.isFinite(nowMs) || savedAtMs! <= 0 || nowMs <= savedAtMs!) return unchanged;
  const elapsedGameHours = Math.min(MAX_OFFLINE_GAME_HOURS, ((nowMs - savedAtMs!) / 1000) * 24 / GAME_DAY_SECONDS);
  if (elapsedGameHours < 1 / 60) return unchanged; // ignore very short tab hops
  const clockHours = initial.hour + elapsedGameHours;
  return {
    day: initial.day + Math.floor(clockHours / 24),
    hour: clockHours % 24,
    elapsedGameHours,
  };
}

/** Economic effects communicate the weather without redesigning legacy payouts.
 * Snow reduces passive business cashflow by 15%, rain by 7%. No retroactive payouts.
 */
export function weatherBusinessMultiplier(weather: string): number {
  return weather === "snow" ? 0.85 : weather === "rain" ? 0.93 : 1;
}
