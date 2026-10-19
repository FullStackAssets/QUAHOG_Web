import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { consumeTap } from "../input";
import { shared } from "../shared";
import { useGame } from "../store";

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

  useFrame((_, dt) => {
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
    shared.camYaw = lerpAngle(shared.camYaw, heading, 1 - Math.exp(-dt * 3));

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
    const dist = mode === "car" ? 12 : mode === "boat" ? 16 : 7;
    const height = mode === "car" ? 5.5 : mode === "boat" ? 7 : 4;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const want = new THREE.Vector3(
      tp.x - fwd.x * dist,
      tp.y + height,
      tp.z - fwd.z * dist,
    );
    camera.position.lerp(want, 1 - Math.exp(-dt * 6));
    if (shakeAmt > 0.001) {
      _shake.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(shakeAmt * 0.6);
      camera.position.add(_shake);
    }
    camera.lookAt(tp.x, tp.y + 1.5, tp.z);
  });

  return null;
}
