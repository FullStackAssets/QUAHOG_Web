import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";

// Tire skid marks (§13): a ring-buffer of flat dark quads dropped under the car
// while it corners hard at speed (shared.skid). Cheap, instanced, fades the
// oldest marks as the pool wraps.

const MAX = 400;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _flat = new THREE.Euler(-Math.PI / 2, 0, 0);
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export function SkidMarks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const next = useRef(0);
  const drop = useRef(0);
  const last = useMemo(() => new THREE.Vector2(), []);

  // start with every slot collapsed to zero so empty marks aren't drawn at origin
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, HIDDEN);
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!shared.skid || !shared.car) return;
    drop.current += dt;
    if (drop.current < 0.03) return; // ~33 marks/sec max
    drop.current = 0;

    const p = shared.car.translation();
    if (last.x === 0 && last.y === 0) last.set(p.x, p.z);
    const yaw = shared.carYaw;
    // two rear contact patches, offset left/right of the car's centerline
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    _q.setFromEuler(new THREE.Euler(_flat.x, yaw, 0, "YXZ"));
    for (const side of [-0.7, 0.7]) {
      _pos.set(p.x + rx * side, 0.07, p.z + rz * side);
      _scl.set(0.35, 1.1, 1);
      _m.compose(_pos, _q, _scl);
      mesh.setMatrixAt(next.current, _m);
      next.current = (next.current + 1) % MAX;
    }
    mesh.instanceMatrix.needsUpdate = true;
    last.set(p.x, p.z);
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#0d0d0f" transparent opacity={0.5} depthWrite={false} />
    </instancedMesh>
  );
}
