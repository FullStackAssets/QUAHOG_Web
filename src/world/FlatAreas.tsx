import { useMemo } from "react";
import * as THREE from "three";
import { makeGroundTexture } from "./textures";

// Generic flat ground overlay for real OSM area features baked to slice metres:
// parks (green), parking lots (asphalt), beaches (sand). Each instance merges its
// polygons into one flat textured mesh just above the ground. Coordinates are
// [east, north]; world x = east, z = -north.

export function FlatAreas({
  polys, color, y, repeat = 0.05, roughness = 1,
}: {
  polys?: [number, number][][];
  color: string;
  y: number;
  repeat?: number;
  roughness?: number;
}) {
  const tex = useMemo(() => { const t = makeGroundTexture(); t.repeat.set(repeat, repeat); return t; }, [repeat]);

  const geometry = useMemo(() => {
    if (!polys || polys.length === 0) return null;
    const geoms: THREE.BufferGeometry[] = [];
    for (const ring of polys) {
      if (ring.length < 3) continue;
      const shape = new THREE.Shape(ring.map(([e, n]) => new THREE.Vector2(e, n)));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      geoms.push(g);
    }
    if (geoms.length === 0) return null;
    let count = 0;
    geoms.forEach((g) => (count += g.attributes.position.count));
    const pos = new Float32Array(count * 3);
    let o = 0;
    for (const g of geoms) { const p = g.attributes.position.array as Float32Array; pos.set(p, o); o += p.length; }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) { uv[i * 2] = pos[i * 3]; uv[i * 2 + 1] = pos[i * 3 + 2]; }
    merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    merged.computeVertexNormals();
    return merged;
  }, [polys]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial map={tex} color={color} roughness={roughness} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}
