import { create } from "zustand";

// Core gameplay stats (§15): wallet, health, and the dual-axis Heat system —
// Axis A = police (0..5 badges), Axis B = faction aggro (0..5). Persisted to
// localStorage.

const KEY = "mounthope.save.v1";

interface Stats {
  cash: number;
  health: number;
  police: number; // 0..5
  faction: number; // 0..5
  addCash: (n: number) => void;
  setHealth: (h: number) => void;
  heat: (police: number, faction: number) => void;
  decay: (dt: number) => void;
  save: () => void;
  load: () => void;
  reset: () => void;
}

const clamp5 = (n: number) => Math.max(0, Math.min(5, n));

// Coerce an unknown persisted value into a finite number within [min,max],
// falling back when the stored value is missing, NaN, Infinity, or the wrong
// type. Guards against corrupt/tampered/legacy localStorage payloads that would
// otherwise poison the store with NaN cash or an out-of-range wanted level.
const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

/** Shape of the persisted stats blob (localStorage). */
interface SavedStats { cash: number; health: number; police: number; faction: number }

export const useStats = create<Stats>((set, get) => ({
  cash: 250,
  health: 100,
  police: 0,
  faction: 0,
  addCash: (n) => set((s) => ({ cash: Math.max(0, s.cash + n) })),
  setHealth: (h) => set({ health: Math.max(0, Math.min(100, h)) }),
  heat: (p, f) => set((s) => ({ police: clamp5(s.police + p), faction: clamp5(s.faction + f) })),
  decay: (dt) =>
    set((s) =>
      s.police === 0 && s.faction === 0
        ? s
        : { police: clamp5(s.police - dt * 0.05), faction: clamp5(s.faction - dt * 0.05) },
    ),
  save: () => {
    const { cash, health, police, faction } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ cash, health, police, faction })); } catch { /* ignore */ }
  },
  load: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedStats> | null;
      if (!parsed || typeof parsed !== "object") return;
      // Coerce + clamp every field instead of blindly spreading the parsed
      // object into the store. A corrupt/legacy save could otherwise inject
      // NaN health, negative cash, an out-of-range wanted level, or stray keys.
      set({
        cash: num(parsed.cash, 250, 0, Number.MAX_SAFE_INTEGER),
        health: num(parsed.health, 100, 0, 100),
        police: clamp5(num(parsed.police, 0, 0, 5)),
        faction: clamp5(num(parsed.faction, 0, 0, 5)),
      });
    } catch { /* ignore malformed save */ }
  },
  reset: () => set({ cash: 250, health: 100, police: 0, faction: 0 }),
}));
