import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import { useMission } from "../mission";
import { shared } from "../shared";
import { sim } from "./SimRuntime";

/**
 * Boots the clean-room simulation layer once the slice is ready and keeps
 * navigation / streamer / budget in sync with player pose each frame.
 */
export function SimBootstrap() {
  const slice = useGame((s) => s.slice);
  const quality = useGame((s) => s.quality);
  const bound = useRef<string | null>(null);

  useEffect(() => {
    sim.configureQuality(quality);
  }, [quality]);

  useEffect(() => {
    if (!slice) return;
    if (bound.current === slice.name) return;
    bound.current = slice.name;
    sim.bindSlice(slice);
  }, [slice]);

  useFrame((_, dt) => {
    const game = useGame.getState();
    if (!game.started || game.paused) return;

    sim.beginFrame();

    const mode = game.mode;
    const body = mode === "car" ? shared.car : mode === "boat" ? shared.boat : shared.player;
    const t = body?.translation();
    if (!t) return;

    const heading = mode === "car" ? shared.carYaw : mode === "boat" ? shared.boatYaw : shared.heading;
    const speed = mode === "car" ? shared.carSpeed : 0;

    // Mission target wins; else player waypoint.
    const ms = useMission.getState();
    const step = ms.done ? null : ms.steps[ms.step];
    const wp = game.waypoint;
    if (step?.target) {
      sim.setNavGoal({ x: step.target[0], z: step.target[2] });
    } else if (wp) {
      sim.setNavGoal({ x: wp.x, z: wp.z });
    } else {
      sim.setNavGoal(null);
    }

    const guidance = sim.tickNav(dt, { x: t.x, z: t.z }, heading, speed);
    shared.navDist = guidance.distanceRemaining;
    shared.navBearing = guidance.bearing;
    shared.navWrongWay = guidance.wrongWay;
    shared.navPath = guidance.path?.points ?? null;
    // Tile streamer advances inside StreamingBuildings after it publishes interest.
  });

  return null;
}
