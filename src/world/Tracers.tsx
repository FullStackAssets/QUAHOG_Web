import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";

// Gun-tracer + muzzle-flash VFX (§11). Reads shared.shots (pushed by the Player
// when firing), draws a bright line per shot and a brief flash at the muzzle,
// fading each over its short life.

const MAX = 12;

export function Tracers() {
  const group = useRef<THREE.Group>(null);
  const lines = useRef<THREE.LineSegments[]>([]);
  const flashes = useRef<THREE.Mesh[]>([]);

  useFrame((_, dt) => {
    // advance lifetimes + retire dead shots
    for (const s of shared.shots) s.life -= dt;
    shared.shots = shared.shots.filter((s) => s.life > 0).slice(-MAX);

    for (let i = 0; i < MAX; i++) {
      const ln = lines.current[i];
      const fl = flashes.current[i];
      const shot = shared.shots[i];
      if (!ln || !fl) continue;
      if (shot) {
        const pos = ln.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, shot.from.x, shot.from.y, shot.from.z);
        pos.setXYZ(1, shot.to.x, shot.to.y, shot.to.z);
        pos.needsUpdate = true;
        const a = Math.max(0, shot.life / 0.06);
        (ln.material as THREE.LineBasicMaterial).opacity = a;
        ln.visible = true;
        fl.position.copy(shot.from);
        fl.scale.setScalar(0.2 + a * 0.5);
        (fl.material as THREE.MeshBasicMaterial).opacity = a;
        fl.visible = true;
      } else {
        ln.visible = false;
        fl.visible = false;
      }
    }
  });

  return (
    <group ref={group}>
      {Array.from({ length: MAX }).map((_, i) => (
        <group key={i}>
          <lineSegments
            ref={(el) => { if (el) lines.current[i] = el; }}
            frustumCulled={false}
          >
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[new Float32Array(6), 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#fff0b0" transparent opacity={0} depthWrite={false} />
          </lineSegments>
          <mesh ref={(el) => { if (el) flashes.current[i] = el; }} frustumCulled={false}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color="#ffd24a" transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
