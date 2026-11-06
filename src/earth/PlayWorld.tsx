import { useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { TilesRendererContext } from "3d-tiles-renderer/r3f";
// Rigid primitive humanoid, NOT the skinned CesiumMan: at the photoreal tiles'
// earth-centered coordinates (~6.3M m from origin) GPU skinning shatters in
// float32, so the skinned model explodes into shards. Rigid meshes render
// camera-relative and stay crisp (same reason the car looks fine).
import { Character } from "../world/Character";
import { gaitFor } from "../actors/gait";
import { consumeTap, isDown, moveAxis } from "../input";
import { DRIVABLE, awayInto, firstPerson, followCam, forwardHit, frameUp, groundY, lerpAngle, placeOverviewCamera, sampleRoute } from "./follow";
import { playState, resetBodies, type Body } from "./playState";
import { Vehicle } from "./Vehicles";
import { trafficLook } from "./vehicleTypes";
import { pedLook } from "./pedLook";
import { NPC_GROUND_INTERVAL_S, tileCollision } from "./raycastBudget";
import { applyContactDamage, contactLatch } from "./health";
import type { Weather } from "./Ambient";
import type { Slice } from "../slice";

export type View = "third" | "first";
export interface Spawn { x: number; z: number; heading: number }

const planar = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _probe = new THREE.Vector3();
const _away = new THREE.Vector3();
const _seat = new THREE.Vector3();
const _to = new THREE.Vector3();
const _point = new THREE.Vector3();
const _routeDir = new THREE.Vector3();

function pedAhead(pos: THREE.Vector3, heading: number): boolean {
  _fwd.set(Math.sin(heading), 0, Math.cos(heading));
  for (const ped of playState.peds) {
    const dx = ped.pos.x - pos.x;
    const dz = ped.pos.z - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < 2 && (dx * _fwd.x + dz * _fwd.z) / d > 0.25) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Player: on foot + drivable car, wall-collided, with 1st/3rd-person views.

export function PlayerRig({ spawn, view, weather = "clear", onReady }: { spawn: Spawn; view: View; weather?: Weather; onReady?: () => void }) {
  const camera = useThree((s) => s.camera);
  const tiles = useContext(TilesRendererContext);
  const player = useRef<THREE.Group>(null);
  const car = useRef<THREE.Group>(null);
  const s = useRef({
    mode: "foot" as "foot" | "car",
    ready: false,
    wait: 0,
    carSpeed: 0,
    speed: 0,
    health: 100,
    bumpLatch: false,
    overlapping: false,
    pos: new THREE.Vector3(spawn.x, 0, spawn.z),
    heading: spawn.heading,
    camYaw: spawn.heading,
    moving: false,
    carPos: new THREE.Vector3(spawn.x + 5, 0, spawn.z),
    carYaw: spawn.heading,
  });

  useEffect(() => {
    playState.player.health = 100;
    playState.player.driving = false;
    playState.player.nearCar = false;
    playState.player.pedInReach = false;
    return () => tileCollision.clear();
  }, []);

  useFrame((state, dt) => {
    const parent = player.current?.parent;
    if (!parent) return;
    const now = state.clock.elapsedTime;
    tileCollision.beginFrame(now);
    const step = Math.min(dt, 0.05);
    parent.updateWorldMatrix(true, false);
    const up = frameUp(parent);
    const st = s.current;
    const group = tiles?.group;
    const ray = tileCollision.ray;

    if (!st.ready) {
      const gy = tileCollision.sampleGround("player-ground", now, () => groundY(parent, group, ray, st.pos.x, st.pos.z, up), { priority: true });
      st.wait += step;
      if (gy !== null) {
        st.pos.y = gy; st.carPos.y = gy; st.ready = true; onReady?.();
      } else if (st.wait > 3) {
        st.pos.y = 3; st.carPos.y = 3; st.ready = true; onReady?.();
      } else {
        if (player.current) player.current.visible = false;
        if (car.current) car.current.visible = false;
        placeOverviewCamera(camera, parent, up, st.pos.x, st.pos.z);
        return;
      }
    }
    if (car.current) car.current.visible = true;

    st.overlapping = false;
    const ax = moveAxis();
    _fwd.set(Math.sin(st.camYaw), 0, Math.cos(st.camYaw));
    _right.set(_fwd.z, 0, -_fwd.x);

    if (st.mode === "foot") {
      if (player.current) player.current.visible = view === "third";
      _dir.set(0, 0, 0).addScaledVector(_fwd, ax.y).addScaledVector(_right, ax.x);
      const speed = isDown("ShiftLeft") || isDown("ShiftRight") ? 9 : 4.5;
      if (_dir.lengthSq() > 1e-4) {
        _dir.normalize();
        const moveDist = speed * step;
        const probe = tileCollision.sampleWall(
          "player-wall",
          now,
          () => forwardHit(parent, group, ray, _probe.copy(st.pos).setY(st.pos.y + 1.1), _dir, moveDist + 0.6),
          { priority: true },
        );
        const allowed = Math.min(moveDist, Math.max(0, probe - 0.6));
        st.pos.addScaledVector(_dir, allowed);
        st.heading = Math.atan2(_dir.x, _dir.z);
        st.moving = allowed > 0.001;
        st.speed = st.moving ? speed : 0;
      } else {
        st.moving = false;
        st.speed = 0;
      }

      const gy = tileCollision.sampleGround("player-ground", now, () => groundY(parent, group, ray, st.pos.x, st.pos.z, up), { priority: true });
      if (gy !== null) st.pos.y = gy;

      for (const c of playState.cars) {
        const d = planar(st.pos, c.pos);
        if (d > 1e-3 && d < 1.6) {
          st.overlapping = true;
          st.pos.addScaledVector(awayInto(_away, st.pos, c.pos), 1.6 - d);
        }
      }
      knockPeds(st.pos, 0.9);

      if (consumeTap("KeyF")) {
        _fwd.set(Math.sin(st.heading), 0, Math.cos(st.heading));
        let best: Body | null = null;
        let bestD = 2.0;
        for (const p of playState.peds) {
          const dx = p.pos.x - st.pos.x, dz = p.pos.z - st.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d < bestD && (dx * _fwd.x + dz * _fwd.z) / d > 0.25) { best = p; bestD = d; }
        }
        if (best) { best.hit += 1; best.push.addScaledVector(awayInto(_away, best.pos, st.pos), 1.0); }
      }

      player.current!.position.copy(st.pos);
      player.current!.rotation.y = st.heading;
      car.current!.position.copy(st.carPos);
      car.current!.rotation.y = st.carYaw;
      if (consumeTap("KeyE") && planar(st.pos, st.carPos) < 5.5) st.mode = "car";

      st.camYaw = lerpAngle(st.camYaw, st.heading, 1 - Math.exp(-step * 3));
      if (view === "third") followCam(camera, parent, up, st.pos, st.camYaw, 7, 4, 1 - Math.exp(-step * 6));
      else firstPerson(camera, parent, up, st.pos, st.heading, 1.7);
    } else {
      if (player.current) player.current.visible = false;
      st.moving = false;
      st.carSpeed = THREE.MathUtils.lerp(st.carSpeed, ax.y * 22, 1 - Math.exp(-step * 2.5));
      if (Math.abs(st.carSpeed) > 0.5) st.carYaw -= ax.x * 1.3 * step * Math.sign(st.carSpeed);
      _fwd.set(Math.sin(st.carYaw), 0, Math.cos(st.carYaw));

      const moveDist = st.carSpeed * step;
      if (Math.abs(moveDist) > 1e-3) {
        _dir.copy(_fwd).multiplyScalar(Math.sign(st.carSpeed));
        const probe = tileCollision.sampleWall(
          "player-wall",
          now,
          () => forwardHit(parent, group, ray, _probe.copy(st.carPos).setY(st.carPos.y + 1.0), _dir, Math.abs(moveDist) + 2.6),
          { priority: true },
        );
        if (probe < Math.abs(moveDist) + 2.6) st.carSpeed = 0;
        else st.carPos.addScaledVector(_fwd, moveDist);
      }
      const gy = tileCollision.sampleGround("player-ground", now, () => groundY(parent, group, ray, st.carPos.x, st.carPos.z, up), { priority: true });
      if (gy !== null) st.carPos.y = gy;

      for (const c of playState.cars) {
        const d = planar(st.carPos, c.pos);
        if (d > 1e-3 && d < 3.4) {
          st.overlapping = true;
          awayInto(_away, c.pos, st.carPos);
          c.push.addScaledVector(_away, 3.4 - d);
          st.carPos.addScaledVector(_away, -(3.4 - d) * 0.5);
          st.carSpeed *= -0.25;
          playState.bump = 1;
        }
      }
      knockPeds(st.carPos, 1.9);

      car.current!.position.copy(st.carPos);
      car.current!.rotation.y = st.carYaw;
      st.pos.copy(st.carPos);
      if (consumeTap("KeyE")) {
        st.mode = "foot";
        _right.set(_fwd.z, 0, -_fwd.x);
        st.pos.set(st.carPos.x + _right.x * 3, st.carPos.y, st.carPos.z + _right.z * 3);
        st.carSpeed = 0;
      }
      st.camYaw = lerpAngle(st.camYaw, st.carYaw, 1 - Math.exp(-step * 3));
      if (view === "third") followCam(camera, parent, up, st.carPos, st.camYaw, 11, 5, 1 - Math.exp(-step * 5));
      else {
        _seat.copy(st.carPos).addScaledVector(_fwd, 0.2);
        firstPerson(camera, parent, up, _seat, st.carYaw, 1.6);
      }
      st.speed = Math.abs(st.carSpeed);
    }

    const origin = st.mode === "car" ? st.carPos : st.pos;
    const latch = contactLatch(st.bumpLatch, st.overlapping);
    st.bumpLatch = latch.latched;
    if (latch.hit) st.health = applyContactDamage(st.health, 1);
    if (playState.bump && !latch.latched) playState.bump = 0;

    playState.player.driving = st.mode === "car";
    playState.player.heading = st.mode === "car" ? st.carYaw : st.heading;
    playState.player.health = st.health;
    playState.player.nearCar = st.mode === "foot" && planar(st.pos, st.carPos) < 5.5;
    playState.player.pedInReach = st.mode === "foot" && pedAhead(st.pos, st.heading);
    playState.player.pos.copy(origin);
  });

  const lights = weather === "rain";
  return (
    <>
      <group ref={player}>
        <Character
          moving={() => s.current.moving}
          pace={() => gaitFor(s.current.speed, s.current.moving)}
          shirt="#2f5fae"
          pants="#23262e"
        />
      </group>
      <group ref={car}>
        <Vehicle
          type="mustang"
          color="#b81d24"
          lights={lights}
          brake={() => s.current.mode === "car" && (isDown("KeyS") || isDown("ArrowDown") || isDown("Space"))}
        />
      </group>
    </>
  );
}

function knockPeds(center: THREE.Vector3, r: number) {
  for (const p of playState.peds) {
    const d = planar(center, p.pos);
    if (d > 1e-3 && d < r) p.push.addScaledVector(awayInto(_away, p.pos, center), r - d + 0.05);
  }
}

// ---------------------------------------------------------------------------
// NPCs: pedestrians + traffic on the real roads, with contact knockback.

interface Route { pts: THREE.Vector3[]; total: number }

export function TileNpcs({ slice, center, weather = "clear" }: { slice: Slice; center: [number, number]; weather?: Weather }) {
  const tiles = useContext(TilesRendererContext);

  const routes = useMemo<Route[]>(() => {
    const out: Route[] = [];
    for (const r of slice.roads) {
      if (!DRIVABLE.has(r.highway) || r.points.length < 2) continue;
      const pts = r.points.map(([e, n]) => new THREE.Vector3(e, 0, -n));
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) total += pts[i].distanceTo(pts[i + 1]);
      if (total > 12) out.push({ pts, total });
    }
    return out;
  }, [slice]);

  const pedRefs = useRef<(THREE.Group | null)[]>([]);
  const carRefs = useRef<(THREE.Group | null)[]>([]);
  const peds = useRef(
    Array.from({ length: 6 }, (_, i) => {
      const look = pedLook(i);
      return {
        ...look,
        pos: rand(center, 30), goal: rand(center, 30), heading: 0, y: 0,
        down: 0, dead: false,
        body: { pos: new THREE.Vector3(), push: new THREE.Vector3(), hit: 0 } as Body,
      };
    }),
  );
  const cars = useRef(
    Array.from({ length: 3 }, (_, i) => {
      const look = trafficLook(i);
      return {
        route: routes.length ? i % routes.length : 0,
        fwd: i % 2 === 0, dist: 0, y: 0, heading: 0,
        offset: new THREE.Vector3(), color: look.color, vtype: look.type,
        body: { pos: new THREE.Vector3(), push: new THREE.Vector3(), hit: 0 } as Body,
      };
    }),
  );

  useEffect(() => {
    playState.peds = peds.current.map((p) => p.body);
    playState.cars = cars.current.map((c) => c.body);
    return () => { resetBodies(); tileCollision.clear(); };
  }, []);

  useFrame((state, dt) => {
    const parent = (pedRefs.current[0] || carRefs.current[0])?.parent;
    if (!parent) return;
    const now = state.clock.elapsedTime;
    tileCollision.beginFrame(now);
    const step = Math.min(dt, 0.05);
    parent.updateWorldMatrix(true, false);
    const up = frameUp(parent);
    const group = tiles?.group;
    const ray = tileCollision.ray;

    peds.current.forEach((p, i) => {
      const g = pedRefs.current[i];
      if (!g) return;

      if (p.body.hit > 0) {
        if (p.dead) { /* already down for good */ }
        else if (p.down > 0) p.dead = true;
        else p.down = 4;
        p.body.hit = 0;
      }
      if (p.dead || p.down > 0) {
        if (p.down > 0) p.down -= step;
        g.position.set(p.pos.x, p.y, p.pos.z);
        g.rotation.set(Math.PI / 2, p.heading, 0);
        p.body.pos.set(p.pos.x, p.y, p.pos.z);
        return;
      }

      if (p.body.push.lengthSq() > 0) { p.pos.add(p.body.push); p.body.push.set(0, 0, 0); }
      _to.set(p.goal.x - p.pos.x, 0, p.goal.z - p.pos.z);
      if (_to.length() < 0.6) p.goal = rand(center, 30);
      else { _to.normalize(); p.pos.addScaledVector(_to, 1.4 * step); p.heading = Math.atan2(_to.x, _to.z); }
      const gy = tileCollision.sampleGround(
        `ped${i}`,
        now,
        () => groundY(parent, group, ray, p.pos.x, p.pos.z, up),
        { priority: false, interval: NPC_GROUND_INTERVAL_S },
      );
      if (gy !== null) p.y = gy;
      g.position.set(p.pos.x, p.y, p.pos.z);
      g.rotation.set(0, p.heading, 0);
      p.body.pos.set(p.pos.x, p.y, p.pos.z);
    });

    if (routes.length) {
      cars.current.forEach((c, i) => {
        const g = carRefs.current[i];
        if (!g) return;
        const route = routes[c.route % routes.length];
        c.dist += 9 * step;
        if (c.dist >= route.total) { c.fwd = !c.fwd; c.dist = 0; c.route = (c.route + 1) % routes.length; }
        const along = c.fwd ? c.dist : route.total - c.dist;
        sampleRoute(route.pts, route.total, along, _point, _routeDir);
        if (c.body.push.lengthSq() > 0) { c.offset.add(c.body.push); c.body.push.set(0, 0, 0); }
        c.offset.multiplyScalar(0.9);
        const px = _point.x + c.offset.x, pz = _point.z + c.offset.z;
        const gy = tileCollision.sampleGround(
          `car${i}`,
          now,
          () => groundY(parent, group, ray, px, pz, up),
          { priority: false, interval: NPC_GROUND_INTERVAL_S },
        );
        if (gy !== null) c.y = gy;
        c.heading = Math.atan2(_routeDir.x, _routeDir.z) + (c.fwd ? 0 : Math.PI);
        g.position.set(px, c.y, pz);
        g.rotation.y = c.heading;
        c.body.pos.set(px, c.y, pz);
      });
    }
  });

  const lights = weather === "rain";
  return (
    <group>
      {peds.current.map((p, i) => (
        <group key={`p${i}`} ref={(el) => (pedRefs.current[i] = el)} scale={[p.build, p.scale, p.build]}>
          <Character
            shirt={p.shirt}
            pants={p.pants}
            skin={p.skin}
            hair={p.hair}
            hat={p.hat}
            pace={() => (p.dead || p.down > 0 ? "idle" : "walk")}
          />
        </group>
      ))}
      {cars.current.map((c, i) => (
        <group key={`c${i}`} ref={(el) => (carRefs.current[i] = el)}>
          <Vehicle type={c.vtype} color={c.color} lights={lights} />
        </group>
      ))}
    </group>
  );
}

function rand(center: [number, number], r: number) {
  return new THREE.Vector3(center[0] + (Math.random() * 2 - 1) * r, 0, center[1] + (Math.random() * 2 - 1) * r);
}
