import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { consumeTap, isDown, moveAxis } from "../input";
import type { VehicleType } from "../earth/vehicleTypes";
import { TrafficPackCar } from "./TrafficPackCar";
import { TRAFFIC_PACK_MODEL, trafficWheelR } from "../world/StreetLife";
import { carProfile } from "../earth/heroVehicleGeometry";
import { recallSavedCar } from "./recallCar";
import { RevueltoCar } from "./RevueltoCar";
import { CarHeadlights } from "./CarHeadlights";
import { CarGrounding } from "../earth/CarGrounding";
import { shared, addShake, addImpact } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { sfx } from "../audio/sfx";
import { snowVehicleLimits } from "../weather/snowstorm";
import { isBlockedWater, blockedWaterEntry } from "../world/waterZones";
import { computeLampPositions } from "../world/Props";
import { buildStreetExtrasLayout } from "../world/StreetExtras";
import { computeUtilityPolePositions } from "../world/UtilityPoles";
import { computeTrafficLightPositions } from "../world/TrafficLights";
import { CORE_WORLD } from "../world/freeway";

// Arcade tuning, slowed down (feel fix 2026-11-02): the old 44 m/s top
// speed (~98 mph) was absurd for city streets and made steering feel
// twitchy at pace. 32 m/s (~72 mph) is still fast for the district —
// raised from 28 on Nic's word (2026-11-03): "speed should be increased
// a bit". Per-type HANDLING multipliers still compose on top, so the
// Revuelto tops at 32 and the Bronco at ~25.6.
const MAX_SPEED = 32;
const REVERSE_SPEED = 12; // NB slice improvements (2026-11-03): was 10 —
// parking and 3-point turns were painful at 10 with the wall probe stopping
// you early.

// NB slice improvements (2026-11-03, T1): per-type handling. Every car used
// to drive identically except for visuals — the single biggest reason stolen
// cars felt interchangeable. Multipliers on top/reverse speed, steering
// peak and throttle rate. Revuelto stays fastest; Bronco feels heavy;
// the Z feels nimble. Default covers any type not listed.
const HANDLING: Record<string, { top: number; steer: number; accel: number }> = {
  revuelto: { top: 1.00, steer: 1.00, accel: 1.00 },
  mustang: { top: 0.95, steer: 0.95, accel: 0.95 },
  nissanz: { top: 0.90, steer: 1.05, accel: 0.90 },
  infiniti: { top: 0.90, steer: 0.95, accel: 0.90 },
  rav4: { top: 0.85, steer: 0.90, accel: 0.90 },
  bronco: { top: 0.80, steer: 0.80, accel: 0.85 },
};
const HANDLING_DEFAULT = { top: 0.90, steer: 1.00, accel: 0.90 };

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
  // Stream A (2026-11-03): pack visual for a stolen/entered car. Null for
  // the Revuelto (own GLB path) and for callers that did not supply one —
  // then the logic-type-mapped pack is used, never a procedural mesh.
  const playerCarPack = useGame((s) => s.playerCarPack);
  const playerCarPackYOff = useGame((s) => s.playerCarPackYOff);
  const shadowsOn = useGame((s) => s.shadows);
  const smoke = useRef(0);
  const nearMiss = useRef(0);
  const steerSmooth = useRef(0);
  const offRoadTimer = useRef(0);
  const offRoadHold = useRef(0);
  const offRoad = useRef(false);
  const offRoadShake = useRef(0);
  const bumpTimer = useRef(0);
  // Rt 18 programme (2026-11-02): breakable street furniture positions —
  // lamp, stop-sign, meter, signal and utility poles, from the SAME builders
  // the visuals use (so the hit test can never disagree with what's drawn).
  // These no longer have physics colliders; driving through one costs a
  // little damage instead of stopping the car.
  const slice = useGame((s) => s.slice);
  const breakableProps = useMemo(() => {
    if (!slice) return [] as [number, number][];
    const lamps = computeLampPositions(slice.roads, CORE_WORLD);
    const extras = buildStreetExtrasLayout(slice.roads, CORE_WORLD);
    const poles = computeUtilityPolePositions(slice.roads, CORE_WORLD);
    // Full-game plan item 4: signal poles complete the set — the Rt 18
    // hook covered every other pole type but not these (they have no
    // colliders either, so they were free to drive through).
    const signals = computeTrafficLightPositions(slice.roads, CORE_WORLD);
    return [
      ...lamps.map((p): [number, number] => [p.x, p.z]),
      ...extras.stops.map((p): [number, number] => [p.x, p.z]),
      ...extras.meters.map((p): [number, number] => [p.x, p.z]),
      ...poles.map((p): [number, number] => [p.x, p.z]),
      ...signals.map((p): [number, number] => [p.x, p.z]),
    ];
  }, [slice]);
  const propHitTimes = useRef(new Map<number, number>());
  useEffect(() => { propHitTimes.current.clear(); }, [breakableProps]);
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
    const winter = game.weather === "snow";
    // T1: per-type handling scales the snow limits' inputs, so winter and
    // type multipliers compose instead of fighting.
    const handling = HANDLING[carType] ?? HANDLING_DEFAULT;
    const traction = snowVehicleLimits(winter, MAX_SPEED * handling.top, REVERSE_SPEED * handling.top);
    let yaw = shared.carYaw;
    const fwd = _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const v = rb.linvel();
    const vForward = v.x * fwd.x + v.z * fwd.z;

    // handbrake (Space): scrubs speed fast and loosens the steering for a drift
    const handbrake = isDown("Space");

    // steering: needs some roll to bite, then eases off near top speed so the
    // car tracks straight and smooth instead of darting. Playtest fix
    // (2026-11-02, D-02): the old 2.0 rad/s at full lock plus unsmoothed
    // touch input made turns snap ~90° in a second. Lower peak rate and
    // smooth the stick input toward full lock.
    // NB slice improvements (2026-11-03, T2/T3/T4): full bite at 4 m/s
    // instead of 6 (parking lots stopped feeling dead), stronger high-speed
    // falloff (0.55), slightly quicker smoothing (10/s).
    const speedFrac = THREE.MathUtils.clamp(Math.abs(vForward) / MAX_SPEED, 0, 1);
    let authority = THREE.MathUtils.clamp(Math.abs(vForward) / 4, 0, 1) * (1 - speedFrac * 0.55);
    if (handbrake) authority *= 1.8; // sharper rotation while sliding
    steerSmooth.current = THREE.MathUtils.lerp(steerSmooth.current, ax.x, 1 - Math.exp(-dt * 10));
    yaw -= steerSmooth.current * 1.3 * handling.steer * dt * authority * traction.steer * (vForward < -0.1 ? -1 : 1);

    // publish driving signals (§13): speed for camera FOV, skid for tire marks
    shared.carSpeed = vForward;
    shared.skid = (handbrake && Math.abs(vForward) > 6) || (Math.abs(ax.x) > 0.6 && Math.abs(vForward) > 18);

    // throttle / brake / coast — smoothed for a gentle, drift-free ramp.
    // NB slice improvements (2026-11-03, T5/T6): eager launch (2.6/s),
    // faster coast decay (1.5/s), and a real brake — S brakes to 0 while
    // moving forward instead of instantly targeting reverse.
    const braking = ax.y < 0 && vForward > 2;
    const target =
      handbrake ? 0 : ax.y > 0 ? traction.forward * ax.y : braking ? 0 : ax.y < 0 ? -traction.reverse * -ax.y : 0;
    const rate = handbrake ? 4.5 * traction.handbrakeResponse : ax.y !== 0 ? 2.6 * traction.throttleResponse * handling.accel : 1.5 * traction.throttleResponse;
    let nf = THREE.MathUtils.lerp(vForward, target, 1 - Math.exp(-dt * rate));

    const nfwd = _nfwd.set(Math.sin(yaw), 0, Math.cos(yaw));

    // forward wall-probe: the solver alone can't hold a trimesh wall when we
    // re-inject full forward velocity every frame (that's how the car "drove
    // through buildings"). Raycast in the travel direction and refuse to drive
    // into anything within the body's reach, while still allowing reverse.
    // NB slice improvements (2026-11-03, T8): probe reach is profile-driven
    // (half-length + 0.7 buffer) — the old fixed 2.8 assumed the 2.1 stock
    // collider, so a stolen Mustang's nose/tail sank ~0.2 m into walls.
    if (Math.abs(nf) > 0.5) {
      const sign = nf < 0 ? -1 : 1;
      const tr = rb.translation();
      const r = ray.current;
      r.origin.x = tr.x; r.origin.y = tr.y + 0.4; r.origin.z = tr.z;
      r.dir.x = nfwd.x * sign; r.dir.y = 0; r.dir.z = nfwd.z * sign;
      const CLEAR = carProfile(carType).length / 2 + 0.7;
      const hit = world.castRay(r, CLEAR, true, undefined, undefined, undefined, rb);
      if (hit && hit.timeOfImpact < CLEAR) {
        // Contact feedback (playtest 2026-11-02, A-07): probe stops were
        // silent, so driving into a parked car or wall felt like nothing
        // happened. Throttled soft thud + jolt, only when arriving with
        // speed; slow creep stays silent. Parked cars are visible to the
        // probe since they gained colliders (E-04).
        if (Math.abs(nf) > 6 && bumpTimer.current <= 0) { addShake(0.18); sfx.bump(); bumpTimer.current = 0.6; }
        // Probe (2026-11-03 water/wall diagnosis): record WHAT stopped the
        // car — distance, position, yaw, collider handle when known. Never
        // allowed to break driving, so the whole record is guarded.
        try {
          const col = hit.collider as unknown as {
            handle?: number;
            translation?: () => { x: number; z: number };
          };
          const ct = col.translation ? col.translation() : null;
          shared.lastStop = {
            kind: "wall",
            at: Date.now(),
            x: tr.x, y: tr.y, z: tr.z,
            yaw,
            dist: hit.timeOfImpact,
            handle: typeof col.handle === "number" ? col.handle : null,
            cx: ct ? ct.x : null,
            cz: ct ? ct.z : null,
          };
        } catch {
          /* probe reporting must never break driving */
        }
        nf = 0; // wall ahead → don't ram through
      }
    }

    // Off-carriageway feedback (playtest 2026-11-02, A-05): curbs and grass
    // have no colliders by design (one flat ground plane), so sidewalk and
    // grass driving was frictionless. Every 0.2 s, measure the distance to
    // the nearest road centerline; if the car sits beyond the carriageway
    // for two consecutive checks, drag it and jolt the camera. This is
    // feedback, not a wall — the car can still mount a curb deliberately.
    offRoadTimer.current -= dt;
    if (offRoadTimer.current <= 0) {
      offRoadTimer.current = 0.2;
      const slice = useGame.getState().slice;
      let over = false;
      if (slice) {
        const cp0 = rb.translation();
        let best = Infinity, bestHalf = 0;
        for (const r of slice.roads) {
          if (r.points.length < 2) continue;
          for (let i = 0; i < r.points.length - 1; i++) {
            const ax = r.points[i][0], az = -r.points[i][1];
            const bx = r.points[i + 1][0], bz = -r.points[i + 1][1];
            const dx = bx - ax, dz = bz - az;
            const len2 = dx * dx + dz * dz;
            const t = len2 > 0 ? Math.max(0, Math.min(1, ((cp0.x - ax) * dx + (cp0.z - az) * dz) / len2)) : 0;
            const d = Math.hypot(cp0.x - (ax + dx * t), cp0.z - (az + dz * t));
            if (d < best) { best = d; bestHalf = r.width / 2; }
          }
        }
        over = best > bestHalf + 2.5;
      }
      offRoadHold.current = over ? offRoadHold.current + 1 : 0;
      offRoad.current = offRoadHold.current >= 2;
    }
    if (offRoad.current && Math.abs(nf) > 3) {
      nf *= 0.97; // rolling drag off the carriageway (was 0.985 — grass and
      // sidewalk should cost real speed, still escapable, not a wall)
      offRoadShake.current -= dt;
      if (offRoadShake.current <= 0) { addShake(0.12); offRoadShake.current = 0.45; }
    }

    // Water entry block (2026-11-02): refuse to drive INTO blocked water
    // outright — the Hazards sink grace let cars drive on water before the
    // timer fired, and velocity re-injection fought its drag.
    if (Math.abs(nf) > 0.5) {
      const tr = rb.translation();
      const nx = tr.x + nfwd.x * nf * dt;
      const nz = tr.z + nfwd.z * nf * dt;
      if (blockedWaterEntry(tr.x, tr.z, nx, nz, isBlockedWater)) {
        // Probe (2026-11-03): same last-stop slot as the wall probe, with
        // kind "water" and no ray hit — so the overlay can tell an entry
        // block from a wall hit instead of both reading as "stopped".
        shared.lastStop = {
          kind: "water",
          at: Date.now(),
          x: tr.x, y: tr.y, z: tr.z,
          yaw,
          dist: null,
          handle: null,
          cx: null,
          cz: null,
        };
        nf = 0;
      }
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

    // saved-car recall (NB slice improvements, 2026-11-03): KeyQ while
    // driving a stolen/parked car restores the saved car in place.
    if (consumeTap("KeyQ")) recallSavedCar();

    // ram traffic: contact halts the other car (and jolts the camera once)
    const cp = rb.translation();
    nearMiss.current = Math.max(0, nearMiss.current - dt);
    bumpTimer.current = Math.max(0, bumpTimer.current - dt);
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
    // Rt 18 programme (2026-11-02): breakable street furniture. Lamp,
    // stop-sign, meter and utility poles have no colliders anymore, so the
    // car drives through them — at a small price: +3 damage (vs +11 for a
    // traffic ram), a shake and the soft bump sound. Per-prop cooldown so
    // one post can't multi-hit per pass. Parked cars, traffic and
    // buildings stay solid (their colliders are untouched).
    if (Math.abs(vForward) > 2 && breakableProps.length > 0) {
      const now = performance.now() / 1000;
      for (let i = 0; i < breakableProps.length; i++) {
        const dx = breakableProps[i][0] - cp.x, dz = breakableProps[i][1] - cp.z;
        if (dx * dx + dz * dz < 1.21) { // 1.1 m: car half-width + pole radius
          const last = propHitTimes.current.get(i) ?? -Infinity;
          if (now - last > 2.5) {
            propHitTimes.current.set(i, now);
            shared.carDamage = Math.min(100, shared.carDamage + 3);
            addShake(0.12);
            sfx.bump();
          }
        }
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

  // Pack path for a non-Revuelto player car: the exact stolen/entered
  // visual when recorded, else the logic-type-mapped P006 model. Handling
  // (HANDLING[carType]), collider (carProfile(carType)) and headlights
  // still key off the logic type — only the rendered mesh changes.
  const packPath = carType === "revuelto"
    ? null
    : (playerCarPack ?? `/packs/pack006/${TRAFFIC_PACK_MODEL[carType] ?? "economy_sedan"}.glb`);
  void carColor; // pack paint is baked; the stored color is kept for HUD/save compat

  return (
    <>
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
      {/* NB slice improvements (2026-11-03, T8): collider half-length is
          profile-driven — the old revuelto special-case generalized. The
          Revuelto keeps 4.94/2 = 2.47 exactly, so no regression there. */}
      <CuboidCollider args={[1.0, 0.6, carProfile(carType).length / 2]} />
      {/* real car model; collider center is ~0.6 above the wheels' contact.
          Pack GLBs share the Revuelto's convention (origin at ground-contact
          centre, forward +Z), so they drop into this group unchanged. */}
      <group position={[0, -0.6, 0]}>
        {carType === "revuelto" ? (
          <RevueltoCar />
        ) : packPath ? (
          <group position={[0, playerCarPackYOff, 0]}>
            <TrafficPackCar
              pack={packPath}
              wheelR={trafficWheelR(packPath)}
              getSpeed={() => shared.carSpeed}
            />
          </group>
        ) : null}
        {/* Night fix (playtest 2026-11-02, R4 review): real headlight beams.
            Lamp emissive alone lit nothing; these spots light the road ahead. */}
        <CarHeadlights type={carType as VehicleType} />
      </group>
    </RigidBody>
    {/* Playtest fix (2026-11-02, E-03): the blob shadow ran alongside the
        real sun shadow, doubling it — and sat at y=0.09, below sidewalk
        height, so it vanished on one surface and read as "detached" on
        another. Only render it when real shadows are off, which is the
        case it was built for. */}
    {!shadowsOn && <CarGrounding body={body} />}
    </>
  );
}
