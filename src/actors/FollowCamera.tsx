import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { consumeTap } from "../input";
import { shared } from "../shared";
import { useGame } from "../store";
import { useRapier } from "@react-three/rapier";
import { resolveCameraObstruction } from "./cameraObstruction";
import { resolveCameraBuildingObstruction, pushCameraOutOfBuildings } from "./cameraBuildings";
import { useRef } from "react";
import { applyReviewCamera } from "../dev/visualReview";

const _shake = new THREE.Vector3();
let _photoYaw = 0;

function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Chase camera (3rd person) / eye camera (1st person), behind whichever actor is
// active. Press V to toggle the view.
export function FollowCamera() {
  const camera = useThree((s) => s.camera);
  const { world, rapier } = useRapier();
  const scratch = useRef({ pivot: new THREE.Vector3(), want: new THREE.Vector3(), last: new THREE.Vector3(), ready: false });

  useFrame((_, dt) => {
    if (import.meta.env.DEV && applyReviewCamera(camera)) return;
    const game = useGame.getState();
    if (consumeTap("KeyV")) game.toggleView();

    const mode = game.mode;
    const target = mode === "car" ? shared.car : mode === "boat" ? shared.boat : shared.player;
    if (!target) return;

    // photo mode: slow cinematic orbit around the subject (§24)
    if (game.photo) {
      const tp0 = target.translation();
      _photoYaw += dt * 0.25;
      camera.position.set(tp0.x + Math.sin(_photoYaw) * 11, tp0.y + 5, tp0.z + Math.cos(_photoYaw) * 11);
      camera.lookAt(tp0.x, tp0.y + 1.2, tp0.z);
      return;
    }

    // FOV widens with car speed for a sense of velocity (§13)
    const cam = camera as THREE.PerspectiveCamera;
    const speedT = mode === "car" ? THREE.MathUtils.clamp(Math.abs(shared.carSpeed) / 22, 0, 1) : 0;
    const wantFov = game.fov + speedT * 14; // user FOV preference + speed widening
    if (Math.abs(cam.fov - wantFov) > 0.05) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, wantFov, 1 - Math.exp(-dt * 4));
      cam.updateProjectionMatrix();
    }

    // decaying camera shake (§23): one-shot impulses only (melee, crashes) so
    // ordinary driving stays perfectly smooth.
    shared.shake = Math.max(0, shared.shake - dt * 2.4);
    const shakeAmt = game.reduceShake ? 0 : shared.shake;

    const tp = target.translation();
    const heading = mode === "car" ? shared.carYaw : mode === "boat" ? shared.boatYaw : shared.heading;
    shared.camYaw = lerpAngle(shared.camYaw, heading, 1 - Math.exp(-dt * 3.5));

    if (game.view === "first") {
      const eyeH = mode === "car" ? 1.2 : 1.6;
      const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      camera.position.set(tp.x + f.x * 0.25, tp.y + eyeH, tp.z + f.z * 0.25);
      if (shakeAmt > 0.001) {
        _shake.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(shakeAmt * 0.4);
        camera.position.add(_shake);
      }
      camera.lookAt(tp.x + f.x * 12, tp.y + eyeH, tp.z + f.z * 12);
      return;
    }

    const yaw = shared.camYaw;
    const dist = mode === "car" ? 13 : mode === "boat" ? 16 : 8;
    const height = mode === "car" ? 6 : mode === "boat" ? 7 : 4.5;
    const { pivot, want, last } = scratch.current;
    pivot.set(tp.x, tp.y + 1.5, tp.z);
    want.set(
      tp.x - Math.sin(yaw) * dist,
      tp.y + height,
      tp.z - Math.cos(yaw) * dist,
    );
    // Cover the near-plane corners at the current FOV/aspect, including wide phones.
    const radius = Math.max(0.4, cam.near * Math.sqrt(1 + (1 + cam.aspect ** 2) * Math.tan(cam.fov * Math.PI / 360) ** 2) + 0.05);
    resolveCameraObstruction(world, rapier, pivot, want, radius);
    // Camera-inside-building fix (2026-11-03): the Rapier sweep above only
    // sees FIXED bodies, and buildings outside the collider radius are
    // visual-only. Clamp the same segment against shipped footprints so the
    // camera cannot follow the player through a wall-less volume.
    resolveCameraBuildingObstruction(pivot, want, radius);
    // Teleports reset immediately; ordinary movement expands smoothly.
    if (!scratch.current.ready || last.distanceToSquared(pivot) > 25 ** 2) camera.position.copy(want);
    else camera.position.lerp(want, 1 - Math.exp(-Math.min(dt, 0.1) * 6));
    if (shakeAmt > 0.001) {
      _shake.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(shakeAmt * 0.6);
      camera.position.add(_shake);
    }
    // Re-sweep AFTER smoothing/shake so corners cannot pull us behind the wall.
    resolveCameraObstruction(world, rapier, pivot, camera.position, radius);
    resolveCameraBuildingObstruction(pivot, camera.position, radius);
    // Playtest fix (2026-11-02): entering a car snapped the camera through
    // the car body (dynamic bodies are excluded from the obstruction sweep),
    // filling the screen with the hood. Never let the chase camera sit
    // inside the actor's own body — push it out to a minimum standoff.
    const minStandoff = mode === "car" ? 3.4 : mode === "boat" ? 4.5 : 1.0;
    const offX = camera.position.x - pivot.x, offY = camera.position.y - pivot.y, offZ = camera.position.z - pivot.z;
    const offLen = Math.hypot(offX, offY, offZ);
    if (offLen > 0.0001 && offLen < minStandoff) {
      const k = minStandoff / offLen;
      camera.position.set(pivot.x + offX * k, pivot.y + offY * k, pivot.z + offZ * k);
    }
    // Camera-inside-building fix (2026-11-03): the standoff push above scales
    // the offset outward and can shove the camera THROUGH a nearby wall the
    // sweeps had correctly clamped against — re-sweep after it, then push
    // out of any volume the camera still sits inside (both-inside case).
    resolveCameraObstruction(world, rapier, pivot, camera.position, radius);
    resolveCameraBuildingObstruction(pivot, camera.position, radius);
    pushCameraOutOfBuildings(camera.position, radius);
    if (camera.position.distanceToSquared(pivot) < 0.12) {
      // Close obstruction: usable eye view rather than looking into the actor.
      camera.lookAt(tp.x + Math.sin(yaw) * 12, tp.y + 1.5, tp.z + Math.cos(yaw) * 12);
    } else camera.lookAt(pivot);
    scratch.current.ready = true;
    last.copy(pivot);
  });

  return null;
}
