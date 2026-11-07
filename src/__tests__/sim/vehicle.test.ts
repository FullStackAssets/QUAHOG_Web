import { describe, expect, it } from "vitest";
import { forwardFromYaw, MOBILE_TUNING, stepVehicleDynamics } from "../../sim/VehicleDynamics";

describe("VehicleDynamics", () => {
  it("accelerates forward under throttle and steers with authority", () => {
    let state = { yaw: 0, speed: 0, skidding: false };
    for (let i = 0; i < 60; i++) {
      state = stepVehicleDynamics(state, { steer: 0, throttle: 1, handbrake: false }, 1 / 60);
    }
    expect(state.speed).toBeGreaterThan(10);
    expect(state.speed).toBeLessThanOrEqual(MOBILE_TUNING.maxSpeed + 0.01);

    const before = state.yaw;
    state = stepVehicleDynamics(state, { steer: 1, throttle: 1, handbrake: false }, 1 / 60);
    expect(state.yaw).toBeLessThan(before); // positive steer → yaw decreases (existing convention)
  });

  it("handbrake scrubs speed and marks a skid", () => {
    let state = { yaw: 0, speed: 30, skidding: false };
    state = stepVehicleDynamics(state, { steer: 0, throttle: 0, handbrake: true }, 0.25);
    expect(state.speed).toBeLessThan(30);
    expect(state.skidding).toBe(true);
  });

  it("forwardFromYaw matches actor convention", () => {
    expect(forwardFromYaw(0)).toEqual({ x: 0, z: 1 });
    expect(forwardFromYaw(Math.PI / 2).x).toBeCloseTo(1, 5);
    expect(forwardFromYaw(Math.PI / 2).z).toBeCloseTo(0, 5);
  });
});
