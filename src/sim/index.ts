/** Public entry for the independent open-world simulation layer. */

export type {
  Vec2,
  Vec3,
  StreamState,
  StreamAsset,
  NavPath,
  NavGuidance,
  CameraMode,
  CameraPose,
  VehicleInput,
  VehicleDynamicsState,
  RoadNode,
  RoadEdge,
} from "./types";

export { lerp, lerpAngle, clamp, expSmooth, dist, normalize2, bearingTo, angleDelta } from "./math";
export { FrameBudget } from "./FrameBudget";
export { SpatialIndex } from "./SpatialIndex";
export { WorldStreamer } from "./WorldStreamer";
export { dijkstra } from "./Dijkstra";
export { RoadGraph } from "./RoadGraph";
export { ObjectiveNav } from "./ObjectiveNav";
export { CameraRig } from "./CameraRig";
export { stepVehicleDynamics, forwardFromYaw, MOBILE_TUNING } from "./VehicleDynamics";
export { streamPreset } from "./mobilePresets";
export { sim } from "./SimRuntime";
