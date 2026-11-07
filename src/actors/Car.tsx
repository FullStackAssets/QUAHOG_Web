import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { consumeTap, isDown, moveAxis } from "../input";
import { Vehicle, type VehicleType } from "../earth/Vehicles";
import { shared, addShake, addImpact } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { sfx } from "../audio/sfx";
import { MOBILE_TUNING, stepVehicleDynamics } from "../sim";

// Arcade tuning lives in src/sim/VehicleDynamics (iPhone-leaning defaults).
const MAX_SPEED = MOBILE_TUNING.maxSpeed;

// Module-scope scratch vectors reused every frame. The car's useFrame runs at
// 60 Hz; allocating fresh THREE.Vector3s here (fwd/nfwd/right) produced ~180
// short-lived objects per second per car and showed up as GC-pause jank under
// load (see QUAHOG_Web/ROADMAP.md §3 "per-frame garbage").
const _fwd = new THREE.Vector3();
const _nfwd = new THREE.Vector3();
const _right = new THREE.Vector3();

export function Car() {
  const body = useRef<RapierRigidBody>(null);
  const carType = useGame((s) => s.playerCarType);
  const carColor = useGame((s) => s.playerCarColor);
  const smoke = useRef(0);
  const nearMiss = useRef(0);
  const { world, rapier } = useRapier();
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }));

  useEffect(() => {
    shared.car = body.current;
    return () => {
      shared.car = null;
    };
  }, []);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const game = useGame.getState();
    if (game.paused) { shared.skid = false; sfx.engine(0, false); return; }
    if (game.mode !== "car") { shared.skid = false; shared.carSpeed = 0; sfx.engine(0, false); return; }

    const ax = moveAxis();
    const yaw0 = shared.carYaw;
    const fwd = _fwd.set(Math.sin(yaw0), 0, Math.cos(yaw0));
    const v = rb.linvel();
    const vForward = v.x * fwd.x + v.z * fwd.z;

    // handbrake (Space): scrubs speed fast and loosens the steering for a drift
    const handbrake = isDown("Space");
    const stepped = stepVehicleDynamics(
      { yaw: yaw0, speed: vForward, skidding: false },
      { steer: ax.x, throttle: ax.y, handbrake },
      dt,
    );
    const yaw = stepped.yaw;
    let nf = stepped.speed;

    // publish driving signals (§13): speed for camera FOV, skid for tire marks
    shared.carSpeed = nf;
    shared.skid = stepped.skidding;

    const nfwd = _nfwd.set(Math.sin(yaw), 0, Math.cos(yaw));

    // forward wall-probe: the solver alone can't hold a trimesh wall when we
    // re-inject full forward velocity every frame (that's how the car "drove
    // through buildings"). Raycast in the travel direction and refuse to drive
    // into anything within the body's reach, while still allowing reverse.
    if (Math.abs(nf) > 0.5) {
      const sign = nf < 0 ? -1 : 1;
      const tr = rb.translation();
      const r = ray.current;
      r.origin.x = tr.x; r.origin.y = tr.y + 0.4; r.origin.z = tr.z;
      r.dir.x = nfwd.x * sign; r.dir.y = 0; r.dir.z = nfwd.z * sign;
      const CLEAR = 2.8; // collider half-length (2.1) + a small buffer
      const hit = world.castRay(r, CLEAR, true, undefined, undefined, undefined, rb);
      if (hit && hit.timeOfImpact < CLEAR) nf = 0; // wall ahead → don't ram through
    }

    rb.setLinvel({ x: nfwd.x * nf, y: v.y, z: nfwd.z * nf }, true);
    rb.setRotation(
      { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
      true,
    );
    shared.carYaw = yaw;

    // engine note tracks speed; horn on H
    sfx.engine(Math.min(1, Math.abs(nf) / MAX_SPEED), true);
    if (consumeTap("KeyH")) sfx.horn();

    // ram traffic: contact halts the other car (and jolts the camera once)
    const cp = rb.translation();
    nearMiss.current = Math.max(0, nearMiss.current - dt);
    let missed = false;
    for (const tc of shared.traffic) {
      if (tc.stolen) continue;
      const d = Math.hypot(tc.pos.x - cp.x, tc.pos.z - cp.z);
      if (d < 4.4) {
        if (tc.stop <= 0 && Math.abs(vForward) > 6) { addShake(0.35); sfx.crash(); shared.carDamage = Math.min(100, shared.carDamage + 11); }
        tc.stop = Math.max(tc.stop, 1.6);
      } else if (d < 6.6 && Math.abs(vForward) > 24) {
        missed = true; // a clean fast pass — close but no contact
      }
    }
    // near-miss cash bonus (§13/§18), throttled
    if (missed && nearMiss.current <= 0) {
      nearMiss.current = 1.1;
      useStats.getState().addCash(15);
      useToasts.getState().push("NEAR MISS +$15", "#ffcf4a");
    }

    // engine smoke once the body's beat up (§12/§23)
    if (shared.carDamage > 55) {
      smoke.current -= dt;
      if (smoke.current <= 0) {
        smoke.current = shared.carDamage > 80 ? 0.18 : 0.32;
        addImpact(new THREE.Vector3(cp.x + nfwd.x * 1.8, 1.0, cp.z + nfwd.z * 1.8), shared.carDamage > 80 ? "#2a2a2a" : "#8a8a8a");
      }
    }

    // exit
    if (consumeTap("KeyE")) {
      const c = rb.translation();
      const right = _right.set(nfwd.z, 0, -nfwd.x);
      const pl = shared.player;
      if (pl) {
        pl.setEnabled(true);
        pl.setTranslation(
          { x: c.x + right.x * 3, y: 2, z: c.z + right.z * 3 },
          true,
        );
        pl.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      game.setMode("foot");
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[-249, 2, 108]}
      rotation={[0, -Math.PI / 2, 0]}
      linearDamping={0.5}
      mass={2.4}
      ccd
    >
      <CuboidCollider args={[1.0, 0.6, 2.1]} />
      {/* real car model; collider center is ~0.6 above the wheels' contact */}
      <group position={[0, -0.6, 0]}>
        <Vehicle
          type={carType as VehicleType}
          color={carColor}
          brake={() => useGame.getState().mode === "car" && moveAxis().y < -0.1}
        />
      </group>
    </RigidBody>
  );
}
