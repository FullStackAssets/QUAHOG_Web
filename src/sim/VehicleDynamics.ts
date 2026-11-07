/**
 * Arcade vehicle longitudinal / yaw helpers (independent Mount Hope tuning).
 * Pure functions so Car.tsx can adopt them without Rapier coupling in tests.
 */

import { clamp, expSmooth, lerp } from "./math";
import type { VehicleDynamicsState, VehicleInput } from "./types";

export interface VehicleTuning {
  maxSpeed: number;
  reverseSpeed: number;
  steerRate: number;
  accelRate: number;
  coastRate: number;
  handbrakeRate: number;
  /** Speed (m/s) where steering authority reaches full bite. */
  steerBite: number;
  /** Authority retained at top speed (0..1). */
  highSpeedSteer: number;
}

/** iPhone-leaning default: planted, readable steering, quick stop. */
export const MOBILE_TUNING: VehicleTuning = {
  maxSpeed: 44,
  reverseSpeed: 16,
  steerRate: 2.0,
  accelRate: 2.2,
  coastRate: 1.2,
  handbrakeRate: 4.5,
  steerBite: 6,
  highSpeedSteer: 0.55,
};

export function stepVehicleDynamics(
  state: VehicleDynamicsState,
  input: VehicleInput,
  dt: number,
  tuning: VehicleTuning = MOBILE_TUNING,
  /** Surface/weather grip multiplier from ClockWeather.friction() (§1.4). */
  frictionScale = 1,
): VehicleDynamicsState {
  let { yaw, speed } = state;
  const handbrake = input.handbrake;
  const grip = clamp(frictionScale, 0.2, 1.2);

  const speedFrac = clamp(Math.abs(speed) / tuning.maxSpeed, 0, 1);
  let authority =
    clamp(Math.abs(speed) / tuning.steerBite, 0, 1) * (1 - speedFrac * (1 - tuning.highSpeedSteer));
  if (handbrake) authority *= 1.8;
  authority *= grip;

  const reverseFactor = speed < -0.1 ? -1 : 1;
  yaw -= input.steer * tuning.steerRate * dt * authority * reverseFactor;

  const target = handbrake
    ? 0
    : input.throttle > 0
      ? tuning.maxSpeed * input.throttle
      : input.throttle < 0
        ? -tuning.reverseSpeed * -input.throttle
        : 0;
  const rate = (handbrake ? tuning.handbrakeRate : input.throttle !== 0 ? tuning.accelRate : tuning.coastRate) * grip;
  speed = lerp(speed, target * grip, expSmooth(dt, rate));

  const skidding =
    (handbrake && Math.abs(speed) > 6) || (Math.abs(input.steer) > 0.6 && Math.abs(speed) > 18);

  return { yaw, speed, skidding };
}

/** Unit forward vector from yaw (x = sin, z = cos — matches existing actors). */
export function forwardFromYaw(yaw: number): { x: number; z: number } {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}
