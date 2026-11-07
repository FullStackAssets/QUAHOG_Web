import { create } from "zustand";
import { loadJSON, saveJSON, removeItem } from "./storage";
import { sim } from "./sim/SimRuntime";

// Mission engine (§16). Missions are ordered lists of steps; each step completes
// on reaching a world target and/or being in a car, and may pay a reward.
// Missions chain: finishing one starts the next. Progress persists across Continue.

export interface MissionStep {
  text: string;
  target?: [number, number, number]; // world position to reach
  radius?: number;
  needCar?: boolean; // also requires being in a vehicle
  noHeat?: boolean;  // also requires police heat cleared (lose the cops first)
  reward?: number;   // cash on completing this step
  /** Optional soft-fail timer (seconds) for the step. */
  failSec?: number;
}
interface Mission { title: string; steps: MissionStep[] }

const MISSION_KEY = "mounthope.mission.v1";

// World coords: x = east, z = -north (slice-local).
const MISSIONS: Mission[] = [
  // --- Opener -------------------------------------------------------------
  {
    title: "Off the Boat",
    steps: [
      { text: "Meet Deacon Mealy at Seamen's Bethel", target: [-272.23, 0, 106.5], radius: 10 },
      { text: "The auction soured — steal a car at Reggie's signal", needCar: true, reward: 100 },
      { text: "Shake the cops and lie low at the safehouse", target: [-188, 0, 40], radius: 12, noHeat: true, reward: 500 },
    ],
  },
  // --- Act I — The Whaling City (New Bedford) ------------------------------
  {
    title: "Auction Rules",
    steps: [
      { text: "Grab a car — Sully's collectors are working the docks", needCar: true },
      { text: "Lean on the collectors at the Quohog Republic", target: [-240, 0, 122], radius: 16, needCar: true },
      { text: "Cool the car at Reggie's Anvil Garage", target: [-320, 0, 60], radius: 14, noHeat: true, reward: 700 },
    ],
  },
  {
    title: "The Linguiça Run",
    steps: [
      { text: "Grab a car", needCar: true },
      { text: "Pick up the package at Off the Hook (Long Island)", target: [6092, 0, 4485], radius: 16, needCar: true },
      { text: "Run it downtown to the Quohog Republic", target: [-240, 0, 122], radius: 16, reward: 900 },
    ],
  },
  {
    title: "Harbor Heat",
    steps: [
      { text: "Hit Sully's count house — grab a fast car", needCar: true },
      { text: "Lose the cops, then go to ground at the safehouse", target: [-188, 0, 40], radius: 12, noHeat: true, reward: 1200 },
    ],
  },
  // --- Act II — Spindle City (Fall River) ---------------------------------
  {
    title: "Spindle City",
    steps: [
      { text: "Take I-195 west over the Braga Bridge", target: [-19000, 0, -7000], radius: 60, needCar: true },
      { text: "Case Battleship Cove for Lady Borden's people", target: [-20000, 0, -7400], radius: 40, reward: 1500 },
    ],
  },
  {
    title: "Acquitted",
    steps: [
      { text: "Meet the Lady's man at the Borden House on Second St", target: [-19599, 0, -7080], radius: 18, needCar: true },
      { text: "Run the ledger to Battleship Cove — and lose the tail", target: [-20000, 0, -7400], radius: 40, noHeat: true, reward: 2000 },
    ],
  },
  {
    title: "The Undefeated",
    steps: [
      { text: "Meet Iron Mike at Champion City Gym — Brockton's waiting", target: [-8350, 0, 49620], radius: 38 },
      { text: "Back the kid in the fixed fight — don't throw it", target: [-8350, 0, 49620], radius: 28, noHeat: true, reward: 1800 },
    ],
  },
  // --- Act III — The Cape & the Storm -------------------------------------
  {
    title: "Heritage Marina",
    steps: [
      { text: "Drive to Chip Worthington's heritage marina on the Cape", target: [-10520, 0, 47420], radius: 40, needCar: true },
      { text: "Photograph the laundered hull numbers — get out clean", target: [-10520, 0, 47420], radius: 28, noHeat: true, reward: 2500 },
    ],
  },
  {
    title: "Compound Interest",
    steps: [
      { text: "Roll up on the Fake Kennedys' Hyannis compound", target: [-8480, 0, 52100], radius: 32, needCar: true },
      { text: "Plant the bug in the guest house — ditch the tail", target: [-8480, 0, 52100], radius: 22, noHeat: true, reward: 3000 },
    ],
  },
  {
    title: "Gloria",
    steps: [
      { text: "Gloria's coming ashore — grab wheels and head for high ground", needCar: true },
      { text: "Ride out the surge at the Hurricane Barrier", target: [860, 0, 2000], radius: 50, needCar: true, reward: 3500 },
      { text: "Smuggle the ledger across flooded downtown", target: [-560, 0, 90], radius: 55, noHeat: true, reward: 2000 },
    ],
  },
  {
    title: "Big Mamie",
    steps: [
      { text: "Storm's breaking — book it west over the Braga Bridge", target: [-19000, 0, -7000], radius: 55, needCar: true },
      { text: "Take the deck of the USS Massachusetts — end this", target: [-20000, 0, -7400], radius: 35, reward: 10000 },
    ],
  },
];

interface SavedMission {
  mi: number;
  step: number;
  done: boolean;
}

export type MissionUiPhase = "active" | "failed" | "complete" | "abandoned";

interface MissionState {
  mi: number;
  steps: MissionStep[];
  step: number;
  done: boolean;
  title: string;
  objective: string;
  /** True once the player has entered a vehicle during the current step. */
  enteredCarThisStep: boolean;
  /** Soft-fail / abandon UI phase (mirrors MissionRuntime). */
  phase: MissionUiPhase;
  failReason: string | null;
  advance: () => void;
  reset: () => void;
  noteCarEnter: () => void;
  fail: (reason: string) => void;
  retry: () => void;
  abandon: () => void;
  save: () => void;
  load: () => void;
  clearSave: () => void;
}

function missionAt(mi: number, step: number, done: boolean): Omit<
  MissionState,
  "advance" | "reset" | "noteCarEnter" | "fail" | "retry" | "abandon" | "save" | "load" | "clearSave"
> {
  if (done || mi >= MISSIONS.length) {
    const last = MISSIONS[MISSIONS.length - 1];
    return {
      mi: MISSIONS.length - 1,
      steps: last.steps,
      step: last.steps.length,
      done: true,
      title: last.title,
      objective: "Campaign complete — the Narrows is yours.",
      enteredCarThisStep: false,
      phase: "complete",
      failReason: null,
    };
  }
  const m = MISSIONS[Math.max(0, Math.min(mi, MISSIONS.length - 1))];
  const s = Math.max(0, Math.min(step, m.steps.length - 1));
  return {
    mi,
    steps: m.steps,
    step: s,
    done: false,
    title: m.title,
    objective: m.steps[s].text,
    enteredCarThisStep: false,
    phase: "active",
    failReason: null,
  };
}

function syncRuntimeStart(mi: number, step: number, steps: MissionStep[]): void {
  const failSec = steps[step]?.failSec ?? null;
  sim.missions.start(mi, step, failSec);
}

export const useMission = create<MissionState>((set, get) => ({
  ...missionAt(0, 0, false),
  advance: () => {
    const { mi, step, steps, done, phase } = get();
    if (done || phase === "failed" || phase === "abandoned") return;
    const next = step + 1;
    if (next < steps.length) {
      sim.missions.completeStep(next, steps[next].failSec ?? null);
      set({
        step: next,
        objective: steps[next].text,
        enteredCarThisStep: false,
        phase: "active",
        failReason: null,
      });
      get().save();
      return;
    }
    const nm = mi + 1;
    if (nm < MISSIONS.length) {
      syncRuntimeStart(nm, 0, MISSIONS[nm].steps);
      set({
        mi: nm,
        steps: MISSIONS[nm].steps,
        step: 0,
        title: MISSIONS[nm].title,
        objective: MISSIONS[nm].steps[0].text,
        enteredCarThisStep: false,
        phase: "active",
        failReason: null,
      });
    } else {
      sim.missions.completeMission();
      set({
        step: next,
        done: true,
        objective: "Campaign complete — the Narrows is yours.",
        enteredCarThisStep: false,
        phase: "complete",
        failReason: null,
      });
    }
    get().save();
  },
  reset: () => {
    // In-memory only — callers that wipe progress use clearSave().
    const next = missionAt(0, 0, false);
    syncRuntimeStart(0, 0, next.steps);
    set(next);
  },
  noteCarEnter: () => set({ enteredCarThisStep: true }),
  fail: (reason) => {
    if (get().done || get().phase === "failed") return;
    if (sim.missions.phase !== "failed") sim.missions.fail(reason);
    set({
      phase: "failed",
      failReason: reason,
      objective: `Failed — ${reason}`,
    });
  },
  retry: () => {
    const { mi, step, steps, done } = get();
    if (done) return;
    const failSec = steps[step]?.failSec ?? null;
    sim.missions.retry(step, failSec);
    set({
      phase: "active",
      failReason: null,
      enteredCarThisStep: false,
      objective: steps[step]?.text ?? get().objective,
    });
  },
  abandon: () => {
    if (get().done) return;
    sim.missions.abandon();
    const next = missionAt(0, 0, false);
    set({
      ...next,
      phase: "abandoned",
      objective: "Mission abandoned",
      failReason: null,
    });
  },
  save: () => {
    const { mi, step, done } = get();
    saveJSON(MISSION_KEY, { mi, step, done } satisfies SavedMission);
  },
  load: () => {
    const raw = loadJSON<SavedMission | null>(MISSION_KEY, null);
    if (!raw || typeof raw.mi !== "number" || typeof raw.step !== "number") return;
    const next = missionAt(raw.mi, raw.step, !!raw.done);
    if (!next.done) syncRuntimeStart(next.mi, next.step, next.steps);
    else sim.missions.completeMission();
    set(next);
  },
  clearSave: () => {
    removeItem(MISSION_KEY);
    const next = missionAt(0, 0, false);
    syncRuntimeStart(0, 0, next.steps);
    set(next);
  },
}));

// Kick the runtime for the default campaign start so owned-entity APIs work
// even before the first load/reset.
syncRuntimeStart(0, 0, MISSIONS[0].steps);

export { MISSION_KEY, MISSIONS };
