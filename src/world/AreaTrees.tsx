import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Scatters low-poly trees inside real OSM green polygons (woods, parks) so they
// read as 3D vegetation rather than flat green. Points are sampled on a jittered
// grid and kept if inside a polygon. Instanced trunk + crown, per-instance green.
// Coordinates [east, north]; world x = east, z = -north.

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const GREENS = ["#365e2c", "#3f6b34", "#2e5226", "#487a38", "#335f30", "#5a8a40"];

function inRing(e: number, n: number, r: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], ni = r[i][1], xj = r[j][0], nj = r[j][1];
    if ((ni > n) !== (nj > n) && e < ((xj - xi) * (n - ni)) / (nj - ni) + xi) inside = !inside;
  }
  return inside;
}

export function AreaTrees({ areas, step = 12, cap = 700 }: { areas?: [number, number][][]; step?: number; cap?: number }) {
  const trees = useMemo(() => {
    const out: { x: number; z: number; sc: number }[] = [];
    if (!areas) return out;
    let k = 0;
    for (const ring of areas) {
      if (ring.length < 3) continue;
      let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
      for (const [e, n] of ring) { if (e < x0) x0 = e; if (e > x1) x1 = e; if (n < n0) n0 = n; if (n > n1) n1 = n; }
      for (let e = x0; e < x1; e += step) {
        for (let n = n0; n < n1; n += step) {
          k++;
          const je = e + (((k * 0.618) % 1) - 0.5) * step, jn = n + (((k * 0.382) % 1) - 0.5) * step;
          if (!inRing(je, jn, ring)) continue;
          out.push({ x: je, z: -jn, sc: 0.8 + ((k * 0.726) % 1) * 0.9 });
          if (out.length >= cap) return out;
        }
      }
    }
    return out;
  }, [areas, step, cap]);

  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m1 = trunk.current, m2 = crown.current;
    if (!m1 || !m2) return;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      _q.identity();
      _s.set(t.sc, t.sc, t.sc);
      _m.compose(_p.set(t.x, 1.6 * t.sc, t.z), _q, _s); m1.setMatrixAt(i, _m);
      _m.compose(_p.set(t.x, 4.2 * t.sc, t.z), _q, _s); m2.setMatrixAt(i, _m);
      m2.setColorAt(i, _c.set(GREENS[(i * 2654435761) % GREENS.length]));
    }
    m1.count = trees.length; m2.count = trees.length;
    m1.instanceMatrix.needsUpdate = true; m2.instanceMatrix.needsUpdate = true;
    if (m2.instanceColor) m2.instanceColor.needsUpdate = true;
  }, [trees]);

  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, Math.max(1, trees.length)]} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 3.2, 6]} />
        <meshStandardMaterial color="#4a3526" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, Math.max(1, trees.length)]} castShadow>
        <icosahedronGeometry args={[2.0, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
