import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Wheeling harbor gulls (§7) — instanced, circling over the waterfront. Cheap
// life in the sky; bloom-free, just simple winged sprites.
const N = 40;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export function Gulls() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const birds = useMemo(() =>
    Array.from({ length: N }, (_, i) => ({
      cx: i < 8 ? 60 : 40, cz: i < 8 ? -20 : 240, // harbor + Palmer's Island
      r: 18 + Math.random() * 40, h: 22 + Math.random() * 22,
      sp: 0.15 + Math.random() * 0.2, ph: Math.random() * Math.PI * 2, dir: Math.random() < 0.5 ? 1 : -1,
    })), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    birds.forEach((b, i) => {
      const a = b.ph + t * b.sp * b.dir;
      const x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r;
      const y = b.h + Math.sin(t * 1.5 + b.ph) * 1.5;
      _e.set(Math.sin(t * 6 + i) * 0.4, a + (b.dir > 0 ? Math.PI / 2 : -Math.PI / 2), 0); // banking + flap
      _q.setFromEuler(_e);
      _m.compose(_p.set(x, y, z), _q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <coneGeometry args={[1.2, 0.3, 3]} />
      <meshStandardMaterial color="#e8e8ec" roughness={0.8} />
    </instancedMesh>
  );
}
