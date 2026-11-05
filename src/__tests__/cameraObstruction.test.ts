import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { resolveCameraObstruction } from "../actors/cameraObstruction";

beforeAll(async () => { await RAPIER.init(); });
describe("camera sweep against real Rapier colliders", () => {
  it("keeps an unobstructed camera at its desired position", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const end = new THREE.Vector3(0, 4, -7);
    resolveCameraObstruction(world, RAPIER, new THREE.Vector3(0, 1.5, 0), end, 0.5);
    expect(end.toArray()).toEqual([0, 4, -7]);
    world.free();
  });
  it("stops the whole camera volume in front of a wall, even at short distance", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, 10, 0.1).setTranslation(0, 2, -1));
    world.updateSceneQueries();
    const end = new THREE.Vector3(0, 1.5, -7);
    resolveCameraObstruction(world, RAPIER, new THREE.Vector3(0, 1.5, 0), end, 0.5);
    expect(end.z).toBeGreaterThan(-0.41);
    expect(end.z).toBeLessThanOrEqual(0);
    world.free();
  });
  it("ignores sensors and actors rather than snapping against the player", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(5, 5, 0.2).setTranslation(0, 2, -1).setSensor(true));
    const actor = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, -2));
    world.createCollider(RAPIER.ColliderDesc.ball(0.5), actor);
    world.updateSceneQueries();
    const end = new THREE.Vector3(0, 1.5, -7);
    resolveCameraObstruction(world, RAPIER, new THREE.Vector3(0, 1.5, 0), end, 0.5);
    expect(end.z).toBe(-7);
    world.free();
  });
});
