// Rendering-only visibility falloff for mission/activity circles. Interaction
// radii, triggers, waypoint data and mission logic remain unchanged.
export function markerFade(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  if (distance <= 22) return 1;
  if (distance >= 125) return 0;
  const t=(125-distance)/103;
  return t*t*(3-2*t);
}
