import * as THREE from "three";

// TRD compatible piece (Nic, 2026-11-02): a color-grading LUT for the post
// stack. Deliberately tint-free: the Effects stack already grades warm/cool by
// time of day (HueSaturation + BrightnessContrast), so a static tint here
// would fight the night grade. This LUT only adds a gentle filmic S-curve
// (shadows a touch darker, highlights a touch brighter) on top of the ACES
// tone mapping already on the renderer (App.tsx).
//
// The curve is small on purpose: max deviation from identity is ~0.015, so
// the grade reads as "filmic" rather than "filtered". Reversible: delete the
// <LUT> line in Effects.tsx and this file is dead code.

export const GRADE_SIZE = 32;

/** Gentle S-curve: curve(0.25) < 0.25, curve(0.75) > 0.75, endpoints fixed. */
export function gradeCurve(x: number): number {
  const c = THREE.MathUtils.clamp(x, 0, 1);
  return THREE.MathUtils.clamp(c + 0.08 * (c * (1 - c)) * (c - 0.5) * 4, 0, 1);
}

let cached: THREE.Data3DTexture | null = null;

/** 32^3 RGBA8 3D LUT. Same curve on all three channels (no tint). */
export function createGradingLut(): THREE.Data3DTexture {
  if (cached) return cached;
  const n = GRADE_SIZE;
  const data = new Uint8Array(n * n * n * 4);
  let i = 0;
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        data[i++] = Math.round(gradeCurve(r / (n - 1)) * 255);
        data[i++] = Math.round(gradeCurve(g / (n - 1)) * 255);
        data[i++] = Math.round(gradeCurve(b / (n - 1)) * 255);
        data[i++] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, n, n, n);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
