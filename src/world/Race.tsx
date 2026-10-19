import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { useRace, RACE_START, CHECKPOINTS } from "../race";
import { sfx } from "../audio/sfx";

// Renders the race start pad + the active checkpoint, and drives the race loop.
export function Race() {
  const ring = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    const game = useGame.getState();
    if (game.paused) return;
    const r = useRace.getState();
    const car = shared.car;
    const t = game.mode === "car" && car ? car.translation() : null;

    if (!r.active) {
      // start when you drive onto the pad
      if (t && Math.hypot(t.x - RACE_START[0], t.z - RACE_START[1]) < 7) {
        r.start();
        useToasts.getState().push("RACE! Hit the checkpoints", "#ffcf4a");
        sfx.ui();
      }
      return;
    }
    // must stay in the car
    if (!t) { r.cancel(); useToasts.getState().push("Race abandoned", "#ff8a8a"); return; }
    r.tick(dt);
    const cp = CHECKPOINTS[r.idx];
    if (Math.hypot(t.x - cp[0], t.z - cp[1]) < 9) {
      const reward = r.hit();
      if (reward != null) {
        useStats.getState().addCash(reward);
        sfx.cash();
        useToasts.getState().push(`Race won! ${useRace.getState().time.toFixed(1)}s · +$${reward}`, "#7CFC00");
      } else { sfx.ui(); }
    }
  });

  const active = useRace((s) => s.active);
  const idx = useRace((s) => s.idx);
  const pos = active ? CHECKPOINTS[idx] : RACE_START;

  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
        <ringGeometry args={[5.5, 7, 28]} />
        <meshBasicMaterial color={active ? "#ffcf4a" : "#22d3ee"} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[1, 1, 18, 10, 1, true]} />
        <meshBasicMaterial color={active ? "#ffcf4a" : "#22d3ee"} transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}
