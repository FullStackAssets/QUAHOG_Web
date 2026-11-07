/**
 * Collision-aware chase camera: spring-arm desire pose + occlusion pull-in.
 * Allocation-light; pose written into caller-owned buffers.
 */

import type { CameraMode, CameraPose, Vec3 } from "./types";
import { clamp, copyVec3, expSmooth, lerp, lerpAngle } from "./math";

export type OcclusionRaycast = (from: Vec3, to: Vec3) => Vec3 | null;

export interface CameraRigOptions {
  footDist?: number;
  footHeight?: number;
  carDist?: number;
  carHeight?: number;
  boatDist?: number;
  boatHeight?: number;
  lookHeight?: number;
  followRate?: number;
  yawRate?: number;
  /** Keep this many metres off the hit surface when occluded. */
  occlusionPadding?: number;
  /** Speed (m/s) at which FOV boost saturates. */
  fovSpeedRef?: number;
  fovBoost?: number;
}

export class CameraRig {
  private yaw = 0;
  private pose: CameraPose = {
    position: { x: 0, y: 5, z: 10 },
    lookAt: { x: 0, y: 1.5, z: 0 },
    fov: 60,
  };
  private opts: Required<CameraRigOptions>;
  private photoYaw = 0;

  constructor(opts: CameraRigOptions = {}) {
    this.opts = {
      footDist: opts.footDist ?? 7,
      footHeight: opts.footHeight ?? 4,
      carDist: opts.carDist ?? 12,
      carHeight: opts.carHeight ?? 5.5,
      boatDist: opts.boatDist ?? 16,
      boatHeight: opts.boatHeight ?? 7,
      lookHeight: opts.lookHeight ?? 1.5,
      followRate: opts.followRate ?? 6,
      yawRate: opts.yawRate ?? 3,
      occlusionPadding: opts.occlusionPadding ?? 0.6,
      fovSpeedRef: opts.fovSpeedRef ?? 22,
      fovBoost: opts.fovBoost ?? 14,
    };
  }

  get current(): CameraPose {
    return this.pose;
  }

  get camYaw(): number {
    return this.yaw;
  }

  setYaw(yaw: number): void {
    this.yaw = yaw;
  }

  /**
   * Advance the rig. `speed` is signed forward speed for FOV (cars).
   * `baseFov` is the user preference. `shake` is a decaying impulse magnitude.
   */
  update(
    dt: number,
    follow: Vec3,
    heading: number,
    mode: CameraMode,
    speed: number,
    baseFov: number,
    shake = 0,
    raycast?: OcclusionRaycast,
  ): CameraPose {
    if (mode === "photo") {
      this.photoYaw += dt * 0.25;
      this.pose.position.x = follow.x + Math.sin(this.photoYaw) * 11;
      this.pose.position.y = follow.y + 5;
      this.pose.position.z = follow.z + Math.cos(this.photoYaw) * 11;
      this.pose.lookAt.x = follow.x;
      this.pose.lookAt.y = follow.y + 1.2;
      this.pose.lookAt.z = follow.z;
      return this.pose;
    }

    this.yaw = lerpAngle(this.yaw, heading, expSmooth(dt, this.opts.yawRate));

    const speedT = mode === "car" ? clamp(Math.abs(speed) / this.opts.fovSpeedRef, 0, 1) : 0;
    const wantFov = baseFov + speedT * this.opts.fovBoost;
    this.pose.fov = lerp(this.pose.fov, wantFov, expSmooth(dt, 4));

    if (mode === "first") {
      const eyeH = 1.2; // car/boat/foot share a compact first-person eye
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      this.pose.position.x = follow.x + fx * 0.25;
      this.pose.position.y = follow.y + eyeH;
      this.pose.position.z = follow.z + fz * 0.25;
      this.applyShake(shake * 0.4);
      this.pose.lookAt.x = follow.x + fx * 12;
      this.pose.lookAt.y = follow.y + eyeH;
      this.pose.lookAt.z = follow.z + fz * 12;
      return this.pose;
    }

    const dist =
      mode === "car" ? this.opts.carDist : mode === "boat" ? this.opts.boatDist : this.opts.footDist;
    const height =
      mode === "car"
        ? this.opts.carHeight
        : mode === "boat"
          ? this.opts.boatHeight
          : this.opts.footHeight;

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const desired: Vec3 = {
      x: follow.x - fx * dist,
      y: follow.y + height,
      z: follow.z - fz * dist,
    };

    // Occlusion: if something sits between the look target and desired camera,
    // pull the camera to the hit point (plus padding toward the subject).
    if (raycast) {
      const look: Vec3 = {
        x: follow.x,
        y: follow.y + this.opts.lookHeight,
        z: follow.z,
      };
      const hit = raycast(look, desired);
      if (hit) {
        const hx = desired.x - look.x;
        const hy = desired.y - look.y;
        const hz = desired.z - look.z;
        const len = Math.hypot(hx, hy, hz) || 1;
        const ux = hx / len;
        const uy = hy / len;
        const uz = hz / len;
        // Place just short of the hit, along the look→desired axis.
        const hitDist = Math.hypot(hit.x - look.x, hit.y - look.y, hit.z - look.z);
        const pull = Math.max(1.2, hitDist - this.opts.occlusionPadding);
        desired.x = look.x + ux * pull;
        desired.y = look.y + uy * pull;
        desired.z = look.z + uz * pull;
      }
    }

    const t = expSmooth(dt, this.opts.followRate);
    this.pose.position.x = lerp(this.pose.position.x, desired.x, t);
    this.pose.position.y = lerp(this.pose.position.y, desired.y, t);
    this.pose.position.z = lerp(this.pose.position.z, desired.z, t);
    this.applyShake(shake * 0.6);

    this.pose.lookAt.x = follow.x;
    this.pose.lookAt.y = follow.y + this.opts.lookHeight;
    this.pose.lookAt.z = follow.z;
    return this.pose;
  }

  private applyShake(amt: number): void {
    if (amt <= 0.001) return;
    this.pose.position.x += (Math.random() - 0.5) * amt;
    this.pose.position.y += (Math.random() - 0.5) * amt;
    this.pose.position.z += (Math.random() - 0.5) * amt;
  }

  /** Seed pose without easing (spawn / teleport). */
  snap(follow: Vec3, heading: number, mode: CameraMode): void {
    this.yaw = heading;
    copyVec3(this.pose.lookAt, {
      x: follow.x,
      y: follow.y + this.opts.lookHeight,
      z: follow.z,
    });
    const dist =
      mode === "car" ? this.opts.carDist : mode === "boat" ? this.opts.boatDist : this.opts.footDist;
    const height =
      mode === "car"
        ? this.opts.carHeight
        : mode === "boat"
          ? this.opts.boatHeight
          : this.opts.footHeight;
    this.pose.position.x = follow.x - Math.sin(heading) * dist;
    this.pose.position.y = follow.y + height;
    this.pose.position.z = follow.z - Math.cos(heading) * dist;
  }
}
