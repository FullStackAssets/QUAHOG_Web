// Saved-car recall (NB slice improvements, 2026-11-03): one tap summons the
// player's saved sports car (the Revuelto in v1). Called directly by the
// MY CAR touch button and by the KeyQ tap — it does NOT go through the
// key-tap pipeline from the button, so there is no key-code collision.
//
// There is exactly ONE player car body (shared.car). Stealing teleports that
// body, so recall cannot summon a second car: on foot the body is moved to
// the nearest roadside and the player auto-enters; in a car the body stays
// put and only its type/color swap (in-place restore). Damage is kept —
// recall is a summon, not a repair — and heat is untouched either way.

import { shared } from "../shared";
import { useGame, useToasts } from "../store";

// Drivable classes, mirroring ParkedCars' DRIVABLE set (motorway/link never
// qualify — the car must never be recalled onto the freeway).
const DRIVABLE = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street"]);
const RECALL_RADIUS = 150; // m — beyond this, guidance toast instead of a teleport

interface Roadside { x: number; z: number; yaw: number }

/** Nearest point on any drivable road segment to (x, z), within radius. */
export function nearestRoadside(x: number, z: number, radius = RECALL_RADIUS): Roadside | null {
  const slice = useGame.getState().slice;
  if (!slice) return null;
  let best: Roadside | null = null;
  let bestD = radius;
  for (const r of slice.roads) {
    if (!DRIVABLE.has(r.highway) || r.points.length < 2) continue;
    const off = r.width / 2 + 1.4; // same curb offset the parked builder uses
    for (let i = 0; i < r.points.length - 1; i++) {
      const ax = r.points[i][0], az = -r.points[i][1];
      const bx = r.points[i + 1][0], bz = -r.points[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
      const cx = ax + dx * t, cz = az + dz * t;
      const d = Math.hypot(x - cx, z - cz);
      if (d >= bestD) continue;
      const len = Math.sqrt(len2) || 1;
      const ux = dx / len, uz = dz / len;
      // Roadside on the player's side of the road, so the car appears beside
      // you rather than across the street.
      const side = (x - cx) * -uz + (z - cz) * ux >= 0 ? 1 : -1;
      bestD = d;
      best = { x: cx + -uz * off * side, z: cz + ux * off * side, yaw: Math.atan2(ux, uz) };
    }
  }
  return best;
}

export function recallSavedCar(): void {
  const game = useGame.getState();
  if (game.paused || game.mode === "boat") return; // hidden in boat mode
  const { savedCarType, savedCarColor } = game;
  const toasts = useToasts.getState();

  if (game.mode === "car") {
    if (game.playerCarType === savedCarType) return; // already driving it
    game.setPlayerCar(savedCarType, savedCarColor);
    toasts.push("MY CAR RESTORED", "#ffcf4a");
    return;
  }

  // On foot: teleport the car body to the nearest roadside, then get in.
  const player = shared.player;
  const car = shared.car;
  if (!player || !car) return;
  const p = player.translation();
  const spot = nearestRoadside(p.x, p.z);
  if (!spot) {
    toasts.push("NO ROAD NEARBY — MOVE CLOSER TO A STREET", "#ffcf4a");
    return;
  }
  car.setTranslation({ x: spot.x, y: 1.4, z: spot.z }, true);
  car.setLinvel({ x: 0, y: 0, z: 0 }, true);
  car.setRotation({ x: 0, y: Math.sin(spot.yaw / 2), z: 0, w: Math.cos(spot.yaw / 2) }, true);
  shared.carYaw = spot.yaw;
  game.setPlayerCar(savedCarType, savedCarColor);
  player.setEnabled(false);
  game.setNearCar(false);
  game.setMode("car");
  toasts.push("MY CAR", "#ffcf4a");
}
