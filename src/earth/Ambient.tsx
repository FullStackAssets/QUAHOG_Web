import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";

export type Weather = "clear" | "cloudy" | "rain";

// Soft procedural cloud puff so drei's <Cloud> never reaches for its default
// texture on a CDN (rawcdn.githack.com). That external fetch, when blocked or
// offline, THREW during render and took the whole scene down via the error
// boundary — this keeps the world self-contained and crash-proof.
let _cloudUrl: string | null = null;
function cloudTextureUrl(): string {
  if (_cloudUrl) return _cloudUrl;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _cloudUrl = c.toDataURL("image/png"); // self-contained data URL — no CDN fetch
  return _cloudUrl;
}

// Sky life for the photoreal world: drifting clouds, a couple of airliners, and
// rain when the weather turns. All live inside the y-up content group (so high y
// = altitude). Rain follows the camera.

export function Ambient({ weather }: { weather: Weather }) {
  return (
    <group>
      <CloudLayer weather={weather} />
      <Planes />
      {weather === "rain" && <Rain />}
    </group>
  );
}

function CloudLayer({ weather }: { weather: Weather }) {
  const count = weather === "clear" ? 5 : weather === "cloudy" ? 11 : 14;
  const opacity = weather === "rain" ? 0.85 : weather === "cloudy" ? 0.7 : 0.5;
  const color = weather === "rain" ? "#9aa3ad" : "#ffffff";
  const specs = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        pos: [
          (Math.random() * 2 - 1) * 1100,
          320 + Math.random() * 260,
          (Math.random() * 2 - 1) * 1100,
        ] as [number, number, number],
        seed: Math.random() * 100,
        scale: 16 + Math.random() * 22,
      })),
    [count],
  );
  // the parent <Clouds> owns the shared texture (a URL string); feeding it our
  // self-contained data URL keeps drei from fetching its default off a CDN.
  const tex = useMemo(() => cloudTextureUrl(), []);
  return (
    <Clouds material={THREE.MeshBasicMaterial} limit={400} texture={tex}>
      {specs.map((s, i) => (
        <Cloud
          key={i}
          seed={s.seed}
          position={s.pos}
          scale={s.scale}
          opacity={opacity}
          color={color}
          speed={0.2}
          growth={4}
          volume={10}
        />
      ))}
    </Clouds>
  );
}

function Planes() {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const wrap = (g: THREE.Group | null, speed: number) => {
      if (!g) return;
      g.position.x += speed * dt;
      if (g.position.x > 1800) g.position.x = -1800;
      if (g.position.x < -1800) g.position.x = 1800;
    };
    wrap(a.current, 70);
    wrap(b.current, -55);
  });
  return (
    <>
      <group ref={a} position={[-1800, 1150, -400]} rotation-y={Math.PI / 2}>
        <Airliner />
      </group>
      <group ref={b} position={[1800, 1320, 500]} rotation-y={-Math.PI / 2}>
        <Airliner />
      </group>
    </>
  );
}

function Airliner() {
  return (
    <group scale={3}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1.1, 1.1, 16, 10]} />
        <meshStandardMaterial color="#e8eaee" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[18, 0.4, 3]} />
        <meshStandardMaterial color="#d8dade" />
      </mesh>
      <mesh position={[0, 1.4, -6.5]}>
        <boxGeometry args={[0.4, 3, 2.4]} />
        <meshStandardMaterial color="#c8ccd2" />
      </mesh>
      <mesh position={[0, 0, -6.5]}>
        <boxGeometry args={[7, 0.3, 2]} />
        <meshStandardMaterial color="#d8dade" />
      </mesh>
    </group>
  );
}

// Rain: a recycling point cloud kept around the camera (converted to local space).
function Rain() {
  const { camera } = useThree();
  const ref = useRef<THREE.Points>(null);
  const N = 1400;
  const R = 50;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() * 2 - 1) * R;
      p[i * 3 + 1] = Math.random() * 60;
      p[i * 3 + 2] = (Math.random() * 2 - 1) * R;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts || !pts.parent) return;
    const local = pts.parent.worldToLocal(camera.position.clone());
    pts.position.set(local.x, 0, local.z);
    const arr = geom.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] -= 55 * dt;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 60;
        arr[i * 3] = (Math.random() * 2 - 1) * R;
        arr[i * 3 + 2] = (Math.random() * 2 - 1) * R;
      }
    }
    geom.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial color="#9fb4c4" size={0.18} transparent opacity={0.55} />
    </points>
  );
}
