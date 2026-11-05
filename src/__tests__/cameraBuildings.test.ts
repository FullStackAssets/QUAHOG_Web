import { describe, expect, it, beforeEach } from "vitest";
import * as THREE from "three";
import {
  setCameraBuildings,
  clearCameraBuildings,
  resolveCameraBuildingObstruction,
  pushCameraOutOfBuildings,
} from "../actors/cameraBuildings";
import type { Building } from "../slice";

// One 10x10 m, 10 m tall building: slice [east 0..10, north 0..10] ->
// world x 0..10, z -10..0.
const BOX: Building = {
  footprint: [[0, 0], [10, 0], [10, 10], [0, 10]],
  height: 10,
};

beforeEach(() => { clearCameraBuildings(); });

describe("geometric camera obstruction (footprint-based)", () => {
  it("leaves a clear segment untouched", () => {
    setCameraBuildings("t", [BOX]);
    const pivot = new THREE.Vector3(20, 1.5, 5);
    const end = new THREE.Vector3(20, 1.5, -15);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.toArray()).toEqual([20, 1.5, -15]);
  });

  it("clamps a crossing segment to just before the expanded wall", () => {
    setCameraBuildings("t", [BOX]);
    const pivot = new THREE.Vector3(5, 1.5, 5);
    const end = new THREE.Vector3(5, 1.5, -15);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    // Expanded face at z=0.5, 4.5 m out; minus the 0.06 pull-back.
    expect(end.x).toBe(5);
    expect(end.y).toBe(1.5);
    expect(end.z).toBeCloseTo(0.56, 2);
  });

  it("leaves the end alone when the pivot is inside but the end is already outside", () => {
    // The camera destination is already outside the volume — there is
    // nothing to clamp. (The entry clamp handles pivot-outside, and the
    // push-out backstop handles both-inside; see the next test.)
    setCameraBuildings("t", [BOX]);
    const pivot = new THREE.Vector3(5, 1.5, -5);
    const end = new THREE.Vector3(5, 1.5, -15);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.toArray()).toEqual([5, 1.5, -15]);
  });

  it("both-inside is left to the push-out backstop", () => {
    // No along-segment point is outside, so the segment clamp cannot fix
    // it — it must leave the end for pushCameraOutOfBuildings.
    setCameraBuildings("t", [BOX]);
    const pivot = new THREE.Vector3(5, 1.5, -5);
    const end = new THREE.Vector3(5, 1.5, -8);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.toArray()).toEqual([5, 1.5, -8]);
    pushCameraOutOfBuildings(end, 0.5);
    expect(end.x).toBe(5);
    expect(end.z).toBe(-10.5);
  });

  it("ignores buildings the segment passes above", () => {
    setCameraBuildings("t", [BOX]);
    const pivot = new THREE.Vector3(5, 12, 5);
    const end = new THREE.Vector3(5, 12, -15);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.toArray()).toEqual([5, 12, -15]);
  });

  it("ignores a short building the rising segment clears", () => {
    setCameraBuildings("t", [{ ...BOX, height: 1 }]);
    const pivot = new THREE.Vector3(5, 1.5, 5);
    const end = new THREE.Vector3(5, 4.5, -15);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.toArray()).toEqual([5, 4.5, -15]);
  });

  it("maps slice north to world -z (Fall River / New Bedford frame)", () => {
    // Slice north 90..100 -> world z -100..-90.
    setCameraBuildings("t", [{
      footprint: [[0, 90], [10, 90], [10, 100], [0, 100]],
      height: 10,
    }]);
    const pivot = new THREE.Vector3(5, 1.5, -80);
    const end = new THREE.Vector3(5, 1.5, -110);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.z).toBeCloseTo(-89.44, 2);
    // Same segment on the wrong (positive-z) side passes untouched.
    const p2 = new THREE.Vector3(5, 1.5, 95);
    const e2 = new THREE.Vector3(5, 1.5, 75);
    resolveCameraBuildingObstruction(p2, e2, 0.5);
    expect(e2.toArray()).toEqual([5, 1.5, 75]);
  });

  it("still blocks a building wider than the grid (overflow list)", () => {
    setCameraBuildings("t", [{
      footprint: [[0, 0], [2000, 0], [2000, 10], [0, 10]],
      height: 20,
    }]);
    const pivot = new THREE.Vector3(1000, 1.5, 5);
    const end = new THREE.Vector3(1000, 1.5, -15);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.z).toBeCloseTo(0.56, 2);
  });

  it("re-registering a source replaces it instead of duplicating", () => {
    setCameraBuildings("t", [BOX]);
    setCameraBuildings("t", []);
    const pivot = new THREE.Vector3(5, 1.5, 5);
    const end = new THREE.Vector3(5, 1.5, -15);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(end.toArray()).toEqual([5, 1.5, -15]);
  });

  it("pushes a point inside a volume out along the smallest axis", () => {
    setCameraBuildings("t", [BOX]);
    const pos = new THREE.Vector3(3, 1.5, -5);
    pushCameraOutOfBuildings(pos, 0.5);
    // Expanded x faces at -0.5 / 10.5, z faces at -10.5 / 0.5:
    // smallest penetration is the -x face (3.5 m).
    expect(pos.x).toBe(-0.5);
    expect(pos.z).toBe(-5);
  });

  it("push-out leaves a point above the roof alone", () => {
    setCameraBuildings("t", [BOX]);
    const pos = new THREE.Vector3(5, 12, -5);
    pushCameraOutOfBuildings(pos, 0.5);
    expect(pos.toArray()).toEqual([5, 12, -5]);
  });

  it("never lengthens the segment", () => {
    setCameraBuildings("t", [BOX]);
    const pivot = new THREE.Vector3(5, 1.5, 5);
    const end = new THREE.Vector3(5, 1.5, -15);
    const before = pivot.distanceTo(end);
    resolveCameraBuildingObstruction(pivot, end, 0.5);
    expect(pivot.distanceTo(end)).toBeLessThanOrEqual(before);
  });
});
