import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { shared, type TrafficCar } from "../shared";

// Moving traffic cars were visual-only groups (StreetLife renders them outside
// <Physics>), so the player drove straight through them — the ram check only
// shook the camera and stopped the OTHER car. These kinematic bodies follow
// shared.traffic every frame, so both the car wall-probe and real physics
// collisions stop at them. Same collider as the player/parked cars.
// (Traffic solidity fix, 2026-11-02.)

const MAX_TRAFFIC = 20; // mobileBudget traffic cap at quality 2
const PARKED_Y = -100; // bodies with no live car wait far underground

export interface ColliderPose {
  x: number;
  y: number;
  z: number;
  qy: number;
  qw: number;
}

/** Pose for one traffic slot, or null when the body should be parked. */
export function trafficColliderPose(car: TrafficCar | undefined): ColliderPose | null {
  if (!car || car.stolen) return null;
  return {
    x: car.pos.x,
    y: car.pos.y,
    z: car.pos.z,
    qy: Math.sin(car.yaw / 2),
    qw: Math.cos(car.yaw / 2),
  };
}

export function TrafficColliders() {
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  useFrame(() => {
    const cars = shared.traffic;
    for (let i = 0; i < MAX_TRAFFIC; i++) {
      const b = bodies.current[i];
      if (!b) continue;
      const pose = trafficColliderPose(cars[i]);
      if (!pose) {
        b.setNextKinematicTranslation({ x: 0, y: PARKED_Y, z: 0 });
        continue;
      }
      b.setNextKinematicTranslation({ x: pose.x, y: pose.y, z: pose.z });
      b.setNextKinematicRotation({ x: 0, y: pose.qy, z: 0, w: pose.qw });
    }
  });
  return (
    <>
      {Array.from({ length: MAX_TRAFFIC }, (_, i) => (
        <RigidBody
          key={i}
          type="kinematicPosition"
          colliders={false}
          ref={(el) => {
            bodies.current[i] = el;
          }}
          position={[0, PARKED_Y, 0]}
        >
          <CuboidCollider args={[1.0, 0.6, 2.1]} position={[0, 0.6, 0]} />
        </RigidBody>
      ))}
    </>
  );
}
