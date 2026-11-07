# Independent open-world simulation layer

Clean-room TypeScript under `src/sim/`, guided by the architectural principles in
`clean-room-engine-dossier.md`. **No reconstructed proprietary source is imported.**

## First slice (this PR)

| Module | Role |
|---|---|
| `RoadGraph` + `Dijkstra` + `ObjectiveNav` | Vehicle / waypoint routing, wrong-way cue, minimap polyline |
| `CameraRig` | Mode-aware chase camera with occlusion pull-in |
| `WorldStreamer` + quality presets | Budgeted request / load / LRU evict; predictive tile interest |
| `VehicleDynamics` | Arcade drive helpers used by `actors/Car.tsx` |
| `FrameBudget` / `SpatialIndex` | Mobile frame headroom + sector queries |

`SimBootstrap` wires nav + streamer into the R3F frame loop; `FollowCamera` and
`StreamingBuildings` consume the shared `sim` runtime.

## Legal boundary

Local research archives under `reference/revc/` (gitignored zip / extract) are
**reference only**. Do not copy assets or C++ into the product tree.
