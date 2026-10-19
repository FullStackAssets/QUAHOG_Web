import * as THREE from "three";
import type { Slice } from "../slice";

type RayBVH = THREE.Raycaster & { firstHitOnly?: boolean };

// Shared helpers for "walking on the photoreal tiles": everything lives inside a
// y-up content group nested in the ENU frame (anchored at the slice origin), so
// slice coords [east, north] map to content (x = east, z = -north) — identical to
// the game world. Ground height comes from raycasting the loaded tile meshes.

export const DRIVABLE = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary",
  "residential", "unclassified", "living_street", "service",
]);

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
// Scratch for followCam so the chase camera doesn't allocate two Vector3s per
// frame (it runs every frame in the photoreal build's hot loop).
const _off = new THREE.Vector3();
const _look = new THREE.Vector3();

/** ENU "up" direction in world space, from the content group's orientation.
 *  Returns a shared scratch vector — use it immediately, don't store across frames. */
export function frameUp(parent: THREE.Object3D): THREE.Vector3 {
  parent.getWorldQuaternion(_q);
  return _up.set(0, 1, 0).applyQuaternion(_q);
}

/** Surface height (content-space y) at content (x,z), or null if no tile yet.
 *  Allocation-free hot path (raycast accelerated by the tile BVH). */
export function groundY(
  parent: THREE.Object3D,
  group: THREE.Object3D | null | undefined,
  ray: THREE.Raycaster,
  x: number,
  z: number,
  up: THREE.Vector3,
): number | null {
  if (!group) return null;
  parent.localToWorld(_a.set(x, 0, z));
  ray.set(_a.addScaledVector(up, 180), _b.copy(up).negate());
  (ray as RayBVH).firstHitOnly = true;
  const hits = ray.intersectObject(group, true);
  return hits.length ? parent.worldToLocal(_c.copy(hits[0].point)).y : null;
}

/** Distance to the nearest wall ahead (content-space dir), or Infinity. Used to
 *  block walking/driving through the photoreal building meshes. */
export function forwardHit(
  parent: THREE.Object3D,
  group: THREE.Object3D | null | undefined,
  ray: THREE.Raycaster,
  originLocal: THREE.Vector3,
  dirContent: THREE.Vector3,
  maxDist: number,
): number {
  if (!group) return Infinity;
  parent.getWorldQuaternion(_q);
  parent.localToWorld(_a.copy(originLocal));
  _b.set(dirContent.x, 0, dirContent.z).applyQuaternion(_q).normalize();
  ray.set(_a, _b);
  (ray as RayBVH).firstHitOnly = true;
  ray.far = maxDist;
  const hits = ray.intersectObject(group, true);
  ray.far = Infinity;
  return hits.length ? hits[0].distance : Infinity;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Third-person chase camera (operates in content space, output to world). */
export function followCam(
  camera: THREE.Camera,
  parent: THREE.Object3D,
  up: THREE.Vector3,
  posLocal: THREE.Vector3,
  yaw: number,
  dist: number,
  height: number,
  t: number,
) {
  // localToWorld mutates + returns its argument, so feed it the scratch vectors
  // (no per-frame allocation). posLocal is only read, never mutated.
  const camW = parent.localToWorld(
    _off.set(-Math.sin(yaw) * dist, height, -Math.cos(yaw) * dist).add(posLocal),
  );
  camera.up.copy(up);
  camera.position.lerp(camW, t);
  const look = parent.localToWorld(_look.copy(posLocal).add(_a.set(0, 1.4, 0)));
  camera.lookAt(look);
}

/** A street point near Seamen's Bethel to spawn on, facing the chapel. */
export function computeSpawn(slice: Slice): { x: number; z: number; heading: number } {
  const bethel = slice.landmarks.find((l) => l.name === "Seamen's Bethel");
  const target = bethel ? bethel.pos : [0, 0];
  let best: { d: number; e: number; n: number } | null = null;
  for (const r of slice.roads) {
    if (!DRIVABLE.has(r.highway)) continue;
    for (const [e, n] of r.points) {
      const d = Math.hypot(e - target[0], n - target[1]);
      if (!best || d < best.d) best = { d, e, n };
    }
  }
  const e = best ? best.e : 0;
  const n = best ? best.n : 0;
  const x = e, z = -n;
  const tx = target[0], tz = -target[1];
  return { x, z, heading: Math.atan2(tx - x, tz - z) };
}
