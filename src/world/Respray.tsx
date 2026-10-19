import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { sfx } from "../audio/sfx";

// Pay-n-Spray (§14/§15): drive your car into the Anvil Garage with heat on you
// and it gets resprayed — a fee clears the wanted level and swaps the paint.
// Classic open-world escape hatch. Cooldown stops it re-triggering every frame.

const SPOT: [number, number, number] = [-320, 0, 60]; // The Anvil Garage
const RADIUS = 6;
const FEE = 200;
const COLORS = ["#1d2733", "#3a1414", "#13301f", "#2a2440", "#4a4a52", "#5a3a1a", "#0e2a33"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function Respray() {
  const cool = useRef(0);

  useFrame((_, dt) => {
    const g = useGame.getState();
    if (g.paused) return;
    cool.current = Math.max(0, cool.current - dt);
    if (g.mode !== "car" || cool.current > 0) return;
    const c = shared.car?.translation();
    if (!c || Math.hypot(c.x - SPOT[0], c.z - SPOT[2]) > RADIUS) return;
    const st = useStats.getState();
    if (st.police <= 0 && st.faction <= 0) return; // nothing to wash off
    if (st.cash >= FEE) {
      st.addCash(-FEE);
      st.heat(-5, -5); // clamps to 0 → wanted cleared
      shared.carDamage = 0; // body work included
      g.setPlayerCar(g.playerCarType, pick(COLORS)); // fresh coat of paint
      sfx.cash();
      useToasts.getState().push("Resprayed — heat cleared (−$200)", "#4ad66d");
      cool.current = 6;
    } else {
      useToasts.getState().push("Can't afford a respray ($200)", "#ff9a9a");
      cool.current = 4;
    }
  });

  return (
    <group position={SPOT}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.16, 0]}>
        <ringGeometry args={[RADIUS - 0.7, RADIUS, 32]} />
        <meshBasicMaterial color="#5ad0ff" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <Text position={[0, 5, 0]} fontSize={0.8} color="#bde7ff" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#000">
        PAY-N-SPRAY
      </Text>
    </group>
  );
}
