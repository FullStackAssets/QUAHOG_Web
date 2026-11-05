import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { trafficColliderPose } from "../world/TrafficColliders";
import type { TrafficCar } from "../shared";

function car(over: Partial<TrafficCar> = {}): TrafficCar {
  return {
    pos: new THREE.Vector3(10, 0, 20),
    yaw: 0,
    type: "sedan",
    color: "#fff",
    stop: 0,
    stolen: false,
    ...over,
  };
}

describe("trafficColliderPose", () => {
  it("returns the car position and yaw quaternion", () => {
    const pose = trafficColliderPose(car({ yaw: Math.PI }));
    expect(pose).toMatchObject({ x: 10, y: 0, z: 20 });
    expect(pose!.qy).toBeCloseTo(1);
    expect(pose!.qw).toBeCloseTo(0);
  });
  it("parks stolen cars (null)", () => {
    expect(trafficColliderPose(car({ stolen: true }))).toBeNull();
  });
  it("parks missing slots (null)", () => {
    expect(trafficColliderPose(undefined)).toBeNull();
  });
});
