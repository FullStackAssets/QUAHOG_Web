import { useState } from "react";
import { useGame } from "../store";
import { useStats } from "../game";
import { useMission } from "../mission";
import { useEconomy } from "../economy";
import { sfx } from "../audio/sfx";
import { getItem, removeItem } from "../storage";

const hasSave = () => !!getItem("mounthope.save.v1");

// Title / start screen (§22). Shown over the loading world until the player
// presses Play; doubles as the first user gesture that unlocks audio.

const TIPS = [
  "WASD to move · Shift to sprint · E to grab a car.",
  "G draws your pistol — click to fire. F throws hands.",
  "Heat climbs when you cause trouble. Lay low at the safehouse.",
  "Ram a car to stop it, then jack it on foot with E.",
  "Press M for the map, C for your character, ⚙ to lay out touch controls.",
  "Buy fronts around the city (B) — they pay out every day.",
];

export function StartMenu({ sliceName, progress = 0 }: { sliceName: string; progress?: number }) {
  const started = useGame((s) => s.started);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [save] = useState(hasSave);
  const loaded = sliceName !== "loading…";
  if (started) return null;
  const pct = Math.round(progress * 100);

  const play = () => { sfx.setVolume(0.5); useGame.getState().setStarted(true); };
  const newGame = () => {
    removeItem("mounthope.save.v1", "mounthope.economy.v1", "mounthope.scrimshaw.v1", "mounthope.pos.v1");
    useStats.getState().reset();
    useMission.getState().reset();
    useEconomy.setState({ owned: {} });
    useGame.getState().resetSession(); // clear bat/photo/waypoint/scrimshaw & remount per-game props
    play();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 30, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      background: "radial-gradient(ellipse at 50% 40%, rgba(30,20,55,.7), rgba(4,5,12,.94))",
      fontFamily: "'Courier New', monospace", color: "#e7e0ff",
    }}>
      <div style={{ fontSize: 13, letterSpacing: 8, color: "#ff7ad9", opacity: 0.9 }}>SOUTH COAST · NOW</div>
      <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: 6, color: "#fff", textShadow: "0 4px 30px rgba(255,80,180,.5)", lineHeight: 1 }}>
        THE NARROWS
      </div>
      <div style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>New Bedford · Fall River · the Narrows</div>

      <div style={{ marginTop: 34, display: "flex", gap: 14 }}>
        {save && (
          <button disabled={!loaded} onClick={play} style={btn(loaded, true)}>{loaded ? "▶ CONTINUE" : "LOADING…"}</button>
        )}
        <button disabled={!loaded} onClick={newGame} style={btn(loaded, !save)}>
          {loaded ? (save ? "✦ NEW GAME" : "▶ NEW GAME") : "LOADING…"}
        </button>
      </div>

      {!loaded && (
        <div style={{ marginTop: 22, width: 280 }}>
          <div style={{ height: 6, borderRadius: 4, background: "rgba(120,110,150,.25)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#ff7ad9,#ffcf4a)", transition: "width .2s ease" }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.6, letterSpacing: 1 }}>LOADING NEW BEDFORD · {pct}%</div>
        </div>
      )}

      <a href="earth.html" style={{
        marginTop: 18, textDecoration: "none", pointerEvents: "auto",
        padding: "9px 20px", borderRadius: 8, border: "1px solid #2c6a8e",
        background: "rgba(20,40,60,.7)", color: "#9fe0ff", fontFamily: "'Courier New', monospace",
        fontSize: 13, fontWeight: 700, letterSpacing: 1,
      }}>
        🛰 PHOTOREAL MODE (3D TILES)
      </a>

      <div style={{ marginTop: 22, fontSize: 12, opacity: 0.6, maxWidth: 420 }}>TIP: {tip}</div>
      <div style={{ position: "absolute", bottom: 12, fontSize: 10, opacity: 0.5 }}>
        Map data © OpenStreetMap contributors, ODbL · Imagery © Esri, Maxar, Earthstar Geographics · An original work
      </div>
    </div>
  );
}

function btn(loaded: boolean, primary: boolean): React.CSSProperties {
  return {
    padding: "14px 32px", fontFamily: "'Courier New', monospace", fontSize: 18, fontWeight: 700,
    letterSpacing: 2, cursor: loaded ? "pointer" : "wait", borderRadius: 10, border: "none",
    color: !loaded ? "#888" : primary ? "#1a1304" : "#e7e0ff",
    background: !loaded ? "#3a3a44" : primary ? "#ffcf4a" : "rgba(40,30,70,.9)",
  };
}
