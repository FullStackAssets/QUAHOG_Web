import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Vehicle } from "../earth/Vehicles";
import { shared, type Cop } from "../shared";
import { useStats } from "../game";
import { useGame } from "../store";
import { sfx } from "../audio/sfx";
import { POLICE_STATION } from "../places";
import { sim } from "../sim";
import { ChaseController, type ChaseUnit } from "../sim/ChaseController";
import { desiredCops, heatTier } from "../sim/HeatTiers";
import { flag } from "../flags";

// Police pursuit (§14): road-snapped chase via ChaseController + RoadGraph.
// Cops spawn on the road ring, home along Dijkstra routes, and can arrest on foot.

const MAX_COPS = 3;
const SPAWN_DIST = 120;
const GIVEUP_DIST = 170;
const GIVEUP_TIME = 6;
const ARREST_DIST = 3.6;
const ARREST_GRACE = 5;
const COP_HP = 3;
const DIRECT_SPEED = 12.5;

interface Unit {
  active: boolean;
  chase: ChaseUnit | null;
  hp: number;
  deadT: number;
  arrest: number;
  far: number;
  car: Cop;
}

/** §13.3 soft-fail: direct ring spawn when RoadGraph is unavailable. */
function spawnDirect(target: { x: number; z: number }): ChaseUnit {
  const ang = Math.random() * Math.PI * 2;
  return {
    x: target.x + Math.cos(ang) * SPAWN_DIST,
    z: target.z + Math.sin(ang) * SPAWN_DIST,
    yaw: 0,
    path: [],
    cursor: 0,
    repathIn: 0,
  };
}

function stepDirect(unit: ChaseUnit, dt: number, target: { x: number; z: number }): number {
  const dx = target.x - unit.x;
  const dz = target.z - unit.z;
  const d = Math.hypot(dx, dz) || 1;
  const step = Math.min(d, DIRECT_SPEED * dt);
  unit.x += (dx / d) * step;
  unit.z += (dz / d) * step;
  unit.yaw = Math.atan2(dx, dz);
  return d;
}

export function Police() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const lightL = useRef<(THREE.Mesh | null)[]>([]);
  const lightR = useRef<(THREE.Mesh | null)[]>([]);
  const chase = useRef<ChaseController | null>(null);
  const units = useRef<Unit[]>(
    Array.from({ length: MAX_COPS }, () => ({
      active: false,
      chase: null,
      hp: COP_HP,
      deadT: 0,
      arrest: 0,
      far: 0,
      car: { pos: new THREE.Vector3(9999, 0, 9999), dmg: 0, dead: true } as Cop,
    })),
  );

  useEffect(() => {
    shared.cops = units.current.map((u) => u.car);
    return () => { shared.cops = []; };
  }, []);

  useFrame((_, dt) => {
    const game = useGame.getState();
    if (game.paused || game.down) { sfx.siren(false); return; }
    const stats = useStats.getState();
    const police = stats.police;
    const focus =
      game.mode === "car" ? shared.car : game.mode === "boat" ? shared.boat : shared.player;
    const targetBody = focus?.translation();
    const target = targetBody ? { x: targetBody.x, z: targetBody.z } : null;

    if (sim.graph) {
      if (!chase.current) chase.current = new ChaseController(sim.graph, { spawnRadius: SPAWN_DIST });
      else chase.current.setGraph(sim.graph);
    } else {
      chase.current = null; // fall back to direct chase below
    }

    const tier = heatTier(police);
    const desired = desiredCops(police, MAX_COPS);
    // Helicopter tier is gated by feature flag until the unit is authored.
    void (tier.helicopter && flag("helicopter"));
    let activeCount = units.current.filter((u) => u.active && u.hp > 0).length;
    sfx.siren(activeCount > 0);

    // Soft LOD: under frame pressure, skip inactive spawn work first.
    const budget = sim.budget.remainingMs();
    const allowSpawn = budget > 1.5;

    units.current.forEach((u, i) => {
      const g = refs.current[i];
      if (!g) return;

      if (u.hp <= 0) {
        u.deadT -= dt;
        u.car.dead = true;
        g.visible = u.deadT > 0;
        if (u.deadT <= 0) { u.active = false; u.chase = null; }
        return;
      }

      if (!u.active && activeCount < desired && target && allowSpawn) {
        const spawned = chase.current ? chase.current.spawnNear(target) : spawnDirect(target);
        if (spawned) {
          u.chase = spawned;
          u.active = true;
          u.hp = COP_HP;
          u.arrest = 0;
          u.far = 0;
          u.car.dead = false;
          u.car.dmg = 0;
          activeCount++;
        }
      }
      if (u.active && activeCount > desired && u.arrest < 0.01) {
        u.active = false; u.chase = null; u.car.dead = true; g.visible = false; activeCount--;
        return;
      }
      if (!u.active || !target || !u.chase) { g.visible = false; return; }

      if (u.car.dmg > 0) {
        u.hp -= u.car.dmg;
        u.car.dmg = 0;
        if (u.hp <= 0) { u.deadT = 1.2; stats.addCash(75); stats.heat(-0.4, 0); }
      }

      // Graph chase when available; otherwise reduced direct pursuit (no crash).
      const d = chase.current
        ? chase.current.step(u.chase, dt, target)
        : stepDirect(u.chase, dt, target);

      u.car.pos.set(u.chase.x, 0, u.chase.z);
      g.visible = true;
      g.position.set(u.chase.x, 0, u.chase.z);
      g.rotation.y = u.chase.yaw;

      if (d > GIVEUP_DIST) {
        u.far += dt;
        if (u.far > GIVEUP_TIME) {
          u.active = false; u.chase = null; u.car.dead = true; g.visible = false; activeCount--;
          return;
        }
      } else u.far = 0;

      if (d < ARREST_DIST && game.mode === "foot") {
        u.arrest += dt;
        if (u.arrest > ARREST_GRACE && !useGame.getState().down) {
          useGame.getState().setDown("busted");
          sfx.bust();
        }
      } else {
        u.arrest = Math.max(0, u.arrest - dt * 1.5);
      }

      const phase = Math.sin(performance.now() * 0.012 + i) > 0;
      if (lightL.current[i]) (lightL.current[i]!.material as THREE.MeshStandardMaterial).emissiveIntensity = phase ? 3 : 0.1;
      if (lightR.current[i]) (lightR.current[i]!.material as THREE.MeshStandardMaterial).emissiveIntensity = phase ? 0.1 : 3;
    });
  });

  return (
    <group>
      <group position={POLICE_STATION}>
        <mesh position={[0, 9, 0]}>
          <sphereGeometry args={[0.6, 10, 10]} />
          <meshStandardMaterial color="#2a5aff" emissive="#2a5aff" emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[0, 4.5, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 9, 6]} />
          <meshStandardMaterial color="#2a3550" />
        </mesh>
      </group>

      {units.current.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
          <Vehicle type="infiniti" color="#1a2a55" />
          <mesh ref={(el) => (lightL.current[i] = el)} position={[-0.28, 1.7, -0.1]}>
            <boxGeometry args={[0.3, 0.14, 0.3]} />
            <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={2} />
          </mesh>
          <mesh ref={(el) => (lightR.current[i] = el)} position={[0.28, 1.7, -0.1]}>
            <boxGeometry args={[0.3, 0.14, 0.3]} />
            <meshStandardMaterial color="#2a5aff" emissive="#2a5aff" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
