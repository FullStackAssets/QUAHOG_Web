// Wrong-way detection, extracted so it is unit-testable (playtest 2026-11-02:
// the player drove 800 m away from the objective without noticing).
// hist is a caller-owned sample list, pruned to the last 5 s in place.
// Returns "wrong" once distance has grown >20 m over the window (and the
// objective is still >30 m away), "clear" once it shrinks >5 m, and "same"
// in the in-between band (caller keeps its previous state).
export interface DistSample { t: number; d: number }
export type WrongWayState = "wrong" | "clear" | "same";
export function trackWrongWay(hist: DistSample[], now: number, d: number): WrongWayState {
  hist.push({ t: now, d });
  while (hist.length && now - hist[0].t > 5000) hist.shift();
  if (hist.length < 2) return "same";
  const delta = d - hist[0].d;
  if (delta > 20 && d > 30) return "wrong";
  if (delta < -5) return "clear";
  return "same";
}
