import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useStats } from "../game";
import { useMission } from "../mission";
import { useGame } from "../store";
import type { Weather } from "../store";
import { useEconomy, rollRevenueEvent, BUSINESSES } from "../economy";
import { useToasts } from "../store";
import { consumeTap } from "../input";
import { shared } from "../shared";
import { sfx } from "../audio/sfx";
import { radio } from "../audio/radioEngine";
import { loadJSON, saveJSON } from "../storage";
import { catchUpWorldClock, weatherBusinessMultiplier } from "./worldContinuity";
import type { WorldEventKind } from "./worldContinuity";
import { worldJournal } from "./worldJournal";

const DAY_SECONDS = 600; // matches DayNight's cycle length
const POS_KEY = "mounthope.pos.v1";

interface PosRec {
  mode: string; px?: number; py?: number; pz?: number; heading?: number;
  carx?: number; cary?: number; carz?: number; carYaw?: number;
  carType?: string; carColor?: string;
  day?: number; hour?: number; // so Continue resumes the same in-game day/time
  savedAtMs?: number; // optional: older saves remain compatible
}

// Persist where the player is so "Continue" resumes them in place (§26). New
// Game removes this key, so a present key always means "resume".
function savePos() {
  const g = useGame.getState();
  const pl = shared.player?.translation();
  const car = shared.car?.translation();
  const rec: PosRec = {
    mode: g.mode, px: pl?.x, py: pl?.y, pz: pl?.z, heading: shared.heading,
    carx: car?.x, cary: car?.y, carz: car?.z, carYaw: shared.carYaw,
    carType: g.playerCarType, carColor: g.playerCarColor,
    day: shared.day, hour: shared.hour, savedAtMs: Date.now(),
  };
  saveJSON(POS_KEY, rec);
}
function loadPos(): PosRec | null {
  return loadJSON<PosRec | null>(POS_KEY, null);
}
function applyRestore(r: PosRec) {
  const pl = shared.player, car = shared.car;
  if (!pl) return;
  const g = useGame.getState();
  const clock = catchUpWorldClock({ day: r.day ?? shared.day, hour: r.hour ?? shared.hour }, r.savedAtMs, Date.now());
  shared.day = clock.day;
  shared.hour = clock.hour;
  if (clock.elapsedGameHours >= 1 / 60) {
    worldJournal.record({ kind: "return", day: shared.day, hour: shared.hour,
      text: `While you were away, ${Math.floor(clock.elapsedGameHours * 60)} game minutes passed. The city clock kept moving.` });
  }
  if (r.mode === "car" && r.carx != null && car) {
    car.setTranslation({ x: r.carx, y: r.cary ?? 1.4, z: r.carz ?? 0 }, true);
    car.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (r.carYaw != null) { car.setRotation({ x: 0, y: Math.sin(r.carYaw / 2), z: 0, w: Math.cos(r.carYaw / 2) }, true); shared.carYaw = r.carYaw; }
    pl.setTranslation({ x: r.carx, y: 2, z: r.carz ?? 0 }, true);
    pl.setEnabled(false);
    if (r.carType && r.carColor) g.setPlayerCar(r.carType, r.carColor);
    g.setMode("car");
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
const remember = (kind: WorldEventKind, text: string) => worldJournal.record({ kind, text, day: shared.day, hour: shared.hour });

// Runs the always-on gameplay loops (§15): heat decay + periodic autosave, and
// loads the saved game on mount. Also handles global hotkeys (weather, pause).
export function GameSystems() {
  const acc = useRef(0);
  const prevStars = useRef(0);
  const restored = useRef(false);
  const skidCool = useRef(0);
  const maxStars = useRef(0);
  const revAcc = useRef(0);
  const previousDay = useRef(1);
  const nextRev = useRef(75); // first revenue event after ~75s of ownership
  useEffect(() => {
    useStats.getState().load();
    useEconomy.getState().load();
    worldJournal.load();
    // An actual business purchase alters the ongoing economy and the journal.
    const unsubscribeBusinesses = useEconomy.subscribe((next, previous) => {
      if (!useGame.getState().started || next.owned === previous.owned) return;
      for (const id of Object.keys(next.owned)) {
        if (!previous.owned[id]) {
          const b = BUSINESSES.find((item) => item.id === id);
          if (b) remember("business", `${b.name} changed hands. Your neighborhood income increased.`);
        }
      }
    });
    const unsubscribeMissions = useMission.subscribe((now, previous) => {
      if (!useGame.getState().started) return;
      if (now.done && !previous.done) remember("mission", `The ${previous.title} storyline came to a close.`);
      else if (now.mi !== previous.mi && now.mi > previous.mi) remember("mission", `${previous.title} ended. ${now.title} began.`);
      else if (now.mi === previous.mi && now.step > previous.step) remember("mission", `${now.title}: ${now.objective}`);
    });
    const unsubscribeWeather = useGame.subscribe((now, previous) => {
      if (!now.started || now.weather === previous.weather) return;
      const description = now.weather === "snow" ? "Snow is slowing deliveries; owned fronts earn 15% less until roads clear."
        : now.weather === "rain" ? "Rain has reduced foot traffic; owned fronts earn 7% less for now."
        : "The weather shifted; business activity is back to its normal pace.";
      remember("weather", description);
    });
    previousDay.current = shared.day;
    prevStars.current = Math.floor(useStats.getState().police);
    sfx.startAmbience();
    // restore settings (§26)
    {
      const s = loadJSON<Record<string, unknown>>("mounthope.settings.v1", {});
      const g = useGame.getState();
      if (typeof s.fxOn === "boolean" && s.fxOn !== g.fxOn) g.toggleFx();
      if (typeof s.shadows === "boolean" && s.shadows !== g.shadows) g.toggleShadows();
      if (typeof s.fov === "number") g.setFov(s.fov);
      if (typeof s.reduceShake === "boolean" && s.reduceShake !== g.reduceShake) g.toggleReduceShake();
      if (typeof s.quality === "number") g.setQuality(s.quality as 0 | 1 | 2);
      if (s.weather) useGame.setState({ weather: s.weather as Weather });
    }
    // persist position on tab-hide / close so a quick exit still resumes
    const onHide = () => {
      const g = useGame.getState();
      if (!g.started) return;
      savePos(); useStats.getState().save(); useEconomy.getState().save();
      saveJSON("mounthope.settings.v1", {fxOn:g.fxOn,shadows:g.shadows,fov:g.fov,reduceShake:g.reduceShake,weather:g.weather,quality:g.quality});
    };
    window.addEventListener("pagehide", onHide);
    const onVisibility = () => { if (document.hidden) onHide(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { unsubscribeBusinesses(); unsubscribeMissions(); unsubscribeWeather(); window.removeEventListener("pagehide", onHide); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  useFrame((_, dt) => {
    // resume the saved position once the game starts and the bodies exist (§26).
    // loadPos() is read lazily here so New Game (which removed the key) wins.
    if (!restored.current && useGame.getState().started && shared.player) {
      restored.current = true;
      const r = loadPos();
      if (r) applyRestore(r);
      previousDay.current = shared.day;
      prevStars.current = Math.floor(useStats.getState().police);
    }
    // global hotkeys
    if (consumeTap("KeyR")) { useGame.getState().toggleWeather(); sfx.ui(); }
    if (consumeTap("KeyP") || consumeTap("Escape")) { useGame.getState().togglePause(); sfx.ui(); }
    if (consumeTap("KeyC")) { useGame.getState().toggleChar(); sfx.ui(); }
    if (consumeTap("KeyM")) { useGame.getState().toggleMap(); sfx.ui(); }
    if (consumeTap("KeyO")) { useGame.getState().togglePhoto(); sfx.ui(); }
    if (consumeTap("KeyG")) useGame.getState().toggleArmed();
    if (consumeTap("Digit1")) { const g = useGame.getState(); g.setMelee("fists"); if (g.armed) g.toggleArmed(); } // bare fists
    if (consumeTap("Digit2")) useGame.getState().setWeapon("pistol");
    if (consumeTap("Digit3")) useGame.getState().setWeapon("shotgun");
    if (consumeTap("Digit4")) { const g = useGame.getState(); g.setMelee("bat"); if (g.armed) g.toggleArmed(); } // baseball bat

    if (useGame.getState().paused) return; // freeze sim while paused
    if (useGame.getState().started && shared.day !== previousDay.current) {
      if (shared.day > previousDay.current) remember("day", `Day ${shared.day} began in the SouthCoast.`);
      previousDay.current = shared.day;
    }
    if (shared.alarm.t > 0) shared.alarm.t = Math.max(0, shared.alarm.t - dt);
    // tire screech on hard cornering (§13/§20), with a cooldown so it doesn't spam
    skidCool.current = Math.max(0, skidCool.current - dt);
    if (shared.skid && skidCool.current <= 0) { sfx.screech(); skidCool.current = 0.55; }
    // arrive at a player-placed waypoint → clear it (§21)
    const wp = useGame.getState().waypoint;
    if (wp) {
      const b = (useGame.getState().mode === "car" ? shared.car : shared.player)?.translation();
      if (b && Math.hypot(b.x - wp.x, b.z - wp.z) < 9) {
        useGame.getState().setWaypoint(null);
        useToasts.getState().push("Waypoint reached", "#ff7ad9"); sfx.ui();
      }
    }
    const st = useStats.getState();
    // passive business revenue (§15 RevenueManager)
    const income = useEconomy.getState().incomePerSec(DAY_SECONDS);
    if (income > 0) st.addCash(income * dt * weatherBusinessMultiplier(useGame.getState().weather));
    // occasional margin-leak / boom event on an owned front (§15 RevenueManager)
    revAcc.current += dt;
    if (revAcc.current > nextRev.current) {
      revAcc.current = 0;
      nextRev.current = 90 + Math.random() * 120; // next in 90–210s
      const ev = rollRevenueEvent();
      if (ev) {
        st.addCash(ev.amount);
        remember("revenue", ev.text);
        useToasts.getState().push(ev.text, ev.good ? "#7CFC00" : "#ff6a6a");
        ev.good ? sfx.cash() : sfx.ui();
      }
    }
    // slow health regen out of combat (§11)
    if (st.health > 0 && st.health < 100 && useGame.getState().mode === "foot") st.setHealth(st.health + dt * 2.2);
    // wanted-up sting (§23): toast + chirp when police stars rise
    const stars = Math.floor(st.police);
    if (stars > prevStars.current) { remember("police", `Police attention escalated to ${stars} star${stars === 1 ? "" : "s"}.`); useToasts.getState().push(`WANTED ${"★".repeat(stars)}`, "#6cb6ff"); sfx.bust(); }
    if (stars !== prevStars.current) radio.setDuck(stars >= 3 ? 0.4 : 1); // adaptive chase mix (§19)
    maxStars.current = Math.max(maxStars.current, stars);
    // evaded the cops: heat fell to zero after a real chase → cash reward (§14/§15).
    // (skip if we were just busted/wasted — that also zeroes heat)
    if (stars === 0 && maxStars.current >= 2 && !useGame.getState().down) {
      const bonus = maxStars.current * 50;
      st.addCash(bonus);
      remember("police", `The pursuit ended. You escaped and collected $${bonus}.`);
      useToasts.getState().push(`EVADED — +$${bonus}`, "#7CFC00"); sfx.cash();
      radio.flashNews(pick(EVADE_FLASH)); // hosts react to the chase (§19 milestone)
      maxStars.current = 0;
    }
    prevStars.current = stars;
    st.decay(dt);
    acc.current += dt;
    if (acc.current > 20) {
      acc.current = 0;
      st.save();
      if (useGame.getState().started) savePos();
      const g = useGame.getState();
      saveJSON("mounthope.settings.v1", { fxOn: g.fxOn, shadows: g.shadows, fov: g.fov, reduceShake: g.reduceShake, weather: g.weather, quality: g.quality });
    }
  });
  return null;
}
