# Mount Hope — Implementation Checklist

Canonical tracked backlog. Prefer the deep-expansion task IDs (`§S.E.T`) in
commits and PRs.

- **Primary (v3 deep expansion):** [`IMPLEMENTATION-CHECKLIST-V3.md`](./IMPLEMENTATION-CHECKLIST-V3.md)
- **Expanded (v2 with Accept/Dep):** [`IMPLEMENTATION-CHECKLIST-EXPANDED.md`](./IMPLEMENTATION-CHECKLIST-EXPANDED.md)

Status: `[ ]` not started · `[~]` partial · `[x]` done

## Done baseline (sim layer)

- [x] `RoadGraph` + Dijkstra + `ObjectiveNav`
- [x] `CameraRig` + occlusion pull-in
- [x] `WorldStreamer` load/evict + `evictUnwanted`
- [x] Quality NPC caps + shadow map size
- [x] `VehicleDynamics` + `VehicleState`
- [x] `TrafficDirector` / `ChaseController` / `PedestrianAI`
- [x] `PedGraph` baseline sidewalk corridors (deepen per §1.2)
- [x] `MissionRuntime` baseline fail/retry/abandon + ownership (deepen per §1.3)
- [x] Mission step persistence (`mounthope.mission.v1`)

## Priority implementation order (active)

1. [x] Close streamer evict/dispose + quality NPC/shadow caps
2. [~] **§0 Foundations** — flags, `Rng`, telemetry, registries; `assets:audit` landed (CI wire-up TBD)
3. [x] **§1.1 GameLoop** — core + heat/economy/traffic/peds/car/boat on fixed step
4. [~] §1.2 PedGraph baseline (deepen doors/crosswalks later)
5. [~] §1.3 MissionRuntime baseline
6. [~] §1.6 WorldManifest scaffold (from slice); Cape/FR content still open
7. [~] §1.5 SaveGame v2 + Continue gate + inventory + boat/carDamage domains
8. [x] §3.2 heat tiers + §5.2 ammo/inventory persistence
9. [x] §2.11 earth demoted to diagnostic (`docs/EARTH-DECISION.md`)
10. [~] §1.4 ClockWeather + fog→streamer radius; §9.2 spatial audio stub
11. [~] §15 AcceptanceHarness stages 0–7 green; §17 release checklist drafted
12. [ ] §7.3 Cape/FR authored tiles — **blocked** (see `CONTENT-CAPE-FR.md`) ← remaining content gate for full campaign
    - also done this pass: boat-aware mission/waypoint targets; police soft-fail chase; SpatialIndex segment/LOS; streamer metrics; tab Canvas pause

See V3 for full contracts, test matrices, and the dependency DAG.
