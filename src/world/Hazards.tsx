import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { isBlockedWater } from "./waterZones";

// Water barrier (§6): drive or walk into the open harbor/river and you start to
// sink, then get fished back out onto the last bit of land you were on — so the
// only way across is a bridge. Forgiving (no full wasted), just a setback.

const HAZARD_SINK_TIME = 1.1; // seconds in the water before recovery
const _safe = { x: -256.2, y: 3, z: 106.5 }; // fallback = spawn

// Probe state (2026-11-03 water/wall diagnosis): seconds the body has been
// continuously wet, written every frame so the debug overlay + beacons can
// show whether the sink timer is advancing. Read-only for readers; the
// component below is the only writer.
export const hazardsProbe = { wetSeconds: 0 };

/**
 * Pure sink-timer step (unit-tested): returns the next wet-seconds and
 * whether the fish-out fires on this frame. Dry resets to 0; the fish-out
 * fires only when the accumulated time STRICTLY exceeds the sink time, and
 * resets the timer. The component uses exactly this rule.
 */
export function hazardTimerTick(
  wetSeconds: number,
  wet: boolean,
  dt: number,
): { wetSeconds: number; fishOut: boolean } {
  if (!wet) return { wetSeconds: 0, fishOut: false };
  const next = wetSeconds + dt;
  if (next > HAZARD_SINK_TIME) return { wetSeconds: 0, fishOut: true };
  return { wetSeconds: next, fishOut: false };
}

export function Hazards() {
  const inWater = useRef(0);
  const last = useRef({ ...(_safe) });

  useFrame((_, dt) => {
    const game = useGame.getState();
    if (game.paused || game.down || game.mode === "boat") return; // boats belong on water
    const body = game.mode === "car" ? shared.car : shared.player;
    if (!body) return;
    const t = body.translation();

    const wet = isBlockedWater(t.x, t.z) && t.y < 4;
    if (!wet) {
      inWater.current = 0;
      hazardsProbe.wetSeconds = 0;
      if (t.y > 0.5 && t.y < 5) { last.current = { x: t.x, y: t.y + 1, z: t.z }; }
      return;
    }

    // sinking: drag it down + kill momentum
    const v = body.linvel();
    body.setLinvel({ x: v.x * 0.6, y: -3, z: v.z * 0.6 }, true);
    const tick = hazardTimerTick(inWater.current, true, dt);
    inWater.current = tick.wetSeconds;
    hazardsProbe.wetSeconds = tick.wetSeconds;

    if (tick.fishOut) {
      inWater.current = 0;
      hazardsProbe.wetSeconds = 0;
      const s = last.current;
      body.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      useStats.getState().setHealth(useStats.getState().health - 8);
      useToasts.getState().push("Into the drink! Use the bridge.", "#5ad0ff");
    }
  });

  return null;
}
