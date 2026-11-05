import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { ModelCharacter } from "../world/ModelCharacter";
import { consumeTap, isDown, moveAxis } from "../input";
import { shared, addShake, raiseAlarm, addImpact, type TrafficCar, type Body, type Cop, type ParkedEntry } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { sfx } from "../audio/sfx";
import { isBlockedWater, blockedWaterEntry } from "../world/waterZones";
import { pickEnterTarget, ENTER_HEAT, ENTER_LABEL, type EnterCandidates } from "./enterTarget";
import { TRAFFIC_PACK_MODEL } from "../world/StreetLife";
import { markParkedTaken } from "../world/ParkedCars";
import { recallSavedCar } from "./recallCar";

const BARKS = ["Hey! Watch it!", "You crazy?!", "Somebody call the cops!", "Get outta here!", "What's your problem?!", "Easy, pal!"];

const WALK_SPEED = 4.0;
const ENTER_RADIUS = 4.5;
// Turn smoothing: the character used to snap instantly to the move direction,
// which read as twitchy and "animated" on a stick. Lerp the heading toward
// the target heading (shortest arc) so walk and run both turn smoothly.
// NB slice improvements (2026-11-03, T11): rate 12/s (was 10) — slightly
// snappier now that acceleration is smoothed, so it never feels "drunk".
const TURN_RATE = 12;

// Reused every frame in the movement hot path (see ROADMAP §3). The discrete
// melee/gun blocks below allocate only on a key/click tap, so they're left as-is.
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const mesh = useRef<THREE.Group>(null);
  const playerTint = useGame((s) => s.playerTint);
  const armed = useGame((s) => s.armed);
  const melee = useGame((s) => s.melee);
  const stride = useRef(0);
  // Bulk job 2026-11-03 (Franklin gait): the per-frame wantSprint flag,
  // published for ModelCharacter's sprinting() prop — previously computed
  // in useFrame and never passed down.
  const sprintRef = useRef(false);
  // NB slice improvements (2026-11-03, T10): smoothed on-foot velocity —
  // the character used to snap instantly to full speed and to zero.
  const footVel = useRef({ x: 0, z: 0 });

  useEffect(() => {
    shared.player = body.current;
    return () => {
      shared.player = null;
    };
  }, []);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const game = useGame.getState();
    // hide the body in first-person, and while driving
    if (mesh.current) mesh.current.visible = game.mode === "foot" && game.view !== "first";
    if (game.paused) return; // frozen in the pause menu
    if (game.mode !== "foot") return; // disabled while driving/boating

    const ax = moveAxis();
    const yaw = shared.camYaw;
    const fwd = _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const right = _right.set(fwd.z, 0, -fwd.x);
    const dir = _dir.set(0, 0, 0)
      .addScaledVector(fwd, ax.y)
      .addScaledVector(right, -ax.x); // A/D inverted for on-foot strafing

    const v = rb.linvel();
    const moving = dir.lengthSq() > 1e-4;
    // sprint (Shift) drains stamina; it regens when not sprinting.
    // NB slice improvements (2026-11-03, T12): drain 24/s (was 28), regen
    // 22/s (was 18) — sprint is the main way to cover the district on foot.
    const wantSprint = moving && (isDown("ShiftLeft") || isDown("ShiftRight")) && shared.stamina > 1;
    sprintRef.current = wantSprint;
    shared.stamina = THREE.MathUtils.clamp(shared.stamina + (wantSprint ? -24 : 22) * dt, 0, 100);
    const speed = wantSprint ? WALK_SPEED * 1.7 : WALK_SPEED;
    // T10: ease horizontal velocity toward the target at 10/s instead of
    // snapping — matches the car's smoothed feel.
    const ramp = 1 - Math.exp(-dt * 10);
    if (moving) {
      dir.normalize();
      // Water entry block (2026-11-02): same shore stop as the car — refuse
      // to walk INTO blocked water; already-wet bodies can walk back out.
      const tr = rb.translation();
      const nx = tr.x + dir.x * speed * dt;
      const nz = tr.z + dir.z * speed * dt;
      if (blockedWaterEntry(tr.x, tr.z, nx, nz, isBlockedWater)) {
        footVel.current.x = 0; footVel.current.z = 0;
        rb.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      } else {
        footVel.current.x = THREE.MathUtils.lerp(footVel.current.x, dir.x * speed, ramp);
        footVel.current.z = THREE.MathUtils.lerp(footVel.current.z, dir.z * speed, ramp);
        rb.setLinvel({ x: footVel.current.x, y: v.y, z: footVel.current.z }, true);
      }
      // Smooth turn (feel fix 2026-11-02): shortest-arc lerp, not a snap.
      const target = Math.atan2(dir.x, dir.z);
      const dh = Math.atan2(Math.sin(target - shared.heading), Math.cos(target - shared.heading));
      shared.heading += dh * (1 - Math.exp(-dt * TURN_RATE));
    } else {
      footVel.current.x = THREE.MathUtils.lerp(footVel.current.x, 0, ramp);
      footVel.current.z = THREE.MathUtils.lerp(footVel.current.z, 0, ramp);
      rb.setLinvel({ x: footVel.current.x, y: v.y, z: footVel.current.z }, true);
    }
    if (mesh.current) mesh.current.rotation.y = shared.heading;

    // footsteps + foot dust while moving (§20/§23)
    if (moving) {
      stride.current -= dt;
      if (stride.current <= 0) {
        sfx.step();
        stride.current = wantSprint ? 0.38 : 0.55;
        if (wantSprint) { const p = rb.translation(); addImpact(new THREE.Vector3(p.x, 0.15, p.z), "#8c7d63"); }
      }
    } else stride.current = 0;

    // proximity to a car + enter / carjack (NB slice improvements,
    // 2026-11-03: parked cars join the scan; target selection + heat policy
    // live in enterTarget.ts so they are unit-testable).
    {
      const p = rb.translation();
      // nearest carjackable traffic car
      let tj: TrafficCar | null = null;
      let tjD = ENTER_RADIUS;
      for (const tc of shared.traffic) {
        if (tc.stolen) continue;
        const d = Math.hypot(tc.pos.x - p.x, tc.pos.z - p.z);
        if (d < tjD) { tjD = d; tj = tc; }
      }
      // nearest enterable parked car — every parked car renders a pack
      // GLB (Stream A, 2026-11-03) and is enterable; only taken cars skip.
      let pk: ParkedEntry | null = null;
      let pkD = ENTER_RADIUS;
      for (const pe of shared.parked) {
        if (pe.taken) continue;
        const d = Math.hypot(pe.x - p.x, pe.z - p.z);
        if (d < pkD) { pkD = d; pk = pe; }
      }
      // distance to the player's own parked car
      const car = shared.car;
      let ownD = Infinity;
      if (car) { const c = car.translation(); ownD = Math.hypot(p.x - c.x, p.z - c.z); }

      // nearest boat (board at the marina)
      const boat = shared.boat;
      let boatD = Infinity;
      if (boat) { const bp = boat.translation(); boatD = Math.hypot(p.x - bp.x, p.z - bp.z); }

      const candidates: EnterCandidates = { traffic: tj, trafficD: tjD, parked: pk, parkedD: pkD, ownD, boatD };
      const kind = pickEnterTarget(candidates);
      const near = kind !== "none";
      game.setNearCar(near);
      if (near) game.setNearLabel(ENTER_LABEL[kind]);
      if (near && consumeTap("KeyE")) {
        if (kind === "boat") {
          rb.setEnabled(false); game.setNearCar(false); game.setMode("boat"); // cast off
        } else {
          if (kind === "steal" && tj) {
            // carjack: take their ride; the crowd reacts to the crime.
            // The player car renders the stolen car's exact pack visual
            // (tj.pack); the logic type/color are unchanged, so handling,
            // collider and heat behaviour are untouched.
            useGame.getState().setPlayerCar(
              tj.type, tj.color,
              tj.pack ?? `/packs/pack006/${TRAFFIC_PACK_MODEL[tj.type] ?? "economy_sedan"}.glb`,
            );
            if (car) {
              car.setTranslation({ x: tj.pos.x, y: 1.4, z: tj.pos.z }, true);
              car.setLinvel({ x: 0, y: 0, z: 0 }, true);
              car.setRotation({ x: 0, y: Math.sin(tj.yaw / 2), z: 0, w: Math.cos(tj.yaw / 2) }, true);
            }
            shared.carYaw = tj.yaw;
            shared.carDamage = 0; // a fresh ride
            tj.stolen = true;
            addShake(0.4);
            raiseAlarm(p.x, p.z, 5); // nearby peds scatter
            useToasts.getState().push("CARJACKED", "#ffcf4a");
          } else if (kind === "parked" && pk) {
            // unoccupied parked car: no victim, no crime, no heat.
            // The player car renders the parked car's exact pack visual
            // (or its logic-type-mapped pack when no path was recorded).
            markParkedTaken(pk);
            useGame.getState().setPlayerCar(
              pk.type, pk.color,
              pk.packPath ?? `/packs/pack006/${TRAFFIC_PACK_MODEL[pk.type] ?? "economy_sedan"}.glb`,
              pk.packYOff ?? 0,
            );
            if (car) {
              car.setTranslation({ x: pk.x, y: 1.4, z: pk.z }, true);
              car.setLinvel({ x: 0, y: 0, z: 0 }, true);
              car.setRotation({ x: 0, y: Math.sin(pk.rot / 2), z: 0, w: Math.cos(pk.rot / 2) }, true);
            }
            shared.carYaw = pk.rot;
            shared.carDamage = 0; // a fresh ride
          }
          // own-car enter: no heat (the old branch wrongly added 0.5).
          const [hNow, hLater] = ENTER_HEAT[kind];
          if (hNow || hLater) useStats.getState().heat(hNow, hLater);
          rb.setEnabled(false);
          game.setNearCar(false);
          game.setMode("car");
        }
      }
    }

    // saved-car recall (NB slice improvements, 2026-11-03): KeyQ on foot
    // summons the Revuelto to the nearest roadside and auto-enters.
    if (consumeTap("KeyQ")) recallSavedCar();

    // melee: swing at the nearest pedestrian in front (F). A bat (key 4) hits
    // harder, reaches farther, and knocks them flying.
    if (consumeTap("KeyF")) {
      const bat = game.melee === "bat" && !game.armed; // a drawn gun = pistol-whip, not a bat
      const p = rb.translation();
      const fx = Math.sin(shared.heading), fz = Math.cos(shared.heading);
      let best: (typeof shared.peds)[number] | null = null;
      let bestD = bat ? 2.8 : 2.0;
      for (const ped of shared.peds) {
        const dx = ped.pos.x - p.x, dz = ped.pos.z - p.z;
        const dd = Math.hypot(dx, dz) || 1;
        if (dd < bestD && (dx * fx + dz * fz) / dd > 0.25) { best = ped; bestD = dd; }
      }
      if (best) {
        best.hit += bat ? 2 : 1;
        const ax = best.pos.x - p.x, az = best.pos.z - p.z;
        const m = Math.hypot(ax, az) || 1;
        const kb = bat ? 2.4 : 1;
        best.push.x += (ax / m) * kb; best.push.z += (az / m) * kb;
        useStats.getState().heat(bat ? 0.5 : 0.4, bat ? 1.1 : 0.9); // assault heat
        addShake(bat ? 0.75 : 0.5); // impact juice
        addImpact(new THREE.Vector3(best.pos.x, 1.1, best.pos.z), "#9a2a2a");
        raiseAlarm(p.x, p.z, 5);
        if (Math.random() < 0.4) useToasts.getState().push(BARKS[Math.floor(Math.random() * BARKS.length)], "#e7e0ff");
      }
      sfx.punch();
    }

    // gunplay: fire when armed (left-click / Space) along the aim yaw
    if (armed && !game.mapOpen && !game.charOpen && (consumeTap("Mouse0") || consumeTap("Space"))) {
      const p = rb.translation();
      const aim = shared.camYaw;
      const fx = Math.sin(aim), fz = Math.cos(aim);
      const from = new THREE.Vector3(p.x + fx * 0.6, p.y + 0.4, p.z + fz * 0.6);
      const shotgun = game.weapon === "shotgun";
      const RANGE = shotgun ? 26 : 60;
      const CONE = shotgun ? 4.5 : 1.6; // perpendicular half-width tolerance

      if (shotgun) {
        // spread: hit every ped/cop inside a short wide cone
        let hitAny = false;
        for (const ped of shared.peds) {
          const dx = ped.pos.x - p.x, dz = ped.pos.z - p.z;
          const along = dx * fx + dz * fz;
          if (along <= 0 || along > RANGE) continue;
          if (Math.abs(dx * fz - dz * fx) < CONE) { ped.hit += 2; ped.push.x += fx; ped.push.z += fz; addImpact(new THREE.Vector3(ped.pos.x, p.y + 0.4, ped.pos.z), "#8a1414"); hitAny = true; }
        }
        for (const cop of shared.cops) {
          if (cop.dead) continue;
          const dx = cop.pos.x - p.x, dz = cop.pos.z - p.z;
          const along = dx * fx + dz * fz;
          if (along <= 0 || along > RANGE) continue;
          if (Math.abs(dx * fz - dz * fx) < CONE) { cop.dmg += 2; addImpact(new THREE.Vector3(cop.pos.x, p.y + 0.4, cop.pos.z), "#8a1414"); hitAny = true; }
        }
        // a few visible pellet tracers
        for (let k = -2; k <= 2; k++) {
          const a = aim + k * 0.06;
          shared.shots.push({ from: from.clone(), to: new THREE.Vector3(p.x + Math.sin(a) * RANGE, p.y + 0.4, p.z + Math.cos(a) * RANGE), life: 0.06 });
        }
        void hitAny;
        addShake(0.6);
        useStats.getState().heat(0.9, 0.8);
        sfx.shotgun();
      } else {
        let bestT = RANGE;
        let bestPed: Body | null = null;
        let bestCop: Cop | null = null;
        for (const ped of shared.peds) {
          const dx = ped.pos.x - p.x, dz = ped.pos.z - p.z;
          const along = dx * fx + dz * fz;
          if (along <= 0 || along > RANGE) continue;
          if (Math.abs(dx * fz - dz * fx) < CONE && along < bestT) { bestT = along; bestPed = ped; bestCop = null; }
        }
        for (const cop of shared.cops) {
          if (cop.dead) continue;
          const dx = cop.pos.x - p.x, dz = cop.pos.z - p.z;
          const along = dx * fx + dz * fz;
          if (along <= 0 || along > RANGE) continue;
          if (Math.abs(dx * fz - dz * fx) < CONE + 0.8 && along < bestT) { bestT = along; bestCop = cop; bestPed = null; }
        }
        const to = new THREE.Vector3();
        if (bestPed) { bestPed.hit += 2; bestPed.push.x += fx; bestPed.push.z += fz; to.set(bestPed.pos.x, p.y + 0.4, bestPed.pos.z); addImpact(to, "#8a1414"); }
        else if (bestCop) { bestCop.dmg += 1; to.set(bestCop.pos.x, p.y + 0.4, bestCop.pos.z); addImpact(to, "#8a1414"); }
        else to.set(p.x + fx * bestT, p.y + 0.4, p.z + fz * bestT);
        shared.shots.push({ from, to, life: 0.06 });
        addShake(0.3);
        useStats.getState().heat(0.7, 0.6);
        sfx.gun();
      }
      raiseAlarm(p.x, p.z, 6); // gunfire scatters the crowd
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[-256.2, 3, 106.5]}
      friction={0.6}
      linearDamping={0.2}
      mass={1}
    >
      <CapsuleCollider args={[0.5, 0.4]} />
      <group ref={mesh}>
        {/* rigged human; feet at local 0, so drop by the capsule half-height */}
        <group position={[0, -0.9, 0]}>
          <ModelCharacter
            tint={playerTint}
            moving={() => {
              const v = body.current?.linvel();
              return !!v && Math.hypot(v.x, v.z) > 0.6;
            }}
            sprinting={() => sprintRef.current}
          />
          {/* pistol in hand when armed */}
          {armed && (
            <group position={[0.28, 1.0, 0.25]}>
              <mesh castShadow>
                <boxGeometry args={[0.08, 0.12, 0.28]} />
                <meshStandardMaterial color="#1a1a1d" roughness={0.5} metalness={0.6} />
              </mesh>
            </group>
          )}
          {/* baseball bat in hand when chosen (and not holding a gun) */}
          {!armed && melee === "bat" && (
            <group position={[0.3, 1.0, 0.18]} rotation={[0.5, 0, -0.3]}>
              <mesh castShadow position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.05, 0.035, 0.7, 8]} />
                <meshStandardMaterial color="#b08543" roughness={0.7} />
              </mesh>
              <mesh position={[0, -0.02, 0]}>
                <cylinderGeometry args={[0.028, 0.028, 0.12, 8]} />
                <meshStandardMaterial color="#3a2a1a" roughness={0.8} />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </RigidBody>
  );
}
