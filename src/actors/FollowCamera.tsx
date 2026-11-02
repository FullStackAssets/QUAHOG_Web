import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { consumeTap } from "../input";
import { shared } from "../shared";
import { useGame, type Mode } from "../store";

// Scratch objects are reused every frame to keep GC pressure off mobile Safari.
const focus = new THREE.Vector3();
const desired = new THREE.Vector3();
const direction = new THREE.Vector3();
const shake = new THREE.Vector3();
const candidate = new THREE.Vector3();
let photoYaw = 0;

function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// The camera lives INSIDE <Physics> so it sees the same wall/building colliders
// as the player. Visual utility poles are tested separately against instanced
// geometry; they do not need to block vehicle movement.
export function FollowCamera() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const { world, rapier } = useRapier();
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }));
  const visualRay = useRef(new THREE.Raycaster());
  const poles = useRef<THREE.Object3D | null>(null);
  const poleLookup = useRef(0);
  const previousMode = useRef<Mode | null>(null);

  useFrame((_, dt) => {
    const game = useGame.getState();
    if (consumeTap("KeyV")) game.toggleView();

    const mode = game.mode;
    const target = mode === "car" ? shared.car : mode === "boat" ? shared.boat : shared.player;
    if (!target) return;
    const tp = target.translation();
    const heading = mode === "car" ? shared.carYaw : mode === "boat" ? shared.boatYaw : shared.heading;

    // Keep cinematic orbit available without permanently changing the chase rig.
    if (game.photo) {
      photoYaw += dt * 0.25;
      camera.position.set(tp.x + Math.sin(photoYaw) * 11, tp.y + 5, tp.z + Math.cos(photoYaw) * 11);
      camera.lookAt(tp.x, tp.y + 1.2, tp.z);
      previousMode.current = null;
      return;
    }

    const cam = camera as THREE.PerspectiveCamera;
    const speed = mode === "car" ? THREE.MathUtils.clamp(Math.abs(shared.carSpeed) / 22, 0, 1) : 0;
    const targetFov = game.fov + speed * 14;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-dt * 4));
      cam.updateProjectionMatrix();
    }

    shared.shake = Math.max(0, shared.shake - dt * 2.4);
    const shakeAmount = game.reduceShake ? 0 : shared.shake;
    const modeChanged = previousMode.current !== mode;
    if (modeChanged) {
      previousMode.current = mode;
      // Retarget at vehicle entry immediately: do not interpolate THROUGH
      // the red hood from the on-foot camera position.
      shared.camYaw = heading;
    } else {
      shared.camYaw = lerpAngle(shared.camYaw, heading, 1 - Math.exp(-dt * 3));
    }

    if (game.view === "first") {
      const eyeHeight = mode === "car" ? 1.2 : 1.6;
      const fx = Math.sin(heading), fz = Math.cos(heading);
      camera.position.set(tp.x + fx * 0.25, tp.y + eyeHeight, tp.z + fz * 0.25);
      if (shakeAmount > 0.001) {
        shake.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .multiplyScalar(shakeAmount * 0.4);
        camera.position.add(shake);
      }
      camera.lookAt(tp.x + fx * 12, tp.y + eyeHeight, tp.z + fz * 12);
      return;
    }

    const yaw = shared.camYaw;
    const distance = mode === "car" ? 12 : mode === "boat" ? 16 : 8;
    const height = mode === "car" ? 5.8 : mode === "boat" ? 7 : 4.5;
    focus.set(tp.x, tp.y + 1.5, tp.z);
    desired.set(
      tp.x - Math.sin(yaw) * distance,
      tp.y + height,
      tp.z - Math.cos(yaw) * distance,
    );

    direction.copy(desired).sub(focus);
    const length = direction.length();
    if (length > 0.01) direction.multiplyScalar(1 / length);

    // First-hit sweep to the desired chase-camera position.
    // Exclude the actor being followed to avoid the car blocking its own camera.
    const r = ray.current;
    r.origin.x = focus.x; r.origin.y = focus.y; r.origin.z = focus.z;
    r.dir.x = direction.x; r.dir.y = direction.y; r.dir.z = direction.z;
    const wallHit = world.castRay(r, length, true, undefined, undefined, undefined, target);
    let allowed = wallHit ? Math.max(1, wallHit.timeOfImpact - 0.65) : length;

    // Instanced wooden poles are visual objects outside Rapier. Check these
    // without generating hundreds of physical rigid bodies.
    poleLookup.current++;
    if (!poles.current || poleLookup.current % 90 === 0) {
      poles.current = scene.getObjectByName("quahog-camera-poles") ?? null;
    }
    if (poles.current) {
      const test = visualRay.current;
      test.ray.origin.copy(focus);
      test.ray.direction.copy(direction);
      test.near = 0.1;
      test.far = Math.min(allowed, length);
      const hits = test.intersectObject(poles.current, false);
      if (hits.length) allowed = Math.min(allowed, Math.max(1, hits[0].distance - 0.65));
    }

    candidate.copy(focus).addScaledVector(direction, Math.min(length, allowed));
    if (modeChanged || allowed < length - 0.1) {
      // Snapping when blocked is safer than easing through a wall for half a second.
      camera.position.copy(candidate);
    } else {
      camera.position.lerp(candidate, 1 - Math.exp(-dt * 5));
    }
    if (shakeAmount > 0.001) {
      shake.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .multiplyScalar(shakeAmount * 0.6);
      camera.position.add(shake);
    }
    camera.lookAt(focus);
  });

  return null;
}
