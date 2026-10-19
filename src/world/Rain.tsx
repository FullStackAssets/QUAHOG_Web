import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGame } from "../store";

// Coastal rain (§5): a block of falling streaks that follows the camera, plus a
// grey grade push handled in DayNight via shared weather. Toggle with R.

const COUNT = 1400;
const BOX = 60; // half-extent of the rain volume around the camera
const FALL = 38; // m/s

export function Rain() {
  const weather = useGame((s) => s.weather);
  const { camera } = useThree();
  const ref = useRef<THREE.LineSegments>(null);

  const { positions, geom } = useMemo(() => {
    const positions = new Float32Array(COUNT * 6); // a..b per streak
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() * 2 - 1) * BOX;
      const y = Math.random() * BOX * 2;
      const z = (Math.random() * 2 - 1) * BOX;
      positions[i * 6 + 0] = x; positions[i * 6 + 1] = y; positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x; positions[i * 6 + 4] = y + 0.9; positions[i * 6 + 5] = z;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { positions, geom };
  }, []);

  useFrame((_, dt) => {
    if (weather !== "rain" || !ref.current) return;
    const cam = camera.position;
    const arr = positions;
    for (let i = 0; i < COUNT; i++) {
      const o = i * 6;
      let y = arr[o + 1] - FALL * dt;
      if (y < 0) {
        // respawn at top, re-centered loosely on the camera
        arr[o + 0] = cam.x + (Math.random() * 2 - 1) * BOX;
        arr[o + 2] = cam.z + (Math.random() * 2 - 1) * BOX;
        y = BOX * 2;
        arr[o + 3] = arr[o + 0];
        arr[o + 5] = arr[o + 2];
      }
      arr[o + 1] = y;
      arr[o + 4] = y + 0.9;
    }
    geom.attributes.position.needsUpdate = true;
  });

  if (weather !== "rain") return null;
  return (
    <lineSegments ref={ref} geometry={geom} frustumCulled={false}>
      <lineBasicMaterial color="#9fb4c8" transparent opacity={0.35} />
    </lineSegments>
  );
}
