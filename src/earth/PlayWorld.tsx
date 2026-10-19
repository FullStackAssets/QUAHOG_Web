import { useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { TilesRendererContext } from "3d-tiles-renderer/r3f";
// Rigid primitive humanoid, NOT the skinned CesiumMan: at the photoreal tiles'
// earth-centered coordinates (~6.3M m from origin) GPU skinning shatters in
// float32, so the skinned model explodes into shards. Rigid meshes render
// camera-relative and stay crisp (same reason the car looks fine).
import { Character } from "../world/Character";
import { consumeTap, isDown, moveAxis } from "../input";
import { DRIVABLE, followCam, forwardHit, frameUp, groundY, lerpAngle } from "./follow";
import { playState, resetBodies, type Body } from "./playState";
import { Vehicle, VEHICLE_TYPES } from "./Vehicles";
import type { Slice } from "../slice";

export type View = "third" | "first";
export interface Spawn { x: number; z: number; heading: number }

const PED_COLORS = ["#c0563f", "#3f6cc0", "#4a8c52", "#b8a23a", "#7a4a8c"];
const PANTS = ["#2c2f3a", "#3a3326", "#23344f", "#4a4a4a"];
const SKINS = ["#caa07a", "#e0b48c", "#a87a52", "#8a5a36"];
const CAR_COLORS = ["#9c3a3a", "#2f6f7a", "#caa24a", "#3a5a9c", "#5a5a5a"];

const planar = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------------------------------------------------------------------
// Player: on foot + drivable car, wall-collided, with 1st/3rd-person views.

export function PlayerRig({ spawn, view, onReady }: { spawn: Spawn; view: View; onReady?: () => void }) {
  const camera = useThree((s) => s.camera);
  const tiles = useContext(TilesRendererContext);
  const player = useRef<THREE.Group>(null);
  const car = useRef<THREE.Group>(null);
  const ray = useRef(new THREE.Raycaster());
  const wall = useRef(new THREE.Raycaster());
  const s = useRef({
    mode: "foot" as "foot" | "car",
    ready: false,
    wait: 0,
    carSpeed: 0,
    pos: new THREE.Vector3(spawn.x, 0, spawn.z),
    heading: spawn.heading,
    camYaw: spawn.heading,
    moving: false,
    carPos: new THREE.Vector3(spawn.x + 5, 0, spawn.z),
    carYaw: spawn.heading,
  });

  useFrame((_, dt) => {
    const parent = player.current?.parent;
    if (!parent) return;
    const step = Math.min(dt, 0.05);
    parent.updateWorldMatrix(true, false);
    const up = frameUp(parent);
    const st = s.current;

    // spawn gating — hold until tiles exist under the spawn point
    if (!st.ready) {
      const gy = groundY(parent, tiles?.group, ray.current, st.pos.x, st.pos.z, up);
      st.wait += step;
      if (gy !== null) {
        st.pos.y = gy; st.carPos.y = gy; st.ready = true; onReady?.();
      } else if (st.wait > 3) {
        // tiles still haven't streamed a surface — don't strand the player in the
        // air; drop near sea level and let per-frame raycasts correct once tiles load
        st.pos.y = 3; st.carPos.y = 3; st.ready = true; onReady?.();
      } else {
        if (player.current) player.current.visible = false;
        if (car.current) car.current.visible = false;
        camera.up.copy(up);
        camera.position.copy(parent.localToWorld(new THREE.Vector3(st.pos.x, 90, st.pos.z + 1)));
        camera.lookAt(parent.localToWorld(new THREE.Vector3(st.pos.x, 0, st.pos.z)));
        return;
      }
    }
    if (car.current) car.current.visible = true;

    const ax = moveAxis();
    const fwd = new THREE.Vector3(Math.sin(st.camYaw), 0, Math.cos(st.camYaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);

    if (st.mode === "foot") {
      if (player.current) player.current.visible = view === "third";
      const dir = new THREE.Vector3().addScaledVector(fwd, ax.y).addScaledVector(right, ax.x);
      const speed = isDown("ShiftLeft") || isDown("ShiftRight") ? 9 : 4.5;
      if (dir.lengthSq() > 1e-4) {
        dir.normalize();
        const moveDist = speed * step;
        const probe = forwardHit(parent, tiles?.group, wall.current, st.pos.clone().setY(st.pos.y + 1.1), dir, moveDist + 0.6);
        const allowed = Math.min(moveDist, Math.max(0, probe - 0.6));
        st.pos.addScaledVector(dir, allowed);
        st.heading = Math.atan2(dir.x, dir.z);
        st.moving = allowed > 0.001;
      } else st.moving = false;

      const gy = groundY(parent, tiles?.group, ray.current, st.pos.x, st.pos.z, up);
      if (gy !== null) st.pos.y = gy;

      // pushed by passing NPC cars; push pedestrians out of the way
      for (const c of playState.cars) {
        const d = planar(st.pos, c.pos);
        if (d > 1e-3 && d < 1.6) st.pos.addScaledVector(awayXZ(st.pos, c.pos), 1.6 - d);
      }
      knockPeds(st.pos, 0.9);

      // melee: punch the nearest pedestrian in front (F)
      if (consumeTap("KeyF")) {
        const f = new THREE.Vector3(Math.sin(st.heading), 0, Math.cos(st.heading));
        let best: Body | null = null;
        let bestD = 2.0;
        for (const p of playState.peds) {
          const dx = p.pos.x - st.pos.x, dz = p.pos.z - st.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d < bestD && (dx * f.x + dz * f.z) / d > 0.25) { best = p; bestD = d; }
        }
        if (best) { best.hit += 1; best.push.addScaledVector(awayXZ(best.pos, st.pos), 1.0); }
      }

      player.current!.position.copy(st.pos);
      player.current!.rotation.y = st.heading;
      car.current!.position.copy(st.carPos);
      car.current!.rotation.y = st.carYaw;
      if (consumeTap("KeyE") && planar(st.pos, st.carPos) < 5.5) st.mode = "car";

      st.camYaw = lerpAngle(st.camYaw, st.heading, 1 - Math.exp(-step * 3));
      if (view === "third") followCam(camera, parent, up, st.pos, st.camYaw, 7, 4, 1 - Math.exp(-step * 6));
      else firstPerson(camera, parent, up, st.pos, st.heading, 1.7);
      playState.player.driving = false;
      playState.player.pos.copy(st.pos);
    } else {
      if (player.current) player.current.visible = false;
      st.carSpeed = THREE.MathUtils.lerp(st.carSpeed, ax.y * 22, 1 - Math.exp(-step * 2.5));
      if (Math.abs(st.carSpeed) > 0.5) st.carYaw -= ax.x * 1.3 * step * Math.sign(st.carSpeed);
      const cf = new THREE.Vector3(Math.sin(st.carYaw), 0, Math.cos(st.carYaw));

      const moveDist = st.carSpeed * step;
      if (Math.abs(moveDist) > 1e-3) {
        const pdir = cf.clone().multiplyScalar(Math.sign(st.carSpeed));
        const probe = forwardHit(parent, tiles?.group, wall.current, st.carPos.clone().setY(st.carPos.y + 1.0), pdir, Math.abs(moveDist) + 2.6);
        if (probe < Math.abs(moveDist) + 2.6) st.carSpeed = 0; // wall ahead
        else st.carPos.addScaledVector(cf, moveDist);
      }
      const gy = groundY(parent, tiles?.group, ray.current, st.carPos.x, st.carPos.z, up);
      if (gy !== null) st.carPos.y = gy;

      // bump other vehicles
      for (const c of playState.cars) {
        const d = planar(st.carPos, c.pos);
        if (d > 1e-3 && d < 3.4) {
          const away = awayXZ(c.pos, st.carPos);
          c.push.addScaledVector(away, 3.4 - d);
          st.carPos.addScaledVector(away, -(3.4 - d) * 0.5);
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
        const r = new THREE.Vector3(cf.z, 0, -cf.x);
        st.pos.set(st.carPos.x + r.x * 3, st.carPos.y, st.carPos.z + r.z * 3);
        st.carSpeed = 0;
      }
      st.camYaw = lerpAngle(st.camYaw, st.carYaw, 1 - Math.exp(-step * 3));
      if (view === "third") followCam(camera, parent, up, st.carPos, st.camYaw, 11, 5, 1 - Math.exp(-step * 5));
      else firstPerson(camera, parent, up, st.carPos.clone().addScaledVector(cf, 0.2), st.carYaw, 1.6);
      playState.player.driving = true;
      playState.player.pos.copy(st.carPos);
    }
  });

  return (
    <>
      <group ref={player}>
        <Character moving={() => s.current.moving} shirt="#2f5fae" pants="#23262e" />
      </group>
      <group ref={car}>
        <Vehicle type="mustang" color="#b81d24" />
      </group>
    </>
  );
}

function knockPeds(center: THREE.Vector3, r: number) {
  for (const p of playState.peds) {
    const d = planar(center, p.pos);
    if (d > 1e-3 && d < r) p.push.addScaledVector(awayXZ(p.pos, center), r - d + 0.05);
  }
}
function awayXZ(a: THREE.Vector3, b: THREE.Vector3) {
  const v = new THREE.Vector3(a.x - b.x, 0, a.z - b.z);
  return v.lengthSq() > 1e-6 ? v.normalize() : v.set(1, 0, 0);
}

function firstPerson(camera: THREE.Camera, parent: THREE.Object3D, up: THREE.Vector3, posLocal: THREE.Vector3, heading: number, eye: number) {
  const head = posLocal.clone().add(new THREE.Vector3(0, eye, 0));
  const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  camera.up.copy(up);
  camera.position.copy(parent.localToWorld(head.clone()));
  camera.lookAt(parent.localToWorld(head.clone().addScaledVector(f, 12)));
}

function CarMesh({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[2.0, 0.9, 4.2]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.4, -0.2]} castShadow>
        <boxGeometry args={[1.8, 0.7, 2.0]} />
        <meshStandardMaterial color="#0e3b4a" roughness={0.5} />
      </mesh>
      {[[-1, 0.3, 1.4], [1, 0.3, 1.4], [-1, 0.3, -1.4], [1, 0.3, -1.4]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.45, 0.45, 0.3, 12]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// NPCs: pedestrians + traffic on the real roads, with contact knockback.

interface Route { pts: THREE.Vector3[]; total: number }

export function TileNpcs({ slice, center }: { slice: Slice; center: [number, number] }) {
  const tiles = useContext(TilesRendererContext);
  const ray = useRef(new THREE.Raycaster());

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
    Array.from({ length: 6 }, () => ({
      pos: rand(center, 30), goal: rand(center, 30), heading: 0, y: 0, t: Math.random(),
      down: 0, dead: false,
      shirt: pick(PED_COLORS), pants: pick(PANTS), skin: pick(SKINS),
      body: { pos: new THREE.Vector3(), push: new THREE.Vector3(), hit: 0 } as Body,
    })),
  );
  const cars = useRef(
    Array.from({ length: 3 }, () => ({
      route: routes.length ? Math.floor(Math.random() * routes.length) : 0,
      fwd: Math.random() < 0.5, dist: 0, y: 0, t: Math.random(), heading: 0,
      offset: new THREE.Vector3(), color: pick(CAR_COLORS), vtype: pick(VEHICLE_TYPES),
      body: { pos: new THREE.Vector3(), push: new THREE.Vector3(), hit: 0 } as Body,
    })),
  );

  useEffect(() => {
    playState.peds = peds.current.map((p) => p.body);
    playState.cars = cars.current.map((c) => c.body);
    return () => resetBodies();
  }, []);

  useFrame((_, dt) => {
    const parent = (pedRefs.current[0] || carRefs.current[0])?.parent;
    if (!parent) return;
    const step = Math.min(dt, 0.05);
    parent.updateWorldMatrix(true, false);
    const up = frameUp(parent);

    peds.current.forEach((p, i) => {
      const g = pedRefs.current[i];
      if (!g) return;

      // resolve melee hits: first hit = knocked out, hit again = killed
      if (p.body.hit > 0) {
        if (p.dead) { /* already down for good */ }
        else if (p.down > 0) p.dead = true;
        else p.down = 4;
        p.body.hit = 0;
      }
      if (p.dead || p.down > 0) {
        if (p.down > 0) p.down -= step;
        g.position.set(p.pos.x, p.y, p.pos.z);
        g.rotation.set(Math.PI / 2, p.heading, 0); // lying on the ground
        p.body.pos.set(p.pos.x, p.y, p.pos.z);
        return;
      }

      if (p.body.push.lengthSq() > 0) { p.pos.add(p.body.push); p.body.push.set(0, 0, 0); }
      const to = new THREE.Vector3(p.goal.x - p.pos.x, 0, p.goal.z - p.pos.z);
      if (to.length() < 0.6) p.goal = rand(center, 30);
      else { to.normalize(); p.pos.addScaledVector(to, 1.4 * step); p.heading = Math.atan2(to.x, to.z); }
      p.t -= step;
      if (p.t <= 0 && tiles?.group) {
        p.t = 0.5 + Math.random() * 0.5;
        const gy = groundY(parent, tiles.group, ray.current, p.pos.x, p.pos.z, up);
        if (gy !== null) p.y = gy;
      }
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
        if (c.dist >= route.total) { c.fwd = !c.fwd; c.dist = 0; c.route = Math.floor(Math.random() * routes.length); }
        const along = c.fwd ? c.dist : route.total - c.dist;
        const { point, dir } = sampleAlong(routes[c.route % routes.length], along);
        if (c.body.push.lengthSq() > 0) { c.offset.add(c.body.push); c.body.push.set(0, 0, 0); }
        c.offset.multiplyScalar(0.9);
        const px = point.x + c.offset.x, pz = point.z + c.offset.z;
        c.t -= step;
        if (c.t <= 0 && tiles?.group) {
          c.t = 0.4 + Math.random() * 0.5;
          const gy = groundY(parent, tiles.group, ray.current, px, pz, up);
          if (gy !== null) c.y = gy;
        }
        c.heading = Math.atan2(dir.x, dir.z) + (c.fwd ? 0 : Math.PI);
        g.position.set(px, c.y, pz);
        g.rotation.y = c.heading;
        c.body.pos.set(px, c.y, pz);
      });
    }
  });

  return (
    <group>
      {peds.current.map((p, i) => (
        <group key={`p${i}`} ref={(el) => (pedRefs.current[i] = el)}>
          <Character shirt={p.shirt} pants={p.pants} skin={p.skin} moving={() => !p.dead && p.down <= 0} />
        </group>
      ))}
      {cars.current.map((c, i) => (
        <group key={`c${i}`} ref={(el) => (carRefs.current[i] = el)}>
          <CarMesh color={c.color} />
        </group>
      ))}
    </group>
  );
}

function rand(center: [number, number], r: number) {
  return new THREE.Vector3(center[0] + (Math.random() * 2 - 1) * r, 0, center[1] + (Math.random() * 2 - 1) * r);
}
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function sampleAlong(route: Route, d: number) {
  const pts = route.pts;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = pts[i].distanceTo(pts[i + 1]);
    if (acc + seg >= d || i === pts.length - 2) {
      const t = seg > 1e-4 ? THREE.MathUtils.clamp((d - acc) / seg, 0, 1) : 0;
      return {
        point: new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], t),
        dir: new THREE.Vector3().subVectors(pts[i + 1], pts[i]).normalize(),
      };
    }
    acc += seg;
  }
  return { point: pts[0].clone(), dir: new THREE.Vector3(0, 0, 1) };
}
