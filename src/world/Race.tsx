import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { markerFade } from "./markerVisual";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { useRace, RACE_START, CHECKPOINTS } from "../race";
import { sfx } from "../audio/sfx";

// Renders the race start pad + the active checkpoint, and drives the race loop.
export function Race() {
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const camera = useThree((s)=>s.camera);

  useFrame((_, dt) => {
    const game = useGame.getState();
    const loc=useRace.getState().active ? CHECKPOINTS[useRace.getState().idx] : RACE_START;
    const fade=markerFade(Math.hypot(camera.position.x-loc[0],camera.position.z-loc[1]));
    if(ring.current){ring.current.visible=fade>.01;(ring.current.material as THREE.MeshBasicMaterial).opacity=fade*.29;}
    if(beam.current){beam.current.visible=fade>.01;(beam.current.material as THREE.MeshBasicMaterial).opacity=fade*.055;}
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
        <ringGeometry args={[6.65, 7, 28]} />
        <meshBasicMaterial color={active ? "#ffcf4a" : "#22d3ee"} transparent opacity={0.29} depthWrite={false} />
      </mesh>
      <mesh ref={beam} position={[0, 9, 0]}>
        <cylinderGeometry args={[1, 1, 18, 10, 1, true]} />
        <meshBasicMaterial color={active ? "#ffcf4a" : "#22d3ee"} transparent opacity={0.055} depthWrite={false} />
      </mesh>
    </group>
  );
}
