# GTA: Vice City (2002) — Reverse-Engineering Dossier

**Prepared:** 2026-11-07  
**Scope:** Original PC/PS2-era GTA: Vice City (not the Unreal Engine Definitive Edition).  
**Approach:** Source-guided architecture analysis using publicly accessible reVC reconstructions; behavioral reconstruction recommendations are independent design proposals, not claims of original source identity.

## 1. Executive result

Vice City is not one massive simulation running at full precision. It is a coordinated set of priority-managed subsystems: a world divided into sectors; a camera-sensitive model streamer; a bounded entity and model inventory; a frame-loop scheduler; distinct vehicle/pedestrian control systems; a graph-based transport network; a mission script runtime; and time-of-day/visual/audio presentation layers. The combination creates the *perception* of a continuous living city within constrained hardware.

**Status of this analysis:** public reconstructed C++ files inspected; no proprietary game executable or original assets obtained or analyzed; no local binary decompilation, gameplay profiling, test build, or source compilation performed. The codebase and claims require version-aware verification before treating any numeric constant as identical to every original retail version.

## 2. Evidence and concrete findings

| System | Verified public reVC evidence | Engineering interpretation |
|---|---|---|
| World partition | `src/core/World.h` defines `NUMSECTORS_X/Y = 80`, sector size `50 × 50`, and coordinate ranges x `-2400..1600`, y `-2000..2000` | A **4,000 × 4,000 unit covered coordinate envelope**, *not* a claim of 16 km² of traversable land; distinct lists per sector for buildings, objects, vehicles, peds and overlap categories |
| Ray casting | `src/core/World.cpp`, `CWorld::ProcessLineOfSight`, checks sector-level entity lists | World queries are spatially pruned, useful for collision, sight, targeting and camera obstruction |
| Streaming | `src/core/Streaming.cpp`, `CStreaming::Update` and `AddModelsToRequestList`; `STREAM_DIST` is defined as `80.0f` | Nearby models requested from sectors; distant RenderWare objects can be released; flags retain priority/mission-required assets |
| Stream lifecycle | `src/core/Streaming.h` defines NOTLOADED, LOADED, INQUEUE, READING, STARTED plus priority/keep-in-memory flags | A queue/state machine, not simplistic per-frame load/unload |
| Main loop | `src/core/Game.cpp`, `CGame::Process` orchestrates input, streaming, scripts, collision, population, world, visual systems and traffic; `src/core/main.cpp`, `Idle`, calls game processing, audio and renderer | Multiple simulation frequencies/priorities; deliberate degradation of discretionary systems under load |
| Traffic | `src/control/CarCtrl.cpp`, `GenerateRandomCars` and vehicle control; conditional creation constrained by runtime state | Traffic is a managed population, with generators, route following, despawning and performance limits |
| Route search | `src/control/PathFind.cpp`, `CPathFind::DoPathSearch` explicitly labels Dijkstra's algorithm; car and pedestrian path classes | Graph pathfinding and separate route semantics for vehicles versus people |
| Camera | `src/core/Camera.cpp`, `CCamera::Process`, with multiple camera modes | Mode-dependent camera control for pedestrian, vehicle and airborne contexts |
| Physics | `src/vehicles/Automobile.cpp`, `CAutomobile::ProcessControl`; `src/vehicles/Vehicle.cpp`, forces and collision behavior | Bespoke arcade car handling layered on forces, friction, suspension, surface types and damage |
| NPC controller | `src/peds/Ped.cpp`, `CPed::ProcessControl` | Pedestrians have update/behavior transitions coupled with events, movement and world objects |
| Mission runtime | `src/control/Script.cpp`, `CTheScripts::Process` | Script scheduling, entity ownership, mission cleanup and conditional behavior |
| Game clock | `src/core/Clock.cpp`, `CClock::Update` | Clock runs as a game simulation variable distinct from wall time |

### Core source links

- World classes: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/World.h
- World queries: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/World.cpp
- Main update: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/Game.cpp
- Outer loop: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/main.cpp
- Asset streaming: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/Streaming.cpp
- Streaming data structures: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/Streaming.h
- Traffic: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/control/CarCtrl.cpp
- Paths: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/control/PathFind.cpp
- Automobile control: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/vehicles/Automobile.cpp
- Pedestrians: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/peds/Ped.cpp
- Camera: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/Camera.cpp
- Missions: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/control/Script.cpp
- Clock: https://raw.githubusercontent.com/mrxenginner/reVC/miami/src/core/Clock.cpp
- reVC source/repository context: https://github.com/mrxenginner/reVC
- Project takedown history: https://recompendium.com/en/port/grand-theft-auto-vice-city-revc/

## 3. Observed subsystem graph

```text
Platform & input ──> CGame::Process ─────────────────────────────────────┐
                   ├─ CStreaming::Update: camera, sector, model cache  │
                   ├─ CClock/CWeather: time and environmental state     │
                   ├─ CTheScripts::Process: missions, scripted events   │
                   ├─ CCollision/Path updates: world collision, routes  │
                   ├─ CPopulation: pedestrian generation                │
                   ├─ CWorld::Process: moving entities + physics        │
                   ├─ CCarCtrl: generated traffic and cleanup           │
                   ├─ CTimeCycle / CCamera: presentation state          │
                   └─ Other services: particles, audio, garages, HUD ──┤
                                                                        v
                                   Renderer: visible list -> draw -> UI/audio
```

The above is a conceptual dependency graph, not a claim that every named component executes strictly serially in this illustrated order. Inspect `CGame::Process` for the concrete ordering and conditional branches.

### Why the frame loop matters

`CGame::Process` calls `CStreaming::Update` before most gameplay work. It processes the script runtime, collision, entities, the population manager, camera, and then conditionally generates random cars. In the inspected reconstruction, both population work and car generation are conditioned by measured processing cost. The architectural principle is **graceful fidelity reduction**: essential gameplay continues while expensive ambient simulation is budgeted.

### Spatial queries

The world grid is 80 × 80, each sector 50 × 50 units, with entity categories stored separately. A ray cast traverses candidate sectors instead of checking every entity in the city. Overlap lists prevent large or boundary-crossing objects from becoming invisible to queries.

### Streaming lifecycle

Models have load states and priority flags; required models can be pinned, with requests driven by camera position. This is an asset-level state machine, not only level-of-detail switching. The `80.0f` streaming distance is a constant in the inspected source and must not be mistaken for a universal rendering/view distance; alternate branches, camera modes, high-altitude logic and other render decisions affect visible content.

### Transportation graph

`CPathFind::DoPathSearch` uses Dijkstra's algorithm on a graph, locating nearest start/target nodes and rejecting disconnected groups. Ped and vehicle routes are separate. This distinguishes city topology from movement simulation: path planning chooses where to go; car steering and collision solve how to go there.

### Vehicles and physical response

The automobile controller handles input and control states plus traction-related behavior and collision responses, while vehicle systems include physics forces and specialized behavior for other vehicle types. Vice City's feel is a tuned arcade dynamical system, not a neutral rigid-body simulator. Reproduction should measure steering response, yaw recovery, braking and collision behavior from a legally owned copy before fixing tuning constants.

### Missions and persistent world state

The script engine runs mission logic in a timed processing cycle. Missions can request/own streamed models and clean up mission entities. The technical lesson is the mission runtime must coordinate with streaming, entity lifetime, markers, garages and progression—not merely show objectives on the HUD.

## 4. Proposed clean-room architecture for a modern engine

These are **design recommendations**, not statements that Vice City used these exact interfaces.

```text
src/game/
  engine/GameLoop.ts            // fixed-step simulation + render interpolation
  world/SpatialIndex.ts        // sector buckets and collision/raycast queries
  world/WorldStreamer.ts       // request/queue/load/active/evict lifecycle
  world/WorldManifest.ts       // own original environmental data
  agents/PedestrianAI.ts       // state machine + budgeted behavior LOD
  agents/TrafficDirector.ts    // traffic spawns, despawns, route assignment
  routing/RoadGraph.ts         // directed lanes and constraints
  routing/PedGraph.ts          // sidewalk/doorway graph
  routing/Dijkstra.ts          // deterministic baseline for routing
  vehicles/VehiclePhysics.ts   // arcade dynamics, suspension and controls
  vehicles/VehicleState.ts     // enter, exit, driving, damaged, abandoned
  camera/CameraRig.ts          // spring arms, collision probes, transitions
  missions/MissionRuntime.ts   // declarative mission graph and event bus
  navigation/ObjectiveNav.ts   // world marker, screen arrow, minimap route
  systems/ClockWeather.ts      // game time and environmental state
  systems/SaveGame.ts          // stable IDs, versioned persistence
  ui/MobileControls.ts        // thumb zones, dynamic responsive HUD
  telemetry/FrameBudget.ts     // active entities, frame cost and warnings
```

### Example subsystem contracts

```ts
// Proposed independent APIs; not copied from reVC.
type Vec3 = { x: number; y: number; z: number };
type GameEvent = { type: string; actorId?: string; entityId?: string };

interface WorldStreamer {
  request(position: Vec3, speed: Vec3, pinnedAssets: Set<string>): void;
  advanceBudget(maxWorkMs: number): Promise<void>;
  unloadOutsideBudget(maxResidentBytes: number): void;
}

interface TrafficDirector {
  update(dt: number, player: Vec3, frameBudgetMs: number): void;
}

interface MissionRuntime {
  advance(dt: number, events: readonly GameEvent[]): void;
  serialize(): unknown;
}

interface CameraRig {
  update(dt: number, follow: Vec3): void;
  resolveOcclusion(raycast: (from: Vec3, to: Vec3) => Vec3 | null): void;
}
```

### Core simulation tick (suggested)

```text
sample input
update fixed timestep accumulator
for each physics step (bounded):
  advance missions and world clock
  process player and active vehicles
  process high-priority NPC behavior
  update collision and entity transformations
  emit game events
schedule low-priority work according to measured frame headroom
update camera and HUD from interpolated state
render visible sectors and draw UI
```

Avoid placing asynchronous file loads or route searches directly in the frame-critical physics path. Use explicit cancellation and ownership for asset loads to prevent unload/respawn races.

## 5. Technical reimplementation milestones and acceptance gates

| Stage | Scope | Verifiable acceptance condition |
|---|---|---|
| 0 — Baseline | Capture current build, gameplay reference clips, mobile device characteristics, asset ownership and provenance | Reproducible baseline and written evidence map |
| 1 — Movement | On-foot controller, one drivable car, enter/exit state, follow camera | Enter/exit and camera transitions work repeatedly without collision clipping |
| 2 — Spatial world | Sector index, static collision, line-of-sight/raycast and visibility | Tests for sector boundaries, overlap objects, precise ray hits |
| 3 — Vehicle system | Acceleration, braking, steering, suspension, contact, impact damage | Repeatable handling tests with fixed frame rate and variable render rate |
| 4 — NPC + traffic | Directed road graph, pedestrian graph, path routing, budgets and despawning | Vehicles route to destinations, no endless stalled queues, stable entity counts |
| 5 — Streaming | Camera-centered load requests and LRU/budgeted resource eviction | Memory plateaus after repeated map traversal; no visible pop-in in benchmark route |
| 6 — Missions | Data-driven objective graph, checkpoints, triggers and persistence | Finish, retry, abandon, save, load without stale spawned entities |
| 7 — Polish | Audio, time/weather, ambience, HUD, minimap, controls | Mobile FPS target and frame-time percentiles measured on a named device |

No stage is marked complete; the current task is analysis only.

## 6. QUAHOG_Web-specific application (proposed; no repo changes made)

For a browser-based SouthCoast open-world game, the highest-value transfers are: (a) road-node graph and traffic/vehicle AI; (b) mission/objective navigation including 3D waypoint, directional arrow, minimap route and wrong-way feedback; (c) collision-aware camera; (d) sector-based world loading tied to player/camera position; (e) pedestrian behaviors with tiered update frequency; (f) fixed-step driving with robust vehicle enter/exit state changes. These map directly to known game-experience issues but are not evidence they already exist in QUAHOG_Web.

Recommended implementation topology: original authored GLB assets + glTF loader, browser renderer, Web Workers for non-render path/asset preparation, typed deterministic engine data, cloud preview deployments only after explicit approval. Importing Vice City's proprietary map, models, textures, dialogue, UI art, radio recordings or extracted asset archive is unnecessary and should not be a development dependency.

## 7. How to reverse-engineer the original binary more rigorously

If a lawfully obtained compatible original PC binary is supplied, conduct a separate local-only binary-analysis track:

1. **Establish provenance and hashes:** exact edition, file versions, platform, executable cryptographic hashes, ownership/permission scope, and a list of included game data files.
2. **Static analysis:** inspect PE headers, imports, strings, class-vtable signatures, functions in Ghidra/Binary Ninja and compare against documented reVC behavior without copying code to a new commercial product.
3. **Dynamic behavior capture:** record input-to-motion telemetry, collision behavior, NPC reactions, object residency, mission transitions and save/reload observations under controlled scenarios.
4. **Hypothesis testing:** every claim gets a reproducible scenario, trace, evaluator and confidence rating. Run the same test under multiple clock/frame conditions.
5. **Specification-only output:** document observable mechanics, system boundaries, formulas inferred from black-box tests and interoperability facts; implement new code independently from that specification.

A truly executable-specific disassembly or exact binary match cannot be claimed from public source browsing alone.

## 8. Legal and intellectual-property boundary

The reVC effort was subject to DMCA takedowns and litigation in 2021. Some current forks assert a custom license; license text and uploader assertions cannot grant rights to copyrighted code they do not own. The safe path to a **commercial** new game is clean-room behavioral analysis, original or licensed assets, independently authored code and legal review of any use of reconstructed source. Running/modding a personal owned game and shipping a separate commercial game are different risk categories.

## 9. Suggested research provenance labels

**Verified public source:** observed declarations/functions in reVC files enumerated above.  
**Inferred from architecture:** e.g., sector spatial partitioning reduces candidate collision checks.  
**Recommended independent design:** TypeScript interfaces, worker budgets, milestone acceptance tests.  
**Not verified:** binary equivalence to a specific retail executable, current legal status of every fork, original engine performance on user hardware, or presence of these features in the current QUAHOG_Web repository.

---

**Next technical gate:** inventory the target engine/repository and gather the actual baseline before beginning implementation. For reVC functional validation, a lawful original asset installation and compatible runtime are required. For a proprietary-asset-free clean-room build, proceed with independent geometry and test fixtures instead.
