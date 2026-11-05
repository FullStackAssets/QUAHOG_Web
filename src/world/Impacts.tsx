import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";

// Impact bursts (§23): small pooled particles spawned at melee/gun hit points
// (shared.impacts), thrown outward with gravity and faded out. One instanced
// mesh keeps it cheap.

const COUNT = 120;
const PER_BURST = 10;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

interface P { pos: THREE.Vector3; vel: THREE.Vector3; life: number; color: THREE.Color }

export function Impacts() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const next = useRef(0);
  const pool = useMemo<P[]>(
    () => Array.from({ length: COUNT }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, color: new THREE.Color() })),
    [],
  );

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;

    // spawn from queued impacts
    while (shared.impacts.length) {
      const im = shared.impacts.shift()!;
      const col = new THREE.Color(im.color);
      for (let k = 0; k < PER_BURST; k++) {
        const p = pool[next.current];
        next.current = (next.current + 1) % COUNT;
        p.pos.copy(im.pos);
        p.vel.set((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
        p.life = 0.5 + Math.random() * 0.3;
        p.color.copy(col);
      }
    }

    // integrate + write matrices
    let needsColor = false;
    for (let i = 0; i < COUNT; i++) {
      const p = pool[i];
      if (p.life <= 0) { mesh.setMatrixAt(i, HIDDEN); continue; }
      p.life -= dt;
      p.vel.y -= 9.8 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const sc = Math.max(0, p.life) * 0.28;
      _m.compose(_p.copy(p.pos), _q, _s.setScalar(sc));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, p.color);
      needsColor = true;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (needsColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
