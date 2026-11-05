import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { useEconomy, BUSINESSES } from "../economy";
import { consumeTap } from "../input";
import { sfx } from "../audio/sfx";
import { radio } from "../audio/radioEngine";
import { markerFade } from "./markerVisual";

// Buyable business fronts (§15/§17): a marker per front; stand on it and press B
// to buy (if you can afford it). Owned fronts glow green and trickle income
// (handled in GameSystems). Proximity is published for the HUD prompt.

const RADIUS = 7;

export function Businesses() {
  const camera = useThree((s) => s.camera);
  const labels = useRef<(THREE.Group | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const restingIn = useRef<string | null>(null); // owned front we're currently resting in

  useFrame((_, dt) => {
    const game = useGame.getState();
    if (game.paused) return;
    const body = game.mode === "car" ? shared.car : shared.player;
    const t = body?.translation();
    const owned = useEconomy.getState().owned;

    let near: typeof BUSINESSES[number] | null = null;
    let restNear: typeof BUSINESSES[number] | null = null;
    BUSINESSES.forEach((b, i) => {
      const isOwned = !!owned[b.id];
      if (t && Math.hypot(t.x - b.pos[0], t.z - b.pos[2]) < RADIUS) {
        if (isOwned) restNear = b; else near = b;
      }
      const label = labels.current[i];
      if (label) label.visible = Math.hypot(camera.position.x - b.pos[0], camera.position.z - b.pos[2]) < 22;
      const ring = rings.current[i];
      if (ring) {
        const m=ring.material as THREE.MeshBasicMaterial;
        m.color.set(isOwned ? "#4ad66d" : "#ffcf4a");
        const d=Math.hypot(camera.position.x-b.pos[0],camera.position.z-b.pos[2]);
        m.opacity=.23*markerFade(d);
        ring.visible=m.opacity>.003;
      }
    });
    useEconomy.getState().setNear(near);

    // owned fronts double as mini-safehouses (§15): resting heals you fast and
    // bleeds off a little heat — a payoff for buying property.
    if (restNear && game.mode === "foot") {
      const b = restNear as typeof BUSINESSES[number];
      const stats = useStats.getState();
      if (stats.health < 100) stats.setHealth(Math.min(100, stats.health + dt * 12));
      if (stats.police > 0 || stats.faction > 0) stats.heat(-dt * 0.25, -dt * 0.25);
      if (restingIn.current !== b.id) {
        restingIn.current = b.id;
        useToasts.getState().push(`Resting at ${b.name} — patching up`, "#4ad66d");
      }
    } else if (restingIn.current) {
      restingIn.current = null;
    }

    // buy on B
    if (near && consumeTap("KeyB")) {
      const b = near as typeof BUSINESSES[number];
      const stats = useStats.getState();
      if (stats.cash >= b.cost) {
        stats.addCash(-b.cost);
        useEconomy.getState().buy(b);
        useEconomy.getState().save();
        sfx.cash();
        useToasts.getState().push(`Bought ${b.name} — +$${b.perDay}/day`, "#4ad66d");
        radio.flashNews(`Hear ${b.name} just changed hands — new owner, same ${b.blurb}. Money's movin' in this town.`);
      }
    }
  });

  return (
    <group>
      {BUSINESSES.map((b, i) => (
        <group key={b.id} position={b.pos}>
          <mesh ref={(el) => (rings.current[i] = el)} rotation-x={-Math.PI / 2} position={[0, 0.15, 0]}>
            <ringGeometry args={[RADIUS - 0.26, RADIUS, 32]} />
            <meshBasicMaterial color="#ffcf4a" transparent opacity={0.23} depthWrite={false} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <boxGeometry args={[0.2, 6, 0.2]} />
            <meshBasicMaterial color="#ffcf4a" transparent opacity={0.06} depthWrite={false} />
          </mesh>
          <group ref={(el) => { labels.current[i] = el; }}><Text position={[0, 2.6, 0]} fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#000">
            {b.name}
          </Text></group>
        </group>
      ))}
    </group>
  );
}
