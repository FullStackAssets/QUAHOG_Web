import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { isBlockedWater } from "./waterZones";

// Water barrier (§6): drive or walk into the open harbor/river and you start to
// sink, then get fished back out onto the last bit of land you were on — so the
// only way across is a bridge. Forgiving (no full wasted), just a setback.

const SINK_TIME = 1.1;   // seconds in the water before recovery
const _safe = { x: -256.2, y: 3, z: 106.5 }; // fallback = spawn

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
      if (t.y > 0.5 && t.y < 5) { last.current = { x: t.x, y: t.y + 1, z: t.z }; }
      return;
    }

    // sinking: drag it down + kill momentum
    inWater.current += dt;
    const v = body.linvel();
    body.setLinvel({ x: v.x * 0.6, y: -3, z: v.z * 0.6 }, true);

    if (inWater.current > SINK_TIME) {
      inWater.current = 0;
      const s = last.current;
      body.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      useStats.getState().setHealth(useStats.getState().health - 8);
      useToasts.getState().push("Into the drink! Use the bridge.", "#5ad0ff");
    }
  });

  return null;
}
