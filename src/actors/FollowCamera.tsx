import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { useRef } from "react";
import { consumeTap } from "../input";
import { shared } from "../shared";
import { useGame } from "../store";
import { sim } from "../sim";
import type { CameraMode, Vec3 } from "../sim";

const _from: Vec3 = { x: 0, y: 0, z: 0 };
const _to: Vec3 = { x: 0, y: 0, z: 0 };
const _hit: Vec3 = { x: 0, y: 0, z: 0 };

// Chase camera (3rd person) / eye camera (1st person) via the independent
// CameraRig. Press V to toggle the view. Occlusion pulls the spring arm in
// when a world collider sits between the subject and the desired camera.
export function FollowCamera() {
  const camera = useThree((s) => s.camera);
  const { world, rapier } = useRapier();
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }));
  const seeded = useRef(false);

  useFrame((_, dt) => {
    const game = useGame.getState();
    if (consumeTap("KeyV")) game.toggleView();

    const mode = game.mode;
    const target = mode === "car" ? shared.car : mode === "boat" ? shared.boat : shared.player;
    if (!target) return;

    const tp = target.translation();
    const heading = mode === "car" ? shared.carYaw : mode === "boat" ? shared.boatYaw : shared.heading;

    let camMode: CameraMode = "foot";
    if (game.photo) camMode = "photo";
    else if (game.view === "first") camMode = "first";
    else if (mode === "car") camMode = "car";
    else if (mode === "boat") camMode = "boat";

    if (!seeded.current) {
      sim.camera.snap({ x: tp.x, y: tp.y, z: tp.z }, heading, camMode === "first" || camMode === "photo" ? "foot" : camMode);
      seeded.current = true;
    }

    shared.shake = Math.max(0, shared.shake - dt * 2.4);
    const shakeAmt = game.reduceShake ? 0 : shared.shake;

    const raycast = (from: Vec3, to: Vec3): Vec3 | null => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dz = to.z - from.z;
      const len = Math.hypot(dx, dy, dz);
      if (len < 0.5) return null;
      const r = ray.current;
      r.origin.x = from.x;
      r.origin.y = from.y;
      r.origin.z = from.z;
      r.dir.x = dx / len;
      r.dir.y = dy / len;
      r.dir.z = dz / len;
      const hit = world.castRay(r, len, true, undefined, undefined, undefined, target);
      if (!hit || hit.timeOfImpact >= len - 0.05) return null;
      _hit.x = from.x + r.dir.x * hit.timeOfImpact;
      _hit.y = from.y + r.dir.y * hit.timeOfImpact;
      _hit.z = from.z + r.dir.z * hit.timeOfImpact;
      return _hit;
    };

    // Keep scratch from being unused if tree-shaken oddly in some builds.
    void _from;
    void _to;

    const pose = sim.tickCamera(
      dt,
      { x: tp.x, y: tp.y, z: tp.z },
      heading,
      camMode,
      shared.carSpeed,
      game.fov,
      shakeAmt,
      camMode === "photo" || camMode === "first" ? undefined : raycast,
    );

    shared.camYaw = sim.camera.camYaw;
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);

    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - pose.fov) > 0.05) {
      cam.fov = pose.fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
