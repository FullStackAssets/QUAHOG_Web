import { useEffect, useRef, useState } from "react";
import { useGame } from "./store";
import { useStats } from "./game";
import { useMission } from "./mission";
import { useEconomy, BUSINESSES } from "./economy";
import { shared } from "./shared";
import { radio } from "./audio/radioEngine";
import { useCoarsePointer } from "./ui/useCoarsePointer";
import { loadJSON, saveJSON } from "./storage";
import { trackWrongWay } from "./ui/wrongWay";
import { gearForSpeed } from "./ui/gear";
import { edgeArrowForBearing } from "./ui/edgeArrow";
import { isCrossDistrictObjective } from "./districts";
import { POLICE_ENABLED } from "./world/Police";
import { WorldJournalPanel } from "./world/WorldJournalPanel";
import { SCRIMSHAW_TOTAL } from "./world/Collectibles";

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(Math.max(0, 5 - Math.round(n)));

export function HUD({ sliceName }: { sliceName: string }) {
  const touch = useCoarsePointer();
  const [expanded, setExpanded] = useState(() => loadJSON("mounthope.hud.expanded", false));
  const mode = useGame((s) => s.mode);
  const blizzardActive = useGame((s) => s.blizzardActive);
  const nearCar = useGame((s) => s.nearCar);
  const cash = useStats((s) => s.cash);
  const health = useStats((s) => s.health);
  const police = useStats((s) => s.police);
  const faction = useStats((s) => s.faction);
  const objective = useMission((s) => s.objective);
  const missionTitle = useMission((s) => s.title);
  const missionDone = useMission((s) => s.done);
  const armed = useGame((s) => s.armed);
  const weapon = useGame((s) => s.weapon);
  const melee = useGame((s) => s.melee);
  const down = useGame((s) => s.down);
  const nearLabel = useGame((s) => s.nearLabel);
  const photo = useGame((s) => s.photo);
  const scrimshaw = useGame((s) => s.scrimshaw);
  const near = useEconomy((s) => s.near);
  const owned = useEconomy((s) => s.owned);
  const ownedCount = Object.keys(owned).length;
  const [hhmm, setHhmm] = useState("09:00");
  const [day, setDay] = useState(1);
  const [stamina, setStamina] = useState(100);
  const [dist, setDist] = useState<number | null>(null);
  const [bearing, setBearing] = useState(0); // radians, target dir relative to camera
  const [wp, setWp] = useState<{ dist: number; bearing: number } | null>(null);
  const [sub, setSub] = useState<{ name: string; text: string } | null>(null);
  const [mph, setMph] = useState(0);
  const [gear, setGear] = useState<"D" | "R" | "N">("N");
  const [compass, setCompass] = useState("N");
  const [wrongWay, setWrongWay] = useState(false);
  const [edge, setEdge] = useState<{ side: "left" | "right"; dist: number } | null>(null);
  const distHist = useRef<{ t: number; d: number }[]>([]);
  useEffect(() => {
    const id = setInterval(() => {
      const h = Math.floor(shared.hour);
      const m = Math.floor((shared.hour - h) * 60);
      setHhmm(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      setDay(shared.day);
      setStamina(shared.stamina);
      setMph(Math.round(Math.abs(shared.carSpeed) * 2.237)); // m/s → mph
      setGear(gearForSpeed(shared.carSpeed));
      // compass from the active heading (world north = -z)
      const hd = useGame.getState().mode === "car" ? shared.carYaw : shared.heading;
      const bearing = (Math.atan2(Math.sin(hd), -Math.cos(hd)) * 180 / Math.PI + 360) % 360;
      setCompass(["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(bearing / 45) % 8]);
      const body = useGame.getState().mode === "car" ? shared.car : shared.player;
      const t = body?.translation();
      // distance + bearing to the active objective
      const ms = useMission.getState();
      const step = ms.done ? null : ms.steps[ms.step];
      if (step?.target && t) {
        // Cross-district gate (playtest fix, 2026-11-03): same gate the
        // beacon and minimap already use. A straight-line distance across
        // the inter-district gap is meaningless (no drivable corridor), so
        // hide the readout — including bearing, edge arrow and wrong-way —
        // instead of printing e.g. "20632 m".
        if (isCrossDistrictObjective(step.target, useGame.getState().district)) {
          setDist(null); setWrongWay(false); setEdge(null);
        } else {
          const d = Math.round(Math.hypot(t.x - step.target[0], t.z - step.target[2]));
          setDist(d);
          const rel = Math.atan2(step.target[0] - t.x, step.target[2] - t.z) - shared.camYaw;
          setBearing(rel);
          setEdge(edgeArrowForBearing(rel, d));
          // Wrong-way detection (playtest 2026-11-02: the player drove 800 m
          // away from the objective without noticing). See ui/wrongWay.ts.
          const verdict = trackWrongWay(distHist.current, performance.now(), d);
          setWrongWay((prev) => (verdict === "wrong" ? true : verdict === "clear" ? false : prev));
        }
      } else { setDist(null); setWrongWay(false); setEdge(null); }
      // player-placed waypoint (§21)
      const w = useGame.getState().waypoint;
      if (w && t) {
        setWp({
          dist: Math.round(Math.hypot(t.x - w.x, t.z - w.z)),
          bearing: Math.atan2(w.x - t.x, w.z - t.z) - shared.camYaw,
        });
      } else setWp(null);
    }, 200);
    radio.onSubtitle = setSub;
    return () => { clearInterval(id); if (radio.onSubtitle === setSub) radio.onSubtitle = null; };
  }, []);

  const hurt = Math.max(0, (40 - health) / 40); // 0 healthy → 1 near-death

  if (photo) return <div className="hud" data-compact={touch && !expanded}><div className="hud-photo">Photo mode · O to return</div></div>;
  return <div className="hud" data-compact={touch && !expanded}>
    {down && <div className="hud-down">{down === "wasted" ? "WASTED" : "BUSTED"}</div>}
    {armed && !down && <div className="hud-reticle">+</div>}
    {hurt > 0 && <div style={{position:"absolute",inset:0,boxShadow:`inset 0 0 ${120+hurt*140}px rgba(140,35,25,${hurt*0.5})`}} />}
    <button className="hud-menu" onClick={() => useGame.getState().togglePause()} aria-label="Open game menu">☰</button>
    <div className="hud-place"><strong>THE NARROWS</strong><span>NEW BEDFORD · SOUTHCOAST</span></div>
    <div className="hud-status">
      <div className="hud-cash">${Math.floor(cash).toLocaleString()}</div>
      <div className="hud-clock">{hhmm} · Day {day} · {compass}</div>
      <div className="hud-health" role="meter" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health}><span style={{width:`${Math.max(0,Math.min(100,health))}%`,background:health<30?"#d79c87":undefined}} /></div>
      {stamina < 99.5 && <div className="hud-stamina" aria-label={`Stamina ${Math.round(stamina)} percent`}><span style={{width:`${stamina}%`}} /></div>}
      {POLICE_ENABLED && police > 0 && <div className="hud-heat" aria-label={`Police heat ${police}`}>{stars(police)}</div>}
      {faction > 0 && <div className="hud-heat faction" aria-label={`Faction heat ${faction}`}>{stars(faction)}</div>}
      {ownedCount > 0 && <div className="hud-inventory hud-secondary">{ownedCount}/{BUSINESSES.length} fronts</div>}
      {scrimshaw > 0 && <div className="hud-inventory hud-secondary">{scrimshaw}/{SCRIMSHAW_TOTAL} scrimshaw</div>}
      {(armed || melee === "bat") && <div className="hud-inventory hud-secondary">{armed ? weapon : "bat"}</div>}
    </div>
    <section className="hud-objective" aria-label="Current objective">
      <h2>{missionDone ? "MISSION COMPLETE" : missionTitle.toUpperCase()}</h2>
      <p>{!missionDone && dist != null && <span className="hud-direction" style={{transform:`rotate(${bearing}rad)`}}>▲</span>}{objective}{!missionDone && dist != null && <span className="hud-distance"> · {dist} m</span>}</p>
      {blizzardActive && <span className="hud-storm">Blizzard of ’26 · 52-inch drifts</span>}
      {wrongWay && !missionDone && <span className="hud-wrongway">⚠ WRONG WAY — the objective is behind you</span>}
    </section>
    <details className="hud-help"><summary>Keyboard controls</summary><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> sprint<br/><kbd>E</kbd> enter/exit · <kbd>Space</kbd> brake<br/><kbd>F</kbd> melee · <kbd>G</kbd> draw · click fire<br/><kbd>V</kbd> view · <kbd>H</kbd> horn<br/><kbd>M</kbd> map · <kbd>C</kbd> character<br/><kbd>R</kbd> weather · <kbd>[ ]</kbd> radio<br/><kbd>1–4</kbd> weapons · <kbd>O</kbd> photo</p></details>
    {wp && <div className="hud-waypoint"><span style={{display:"inline-block",transform:`rotate(${wp.bearing}rad)`}}>▲</span> Waypoint · {wp.dist} m</div>}
    {edge && !missionDone && <div className={`hud-edge-arrow ${edge.side}`} aria-label="Objective off-screen">{edge.side === "left" ? `◀ ${edge.dist} m` : `${edge.dist} m ▶`}</div>}
    {sub && <div className="hud-caption"><b>{sub.name}: </b>{sub.text}</div>}
    {mode === "foot" && nearCar && <div className="hud-prompt"><span className="desktop-interact">E · </span>{nearLabel || "Enter vehicle"}<small>Use the CAR control on touch</small></div>}
    {near && <div className="hud-prompt" style={{bottom:"34%"}}><span className="desktop-interact">B · </span>{near.name} · ${near.cost.toLocaleString()}<small>{near.blurb} · +${near.perDay}/day</small><button onClick={() => { import("./input").then(({virtualTap}) => virtualTap("KeyB")); }} disabled={cash < near.cost}>Buy front</button></div>}
    <nav className="hud-actions" aria-label="Game panels">
    {touch && <button className="hud-density" aria-label={expanded ? "Use compact HUD" : "Expand HUD"} aria-pressed={expanded} onClick={() => {
      setExpanded(!expanded); saveJSON("mounthope.hud.expanded", !expanded);
    }}>{expanded ? "Less" : "More"}</button>}

      <button onClick={() => useGame.getState().toggleMap()}>Map</button>
      <button onClick={() => useGame.getState().toggleChar()}>Player</button>
      <button onClick={() => useGame.getState().toggleRadio()}>Radio</button>
      <WorldJournalPanel />
    </nav>
    {mode === "car" && <div className="hud-speed"><strong>{mph}</strong><small>MPH</small><span className="hud-gear">{gear}</span></div>}
    <div className="hud-credit">Map © OpenStreetMap · ODbL</div>
    <div className="hud-build">{__BUILD_SHA__} · {__BUILD_DATE__}</div>
  </div>;
}
