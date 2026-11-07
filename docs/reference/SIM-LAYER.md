# Independent open-world simulation layer

Clean-room TypeScript under `src/sim/`, guided by the architectural principles in
`clean-room-engine-dossier.md`. **No reconstructed proprietary source is imported.**

## Systems

| Module | Role |
|---|---|
| `RoadGraph` + `Dijkstra` + `ObjectiveNav` | Vehicle / waypoint routing, wrong-way cue, minimap polyline |
| `TrafficDirector` | Ambient cars on Dijkstra routes, stolen-slot respawn, frame budget |
| `ChaseController` | Road-snapped police pursuit |
| `PedestrianAI` + `SpatialIndex` | Near/mid/far LOD wander + threat flee |
| `CameraRig` | Mode-aware chase camera with occlusion pull-in |
| `WorldStreamer` + quality presets | Budgeted request / load / LRU evict; predictive tile interest |
| `VehicleDynamics` + `VehicleState` | Arcade drive + enter/exit/carjack transitions |
| `FrameBudget` | Mobile frame headroom for discretionary AI/streaming |

`SimBootstrap` wires nav + streamer into the R3F frame loop. `StreetLife`,
`Police`, `FollowCamera`, `Car`/`Player`, HUD, and Minimap consume the shared
`sim` runtime. Mission progress persists via `mounthope.mission.v1`.

## Legal boundary

Local research archives under `reference/revc/` (gitignored zip / extract /
unified) are **reference only**. Do not copy assets or C++ into the product tree.
