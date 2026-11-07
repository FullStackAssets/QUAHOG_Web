/**
 * §5.2 Weapon ammo inventory — magazine + reserve, persisted.
 */

import { create } from "zustand";
import { loadJSON, saveJSON, removeItem } from "./storage";
import { SAVE_KEYS } from "./registries";
import type { Weapon } from "./store";

export interface AmmoState {
  pistol: number;
  shotgun: number;
  magPistol: number;
  magShotgun: number;
  spend: (w: Weapon) => boolean;
  reload: (w: Weapon) => boolean;
  add: (w: Weapon, n: number) => void;
  save: () => void;
  load: () => void;
  reset: () => void;
}

const MAG: Record<Weapon, number> = { pistol: 12, shotgun: 6 };
const DEFAULT_RESERVE: Record<Weapon, number> = { pistol: 48, shotgun: 18 };

export const useInventory = create<AmmoState>((set, get) => ({
  pistol: DEFAULT_RESERVE.pistol,
  shotgun: DEFAULT_RESERVE.shotgun,
  magPistol: MAG.pistol,
  magShotgun: MAG.shotgun,
  spend: (w) => {
    const s = get();
    if (w === "pistol") {
      if (s.magPistol <= 0) return false;
      set({ magPistol: s.magPistol - 1 });
      return true;
    }
    if (s.magShotgun <= 0) return false;
    set({ magShotgun: s.magShotgun - 1 });
    return true;
  },
  reload: (w) => {
    const s = get();
    if (w === "pistol") {
      const need = MAG.pistol - s.magPistol;
      if (need <= 0 || s.pistol <= 0) return false;
      const take = Math.min(need, s.pistol);
      set({ pistol: s.pistol - take, magPistol: s.magPistol + take });
      return true;
    }
    const need = MAG.shotgun - s.magShotgun;
    if (need <= 0 || s.shotgun <= 0) return false;
    const take = Math.min(need, s.shotgun);
    set({ shotgun: s.shotgun - take, magShotgun: s.magShotgun + take });
    return true;
  },
  add: (w, n) =>
    set((s) => (w === "pistol" ? { pistol: s.pistol + n } : { shotgun: s.shotgun + n })),
  save: () => {
    const { pistol, shotgun, magPistol, magShotgun } = get();
    saveJSON(SAVE_KEYS.inventory, { pistol, shotgun, magPistol, magShotgun });
  },
  load: () => {
    const raw = loadJSON<Partial<AmmoState> | null>(SAVE_KEYS.inventory, null);
    if (!raw) return;
    set({
      pistol: typeof raw.pistol === "number" ? raw.pistol : DEFAULT_RESERVE.pistol,
      shotgun: typeof raw.shotgun === "number" ? raw.shotgun : DEFAULT_RESERVE.shotgun,
      magPistol: typeof raw.magPistol === "number" ? raw.magPistol : MAG.pistol,
      magShotgun: typeof raw.magShotgun === "number" ? raw.magShotgun : MAG.shotgun,
    });
  },
  reset: () => {
    removeItem(SAVE_KEYS.inventory);
    set({
      pistol: DEFAULT_RESERVE.pistol,
      shotgun: DEFAULT_RESERVE.shotgun,
      magPistol: MAG.pistol,
      magShotgun: MAG.shotgun,
    });
  },
}));

export { MAG as MAG_SIZE };
