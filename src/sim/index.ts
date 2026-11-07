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
export type { StreamerMetrics } from "./WorldStreamer";
export { dijkstra } from "./Dijkstra";
export { RoadGraph } from "./RoadGraph";
export { PedGraph } from "./PedGraph";
export { MissionRuntime } from "./MissionRuntime";
export type { GameEvent, MissionPhase, OwnedEntity } from "./MissionRuntime";
export { GameLoop } from "./GameLoop";
export type { LoopPhase, PauseSource, LoopStats } from "./GameLoop";
export { Rng, RngService, rng } from "./Rng";
export type { RngStream } from "./Rng";
export { ClockWeather } from "./ClockWeather";
export { HEAT_TIERS, heatTier, desiredCops } from "./HeatTiers";
export { manifestFromSlice, validateManifest } from "./WorldManifest";
export type { WorldManifest } from "./WorldManifest";
export {
  canContinue,
  saveUnified,
  loadUnified,
  clearAllSaves,
  validateSave,
  collectLegacySave,
  SCHEMA_VERSION,
} from "./SaveGame";
export { runAllStages, allStagesGreen } from "./AcceptanceHarness";
export type { StageResult } from "./AcceptanceHarness";
export { ObjectiveNav } from "./ObjectiveNav";
export { CameraRig } from "./CameraRig";
export { stepVehicleDynamics, forwardFromYaw, MOBILE_TUNING } from "./VehicleDynamics";
export { streamPreset } from "./mobilePresets";
export { TrafficDirector } from "./TrafficDirector";
export type { TrafficAgent } from "./TrafficDirector";
export { PedestrianAI } from "./PedestrianAI";
export type { PedAgent } from "./PedestrianAI";
export { ChaseController } from "./ChaseController";
export type { ChaseUnit } from "./ChaseController";
export { enterCar, exitCar, canEnter, yawQuat } from "./VehicleState";
export { sim } from "./SimRuntime";
