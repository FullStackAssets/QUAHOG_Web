// Graphics quality presets — tune streaming radius, NPC density, and shadows.

export type Quality = 0 | 1 | 2;

export const QUALITY_LABELS = ["Low", "Medium", "High"] as const;

export function viewRadius(q: Quality): number {
  return [2, 3, 4][q];
}

export function collideRadius(q: Quality): number {
  return [1, 1, 2][q];
}

export function tileImpostor(q: Quality, ring: number, viewR: number): boolean {
  return q < 2 && ring >= viewR;
}

/** Ambient pedestrian count — iPhone Low keeps the crowd cheap. */
export function pedCount(q: Quality): number {
  return [16, 24, 32][q];
}

/** Ambient traffic car count. */
export function carCount(q: Quality): number {
  return [8, 14, 20][q];
}

/** Directional shadow map edge length (px). */
export function shadowMapSize(q: Quality): number {
  return [512, 1024, 2048][q];
}
