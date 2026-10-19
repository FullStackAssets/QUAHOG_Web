import { useMemo } from "react";
import * as THREE from "three";

// The New Bedford Hurricane Barrier (built 1966): the long stone dike across the
// outer harbour mouth — Clark's Cove dike + the main harbour barrier — with its
// real OSM breakwater geometry (public/barrier-newbedford.json, slice metres).
// Rendered as a riprap base + a flat drivable/walkable granite crown. The
// navigation gap is already present in the source ways. Coordinates are slice
// [east, north]; world x = east, z = -north.

function ribbon(paths: [number, number][][], y: number, half: number): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const idx: number[] = [];
  let v = 0;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i][0], az = -path[i][1];
      const bx = path[i + 1][0], bz = -path[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      const nx = (-dz / len) * half, nz = (dx / len) * half;
      pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function HurricaneBarrier({ paths }: { paths?: [number, number][][] }) {
  const geos = useMemo(() => {
    if (!paths || paths.length === 0) return null;
    // Raised just above the water surface (0.45) so the dike stays visible where
    // it crosses the harbour as well as over land: a wide riprap base + a
    // narrower granite deck on top.
    return {
      base: ribbon(paths, 0.5, 11),   // riprap shoulders
      crown: ribbon(paths, 0.64, 6),  // granite walkway/deck
    };
  }, [paths]);

  if (!geos || !geos.base) return null;
  return (
    <group>
      <mesh geometry={geos.base} receiveShadow castShadow>
        <meshStandardMaterial color="#5b5751" roughness={1} flatShading />
      </mesh>
      {geos.crown && (
        <mesh geometry={geos.crown} receiveShadow>
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
      )}
    </group>
  );
}
