import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { makeWaterNormal } from "./textures";

// The real harbor, triangulated from the OSM water polygon(s), as an animated
// ocean surface. Sits just above the opaque ground plane so it stays visible.
// Lifted well clear of the region-wide ground plane — at 0.12 it z-fought with
// the ground and vanished in 3D (only the map showed water). 0.45 reads cleanly.
const WATER_Y = 0.45;

// Is point [e,n] inside ring? (ray cast) — used to assign island holes to the
// water polygon that contains them.
function inRing(e: number, n: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], ni = ring[i][1], xj = ring[j][0], nj = ring[j][1];
    if ((ni > n) !== (nj > n) && e < ((xj - xi) * (n - ni)) / (nj - ni) + xi) inside = !inside;
  }
  return inside;
}

export function Water({ polys, holes = [] }: { polys: [number, number][][]; holes?: [number, number][][] }) {
  const normalMap = useMemo(() => {
    const t = makeWaterNormal();
    t.repeat.set(60, 60);
    return t;
  }, []);

  const geometry = useMemo(() => {
    // centroid of each island hole, to place it in its containing water polygon
    const holeC = holes.map((h) => {
      let e = 0, n = 0;
      for (const p of h) { e += p[0]; n += p[1]; }
      return [e / h.length, n / h.length] as [number, number];
    });
    const geoms: THREE.BufferGeometry[] = [];
    for (const ring of polys) {
      if (ring.length < 3) continue;
      const shape = new THREE.Shape(ring.map(([e, n]) => new THREE.Vector2(e, n)));
      // cut island/wharf land out of this water polygon (renders as land beneath)
      for (let h = 0; h < holes.length; h++) {
        if (holes[h].length >= 3 && inRing(holeC[h][0], holeC[h][1], ring))
          shape.holes.push(new THREE.Path(holes[h].map(([e, n]) => new THREE.Vector2(e, n))));
      }
      const g = new THREE.ShapeGeometry(shape); // earcut, handles concave + holes
      g.rotateX(-Math.PI / 2); // (e,n) plane -> (x, -z) ground plane
      geoms.push(g);
    }
    if (geoms.length === 0) return null;
    // merge into one geometry (simple position concat)
    let count = 0;
    geoms.forEach((g) => (count += g.attributes.position.count));
    const pos = new Float32Array(count * 3);
    let o = 0;
    for (const g of geoms) {
      const p = g.attributes.position.array as ArrayLike<number>;
      pos.set(p as Float32Array, o);
      o += p.length;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    // planar UVs in world meters for the normal map
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      uv[i * 2] = pos[i * 3] / 40;
      uv[i * 2 + 1] = pos[i * 3 + 2] / 40;
    }
    merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    merged.computeVertexNormals();
    return merged;
  }, [polys, holes]);

  // cache base vertex positions so we can ripple them each frame (§6 waves)
  const base = useMemo(() => (geometry ? (geometry.attributes.position.array as Float32Array).slice() : null), [geometry]);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  // Gerstner-style swell: sum a few directional waves for choppy, believable
  // motion; recompute normals so the IBL reflection rolls with the surface.
  const WAVES = useMemo(() => ([
    { dx: 0.7, dz: 0.7, len: 26, amp: 0.22, spd: 1.0 },
    { dx: -0.5, dz: 0.86, len: 14, amp: 0.13, spd: 1.4 },
    { dx: 0.95, dz: -0.3, len: 8, amp: 0.07, spd: 1.9 },
  ]), []);
  const height = (x: number, z: number, t: number) => {
    let h = 0;
    for (const w of WAVES) {
      const k = (2 * Math.PI) / w.len;
      h += w.amp * Math.sin((x * w.dx + z * w.dz) * k + t * w.spd);
    }
    return h;
  };

  useFrame((state, dt) => {
    if (matRef.current?.normalMap) {
      matRef.current.normalMap.offset.x += dt * 0.012;
      matRef.current.normalMap.offset.y += dt * 0.006;
    }
    // animate the swell only on modest meshes — at region scale (Buzzards Bay)
    // the vertex count is huge, so keep that water static for performance.
    if (base && meshRef.current && base.length < 45000) {
      const t = state.clock.elapsedTime;
      const g = meshRef.current.geometry;
      const pos = g.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] = base[i + 1] + height(base[i], base[i + 2], t);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
    }
  });

  if (!geometry) return null;
  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, WATER_Y, 0]} receiveShadow>
      <meshStandardMaterial
        ref={matRef}
        color="#1d566b"
        roughness={0.14}
        metalness={0.6}
        envMapIntensity={1.35}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.5, 0.5)}
        transparent
        // semi-transparent so the real aerial harbour tone reads through while
        // the 3D surface still carries the wave reflections + specular glints
        opacity={0.8}
      />
    </mesh>
  );
}
