import { useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useGame } from "../store";

type Sample = { fps: number; meanMs: number; worstMs: number; draws: number; triangles: number };
const empty: Sample = { fps: 0, meanMs: 0, worstMs: 0, draws: 0, triangles: 0 };

// Opt-in on-device instrumentation: append ?perf=1 to the game URL. Samples
// actual R3F frame delta and the previous completed WebGL render counters.
// Disabled entirely for ordinary players. This is not a benchmark assertion.
export function RenderDiagnostics() {
  const enabled = useMemo(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("perf") === "1", []);
  const gl = useThree(s => s.gl);
  const quality = useGame(s => s.quality);
  const [sample, setSample] = useState<Sample>(empty);
  const counter = useRef({ elapsed: 0, frames: 0, worst: 0, draws: 0, triangles: 0 });

  useFrame((_, dt) => {
    if (!enabled || dt <= 0) return;
    const c = counter.current;
    c.elapsed += dt;
    c.frames += 1;
    c.worst = Math.max(c.worst, dt * 1000);
    c.draws += gl.info.render.calls;
    c.triangles += gl.info.render.triangles;
    if (c.elapsed >= 1) {
      setSample({
        fps: Math.round(c.frames / c.elapsed),
        meanMs: Math.round(c.elapsed * 10000 / c.frames) / 10,
        worstMs: Math.round(c.worst * 10) / 10,
        draws: Math.round(c.draws / c.frames),
        triangles: Math.round(c.triangles / c.frames),
      });
      counter.current = { elapsed: 0, frames: 0, worst: 0, draws: 0, triangles: 0 };
    }
  });

  if (!enabled) return null;
  const mode = ["LOW", "MED", "HIGH"][quality];
  return (
    <Html fullscreen style={{ pointerEvents: "none", zIndex: 990 }}>
      <div style={{
        position: "absolute", right: 10, top: "max(58px, env(safe-area-inset-top))",
        background: "rgba(10,18,24,0.86)", color: "#e7f5f7",
        padding: "8px 10px", borderRadius: 8,
        font: "11px/1.45 ui-monospace, monospace", whiteSpace: "pre",
      }}>
        {mode + " • device sample"}
        {"\nFPS " + sample.fps + "  avg " + sample.meanMs + "ms"}
        {"\nWorst " + sample.worstMs + "ms"}
        {"\nDraws " + sample.draws + "  tris " + sample.triangles.toLocaleString()}
      </div>
    </Html>
  );
}
