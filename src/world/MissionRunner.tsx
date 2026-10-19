import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { useMission } from "../mission";
import { sfx } from "../audio/sfx";

// Drives the active mission (§16): checks the current step's completion each frame
// (reach target and/or be in a car), advances, and pays rewards. Renders the
// objective marker (beam + ring) at the current target.
export function MissionRunner() {
  const step = useMission((s) => (s.done ? null : s.steps[s.step]));

  useFrame(() => {
    const ms = useMission.getState();
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
      ms.advance();
      const ns = useMission.getState();
      useToasts.getState().push(ns.done ? "Mission complete" : ns.objective, "#ffcf4a");
    }
  });

  if (!step?.target) return null;
  const [x, , z] = step.target;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 16, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 32, 12, 1, true]} />
        <meshBasicMaterial color="#ffcf4a" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
        <ringGeometry args={[2.6, 3.4, 28]} />
        <meshBasicMaterial color="#ffcf4a" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}
