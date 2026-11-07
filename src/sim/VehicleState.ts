/**
 * Enter / exit / carjack state transitions for Mount Hope vehicles.
 * Keeps Player, Car, Boat, and save-restore on one consistent contract.
 */

export interface BodyPose {
  x: number;
  y: number;
  z: number;
}

export interface VehicleHandles {
  player: {
    setEnabled: (on: boolean) => void;
    setTranslation: (p: BodyPose, wake: boolean) => void;
    setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
    translation: () => BodyPose;
  } | null;
  car: {
    setTranslation: (p: BodyPose, wake: boolean) => void;
    setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
    setRotation: (q: { x: number; y: number; z: number; w: number }, wake: boolean) => void;
    translation: () => BodyPose;
  } | null;
}

export interface EnterCarArgs {
  handles: VehicleHandles;
  /** World yaw of the vehicle being entered. */
  yaw: number;
  /** Optional teleport of the physics car (carjack). */
  relocate?: { x: number; z: number; y?: number };
  setCarYaw: (yaw: number) => void;
  setMode: (mode: "car") => void;
  clearNear: () => void;
}

export interface ExitCarArgs {
  handles: VehicleHandles;
  yaw: number;
  setMode: (mode: "foot") => void;
  setCarSpeed: (n: number) => void;
  /** Lateral exit offset (metres). */
  sideOffset?: number;
  groundY?: number;
}

export function yawQuat(yaw: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

/** Enter the player's car (or a carjacked body relocated onto shared.car). */
export function enterCar(args: EnterCarArgs): boolean {
  const { handles, yaw, relocate, setCarYaw, setMode, clearNear } = args;
  const { player, car } = handles;
  if (!player || !car) return false;

  if (relocate) {
    car.setTranslation({ x: relocate.x, y: relocate.y ?? 1.4, z: relocate.z }, true);
    car.setRotation(yawQuat(yaw), true);
  }
  car.setLinvel({ x: 0, y: 0, z: 0 }, true);
  setCarYaw(yaw);

  const c = car.translation();
  player.setTranslation({ x: c.x, y: c.y + 0.4, z: c.z }, true);
  player.setLinvel({ x: 0, y: 0, z: 0 }, true);
  player.setEnabled(false);
  clearNear();
  setMode("car");
  return true;
}

/** Exit beside the passenger door; clears vehicle velocity. */
export function exitCar(args: ExitCarArgs): boolean {
  const { handles, yaw, setMode, setCarSpeed, sideOffset = 3, groundY = 1.2 } = args;
  const { player, car } = handles;
  if (!player || !car) return false;

  const c = car.translation();
  // Passenger-side = +right of forward (sin/cos yaw convention).
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  car.setLinvel({ x: 0, y: 0, z: 0 }, true);
  setCarSpeed(0);

  player.setEnabled(true);
  player.setTranslation(
    { x: c.x + rx * sideOffset, y: Math.max(groundY, c.y), z: c.z + rz * sideOffset },
    true,
  );
  player.setLinvel({ x: 0, y: 0, z: 0 }, true);
  setMode("foot");
  return true;
}

export function canEnter(distance: number, radius = 4.5): boolean {
  return distance < radius;
}
