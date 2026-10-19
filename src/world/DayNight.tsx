import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
import { shared } from "../shared";
import { useGame } from "../store";

// Day/night cycle (§4): drives the sun, sky, ambient/hemisphere, fog, and
// background through a full day on a loop. Exposes shared.dayT / shared.hour so
// other systems (lighthouse, future street lights/lit windows) can react.

const DAY_LENGTH = 600; // seconds for a full 24h cycle (10 min)

const dayBg = new THREE.Color("#bcd4ea");
const nightBg = new THREE.Color("#0a1124");
const dayFog = new THREE.Color("#c4d6e6");
const nightFog = new THREE.Color("#0c1530");
const warm = new THREE.Color("#ffb066"); // dusk/dawn tint

// soft radial sprite the bloom turns into a sun + atmospheric haze
function makeGlow(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,244,214,1)");
  g.addColorStop(0.25, "rgba(255,224,160,0.7)");
  g.addColorStop(1, "rgba(255,210,140,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.Texture(c); t.needsUpdate = true; return t;
}
const storm = new THREE.Color("#5a6470"); // rain grade
const fogGrey = new THREE.Color("#aeb6bd"); // dense coastal fog

export function DayNight() {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const skyThrottle = useRef(0);
  const [sunPos, setSunPos] = useState<[number, number, number]>([120, 120, 60]);
  const bg = useMemo(() => dayBg.clone(), []);
  const fogC = useMemo(() => dayFog.clone(), []);
  // Atmospheric depth haze (the cinematic "fade into the horizon" look). Colour
  // tracks the sky/time-of-day each frame; density rises in rain/coastal fog.
  const fog = useMemo(() => new THREE.FogExp2(0xc4d6e6, 0.0013), []);
  const cSun = useMemo(() => new THREE.Color(), []);
  const glowTex = useMemo(() => makeGlow(), []);
  const glow = useRef<THREE.Sprite>(null);

  // mount the depth haze on the scene (removed cleanly on unmount)
  useEffect(() => { scene.fog = fog; return () => { if (scene.fog === fog) scene.fog = null; }; }, [scene, fog]);

  // the directional light's target must live in the scene to steer shadows
  useEffect(() => {
    const s = sun.current;
    if (!s) return;
    scene.add(s.target);
    return () => { scene.remove(s.target); };
  }, [scene]);

  useFrame((_, dt) => {
    if (useGame.getState().paused) return; // freeze time in the pause menu
    // integrate on shared.hour (the canonical clock) so a safehouse sleep can
    // skip it; rolling past midnight advances the day counter.
    const prev = shared.hour;
    const h = (prev + dt * (24 / DAY_LENGTH)) % 24;
    if (h < prev) shared.day += 1; // wrapped 24→0
    shared.hour = h;
    const a = ((h - 6) / 12) * Math.PI; // 6am rise → 6pm set
    const elev = Math.sin(a);
    const dayT = THREE.MathUtils.clamp(elev, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 4, 0, 1); // peaks near horizon
    shared.dayT = dayT;
    const weather = useGame.getState().weather;
    const rain = weather === "rain" ? 1 : 0;
    const fogW = weather === "fog" ? 1 : 0;

    const sx = Math.cos(a) * 150, sy = elev * 170, sz = 60;

    if (sun.current) {
      // follow the player so the shadow frustum stays over the action everywhere
      const body = useGame.getState().mode === "car" ? shared.car : shared.player;
      const p = body?.translation();
      const px = p?.x ?? 0, pz = p?.z ?? 0;
      sun.current.position.set(px + sx, Math.max(sy, 1.5), pz + sz);
      sun.current.target.position.set(px, 0, pz);
      sun.current.target.updateMatrixWorld();
      sun.current.intensity = (0.05 + dayT * 2.5) * (1 - rain * 0.65 - fogW * 0.5);
      cSun.set("#fff2dc").lerp(warm, dusk * 0.7);
      sun.current.color.copy(cSun);
      // sun-glow sprite rides the sun direction, far out from the player
      if (glow.current) {
        const len = Math.hypot(sx, sy, sz) || 1;
        glow.current.position.set(px + (sx / len) * 760, Math.max(sy, 20) + 40, pz + (sz / len) * 760);
        const m = glow.current.material as THREE.SpriteMaterial;
        m.opacity = dayT * (1 - rain * 0.7 - fogW * 0.6) * 0.9;
        m.color.copy(cSun);
      }
    }
    if (hemi.current) hemi.current.intensity = (0.16 + dayT * 0.5) * (1 - rain * 0.25);

    // sky/fog/background lerp night→day with a warm dusk push, grey in rain/fog
    bg.copy(nightBg).lerp(dayBg, dayT).lerp(warm, dusk * 0.25).lerp(storm, rain * 0.6).lerp(fogGrey, fogW * 0.8);
    fogC.copy(nightFog).lerp(dayFog, dayT).lerp(warm, dusk * 0.18).lerp(storm, rain * 0.7).lerp(fogGrey, fogW * 0.85);
    scene.background = bg;
    // depth haze: match the horizon colour so distance fades into the sky, and
    // thicken it through rain / coastal fog for a moodier, more cinematic frame.
    fog.color.copy(fogC);
    fog.density = 0.0013 + rain * 0.0011 + fogW * 0.0045;

    skyThrottle.current += dt;
    if (skyThrottle.current > 0.25) {
      skyThrottle.current = 0;
      setSunPos([sx, Math.max(sy, 0.5), sz]);
    }
  });

  return (
    <>
      <Sky sunPosition={sunPos} turbidity={5} rayleigh={2.2} mieCoefficient={0.005} />
      <Stars radius={400} depth={60} count={2800} factor={6} fade speed={0.3} />
      <sprite ref={glow} scale={[180, 180, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} opacity={0.8} blending={THREE.AdditiveBlending} />
      </sprite>
      <ambientLight intensity={0.12} />
      <hemisphereLight ref={hemi} args={["#dbe7ff", "#3a342a", 0.8]} />
      <directionalLight
        ref={sun}
        position={[120, 160, 60]}
        intensity={2.0}
        color="#fff2dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={600}
        shadow-camera-left={-250}
        shadow-camera-right={250}
        shadow-camera-top={250}
        shadow-camera-bottom={-250}
        shadow-bias={-0.0002}
        shadow-normalBias={0.6}
      />
      <Lighthouse position={[40, 0, 240]} />
    </>
  );
}

// Palmer's Island-style rotating beam — bright at night, off by day.
function Lighthouse({ position }: { position: [number, number, number] }) {
  const beam = useRef<THREE.Group>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const cone = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (beam.current) beam.current.rotation.y += dt * 0.6;
    const night = 1 - shared.dayT;
    if (spot.current) spot.current.intensity = night * 6;
    if (cone.current) (cone.current.material as THREE.MeshBasicMaterial).opacity = night * 0.18;
  });
  return (
    <group position={position}>
      {/* tower */}
      <mesh position={[0, 8, 0]} castShadow>
        <cylinderGeometry args={[1.6, 2.2, 16, 12]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.8} />
      </mesh>
      <mesh position={[0, 16.5, 0]}>
        <cylinderGeometry args={[1.3, 1.3, 2.2, 12]} />
        <meshStandardMaterial color="#7a1f1f" emissive="#ffcf6a" emissiveIntensity={0.6} />
      </mesh>
      {/* rotating beam */}
      <group ref={beam} position={[0, 16.5, 0]}>
        <mesh ref={cone} position={[60, 0, 0]} rotation-z={Math.PI / 2}>
          <coneGeometry args={[10, 120, 16, 1, true]} />
          <meshBasicMaterial color="#fff2c0" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <spotLight ref={spot} position={[0, 0, 0]} target-position={[120, 0, 0]} angle={0.18} penumbra={0.4} distance={220} intensity={4} color="#fff2c0" />
      </group>
    </group>
  );
}
