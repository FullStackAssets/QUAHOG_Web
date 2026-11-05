import * as THREE from "three";
import type { Building } from "../slice";

export type FacadeKind = "brick" | "clapboard" | "granite";
export const BETHEL_FOOTPRINT = "massgis:201:248015_820696";
export const MARINERS_FOOTPRINT = "massgis:201:248022_820728";

// Stable across tile reloads, array reordering, and reversed polygon winding.
export function buildingSeed(b: Building): number {
  const key = b.name || b.footprint.map(([x, n]) => `${x.toFixed(2)},${n.toFixed(2)}`).sort().join(";");
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function districtStyle(b: Building) {
  const seed = buildingSeed(b);
  const bethel = b.name === BETHEL_FOOTPRINT || b.name === "Seamen's Bethel";
  const mariners = b.name === MARINERS_FOOTPRINT || b.name === "Mariner's Home";
  const kind: FacadeKind = bethel || mariners ? "clapboard" : b.height > 17 ? "granite" : seed % 5 === 0 ? "clapboard" : "brick";
  const palette = kind === "brick" ? ["#a5715d", "#9a6253", "#ac7c62", "#8d6459"]
    : kind === "granite" ? ["#bcb9ae", "#aaa99e", "#b9b6b0"] : ["#e1dfd2", "#c4ccc4", "#d9ccae"];
  return { seed, kind, wall: bethel ? "#f4f1e8" : mariners ? "#e6dfc8" : palette[seed % palette.length], roof: "#40494e" };
}

// Add UVs/roof colours ONLY. No vertex positions or collider volume changes.
export function dressFootprint(g: THREE.BufferGeometry, b: Building): THREE.BufferGeometry {
  const style = districtStyle(b);
  const wall = new THREE.Color(style.wall), roof = new THREE.Color(style.roof);
  const pos = g.getAttribute("position"), normal = g.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2), colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const cap = Math.abs(normal.getY(i)) > 0.5;
    const c = cap ? roof : wall;
    colors.set([c.r, c.g, c.b], i * 3);
    // Corner of each shared facade cell is plain wall, never a glowing window.
    uv[i * 2] = cap ? 0.025 : (Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i)) ? pos.getZ(i) : pos.getX(i)) / 3.2;
    uv[i * 2 + 1] = cap ? 0.025 : pos.getY(i) / 3.2;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}
