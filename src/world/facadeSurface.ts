// Procedural façade surfaces for the active blockout (streamed OSM tiles and the
// GIS district overlay). These maps are painted in code. They are not photographs,
// they contain no lettering, and they do not describe a measured device run.
//
// Relief is a tangent-space normal on the existing extruded shell. It does not
// add triangles, and it does not change collider positions. Far merged chunks
// skip that normal: building tangents for a whole city cell was not budgeted
// and has not been timed on a phone.
//
// Glass stays dielectric and only moderately smooth. The scene IBL is the
// procedural RoomEnvironment, not a waterfront capture; a mirror roughness would
// reflect that room probe. Hand-authored Seamen's Bethel and any held GLB are
// outside this module.

export const FACADE_CELL = 128;
export const FACADE_MARGIN_X = 30;
export const FACADE_MARGIN_Y = 20;
export const FACADE_FRAME_PX = 4;
export const FACADE_MULLION_PX = 3;
export const FACADE_MEETING_RAIL_PX = 4;
export const FACADE_FLOOR_M = 3.2;
/** Corner texel of the cell: bare wall, so roofs and parapets do not grow windows. */
export const PLAIN_FACADE_UV = 0.04;

/** Decoded-normal scale on the material. Kept under 1 so courses do not alias. */
export const FACADE_RELIEF_SCALE = 0.65;
/** Below the road maps' anisotropy. Façades cover the city; cost is unmeasured. */
export const FACADE_ANISOTROPY = 8;

export const FACADE_WALL_ROUGHNESS = 0.93;
export const FACADE_FRAME_ROUGHNESS = 0.66;
export const FACADE_SILL_ROUGHNESS = 0.8;
/** Dirty dielectric glass, not a mirror and not metal. */
export const FACADE_GLASS_ROUGHNESS = 0.28;
export const FACADE_METALNESS = 0;
export const FACADE_WINDOW_GLOW = "#ffcf8a";

const PX = 1 / FACADE_CELL;
const FRAME = FACADE_FRAME_PX * PX;

/** Sash opening in UV space, v up. Matches the albedo canvas after flipY. */
export const FACADE_OPENING = {
  u0: FACADE_MARGIN_X / FACADE_CELL,
  u1: (FACADE_CELL - FACADE_MARGIN_X) / FACADE_CELL,
  v0: FACADE_MARGIN_Y / FACADE_CELL,
  v1: (FACADE_CELL - FACADE_MARGIN_Y) / FACADE_CELL,
} as const;

export type FacadeZone = "wall" | "frame" | "sill" | "glass";

export interface FacadeSample {
  zone: FacadeZone;
  roughness: number;
  metalness: number;
  /** Tangent-space normal, +Z out of the wall. */
  normal: [number, number, number];
}

export interface FacadeRgb {
  r: number;
  g: number;
  b: number;
}

function wrap01(n: number): number {
  const f = n % 1;
  return f < 0 ? f + 1 : f;
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function onMuntin(fu: number, fv: number): boolean {
  const { u0, u1, v0, v1 } = FACADE_OPENING;
  const midU = (u0 + u1) / 2;
  if (Math.abs(fu - midU) <= (FACADE_MULLION_PX / 2) * PX && fv >= v0 && fv <= v1) return true;
  const hPx = FACADE_CELL - FACADE_MARGIN_Y * 2;
  const rails: [number, number][] = [
    [FACADE_MARGIN_Y + hPx / 3, FACADE_MULLION_PX / 2],
    [FACADE_MARGIN_Y + hPx / 2, FACADE_MEETING_RAIL_PX / 2],
    [FACADE_MARGIN_Y + (2 * hPx) / 3, FACADE_MULLION_PX / 2],
  ];
  for (const [imageY, halfPx] of rails) {
    const vLine = 1 - imageY / FACADE_CELL;
    if (Math.abs(fv - vLine) <= halfPx * PX && fu >= u0 && fu <= u1) return true;
  }
  return false;
}

function bevelNormal(fu: number, fv: number): [number, number, number] {
  const { u0, u1, v0, v1 } = FACADE_OPENING;
  let nx = 0;
  let ny = 0;
  if (fu < u0) nx += 1;
  else if (fu > u1) nx -= 1;
  if (fv < v0) ny += 1;
  else if (fv > v1) ny -= 1;
  // 0.72 keeps the casing readable while Z stays the outward axis.
  return normalize(nx * 0.72, ny * 0.72, 1);
}

/** One repeat of the façade cell. Deterministic; no image files. */
export function sampleFacade(u: number, v: number): FacadeSample {
  const fu = wrap01(u);
  const fv = wrap01(v);
  const { u0, u1, v0, v1 } = FACADE_OPENING;
  const inOpening = fu >= u0 && fu <= u1 && fv >= v0 && fv <= v1;
  if (inOpening) {
    if (onMuntin(fu, fv)) {
      return { zone: "frame", roughness: FACADE_FRAME_ROUGHNESS, metalness: FACADE_METALNESS, normal: [0, 0, 1] };
    }
    return { zone: "glass", roughness: FACADE_GLASS_ROUGHNESS, metalness: FACADE_METALNESS, normal: [0, 0, 1] };
  }

  const inFrame =
    fu >= u0 - FRAME && fu <= u1 + FRAME &&
    fv >= v0 - FRAME && fv <= v1 + FRAME;
  if (inFrame) {
    const normal = bevelNormal(fu, fv);
    const sill = fv < v0 && fu >= u0 - FRAME && fu <= u1 + FRAME;
    if (sill) {
      return { zone: "sill", roughness: FACADE_SILL_ROUGHNESS, metalness: FACADE_METALNESS, normal };
    }
    return { zone: "frame", roughness: FACADE_FRAME_ROUGHNESS, metalness: FACADE_METALNESS, normal };
  }

  // Faint horizontal courses. Same cell for brick-red and clapboard tints;
  // vertex color carries the palette, this map does not.
  const ny = Math.sin(fv * 6 * Math.PI * 2) * 0.12;
  return {
    zone: "wall",
    roughness: FACADE_WALL_ROUGHNESS,
    metalness: FACADE_METALNESS,
    normal: normalize(0, ny, 1),
  };
}

export function isRoofNormal(ny: number): boolean {
  return Math.abs(ny) > 0.5;
}

/** Wall UVs tile one cell per floor. Roofs and undersides stay on the plain texel. */
export function facadeUv(
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
): [number, number] {
  if (isRoofNormal(ny)) return [PLAIN_FACADE_UV, PLAIN_FACADE_UV];
  const horiz = Math.abs(nx) > Math.abs(nz) ? z : x;
  return [horiz / FACADE_FLOOR_M, y / FACADE_FLOOR_M];
}

interface FacadeAttr {
  count: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
}

/** Colour + UV for an extruded shell. Does not read or write positions. */
export function paintFacadeAttributes(
  position: FacadeAttr,
  normal: FacadeAttr,
  wall: FacadeRgb,
  roof: FacadeRgb,
): { color: Float32Array; uv: Float32Array } {
  const color = new Float32Array(position.count * 3);
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    writeFacadeVertex(
      i,
      position.getX(i), position.getY(i), position.getZ(i),
      normal.getX(i), normal.getY(i), normal.getZ(i),
      wall, roof, color, uv,
    );
  }
  return { color, uv };
}

export function writeFacadeVertex(
  index: number,
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  wall: FacadeRgb,
  roof: FacadeRgb,
  colors: Float32Array,
  uv: Float32Array,
): void {
  const c = isRoofNormal(ny) ? roof : wall;
  colors[index * 3] = c.r;
  colors[index * 3 + 1] = c.g;
  colors[index * 3 + 2] = c.b;
  const [u, v] = facadeUv(x, y, z, nx, ny, nz);
  uv[index * 2] = u;
  uv[index * 2 + 1] = v;
}

/**
 * Dusk gate used by the GIS / fallback blockouts. Returns the masked-window
 * intensity (1 at night). The previous 0.4 factor compensated for the whole
 * box emitting; the emissive map already zeroes the wall.
 */
export function facadeBlockoutGlow(dayT: number): number {
  const x = Math.min(1, Math.max(0, dayT));
  let t: number;
  if (x <= 0) t = 0;
  else if (x >= 0.3) t = 1;
  else {
    const u = x / 0.3;
    t = u * u * (3 - 2 * u);
  }
  return 1 - t;
}

/** Streamed tiles: linear night ramp. Unchanged from the previous material. */
export function facadeStreamGlow(dayT: number): number {
  return 1 - Math.min(1, Math.max(0, dayT));
}

/** Byte offset in a top-row-first image. Upload with flipY so row 0 is v = 1. */
export function facadeTexelOffset(u: number, v: number, size: number): number {
  const x = Math.min(size - 1, Math.floor(wrap01(u) * size));
  let y = Math.floor((1 - wrap01(v)) * size);
  if (y < 0) y = 0;
  if (y >= size) y = size - 1;
  return (y * size + x) * 4;
}

/** Sample at the center of the texel `facadeTexelOffset` selects. */
export function facadeRasterSample(u: number, v: number, size: number): FacadeSample {
  const o = facadeTexelOffset(u, v, size) / 4;
  const x = o % size;
  const y = Math.floor(o / size);
  return sampleFacade((x + 0.5) / size, 1 - (y + 0.5) / size);
}

function packRoughness(sample: FacadeSample): [number, number, number, number] {
  const g = Math.round(Math.min(1, Math.max(0, sample.roughness)) * 255);
  // MeshStandardMaterial reads roughness from the green channel.
  return [g, g, g, 255];
}

function packRelief(sample: FacadeSample): [number, number, number, number] {
  const enc = (n: number) => Math.round((Math.min(1, Math.max(-1, n)) * 0.5 + 0.5) * 255);
  const [nx, ny, nz] = sample.normal;
  return [enc(nx), enc(ny), enc(nz), 255];
}

function rasterize(
  size: number,
  pack: (sample: FacadeSample) => [number, number, number, number],
): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const cv = 1 - (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const px = pack(sampleFacade((x + 0.5) / size, cv));
      const o = (y * size + x) * 4;
      data[o] = px[0];
      data[o + 1] = px[1];
      data[o + 2] = px[2];
      data[o + 3] = px[3];
    }
  }
  return data;
}

export function facadeRoughnessImage(size = FACADE_CELL): Uint8Array {
  return rasterize(size, packRoughness);
}

export function facadeReliefImage(size = FACADE_CELL): Uint8Array {
  return rasterize(size, packRelief);
}
