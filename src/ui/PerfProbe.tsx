// Counts ALL passes, not just the final fullscreen composer triangle.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { perfStats } from "./perfStats";
import { useGame } from "../store";
import { moveAxis, isDown } from "../input";
import { shared } from "../shared";

export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const acc = useRef(0);
  const previousWallTime = useRef<number | null>(null);
  const samples = useRef<number[]>([]);
  useEffect(() => {
    const old = gl.info.autoReset; gl.info.autoReset = false;
    const reset = () => { previousWallTime.current = null; samples.current = []; };
    document.addEventListener("visibilitychange", reset);
    return () => { gl.info.autoReset = old; document.removeEventListener("visibilitychange", reset); };
  }, [gl]);
  useFrame(() => {
    gl.info.reset();
    // Rendering statistics must use WALL time, never the capped simulation
    // delta: a 1 FPS renderer must not be reported as 20 FPS by the clock cap.
    const now = performance.now();
    const interval = previousWallTime.current === null ? 0 : now - previousWallTime.current;
    previousWallTime.current = now;
    if (interval > 0) { samples.current.push(interval); if (samples.current.length > 120) samples.current.shift(); }
    acc.current += interval;
    if (acc.current < 500) return;
    acc.current = 0;
    // The R3F frame (including composer passes) is synchronous. Read after it,
    // without taking over the render loop or adding another render.
    queueMicrotask(() => {
      perfStats.draws = gl.info.render.calls;
      perfStats.tris = gl.info.render.triangles;
      const sorted = [...samples.current].sort((a, b) => a - b);
      const average = samples.current.reduce((a, b) => a + b, 0) / (samples.current.length || 1);
      perfStats.fps = average ? Math.round(1000 / average) : 0;
      perfStats.p95Ms = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] || 0;
      perfStats.samples = sorted.length;
      if (import.meta.env.DEV) {
        const review = window as Window & {
          __narrowsPerf?: typeof perfStats;
          __narrowsReviewState?: { get: typeof useGame.getState; set: typeof useGame.setState; input: () => {x:number;y:number;sprint:boolean;brake:boolean}; actor: () => {x:number;y:number;z:number}|null; time: () => number };
        };
        review.__narrowsPerf = {...perfStats};
        // Use this exact store instance in browser QA. Vite HMR can otherwise
        // give a dynamic import a second copy and make weather tests illusory.
        review.__narrowsReviewState = { get: useGame.getState, set: useGame.setState, input: () => ({...moveAxis(),sprint:isDown("ShiftLeft"),brake:isDown("Space")}), actor: () => shared.player?.translation() ?? null, time: () => shared.hour };
      }
    });
  }, -100);
  return null;
}
