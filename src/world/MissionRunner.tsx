import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { markerFade } from "./markerVisual";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { useMission } from "../mission";
import { sfx } from "../audio/sfx";
import { isBlizzardMission } from "../weather/snowstorm";

// Drives the active mission (§16): checks the current step's completion each frame
// (reach target and/or be in a car), advances, and pays rewards. Renders the
// objective marker (beam + ring) at the current target.
export function MissionRunner() {
  const step = useMission((s) => (s.done ? null : s.steps[s.step]));
  const camera=useThree(s=>s.camera);
  const ring=useRef<THREE.Mesh>(null),beam=useRef<THREE.Mesh>(null);

  useFrame(() => {
    const pos=useMission.getState().steps[useMission.getState().step]?.target;
    if(pos){
      const fade=markerFade(Math.hypot(camera.position.x-pos[0],camera.position.z-pos[2]));
      if(ring.current){ring.current.visible=fade>.01;(ring.current.material as THREE.MeshBasicMaterial).opacity=.42*fade;}
      if(beam.current){beam.current.visible=fade>.01;(beam.current.material as THREE.MeshBasicMaterial).opacity=.085*fade;}
    }
    const ms = useMission.getState();
    // Restore the prior player-selected weather when the event completes.
    const stormActive = isBlizzardMission(ms.title, ms.done);
    if (useGame.getState().blizzardActive !== stormActive) {
      useGame.getState().setBlizzardActive(stormActive);
    }
    if (ms.done) return;
    const cur = ms.steps[ms.step];
    if (!cur) return;
    const mode = useGame.getState().mode;
    const body = mode === "car" ? shared.car : shared.player;

    let complete = true;
    if (cur.needCar && mode !== "car") complete = false;
    if (cur.noHeat && useStats.getState().police >= 1) complete = false; // shake the cops first
    if (cur.target && body) {
      const p = body.translation();
      const d = Math.hypot(p.x - cur.target[0], p.z - cur.target[2]);
      if (d > (cur.radius ?? 10)) complete = false;
    } else if (cur.target && !body) {
      complete = false;
    }

    if (complete) {
      if (cur.reward) { useStats.getState().addCash(cur.reward); sfx.cash(); useToasts.getState().push(`+$${cur.reward}`, "#7CFC00"); }
      else sfx.ui();
      // NB slice improvements (2026-11-03): a one-step mission would
      // otherwise feel like nothing happened — advance() alone only pushes
      // the next objective. The steps.length === 1 check needs no new flag
      // field, and multi-step missions are byte-identical in behavior.
      const oneStep = ms.steps.length === 1;
      const finishedTitle = ms.title;
      ms.advance();
      const ns = useMission.getState();
      useToasts.getState().push(ns.done ? "Mission complete" : ns.objective, "#ffcf4a");
      if (oneStep && !ns.done) useToasts.getState().push(`MISSION COMPLETE — ${finishedTitle.toUpperCase()}`, "#ffcf4a");
    }
  });

  if (!step?.target) return null;
  const [x, , z] = step.target;
  return (
    <group position={[x, 0, z]}>
      <mesh ref={beam} position={[0, 9, 0]}>
        <cylinderGeometry args={[.65, .65, 18, 12, 1, true]} />
        <meshBasicMaterial color="#ffcf4a" transparent opacity={0.085} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
        <ringGeometry args={[2.0, 2.25, 28]} />
        <meshBasicMaterial color="#ffcf4a" transparent opacity={0.42} depthWrite={false} />
      </mesh>
    </group>
  );
}
