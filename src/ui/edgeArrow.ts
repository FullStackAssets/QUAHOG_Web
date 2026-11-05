// Edge-clamped off-screen objective indicator (playtest 2026-11-02, A-01).
// The HUD bearing arrow rotates in place, but when the objective is behind
// the camera there is nothing at the screen edge telling the player which
// way to turn. When the bearing magnitude exceeds the camera's half-FOV
// (60° FOV → ~0.52 rad, plus a small margin), show a pill on the side the
// objective lies toward, with the distance.
export function normalizeRelativeBearing(rel: number): number {
  let r = rel % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function edgeArrowForBearing(rel: number, dist: number): { side: "left" | "right"; dist: number } | null {
  const r = normalizeRelativeBearing(rel);
  if (Math.abs(r) <= 0.6) return null;
  return { side: r > 0 ? "right" : "left", dist };
}
