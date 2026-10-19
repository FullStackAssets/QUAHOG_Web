import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { consumeTap, moveAxis } from "../input";
import { shared } from "../shared";
import { useGame } from "../store";
import { sfx } from "../audio/sfx";
import { BOAT_SPAWN } from "../economy";

// Pilotable harbor boat (§6). Floats on the ground plane that underlies the
// water (so it rides at ~sea level), exempt from the water barrier. Heavier and
// looser than a car — momentum, slow turns, a trailing wake. Board with E at the
// Long Island marina; E again to step off onto the dock.

const MAX_SPEED = 17;
const EXIT: [number, number, number] = [6092, 2, 4485]; // the marina dock

export function Boat() {
  const body = useRef<RapierRigidBody>(null);
  const wake = useRef<THREE.Mesh>(null);

  useEffect(() => {
    shared.boat = body.current;
    return () => { shared.boat = null; };
  }, []);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const game = useGame.getState();
    if (game.paused) { sfx.engine(0, false); return; }
    if (game.mode !== "boat") { sfx.engine(0, false); if (wake.current) wake.current.visible = false; return; }

    const ax = moveAxis();
    let yaw = shared.boatYaw;
    const v = rb.linvel();
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const vF = v.x * fwd.x + v.z * fwd.z;

    // slow, momentum-y steering (only bites with way on)
    const grip = THREE.MathUtils.clamp(Math.abs(vF) / 5, 0, 1);
    yaw -= ax.x * 1.1 * dt * grip * (vF < -0.1 ? -1 : 1);

    const target = ax.y > 0 ? MAX_SPEED * ax.y : ax.y < 0 ? -6 * -ax.y : 0;
    const nf = THREE.MathUtils.lerp(vF, target, 1 - Math.exp(-dt * 0.9)); // heavy inertia
    const nfwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    rb.setLinvel({ x: nfwd.x * nf, y: v.y, z: nfwd.z * nf }, true);
    rb.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    shared.boatYaw = yaw;
    sfx.engine(Math.min(1, Math.abs(nf) / MAX_SPEED) * 0.7, true);

    if (wake.current) {
      wake.current.visible = Math.abs(nf) > 2;
      (wake.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.5, Math.abs(nf) / MAX_SPEED);
    }

    if (consumeTap("KeyE")) {
      const pl = shared.player;
      if (pl) {
        pl.setEnabled(true);
        pl.setTranslation({ x: EXIT[0], y: EXIT[1], z: EXIT[2] }, true);
        pl.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      game.setMode("foot");
    }
  });

  return (
    <RigidBody
      ref={body} colliders={false} enabledRotations={[false, false, false]}
      position={BOAT_SPAWN} rotation={[0, -Math.PI / 2, 0]} linearDamping={0.8} mass={3}
    >
      <CuboidCollider args={[1.4, 0.8, 4]} />
      {/* small motor yacht (Long Island set) */}
      <group position={[0, -0.2, 0]}>
        {/* gleaming white hull */}
        <mesh castShadow position={[0, 0.35, 0]}>
          <boxGeometry args={[2.5, 1.0, 7.6]} />
          <meshStandardMaterial color="#f4f6f8" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* raked bow */}
        <mesh castShadow position={[0, 0.35, 4.4]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[1.77, 1.0, 1.77]} />
          <meshStandardMaterial color="#f4f6f8" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* navy boot stripe */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[2.56, 0.2, 7.5]} />
          <meshStandardMaterial color="#1f3a5f" roughness={0.4} />
        </mesh>
        {/* teak deck + swim platform */}
        <mesh position={[0, 0.86, -0.2]}>
          <boxGeometry args={[2.4, 0.1, 6.6]} />
          <meshStandardMaterial color="#b8945a" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.78, -4.0]}>
          <boxGeometry args={[2.2, 0.08, 1.0]} />
          <meshStandardMaterial color="#b8945a" roughness={0.75} />
        </mesh>
        {/* sleek superstructure */}
        <mesh castShadow position={[0, 1.45, -0.6]}>
          <boxGeometry args={[2.1, 1.1, 3.2]} />
          <meshStandardMaterial color="#fbfcfd" roughness={0.25} />
        </mesh>
        {/* wraparound tinted windshield */}
        <mesh position={[0, 1.55, 1.02]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[1.95, 0.8, 0.05]} />
          <meshStandardMaterial color="#16242e" metalness={0.6} roughness={0.12} />
        </mesh>
        {/* flybridge helm */}
        <mesh castShadow position={[0, 2.2, -1.0]}>
          <boxGeometry args={[1.7, 0.5, 1.6]} />
          <meshStandardMaterial color="#fbfcfd" roughness={0.25} />
        </mesh>
        {/* radar arch */}
        <mesh position={[0, 2.9, -1.6]}>
          <torusGeometry args={[0.8, 0.06, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#cfd4d8" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* chrome rails */}
        {[-1.2, 1.2].map((x, i) => (
          <mesh key={i} position={[x, 1.05, 1.6]}>
            <boxGeometry args={[0.05, 0.35, 4.6]} />
            <meshStandardMaterial color="#c8ccd0" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        {/* wake */}
        <mesh ref={wake} rotation-x={-Math.PI / 2} position={[0, 0.2, -5]} visible={false}>
          <planeGeometry args={[3.2, 6]} />
          <meshBasicMaterial color="#dfeaf0" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </RigidBody>
  );
}
