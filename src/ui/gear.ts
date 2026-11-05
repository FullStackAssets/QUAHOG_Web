// Gear label for the HUD speed readout (playtest 2026-11-02, A-03).
// The car has no gearbox state; gear is derived from signed speed:
// forward → D, reverse → R, near-stopped → N.
export function gearForSpeed(v: number): "D" | "R" | "N" {
  if (v > 0.5) return "D";
  if (v < -0.5) return "R";
  return "N";
}
