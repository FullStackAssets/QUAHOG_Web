import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RigidBody } from "@react-three/rapier";
import { shared } from "../shared";
import type { Building } from "../slice";

const WINDOW_GLOW = new THREE.Color("#ffcf8a");

// Auto-extruded OSM footprints. Buildings within COLLIDER_RADIUS of the playable
// core get individual hull colliders; the rest are merged per spatial CELL so
// the renderer can frustum-cull off-screen chunks and distance-cull far ones —
// essential now the slice carries 10k+ footprints (NB + Fairhaven).

const COLLIDER_RADIUS = 230; // metres from `center` — gets real colliders
const CELL = 160;            // far-building chunk size (metres)
const DRAW_DIST = 1050;      // hide far chunks beyond this from the camera
const HERO = new Set([
  "Seamen's Bethel", "New Bedford Whaling Museum", "Mariner's Home",
  "Double Bank Building", "Rodman Candleworks",
]);
const PALETTE = ["#8a5a48", "#b8b0a0", "#7c7e88", "#a8987e", "#6e4a3e", "#9aa0a6", "#c2bcae"];
const HERO_COLOR = "#caa24a";

function footprintGeometry(b: Building): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  b.footprint.forEach(([e, n], i) => (i === 0 ? shape.moveTo(e, n) : shape.lineTo(e, n)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // extrude up: x=east, y=up, z=-north
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

function centroid(b: Building): [number, number] {
  let x = 0, y = 0;
  for (const [e, n] of b.footprint) { x += e; y += n; }
  return [x / b.footprint.length, y / b.footprint.length];
}

function colorFor(b: Building, i: number): string {
  if (b.name && HERO.has(b.name)) return HERO_COLOR;
  return PALETTE[i % PALETTE.length];
}

interface Chunk { geom: THREE.BufferGeometry; cx: number; cz: number }

export function Buildings({
  buildings,
  center = [0, 0],
  colliderRadius = COLLIDER_RADIUS,
}: {
  buildings: Building[];
  center?: [number, number];
  /** Build 002: override for districts wider than the default radius. */
  colliderRadius?: number;
}) {
  const { near, chunks } = useMemo(() => {
    const near: { geom: THREE.BufferGeometry; color: string }[] = [];
    const cells = new Map<string, THREE.BufferGeometry[]>();
    buildings.forEach((b, i) => {
      const [cx, cy] = centroid(b);
      const d = Math.hypot(cx - center[0], cy - center[1]);
      const geom = footprintGeometry(b);
      if (d <= colliderRadius) {
        near.push({ geom, color: colorFor(b, i) });
      } else {
        const col = new THREE.Color(colorFor(b, i));
        const n = geom.attributes.position.count;
        const colors = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) colors.set([col.r, col.g, col.b], k * 3);
        geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const key = `${Math.floor(cx / CELL)},${Math.floor(cy / CELL)}`;
        (cells.get(key) ?? cells.set(key, []).get(key)!).push(geom);
      }
    });
    const chunks: Chunk[] = [];
    for (const [key, list] of cells) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const [gx, gy] = key.split(",").map(Number);
      // chunk centre in world coords (x=east, z=-north)
      chunks.push({ geom: merged, cx: (gx + 0.5) * CELL, cz: -(gy + 0.5) * CELL });
    }
    return { near, chunks };
  }, [buildings, center, colliderRadius]);

  // Per-frame: lit-window night glow + distance-cull far chunks (frustum culling
  // of each chunk is automatic since they're separate objects).
  const root = useRef<THREE.Group>(null);
  const chunkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const night = 1 - THREE.MathUtils.smoothstep(shared.dayT, 0, 0.3); // dusk-gated: dark by day
    const g = root.current;
    if (g) g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.isMeshStandardMaterial) m.emissiveIntensity = night * 0.4;
    });
    const cp = camera.position;
    chunks.forEach((c, i) => {
      const mesh = chunkRefs.current[i];
      if (mesh) mesh.visible = Math.hypot(cp.x - c.cx, cp.z - c.cz) < DRAW_DIST;
    });
  });

  return (
    <group ref={root}>
      {near.map(({ geom, color }, i) => (
        <RigidBody key={i} type="fixed" colliders="hull">
          <mesh geometry={geom} castShadow receiveShadow>
            <meshStandardMaterial color={color} emissive={WINDOW_GLOW} emissiveIntensity={0} roughness={0.85} flatShading />
          </mesh>
        </RigidBody>
      ))}
      {/* far buildings: per-cell merged meshes, no shadow casting (cheap) */}
      {chunks.map((c, i) => (
        <mesh key={i} ref={(el) => (chunkRefs.current[i] = el)} geometry={c.geom} receiveShadow>
          <meshStandardMaterial vertexColors emissive={WINDOW_GLOW} emissiveIntensity={0} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}
