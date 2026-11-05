import type { Building } from "../slice";

/**
 * Physical, instanced window relief registered to the existing 3.2 m facade
 * texture lattice. No changes to structural buildings, colliders or GIS coords.
 * Diagonal facades are omitted because their projected UVs would not align.
 */
export interface ReliefWindow {
  x: number;
  y: number;
  z: number;
  yaw: number;
}
const CELL = 3.2;
const CENTER_V = (37 + 168 / 2) / 256;
const WIDTH = 110 / 256 * CELL;
const WINDOW_H = 168 / 256 * CELL;
const LANDMARKS = new Set(["Seamen's Bethel", "New Bedford Whaling Museum", "Mariner's Home", "Double Bank Building", "Rodman Candleworks", "massgis:201:248015_820696", "massgis:201:248022_820728"]);
export const FACADE_WINDOW_WIDTH = WIDTH;
export const FACADE_WINDOW_HEIGHT = WINDOW_H;

export function generateFacadeRelief(buildings: Building[], budget: number): ReliefWindow[] {
  if (!Number.isFinite(budget) || budget < 1) return [];
  const result: ReliefWindow[] = [];
  for (const building of buildings) {
    const fp = building.footprint;
    if (!fp || fp.length < 3 || !Number.isFinite(building.height) || building.height < 3 || LANDMARKS.has(building.name ?? "") || !fp.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))) continue;
    const cx = fp.reduce((a, p) => a + p[0], 0) / fp.length;
    const cz = -fp.reduce((a, p) => a + p[1], 0) / fp.length;
    const floors = Math.min(7, Math.floor((building.height - CENTER_V * CELL - WINDOW_H / 2 - 0.2) / CELL) + 1);
    if (floors < 1) continue;
    let eligibleFacades = 0;
    for (let edge = 0; edge < fp.length; edge++) {
      const a = fp[edge], b = fp[(edge + 1) % fp.length];
      const ax = a[0], az = -a[1], bx = b[0], bz = -b[1];
      const dx = bx - ax, dz = bz - az;
      const alongX = Math.abs(dx) > Math.abs(dz) * 6;
      const alongZ = Math.abs(dz) > Math.abs(dx) * 6;
      if ((!alongX && !alongZ) || Math.hypot(dx, dz) < 4.8) continue;
      if (eligibleFacades++ >= 2) break; // street-facing variety; bounded visual cost
      const edgeFixed = alongX ? (az + bz) / 2 : (ax + bx) / 2;
      const normalSign = Math.sign(edgeFixed - (alongX ? cz : cx)) || 1;
      const yaw = alongX ? (normalSign === 1 ? 0 : Math.PI) : (normalSign === 1 ? Math.PI / 2 : -Math.PI / 2);
      const min = Math.min(alongX ? ax : az, alongX ? bx : bz);
      const max = Math.max(alongX ? ax : az, alongX ? bx : bz);
      // A facade's UVs are world-space projected; align relief to the 0.5 UV
      // window cell, not arbitrary centroid offsets that create double windows.
      const start = Math.ceil((min + 0.9) / CELL - 0.5);
      const end = Math.floor((max - 0.9) / CELL - 0.5);
      for (let step = start; step <= end; step++) {
        const axis = (step + 0.5) * CELL;
        for (let floor = 0; floor < floors; floor++) {
          if (result.length >= budget) return result;
          const y = (floor + CENTER_V) * CELL;
          result.push({
            x: alongX ? axis : edgeFixed + normalSign * 0.035,
            y,
            z: alongX ? edgeFixed + normalSign * 0.035 : axis,
            yaw,
          });
        }
      }
    }
  }
  return result;
}
