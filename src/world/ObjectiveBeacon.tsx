import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useMission } from "../mission";
import { shared } from "../shared";
import { useGame } from "../store";
import { districtOfWorld } from "../districts";

// Playtest fix (2026-11-02): the active mission objective was only a small
// arrow in the HUD panel and a tiny minimap dot — the player drove 800 m the
// wrong way without noticing. This renders a tall, pulsing gold beam plus a
// rotating diamond directly over the objective in the world, so the target
// is visible from anywhere in the district.
export function ObjectiveBeacon() {
  const step = useMission((s) => (s.done ? null : s.steps[s.step]));
  const beam = useRef<THREE.Mesh>(null);
  const diamond = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [dist, setDist] = useState<number | null>(null);
  const distTimer = useRef(0);

  useFrame(({ clock, camera }, dt) => {
    const t = clock.getElapsedTime();
    if (beam.current) {
      const m = beam.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.13 + 0.07 * Math.sin(t * 2.2);
    }
    if (diamond.current) {
      diamond.current.rotation.y = t * 0.9;
      diamond.current.position.y = 9 + Math.sin(t * 1.8) * 0.8;
    }
    if (ring.current) {
      const s = 1 + 0.12 * Math.sin(t * 2.2);
      ring.current.scale.set(s, s, 1);
    }
    // Distance label on the marker, refreshed 4×/s (playtest 2026-11-02,
    // A-01 remainder: the beacon had no distance attached to it).
    distTimer.current -= dt;
    if (distTimer.current <= 0) {
      distTimer.current = 0.25;
      const target = useMission.getState().done ? null : useMission.getState().steps[useMission.getState().step]?.target;
      if (target) {
        const body = useGame.getState().mode === "car" ? shared.car : shared.player;
        const p = body?.translation();
        const px = p ? p.x : camera.position.x, pz = p ? p.z : camera.position.z;
        setDist(Math.round(Math.hypot(px - target[0], pz - target[2])));
      } else setDist(null);
    }
  });

  const target = step?.target;
  if (!target) return null;
  // Fall River integration (2026-11-03): missions are New Bedford-based
  // in Phase 1. When the player is in another district than the objective,
  // the beacon stays hidden — a 20 km beam/label across the gap would be
  // a fast-travel hint at best and a broken artifact at worst. Same
  // districtOfWorld gate as the minimap route line.
  if (districtOfWorld(target[0], target[2]) !== useGame.getState().district) return null;
  return (
    <group position={[target[0], 0, target[2]]}>
      {/* vertical beam, 70 m tall so it clears rooftops */}
      <mesh ref={beam} position={[0, 35, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 70, 12, 1, true]} />
        <meshBasicMaterial color="#ffcf4a" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* rotating diamond above the objective */}
      <mesh ref={diamond} position={[0, 9, 0]}>
        <octahedronGeometry args={[1.7, 0]} />
        <meshBasicMaterial color="#ffcf4a" />
      </mesh>
      {/* distance label riding the diamond */}
      {dist != null && (
        <Html position={[0, 11.5, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{ background: "rgba(8,14,16,0.72)", border: "1px solid #ffcf4a", borderRadius: 14, color: "#ffcf4a", fontSize: 13, fontWeight: 700, padding: "3px 9px", whiteSpace: "nowrap" }}>
            {dist} m
          </div>
        </Html>
      )}
      {/* ground ring marking the arrival radius */}
      <mesh ref={ring} position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.2, 4.0, 32]} />
        <meshBasicMaterial color="#ffcf4a" transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
