/** Pure production asset policy, deliberately decoupled from React and Three.js.
 * Values are conservative until measured against an actual iPhone Safari session.
 */
export const ASSET_LOAD_CONCURRENCY = 3;
export const ASSET_VISIBILITY_HYSTERESIS_METERS = 24;
export const ASSET_FAILURE_BACKOFF_MS = 30_000;
export const GLB_VEHICLE_X_ROTATION = Math.PI / 2;

/** P006 source GLBs use X across the car, +Y forward, and -Z up.
 * Rotate +90 degrees around X to reach Three.js world +Z forward and +Y up.
 * Other packs use the expected Y-up convention and must not be rotated this way.
 */
export function sourceBasisRotation(path: string): [number, number, number] {
  return path.startsWith("/quahog-assets/P006/")
    ? [GLB_VEHICLE_X_ROTATION, 0, 0]
    : [0, 0, 0];
}

export function shouldRenderDetailedModel(
  distanceMeters: number,
  wasNear: boolean,
  radiusMeters: number,
): boolean {
  if (!Number.isFinite(distanceMeters) || radiusMeters <= 0) return false;
  return distanceMeters <= radiusMeters + (wasNear ? ASSET_VISIBILITY_HYSTERESIS_METERS : 0);
}

/** The number of *decorative* harbor boats that may use decoded GLB geometry.
 * No physics entities or authoritative mission objects are created or removed.
 */
export function detailedHarborBoatLimit(quality: number, mobile: boolean): number {
  const tier = Math.min(2, Math.max(0, Math.floor(quality)));
  return (mobile ? [2, 5, 8] : [5, 10, 16])[tier];
}

/** Mobile browsers receive a smaller distance budget, without changing the
 * desktop view or the original procedural fallback. No network probe needed.
 * Only the camera-relative decorative GLB detail radius is adjusted.
 */
export function mobileModelRadius(baseMeters: number, quality: number, mobile: boolean): number {
  if (!Number.isFinite(baseMeters) || baseMeters <= 0) return 0;
  const tier = Math.max(0, Math.min(2, Math.floor(Number.isFinite(quality) ? quality : 0)));
  return baseMeters * (mobile ? [0.55, 0.75, 1][tier] : 1);
}

/** A fixed number of novel detail models per quality tier. Limits are per
 * placement family, not extra objects: remaining positions use the same
 * original instanced geometry and maintain road/sidewalk appearance.
 */
export function streetDetailLimit(quality: number, mobile: boolean): number {
  const tier = Math.max(0, Math.min(2, Math.floor(Number.isFinite(quality) ? quality : 0)));
  return (mobile ? [2, 4, 6] : [4, 6, 8])[tier];
}
