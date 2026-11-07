/**
 * §1.5 Unified SaveGame — versioned blob with migration + Continue gate.
 * Domains: stats, economy, mission, position, settings, scrimshaw, inventory,
 * weapons, waypoint, clock/weather, radio, race bests, boat (optional).
 */

import { loadJSON, saveJSON, removeItem, getItem } from "../storage";
import { SAVE_KEYS } from "../registries";

export const SCHEMA_VERSION = 2 as const;

export interface SaveBlobV2 {
  schemaVersion: 2;
  createdAt: number;
  build: string;
  stats?: { cash: number; health: number; police: number; faction: number };
  economy?: Record<string, true>;
  mission?: { mi: number; step: number; done: boolean };
  position?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  scrimshaw?: number;
  inventory?: { pistol: number; shotgun: number };
  weapons?: { weapon: string; melee: string; armed: boolean };
  waypoint?: { x: number; z: number } | null;
  clockWeather?: { day: number; hour: number; weather: string };
  radio?: { station: string };
  raceBests?: Record<string, number>;
  boat?: { x: number; y: number; z: number; yaw: number } | null;
  carDamage?: number;
}

export interface ContinueGate {
  ok: boolean;
  reason?: string;
}

/** Required keys for Continue — missing any disables the button. */
export function canContinue(): ContinueGate {
  const stats = getItem(SAVE_KEYS.stats);
  const pos = getItem(SAVE_KEYS.pos);
  const mission = getItem(SAVE_KEYS.mission);
  if (!stats) return { ok: false, reason: "missing stats" };
  if (!pos) return { ok: false, reason: "missing position" };
  if (!mission) return { ok: false, reason: "missing mission" };
  try {
    const p = JSON.parse(pos) as Record<string, unknown>;
    if (typeof p.px !== "number" && typeof p.carx !== "number" && typeof p.boatx !== "number") {
      return { ok: false, reason: "position incomplete" };
    }
    const m = JSON.parse(mission) as Record<string, unknown>;
    if (typeof m.mi !== "number" || typeof m.step !== "number") {
      return { ok: false, reason: "mission incomplete" };
    }
  } catch {
    return { ok: false, reason: "corrupt save" };
  }
  return { ok: true };
}

/** Assemble a V2 blob from currently-scattered localStorage keys. */
export function collectLegacySave(): SaveBlobV2 {
  const blob: SaveBlobV2 = {
    schemaVersion: 2,
    createdAt: Date.now(),
    build: "mounthope",
  };
  blob.stats = loadJSON(SAVE_KEYS.stats, undefined);
  blob.economy = loadJSON(SAVE_KEYS.economy, undefined);
  blob.mission = loadJSON(SAVE_KEYS.mission, undefined);
  blob.position = loadJSON(SAVE_KEYS.pos, undefined);
  blob.settings = loadJSON(SAVE_KEYS.settings, undefined);
  blob.scrimshaw = loadJSON(SAVE_KEYS.scrimshaw, undefined);
  blob.inventory = loadJSON(SAVE_KEYS.inventory, undefined);
  blob.radio = loadJSON(SAVE_KEYS.radio, undefined);
  blob.raceBests = loadJSON(SAVE_KEYS.raceBests, undefined);
  // Boat / carDamage piggy-back on the position record when present.
  const pos = blob.position as
    | {
        boatx?: number; boaty?: number; boatz?: number; boatYaw?: number;
        carDamage?: number;
      }
    | undefined;
  if (pos && typeof pos.boatx === "number") {
    blob.boat = {
      x: pos.boatx,
      y: typeof pos.boaty === "number" ? pos.boaty : 1.2,
      z: typeof pos.boatz === "number" ? pos.boatz : 0,
      yaw: typeof pos.boatYaw === "number" ? pos.boatYaw : 0,
    };
  }
  if (pos && typeof pos.carDamage === "number") blob.carDamage = pos.carDamage;
  return blob;
}

export function saveUnified(partial?: Partial<SaveBlobV2>): SaveBlobV2 {
  const blob: SaveBlobV2 = {
    ...collectLegacySave(),
    ...partial,
    schemaVersion: 2,
    createdAt: Date.now(),
    build: "mounthope",
  };
  // Size budget soft assert
  const raw = JSON.stringify(blob);
  if (raw.length > 256 * 1024) {
    console.warn("[SaveGame] blob exceeds 256KB soft budget", raw.length);
  }
  // Atomic-ish: write temp then main
  saveJSON(SAVE_KEYS.saveV2 + ".tmp", blob);
  saveJSON(SAVE_KEYS.saveV2, blob);
  removeItem(SAVE_KEYS.saveV2 + ".tmp");
  return blob;
}

export function loadUnified(): SaveBlobV2 | null {
  const v2 = loadJSON<SaveBlobV2 | null>(SAVE_KEYS.saveV2, null);
  if (v2 && v2.schemaVersion === 2) return v2;
  // Migrate: synthesize from legacy keys if Continue would work
  if (!canContinue().ok) return null;
  const migrated = collectLegacySave();
  saveJSON(SAVE_KEYS.saveV2, migrated);
  return migrated;
}

/** Wipe every known save domain (New Game). */
export function clearAllSaves(): void {
  removeItem(
    SAVE_KEYS.stats,
    SAVE_KEYS.economy,
    SAVE_KEYS.scrimshaw,
    SAVE_KEYS.pos,
    SAVE_KEYS.mission,
    SAVE_KEYS.inventory,
    SAVE_KEYS.radio,
    SAVE_KEYS.raceBests,
    SAVE_KEYS.saveV2,
    SAVE_KEYS.saveV2 + ".tmp",
  );
}

/** Validate a blob; returns error strings (empty = ok). */
export function validateSave(blob: unknown): string[] {
  const errs: string[] = [];
  if (!blob || typeof blob !== "object") return ["not an object"];
  const b = blob as SaveBlobV2;
  if (b.schemaVersion !== 2) errs.push(`unsupported schemaVersion ${String(b.schemaVersion)}`);
  if (b.stats) {
    for (const k of ["cash", "health", "police", "faction"] as const) {
      if (typeof b.stats[k] !== "number" || !Number.isFinite(b.stats[k])) errs.push(`stats.${k}`);
    }
  }
  return errs;
}
