import { describe, expect, it } from "vitest";
import { CameraRig } from "../../sim/CameraRig";

describe("CameraRig", () => {
  it("places the chase camera behind the subject", () => {
    const rig = new CameraRig({ carDist: 12, carHeight: 5.5, followRate: 100, yawRate: 100 });
    const follow = { x: 0, y: 1, z: 0 };
    const pose = rig.update(1, follow, 0, "car", 0, 60, 0);
    // yaw 0 → behind is −z
    expect(pose.position.z).toBeLessThan(follow.z);
    expect(pose.position.y).toBeGreaterThan(follow.y);
    expect(pose.lookAt.x).toBeCloseTo(0, 3);
  });

  it("pulls in when an occlusion raycast reports a hit", () => {
    const rig = new CameraRig({ carDist: 20, carHeight: 5, followRate: 100, yawRate: 100, occlusionPadding: 0.5 });
    const follow = { x: 0, y: 1, z: 0 };
    const hit = { x: 0, y: 3, z: -4 };
    const pose = rig.update(1, follow, 0, "car", 0, 60, 0, () => hit);
    // Desired was ~20m back; hit at 4m should pull camera much closer.
    const dist = Math.hypot(pose.position.x - follow.x, pose.position.z - follow.z);
    expect(dist).toBeLessThan(10);
  });

  it("widens FOV with car speed", () => {
    const rig = new CameraRig({ fovBoost: 14, fovSpeedRef: 22, followRate: 100, yawRate: 100 });
    rig.update(1, { x: 0, y: 0, z: 0 }, 0, "car", 0, 60, 0);
    const slow = rig.current.fov;
    rig.update(1, { x: 0, y: 0, z: 0 }, 0, "car", 22, 60, 0);
    expect(rig.current.fov).toBeGreaterThan(slow);
  });
});
