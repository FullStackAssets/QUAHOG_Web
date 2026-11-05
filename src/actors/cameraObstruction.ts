import type RAPIER from "@dimforge/rapier3d-compat";
import type { Vector3 } from "three";
// Reused shape/vector: two broadphase queries per chase frame, no scene traversal.
let sphere: RAPIER.Ball | undefined;
const direction = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0, w: 1 };
export function resolveCameraObstruction(world: RAPIER.World, rapier: typeof RAPIER, pivot: Vector3, end: Vector3, radius: number): void {
  const length = pivot.distanceTo(end);
  if (length < 0.0001) return;
  sphere ??= new rapier.Ball(radius);
  sphere.radius = radius;
  direction.x = (end.x - pivot.x) / length;
  direction.y = (end.y - pivot.y) / length;
  direction.z = (end.z - pivot.z) / length;
  const flags = rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_KINEMATIC;
  const hit = world.castShape(pivot, rotation, direction, sphere, 0, length, true, flags);
  if (!hit) return;
  // No minimum-distance clamp: it could push the camera through a nearby wall.
  const distance = Math.max(0, hit.time_of_impact - 0.06);
  end.set(pivot.x + direction.x * distance, pivot.y + direction.y * distance, pivot.z + direction.z * distance);
}
