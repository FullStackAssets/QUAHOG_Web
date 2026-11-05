import { useMemo } from "react";
import * as THREE from "three";

// Real OSM railway lines (rail / disused / abandoned) baked to slice metres.
// Rendered as a dark gravel ballast bed with two steel rails on top.
// Coordinates [east, north]; world x = east, z = -north.

function ribbon(paths: [number, number][][], y: number, half: number, offset = 0): THREE.BufferGeometry | null {
  const pos: number[] = []; const idx: number[] = []; let v = 0;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i][0], az = -path[i][1], bx = path[i + 1][0], bz = -path[i + 1][1];
      const dx = bx - ax, dz = bz - az; const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      const ux = dx / len, uz = dz / len; const nx = -uz, nz = ux;
      const ox = nx * offset, oz = nz * offset;
      const lx = nx * half, lz = nz * half;
      pos.push(ax + ox + lx, y, az + oz + lz, bx + ox + lx, y, bz + oz + lz,
               bx + ox - lx, y, bz + oz - lz, ax + ox - lx, y, az + oz - lz);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function Rail({ paths }: { paths?: [number, number][][] }) {
  const g = useMemo(() => {
    if (!paths || paths.length === 0) return null;
    return {
      bed: ribbon(paths, 0.1, 1.7),
      railL: ribbon(paths, 0.16, 0.08, 0.7),
      railR: ribbon(paths, 0.16, 0.08, -0.7),
    };
  }, [paths]);

  if (!g || !g.bed) return null;
  return (
    <group>
      <mesh geometry={g.bed} receiveShadow>
        <meshStandardMaterial color="#3a352e" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {g.railL && <mesh geometry={g.railL}><meshStandardMaterial color="#7c7e82" roughness={0.78} metalness={0.25} polygonOffset polygonOffsetFactor={-2} /></mesh>}
      {g.railR && <mesh geometry={g.railR}><meshStandardMaterial color="#7c7e82" roughness={0.78} metalness={0.25} polygonOffset polygonOffsetFactor={-2} /></mesh>}
    </group>
  );
}
