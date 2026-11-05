import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { sfx } from "../audio/sfx";

// Respawning health packs (§11/§17): green crosses near the core eateries. Walk
// over one on foot when hurt to heal; it then cools down before reappearing.

const SPOTS: [number, number, number][] = [
  [-300, 1.2, 92],   // Linguiça Linq diner
  [-240, 1.2, 122],  // Quohog Republic
  [-262, 1.2, 60],   // Maré Alta block
];
const HEAL = 40;
const RESPAWN = 30; // seconds

export function HealthPickups() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const cool = useRef<number[]>(SPOTS.map(() => 0));

  useFrame((state, dt) => {
    if (useGame.getState().paused) return;
    const onFoot = useGame.getState().mode === "foot";
    const t = shared.player?.translation();
    SPOTS.forEach((s, i) => {
      const g = groups.current[i];
      if (cool.current[i] > 0) {
        cool.current[i] = Math.max(0, cool.current[i] - dt);
        if (g) g.visible = false;
        return;
      }
      if (g) {
        g.visible = true;
        g.rotation.y += dt * 1.5;
        g.position.y = s[1] + Math.sin(state.clock.elapsedTime * 2 + i) * 0.15;
      }
      if (onFoot && t && Math.hypot(t.x - s[0], t.z - s[2]) < 2.5) {
        const st = useStats.getState();
        if (st.health < 100) {
          st.setHealth(Math.min(100, st.health + HEAL));
          sfx.ui();
          useToasts.getState().push("Health restored", "#4ad66d");
          cool.current[i] = RESPAWN;
        }
      }
    });
  });

  return (
    <group>
      {SPOTS.map((s, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} position={s}>
          <mesh><boxGeometry args={[0.9, 0.3, 0.3]} /><meshStandardMaterial color="#4ad66d" emissive="#1c7a3a" emissiveIntensity={0.6} /></mesh>
          <mesh><boxGeometry args={[0.3, 0.9, 0.3]} /><meshStandardMaterial color="#4ad66d" emissive="#1c7a3a" emissiveIntensity={0.6} /></mesh>
        </group>
      ))}
    </group>
  );
}
