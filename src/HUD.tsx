import { useEffect, useState } from "react";
import { useGame } from "./store";
import { useStats } from "./game";
import { useMission } from "./mission";
import { useEconomy, BUSINESSES } from "./economy";
import { shared } from "./shared";
import { radio } from "./audio/radioEngine";
import { SCRIMSHAW_TOTAL } from "./world/Collectibles";

const wrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  fontFamily: "'Courier New', monospace",
  color: "#e7e0ff",
};

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(Math.max(0, 5 - Math.round(n)));

export function HUD({ sliceName }: { sliceName: string }) {
  const mode = useGame((s) => s.mode);
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
  const [compass, setCompass] = useState("N");
  useEffect(() => {
    const id = setInterval(() => {
      const h = Math.floor(shared.hour);
      const m = Math.floor((shared.hour - h) * 60);
      setHhmm(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      setDay(shared.day);
      setStamina(shared.stamina);
      setMph(Math.round(Math.abs(shared.carSpeed) * 2.237)); // m/s → mph
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
        setDist(Math.round(Math.hypot(t.x - step.target[0], t.z - step.target[2])));
        setBearing(Math.atan2(step.target[0] - t.x, step.target[2] - t.z) - shared.camYaw);
      } else setDist(null);
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

  if (photo) return (
    <div style={wrap}>
      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", color: "#ffcf4a", fontSize: 12, letterSpacing: 2, opacity: 0.85 }}>
        📷 PHOTO MODE — O to exit
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      {/* busted / wasted overlay (§15) */}
      {down && (
        <div
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: down === "wasted" ? "rgba(60,0,0,.62)" : "rgba(0,10,40,.62)",
          }}
        >
          <div style={{
            fontSize: 64, fontWeight: 900, letterSpacing: 6,
            color: down === "wasted" ? "#ff5c5c" : "#6cb6ff",
            textShadow: "0 2px 18px rgba(0,0,0,.8)",
          }}>
            {down === "wasted" ? "WASTED" : "BUSTED"}
          </div>
        </div>
      )}

      {/* aiming reticle when armed on foot */}
      {armed && !down && (
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 22, height: 22 }}>
          <div style={{ position: "absolute", left: 10, top: 0, width: 2, height: 22, background: "rgba(255,207,74,.85)" }} />
          <div style={{ position: "absolute", top: 10, left: 0, width: 22, height: 2, background: "rgba(255,207,74,.85)" }} />
        </div>
      )}

      {/* low-health damage vignette (§23) */}
      {hurt > 0 && (
        <div
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            boxShadow: `inset 0 0 ${120 + hurt * 140}px rgba(170,10,10,${0.25 + hurt * 0.45})`,
            transition: "box-shadow .2s linear",
          }}
        />
      )}

      {/* menu / pause button — the only way to open settings on touch (no Esc/P) */}
      <button
        onClick={() => useGame.getState().togglePause()}
        title="Menu (Esc / P)"
        style={{
          position: "absolute", top: 12, left: 12, zIndex: 13,
          width: 42, height: 42, borderRadius: "50%", pointerEvents: "auto", cursor: "pointer",
          background: "rgba(12,15,26,.72)", border: "1px solid #3a2a5e", color: "#e7e0ff", fontSize: 18,
        }}
      >☰</button>

      {/* status panel (top-right under the radio is fine; use top-center-right) */}
      <div
        style={{
          position: "absolute", top: 14, right: 240,
          background: "rgba(12,15,26,.7)", border: "1px solid #3a2a5e",
          borderRadius: 8, padding: "8px 12px", textAlign: "right", minWidth: 150,
        }}
      >
        <div style={{ color: "#7CFC00", fontWeight: 700, fontSize: 15 }}>${Math.floor(cash).toLocaleString()}</div>
        {ownedCount > 0 && <div style={{ fontSize: 10, opacity: 0.8 }}>🏠 {ownedCount}/{BUSINESSES.length} fronts</div>}
        {scrimshaw > 0 && <div style={{ fontSize: 10, opacity: 0.8 }}>🦴 {scrimshaw}/{SCRIMSHAW_TOTAL} scrimshaw</div>}
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>🕑 {hhmm} &nbsp;·&nbsp; Day {day} &nbsp;·&nbsp; 🧭 {compass}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          <span title="police" style={{ color: "#6cb6ff" }}>{stars(police)}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          <span title="faction heat" style={{ color: "#ff5c5c" }}>{stars(faction)}</span>
        </div>
        <div style={{ marginTop: 4, height: 6, background: "#3a2a3a", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${health}%`, height: "100%", background: health > 30 ? "#4ad66d" : "#e23b3b" }} />
        </div>
        {armed ? <div style={{ fontSize: 11, marginTop: 4, color: "#ffcf4a" }}>🔫 {weapon.toUpperCase()}</div>
          : melee === "bat" && <div style={{ fontSize: 11, marginTop: 4, color: "#ffcf4a" }}>🏏 BAT</div>}
        {stamina < 99.5 && (
          <div style={{ marginTop: 4, height: 4, background: "#2a2a3a", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${stamina}%`, height: "100%", background: "#5ad0ff" }} />
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: 14,
          left: 16,
          background: "rgba(12,15,26,.7)",
          border: "1px solid #3a2a5e",
          borderRadius: 8,
          padding: "10px 13px",
          maxWidth: 280,
        }}
      >
        <div style={{ color: "#ff7ad9", fontWeight: 700, letterSpacing: 2 }}>
          MOUNT HOPE
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{sliceName}</div>
        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
          <b>WASD</b> move &nbsp;·&nbsp; {mode === "car" ? <><b>Space</b> handbrake</> : <><b>Shift</b> sprint</>} &nbsp;·&nbsp; <b>E</b> {mode === "car" ? "exit car" : "enter car"}
          <br />
          <b>F</b> melee &nbsp;·&nbsp; <b>V</b> view &nbsp;·&nbsp; <b>[ ]</b> radio
          <br />
          <b>R</b> weather &nbsp;·&nbsp; <b>P</b>/<b>Esc</b> pause
          <br />
          <b>C</b> character &nbsp;·&nbsp; <b>M</b> map
          <br />
          <b>G</b> draw &nbsp;·&nbsp; <b>1/2/3/4</b> fists/pistol/shotgun/bat &nbsp;·&nbsp; <b>click</b> fire &nbsp;·&nbsp; <b>H</b> horn
          <br />
          mode: <b style={{ color: "#22d3ee" }}>{mode === "car" ? "DRIVING" : "ON FOOT"}</b>
        </div>
      </div>

      {/* player waypoint guide (§21) — top-center */}
      {wp && (
        <div style={{
          position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
          background: "rgba(12,15,26,.72)", border: "1px solid #3a2a5e", borderRadius: 8,
          padding: "5px 12px", textAlign: "center", color: "#ff7ad9",
        }}>
          <span style={{ display: "inline-block", transform: `rotate(${wp.bearing}rad)`, fontSize: 16, lineHeight: 1 }}>▲</span>
          <span style={{ fontSize: 12, marginLeft: 6 }}>📍 {wp.dist} m</span>
        </div>
      )}

      {/* radio subtitle caption (§33) */}
      {sub && (
        <div style={{
          position: "absolute", bottom: 84, left: "50%", transform: "translateX(-50%)",
          maxWidth: 620, textAlign: "center", textShadow: "0 1px 6px rgba(0,0,0,.9)",
        }}>
          <span style={{ color: "#ffcf4a", fontWeight: 700, fontSize: 12 }}>{sub.name}: </span>
          <span style={{ color: "#f0ecff", fontSize: 14 }}>{sub.text}</span>
        </div>
      )}

      {/* mission objective */}
      <div
        style={{
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
          background: "rgba(12,15,26,.72)", border: "1px solid #3a2a5e", borderRadius: 8,
          padding: "8px 16px", textAlign: "center", maxWidth: 520,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: 1, color: "#ffcf4a", opacity: 0.9 }}>
          {missionDone ? "MISSION" : missionTitle.toUpperCase()}
        </div>
        <div style={{ fontSize: 13, marginTop: 2, color: missionDone ? "#7CFC00" : "#e7e0ff" }}>
          {missionDone ? "✓ " : "► "}{objective}
          {!missionDone && dist != null && <span style={{ opacity: 0.7 }}> — {dist} m</span>}
        </div>
        {!missionDone && dist != null && (
          <div style={{ marginTop: 4, fontSize: 22, color: "#ffcf4a", transform: `rotate(${bearing}rad)`, lineHeight: 1 }}>▲</div>
        )}
      </div>

      {mode === "foot" && nearCar && (
        <div
          style={{
            position: "absolute",
            bottom: "22%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,46,136,.85)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 6,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          PRESS E TO {nearLabel || "ENTER"}
        </div>
      )}

      {near && (
        <div
          style={{
            position: "absolute", bottom: "27%", left: "50%", transform: "translateX(-50%)",
            background: cash >= near.cost ? "rgba(74,214,109,.9)" : "rgba(80,80,90,.9)",
            color: cash >= near.cost ? "#06210d" : "#fff",
            padding: "8px 16px", borderRadius: 6, fontWeight: 700, letterSpacing: 1, textAlign: "center",
          }}
        >
          PRESS B TO BUY {near.name.toUpperCase()} — ${near.cost.toLocaleString()}
          <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>{near.blurb} · +${near.perDay}/day</div>
        </div>
      )}

      {/* menu launchers */}
      <div style={{ position: "absolute", right: 12, bottom: 30, display: "flex", flexDirection: "column", gap: 8 }}>
        <button style={launcher} onClick={() => useGame.getState().toggleMap()} title="Map (M)">🗺</button>
        <button style={launcher} onClick={() => useGame.getState().toggleChar()} title="Character (C)">🧍</button>
        <button style={launcher} onClick={() => useGame.getState().toggleRadio()} title="Radio">📻</button>
      </div>

      {/* speedometer when driving */}
      {mode === "car" && (
        <div style={{
          position: "absolute", bottom: 34, right: 66, textAlign: "right",
          background: "rgba(12,15,26,.66)", border: "1px solid #3a2a5e", borderRadius: 8, padding: "4px 12px",
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "#22d3ee", fontFamily: "'Courier New', monospace" }}>{mph}</span>
          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>MPH</span>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 6,
          right: 8,
          fontSize: 10,
          opacity: 0.6,
        }}
      >
        Map data © OpenStreetMap contributors, ODbL
      </div>

      {/* build stamp — confirms which deploy is live after a hard refresh */}
      <div
        style={{
          position: "absolute",
          bottom: 6,
          left: 8,
          fontSize: 10,
          opacity: 0.5,
          fontFamily: "'Courier New', monospace",
          letterSpacing: 0.5,
        }}
      >
        build {__BUILD_SHA__} · {__BUILD_DATE__}
      </div>
    </div>
  );
}

const launcher: React.CSSProperties = {
  pointerEvents: "auto", cursor: "pointer", width: 40, height: 40,
  border: "1px solid #3a2a5e", background: "rgba(12,15,26,.82)", color: "#e7e0ff",
  borderRadius: 10, fontSize: 18,
};
