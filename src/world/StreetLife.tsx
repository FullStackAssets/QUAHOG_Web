import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ModelCharacter } from "./ModelCharacter";
import { Vehicle, VEHICLE_TYPES } from "../earth/Vehicles";
import { shared, raiseAlarm, addPickup, type Body, type TrafficCar } from "../shared";
import { useStats } from "../game";
import type { Road } from "../slice";

// Ambient "street life" ported from the legacy Unity StreetLife.cs: wandering
// pedestrians + decorative patrol cars. Everything is KINEMATIC (plain meshes,
// no rigid bodies) so it can never shove the player's physics car — exactly the
// constraint the Unity version held. Cars here follow the REAL OSM road network.

const PED_COUNT = 32;
const PED_SPEED = 1.5; // m/s
const PED_WANDER = 32; // half-extent of wander box around origin
const CAR_COUNT = 20;
const CAR_SPEED = 9; // m/s
const CONNECT_R = 10; // how close road endpoints must be to count as joined

const DRIVABLE = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary",
  "residential", "unclassified", "living_street", "service",
]);

const PED_COLORS = ["#c0563f", "#3f6cc0", "#4a8c52", "#b8a23a", "#7a4a8c", "#c87a3f",
  "#b03a5a", "#2f8c7a", "#5a5a6a", "#d0863a", "#356a9c", "#8a4a3a", "#6a8a3a", "#a0a0a8"];
const PANTS = ["#2c2f3a", "#3a3326", "#23344f", "#4a4a4a", "#5a3a2a", "#1f2a1f", "#3a2a3a", "#454033"];
const SKINS = ["#caa07a", "#e0b48c", "#a87a52", "#8a5a36", "#d8a87a", "#6a4226", "#b88a5e"];
const HAIRS = ["#2a2018", "#4a3422", "#1a1a1a", "#6a5a3a", "#8a8a8a", "#3a2a1a", "#bcae8a"];
const CAR_COLORS = ["#9c3a3a", "#2f6f7a", "#caa24a", "#3a5a9c", "#5a5a5a", "#8c6a3a",
  "#5a1f1f", "#c9c2b4", "#3a2a22", "#1f3a2a", "#40506a", "#8a8f96", "#b56a3a", "#6a2a4a"];

interface Route {
  pts: THREE.Vector3[];
  total: number; // total length
}

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();
const _dir = new THREE.Vector3();

// ---------------------------------------------------------------------------

export function StreetLife({
  roads,
  center = [0, 0],
}: {
  roads: Road[];
  center?: [number, number];
}) {
  const routes = useMemo<Route[]>(() => {
    const out: Route[] = [];
    for (const r of roads) {
      if (!DRIVABLE.has(r.highway) || r.points.length < 2) continue;
      const pts = r.points.map(([e, n]) => new THREE.Vector3(e, 0.4, -n));
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) total += pts[i].distanceTo(pts[i + 1]);
      if (total > 6) out.push({ pts, total });
    }
    return out;
  }, [roads]);

  if (routes.length === 0) return null;
  return (
    <group>
      <Pedestrians center={center} />
      <Traffic routes={routes} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pedestrians — wander between random points in a box around the district core.

function Pedestrians({ center }: { center: [number, number] }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const state = useRef(
    Array.from({ length: PED_COUNT }, () => {
      const pos = randInBox(center);
      return {
        pos, goal: randInBox(center), heading: 0, color: pick(PED_COLORS),
        scale: 0.9 + Math.random() * 0.28, // overall size variety (origin at feet, so they stay planted) — not 32 clones
        down: 0, dead: false,
        vel: new THREE.Vector3(), y: 0, tumble: 0, // ragdoll launch state
        body: { pos: pos.clone(), push: new THREE.Vector3(), hit: 0 } as Body,
      };
    }),
  );

  // register pedestrian bodies so the player's punch can find them
  useEffect(() => {
    shared.peds = state.current.map((p) => p.body);
    return () => { shared.peds = []; };
  }, []);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    state.current.forEach((p, i) => {
      const g = refs.current[i];
      if (!g) return;

      // run over by the player's car at speed → 2 damage (a lethal blow). The
      // push points away from the car so the body flies the right way; the hit
      // amount (not the push length) decides how hard it's flung.
      if (!p.dead && shared.car && Math.abs(shared.carSpeed) > 8) {
        const c = shared.car.translation();
        if (Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 2.3) {
          const fresh = p.down <= 0;
          p.body.hit += 2;
          p.body.push.set(p.pos.x - c.x, 0, p.pos.z - c.z);
          if (fresh) { useStats.getState().heat(0.6, 0.7); raiseAlarm(p.pos.x, p.pos.z, 5); }
        }
      }

      // resolve hits: each damage point advances a stage (alive→down→dead), so a
      // 2-damage blow (bat, gun, car) drops a standing ped outright while a fist
      // (1) only knocks them down. A 2+ blow flings the body; a 1 just nudges it.
      if (p.body.hit > 0) {
        const hard = p.body.hit > 1; // bat / gun / car vs a bare fist
        if (p.body.push.lengthSq() > 1e-4) _dir.copy(p.body.push).setY(0).normalize();
        else _dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        p.vel.set(_dir.x * (hard ? 9 : 3.5), hard ? 7 : 3, _dir.z * (hard ? 9 : 3.5));
        p.tumble = 0.001;
        p.body.push.set(0, 0, 0);
        const wasDead = p.dead;
        for (let h = p.body.hit; h > 0 && !p.dead; h--) {
          if (p.down > 0) p.dead = true;
          else p.down = 4;
        }
        if (!wasDead && p.dead) addPickup(p.pos.x, p.pos.z, 20 + Math.floor(Math.random() * 60)); // drops cash
        p.body.hit = 0;
      }
      if (p.dead || p.down > 0) {
        if (p.down > 0) p.down -= step;
        // ragdoll flight: integrate the launch, tumble through the air, then settle
        if (p.tumble > 0 || p.y > 0.001) {
          p.vel.y -= 24 * step;
          p.pos.x += p.vel.x * step; p.pos.z += p.vel.z * step;
          p.y += p.vel.y * step;
          p.vel.x *= 0.96; p.vel.z *= 0.96;
          if (p.y <= 0) { p.y = 0; p.vel.set(0, 0, 0); p.tumble = 0; }
          else p.tumble += step * 9;
          g.position.set(p.pos.x, p.y, p.pos.z);
          g.rotation.set(Math.PI / 2 + Math.sin(p.tumble) * 0.7, p.heading, Math.cos(p.tumble) * 0.5);
        } else {
          g.position.copy(p.pos);
          g.rotation.set(Math.PI / 2, p.heading, 0); // settled, lying down
        }
        p.body.pos.copy(p.pos);
        return;
      }

      if (p.body.push.lengthSq() > 0) { p.pos.add(p.body.push); p.body.push.set(0, 0, 0); }

      // threat awareness: flee gunfire/violence or an oncoming fast car (§14)
      let threat: THREE.Vector3 | null = null;
      if (shared.alarm.t > 0 && p.pos.distanceTo(shared.alarm.pos) < 26) threat = shared.alarm.pos;
      else if (shared.car && Math.abs(shared.carSpeed) > 10) {
        const c = shared.car.translation();
        if (Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 12) threat = TMP.set(c.x, 0, c.z);
      }

      if (threat) {
        const away = TMP2.subVectors(p.pos, threat); away.y = 0;
        if (away.lengthSq() < 1e-3) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        away.normalize();
        p.pos.addScaledVector(away, PED_SPEED * 2.2 * step); // run
        p.heading = Math.atan2(away.x, away.z);
      } else {
        const to = new THREE.Vector3().subVectors(p.goal, p.pos);
        to.y = 0;
        if (to.length() < 0.6) {
          p.goal = randInBox(center);
        } else {
          to.normalize();
          p.pos.addScaledVector(to, PED_SPEED * step);
          p.heading = Math.atan2(to.x, to.z);
        }
      }
      g.position.copy(p.pos);
      g.rotation.set(0, p.heading, 0);
      p.body.pos.copy(p.pos);
    });
  });

  return (
    <group>
      {state.current.map((p, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={p.pos} scale={p.scale}>
          {/* tint per ped (the colour was computed but never used) so the crowd
              reads as different people, not 32 identical white models */}
          <ModelCharacter tint={p.color} moving={() => !p.dead && p.down <= 0} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Traffic — cars drive along real road polylines and turn onto a connected road
// at each end (falling back to a U-turn when nothing connects).

function Traffic({ routes }: { routes: Route[] }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const state = useRef(
    Array.from({ length: CAR_COUNT }, () => {
      const ri = Math.floor(Math.random() * routes.length);
      const color = pick(CAR_COLORS);
      const vtype = pick(VEHICLE_TYPES);
      return {
        route: ri,
        forward: Math.random() < 0.5,
        dist: Math.random() * routes[ri].total,
        color,
        vtype,
        braking: false,
        pos: new THREE.Vector3(),
        heading: 0,
        // shared handle the player ram/steal logic reads + writes
        car: { pos: new THREE.Vector3(), yaw: 0, type: vtype, color, stop: 0, stolen: false } as TrafficCar,
      };
    }),
  );

  // publish traffic cars so Car (ram) and Player (carjack) can interact
  useEffect(() => {
    shared.traffic = state.current.map((c) => c.car);
    return () => { shared.traffic = []; };
  }, []);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    state.current.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;

      // carjacked → hide and stop participating in traffic
      if (c.car.stolen) { g.visible = false; return; }

      // rammed → sit still until the stop timer expires
      if (c.car.stop > 0) {
        c.car.stop -= step;
        c.braking = true;
        g.position.copy(c.pos);
        g.rotation.y = c.heading;
        return;
      }

      // yield: pause if the player (car/on foot) is right in front of us
      const pb = (shared.car && shared.car.isEnabled?.() === false ? shared.player : shared.car) ?? shared.player;
      const pt = pb?.translation();
      if (pt && Math.hypot(pt.x - c.pos.x, pt.z - c.pos.z) < 7) { c.braking = true; g.position.copy(c.pos); g.rotation.y = c.heading; return; }

      // obey red signals: stop if a red stop-line is just ahead and aligned with
      // our travel direction (§14). Cross-street cars (≈90°) ignore it.
      if (redAhead(c.pos, c.heading)) { c.braking = true; g.position.copy(c.pos); g.rotation.y = c.heading; return; }
      c.braking = false;

      const route = routes[c.route];
      c.dist += CAR_SPEED * step;

      if (c.dist >= route.total) {
        // reached the far end — turn onto a connected road if possible
        const end = c.forward ? route.pts[route.pts.length - 1] : route.pts[0];
        const next = pickConnected(routes, c.route, end);
        if (next) {
          c.route = next.idx;
          c.forward = next.forward;
        } else {
          c.forward = !c.forward; // U-turn
        }
        c.dist = 0;
      }

      const along = c.forward ? c.dist : route.total - c.dist;
      const { point, dir } = sampleAlong(routes[c.route], along);
      c.pos.copy(point);
      c.heading = Math.atan2(dir.x, dir.z) + (c.forward ? 0 : Math.PI);
      g.position.copy(c.pos);
      g.rotation.y = c.heading;
      c.car.pos.copy(c.pos);
      c.car.yaw = c.heading;
    });
  });

  return (
    <group>
      {state.current.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <Vehicle type={c.vtype} color={c.color} brake={() => c.braking} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// helpers

function randInBox(center: [number, number] = [0, 0]) {
  return new THREE.Vector3(
    center[0] + (Math.random() * 2 - 1) * PED_WANDER,
    0,
    center[1] + (Math.random() * 2 - 1) * PED_WANDER,
  );
}
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const STOP_DIST = 8;
/** True if a red signal stop-line is just ahead of a car heading `heading`. */
function redAhead(pos: THREE.Vector3, heading: number) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  for (const z of shared.stopZones) {
    if (!z.red) continue;
    const dx = z.x - pos.x, dz = z.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > STOP_DIST || d < 0.001) continue;
    if (fx * dx + fz * dz <= 0) continue; // behind us
    // aligned with this road? compare heading to the stop-line's road bearing (mod π)
    let da = (heading - z.rot) % Math.PI;
    if (da > Math.PI / 2) da -= Math.PI;
    if (da < -Math.PI / 2) da += Math.PI;
    if (Math.abs(da) < 0.6) return true;
  }
  return false;
}

/** Position + unit direction at arc-length `d` along a route (start→end). */
function sampleAlong(route: Route, d: number): { point: THREE.Vector3; dir: THREE.Vector3 } {
  const pts = route.pts;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = pts[i].distanceTo(pts[i + 1]);
    if (acc + seg >= d || i === pts.length - 2) {
      const t = seg > 1e-4 ? THREE.MathUtils.clamp((d - acc) / seg, 0, 1) : 0;
      const point = new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], t);
      const dir = new THREE.Vector3().subVectors(pts[i + 1], pts[i]).normalize();
      return { point, dir };
    }
    acc += seg;
  }
  return { point: pts[0].clone(), dir: new THREE.Vector3(0, 0, 1) };
}

/** Find a route (not `current`) with an endpoint near `at`; head away from it. */
function pickConnected(routes: Route[], current: number, at: THREE.Vector3) {
  const hits: { idx: number; forward: boolean }[] = [];
  for (let i = 0; i < routes.length; i++) {
    if (i === current) continue;
    const r = routes[i];
    if (r.pts[0].distanceTo(at) < CONNECT_R) hits.push({ idx: i, forward: true });
    else if (r.pts[r.pts.length - 1].distanceTo(at) < CONNECT_R)
      hits.push({ idx: i, forward: false });
  }
  return hits.length ? hits[Math.floor(Math.random() * hits.length)] : null;
}
