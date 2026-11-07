import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useStats } from "../game";
import { useGame } from "../store";
import type { Weather } from "../store";
import { useEconomy, rollRevenueEvent } from "../economy";
import { useToasts } from "../store";
import { consumeTap } from "../input";
import { shared } from "../shared";
import { sfx } from "../audio/sfx";
import { radio } from "../audio/radioEngine";
import { loadJSON, saveJSON } from "../storage";
import { useMission } from "../mission";
import { useInventory } from "../inventory";
import { useRace } from "../race";
import { SAVE_KEYS } from "../registries";
import { saveUnified } from "../sim/SaveGame";
import { sim } from "../sim/SimRuntime";
import { spatialAudio } from "../audio/SpatialAudio";
import { rng } from "../sim/Rng";

const DAY_SECONDS = 600; // matches DayNight's cycle length
const POS_KEY = SAVE_KEYS.pos;

interface PosRec {
  mode: string; px?: number; py?: number; pz?: number; heading?: number;
  carx?: number; cary?: number; carz?: number; carYaw?: number;
  carType?: string; carColor?: string;
  boatx?: number; boaty?: number; boatz?: number; boatYaw?: number;
  carDamage?: number;
  day?: number; hour?: number; // so Continue resumes the same in-game day/time
}

// Persist where the player is so "Continue" resumes them in place (§26). New
// Game removes this key, so a present key always means "resume".
function savePos() {
  const g = useGame.getState();
  const pl = shared.player?.translation();
  const car = shared.car?.translation();
  const boat = shared.boat?.translation();
  const rec: PosRec = {
    mode: g.mode, px: pl?.x, py: pl?.y, pz: pl?.z, heading: shared.heading,
    carx: car?.x, cary: car?.y, carz: car?.z, carYaw: shared.carYaw,
    carType: g.playerCarType, carColor: g.playerCarColor,
    boatx: boat?.x, boaty: boat?.y, boatz: boat?.z, boatYaw: shared.boatYaw,
    carDamage: shared.carDamage,
    day: shared.day, hour: shared.hour,
  };
  saveJSON(POS_KEY, rec);
  useMission.getState().save();
}
function loadPos(): PosRec | null {
  return loadJSON<PosRec | null>(POS_KEY, null);
}
function applyRestore(r: PosRec) {
  const pl = shared.player, car = shared.car, boat = shared.boat;
  if (!pl) return;
  const g = useGame.getState();
  if (typeof r.day === "number") shared.day = r.day;
  if (typeof r.hour === "number") shared.hour = r.hour;
  if (typeof r.carDamage === "number") shared.carDamage = r.carDamage;
  if (r.boatx != null && boat) {
    boat.setTranslation({ x: r.boatx, y: r.boaty ?? 1.2, z: r.boatz ?? 0 }, true);
    boat.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (r.boatYaw != null) {
      boat.setRotation({ x: 0, y: Math.sin(r.boatYaw / 2), z: 0, w: Math.cos(r.boatYaw / 2) }, true);
      shared.boatYaw = r.boatYaw;
    }
  }
  if (r.mode === "car" && r.carx != null && car) {
    car.setTranslation({ x: r.carx, y: r.cary ?? 1.4, z: r.carz ?? 0 }, true);
    car.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (r.carYaw != null) { car.setRotation({ x: 0, y: Math.sin(r.carYaw / 2), z: 0, w: Math.cos(r.carYaw / 2) }, true); shared.carYaw = r.carYaw; }
    pl.setTranslation({ x: r.carx, y: 2, z: r.carz ?? 0 }, true);
    pl.setEnabled(false);
    if (r.carType && r.carColor) g.setPlayerCar(r.carType, r.carColor);
    g.setMode("car");
  } else if (r.mode === "boat" && r.boatx != null && boat) {
    pl.setTranslation({ x: r.boatx, y: 2, z: r.boatz ?? 0 }, true);
    pl.setEnabled(false);
    if (r.carx != null && car) car.setTranslation({ x: r.carx, y: r.cary ?? 1.4, z: r.carz ?? 0 }, true);
    g.setMode("boat");
  } else if (r.px != null) {
    pl.setEnabled(true);
    pl.setTranslation({ x: r.px, y: r.py ?? 3, z: r.pz ?? 0 }, true);
    pl.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (r.heading != null) shared.heading = r.heading;
    if (r.carx != null && car) car.setTranslation({ x: r.carx, y: r.cary ?? 1.4, z: r.carz ?? 0 }, true);
    g.setMode("foot");
  }
}

// Reactive radio inserts read by whichever host is on after the player shakes a
// chase (§19 milestone reactions). Host-agnostic so any voice can read them.
const EVADE_FLASH = [
  "Scanner's gone quiet down on the waterfront — whoever they were chasin', they're in the wind now. Tip your cap.",
  "Word is the cops just lost somebody in the South End. Happens. Back to the music.",
  "They had the cruisers all lit up a minute ago and now — nothin'. Somebody knows these streets better than the badges do.",
  "Police scanner says 'lost visual.' Two words that make a getaway driver smile. Moving on.",
  "Whoever just gave the law the slip by the bridge — you didn't hear it from me. Here's another one.",
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// Runs the always-on gameplay loops (§15): heat decay + periodic autosave, and
// loads the saved game on mount. Also handles global hotkeys (weather, pause).
export function GameSystems() {
  const acc = useRef(0);
  const prevStars = useRef(0);
  const restored = useRef(false);
  const skidCool = useRef(0);
  const maxStars = useRef(0);
  const revAcc = useRef(0);
  const nextRev = useRef(75); // first revenue event after ~75s of ownership
  useEffect(() => {
    useStats.getState().load();
    useEconomy.getState().load();
    useMission.getState().load();
    useInventory.getState().load();
    useRace.getState().load();
    sfx.startAmbience();
    // Remember last dial id for Continue (panel re-selects on open).
    shared.lastRadioStation = radio.restoreStationId();
    // restore settings (§26)
    {
      const s = loadJSON<Record<string, unknown>>(SAVE_KEYS.settings, {});
      const g = useGame.getState();
      if (typeof s.fxOn === "boolean" && s.fxOn !== g.fxOn) g.toggleFx();
      if (typeof s.shadows === "boolean" && s.shadows !== g.shadows) g.toggleShadows();
      if (typeof s.fov === "number") g.setFov(s.fov);
      if (typeof s.reduceShake === "boolean" && s.reduceShake !== g.reduceShake) g.toggleReduceShake();
      if (typeof s.quality === "number") g.setQuality(s.quality as 0 | 1 | 2);
      if (s.weather) useGame.setState({ weather: s.weather as Weather });
      if (typeof s.weapon === "string") g.setWeapon(s.weapon as "pistol" | "shotgun", false);
      if (typeof s.melee === "string") g.setMelee(s.melee as "fists" | "bat");
      if (typeof s.armed === "boolean" && s.armed !== g.armed) g.toggleArmed();
    }
    // §1.1: heat decay + economy income on fixed step (clock stays with DayNight).
    const offStep = sim.loop.on("step", (dt) => {
      if (!useGame.getState().started || useGame.getState().paused) return;
      const st = useStats.getState();
      const income = useEconomy.getState().incomePerSec(DAY_SECONDS);
      if (income > 0) st.addCash(income * dt);
      st.decay(dt);
      // Wetness / friction clock tracks shared time without double-advancing the day.
      sim.clock.syncFromShared(shared.day, shared.hour, useGame.getState().weather);
      sim.clock.wetness = Math.max(
        0,
        Math.min(
          1,
          sim.clock.wetness + (useGame.getState().weather === "rain" ? dt * 0.08 : -dt * 0.03),
        ),
      );
    });
    // persist position on tab-hide / close so a quick exit still resumes
    const onHide = () => { if (useGame.getState().started) savePos(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      offStep();
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
  useFrame((_, dt) => {
    // resume the saved position once the game starts and the bodies exist (§26).
    // loadPos() is read lazily here so New Game (which removed the key) wins.
    if (!restored.current && useGame.getState().started && shared.player) {
      restored.current = true;
      const r = loadPos();
      if (r) applyRestore(r);
    }
    // global hotkeys
    if (consumeTap("KeyR")) {
      const next = sim.clock.cycleWeather();
      useGame.setState({ weather: next });
      sfx.ui();
    }
    if (consumeTap("KeyP") || consumeTap("Escape")) { useGame.getState().togglePause(); sfx.ui(); }
    if (consumeTap("KeyC")) { useGame.getState().toggleChar(); sfx.ui(); }
    if (consumeTap("KeyM")) { useGame.getState().toggleMap(); sfx.ui(); }
    if (consumeTap("KeyO")) { useGame.getState().togglePhoto(); sfx.ui(); }
    if (consumeTap("KeyG")) useGame.getState().toggleArmed();
    if (consumeTap("Digit1")) { const g = useGame.getState(); g.setMelee("fists"); if (g.armed) g.toggleArmed(); } // bare fists
    if (consumeTap("Digit2")) useGame.getState().setWeapon("pistol");
    if (consumeTap("Digit3")) useGame.getState().setWeapon("shotgun");
    if (consumeTap("Digit4")) { const g = useGame.getState(); g.setMelee("bat"); if (g.armed) g.toggleArmed(); } // baseball bat
    // Reload current firearm
    if (consumeTap("KeyT")) {
      const g = useGame.getState();
      if (useInventory.getState().reload(g.weapon)) { sfx.ui(); useToasts.getState().push("Reloaded", "#ffcf4a"); }
      else useToasts.getState().push("Empty — find ammo", "#ff6a6a");
    }

    // Spatial listener follows the active body (§9.2).
    {
      const mode = useGame.getState().mode;
      const body = mode === "car" ? shared.car : mode === "boat" ? shared.boat : shared.player;
      const t = body?.translation();
      if (t) {
        spatialAudio.setListener(t.x, t.y + 1.6, t.z, Math.sin(shared.camYaw), Math.cos(shared.camYaw));
      }
    }

    if (useGame.getState().paused) return; // freeze sim while paused
    if (shared.alarm.t > 0) shared.alarm.t = Math.max(0, shared.alarm.t - dt);
    // tire screech on hard cornering (§13/§20), with a cooldown so it doesn't spam
    skidCool.current = Math.max(0, skidCool.current - dt);
    if (shared.skid && skidCool.current <= 0) { sfx.screech(); skidCool.current = 0.55; }
    // arrive at a player-placed waypoint → clear it (§21); boat-aware (§8.6.3)
    const wp = useGame.getState().waypoint;
    if (wp) {
      const mode = useGame.getState().mode;
      const body = mode === "car" ? shared.car : mode === "boat" ? shared.boat : shared.player;
      const b = body?.translation();
      if (b && Math.hypot(b.x - wp.x, b.z - wp.z) < 9) {
        useGame.getState().setWaypoint(null);
        useToasts.getState().push("Waypoint reached", "#ff7ad9"); sfx.ui();
      }
    }
    const st = useStats.getState();
    // occasional margin-leak / boom event on an owned front (§15 RevenueManager)
    revAcc.current += dt;
    if (revAcc.current > nextRev.current) {
      revAcc.current = 0;
      nextRev.current = 90 + rng.stream("world").next() * 120; // next in 90–210s
      const ev = rollRevenueEvent(() => rng.stream("world").next());
      if (ev) {
        st.addCash(ev.amount);
        useToasts.getState().push(ev.text, ev.good ? "#7CFC00" : "#ff6a6a");
        ev.good ? sfx.cash() : sfx.ui();
      }
    }
    // slow health regen out of combat (§11)
    if (st.health > 0 && st.health < 100 && useGame.getState().mode === "foot") st.setHealth(st.health + dt * 2.2);
    // wanted-up sting (§23): toast + chirp when police stars rise
    const stars = Math.floor(st.police);
    if (stars > prevStars.current) { useToasts.getState().push(`WANTED ${"★".repeat(stars)}`, "#6cb6ff"); sfx.bust(); }
    if (stars !== prevStars.current) radio.setDuck(stars >= 3 ? 0.4 : 1); // adaptive chase mix (§19)
    maxStars.current = Math.max(maxStars.current, stars);
    // evaded the cops: heat fell to zero after a real chase → cash reward (§14/§15).
    // (skip if we were just busted/wasted — that also zeroes heat)
    if (stars === 0 && maxStars.current >= 2 && !useGame.getState().down) {
      const bonus = maxStars.current * 50;
      st.addCash(bonus);
      useToasts.getState().push(`EVADED — +$${bonus}`, "#7CFC00"); sfx.cash();
      radio.flashNews(pick(EVADE_FLASH)); // hosts react to the chase (§19 milestone)
      maxStars.current = 0;
    }
    prevStars.current = stars;
    // Keep ClockWeather weather in sync with store toggles.
    const weather = useGame.getState().weather;
    if (sim.clock.weather !== weather) sim.clock.setWeather(weather, 0);
    acc.current += dt;
    if (acc.current > 20) {
      acc.current = 0;
      st.save();
      useInventory.getState().save();
      if (useGame.getState().started) savePos();
      const g = useGame.getState();
      saveJSON(SAVE_KEYS.settings, {
        fxOn: g.fxOn, shadows: g.shadows, fov: g.fov, reduceShake: g.reduceShake,
        weather: g.weather, quality: g.quality, weapon: g.weapon, melee: g.melee, armed: g.armed,
      });
      const boatT = shared.boat?.translation();
      saveUnified({
        weapons: { weapon: g.weapon, melee: g.melee, armed: g.armed },
        waypoint: g.waypoint,
        clockWeather: sim.clock.serialize(),
        inventory: {
          pistol: useInventory.getState().pistol,
          shotgun: useInventory.getState().shotgun,
        },
        carDamage: shared.carDamage,
        boat: boatT
          ? { x: boatT.x, y: boatT.y, z: boatT.z, yaw: shared.boatYaw }
          : null,
      });
    }
  });
  return null;
}
