import { create } from "zustand";
import { loadJSON, saveJSON } from "./storage";

// Mission engine (§16). Missions are ordered lists of steps; each step completes
// on reaching a world target and/or being in a car, and may pay a reward.
// Missions chain: finishing one starts the next.
//
// Progress is persisted separately from the wallet. Continue restores cash,
// businesses, and position; without this blob the campaign restarted at
// "Off the Boat" and MissionRunner could pay the opener rewards again.

export const MISSION_SAVE_KEY = "mounthope.mission.v1";
export const CAMPAIGN_COMPLETE = "Campaign complete — the Narrows is yours.";

export interface PlanarPoint { x: number; z: number }
export type ActorMode = "foot" | "car" | "boat";

export interface MissionStep {
  text: string;
  target?: [number, number, number]; // world position to reach
  radius?: number;
  needCar?: boolean; // also requires being in a vehicle
  noHeat?: boolean;  // also requires police heat cleared (lose the cops first)
  reward?: number;   // cash on completing this step
}
interface Mission { title: string; steps: MissionStep[] }

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

interface MissionState {
  mi: number;
  steps: MissionStep[];
  step: number;
  done: boolean;
  title: string;
  objective: string;
  advance: () => void;
  reset: () => void;
  save: () => void;
  load: () => void;
}

interface SavedMission { mi: number; step: number; done: boolean }

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/**
 * Pure completion rule used by MissionRunner.
 * `position` must already be the active actor (foot, car, or boat).
 * A step with no target, no vehicle requirement, and no heat gate is met immediately.
 */
export function missionStepMet(
  step: MissionStep,
  ctx: { mode: ActorMode; police: number; position: PlanarPoint | null },
): boolean {
  if (step.needCar && ctx.mode !== "car") return false;
  if (step.noHeat && ctx.police >= 1) return false;
  if (step.target) {
    if (!ctx.position) return false;
    const radius = step.radius ?? 10;
    const dx = ctx.position.x - step.target[0];
    const dz = ctx.position.z - step.target[2];
    if (Math.hypot(dx, dz) > radius) return false;
  }
  return true;
}

const opening = (): Pick<MissionState, "mi" | "steps" | "step" | "done" | "title" | "objective"> => ({
  mi: 0,
  steps: MISSIONS[0].steps,
  step: 0,
  done: false,
  title: MISSIONS[0].title,
  objective: MISSIONS[0].steps[0].text,
});

const finished = (): Pick<MissionState, "mi" | "steps" | "step" | "done" | "title" | "objective"> => {
  const last = MISSIONS[MISSIONS.length - 1];
  return {
    mi: MISSIONS.length - 1,
    steps: last.steps,
    step: last.steps.length,
    done: true,
    title: last.title,
    objective: CAMPAIGN_COMPLETE,
  };
};

export const useMission = create<MissionState>((set, get) => ({
  ...opening(),
  advance: () => {
    const { mi, step, steps, done } = get();
    if (done) return; // campaign already finished — don't run past the end
    const next = step + 1;
    if (next < steps.length) set({ step: next, objective: steps[next].text });
    else if (mi + 1 < MISSIONS.length) {
      const nm = mi + 1;
      set({ mi: nm, steps: MISSIONS[nm].steps, step: 0, title: MISSIONS[nm].title, objective: MISSIONS[nm].steps[0].text });
    } else {
      set(finished());
    }
    get().save();
  },
  // Memory only. New Game deletes the key; Pause "Reset progress" calls save()
  // afterwards so a refresh cannot reload the cleared campaign.
  reset: () => set(opening()),
  save: () => {
    const { mi, step, done } = get();
    saveJSON(MISSION_SAVE_KEY, { mi, step, done } satisfies SavedMission);
  },
  load: () => {
    const parsed = loadJSON<Partial<SavedMission> | null>(MISSION_SAVE_KEY, null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    if (parsed.done === true) { set(finished()); return; }
    if (!isInt(parsed.mi) || parsed.mi < 0 || parsed.mi >= MISSIONS.length) return;
    const mission = MISSIONS[parsed.mi];
    if (!isInt(parsed.step) || parsed.step < 0 || parsed.step >= mission.steps.length) return;
    set({
      mi: parsed.mi,
      steps: mission.steps,
      step: parsed.step,
      done: false,
      title: mission.title,
      objective: mission.steps[parsed.step].text,
    });
  },
}));
