import { create } from "zustand";
import type { Slice } from "./slice";
import type { DistrictId } from "./districts";
import { isMobileDevice } from "./mobile/profile";
import { shared } from "./shared";
import type { Quality } from "./quality";
import { loadJSON, saveJSON } from "./storage";

// NB slice improvements (2026-11-03): the saved car slot. Stealing used to
// overwrite playerCarType with no way back — the Revuelto identity was lost
// after a steal. The saved car is fixed to the Revuelto in v1 (no "make this
// my car" action yet); setSavedCar is reserved for that future action.
const SAVED_CAR_KEY = "mounthope.savedCar.v1";
const savedCarInit = loadJSON<{ type: string; color: string }>(SAVED_CAR_KEY, { type: "revuelto", color: "#b81d24" });
const savedCarTypeInit = typeof savedCarInit.type === "string" && savedCarInit.type ? savedCarInit.type : "revuelto";
const savedCarColorInit = typeof savedCarInit.color === "string" && savedCarInit.color ? savedCarInit.color : "#b81d24";

export type Mode = "foot" | "car" | "boat";
export type View = "third" | "first";
export type Weather = "clear" | "rain" | "fog" | "snow";
export type Down = null | "busted" | "wasted";
export type Weapon = "pistol" | "shotgun";
export type Melee = "fists" | "bat";

interface GameState {
  mode: Mode;
  view: View;
  nearCar: boolean;
  nearLabel: string;
  weather: Weather;
  blizzardActive: boolean;
  weatherBeforeBlizzard: Weather;
  paused: boolean;
  slice: Slice | null;
  radioOpen: boolean;
  charOpen: boolean;
  mapOpen: boolean;
  playerTint: string;
  playerCarType: string;
  playerCarColor: string;
  /** Pack GLB path rendered for the player car when it is not the Revuelto
   *  (stolen traffic car → its TrafficCar.pack; entered parked car → its
   *  ParkedEntry.packPath). Null = Revuelto path, or the logic-type-mapped
   *  pack when a caller did not supply one. Visual only: handling,
   *  collider and save behaviour still key off playerCarType. */
  playerCarPack: string | null;
  /** Ground drop for playerCarPack (floating models only, else 0). */
  playerCarPackYOff: number;
  savedCarType: string; // the recall target — fixed to the Revuelto in v1
  savedCarColor: string;
  setSavedCar: (type: string, color: string) => void;
  armed: boolean;
  weapon: Weapon;
  melee: Melee;
  down: Down;
  started: boolean;
  fxOn: boolean;
  shadows: boolean;
  fov: number;
  reduceShake: boolean;
  quality: Quality;
  photo: boolean;
  scrimshaw: number; // collectibles found (for the HUD counter)
  waypoint: { x: number; z: number } | null; // player-placed map waypoint
  gameId: number; // bumped on New Game so per-game components can remount
  setMode: (m: Mode) => void;
  setView: (v: View) => void;
  toggleView: () => void;
  setNearCar: (v: boolean) => void;
  setNearLabel: (s: string) => void;
  toggleWeather: () => void;
  setBlizzardActive: (active: boolean) => void;
  togglePause: () => void;
  setPaused: (p: boolean) => void;
  setSlice: (s: Slice) => void;
  district: DistrictId;
  pendingFastTravel: { x: number; z: number } | null;
  setDistrict: (d: DistrictId) => void;
  setPendingFastTravel: (p: { x: number; z: number } | null) => void;
  toggleRadio: () => void;
  toggleChar: () => void;
  toggleMap: () => void;
  setPlayerTint: (c: string) => void;
  setPlayerCar: (type: string, color: string, pack?: string | null, packYOff?: number) => void;
  toggleArmed: () => void;
  setWeapon: (w: Weapon, drawn?: boolean) => void;
  setMelee: (m: Melee) => void;
  setDown: (d: Down) => void;
  setStarted: (v: boolean) => void;
  toggleFx: () => void;
  toggleShadows: () => void;
  setFov: (n: number) => void;
  toggleReduceShake: () => void;
  cycleQuality: () => void;
  setQuality: (q: Quality) => void;
  togglePhoto: () => void;
  setScrimshaw: (n: number) => void;
  setWaypoint: (w: { x: number; z: number } | null) => void;
  resetSession: () => void; // wipe in-session gameplay flags for a fresh New Game
}

export const useGame = create<GameState>((set) => ({
  mode: "foot",
  view: "third",
  nearCar: false,
  nearLabel: "",
  weather: "clear",
  blizzardActive: false,
  weatherBeforeBlizzard: "clear",
  paused: false,
  slice: null,
  district: "newBedford",
  pendingFastTravel: null,
  setDistrict: (district) => set({ district }),
  setPendingFastTravel: (pendingFastTravel) => set({ pendingFastTravel }),
  radioOpen: !isMobileDevice(),
  charOpen: false,
  mapOpen: false,
  playerTint: "#ffffff",
  playerCarType: "revuelto",
  playerCarColor: "#b81d24",
  playerCarPack: null,
  playerCarPackYOff: 0,
  savedCarType: savedCarTypeInit,
  savedCarColor: savedCarColorInit,
  setSavedCar: (savedCarType, savedCarColor) => {
    saveJSON(SAVED_CAR_KEY, { type: savedCarType, color: savedCarColor });
    set({ savedCarType, savedCarColor });
  },
  armed: false,
  weapon: "pistol",
  melee: "fists",
  down: null,
  started: false,
  fxOn: !isMobileDevice(),
  shadows: !isMobileDevice(),
  fov: 60,
  reduceShake: false,
  quality: isMobileDevice() ? 0 : 1,
  photo: false,
  scrimshaw: 0,
  waypoint: null,
  gameId: 0,
  setMode: (mode) => set({ mode }),
  setView: (view) => set({ view }),
  toggleView: () => set((s) => ({ view: s.view === "third" ? "first" : "third" })),
  setNearCar: (nearCar) => set((s) => (s.nearCar === nearCar ? s : { nearCar })),
  setNearLabel: (nearLabel) => set((s) => (s.nearLabel === nearLabel ? s : { nearLabel })),
  // Player preview: clear → rain → snow. Story weather stays locked.
  toggleWeather: () => set((s) => s.blizzardActive ? s : ({
    weather: s.weather === "clear" ? "rain" : s.weather === "rain" ? "snow" : "clear",
  })),
  setBlizzardActive: (active) => set((s) => {
    if (s.blizzardActive === active) return s;
    return active
      ? { blizzardActive: true, weatherBeforeBlizzard: s.weather, weather: "snow" }
      : { blizzardActive: false, weather: s.weatherBeforeBlizzard };
  }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (paused) => set({ paused }),
  setSlice: (slice) => set({ slice }),
  toggleRadio: () => set((s) => ({ radioOpen: !s.radioOpen })),
  toggleChar: () => set((s) => ({ charOpen: !s.charOpen })),
  toggleMap: () => set((s) => ({ mapOpen: !s.mapOpen })),
  setPlayerTint: (playerTint) => set({ playerTint }),
  setPlayerCar: (playerCarType, playerCarColor, pack, packYOff) => set({
    playerCarType, playerCarColor,
    playerCarPack: pack ?? null, playerCarPackYOff: packYOff ?? 0,
  }),
  toggleArmed: () => set((s) => ({ armed: !s.armed })),
  setWeapon: (weapon, drawn = true) => set({ weapon, armed: drawn }),
  setMelee: (melee) => set({ melee }),
  setDown: (down) => set({ down }),
  setStarted: (started) => set({ started }),
  toggleFx: () => set((s) => ({ fxOn: !s.fxOn })),
  toggleShadows: () => set((s) => ({ shadows: !s.shadows })),
  setFov: (fov) => set({ fov: Math.max(45, Math.min(85, fov)) }),
  toggleReduceShake: () => set((s) => ({ reduceShake: !s.reduceShake })),
  cycleQuality: () => set((s) => ({ quality: ((s.quality + 1) % 3) as Quality })),
  setQuality: (quality) => set({ quality: Number.isInteger(quality) ? Math.max(0, Math.min(2, quality)) as Quality : 0 }),
  togglePhoto: () => set((s) => ({ photo: !s.photo })),
  setScrimshaw: (scrimshaw) => set({ scrimshaw }),
  setWaypoint: (waypoint) => set({ waypoint }),
  resetSession: () => {
    shared.day = 1; shared.hour = 9; // fresh clock on New Game
    set((s) => ({
      mode: "foot", armed: false, weapon: "pistol", melee: "fists", down: null,
      photo: false, weather: "clear", blizzardActive: false, weatherBeforeBlizzard: "clear", waypoint: null, scrimshaw: 0, gameId: s.gameId + 1,
    }));
  },
}));

// Lightweight toast notifications (§21).
export interface Toast { id: number; text: string; color: string }
interface ToastState { items: Toast[]; push: (text: string, color?: string) => void }
let toastId = 0;
export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (text, color = "#ffcf4a") => {
    const t = { id: toastId++, text, color };
    set((s) => ({ items: [...s.items, t].slice(-4) }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== t.id) })), 3200);
  },
}));
