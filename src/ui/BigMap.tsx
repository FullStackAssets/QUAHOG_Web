import { useEffect, useRef } from "react";
import { useGame } from "../store";
import { useMission } from "../mission";
import { shared } from "../shared";
import { sfx } from "../audio/sfx";
import { CIVIC, FAST_TRAVEL } from "../places";

// Large map screen (§21): full-window pannable/zoomable map of the slice drawn
// from real OSM geometry, with real street-name labels, water, the player, and
// the active objective. Wheel or +/- to zoom; drag to pan; M or ✕ to close.

const MAJOR = new Set(["motorway", "trunk", "primary", "secondary"]);

export function BigMap() {
  const open = useGame((s) => s.mapOpen);
  const slice = useGame((s) => s.slice);
  const waypoint = useGame((s) => s.waypoint);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef({ x: 0, z: 0, scale: 2.2 }); // world center + px/m
  const drag = useRef<{ x: number; y: number } | null>(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!open || !slice) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const resize = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    // center on the player the first time the map opens
    if (!inited.current) {
      const t = (useGame.getState().mode === "car" ? shared.car : shared.player)?.translation();
      cam.current.x = t?.x ?? 0;
      cam.current.z = t?.z ?? 0;
      inited.current = true;
    }

    let raf = 0;
    const draw = () => {
      const W = cvs.width, H = cvs.height;
      const { x: cx, z: cz, scale } = cam.current;
      const sx = (wx: number) => W / 2 + (wx - cx) * scale;
      const sy = (wz: number) => H / 2 + (wz - cz) * scale;

      ctx.fillStyle = "#0a0e18";
      ctx.fillRect(0, 0, W, H);

      // water
      ctx.fillStyle = "#163a4d";
      for (const ring of slice.water ?? []) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const px = sx(ring[i][0]), py = sy(-ring[i][1]);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }

      // roads
      for (const r of slice.roads) {
        const major = MAJOR.has(r.highway);
        ctx.strokeStyle = major ? "#c8a24a" : "#6b7180";
        ctx.lineWidth = major ? 3 : 1.4;
        ctx.beginPath();
        for (let i = 0; i < r.points.length; i++) {
          const px = sx(r.points[i][0]), py = sy(-r.points[i][1]);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // street-name labels (one per name, when zoomed in enough)
      if (scale > 1.6) {
        ctx.font = "11px 'Courier New', monospace";
        ctx.fillStyle = "#cdd6e6";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const seen = new Set<string>();
        for (const r of slice.roads) {
          if (!r.name || seen.has(r.name) || r.points.length < 2) continue;
          const mid = Math.floor(r.points.length / 2) - 1;
          const a = r.points[mid], b = r.points[mid + 1];
          const ax = sx(a[0]), ay = sy(-a[1]), bx = sx(b[0]), by = sy(-b[1]);
          if (ax < 0 || ax > W || ay < 0 || ay > H) continue;
          seen.add(r.name);
          let ang = Math.atan2(by - ay, bx - ax);
          if (ang > Math.PI / 2) ang -= Math.PI;
          if (ang < -Math.PI / 2) ang += Math.PI;
          ctx.save();
          ctx.translate((ax + bx) / 2, (ay + by) / 2);
          ctx.rotate(ang);
          ctx.fillStyle = "rgba(10,14,24,.7)";
          const w = ctx.measureText(r.name).width;
          ctx.fillRect(-w / 2 - 3, -7, w + 6, 14);
          ctx.fillStyle = "#cdd6e6";
          ctx.fillText(r.name, 0, 0);
          ctx.restore();
        }
      }

      // civic markers + labels (police, hospital)
      ctx.font = "11px 'Courier New', monospace";
      ctx.textAlign = "center";
      for (const c of CIVIC) {
        ctx.fillStyle = c.kind === "hospital" ? "#4ad66d" : "#3a6bff";
        ctx.fillRect(sx(c.pos[0]) - 5, sy(c.pos[2]) - 5, 10, 10);
        ctx.fillStyle = c.kind === "hospital" ? "#bdeccb" : "#bcd0ff";
        ctx.fillText(c.name.toUpperCase(), sx(c.pos[0]), sy(c.pos[2]) - 10);
      }

      // cop blips
      const pulse = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
      for (const cop of shared.cops) {
        if (cop.dead) continue;
        ctx.fillStyle = `rgba(90,150,255,${0.5 + pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(sx(cop.pos.x), sy(cop.pos.z), 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // player-placed waypoint (§21) — pink pin
      const w = useGame.getState().waypoint;
      if (w) {
        const wx = sx(w.x), wy = sy(w.z);
        ctx.fillStyle = "#ff4fa3";
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx - 6, wy - 13);
        ctx.lineTo(wx + 6, wy - 13);
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(wx, wy - 13, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0a0e18";
        ctx.beginPath(); ctx.arc(wx, wy - 13, 2, 0, Math.PI * 2); ctx.fill();
      }

      // objective
      const ms = useMission.getState();
      const step = ms.done ? null : ms.steps[ms.step];
      if (step?.target) {
        ctx.fillStyle = "#ffcf4a";
        ctx.beginPath();
        ctx.arc(sx(step.target[0]), sy(step.target[2]), 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // player
      const t = (useGame.getState().mode === "car" ? shared.car : shared.player)?.translation();
      if (t) {
        const heading = useGame.getState().mode === "car" ? shared.carYaw : shared.heading;
        ctx.save();
        ctx.translate(sx(t.x), sy(t.z));
        ctx.rotate(-heading);
        ctx.fillStyle = "#ff4fa3";
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(6, 8); ctx.lineTo(0, 4); ctx.lineTo(-6, 8);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [open, slice]);

  if (!open) return null;

  const zoom = (f: number) => { cam.current.scale = Math.max(0.5, Math.min(12, cam.current.scale * f)); };

  const travel = (x: number, z: number) => {
    const pl = shared.player;
    if (pl) {
      pl.setEnabled(true);
      pl.setTranslation({ x, y: 2, z }, true);
      pl.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    // bring your car so there's always a ride at the destination
    const car = shared.car;
    if (car) {
      car.setTranslation({ x: x + 6, y: 1.4, z: z + 4 }, true);
      car.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    useGame.getState().setMode("foot");
    cam.current.x = x; cam.current.z = z;
    useGame.getState().toggleMap();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 18, fontFamily: "'Courier New', monospace" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, touchAction: "none", cursor: drag.current ? "grabbing" : "grab" }}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12)}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          cam.current.x -= (e.clientX - drag.current.x) / cam.current.scale;
          cam.current.z -= (e.clientY - drag.current.y) / cam.current.scale;
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => { drag.current = null; }}
        onContextMenu={(e) => {
          e.preventDefault();
          const cvs = canvasRef.current; if (!cvs) return;
          const { x: cx, z: cz, scale } = cam.current;
          useGame.getState().setWaypoint({
            x: cx + (e.clientX - cvs.width / 2) / scale,
            z: cz + (e.clientY - cvs.height / 2) / scale,
          });
          sfx.ui();
        }}
      />
      {/* title */}
      <div style={{ position: "absolute", top: 16, left: 16, color: "#ff7ad9", fontWeight: 700, letterSpacing: 2, background: "rgba(10,14,24,.7)", padding: "6px 12px", borderRadius: 8 }}>
        🗺 MOUNT HOPE — NEW BEDFORD
      </div>
      {/* controls */}
      <div style={{ position: "absolute", right: 16, top: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <button style={mapBtn} onClick={() => zoom(1.25)}>＋</button>
        <button style={mapBtn} onClick={() => zoom(1 / 1.25)}>－</button>
        <button style={mapBtn} onClick={() => {
          const t = (useGame.getState().mode === "car" ? shared.car : shared.player)?.translation();
          if (t) { cam.current.x = t.x; cam.current.z = t.z; }
        }} title="Recenter on player">◎</button>
        {waypoint && (
          <button style={{ ...mapBtn, color: "#ff8fd0", borderColor: "#7a3a6a" }} title="Clear waypoint"
            onClick={() => { useGame.getState().setWaypoint(null); sfx.ui(); }}>📍</button>
        )}
        <button style={{ ...mapBtn, color: "#ffb0b0", borderColor: "#8e3a3a" }} onClick={() => useGame.getState().toggleMap()}>✕</button>
      </div>
      {/* fast travel */}
      <div style={{ position: "absolute", left: 16, top: 60, display: "flex", flexDirection: "column", gap: 6, maxWidth: 220 }}>
        <div style={{ color: "#ffcf4a", fontSize: 11, letterSpacing: 1, marginBottom: 2 }}>FAST TRAVEL</div>
        {FAST_TRAVEL.map((d) => (
          <button key={d.name} onClick={() => travel(d.pos[0], d.pos[1])}
            style={{ pointerEvents: "auto", cursor: "pointer", textAlign: "left", background: "rgba(12,15,26,.85)", border: "1px solid #3a2a5e", color: "#e7e0ff", borderRadius: 6, padding: "6px 9px", font: "11px 'Courier New', monospace" }}>
            ➤ {d.name}
          </button>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", color: "#9a93b8", fontSize: 11, background: "rgba(10,14,24,.7)", padding: "5px 12px", borderRadius: 8 }}>
        drag to pan · wheel / ＋－ zoom · right-click to set a waypoint · click a destination to fast-travel · M / ✕ close
      </div>
    </div>
  );
}

const mapBtn: React.CSSProperties = {
  pointerEvents: "auto", cursor: "pointer", width: 42, height: 42,
  border: "1px solid #3a2a5e", background: "rgba(12,15,26,.9)", color: "#e7e0ff",
  borderRadius: 10, fontSize: 18,
};
