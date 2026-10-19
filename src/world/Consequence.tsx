import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import { useStats } from "../game";
import { useGame, useToasts } from "../store";
import { sfx } from "../audio/sfx";
import { HOSPITAL, POLICE_STATION } from "../places";

// Busted / Wasted loop (§15): health at zero = WASTED (wake at the hospital);
// cornered by police = BUSTED (processed at the police station). Either way the
// player blacks out, loses some cash + all heat, and respawns with full health.

const DELAY = 2.6; // seconds blacked out before respawn

export function Consequence() {
  const timer = useRef(0);

  useFrame((_, dt) => {
    const game = useGame.getState();
    const stats = useStats.getState();

    // trigger wasted when health is gone
    if (!game.down && stats.health <= 0) {
      useGame.getState().setDown("wasted");
      sfx.bust();
      timer.current = 0;
    }
    if (!game.down) return;

    timer.current += dt;
    if (timer.current < DELAY) return;

    // respawn at the hospital (wasted) or police station (busted)
    const penalty = game.down === "wasted" ? 200 : 150;
    const spot = game.down === "wasted" ? HOSPITAL : POLICE_STATION;
    stats.addCash(-Math.min(stats.cash, penalty));
    stats.setHealth(100);
    stats.heat(-9, -9); // clamp both axes to 0

    // if the player was driving, leave the car behind and step out on foot
    useGame.getState().setMode("foot");
    const pl = shared.player;
    if (pl) {
      pl.setEnabled(true);
      pl.setTranslation({ x: spot[0], y: spot[1], z: spot[2] }, true);
      pl.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    // clear any active pursuit so you actually get a fresh start
    for (const c of shared.cops) c.dead = true;
    useToasts.getState().push(`-$${penalty} · ${game.down === "wasted" ? "hospital" : "released"}`, "#ff8a8a");
    useGame.getState().setDown(null);
    timer.current = 0;
  });

  return null;
}
