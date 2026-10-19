import { useMemo } from "react";
import * as THREE from "three";

// Real OSM piers/wharves (man_made=pier) baked to slice metres — the working
// New Bedford waterfront. Rendered as raised wooden dock decks just above the
// water. Coordinates [east, north]; world x = east, z = -north.

function ribbon(paths: [number, number][][], y: number, half: number): THREE.BufferGeometry | null {
  const pos: number[] = []; const idx: number[] = []; let v = 0;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i][0], az = -path[i][1], bx = path[i + 1][0], bz = -path[i + 1][1];
      const dx = bx - ax, dz = bz - az; const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      const nx = (-dz / len) * half, nz = (dx / len) * half;
      pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function Piers({ paths }: { paths?: [number, number][][] }) {
  const geo = useMemo(() => (paths && paths.length ? ribbon(paths, 0.55, 2.6) : null), [paths]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshStandardMaterial color="#6a533a" roughness={0.95} />
    </mesh>
  );
}
