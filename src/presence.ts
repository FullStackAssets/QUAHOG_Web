import type { ActorMode, PlanarPoint } from "./mission";

// Which body the gameplay queries should read. FollowCamera already follows the
// boat; mission checks, waypoints, and the big map used to keep reading the
// on-foot body, which is disabled at the dock while piloting.

export function activePlanarPosition(
  mode: ActorMode,
  bodies: { foot?: PlanarPoint | null; car?: PlanarPoint | null; boat?: PlanarPoint | null },
): PlanarPoint | null {
  if (mode === "car") return bodies.car ?? null;
  if (mode === "boat") return bodies.boat ?? null;
  return bodies.foot ?? null;
}

export function activeHeading(
  mode: ActorMode,
  headings: { foot: number; car: number; boat: number },
): number {
  if (mode === "car") return headings.car;
  if (mode === "boat") return headings.boat;
  return headings.foot;
}
