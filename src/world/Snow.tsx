import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGame } from "../store";
import { snowfallParticleCount } from "../weather/snowstorm";

// One camera-centered points draw call; quality caps avoid mobile overload.
const HALF_WIDTH = 42;
const HEIGHT = 65;
const FALL_RATE = 7;

export function Snow() {
  const weather = useGame((s) => s.weather);
  const quality = useGame((s) => s.quality);
  const count = snowfallParticleCount(quality);
  const { camera } = useThree();
  const points = useRef<THREE.Points>(null);
  const root = useRef<THREE.Group>(null);
  const { positions, geometry } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[3 * i] = (Math.random() - 0.5) * HALF_WIDTH * 2;
      positions[3 * i + 1] = Math.random() * HEIGHT;
      positions[3 * i + 2] = (Math.random() - 0.5) * HALF_WIDTH * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    return { positions, geometry };
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, dt) => {
    if (weather !== "snow" || useGame.getState().paused || !points.current || !root.current) return;
    root.current.position.set(camera.position.x, 0, camera.position.z);
    const d = Math.min(dt, 0.08);
    const wind = 2.5 + Math.sin(state.clock.elapsedTime * 0.32) * 1.5;
    for (let i = 0; i < count; i++) {
      const k = 3 * i;
      positions[k] += wind * d;
      positions[k + 1] -= FALL_RATE * d * (0.75 + (i % 5) * 0.1);
      positions[k + 2] += Math.sin(state.clock.elapsedTime + i * 0.7) * 0.45 * d;
      if (positions[k] > HALF_WIDTH) positions[k] -= HALF_WIDTH * 2;
      if (positions[k + 1] < 0) positions[k + 1] += HEIGHT;
      if (positions[k + 2] > HALF_WIDTH) positions[k + 2] -= HALF_WIDTH * 2;
      if (positions[k + 2] < -HALF_WIDTH) positions[k + 2] += HALF_WIDTH * 2;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  if (weather !== "snow") return null;
  return (
    <group ref={root}>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <pointsMaterial color="#f4f8fc" size={0.37} sizeAttenuation transparent
          opacity={0.9} depthWrite={false} />
      </points>
    </group>
  );
}
