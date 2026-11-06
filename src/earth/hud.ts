import { DRIVABLE } from "./follow";
import type { TileFault } from "./tileFault";
import { faultCopy } from "./tileFault";

export interface Basis { fx: number; fz: number; rx: number; rz: number }

/** Content basis. heading 0 faces +z (south); heading π faces north. Right is geographic right. */
export function contentBasis(heading: number): Basis {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return { fx, fz, rx: -fz, rz: fx };
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function headingToCompass(heading: number): string {
  const deg = ((Math.PI - heading) * 180) / Math.PI;
  const wrapped = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(wrapped / 45) % 8];
}

export function healthColor(health: number): string {
  if (health > 60) return "#7dffa1";
  if (health > 30) return "#ffd36a";
  return "#ff7a7a";
}

export function interactionPrompt(state: {
  driving: boolean;
  nearCar: boolean;
  pedInReach: boolean;
  health: number;
}): string | null {
  if (state.health <= 0) return "Hurt — stay clear of traffic";
  if (state.driving) return "E  exit";
  if (state.nearCar && state.pedInReach) return "E  enter  ·  F  punch";
  if (state.nearCar) return "E  enter car";
  if (state.pedInReach) return "F  punch";
  return null;
}

export interface MiniSeg { x1: number; y1: number; x2: number; y2: number }

export interface RoadLine { highway: string; points: [number, number][] }

interface Local { r: number; f: number }

function toLocal(east: number, north: number, player: { x: number; z: number }, basis: Basis): Local {
  const dx = east - player.x;
  const dz = -north - player.z;
  return { r: dx * basis.rx + dz * basis.rz, f: dx * basis.fx + dz * basis.fz };
}

function outside(local: Local, radius: number): boolean {
  return local.r * local.r + local.f * local.f > radius * radius;
}

function clampLocal(local: Local, radius: number): Local {
  const dist = Math.hypot(local.r, local.f);
  if (dist <= radius || dist < 1e-6) return local;
  const scale = radius / dist;
  return { r: local.r * scale, f: local.f * scale };
}

function toScreen(local: Local, radius: number, half: number): { x: number; y: number } {
  return {
    x: half + (local.r / radius) * half,
    y: half - (local.f / radius) * half,
  };
}

/** Heading-up minimap. OSM points are [east, north]; content z is -north. */
export function minimapSegments(
  roads: RoadLine[],
  player: { x: number; z: number; heading: number },
  size: number,
  radius: number,
  drivable: (highway: string) => boolean = (highway) => DRIVABLE.has(highway),
): MiniSeg[] {
  if (!(size > 0) || !(radius > 0)) return [];
  const basis = contentBasis(player.heading);
  const half = size / 2;
  const segs: MiniSeg[] = [];
  for (const road of roads) {
    if (!drivable(road.highway) || road.points.length < 2) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = toLocal(road.points[i][0], road.points[i][1], player, basis);
      const b = toLocal(road.points[i + 1][0], road.points[i + 1][1], player, basis);
      if (outside(a, radius) && outside(b, radius)) continue;
      const sa = toScreen(clampLocal(a, radius), radius, half);
      const sb = toScreen(clampLocal(b, radius), radius, half);
      segs.push({ x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y });
    }
  }
  return segs;
}

export function readout(state: {
  heading: number;
  health: number;
  driving: boolean;
  nearCar: boolean;
  pedInReach: boolean;
}): { compass: string; prompt: string | null; color: string } {
  return {
    compass: headingToCompass(state.heading),
    prompt: interactionPrompt(state),
    color: healthColor(state.health),
  };
}

export function faultBanner(fault: TileFault): { title: string; body: string } {
  return faultCopy(fault);
}
