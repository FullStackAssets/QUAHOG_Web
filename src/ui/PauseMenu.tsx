import { useState } from "react";
import { useGame } from "../store";
import { useStats } from "../game";
import { useMission } from "../mission";
import { useEconomy, BUSINESSES } from "../economy";
import { sfx } from "../audio/sfx";
import { radio } from "../audio/radioEngine";
import { QUALITY_LABELS } from "../quality";
import { shared } from "../shared";

// Pause / settings overlay (§26). Opens on Esc/P (handled in GameSystems).
// Freezes the sim loops and exposes quick settings + a save reset.

const btn: React.CSSProperties = {
  display: "block",
  width: "100%",
  margin: "6px 0",
  padding: "10px 14px",
  background: "rgba(40,30,70,.9)",
  border: "1px solid #5a4a8e",
  borderRadius: 8,
  color: "#e7e0ff",
  fontFamily: "'Courier New', monospace",
  fontSize: 14,
  letterSpacing: 1,
  cursor: "pointer",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #221f38" }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <span style={{ color: "#e7e0ff", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function PauseMenu() {
  const paused = useGame((s) => s.paused);
  const view = useGame((s) => s.view);
  const weather = useGame((s) => s.weather);
  const fxOn = useGame((s) => s.fxOn);
  const shadows = useGame((s) => s.shadows);
  const fov = useGame((s) => s.fov);
  const reduceShake = useGame((s) => s.reduceShake);
  const quality = useGame((s) => s.quality);
  const cash = useStats((s) => s.cash);
  const health = useStats((s) => s.health);
  const police = useStats((s) => s.police);
  const faction = useStats((s) => s.faction);
  const scrimshaw = useGame((s) => s.scrimshaw);
  const owned = useEconomy((s) => s.owned);
  const mTitle = useMission((s) => s.title);
  const mDone = useMission((s) => s.done);
  const [vol, setVol] = useState(0.5);
  const [showCredits, setShowCredits] = useState(false);
  const [showStats, setShowStats] = useState(false);
  if (!paused) return null;
  const wlabel = weather === "rain" ? "Rain" : weather === "fog" ? "Fog" : "Clear";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(6,8,16,.66)", backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          width: 320, padding: 22,
          background: "rgba(12,15,26,.95)", border: "1px solid #3a2a5e", borderRadius: 14,
          textAlign: "center",
        }}
      >
        <div style={{ color: "#ff7ad9", fontWeight: 700, letterSpacing: 3, fontFamily: "'Courier New', monospace", fontSize: 20 }}>
          PAUSED
        </div>
        <div style={{ color: "#9a93b8", fontSize: 11, marginBottom: 10, fontFamily: "'Courier New', monospace" }}>
          MOUNT HOPE
        </div>
        <div style={{ color: "#cfc8e6", fontSize: 11, marginBottom: 12, fontFamily: "'Courier New', monospace", lineHeight: 1.6 }}>
          💵 ${Math.floor(cash).toLocaleString()} &nbsp;·&nbsp; 🏠 {Object.keys(owned).length}/{BUSINESSES.length} fronts<br />
          🎯 {mDone ? "Campaign complete" : mTitle}
        </div>

        <button style={btn} onClick={() => useGame.getState().setPaused(false)}>▶ Resume</button>
        <button style={btn} onClick={() => useGame.getState().toggleView()}>
          View: {view === "first" ? "First-person" : "Third-person"}
        </button>
        <button style={btn} onClick={() => useGame.getState().toggleWeather()}>
          Weather: {wlabel}
        </button>
        <button style={btn} onClick={() => useGame.getState().toggleFx()}>
          Effects: {fxOn ? "On" : "Off"}
        </button>
        <button style={btn} onClick={() => useGame.getState().toggleShadows()}>
          Shadows: {shadows ? "On" : "Off"}
        </button>
        <button style={btn} onClick={() => useGame.getState().cycleQuality()}>
          Graphics: {QUALITY_LABELS[quality]}
        </button>
        <button style={btn} onClick={() => useGame.getState().toggleReduceShake()}>
          Camera shake: {reduceShake ? "Off" : "On"}
        </button>
        <div style={{ margin: "8px 0", textAlign: "left", color: "#cfc8e6", fontFamily: "'Courier New', monospace", fontSize: 12 }}>
          Sound volume
          <input
            type="range" min={0} max={1} step={0.05} value={vol}
            onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); sfx.setVolume(v); radio.setVolume(v); }}
            style={{ width: "100%", marginTop: 4 }}
          />
        </div>
        <div style={{ margin: "8px 0", textAlign: "left", color: "#cfc8e6", fontFamily: "'Courier New', monospace", fontSize: 12 }}>
          Field of view: {Math.round(fov)}°
          <input
            type="range" min={45} max={85} step={1} value={fov}
            onChange={(e) => useGame.getState().setFov(parseInt(e.target.value, 10))}
            style={{ width: "100%", marginTop: 4 }}
          />
        </div>
        <button style={btn} onClick={() => setShowStats(true)}>📊 Stats</button>
        <button style={btn} onClick={() => setShowCredits(true)}>ⓘ Credits &amp; attribution</button>
        <button
          style={btn}
          onClick={() => { useGame.getState().setPaused(false); useGame.getState().setStarted(false); }}
        >
          ⏏ Quit to title
        </button>
        <button
          style={{ ...btn, borderColor: "#8e3a3a", color: "#ffb0b0" }}
          onClick={() => {
            useStats.getState().reset();
            useMission.getState().reset();
            useGame.getState().setPaused(false);
          }}
        >
          ⟲ Reset progress
        </button>

        <div style={{ textAlign: "left", color: "#9a93b8", fontSize: 10.5, marginTop: 12, fontFamily: "'Courier New', monospace", lineHeight: 1.7, borderTop: "1px solid #2c2a44", paddingTop: 10 }}>
          <b style={{ color: "#cfc8e6" }}>CONTROLS</b><br />
          WASD move · Shift sprint · E enter/exit · F melee<br />
          Space handbrake · H horn · V view · O photo<br />
          G draw · 1/2/3/4 fists/pistol/shotgun/bat · click fire<br />
          [ ] radio · M map · C character · R weather · T sleep (safehouse)
        </div>
        <div style={{ color: "#6a6486", fontSize: 10, marginTop: 10, fontFamily: "'Courier New', monospace" }}>
          Esc / P to resume
        </div>
      </div>

      {showStats && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 21,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(6,8,16,.82)", backdropFilter: "blur(2px)",
          }}
          onClick={() => setShowStats(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 320, padding: 22,
              background: "rgba(12,15,26,.97)", border: "1px solid #3a2a5e", borderRadius: 14,
              color: "#cfc8e6", fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 2,
            }}
          >
            <div style={{ color: "#ff7ad9", fontWeight: 700, letterSpacing: 2, fontSize: 16, textAlign: "center", marginBottom: 12 }}>
              STATS
            </div>
            <Row label="📅 Day" value={`${shared.day}`} />
            <Row label="❤️ Health" value={`${Math.round(health)}%`} />
            <Row label="💵 Cash" value={`$${Math.floor(cash).toLocaleString()}`} />
            <Row label="🚓 Police heat" value={`${"★".repeat(Math.round(police))}${"☆".repeat(5 - Math.round(police))}`} />
            <Row label="🔪 Faction heat" value={`${"★".repeat(Math.round(faction))}${"☆".repeat(5 - Math.round(faction))}`} />
            <Row label="🏠 Fronts owned" value={`${Object.keys(owned).length} / ${BUSINESSES.length}`} />
            <Row label="🦴 Scrimshaw" value={`${scrimshaw} / 8`} />
            <Row label="🎯 Mission" value={mDone ? "Complete" : mTitle} />
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button style={{ ...btn, width: "auto", display: "inline-block", padding: "8px 18px" }} onClick={() => setShowStats(false)}>
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredits && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 21,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(6,8,16,.82)", backdropFilter: "blur(2px)",
          }}
          onClick={() => setShowCredits(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360, maxHeight: "82vh", overflowY: "auto", padding: 22,
              background: "rgba(12,15,26,.97)", border: "1px solid #3a2a5e", borderRadius: 14,
              color: "#cfc8e6", fontFamily: "'Courier New', monospace", fontSize: 11.5, lineHeight: 1.7,
            }}
          >
            <div style={{ color: "#ff7ad9", fontWeight: 700, letterSpacing: 2, fontSize: 16, textAlign: "center", marginBottom: 4 }}>
              MOUNT HOPE
            </div>
            <div style={{ color: "#9a93b8", fontSize: 10, textAlign: "center", marginBottom: 14 }}>
              Credits &amp; attribution
            </div>

            <b style={{ color: "#e7e0ff" }}>Map data</b><br />
            © OpenStreetMap contributors, licensed under the Open Database License
            (ODbL). Geometry derived from OSM via Overpass.<br /><br />

            <b style={{ color: "#e7e0ff" }}>3D character</b><br />
            “CesiumMan” © Cesium — CC-BY 4.0.<br /><br />

            <b style={{ color: "#e7e0ff" }}>Engine &amp; libraries</b><br />
            Three.js · React Three Fiber · @react-three/rapier · @react-three/drei.<br /><br />

            <b style={{ color: "#e7e0ff" }}>Audio</b><br />
            Procedural Web Audio SFX; radio voices via ElevenLabs TTS (with a
            Web-Speech fallback); music tracks per their own licenses.<br /><br />

            <b style={{ color: "#e7e0ff" }}>Disclaimer</b><br />
            The Narrows is a work of parody/fiction set in a fictionalized South
            Coast. All characters, businesses, factions, and events are invented;
            any resemblance to real people or businesses is coincidental. Not
            affiliated with or endorsed by any real entity.<br /><br />

            <div style={{ textAlign: "center", marginTop: 6 }}>
              <button style={{ ...btn, width: "auto", display: "inline-block", padding: "8px 18px" }} onClick={() => setShowCredits(false)}>
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
