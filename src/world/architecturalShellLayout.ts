import type { Building } from "../slice";
import { buildingSeed, districtStyle } from "./districtStyle";
import { findFrontage } from "./architecturalLayout";

/**
 * Close-range facade massing for the existing OSM/GIS footprints. This is
 * architectural dressing, not a replacement for surveyed buildings. All
 * geometry remains outside Rapier colliders and is capped per loaded tile.
 */
export type ShellKind = "foundation" | "cornice" | "belt" | "pier" | "lintel" | "chimney";
export interface ShellPiece {
  kind: ShellKind;
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
  color: string;
}
const EXCLUDED = new Set([
  "Seamen's Bethel", "New Bedford Whaling Museum", "Mariner's Home",
  "Double Bank Building", "Rodman Candleworks",
  "massgis:201:248015_820696", "massgis:201:248022_820728",
]);
const STONE = ["#a49c8e", "#c1b7a2", "#aaa79f", "#b8aa97"];
const BRICK = ["#69463f", "#7b4a3c", "#8e6556", "#8b7266"];
const WOOD = ["#d6d0c2", "#b9c2b5", "#d4c6ad", "#abb3ad"];

export function generateArchitecturalShell(buildings: Building[], limit: number): ShellPiece[] {
  const pieces: ShellPiece[] = [];
  if (!Number.isFinite(limit) || limit <= 0) return pieces;
  const cap = Math.min(480, Math.floor(limit));
  for (const b of buildings) {
    if (!Number.isFinite(b.height) || b.height < 5 || b.height > 90 || EXCLUDED.has(b.name ?? "")) continue;
    const f = findFrontage(b);
    if (!f || !Number.isFinite(f.width) || f.width < 4.5 || f.width > 85) continue;
    const seed = buildingSeed(b);
    const style = districtStyle(b);
    const brick = style.kind === "brick";
    const clap = style.kind === "clapboard";
    const trim = clap ? WOOD[seed % WOOD.length] : STONE[seed % STONE.length];
    const masonry = brick ? BRICK[seed % BRICK.length] : (clap ? WOOD[seed % WOOD.length] : "#9d9d99");
    const width = Math.max(2.3, f.width - 0.30);
    const maxFloors = Math.min(8, Math.floor(b.height / 3.2));
    const at = (localX: number, y: number, out: number): [number, number, number] => {
      const tx = Math.cos(f.yaw), tz = -Math.sin(f.yaw);
      return [f.x + tx * localX + f.nx * out, y, f.z + tz * localX + f.nz * out];
    };
    const candidate: ShellPiece[] = [];
    const add = (kind: ShellKind, x: number, y: number, out: number, w: number, h: number, depth: number, color: string) => {
      if ([x,y,out,w,h,depth].every(Number.isFinite) && w > 0 && h > 0 && depth > 0) {
        candidate.push({ kind, position: at(x, y, out), rotationY: f.yaw, scale: [w,h,depth], color });
      }
    };
    // Continuous ground-story plinth and shadow line establish a tangible base.
    add("foundation", 0, 0.27, 0.13, width, 0.53, 0.27, trim);
    // Projecting upper edge and optional secondary frieze; dark undersides
    // catch daylight even when shadow maps are disabled on iPhone.
    add("cornice", 0, b.height - 0.18, 0.22, width + 0.16, 0.29, 0.48, trim);
    if (b.height >= 11) add("cornice", 0, b.height - 0.51, 0.15, width, 0.12, 0.32, masonry);
    for (let floor = 1; floor < maxFloors; floor++) {
      if (floor > 4 && seed % 3 !== 0) break;
      if (floor % (brick ? 1 : 2) === 0) {
        add("belt", 0, floor * 3.2 - 0.12, 0.12, width, brick ? 0.13 : 0.075, 0.25, trim);
      }
    }
    // Corner pilasters read as masonry width and depth rather than a decal.
    if (f.width > 6 && (brick || style.kind === "granite")) {
      const h = Math.min(b.height - 0.6, 20);
      add("pier", -width/2 + 0.20, h/2 + 0.36, 0.13, 0.33, h, 0.26, masonry);
      add("pier", width/2 - 0.20, h/2 + 0.36, 0.13, 0.33, h, 0.26, masonry);
    }
    // Ground-floor lintels are high enough to avoid the existing awning art.
    if (seed % 3 !== 1 && width >= 6) {
      add("lintel", 0, 3.09, 0.24, Math.min(4.8, width - 1.2), 0.21, 0.34, trim);
    }
    // Stronger roof silhouette: capped chimney bodies stay on the existing
    // roof volume, no new roof collider, never modeled as a working flue.
    if (b.height < 12 && seed % 3 !== 0 && f.width > 6) {
      const x = f.cx + ((seed % 5) - 2) * 0.23;
      const z = f.cz + (((seed >>> 4) % 5) - 2) * 0.23;
      candidate.push({ kind: "chimney", position: [x, b.height + 1.04, z], rotationY: 0, scale: [0.63, 2.08, 0.61], color: brick ? masonry : "#807d78" });
    }
    // Whole-building atomic inclusion avoids orphan pilasters or cornices.
    if (pieces.length + candidate.length > cap) continue;
    pieces.push(...candidate);
    if (pieces.length === cap) break;
  }
  return pieces;
}
