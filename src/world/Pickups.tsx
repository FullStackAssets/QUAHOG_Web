import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame, useToasts } from "../store";
import { useStats } from "../game";
import { sfx } from "../audio/sfx";

// Collectible cash drops (§17/§23): glowing coins left by downed pedestrians.
// Walk or drive over one to grab it. Instanced + pooled, drained from
// shared.pickups (filled by StreetLife on a kill).

const MAX = 48;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export function Pickups() {
  const ref = useRef<THREE.InstancedMesh>(null);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (useGame.getState().paused) return;
    const body = useGame.getState().mode === "car" ? shared.car : shared.player;
    const t = body?.translation();
    const list = shared.pickups;

    // collect anything we're standing/driving on
    if (t) {
      for (let i = list.length - 1; i >= 0; i--) {
        const pk = list[i];
        if (Math.hypot(t.x - pk.pos.x, t.z - pk.pos.z) < 2.3) {
          useStats.getState().addCash(pk.value);
          sfx.cash();
          useToasts.getState().push(`+$${pk.value}`, "#7CFC00");
          list.splice(i, 1);
        }
      }
    }

    const n = Math.min(list.length, MAX);
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const pk = list[i];
      pk.spin += dt * 3;
      pk.pos.y = 0.7 + Math.sin(now * 0.004 + i) * 0.15;
      _e.set(Math.PI / 2, pk.spin, 0); // stand the coin up and spin it
      _q.setFromEuler(_e);
      _m.compose(_p.copy(pk.pos), _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <cylinderGeometry args={[0.4, 0.4, 0.08, 14]} />
      <meshStandardMaterial color="#ffd24a" emissive="#caa11e" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
    </instancedMesh>
  );
}
