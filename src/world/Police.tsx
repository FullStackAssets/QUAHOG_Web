import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Vehicle } from "../earth/Vehicles";
import { shared, type Cop } from "../shared";
import { useStats } from "../game";
import { useGame } from "../store";
import { sfx } from "../audio/sfx";
import { POLICE_STATION } from "../places";

// Police pursuit (§14): cop cars spawn a few streets away as the police-heat
// axis climbs and home in — slow enough to outrun in a car and lose on foot.
// They show on the map. Being cornered (right on top) for a 5s grace = busted.
// Cops can be shot (gun queues cop.dmg).

const MAX_COPS = 3;
const SPEED = 12.5;       // m/s — a car easily outruns this
const SPAWN_DIST = 120;   // appear a few streets away (visible on the map)
const GIVEUP_DIST = 170;  // beyond this for GIVEUP_TIME and they lose you
const GIVEUP_TIME = 6;
const ARREST_DIST = 3.6;  // must be right on top to make the arrest
const ARREST_GRACE = 5;   // seconds on top before busted
const COP_HP = 3;

interface Unit {
  active: boolean;
  pos: THREE.Vector3;
  yaw: number;
  hp: number;
  deadT: number;
  arrest: number;
  far: number; // seconds spent beyond GIVEUP_DIST
  car: Cop;
}

export function Police() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const lightL = useRef<(THREE.Mesh | null)[]>([]);
  const lightR = useRef<(THREE.Mesh | null)[]>([]);
  const units = useRef<Unit[]>(
    Array.from({ length: MAX_COPS }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      yaw: 0,
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
    const target = (game.mode === "car" ? shared.car : shared.player)?.translation();

    // chase only at 3+ stars, and fewer units than the star count
    const desired = police >= 3 ? Math.min(MAX_COPS, Math.floor(police) - 1) : 0;
    let activeCount = units.current.filter((u) => u.active && u.hp > 0).length;
    sfx.siren(activeCount > 0);

    units.current.forEach((u, i) => {
      const g = refs.current[i];
      if (!g) return;

      // dead → fade out, then free the slot
      if (u.hp <= 0) {
        u.deadT -= dt;
        u.car.dead = true;
        g.visible = u.deadT > 0;
        if (u.deadT <= 0) u.active = false;
        return;
      }

      // spawn a few streets out (never on top of the player)
      if (!u.active && activeCount < desired && target) {
        const a = Math.random() * Math.PI * 2;
        u.pos.set(target.x + Math.cos(a) * SPAWN_DIST, 0, target.z + Math.sin(a) * SPAWN_DIST);
        u.active = true; u.hp = COP_HP; u.arrest = 0; u.far = 0; u.car.dead = false; u.car.dmg = 0;
        activeCount++;
      }
      if (u.active && activeCount > desired && u.arrest < 0.01) {
        u.active = false; u.car.dead = true; g.visible = false; activeCount--;
        return;
      }
      if (!u.active || !target) { g.visible = false; return; }

      // apply queued gun damage
      if (u.car.dmg > 0) { u.hp -= u.car.dmg; u.car.dmg = 0; if (u.hp <= 0) { u.deadT = 1.2; stats.addCash(75); stats.heat(-0.4, 0); } }

      // home toward the player
      const dx = target.x - u.pos.x, dz = target.z - u.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      u.pos.x += (dx / d) * SPEED * dt;
      u.pos.z += (dz / d) * SPEED * dt;
      u.yaw = Math.atan2(dx, dz);
      u.car.pos.copy(u.pos);

      g.visible = true;
      g.position.copy(u.pos);
      g.rotation.y = u.yaw;

      // lose them if you break away for long enough
      if (d > GIVEUP_DIST) { u.far += dt; if (u.far > GIVEUP_TIME) { u.active = false; u.car.dead = true; g.visible = false; activeCount--; return; } }
      else u.far = 0;

      // arrest only when right on top, on foot, for the full grace period
      if (d < ARREST_DIST && game.mode === "foot") {
        u.arrest += dt;
        if (u.arrest > ARREST_GRACE && !useGame.getState().down) { useGame.getState().setDown("busted"); sfx.bust(); }
      } else {
        u.arrest = Math.max(0, u.arrest - dt * 1.5);
      }

      // flashing lightbar
      const phase = Math.sin(performance.now() * 0.012 + i) > 0;
      if (lightL.current[i]) (lightL.current[i]!.material as THREE.MeshStandardMaterial).emissiveIntensity = phase ? 3 : 0.1;
      if (lightR.current[i]) (lightR.current[i]!.material as THREE.MeshStandardMaterial).emissiveIntensity = phase ? 0.1 : 3;
    });
  });

  return (
    <group>
      {/* police station beacon — marks the real downtown PD footprint */}
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
          {/* roof lightbar */}
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
