import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import type { Road } from "../slice";
import { layoutPuddles } from "./puddleLayout";

/** Rain-only reflective depressions, not simulated water or screen-space SSR.
 * One instanced draw call, strictly capped by mobile quality. No collision. */
export function RoadPuddles({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const rainy = useGame((s) => s.weather === "rain");
  const quality = useGame((s) => s.quality);
  const spots = useMemo(() => layoutPuddles(roads, center, [22, 52, 96][quality]), [roads, center, quality]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    spots.forEach((p, i) => {
      dummy.position.set(p.x, 0.077, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, p.angle, "XYZ");
      dummy.scale.set(p.rx, p.rz, 1);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots, rainy]);
  if (!rainy || !spots.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow={false} receiveShadow={false}>
      <circleGeometry args={[1, 20]} />
      <meshStandardMaterial color="#738998" metalness={0.42} roughness={0.16} envMapIntensity={1.45}
        transparent opacity={0.56} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
    </instancedMesh>
  );
}
