// Logic vehicle classes for the game (moved from earth/Vehicles.tsx by
// Stream A, 2026-11-03, when the procedural Vehicle mesh was deleted).
// These are string keys only — handling (Car HANDLING), collider
// (carProfile), traffic speed and steal logic key off them. They are NOT
// meshes: every rendered car is now a pack GLB (see <Car>, <ParkedCars>,
// <StreetLife> traffic, <Police>).
//
// NOTE on the split: "revuelto" is a player-only class (Nic's car, own GLB).
// VEHICLE_TYPES deliberately excludes it, so traffic and parked-car type
// cycling never pick it — that exclusion is preserved here unchanged.

export type VehicleType = "bronco" | "mustang" | "infiniti" | "nissanz" | "rav4" | "revuelto";
export const VEHICLE_TYPES: VehicleType[] = ["bronco", "mustang", "infiniti", "nissanz", "rav4"];
