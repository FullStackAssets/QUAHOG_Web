/** Independent open-world simulation types (clean-room; Mount Hope / The Narrows). */

export type Vec2 = { x: number; z: number };
export type Vec3 = { x: number; y: number; z: number };

export type StreamState = "idle" | "queued" | "loading" | "ready" | "evicting";

export interface StreamAsset {
  id: string;
  /** Approximate resident cost in bytes once ready. */
  bytes: number;
  /** Higher = keep under memory pressure. */
  priority: number;
  state: StreamState;
  /** Last camera/player interest time (ms, performance.now). */
  lastNeededAt: number;
  pinned?: boolean;
}

export interface SectorCoord {
  sx: number;
  sz: number;
}

export interface RoadNode {
  id: number;
  x: number;
  z: number;
}

export interface RoadEdge {
  from: number;
  to: number;
  length: number;
}

export interface NavPath {
  nodes: number[];
  points: Vec2[];
  length: number;
}

export interface NavGuidance {
  path: NavPath | null;
  /** Unit direction of the next path segment in XZ. */
  nextDir: Vec2 | null;
  distanceRemaining: number;
  /** True when the actor is facing away from the route (> ~100°). */
  wrongWay: boolean;
  /** Bearing from actor to next waypoint (atan2(dx, dz)). */
  bearing: number;
}

export type CameraMode = "foot" | "car" | "boat" | "first" | "photo";

export interface CameraPose {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
}

export interface VehicleInput {
  /** Steer −1..1 (left..right). */
  steer: number;
  /** Throttle −1..1 (reverse..forward). */
  throttle: number;
  handbrake: boolean;
}

export interface VehicleDynamicsState {
  yaw: number;
  speed: number;
  skidding: boolean;
}
