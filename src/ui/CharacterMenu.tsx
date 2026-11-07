import { useGame } from "../store";
import { useStats } from "../game";
import { CHARACTER_MODELS, type CharacterModelId } from "../assets/modelRegistry";

// Character menu (§9/§21): pick outfit tint + Borden/Cesium body, check vitals.

const OUTFITS: { name: string; tint: string }[] = [
  { name: "Dockworker", tint: "#ffffff" },
  { name: "Linguiça Red", tint: "#c0392b" },
  { name: "Harbor Navy", tint: "#2c3e6b" },
  { name: "Olive Field", tint: "#5a6b3a" },
  { name: "Mill Grey", tint: "#7c7e88" },
  { name: "Cape Cod", tint: "#d8b46a" },
];

const swatch = (active: boolean, color: string): React.CSSProperties => ({
  width: 46, height: 46, borderRadius: 10, cursor: "pointer",
  background: color, border: active ? "3px solid #ffcf4a" : "2px solid #3a2a5e",
  boxShadow: active ? "0 0 8px rgba(255,207,74,.6)" : "none",
});

export function CharacterMenu() {
  const open = useGame((s) => s.charOpen);
  const tint = useGame((s) => s.playerTint);
  const model = useGame((s) => s.playerModel);
  const cash = useStats((s) => s.cash);
  const health = useStats((s) => s.health);
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 19,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(6,8,16,.6)", backdropFilter: "blur(2px)",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div style={{ width: 380, padding: 22, background: "rgba(12,15,26,.96)", border: "1px solid #3a2a5e", borderRadius: 14, color: "#e7e0ff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b style={{ color: "#ff7ad9", letterSpacing: 2 }}>🧍 CHARACTER</b>
          <button
            onClick={() => useGame.getState().toggleChar()}
            style={{ cursor: "pointer", border: "1px solid #3a2a5e", background: "rgba(40,30,70,.9)", color: "#e7e0ff", borderRadius: 8, padding: "4px 10px", font: "12px 'Courier New', monospace" }}
          >✕</button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.85, margin: "12px 0 6px" }}>BODY</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CHARACTER_MODELS.map((m) => {
            const active = model === m.id;
            return (
              <button
                key={m.id}
                type="button"
                title={m.label}
                onClick={() => useGame.getState().setPlayerModel(m.id as CharacterModelId)}
                style={{
                  width: 96, cursor: "pointer", borderRadius: 10, padding: 0, overflow: "hidden",
                  border: active ? "3px solid #ffcf4a" : "2px solid #3a2a5e",
                  background: "#1a1528", color: "#e7e0ff",
                  boxShadow: active ? "0 0 8px rgba(255,207,74,.55)" : "none",
                  font: "11px 'Courier New', monospace",
                }}
              >
                {m.preview ? (
                  <img src={m.preview} alt={m.label} style={{ display: "block", width: "100%", height: 72, objectFit: "cover" }} />
                ) : (
                  <div style={{ height: 72, display: "grid", placeItems: "center", opacity: 0.7 }}>GLB</div>
                )}
                <div style={{ padding: "4px 6px" }}>{m.label}</div>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 12, opacity: 0.85, margin: "16px 0 6px" }}>OUTFIT TINT</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {OUTFITS.map((o) => (
            <div key={o.name} title={o.name} style={swatch(tint === o.tint, o.tint)} onClick={() => useGame.getState().setPlayerTint(o.tint)} />
          ))}
        </div>

        <div style={{ fontSize: 12, opacity: 0.85, margin: "16px 0 6px" }}>VITALS</div>
        <div style={{ fontSize: 13 }}>💵 ${cash.toLocaleString()}</div>
        <div style={{ marginTop: 6, height: 8, background: "#3a2a3a", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${health}%`, height: "100%", background: health > 30 ? "#4ad66d" : "#e23b3b" }} />
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Health {Math.round(health)}%</div>
      </div>
    </div>
  );
}
