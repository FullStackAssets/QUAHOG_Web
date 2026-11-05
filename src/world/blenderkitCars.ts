// BlenderKit converted-vehicle pool (bulk job 2026-11-03). QA gate:
// ~/workspace/qa-blenderkit-gate-2026-11-03.md — 32 candidates, 6 held,
// 1 excluded. Only the 8 vehicles below are mounted, and only into the
// car pools (copied to public/blenderkit/ — never mixed into public/packs/).
// Rip screen clean (no GTA/Rockstar/Vulcar hits; the branded Camry/Bronco
// meshes are royalty_free BlenderKit assets, not rips).
//
// Forward: ONLY van + sedan are forward-VERIFIED (+Z via lights + wipers
// + wheels agreeing), so only those two join the traffic pool. The other
// six are parked-only: their evidence is wheel-naming-only, and the
// police-cruiser case proves names can lie — visual forward confirmation
// is still owed for box-truck, sports-car, bus, motorcycle, suv, pickup.
// Parked cars don't move, so an unverified forward only affects which way
// a parked car faces, not driving.
//
// Ground offsets (measured world Y-min, QA + re-verified at mount):
// bus floats 0.614 m (no mesh below Y 0.61 — wheels float too), so it is
// dropped by -0.614 on mount. All others sit at Y-min ≈ 0.00 (sedan 0.005,
// pickup -0.006 — negligible, left at 0).
// Dims flags carried: sedan 132,372 tris (near the 150k limit) and 3.13 m
// wide; pickup 2.65 m wide; bus 1.44 m narrow (the manifest's 23 m bounds
// are wrong for this GLB — measured bounds trusted).
// Traffic wheel radii (measured union over each wheel node's meshes):
// van 0.35, sedan 0.33. Van caveat: its wheel nodes sit at the model
// origin with meshes offset ~1.7 m in Z, so WheelRig's pivot validation
// (mesh centre within 1 cm of node origin) FAILS and its traffic wheels
// will not spin — graceful skip with a console warning, not a crash.
// Sedan's wheel nodes carry real axle translations and pass validation.

export interface BlenderkitParked {
  path: string;
  /** Ground drop applied on mount (0 unless the model floats). */
  yOff: number;
}

export const BLENDERKIT_PARKED: BlenderkitParked[] = [
  { path: "/blenderkit/van.glb", yOff: 0 },
  { path: "/blenderkit/sedan.glb", yOff: 0 },
  { path: "/blenderkit/box-truck.glb", yOff: 0 },
  { path: "/blenderkit/sports-car.glb", yOff: 0 },
  { path: "/blenderkit/bus.glb", yOff: -0.614 },
  { path: "/blenderkit/motorcycle.glb", yOff: 0 },
  { path: "/blenderkit/suv.glb", yOff: 0 },
  { path: "/blenderkit/pickup.glb", yOff: 0 },
];

/** Traffic pool: ONLY the two forward-verified (+Z) BlenderKit vehicles. */
export const BLENDERKIT_TRAFFIC: string[] = [
  "/blenderkit/van.glb",
  "/blenderkit/sedan.glb",
];

/** Measured traffic wheel radii, keyed by BlenderKit model name. */
export const BLENDERKIT_TRAFFIC_WHEEL_R: Record<string, number> = {
  van: 0.35,
  sedan: 0.33,
};
