import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RigidBody } from "@react-three/rapier";
import { shared } from "../shared";
import type { Building } from "../slice";
import { BETHEL_FOOTPRINT, dressFootprint, districtStyle } from "./districtStyle";
import { districtFacadeMaps } from "./districtMaterials";
import { useGame } from "../store";
import { ArchitecturalShell } from "./ArchitecturalShell";

const WINDOW_GLOW = new THREE.Color("#ffcf8a");

// Auto-extruded OSM footprints. Buildings within COLLIDER_RADIUS of the playable
// core get individual hull colliders; the rest are merged per spatial CELL so
// the renderer can frustum-cull off-screen chunks and distance-cull far ones —
// essential now the slice carries 10k+ footprints (NB + Fairhaven).

const COLLIDER_RADIUS = 230; // metres from `center` — gets real colliders
const CELL = 160;            // far-building chunk size (metres)
const DRAW_DIST = 1050;      // hide far chunks beyond this from the camera

function footprintGeometry(b: Building): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  b.footprint.forEach(([e, n], i) => (i === 0 ? shape.moveTo(e, n) : shape.lineTo(e, n)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // extrude up: x=east, y=up, z=-north
  g.computeVertexNormals();
  return dressFootprint(g, b);
}

function centroid(b: Building): [number, number] {
  let x = 0, y = 0;
  for (const [e, n] of b.footprint) { x += e; y += n; }
  return [x / b.footprint.length, y / b.footprint.length];
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
  const quality = useGame((s) => s.quality);
  const materials = useMemo(() => Object.fromEntries((["brick", "clapboard", "granite"] as const).map((kind) => {
    const maps = districtFacadeMaps(kind);
    return [kind, new THREE.MeshStandardMaterial({ vertexColors: true, map: maps.albedo, emissiveMap: maps.emissive, emissive: WINDOW_GLOW, emissiveIntensity: 0, roughness: 0.88 })];
  })), []);
  useEffect(() => () => { Object.values(materials).forEach((m) => m.dispose()); }, [materials]);
  const { near, chunks } = useMemo(() => {
    const near: { geom: THREE.BufferGeometry; kind: "brick" | "clapboard" | "granite"; hidden: boolean }[] = [];
    const cells = new Map<string, THREE.BufferGeometry[]>();
    buildings.forEach((b) => {
      const [cx, cy] = centroid(b);
      const d = Math.hypot(cx - center[0], cy - center[1]);
      const geom = footprintGeometry(b);
      if (d <= colliderRadius) {
        near.push({ geom, kind: districtStyle(b).kind, hidden: b.name === BETHEL_FOOTPRINT });
      } else {
        const key = `${Math.floor(cx / CELL)},${Math.floor(cy / CELL)}`;
        (cells.get(key) ?? cells.set(key, []).get(key)!).push(geom);
      }
    });
    const chunks: Chunk[] = [];
    for (const [key, list] of cells) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const [gx, gy] = key.split(",").map(Number);
      // chunk centre in world coords (x=east, z=-north)
      chunks.push({ geom: merged, cx: (gx + 0.5) * CELL, cz: -(gy + 0.5) * CELL });
    }
    return { near, chunks };
  }, [buildings, center, colliderRadius]);

  useEffect(() => () => { near.forEach((n) => n.geom.dispose()); chunks.forEach((c) => c.geom.dispose()); }, [near, chunks]);

  // Per-frame: lit-window night glow + distance-cull far chunks (frustum culling
  // of each chunk is automatic since they're separate objects).
  const root = useRef<THREE.Group>(null);
  const chunkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const night = 1 - THREE.MathUtils.smoothstep(shared.dayT, 0, 0.3); // dusk-gated: dark by day
    Object.values(materials).forEach((m) => { m.emissiveIntensity = night * 0.3; });
    const cp = camera.position;
    chunks.forEach((c, i) => {
      const mesh = chunkRefs.current[i];
      if (mesh) mesh.visible = Math.hypot(cp.x - c.cx, cp.z - c.cz) < [480, 750, DRAW_DIST][quality];
    });
  });

  return (
    <group ref={root}>
      {near.map(({ geom, kind, hidden }, i) => (
        <RigidBody key={i} type="fixed" colliders="hull" includeInvisible>
          <mesh geometry={geom} material={materials[kind]} visible={!hidden} castShadow={quality > 0} receiveShadow />
        </RigidBody>
      ))}
      <ArchitecturalShell buildings={buildings.filter(b => {
        if (!b.footprint?.length) return false;
        const [x, n] = centroid(b);
        return Math.hypot(x - center[0], n - center[1]) <= colliderRadius;
      })} />
      {/* far buildings: per-cell merged meshes, no shadow casting (cheap) */}
      {chunks.map((c, i) => (
        <mesh key={i} ref={(el) => (chunkRefs.current[i] = el)} geometry={c.geom} material={materials.brick} receiveShadow />
      ))}
    </group>
  );
}
