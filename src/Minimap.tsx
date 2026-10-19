import { useEffect, useRef } from "react";
import { useGame } from "./store";
import { useMission } from "./mission";
import { shared } from "./shared";
import { CIVIC } from "./places";
import { useEconomy, BUSINESSES } from "./economy";

// Player-centered radar (§21): draws nearby roads, the objective, and a heading
// arrow on a small canvas. North-up. Cheap 2D — no WebGL.

const SIZE = 168;
const RANGE = 230; // metres mapped to the radar radius
const R = SIZE / 2;
const PPM = R / RANGE; // pixels per metre

export function Minimap() {
  const slice = useGame((s) => s.slice);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!slice) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    // pre-flatten road segments once (world x,z)
    const segs: number[] = []; // x1,z1,x2,z2,classIdx...
    for (const r of slice.roads) {
      const major = ["motorway", "trunk", "primary", "secondary"].includes(r.highway) ? 1 : 0;
      for (let i = 0; i < r.points.length - 1; i++) {
        segs.push(r.points[i][0], -r.points[i][1], r.points[i + 1][0], -r.points[i + 1][1], major);
      }
    }
    const water = slice.water ?? [];
    const parks = slice.parks ?? [];
    const barrier = slice.barrier ?? [];

    const draw = () => {
      const body = useGame.getState().mode === "car" ? shared.car : shared.player;
      const t = body?.translation();
      const px = t?.x ?? 0, pz = t?.z ?? 0;
      const heading = useGame.getState().mode === "car" ? shared.carYaw : shared.heading;

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.clip();

      // backdrop
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // water polys
      ctx.fillStyle = "#15384a";
      for (const ring of water) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const sx = R + (ring[i][0] - px) * PPM;
          const sy = R + (-ring[i][1] - pz) * PPM;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      }

      // parks / green spaces
      ctx.fillStyle = "#2c4626";
      for (const ring of parks) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const sx = R + (ring[i][0] - px) * PPM;
          const sy = R + (-ring[i][1] - pz) * PPM;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      }

      // roads
      for (let i = 0; i < segs.length; i += 5) {
        const x1 = R + (segs[i] - px) * PPM;
        const y1 = R + (segs[i + 1] - pz) * PPM;
        const x2 = R + (segs[i + 2] - px) * PPM;
        const y2 = R + (segs[i + 3] - pz) * PPM;
        // skip far segments cheaply
        if (x1 < -10 && x2 < -10) continue;
        if (x1 > SIZE + 10 && x2 > SIZE + 10) continue;
        ctx.strokeStyle = segs[i + 4] ? "#c8a24a" : "#5a5f6e";
        ctx.lineWidth = segs[i + 4] ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // hurricane barrier (stone dike)
      ctx.strokeStyle = "#9a978c";
      ctx.lineWidth = 2.5;
      for (const path of barrier) {
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
          const sx = R + (path[i][0] - px) * PPM;
          const sy = R + (-path[i][1] - pz) * PPM;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // civic markers (police = blue, hospital = green)
      for (const c of CIVIC) {
        ctx.fillStyle = c.kind === "hospital" ? "#4ad66d" : "#3a6bff";
        ctx.fillRect(R + (c.pos[0] - px) * PPM - 3, R + (c.pos[2] - pz) * PPM - 3, 6, 6);
      }

      // business fronts (gold squares): owned = filled, buyable = hollow outline
      const owned = useEconomy.getState().owned;
      for (const b of BUSINESSES) {
        const bx = R + (b.pos[0] - px) * PPM;
        const by = R + (b.pos[2] - pz) * PPM;
        if (owned[b.id]) {
          ctx.fillStyle = "#ffcf4a";
          ctx.fillRect(bx - 3, by - 3, 6, 6);
          ctx.strokeStyle = "#0a0e18"; ctx.lineWidth = 1; ctx.strokeRect(bx - 3, by - 3, 6, 6);
        } else {
          ctx.strokeStyle = "#caa24a"; ctx.lineWidth = 1.5;
          ctx.strokeRect(bx - 3, by - 3, 6, 6);
        }
      }

      // cop blips (pulsing blue dots)
      const pulse = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
      for (const cop of shared.cops) {
        if (cop.dead) continue;
        ctx.fillStyle = `rgba(90,150,255,${0.5 + pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(R + (cop.pos.x - px) * PPM, R + (cop.pos.z - pz) * PPM, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // objective marker
      const ms = useMission.getState();
      const step = ms.done ? null : ms.steps[ms.step];
      if (step?.target) {
        const ox = R + (step.target[0] - px) * PPM;
        const oy = R + (step.target[2] - pz) * PPM;
        const cx = Math.max(8, Math.min(SIZE - 8, ox));
        const cy = Math.max(8, Math.min(SIZE - 8, oy));
        ctx.fillStyle = "#ffcf4a";
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // player-placed waypoint (§21) — pink dot, clamped to the radar edge
      const w = useGame.getState().waypoint;
      if (w) {
        let wx = (w.x - px) * PPM, wy = (w.z - pz) * PPM;
        const m = Math.hypot(wx, wy);
        if (m > R - 6) { const k = (R - 6) / m; wx *= k; wy *= k; } // clamp to ring
        ctx.fillStyle = "#ff4fa3";
        ctx.beginPath();
        ctx.arc(R + wx, R + wy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0a0e18"; ctx.lineWidth = 1; ctx.stroke();
      }

      ctx.restore();

      // player heading arrow (always centered)
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(-heading); // world heading → screen (north up)
      ctx.fillStyle = "#ff4fa3";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ring
      ctx.strokeStyle = "#3a2a5e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [slice]);

  return (
    <div style={{ position: "absolute", left: 16, bottom: 16, width: SIZE, height: SIZE }}>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE, borderRadius: "50%" }} />
    </div>
  );
}
