import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ModelCharacter } from "./ModelCharacter";
import { Vehicle, VEHICLE_TYPES } from "../earth/Vehicles";
import { shared, raiseAlarm, addPickup, type Body, type TrafficCar } from "../shared";
import { useStats } from "../game";
import type { Road } from "../slice";
import { sim } from "../sim";
import { TrafficDirector, type TrafficAgent } from "../sim/TrafficDirector";
import { PedestrianAI, type PedAgent } from "../sim/PedestrianAI";
import { RoadGraph } from "../sim/RoadGraph";
import { carCount, pedCount } from "../quality";
import { useGame } from "../store";
import { CHARACTER_MODELS } from "../assets/modelRegistry";

// Ambient street life: wandering pedestrians (LOD + SpatialIndex) and traffic
// routed on the independent RoadGraph via TrafficDirector. Meshes stay kinematic
// so they never shove the player's physics car. Counts scale with graphics quality.

const PED_COLORS = ["#c0563f", "#3f6cc0", "#4a8c52", "#b8a23a", "#7a4a8c", "#c87a3f",
  "#b03a5a", "#2f8c7a", "#5a5a6a", "#d0863a", "#356a9c", "#8a4a3a", "#6a8a3a", "#a0a0a8"];
const CAR_COLORS = ["#9c3a3a", "#2f6f7a", "#caa24a", "#3a5a9c", "#5a5a5a", "#8c6a3a",
  "#5a1f1f", "#c9c2b4", "#3a2a22", "#1f3a2a", "#40506a", "#8a8f96", "#b56a3a", "#6a2a4a"];

const TMP = new THREE.Vector3();
const _dir = new THREE.Vector3();
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function StreetLife({
  roads,
  center = [0, 0],
}: {
  roads: Road[];
  center?: [number, number];
}) {
  const quality = useGame((s) => s.quality);
  const peds = pedCount(quality);
  const cars = carCount(quality);
  // Prefer the shared sim graph (built at slice bind); fall back to a local one.
  const graph = useMemo(() => sim.graph ?? RoadGraph.fromRoads(roads), [roads]);
  if (graph.nodeCount < 4) return null;
  return (
    <group>
      <Pedestrians center={center} count={peds} />
      <Traffic graph={graph} center={center} count={cars} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pedestrians — LOD wander + threat flee; SpatialIndex for melee queries.

function Pedestrians({ center, count }: { center: [number, number]; count: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const ai = useRef(new PedestrianAI());
  const agents = useRef<PedAgent[]>([]);
  const extras = useRef(
    Array.from({ length: count }, () => ({
      color: pick(PED_COLORS),
      scale: 0.9 + Math.random() * 0.28,
      modelUrl: pick(CHARACTER_MODELS).url,
      vel: new THREE.Vector3(),
      y: 0,
      tumble: 0,
      body: { pos: new THREE.Vector3(), push: new THREE.Vector3(), hit: 0 } as Body,
    })),
  );

  useEffect(() => {
    const pedAi = ai.current;
    pedAi.setCenter({ x: center[0], z: -center[1] });
    pedAi.setGraph(sim.pedGraph);
    extras.current = Array.from({ length: count }, () => ({
      color: pick(PED_COLORS),
      scale: 0.9 + Math.random() * 0.28,
      // Mix CesiumMan + Borden cast across the crowd.
      modelUrl: pick(CHARACTER_MODELS).url,
      vel: new THREE.Vector3(),
      y: 0,
      tumble: 0,
      body: { pos: new THREE.Vector3(), push: new THREE.Vector3(), hit: 0 } as Body,
    }));
    agents.current = Array.from({ length: count }, (_, id) => {
      const p = pedAi.randomInWander();
      const g = pedAi.randomInWander();
      const agent: PedAgent = {
        id,
        x: p.x,
        z: p.z,
        goalX: g.x,
        goalZ: g.z,
        heading: 0,
        down: 0,
        dead: false,
        path: null,
        pathCursor: 0,
      };
      pedAi.snapToGraph(agent);
      return agent;
    });
    pedAi.rebuildIndex(agents.current);
    for (let i = 0; i < count; i++) {
      extras.current[i].body.pos.set(agents.current[i].x, 0, agents.current[i].z);
    }
    shared.peds = extras.current.map((e) => e.body);
    return () => { shared.peds = []; };
  }, [center, count]);

  // §1.1: sidewalk AI advances on the fixed-step loop.
  useEffect(() => {
    return sim.loop.on("step", (dt) => {
      if (useGame.getState().paused) return;
      const pedAi = ai.current;
      const body = playerFocus();
      const player = { x: body?.x ?? center[0], z: body?.z ?? -center[1] };
      let flee: { x: number; z: number } | null = null;
      if (shared.alarm.t > 0) flee = { x: shared.alarm.pos.x, z: shared.alarm.pos.z };
      else if (shared.car && Math.abs(shared.carSpeed) > 10) {
        const c = shared.car.translation();
        flee = { x: c.x, z: c.z };
      }
      const budget = Math.max(0.5, sim.budget.remainingMs() * 0.45);
      pedAi.update(dt, player, agents.current, budget, flee);
    });
  }, [center]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);

    // Hit / ragdoll resolution stays every-frame (gameplay critical).
    agents.current.forEach((p, i) => {
      const g = refs.current[i];
      const ex = extras.current[i];
      if (!g) return;

      if (!p.dead && shared.car && Math.abs(shared.carSpeed) > 8) {
        const c = shared.car.translation();
        if (Math.hypot(c.x - p.x, c.z - p.z) < 2.3) {
          const fresh = p.down <= 0;
          ex.body.hit += 2;
          ex.body.push.set(p.x - c.x, 0, p.z - c.z);
          if (fresh) { useStats.getState().heat(0.6, 0.7); raiseAlarm(p.x, p.z, 5); }
        }
      }

      if (ex.body.hit > 0) {
        const hard = ex.body.hit > 1;
        if (ex.body.push.lengthSq() > 1e-4) _dir.copy(ex.body.push).setY(0).normalize();
        else _dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        ex.vel.set(_dir.x * (hard ? 9 : 3.5), hard ? 7 : 3, _dir.z * (hard ? 9 : 3.5));
        ex.tumble = 0.001;
        ex.body.push.set(0, 0, 0);
        const wasDead = p.dead;
        for (let h = ex.body.hit; h > 0 && !p.dead; h--) {
          if (p.down > 0) p.dead = true;
          else p.down = 4;
        }
        if (!wasDead && p.dead) addPickup(p.x, p.z, 20 + Math.floor(Math.random() * 60));
        ex.body.hit = 0;
      }

      if (p.dead || p.down > 0) {
        if (p.down > 0) p.down -= step;
        if (ex.tumble > 0 || ex.y > 0.001) {
          ex.vel.y -= 24 * step;
          p.x += ex.vel.x * step; p.z += ex.vel.z * step;
          ex.y += ex.vel.y * step;
          ex.vel.x *= 0.96; ex.vel.z *= 0.96;
          if (ex.y <= 0) { ex.y = 0; ex.vel.set(0, 0, 0); ex.tumble = 0; }
          else ex.tumble += step * 9;
          g.position.set(p.x, ex.y, p.z);
          g.rotation.set(Math.PI / 2 + Math.sin(ex.tumble) * 0.7, p.heading, Math.cos(ex.tumble) * 0.5);
        } else {
          g.position.set(p.x, 0, p.z);
          g.rotation.set(Math.PI / 2, p.heading, 0);
        }
        ex.body.pos.set(p.x, 0, p.z);
        return;
      }

      if (ex.body.push.lengthSq() > 0) {
        p.x += ex.body.push.x; p.z += ex.body.push.z;
        ex.body.push.set(0, 0, 0);
      }
    });

    // Mesh sync (render-rate).
    agents.current.forEach((p, i) => {
      const g = refs.current[i];
      const ex = extras.current[i];
      if (!g || p.dead || p.down > 0) return;
      g.position.set(p.x, 0, p.z);
      g.rotation.set(0, p.heading, 0);
      ex.body.pos.set(p.x, 0, p.z);
    });
  });

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} scale={extras.current[i]?.scale ?? 1}>
          <ModelCharacter
            url={extras.current[i]?.modelUrl}
            tint={extras.current[i]?.color ?? "#888"}
            moving={() => {
              const a = agents.current[i];
              return !!a && !a.dead && a.down <= 0;
            }}
          />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Traffic — RoadGraph-routed cars with stolen-slot respawn.

function Traffic({ graph, center, count }: { graph: RoadGraph; center: [number, number]; count: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const director = useRef(new TrafficDirector(graph));
  const agents = useRef<TrafficAgent[]>([]);
  const meta = useRef(
    Array.from({ length: count }, () => ({
      color: pick(CAR_COLORS),
      vtype: pick(VEHICLE_TYPES),
      braking: false,
      car: { pos: new THREE.Vector3(), yaw: 0, type: VEHICLE_TYPES[0], color: "#888", stop: 0, stolen: false } as TrafficCar,
    })),
  );

  useEffect(() => {
    director.current.setGraph(graph);
    const focus = { x: center[0], z: -center[1] };
    meta.current = Array.from({ length: count }, () => ({
      color: pick(CAR_COLORS),
      vtype: pick(VEHICLE_TYPES),
      braking: false,
      car: { pos: new THREE.Vector3(), yaw: 0, type: VEHICLE_TYPES[0], color: "#888", stop: 0, stolen: false } as TrafficCar,
    }));
    agents.current = director.current.spawnFleet(count, focus);
    while (agents.current.length < count) {
      const extra = director.current.spawnFleet(1, focus);
      if (!extra.length) break;
      extra[0].id = agents.current.length;
      agents.current.push(extra[0]);
    }
    for (let i = 0; i < agents.current.length; i++) {
      const a = agents.current[i];
      const m = meta.current[i];
      m.car.type = m.vtype;
      m.car.color = m.color;
      m.car.pos.set(a.x, 0, a.z);
      m.car.yaw = a.yaw;
      m.car.stolen = false;
      m.car.stop = 0;
    }
    shared.traffic = meta.current.slice(0, agents.current.length).map((m) => m.car);
    return () => { shared.traffic = []; };
  }, [graph, center, count]);

  useEffect(() => {
    return sim.loop.on("step", (dt) => {
      if (useGame.getState().paused) return;
      const focusBody = playerFocus();
      const player = { x: focusBody?.x ?? center[0], z: focusBody?.z ?? -center[1] };
      for (let i = 0; i < agents.current.length; i++) {
        const a = agents.current[i];
        const m = meta.current[i];
        if (m.car.stolen && !a.stolen) director.current.markStolen(a);
        if (m.car.stop > a.stop) a.stop = m.car.stop;
      }
      const budget = Math.max(0.8, sim.budget.remainingMs() * 0.5);
      director.current.update(dt, player, budget, agents.current);
    });
  }, [center]);

  useFrame(() => {
    agents.current.forEach((a, i) => {
      const g = refs.current[i];
      const m = meta.current[i];
      if (!g) return;

      if (a.stolen) {
        m.car.stolen = true;
        g.visible = false;
        return;
      }
      m.car.stolen = false;
      g.visible = true;

      // Yield / red light — gameplay critical, always evaluated.
      m.car.stop = a.stop;
      const pt = playerFocus();
      if (pt && Math.hypot(pt.x - a.x, pt.z - a.z) < 7) {
        m.braking = true;
        g.position.set(a.x, 0.4, a.z);
        g.rotation.y = a.yaw;
        m.car.pos.set(a.x, 0, a.z);
        m.car.yaw = a.yaw;
        return;
      }
      if (redAhead(a.x, a.z, a.yaw)) {
        m.braking = true;
        g.position.set(a.x, 0.4, a.z);
        g.rotation.y = a.yaw;
        m.car.pos.set(a.x, 0, a.z);
        m.car.yaw = a.yaw;
        return;
      }
      if (a.stop > 0) {
        m.braking = true;
        g.position.set(a.x, 0.4, a.z);
        g.rotation.y = a.yaw;
        m.car.pos.set(a.x, 0, a.z);
        m.car.yaw = a.yaw;
        return;
      }
      m.braking = false;
      g.position.set(a.x, 0.4, a.z);
      g.rotation.y = a.yaw;
      m.car.pos.set(a.x, 0, a.z);
      m.car.yaw = a.yaw;
    });
  });

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <Vehicle
            type={meta.current[i]?.vtype ?? VEHICLE_TYPES[0]}
            color={meta.current[i]?.color ?? "#888"}
            brake={() => meta.current[i]?.braking ?? false}
          />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

function playerFocus(): { x: number; z: number } | null {
  // Prefer the active body: when driving the player capsule is disabled.
  const car = shared.car;
  const pl = shared.player;
  if (car && pl && pl.isEnabled() === false) {
    const t = car.translation();
    return { x: t.x, z: t.z };
  }
  if (pl) {
    const t = pl.translation();
    return { x: t.x, z: t.z };
  }
  if (car) {
    const t = car.translation();
    return { x: t.x, z: t.z };
  }
  return null;
}

const STOP_DIST = 8;
function redAhead(x: number, z: number, heading: number) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  for (const zone of shared.stopZones) {
    if (!zone.red) continue;
    const dx = zone.x - x, dz = zone.z - z;
    const d = Math.hypot(dx, dz);
    if (d > STOP_DIST || d < 0.001) continue;
    if (fx * dx + fz * dz <= 0) continue;
    let da = (heading - zone.rot) % Math.PI;
    if (da > Math.PI / 2) da -= Math.PI;
    if (da < -Math.PI / 2) da += Math.PI;
    if (Math.abs(da) < 0.6) return true;
  }
  return false;
}

// Keep TMP referenced so tree-shaking doesn't drop the module-scope scratch.
void TMP;
