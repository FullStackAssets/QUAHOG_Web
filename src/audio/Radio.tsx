import { useEffect, useState } from "react";
import { radio, STATIONS } from "./radioEngine";
import { useGame } from "../store";

// Car-radio panel: pick a station (talk host or music), switch live, mute.
// Keys: [ / ] previous/next station, M mute. Collapsible via the store.
export function Radio() {
  const [idx, setIdx] = useState(-1); // -1 = off
  const [muted, setMuted] = useState(false);
  const [track, setTrack] = useState(""); // now-playing song on a music station
  const open = useGame((s) => s.radioOpen);
  const toggleRadio = useGame((s) => s.toggleRadio);

  useEffect(() => { radio.onTrack = setTrack; return () => { if (radio.onTrack === setTrack) radio.onTrack = null; }; }, []);

  const select = (i: number) => {
    const next = i < 0 || i >= STATIONS.length ? -1 : i;
    setIdx(next);
    radio.setStation(next < 0 ? null : STATIONS[next]);
  };
  const step = (d: number) => {
    // wrap through OFF → stations
    const order = [-1, ...STATIONS.map((_, i) => i)];
    const pos = order.indexOf(idx);
    select(order[(pos + d + order.length) % order.length]);
  };
  const toggleMute = () => { const m = !muted; setMuted(m); radio.setMuted(m); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "BracketRight") step(1);
      else if (e.code === "BracketLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const cur = idx >= 0 ? STATIONS[idx] : null;
  const chip = (active: boolean): React.CSSProperties => ({
    pointerEvents: "auto", cursor: "pointer", border: "1px solid #2c3a5e",
    background: active ? "#ffcf4a" : "rgba(5,7,13,.8)", color: active ? "#1a1304" : "#e7e0ff",
    font: "11px 'Courier New', monospace", fontWeight: 700, padding: "5px 8px", borderRadius: 6,
  });

  // collapsed: a compact launcher button (keeps audio playing)
  if (!open) {
    return (
      <button
        onClick={toggleRadio}
        title="Open radio"
        style={{
          position: "fixed", top: 12, right: 12, zIndex: 3, pointerEvents: "auto", cursor: "pointer",
          border: "1px solid #2c3a5e", background: "rgba(5,7,13,.82)", color: "#ffcf4a",
          borderRadius: 8, padding: "8px 10px", font: "14px 'Courier New', monospace",
        }}
      >📻{cur ? ` ${cur.dial}` : ""}</button>
    );
  }

  return (
    <div style={{
      position: "fixed", top: 12, right: 12, zIndex: 3, pointerEvents: "none",
      font: "12px/1.4 'Courier New', monospace", color: "#e7e0ff",
      background: "rgba(5,7,13,.82)", border: "1px solid #2c3a5e", borderRadius: 8, padding: "10px 12px", width: 210,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <b style={{ color: "#ffcf4a" }}>📻 RADIO</b>
        <span style={{ display: "flex", gap: 6 }}>
          <button style={chip(muted)} onClick={toggleMute}>{muted ? "MUTED" : "MUTE"}</button>
          <button style={chip(false)} onClick={toggleRadio} title="Hide radio">▾</button>
        </span>
      </div>
      <div style={{ opacity: 0.85, margin: "5px 0 8px", minHeight: 30 }}>
        {cur ? (
          <>
            <div><b>{cur.dial}</b> {cur.name}</div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>
              {cur.kind === "talk" ? "🎙 " : "🎵 "}{cur.host.name}
            </div>
            {cur.kind === "music" && track && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.85, fontSize: 11 }} title={track}>♪ {track}</span>
                <button style={chip(false)} onClick={() => radio.skipTrack()} title="Skip track">⏭</button>
              </div>
            )}
          </>
        ) : (
          <span style={{ opacity: 0.6 }}>off — pick a station</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={chip(idx === -1)} onClick={() => select(-1)}>OFF</button>
        {STATIONS.map((s, i) => (
          <button key={s.id} style={chip(idx === i)} onClick={() => select(i)} title={`${s.dial} · ${s.host.name}`}>
            {s.name.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ opacity: 0.5, fontSize: 9, marginTop: 8 }}>[ ] change station · ▾ hide</div>
    </div>
  );
}
