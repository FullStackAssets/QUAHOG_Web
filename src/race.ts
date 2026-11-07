import { create } from "zustand";
import { loadJSON, saveJSON } from "./storage";
import { SAVE_KEYS } from "./registries";

// Street race (§18). Drive the car onto the start pad to begin; hit each
// checkpoint in order against the clock for a cash reward.
export const RACE_START: [number, number] = [-300, 120];
export const CHECKPOINTS: [number, number][] = [
  [-180, 60], [-120, 200], [-320, 270], [-470, 150], [-360, 30], [-300, 120],
];
const REWARD = 750;
const TRACK_ID = "nb-waterfront";

interface RaceState {
  active: boolean;
  idx: number;
  time: number;
  best: number | null;
  start: () => void;
  hit: () => number | null; // returns reward when finished, else null
  tick: (dt: number) => void;
  cancel: () => void;
  load: () => void;
  save: () => void;
}

function persistBest(best: number | null) {
  const all = loadJSON<Record<string, number>>(SAVE_KEYS.raceBests, {});
  if (best == null) return;
  const prev = all[TRACK_ID];
  all[TRACK_ID] = prev == null ? best : Math.min(prev, best);
  saveJSON(SAVE_KEYS.raceBests, all);
}

export const useRace = create<RaceState>((set, get) => ({
  active: false,
  idx: 0,
  time: 0,
  best: null,
  start: () => set({ active: true, idx: 0, time: 0 }),
  tick: (dt) => { if (get().active) set((s) => ({ time: s.time + dt })); },
  hit: () => {
    const { idx, time, best } = get();
    const next = idx + 1;
    if (next >= CHECKPOINTS.length) {
      // Reset the clock too, so a re-entered start pad doesn't briefly show the
      // finished run's elapsed time before start() zeroes it.
      const nb = best == null ? time : Math.min(best, time);
      set({ active: false, idx: 0, time: 0, best: nb });
      persistBest(nb);
      return REWARD;
    }
    set({ idx: next });
    return null;
  },
  cancel: () => set({ active: false, idx: 0, time: 0 }),
  load: () => {
    const all = loadJSON<Record<string, number>>(SAVE_KEYS.raceBests, {});
    const b = all[TRACK_ID];
    set({ best: typeof b === "number" ? b : null });
  },
  save: () => persistBest(get().best),
}));
