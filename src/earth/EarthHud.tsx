import { useEffect, useRef, useState } from "react";
import { playState } from "./playState";
import { healthColor, headingToCompass, interactionPrompt, minimapSegments } from "./hud";
import type { RoadLine } from "./hud";

const SIZE = 132;
const RADIUS = 90;

// Play readout: compass, health, interaction prompt, and a heading-up minimap
// drawn from the real OSM roads when the New Bedford slice is the anchor.
// Polled a few times a second so it does not re-render with the frame loop.

export function PlayReadout({ roads }: { roads: RoadLine[] | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compass, setCompass] = useState("S");
  const [health, setHealth] = useState(100);
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const player = playState.player;
      setCompass(headingToCompass(player.heading));
      setHealth(player.health);
      setPrompt(interactionPrompt(player));
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !roads) return;
      const segs = minimapSegments(roads, { x: player.pos.x, z: player.pos.z, heading: player.heading }, SIZE, RADIUS);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "rgba(5,7,13,0.72)";
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7ad9ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const seg of segs) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
      ctx.fillStyle = "#fff6e8";
      ctx.beginPath();
      ctx.moveTo(SIZE / 2, SIZE / 2 - 7);
      ctx.lineTo(SIZE / 2 - 5, SIZE / 2 + 6);
      ctx.lineTo(SIZE / 2 + 5, SIZE / 2 + 6);
      ctx.closePath();
      ctx.fill();
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [roads]);

  const color = healthColor(health);
  return (
    <div style={{ position: "absolute", top: 12, right: 12, width: SIZE, pointerEvents: "none", font: "12px/1.4 'Courier New', monospace", color: "#e7e0ff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <b style={{ color: "#7ad9ff", fontSize: 18 }}>{compass}</b>
        <span style={{ color }}>{Math.round(health)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden", marginBottom: 8 }}>
        <div style={{ width: `${Math.max(0, Math.min(100, health))}%`, height: "100%", background: color }} />
      </div>
      {roads && (
        <>
          <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE, borderRadius: "50%", border: "1px solid #2c3a5e" }} />
          <div style={{ opacity: 0.55, fontSize: 9, marginTop: 4, textAlign: "center" }}>heading up · OSM roads</div>
        </>
      )}
      {prompt && (
        <div style={{ marginTop: 8, background: "rgba(5,7,13,0.82)", border: "1px solid #2c3a5e", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
          {prompt}
        </div>
      )}
    </div>
  );
}
