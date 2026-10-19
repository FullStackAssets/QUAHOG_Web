import { useToasts } from "../store";

// Transient notifications (§21): mission beats, purchases, busts, bounties.
export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div style={{
      position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", zIndex: 12,
      display: "flex", flexDirection: "column", gap: 6, alignItems: "center", pointerEvents: "none",
    }}>
      {items.map((t) => (
        <div key={t.id} style={{
          background: "rgba(12,15,26,.86)", border: `1px solid ${t.color}`, color: t.color,
          borderRadius: 8, padding: "7px 16px", fontFamily: "'Courier New', monospace",
          fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
        }}>{t.text}</div>
      ))}
    </div>
  );
}
