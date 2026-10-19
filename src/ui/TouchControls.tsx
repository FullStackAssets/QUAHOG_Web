import { useEffect, useRef, useState } from "react";
import { setVirtualMove, virtualTap, setVirtualHold } from "../input";

// On-screen controls for phones/tablets (§25 touch): a left thumb-stick that
// feeds the movement axis + a full set of action buttons. Every control can be
// dragged (move) and resized in EDIT mode (⚙), and toggled on/off so players
// can hide buttons they don't want; the layout + visibility persist.

const KEY = "mounthope.touchlayout.v3";

type Ctl = { left: number; top: number; size: number };
type Layout = Record<string, Ctl>;
type Saved = { layout: Layout; hidden: Record<string, true> };

// Every action button — labeled + colour-coded (GTA-mobile style). `hold` keys
// (sprint/handbrake) press-and-hold; the rest fire a one-shot tap. `big` = the
// prominent RUN button. `defHidden` start hidden (toggle on in edit mode).
const BTNS: { k: string; label: string; action: string; color: string; hold?: boolean; big?: boolean; defHidden?: boolean }[] = [
  { k: "fire", label: "FIRE", action: "Mouse0", color: "#a23a3a" },
  { k: "e", label: "CAR", action: "KeyE", color: "#3461a8" },
  { k: "g", label: "GUN", action: "KeyG", color: "#5b6070" },
  { k: "f", label: "HIT", action: "KeyF", color: "#b5742a" },
  { k: "brake", label: "BRAKE", action: "Space", hold: true, color: "#45506a" },
  { k: "sprint", label: "RUN", action: "ShiftLeft", hold: true, color: "#c79a2e", big: true },
  { k: "v", label: "VIEW", action: "KeyV", color: "#3a4060" },
  { k: "horn", label: "HORN", action: "KeyH", color: "#3a4a6a" },
  { k: "map", label: "MAP", action: "KeyM", color: "#3a4a6a" },
  { k: "menu", label: "MENU", action: "KeyP", color: "#3a3f4e", defHidden: true },
  { k: "buy", label: "BUY", action: "KeyB", color: "#3a6a4a", defHidden: true },
  { k: "char", label: "FIT", action: "KeyC", color: "#6a4a8a", defHidden: true },
  { k: "photo", label: "PHOTO", action: "KeyO", color: "#3a4a6a", defHidden: true },
  { k: "sleep", label: "SLEEP", action: "KeyT", color: "#3a4a6a", defHidden: true },
  { k: "weather", label: "WX", action: "KeyR", color: "#3a4a6a", defHidden: true },
  { k: "w1", label: "1", action: "Digit1", color: "#3a3f4e", defHidden: true },
  { k: "w2", label: "2", action: "Digit2", color: "#3a3f4e", defHidden: true },
  { k: "w3", label: "3", action: "Digit3", color: "#3a3f4e", defHidden: true },
  { k: "w4", label: "4", action: "Digit4", color: "#3a3f4e", defHidden: true },
];
const BTN_OF = Object.fromEntries(BTNS.map((b) => [b.k, b]));

const MIN = { stick: 90, btn: 40 };
const MAX = { stick: 230, btn: 120 };

function defaults(vw: number, vh: number): Saved {
  const big = 62, sm = 52, stick = 130, gap = 12;
  const cx0 = vw - 16 - big, cx1 = cx0 - gap - big; // two action columns, bottom-right
  const by0 = vh - 26 - big, by1 = by0 - gap - big, by2 = by1 - gap - big;
  const ux = vw - 14 - sm; // utility strip up the right edge
  const layout: Layout = {
    stick: { left: 24, top: vh - 24 - stick, size: stick },
    e: { left: cx0, top: by0, size: big },
    fire: { left: cx1, top: by0, size: big },
    f: { left: cx0, top: by1, size: big },
    g: { left: cx1, top: by1, size: big },
    brake: { left: cx0, top: by2, size: big },
    sprint: { left: cx1, top: by2, size: big },
    v: { left: ux, top: 84, size: sm },
    horn: { left: ux, top: 84 + (sm + gap), size: sm },
    map: { left: ux, top: 84 + 2 * (sm + gap), size: sm },
  };
  // default-hidden extras stack down the left edge; user drags the wanted ones out
  let oy = 84;
  for (const b of BTNS) {
    if (layout[b.k]) continue;
    layout[b.k] = { left: 16, top: oy, size: sm };
    oy += sm + 8;
  }
  const hidden: Record<string, true> = {};
  for (const b of BTNS) if (b.defHidden) hidden[b.k] = true;
  return { layout, hidden };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function TouchControls() {
  const [touch, setTouch] = useState(false);
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [hidden, setHidden] = useState<Record<string, true>>({});
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; key: string; kind: "move" | "resize" | "stick"; sx: number; sy: number; orig: Ctl } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const coarse = typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);
    setTouch(!!coarse);
    if (!coarse) return;
    const d = defaults(window.innerWidth, window.innerHeight);
    let init: Saved;
    try {
      const raw = localStorage.getItem(KEY);
      init = raw ? (JSON.parse(raw) as Saved) : d;
    } catch { init = d; }
    // backfill any control missing from an older save
    for (const k of Object.keys(d.layout)) if (!init.layout?.[k]) { init.layout = { ...init.layout, [k]: d.layout[k] }; if (d.hidden[k]) init.hidden = { ...init.hidden, [k]: true }; }
    setLayout(init.layout);
    setHidden(init.hidden ?? {});
  }, []);

  if (!touch || !layout) return null;

  const save = (l: Layout, h: Record<string, true>) => { try { localStorage.setItem(KEY, JSON.stringify({ layout: l, hidden: h })); } catch { /* ignore */ } };

  const moveStick = (key: string, clientX: number, clientY: number) => {
    const c = layout[key];
    const cx = c.left + c.size / 2, cy = c.top + c.size / 2;
    let dx = (clientX - cx) / (c.size / 2);
    let dy = (clientY - cy) / (c.size / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    const knobSize = c.size * 0.42;
    setKnob({ x: dx * (c.size / 2 - knobSize / 2), y: dy * (c.size / 2 - knobSize / 2) });
    setVirtualMove(dx, -dy);
  };

  const toggleHidden = (key: string) => {
    setHidden((h) => { const n = { ...h }; if (n[key]) delete n[key]; else n[key] = true; save(layout, n); return n; });
  };

  const onDown = (e: React.PointerEvent, key: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    moved.current = false;
    if (editing) {
      drag.current = { id: e.pointerId, key, kind: "move", sx: e.clientX, sy: e.clientY, orig: { ...layout[key] } };
      return;
    }
    if (key === "stick") {
      drag.current = { id: e.pointerId, key, kind: "stick", sx: 0, sy: 0, orig: layout[key] };
      moveStick(key, e.clientX, e.clientY);
    } else {
      e.preventDefault();
      const b = BTN_OF[key];
      if (b?.hold) { drag.current = { id: e.pointerId, key, kind: "stick", sx: 0, sy: 0, orig: layout[key] }; setVirtualHold(b.action, true); }
      else if (b) virtualTap(b.action);
    }
  };

  const onResizeDown = (e: React.PointerEvent, key: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, key, kind: "resize", sx: e.clientX, sy: e.clientY, orig: { ...layout[key] } };
  };

  const onMove = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr || dr.id !== e.pointerId) return;
    if (dr.kind === "stick") { if (dr.key === "stick") moveStick(dr.key, e.clientX, e.clientY); return; }
    moved.current = true;
    const vw = window.innerWidth, vh = window.innerHeight;
    setLayout((prev) => {
      if (!prev) return prev;
      const c = { ...prev[dr.key] };
      if (dr.kind === "move") {
        c.left = clamp(dr.orig.left + (e.clientX - dr.sx), 0, vw - c.size);
        c.top = clamp(dr.orig.top + (e.clientY - dr.sy), 0, vh - c.size);
      } else {
        const lim = dr.key === "stick" ? MIN.stick : MIN.btn;
        const hi = dr.key === "stick" ? MAX.stick : MAX.btn;
        c.size = clamp(dr.orig.size + (e.clientX - dr.sx + e.clientY - dr.sy) / 2, lim, hi);
      }
      return { ...prev, [dr.key]: c };
    });
  };

  const onUp = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr || dr.id !== e.pointerId) return;
    if (dr.kind === "stick") {
      if (dr.key === "stick") { setKnob({ x: 0, y: 0 }); setVirtualMove(0, 0); }
      else { const b = BTN_OF[dr.key]; if (b?.hold) setVirtualHold(b.action, false); } // release held key
    } else save(layout, hidden);
    drag.current = null;
  };

  const editBox = (): React.CSSProperties => editing ? { outline: "2px dashed #ffcf4a", outlineOffset: 2 } : {};

  const resizeHandle = (k: string) =>
    editing ? (
      <div
        onPointerDown={(e) => onResizeDown(e, k)} onPointerMove={onMove} onPointerUp={onUp}
        style={{ position: "absolute", right: -8, bottom: -8, width: 22, height: 22, borderRadius: "50%", background: "#ffcf4a", border: "2px solid #1a1304", touchAction: "none" }}
      />
    ) : null;

  // small eye toggle (edit mode) to hide/show a control
  const hideToggle = (k: string) =>
    editing ? (
      <div
        onPointerDown={(e) => { e.stopPropagation(); toggleHidden(k); }}
        style={{ position: "absolute", left: -8, top: -8, width: 22, height: 22, borderRadius: "50%", background: hidden[k] ? "#5a4a8e" : "#4ad66d", border: "2px solid #1a1304", color: "#0a0e18", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
      >{hidden[k] ? "+" : "−"}</div>
    ) : null;

  const button = (k: string) => {
    if (hidden[k] && !editing) return null; // hidden in play
    const c = layout[k]; const b = BTN_OF[k];
    if (!c || !b) return null;
    return (
      <div
        key={k}
        onPointerDown={(e) => onDown(e, k)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{
          position: "fixed", left: c.left, top: c.top, width: c.size, height: c.size, borderRadius: "50%",
          background: `${b.color}d9`, border: `2px solid ${b.big ? "#f0cf6a" : "rgba(240,220,160,.5)"}`,
          color: "#fff", zIndex: 16, touchAction: "none",
          fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", fontWeight: 800, lineHeight: 1, opacity: hidden[k] ? 0.4 : 1,
          boxShadow: "0 2px 6px rgba(0,0,0,.4)",
          display: "flex", alignItems: "center", justifyContent: "center", ...editBox(),
        }}
      >
        <span style={{ fontSize: c.size * (b.label.length > 4 ? 0.22 : b.label.length > 3 ? 0.27 : 0.34), letterSpacing: 0.5, textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>{b.label}</span>
        {hideToggle(k)}
        {resizeHandle(k)}
      </div>
    );
  };

  const stick = layout.stick;
  const knobSize = stick.size * 0.42;

  return (
    <>
      {/* movement thumb-stick */}
      <div
        onPointerDown={(e) => onDown(e, "stick")} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{
          position: "fixed", left: stick.left, top: stick.top, width: stick.size, height: stick.size, borderRadius: "50%",
          background: "rgba(12,15,26,.4)", border: "2px solid rgba(120,110,170,.5)", zIndex: 16, touchAction: "none", ...editBox(),
        }}
      >
        <div style={{
          position: "absolute", left: stick.size / 2 - knobSize / 2 + knob.x, top: stick.size / 2 - knobSize / 2 + knob.y,
          width: knobSize, height: knobSize, borderRadius: "50%",
          background: "rgba(255,122,217,.6)", border: "2px solid rgba(255,255,255,.5)",
        }} />
        {resizeHandle("stick")}
      </div>

      {BTNS.map((b) => button(b.k))}

      {/* edit toggle */}
      <button
        onClick={() => { setEditing((v) => { if (v) save(layout, hidden); return !v; }); }}
        style={{
          position: "fixed", left: 8, top: "50%", transform: "translateY(-50%)", zIndex: 17,
          width: 44, height: 44, borderRadius: "50%", touchAction: "manipulation",
          background: editing ? "rgba(255,207,74,.9)" : "rgba(12,15,26,.7)",
          border: "2px solid rgba(120,110,170,.6)", color: editing ? "#1a1304" : "#fff", fontSize: 18,
        }}
        title="Edit touch layout"
      >{editing ? "✓" : "⚙"}</button>

      {editing && (
        <div style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 17,
          background: "rgba(12,15,26,.9)", border: "1px solid #3a2a5e", borderRadius: 8, padding: "8px 14px",
          color: "#e7e0ff", fontFamily: "'Courier New', monospace", fontSize: 12, textAlign: "center", maxWidth: "92vw",
        }}>
          Drag to move · gold handle resizes · green/grey dot shows/hides a button · ✓ when done
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => { const d = defaults(window.innerWidth, window.innerHeight); setLayout(d.layout); setHidden(d.hidden); save(d.layout, d.hidden); }}
              style={{ cursor: "pointer", background: "rgba(40,30,70,.9)", border: "1px solid #5a4a8e", color: "#e7e0ff", borderRadius: 6, padding: "4px 10px", font: "11px 'Courier New', monospace" }}
            >Reset to default</button>
          </div>
        </div>
      )}
    </>
  );
}
