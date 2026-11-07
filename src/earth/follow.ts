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
const _zero = new THREE.Vector3();
// Scratch for cameras and probes. Callers use the results immediately; nothing
// here may be stored across a later call into this module.
const _off = new THREE.Vector3();
const _look = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _ov = new THREE.Vector3();
const _ov2 = new THREE.Vector3();

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
  const prevFar = ray.far;
  parent.localToWorld(_a.set(x, 0, z));
  ray.set(_a.addScaledVector(up, 180), _b.copy(up).negate());
  (ray as RayBVH).firstHitOnly = true;
  // 180 m above the query, plus margin. A finite far keeps a shared raycaster
  // from walking the whole tile tree when a BVH is missing.
  ray.far = 400;
  const hits = ray.intersectObject(group, true);
  ray.far = prevFar;
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

/** First-person camera in content space. Uses scratch vectors; `posLocal` is not mutated. */
export function firstPerson(
  camera: THREE.Camera,
  parent: THREE.Object3D,
  up: THREE.Vector3,
  posLocal: THREE.Vector3,
  heading: number,
  eye: number,
) {
  _ahead.set(Math.sin(heading), 0, Math.cos(heading));
  camera.up.copy(up);
  camera.position.copy(parent.localToWorld(_eye.copy(posLocal).setY(posLocal.y + eye)));
  parent.localToWorld(_look.copy(posLocal).setY(posLocal.y + eye).addScaledVector(_ahead, 12));
  camera.lookAt(_look);
}

/** Hold the spawn camera above the street until a ground sample exists. */
export function placeOverviewCamera(
  camera: THREE.Camera,
  parent: THREE.Object3D,
  up: THREE.Vector3,
  x: number,
  z: number,
) {
  camera.up.copy(up);
  camera.position.copy(parent.localToWorld(_ov.set(x, 90, z + 1)));
  camera.lookAt(parent.localToWorld(_ov2.set(x, 0, z)));
}

/** Planar separation in the xz content plane, written into `out`. */
export function awayInto(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  out.set(a.x - b.x, 0, a.z - b.z);
  return out.lengthSq() > 1e-6 ? out.normalize() : out.set(1, 0, 0);
}

/** Point and forward tangent at distance `d` along a polyline. Writes `point` and `dir`. */
export function sampleRoute(
  pts: THREE.Vector3[],
  total: number,
  distance: number,
  point: THREE.Vector3,
  dir: THREE.Vector3,
): void {
  if (pts.length < 2) {
    point.copy(pts[0] ?? _zero);
    dir.set(0, 0, 1);
    return;
  }
  let acc = 0;
  const d = Math.max(0, Math.min(distance, total));
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = pts[i].distanceTo(pts[i + 1]);
    if (acc + seg >= d || i === pts.length - 2) {
      const t = seg > 1e-4 ? THREE.MathUtils.clamp((d - acc) / seg, 0, 1) : 0;
      point.lerpVectors(pts[i], pts[i + 1], t);
      dir.subVectors(pts[i + 1], pts[i]);
      if (dir.lengthSq() > 1e-8) dir.normalize();
      else dir.set(0, 0, 1);
      return;
    }
    acc += seg;
  }
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
