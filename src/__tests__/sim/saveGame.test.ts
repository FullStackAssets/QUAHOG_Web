import { describe, expect, it } from "vitest";
import {
  canContinue,
  clearAllSaves,
  collectLegacySave,
  validateSave,
  SCHEMA_VERSION,
} from "../../sim/SaveGame";
import { saveJSON, removeItem } from "../../storage";
import { SAVE_KEYS } from "../../registries";

describe("SaveGame", () => {
  it("canContinue requires stats + pos + mission", () => {
    clearAllSaves();
    expect(canContinue().ok).toBe(false);
    saveJSON(SAVE_KEYS.stats, { cash: 1, health: 100, police: 0, faction: 0 });
    expect(canContinue().ok).toBe(false);
    saveJSON(SAVE_KEYS.pos, { mode: "foot", px: 1, py: 2, pz: 3 });
    expect(canContinue().ok).toBe(false);
    saveJSON(SAVE_KEYS.mission, { mi: 0, step: 0, done: false });
    expect(canContinue().ok).toBe(true);
    removeItem(SAVE_KEYS.pos);
    expect(canContinue().reason).toMatch(/position/i);
  });

  it("validateSave rejects bad schema", () => {
    expect(validateSave(null).length).toBeGreaterThan(0);
    expect(validateSave({ schemaVersion: SCHEMA_VERSION, createdAt: 1, build: "t" })).toEqual([]);
  });

  it("collectLegacySave pulls boat + carDamage from position", () => {
    clearAllSaves();
    saveJSON(SAVE_KEYS.pos, {
      mode: "boat",
      px: 1, py: 2, pz: 3,
      boatx: 10, boaty: 1.2, boatz: 20, boatYaw: 0.5,
      carDamage: 42,
    });
    const blob = collectLegacySave();
    expect(blob.carDamage).toBe(42);
    expect(blob.boat).toEqual({ x: 10, y: 1.2, z: 20, yaw: 0.5 });
  });
});
