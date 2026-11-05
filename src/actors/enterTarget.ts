// On-foot vehicle-enter target selection (NB slice improvements, 2026-11-03).
// Pure function over distances so the priority + heat policy is unit-testable;
// Player.tsx consumes it and performs the body/teleport side effects.

import type { ParkedEntry, TrafficCar } from "../shared";

export type EnterKind = "boat" | "steal" | "parked" | "own" | "none";

export interface EnterCandidates {
  traffic: TrafficCar | null;
  trafficD: number;
  parked: ParkedEntry | null;
  parkedD: number;
  ownD: number;
  boatD: number;
}

/** Priority on ties: boat > traffic > parked > own, each only competing
 *  while actually in range (boat < 6 m, own < 4.5 m, traffic/parked only
 *  exist when a car was found within 4.5 m). The old inline code compared
 *  against the ENTER_RADIUS sentinel when no traffic car existed, which
 *  made a boat at 5 m unboardable whenever no car was near — the sentinel
 *  is not a candidate, so it must not block the boat. */
export function pickEnterTarget(c: EnterCandidates): EnterKind {
  const boatIn = c.boatD < 6;
  const ownIn = c.ownD < 4.5;
  if (boatIn && (!ownIn || c.boatD <= c.ownD) && (!c.traffic || c.boatD <= c.trafficD) && (!c.parked || c.boatD <= c.parkedD)) return "boat";
  if (c.traffic && (!ownIn || c.trafficD <= c.ownD) && (!c.parked || c.trafficD <= c.parkedD)) return "steal";
  if (c.parked && (!ownIn || c.parkedD <= c.ownD)) return "parked";
  if (ownIn) return "own";
  return "none";
}

/** Heat added by entering, per kind. Entering your own car or an unoccupied
 *  parked car is not a crime (the old own-car branch wrongly added 0.5 heat
 *  with a "grand theft auto (own ride)" comment). Only carjacking draws heat. */
export const ENTER_HEAT: Record<EnterKind, [number, number]> = {
  boat: [0, 0],
  steal: [0.8, 0.4],
  parked: [0, 0],
  own: [0, 0],
  none: [0, 0],
};

export const ENTER_LABEL: Record<EnterKind, string> = {
  boat: "BOARD BOAT",
  steal: "STEAL CAR",
  parked: "ENTER CAR",
  own: "ENTER CAR",
  none: "",
};
