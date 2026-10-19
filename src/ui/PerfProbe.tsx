// Build 002: samples gl.info.render inside the Canvas and publishes it for
// the debug HUD. Throttled to twice a second; no allocations per frame.
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { perfStats } from "./perfStats";

export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.5) return;
    acc.current = 0;
    perfStats.draws = gl.info.render.calls;
    perfStats.tris = gl.info.render.triangles;
  });
  return null;
}
