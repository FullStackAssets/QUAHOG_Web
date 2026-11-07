Mount Hope — Implementation Checklist (v3, deep expansion)

Tracked backlog for making QUAHOG_Web / Mount Hope a substantially complete
open-world browser game.

Status tags: [ ] not started - [~] partial - [x] done
Effort tags: (S) < 1 day · (M) 1–3 days · (L) 1–2 weeks · (XL) 2–4 weeks · (XXL) > 1 month
ID scheme: §S.E = epic, §S.E.T = task, §S.E.T.S = subtask.
Dep notation: → §x.y = hard blocker. ⇢ §x.y = soft/parallel dependency.
Perf-safe: no per-frame allocation, no Array.prototype hot loops, no closures in update paths.

How to read this doc. Every epic has: a Contract (the interface it
must expose), a Task tree (checkboxes), a Test matrix (automated),
Perf budget, Edge cases, and a one-line Accept. The task tree is
the work; everything else is the definition of done. IDs are stable and
should be used in commit messages and PR titles (feat(§1.1.7): ...).

---

Table of contents

· §0 Foundations (new) — repo, tooling, flags, telemetry schema, determinism
· §1 Core simulation architecture (deepened)
· §2 Photoreal build (earth.html) (deepened)
· §3 Wanted / heat / police (deepened)
· §4 Economy / properties / shops (deepened)
· §5 Combat / weapons / boats / races / traffic AI (deepened)
· §6 Safehouse / hospital / collectibles (deepened)
· §7 World content & streaming (deepened)
· §8 Missions / narrative (deepened)
· §9 Audio (deepened)
· §10 UI / UX / accessibility (deepened)
· §11 Persistence / Continue (deepened)
· §12 Performance / mobile (deepened)
· §13 Tech debt / fragility (deepened)
· §14 Content pipeline & authoring tools (new)
· §15 QA & test matrix (new)
· §16 Localization & text (new)
· §17 Build / release / ops (new)
· §18 Risk register (new)
· §19 Milestones & critical path (new)
· §20 Cross-cutting gates (expanded)
· Master dependency DAG
· Priority implementation order (updated)

---

§0 Foundations (new)

Everything below depends on these. Do these first; they are cheap and unblock
parallel work.

0.1 Repo & tooling — (M)

[ ] tsconfig strict: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
[ ] ESLint rules: no floating promises, no any in src/sim, import order
[ ] Prettier + format-on-save config committed
[ ] Pre-commit hook: typecheck + lint on staged files
[ ] CI stages: install → typecheck → lint → unit → build → integration → perf-smoke
[ ] CI artifact retention: test reports + perf traces on failure (30 days)
[ ] Path aliases (@sim, @ui, @content) with single source of truth
[ ] Dev server with HMR; HMR preserves sim state where safe
[ ] Storybook-equivalent harness for HUD components (hud-harness.html)
[ ] Accept: pnpm ci green on a clean clone; HMR reload < 300ms.

0.2 Feature flags — (S)

[ ] Flag registry src/flags.ts with typed keys + defaults per build
[ ] Build targets: stylized, earth, diagnostic
[ ] Per-build override file; URL param override in dev only
[ ] Kill switches for expensive subsystems (helicopter, GLB actors, weather)
[ ] Flag state surfaced in §1.11 telemetry overlay
[ ] Accept: toggling a flag in dev takes effect without full reload where safe.

0.3 Determinism service — (M)

[ ] Seeded RNG service src/sim/Rng.ts (xoshiro or splitmix)
[ ] Named streams: traffic, peds, weather, missions, combat
[ ] No Math.random in src/sim (lint rule enforces)
[ ] Step-scoped RNG advance; replay hash = hash of (seed, step, state digest)
[ ] Replay recorder: input log + seed → deterministic re-run
[ ] Accept: 10,000-step replay of a scripted session produces identical hash twice.

0.4 Telemetry schema — (S)

[ ] Event naming: domain.entity.action (e.g. sim.traffic.spawn)
[ ] Schema file src/telemetry/schema.ts with payload types
[ ] Sampling policy (always / 1-in-N / dev-only)
[ ] Privacy: no PII, no free-text, documented retention
[ ] Sink abstraction (console / endpoint / no-op)
[ ] Accept: every event in the schema is emitted by at least one code path; schema validates.

0.5 Asset pipeline — (M)

[ ] Asset manifest assets/manifest.json with license field per asset
[ ] Import scripts: GLB → optimized (draco/meshopt), textures → atlas/compressed
[ ] Compression budget per asset class (audio, texture, mesh)
[ ] License audit script (fails build on missing license)
[ ] Accept: pnpm assets:audit reports 100% licensed; build fails otherwise.

0.6 Registries — (S)

[ ] Save-key registry (single enum; no string literals scattered)
[ ] Branding constants (canonical name, tagline, meta)
[ ] Coordinate-system constants (units, axes, up-vector, world origin)
[ ] Event-name registry (shared by §1.3 bus + telemetry)
[ ] Accept: grep finds zero duplicated literals for keys/brand/events.

---

§1 Core simulation architecture (deepened)

1.1 Fixed-step GameLoop — src/sim/GameLoop.ts — (L)

Contract

```ts
type Phase = 'input' | 'step' | 'postStep' | 'render';
interface GameLoop {
  start(): void; stop(): void;
  pause(src: PauseSource): void; resume(src: PauseSource): void;
  setTimeScale(src: PauseSource, scale: number): void;
  on(phase: Phase, cb: (dt: number, alpha: number) => void): Unsub;
  readonly stats: LoopStats; // stepMs p50/p95/p99, stepsPerFrame, accHighWater
}
```

Task tree

[ ] 1.1.1 Constant FIXED_DT = 1/60, configurable at boot
[ ] 1.1.2 Accumulator: acc += clamp(rawDt, 0, MAX_FRAME_DT) then while (acc >= FIXED_DT)
[ ] 1.1.3 Spiral-of-death guard: MAX_FRAME_DT = 0.25, MAX_STEPS_PER_FRAME = 5
[ ] 1.1.4 On step-cap overflow: emit sim.loop.overrun + FrameBudget warn (throttled 1/s)
[ ] 1.1.5 Interpolation alpha = acc / FIXED_DT passed to render subscribers
[ ] 1.1.6 Pause stack (ref-counted by source: menu, tab, cutscene, load, debug)
[ ] 1.1.7 Time-scale stack (slow-mo cutscene, hit-stop) — multiply per source, clamp
[ ] 1.1.8 Subscriber lists preallocated; no allocation on add/remove after warmup
[ ] 1.1.9 Phase order enforced: input → step×(N) → postStep → render(alpha)
[ ] 1.1.10 visibilitychange → push/pop tab pause; single catch-up step on visible
[ ] 1.1.11 Deterministic step: RNG advance per step (§0.3), state digest hook
[ ] 1.1.12 Replay hook: record input deltas per step; replay mode drives steps
[ ] 1.1.13 Watchdog: if stepMs > 50ms for 3 consecutive frames, drop quality tier
[ ] 1.1.14 Migrate TrafficDirector.update → fixed step
[ ] 1.1.15 Migrate ChaseController.update → fixed step
[ ] 1.1.16 Migrate PedestrianAI.update → fixed step
[ ] 1.1.17 Migrate VehicleDynamics.update → fixed step
[ ] 1.1.18 Migrate boat physics (Boat.tsx) → fixed step
[ ] 1.1.19 Migrate Police heat decay → fixed step
[ ] 1.1.20 Migrate mission timers → fixed step
[ ] 1.1.21 Migrate economy passive-income tick → fixed step
[ ] 1.1.22 Migrate weather transition → fixed step
[ ] 1.1.23 Header comment: table of which systems are sim-rate vs render-rate
[ ] 1.1.24 Debug overlay: step count, acc, time scale, pause sources

Test matrix

[ ] 1.1.T1 144Hz vs 30Hz replay of 60s scripted session → identical state hash
[ ] 1.1.T2 Heap snapshot: 10k steps, zero net allocation growth in sim
[ ] 1.1.T3 Pause stack: nested pause/resume returns to exact prior state
[ ] 1.1.T4 Tab hide 30s → visible: exactly one catch-up step, no burst
[ ] 1.1.T5 Step-cap overflow emits one warn/second, never drops frames unbounded
[ ] 1.1.T6 Time-scale 0.25 for 2s → 0.5s of sim elapses (±1 step)

Perf budget: stepMs p95 < 4ms on Device A (§12.1); stepsPerFrame p99 ≤ 2.
Edge cases: background throttling to 1Hz; laptop lid close; long GC pause; clock skew.
Accept: deterministic replay hash stable across refresh rates; no spiral-of-death under simulated 10s freeze.

---

1.2 PedGraph — src/sim/PedGraph.ts — (XL)

Contract

```ts
type PedNode = { id: number; x: number; y: number; z: number;
  kind: 'sidewalk'|'crosswalk'|'door'|'spawn'|'transit'|'bench' };
type PedEdge = { a: number; b: number; width: number; cost: number;
  kind: 'walk'|'cross'|'stairs'|'enter' };
interface PedGraph {
  build(road: RoadGraph, manifest: WorldManifest): BuildReport;
  nearest(x: number, z: number, mask?: NodeMask): PedNode | null;
  path(from: number, to: number, opts?: PathOpts): number[] | null; // A*
  occupancy: OccupancyGrid;
}
```

Task tree

[ ] 1.2.1 Node/edge types + NodeMask bitflags
[ ] 1.2.2 Derive sidewalk polylines from every RoadGraph edge (both sides, width from manifest)
[ ] 1.2.3 Intersection handling: trim sidewalks at curb radius; insert corner nodes
[ ] 1.2.4 Crosswalk nodes at signalized + unsignalized intersections
[ ] 1.2.5 Crosswalk metadata: signal id, phase, walk window (§13.1 signal FSM)
[ ] 1.2.6 Door nodes generated from building footprints (WorldManifest §1.6)
[ ] 1.2.7 Spawn nodes at block corners, transit stops, benches, storefronts
[ ] 1.2.8 Stairs/ramp edges for non-flat sidewalks (y delta on edge)
[ ] 1.2.9 Connected-component check on build → BuildReport.orphans
[ ] 1.2.10 Auto-prune orphan components below threshold; log the rest
[ ] 1.2.11 SpatialIndex registration per node (cell → node ids) → §1.8
[ ] 1.2.12 A* implementation with binary heap; tie-break by node id (deterministic)
[ ] 1.2.13 Cost model: length × lanePenalty × crosswalkPenalty × crowdPenalty
[ ] 1.2.14 Path smoothing: string-pulling within edge width, no corner clipping
[ ] 1.2.15 Occupancy grid: cell → count, decay per step, updated on ped move
[ ] 1.2.16 Local avoidance: sample ≤ 8 neighbors, steer vector, no allocation (Perf-safe)
[ ] 1.2.17 Right-hand walk bias by edge direction (lane feel)
[ ] 1.2.18 Crosswalk FSM: approach → wait → cross → clear, driven by signal phase
[ ] 1.2.19 Ped spawn/despawn tied to WorldStreamer tile residency (§1.7)
[ ] 1.2.20 LOD: path follow (near ≤ 30m), anchor-lerp (30–80m), freeze (> 80m)
[ ] 1.2.21 Bind to PedestrianAI; remove ad-hoc wander ([~] today)
[ ] 1.2.22 Door interaction: ped enters building → despawn with TTL → respawn at door
[ ] 1.2.23 Stuck detection: no progress > 3s → re-path; > 10s → despawn
[ ] 1.2.24 Debug overlay: nodes/edges color-coded by kind, occupancy heat, live paths
[ ] 1.2.25 Graph stats in telemetry: nodes, edges, orphans, p95 A* ms

Test matrix

[ ] 1.2.T1 200 agents on 3×3 block grid: no two centers < 0.35m for 10 min
[ ] 1.2.T2 Sidewalk adherence: zero road clips outside crosswalks in 10-min soak
[ ] 1.2.T3 A* p95 < 0.5ms for 100 concurrent queries on Device A
[ ] 1.2.T4 Crosswalk: peds only cross during walk window (±1 step)
[ ] 1.2.T5 Orphan pruning: injected dangling component is pruned + logged
[ ] 1.2.T6 Determinism: same seed + inputs → identical ped positions at step N
[ ] 1.2.T7 Stuck recovery: blocked agent re-paths and eventually despawns

Perf budget: build ≤ 200ms for NB map; per-step ped update ≤ 1.5ms at 150 peds.
Edge cases: dead-end alleys, T-intersections, diagonal roads, piers, bridges, building interiors.
Accept: peds walk sidewalks, cross only at crosswalks, never overlap, and the graph builds from manifest with zero console errors.

---

1.3 MissionRuntime — src/sim/MissionRuntime.ts — (XXL)

Contract

```ts
interface MissionRuntime {
  load(def: MissionDef): MissionHandle;
  scope(id: string): EntityScope;              // auto-destroys children on end
  emit<E extends EventName>(e: E, p: EventPayload<E>): void;
  on<E extends EventName>(e: E, fn: (p: EventPayload<E>) => void): Unsub;
  begin(id: MissionId): void; fail(reason: FailReason): void;
  retry(checkpoint?: CheckpointId): void; abandon(): void;
}
```

Task tree — event bus

[ ] 1.3.1 Typed event registry (single source of truth; shared with telemetry §0.4)
[ ] 1.3.2 emit/on/off with O(1) unsubscribe; listener arrays reused
[ ] 1.3.3 Re-entrancy guard: emit during emit queues to next microtask tick
[ ] 1.3.4 Listener error isolation: one throwing listener doesn't break others; logged
[ ] 1.3.5 Event log ring buffer (last 256) for debugging

Task tree — entity ownership

[ ] 1.3.6 spawn(kind, def) → handle; kinds: ped, vehicle, boat, prop, marker, sound
[ ] 1.3.7 handle.destroy() idempotent; removes from all subsystems + indexes
[ ] 1.3.8 Scoped ownership: mission/checkpoint/temporary scopes
[ ] 1.3.9 Scope teardown order: despawn → unsubscribe → free ids (reverse creation)
[ ] 1.3.10 Leak detector: after mission end, owned count must be 0 (assert in dev)
[ ] 1.3.11 Deterministic spawn: mission spawns use missions RNG stream (§0.3)

Task tree — triggers

[ ] 1.3.12 Volume trigger (AABB + sphere) with enter/exit/inside edges
[ ] 1.3.13 Distance trigger (player, entity, position)
[ ] 1.3.14 Flag trigger (save/flag state)
[ ] 1.3.15 Damage trigger (entity HP threshold)
[ ] 1.3.16 Inventory trigger (has/doesn't have weapon/item)
[ ] 1.3.17 Timer trigger (elapsed sim time)
[ ] 1.3.18 Trigger dedupe: fire-once flag; re-arm API
[ ] 1.3.19 Trigger debug overlay: volumes + armed/fired state

Task tree — conditions DSL

[ ] 1.3.20 Leaf predicates with stable ids (all/any/not combinators)
[ ] 1.3.21 Serialization of condition tree for save/replay
[ ] 1.3.22 Validation at load: unknown predicate / bad arity → actionable error
[ ] 1.3.23 Evaluation cost guard: warn if condition tree > 100 nodes

Task tree — objectives

[ ] 1.3.24 Ordered + parallel steps; optional/hidden steps
[ ] 1.3.25 Objective state: pending / active / complete / failed
[ ] 1.3.26 Step advance emits mission.step.changed (HUD §10.1, audio §9.4)
[ ] 1.3.27 Marker/route request per active step (→ ObjectiveNav)
[ ] 1.3.28 Target-distance checks include boat mode (today [~])

Task tree — fail/retry/checkpoint

[ ] 1.3.29 Fail reasons: timeout, actor death, vehicle wreck, out-of-bounds, wanted, scripted
[ ] 1.3.30 Checkpoint capture: world digest + owned entity seeds + inventory + position
[ ] 1.3.31 Retry: reset world to checkpoint, respawn entities, restore inventory
[ ] 1.3.32 Retry must restore an identical world hash (modulo RNG seed) — assert
[ ] 1.3.33 Abandon: teardown scopes, clear markers, restore pre-mission inventory
[ ] 1.3.34 Replay completed mission: no economy double-dip flag

Task tree — integration

[ ] 1.3.35 Cutscene hand-off stub (→ §8.2)
[ ] 1.3.36 Audio ducking hook on cutscene/chase (→ §9.4)
[ ] 1.3.37 Persistence: active id + step index + owned seeds → SaveGame (§1.5)
[ ] 1.3.38 Migrate mounthope.mission.v1 → runtime-owned schema
[ ] 1.3.39 Authoring API: defineMission(...) with validation
[ ] 1.3.40 Debug panel: active missions, owned counts, trigger/condition state

Test matrix

[ ] 1.3.T1 50 random fail/retry/abandon cycles → zero leaked entities
[ ] 1.3.T2 Retry restores identical world hash to pre-fail checkpoint
[ ] 1.3.T3 Every trigger type fires exactly once in a scripted replay
[ ] 1.3.T4 Condition tree with 500 nodes evaluates < 0.1ms
[ ] 1.3.T5 Malformed mission def fails fast with file+line
[ ] 1.3.T6 Save mid-step → reload → resume at same step index

Perf budget: runtime overhead ≤ 0.3ms/step with 5 active missions.
Edge cases: fail during cutscene; save during retry; abandon during loading; two missions sharing an entity.
Accept: no mission ends with live owned entities; retry is exact; authoring errors are caught at load.

---

1.4 ClockWeather — src/sim/ClockWeather.ts — (L)

Contract

```ts
interface ClockWeather {
  readonly day: number; readonly time01: number;  // 0..1
  readonly weather: WeatherKind; readonly wetness: number; // 0..1
  readonly wind: Vec3;
  friction(surface: Surface): number;              // 0..1 multiplier
  setWeather(k: WeatherKind, blendSec?: number): void;
  advance(dt: number): void;                        // called from GameLoop step
  serialize(): ClockWeatherSave; restore(s: ClockWeatherSave): void;
}
```

Task tree

[ ] 1.4.1 Clock: day index, time01, timeScale, pause on menu
[ ] 1.4.2 Configurable day length; sunrise/sunset tables per season
[ ] 1.4.3 Sun/moon direction + color curve → lighting uniforms
[ ] 1.4.4 Night factor 0..1 consumed by lights (§7.6) + shaders
[ ] 1.4.5 Weather FSM: clear → cloudy → rain → storm → fog → clear
[ ] 1.4.6 Transition durations + cross-fade weights per transition
[ ] 1.4.7 Wetness accumulator: rises in rain/storm, decays after
[ ] 1.4.8 friction() table: asphalt, wet asphalt, dirt, grass, sand, planks, water
[ ] 1.4.9 Wind vector (rain slant, tree sway, boat drift, wave direction)
[ ] 1.4.10 Lightning flash event (visual + thunder audio hook → §9.1)
[ ] 1.4.11 Snow: visual only; road friction TBD (explicit note, not silent)
[ ] 1.4.12 Fog density curve; full fog type wired (today clear↔rain only) → §7.5
[ ] 1.4.13 Streaming hint: reduce far LOD / draw distance in fog/storm (§1.7)
[ ] 1.4.14 Serialize/restore clock + weather + transition progress
[ ] 1.4.15 Deterministic weather from weather RNG stream (§0.3)
[ ] 1.4.16 Telemetry: current weather, wetness, friction sample

Test matrix

[ ] 1.4.T1 Wet braking distance ≥ 20% longer than dry (scripted stop test)
[ ] 1.4.T2 Weather round-trips through save mid-transition
[ ] 1.4.T3 clear↔rain toggle in < 1s produces no visual popping
[ ] 1.4.T4 Same seed + dt → identical weather timeline
[ ] 1.4.T5 Fog reduces draw distance within one step of transition start

Consumers (must all be wired): vehicles (§1.9), peds (umbrella? TBD), boats (§5.3), lighting (§7.6), audio ambient (§9.1), streaming (§1.7), HUD (§10.1).
Accept: wet road measurably changes handling; weather persists; no popping.

---

1.5 SaveGame — src/sim/SaveGame.ts — (XL)

Contract

```ts
const SAVE_KEY = 'mounthope.save';
const SCHEMA_VERSION = 2;
interface SaveBlobV2 {
  schemaVersion: 2; createdAt: number; build: string;
  stats; economy; mission; position; settings; scrimshaw; touchLayout;
  boat; raceBests; radio; weapons; waypoint; carDamage; clockWeather;
}
```

Task tree — schema

[ ] 1.5.1 Define full V2 interface (all fields above enumerated in code comment)
[ ] 1.5.2 Field-level validators (type + range + referential integrity)
[ ] 1.5.3 Size budget assert < 256KB serialized
[ ] 1.5.4 Optional fields nullable; missing = default, never crash

Task tree — migration

[ ] 1.5.5 Migration runner: chained v1→v2, idempotent, tested per hop
[ ] 1.5.6 Migrate mounthope.mission.v1
[ ] 1.5.7 Migrate scattered settings keys into settings
[ ] 1.5.8 Unknown future version → refuse load with recovery UI (§11.4)

Task tree — IO

[ ] 1.5.9 Compression (LZ-string or equivalent) + checksum
[ ] 1.5.10 Atomic write: write save.tmp, verify, swap to save
[ ] 1.5.11 Corrupt detection: parse fail / schema fail / checksum mismatch
[ ] 1.5.12 Export/import JSON (debug)
[ ] 1.5.13 Autosave throttle: not during cutscene/chase spike/loading
[ ] 1.5.14 Quicksave binding + cooldown
[ ] 1.5.15 Slot manager (single first, multi behind flag) → §11.4
[ ] 1.5.16 Cloud sync TBD — document decision

Test matrix

[ ] 1.5.T1 Fuzz: 1000 random valid states → save → load → deep-equal
[ ] 1.5.T2 Fuzz: 1000 corrupt payloads → no throw, always recovery path
[ ] 1.5.T3 v1→v2 migration fixtures (≥ 5 real legacy saves)
[ ] 1.5.T4 Atomic write: kill between tmp write and swap → old save intact
[ ] 1.5.T5 Size: worst-case state < 256KB
[ ] 1.5.T6 Autosave never fires during a cutscene flag

Accept: round-trip fuzz green; corrupt saves never brick; migrations tested per hop.

---

1.6 WorldManifest — src/sim/WorldManifest.ts — (L)

Contract (schema sketch)

```ts
interface WorldManifest {
  version: number;
  zones: Zone[]; tiles: TileRef[]; roads: RoadDef[]; buildings: BuildingDef[];
  props: PropDef[]; markers: MarkerDef[]; spawns: SpawnDef[]; doors: DoorDef[];
  signals: SignalDef[]; raceTracks: RaceDef[]; collectibles: CollectibleDef[];
  fronts: FrontDef[]; territories: TerritoryDef[];
}
```

Task tree

[ ] 1.6.1 JSON Schema file + runtime validator with file:line errors
[ ] 1.6.2 Manifest version + migration for authored-data changes
[ ] 1.6.3 Lint: dangling door→PedGraph node, missing tile ref, duplicate ids
[ ] 1.6.4 Build step: manifest → RoadGraph + PedGraph + SpatialIndex seed
[ ] 1.6.5 Manifest-driven WorldStreamer tile list (replace hardcoded rings)
[ ] 1.6.6 Hot reload in dev: watch JSON, rebuild graphs, keep player position
[ ] 1.6.7 Referential-integrity pass: every marker/collectible/front resolves
[ ] 1.6.8 Manifest stats in telemetry (counts per class)

Test matrix

[ ] 1.6.T1 Malformed manifest fails fast with actionable path
[ ] 1.6.T2 Valid manifest boots sim with zero console errors
[ ] 1.6.T3 Hot reload preserves player position + mission state
[ ] 1.6.T4 Lint catches each known-bad fixture (one per rule)

Accept: one schema governs all authored data; boot is clean; hot reload works.

---

1.7 WorldStreamer follow-ups — (M, mostly done)

[x] Real load/evict loop (JSON cache eviction + evictUnwanted grace)
[x] Predictive focus in StreamingBuildings
[ ] 1.7.1 Metrics: resident, queue, evict, load ms p50/p95, failures
[ ] 1.7.2 Prefetch by heading/velocity (not just position) for fast vehicles
[ ] 1.7.3 Priority: player tile > frustum > predicted > ring
[ ] 1.7.4 Cancellation: in-flight loads for evicted tiles dropped on arrival
[ ] 1.7.5 Error retry with backoff; persistent failures → HUD notice
[ ] 1.7.6 Eviction hysteresis tuned against orbit thrash
[ ] 1.7.7 tileImpostor() wired into active streaming set → §7.12
[ ] 1.7.8 30-min drive soak: resident plateau, memory flat (→ §12.2)

Accept: no pop-in > 1 frame at 60 km/h on Device A; memory flat over 30 min.

---

1.8 SpatialIndex (buildings / vehicles / LOS) — (L)

- [~] Ped-only today — extend to all classes
[ ] 1.8.1 Class registry with per-class cell sizes (static large, dynamic small)
[ ] 1.8.2 Static classes: buildings, props, markers
[ ] 1.8.3 Dynamic classes: vehicles, peds, boats, mission entities
[ ] 1.8.4 Insert/remove O(1) amortized; no full rebuild per frame
[ ] 1.8.5 radius(pos, r, mask) query
[ ] 1.8.6 segment(a, b, mask) LOS with per-cell early-out + maxDepth guard
[ ] 1.8.7 Rapier broadphase integration where physics exists
[ ] 1.8.8 Debug overlay: cell occupancy + last query
[ ] 1.8.9 Tests: 2000 entities, 500 queries/frame < 1ms on Device A
[ ] 1.8.10 Tests: LOS agrees with raycast ground truth on 100 random pairs

Accept: unified index; LOS used by witnesses (§3.1), AI, and camera.

---

1.9 Deeper vehicle model — (XL)

- [~] Suspension, surfaces, impact damage — finish
[ ] 1.9.1 Per-wheel spring/damper; ride height; body roll/pitch coupling
[ ] 1.9.2 Tire model: slip ratio/angle; longitudinal vs lateral grip split
[ ] 1.9.3 Surface friction table fed by ClockWeather.friction() (§1.4)
[ ] 1.9.4 Per-wheel surface sample from WorldManifest polygons
[ ] 1.9.5 Weight transfer under accel/brake/corner (visual + handling)
[ ] 1.9.6 Damage: panel/engine/wheel HP; steering pull; smoke → fire stages
[ ] 1.9.7 Impact via Rapier contact events; threshold curve by relative speed
[ ] 1.9.8 Visual deformation capped per quality tier
[ ] 1.9.9 Powertrain: gear ratios, torque curve, reverse, handbrake
[ ] 1.9.10 Brake/ABS tuning; handbrake drift model
[ ] 1.9.11 Bike/motorcycle variant (if content exists; else TBD)
[ ] 1.9.12 Boat coupling → §5.3
[ ] 1.9.13 AI drivers share controller via TrafficDirector
[ ] 1.9.14 Tests: lap delta wet vs dry ≥ 8%
[ ] 1.9.15 Tests: damage state persists to save (§11.2)
[ ] 1.9.16 Tests: suspension stable at 120Hz and 30Hz sim

Accept: handling reacts to surface/weather; damage persists; no suspension blow-up at any step rate.

---

1.10 Mobile controls — TouchControls.tsx — (L)

- [~] Mode-aware foot / car / boat — finish
[ ] 1.10.1 Input mode FSM: foot | car | boat | swim | menu | cutscene
[ ] 1.10.2 Auto-switch on enter/exit vehicle; manual override toggle
[ ] 1.10.3 Foot set: move stick, look drag, sprint, interact, jump
[ ] 1.10.4 Car set: throttle/brake, steer (tilt/thumb toggle), handbrake, horn, camera
[ ] 1.10.5 Boat set: throttle, rudder, camera, anchor
[ ] 1.10.6 Context-sensitive action button (enter/exit/interact/pickup)
[ ] 1.10.7 Layout editor: drag/resize, save to settings, reset to default
[ ] 1.10.8 Safe-area insets (notch) + landscape/portrait
[ ] 1.10.9 Haptics hooks (no-op where unsupported)
[ ] 1.10.10 Desktop parity map documented per mode → §10.3
[ ] 1.10.11 Tests: every sim action reachable per mode; no dead zones
[ ] 1.10.12 Tests: layout persists through save (§11.1)

Accept: every action reachable on touch in each mode; layout persists.

---

1.11 Telemetry — (M)

- [~] Budget warnings, counts, streamer stats, percentiles — finish
[ ] 1.11.1 Percentile ring buffers (p50/p95/p99) for frame/sim/render/streamer
[ ] 1.11.2 Entity counts: peds, vehicles, boats, mission entities, resident
[ ] 1.11.3 Streamer: queue, resident, evict, load ms, failures
[ ] 1.11.4 FrameBudget overruns with system attribution
[ ] 1.11.5 Memory via performance.memory where available; dev heap snapshots
[ ] 1.11.6 Toggleable overlay + JSON dump (dev key combo)
[ ] 1.11.7 Threshold alarms (p95 frame > X for Ys) → warn + overlay badge
[ ] 1.11.8 Export last 60s to clipboard for bug reports
[ ] 1.11.9 Overlay cost < 0.3ms/frame visible, 0 hidden (test)

Accept: overlay is free when hidden; dump reproduces a reported bug.

---

1.12 Stage 0–7 acceptance harness — (L)

[ ] 1.12.1 Define stages: 0 boot, 1 walk, 2 drive, 3 mission, 4 chase, 5 boat, 6 economy, 7 save
[ ] 1.12.2 Per stage: scripted input, assertions, screenshot hook
[ ] 1.12.3 Device FPS gate per stage (Device A + B, §12.1)
[ ] 1.12.4 Stream memory plateau check (30 min, ±5% resident)
[ ] 1.12.5 Mission fail/retry gate (deterministic seed)
[ ] 1.12.6 CI: headless run, artifact bundle on failure
[ ] 1.12.7 Green on both devices; artifacts upload

Accept: all stages green on both devices; failures upload reproducible artifacts.

---

§2 Photoreal build (earth.html) (deepened)

2.1 Stability — (XL)

- [~] Stability pass — finish
[ ] 2.1.1 Raycast throttle: max N/frame, priority queue
[ ] 2.1.2 Alloc-free hot paths (preallocated vectors, no closures in loops)
[ ] 2.1.3 maxDepth on all recursive traversals
[ ] 2.1.4 NaN guards on transforms (assert + recover + telemetry)
[ ] 2.1.5 Tile/asset fetch retry with backoff + circuit breaker
[ ] 2.1.6 WebGL context-loss handler: pause, restore, HUD notice
[ ] 2.1.7 Frame-time watchdog: drop quality tier on sustained overrun
[ ] 2.1.8 20-min soak: zero context-loss crashes on Device A

Accept: 20-min soak clean; context loss recovers without reload.

2.2 Idle / pause — (S)

[ ] 2.2.1 Pause render on visibilitychange
[ ] 2.2.2 Idle detection (no input N s) → 15fps or pause
[ ] 2.2.3 Resume fast-path: single step, no catch-up
[ ] 2.2.4 Hidden-tab CPU < 2% on Device A (test)

2.3 Auth overlays — (S)

- [~] Distinct 401 vs 429 — finish
[ ] 2.3.1 401 copy + retry sign-in
[ ] 2.3.2 429 copy + backoff ETA + retry
[ ] 2.3.3 5xx/network → generic retry
[ ] 2.3.4 Never blank canvas; always fallback ground (§2.10)
[ ] 2.3.5 Each code renders correct copy; retry recovers without reload

2.4 Locomotion animation — (L)

[ ] 2.4.1 Idle + breathing loop
[ ] 2.4.2 Walk cycle (speed-blended)
[ ] 2.4.3 Run cycle + sprint
[ ] 2.4.4 Foot IK to ground height
[ ] 2.4.5 Jump/fall/land states
[ ] 2.4.6 Blend tree idle↔walk↔run; no popping
[ ] 2.4.7 Turn-in-place for sharp heading changes
[ ] 2.4.8 No skating at walk/run; no T-pose on transition (test)

2.5 Earth HUD parity — (L)

[ ] 2.5.1 Minimap + big map parity
[ ] 2.5.2 Compass parity
[ ] 2.5.3 Health/damage parity
[ ] 2.5.4 Wanted stars parity
[ ] 2.5.5 Interact prompts parity
[ ] 2.5.6 Mission markers parity
[ ] 2.5.7 Shared HUD component layer → §13.4
[ ] 2.5.8 Every element has earth equivalent or documented omission

2.6 Vehicles — (L)

[ ] 2.6.1 Source CC0 GLB set; license file committed (§13.5)
[ ] 2.6.2 Import pipeline + LODs + material remap
[ ] 2.6.3 Night headlights: emissive + spotlight, budgeted per tier
[ ] 2.6.4 Share with stylized where feasible
[ ] 2.6.5 Headlights cost < 1ms on Device A (test)

2.7 Pedestrians — (M)

[ ] 2.7.1 ≥ 3 distinct models + palette variation
[ ] 2.7.2 Bound to PedGraph pathfollowing (§1.2)
[ ] 2.7.3 50 peds visible, no two adjacent identical (test)

2.8 Earth gameplay loop — (XL)

[ ] 2.8.1 Missions wired (§1.3)
[ ] 2.8.2 Wanted/heat wired (§3)
[ ] 2.8.3 Economy wired (§4)
[ ] 2.8.4 Persistence parity (§1.5)
[ ] 2.8.5 Full mission completable start-to-finish in earth (test)

2.9 Earth environment — (L)

[ ] 2.9.1 Day/night ↔ weather coupling (§1.4)
[ ] 2.9.2 Water rendering + reflections budgeted
[ ] 2.9.3 SFX parity hooks
[ ] 2.9.4 Save/load parity
[ ] 2.9.5 Weather change reflected within 1 frame of transition

2.10 Fallbacks — (M)

[ ] 2.10.1 Fallback ground plane on tile failure
[ ] 2.10.2 Fallback sky gradient on env failure
[ ] 2.10.3 Fallback vehicle model on GLB failure
[ ] 2.10.4 Forced tile 500 → still walk/drive on fallback (test)

2.11 Documentation & measurement — (M)

[ ] 2.11.1 Characters & Missions bible (§8)
[ ] 2.11.2 Real iPhone measurement pass (named device)
[ ] 2.11.3 Decision record: share SimBootstrap or demote earth to diagnostic
[ ] 2.11.4 If shared: both builds boot from same sim (test)

---

§3 Wanted / heat / police (deepened)

3.1 Heat model — (L)

- [~] Dual-axis heat + road chase ≥3★ — finish
[ ] 3.1.1 Dual axes: suspicion (unseen) vs wanted (seen); per-axis decay
[ ] 3.1.2 Witness system: ped LOS → suspicion; cop LOS → wanted
[ ] 3.1.3 Crime table: assault/shots/hit-run/kill → heat deltas
[ ] 3.1.4 LOS gating via SpatialIndex.segment (§1.8)
[ ] 3.1.5 Per-crime cooldown to prevent farming
[ ] 3.1.6 Decay when unseen + outside lose-heat zone
[ ] 3.1.7 Shooting witness raises wanted; hiding lowers predictably (test)

3.2 Star tiers — (M)

[ ] 3.2.1 Tier table 1–5: spawn rate, units, roadblocks, heli, PIT
[ ] 3.2.2 T1: one cruiser
[ ] 3.2.3 T2: two cruisers + light roadblocks
[ ] 3.2.4 T3: three + heli scout
[ ] 3.2.5 T4: roadblocks + heli spotlight + PIT
[ ] 3.2.6 T5: full response + APB, no natural decay
[ ] 3.2.7 Escalation triggers (witness count, officer down, repeats)
[ ] 3.2.8 De-escalation: bribe / lose-heat zone / safehouse / time
[ ] 3.2.9 Each tier produces documented response within 10s (test)

3.3 Police units — (XL)

[ ] 3.3.1 Foot cops: PedGraph patrol, chase, tackle/arrest
[ ] 3.3.2 Road cops: polish ChaseController
[ ] 3.3.3 Roadblocks: spawn ahead on RoadGraph, static + manned
[ ] 3.3.4 Helicopter: orbit + spotlight + LOS report
[ ] 3.3.5 PIT: bounded impulse, damage, cooldown
[ ] 3.3.6 Rapier collision cop↔player (§1.9)
[ ] 3.3.7 Officer down / corpse persistence (§13.2)
[ ] 3.3.8 Heli holds LOS 80% of 60s chase on open road (test)

3.4 Faction heat — (M)

[ ] 3.4.1 Territory polygons in manifest
[ ] 3.4.2 Aggro on entry while hostile
[ ] 3.4.3 NPC response per faction (drive-bys, foot squads)
[ ] 3.4.4 Faction heat decays outside territory
[ ] 3.4.5 Hostile entry escalates within one block (test)

3.5 Wanted UX — (M)

[ ] 3.5.1 Wanted radar (unit blips)
[ ] 3.5.2 Backup call event (audio + HUD)
[ ] 3.5.3 Lose-heat zones on map + decay inside
[ ] 3.5.4 Full-screen tier transition flash
[ ] 3.5.5 Player always knows tier + decay state (test)

---

§4 Economy / properties / shops (deepened)

4.1 Fronts — (L)

- [~] Buy + passive income + boom/leak — finish
[ ] 4.1.1 Front defs in manifest (cost, income, risk, boom/leak)
[ ] 4.1.2 Purchase flow: prompt → confirm → persist
[ ] 4.1.3 Passive income tick (fixed step §1.1)
[ ] 4.1.4 Boom/leak events + HUD notification
[ ] 4.1.5 Ownership reflected in world (signage, unlocked doors)
[ ] 4.1.6 Buy → income → persist across save/load (test)

4.2 Upgrades / employees / sell — (M)

[ ] 4.2.1 Upgrade tiers (income multiplier, risk)
[ ] 4.2.2 Employee hiring (cost, effect, upkeep)
[ ] 4.2.3 Sell/foreclose with penalty
[ ] 4.2.4 Ownership management UI
[ ] 4.2.5 Upgrade changes income within one tick; sell refunds correctly (test)

4.3 Ownership-tied missions — (S)

[ ] 4.3.1 Mission unlock gated by owned front
[ ] 4.3.2 Ownership change refreshes availability
[ ] 4.3.3 Selling a front disables its tied mission cleanly (test)

4.4 Shops — (L)

[ ] 4.4.1 Ammo shop
[ ] 4.4.2 Weapons shop (gated by wanted/mission)
[ ] 4.4.3 Clothes shop (appearance swap)
[ ] 4.4.4 Garage storage (beyond respray)
[ ] 4.4.5 Interiors or counter interaction (interim: counter prompt)
[ ] 4.4.6 Each purchase reflected immediately (test)

4.5 Payout / balance — (M)

[ ] 4.5.1 Day-based payout summary UI
[ ] 4.5.2 Balance pass: time-to-first-upgrade, time-to-wealth
[ ] 4.5.3 Distant business markers need world content (§7.2)
[ ] 4.5.4 Fresh save reaches first upgrade ≤ 20 min (test)

---

§5 Combat / weapons / boats / races / traffic AI (deepened)

5.1 Melee & guns — (L)

- [~] Fists/bat/pistol/shotgun — finish
[ ] 5.1.1 Melee: swing arcs, hitboxes, stagger, finisher
[ ] 5.1.2 Pistol: hitscan, spread, falloff, tracer
[ ] 5.1.3 Shotgun: pellet spread, per-pellet damage, reload
[ ] 5.1.4 Weapon switch animation/state
[ ] 5.1.5 Distinct TTK per weapon on dummy (test)

5.2 Inventory & ammo — (L)

[ ] 5.2.1 Ammo counts: reserve vs magazine
[ ] 5.2.2 Reload action with cancel + interrupt
[ ] 5.2.3 Inventory model + persistence (§1.5)
[ ] 5.2.4 Pickups: world ammo/weapon, respawn rules
[ ] 5.2.5 Recoil/accuracy: bloom, recovery, ADS
[ ] 5.2.6 Weapon wheel / quick-swap (§10.1)
[ ] 5.2.7 Cover system (scope gate)
[ ] 5.2.8 Spread-aware reticle + hit feedback
[ ] 5.2.9 Empty→reload→pickup→persist (test)

5.3 Boats — (L)

- [~] One marina boat — finish
[ ] 5.3.1 Buoyancy: sample wave height, spring to surface
[ ] 5.3.2 Wave system (deterministic, tied to wind §1.4)
[ ] 5.3.3 Damage + sinking state
[ ] 5.3.4 ≥ 3 boats with distinct handling
[ ] 5.3.5 Boat in Continue save (§11.2)
[ ] 5.3.6 Swim mode (§7.4)
[ ] 5.3.7 Floats, bobs, damages, sinks, persists (test)

5.4 Races — (L)

- [~] One race loop — finish
[ ] 5.4.1 Multi-track defs in manifest
[ ] 5.4.2 AI opponents on RoadGraph with rubber-band tuning
[ ] 5.4.3 Fail timer + DNF handling
[ ] 5.4.4 Persisted best per track + class
[ ] 5.4.5 Class locks (vehicle type)
[ ] 5.4.6 Race HUD (position, lap, splits)
[ ] 5.4.7 3 tracks × 3 opponents deterministic finish; bests save (test)

5.5 Traffic AI — (L)

[ ] 5.5.1 Collision avoidance (car-following, lane change)
[ ] 5.5.2 Parking AI (drive to slot, park, despawn)
[ ] 5.5.3 Door/sidewalk coupling (parked driver becomes ped)
[ ] 5.5.4 Yield/lights via signal FSM (§13.1)
[ ] 5.5.5 5-min soak: zero deadlocks, ≤ 1% stuck cars (test)

---

§6 Safehouse / hospital / collectibles (deepened)

6.1 Safehouse — (M)

- [~] Heat clear + sleep; hospital; wasted/busted — finish
[ ] 6.1.1 Entry → heat clear + save prompt
[ ] 6.1.2 Sleep advances clock (§1.4)
[ ] 6.1.3 Multiple unlockable safehouses w/ interiors (§6.2)
[ ] 6.1.4 Wardrobe (ties to §4.4)
[ ] 6.1.5 Sleep advances to next morning; heat clears (test)

6.2 Interiors — (L)

[ ] 6.2.1 Interior scene loading (additive room volumes)
[ ] 6.2.2 One detailed safehouse interior
[ ] 6.2.3 Hospital interior + respawn point
[ ] 6.2.4 Police station interior (busted flow)
[ ] 6.2.5 Enter/exit without streaming errors (test)

6.3 Wasted / busted — (M)

- [~] Flow exists — finish
[ ] 6.3.1 Wasted: fade, hospital respawn, fee, weapon-loss rule
[ ] 6.3.2 Busted: fade, station respawn, fee, confiscation rule
[ ] 6.3.3 Narrative flavor lines per cause
[ ] 6.3.4 Each cause → correct respawn/fee/inventory (test)

6.4 Collectibles — (M)

- [~] 8 downtown scrimshaw — finish
[ ] 6.4.1 Citywide sets (e.g. 30) + progress tracking
[ ] 6.4.2 Map progress view + per-set rewards
[ ] 6.4.3 Unique rewards (vehicles, weapons, cosmetics)
[ ] 6.4.4 FR/Cape collectibles when content lands (§7.3)
[ ] 6.4.5 Full set grants reward exactly once; saves (test)

---

§7 World content & streaming (deepened)

7.1 Streaming — (M)

- [~] NB tile stream + FR heroes — finish
[x] JSON cache eviction + unwanted grace
[ ] 7.1.1 GPU mesh dispose on unmount verified (§12.2)
[ ] 7.1.2 tileImpostor() in active set (§1.7.7)
[ ] 7.1.3 Resident plateau + no GPU leak over 30 min (test)

7.2 Districts — (L)

[ ] 7.2.1 Lived-in Fall River (props, peds, businesses)
[ ] 7.2.2 NB polish (props, signage, lighting)
[ ] 7.2.3 Each district passes walk-through checklist

7.3 Cape / Hyannis / Brockton (Act II/III) — (XXL)

[ ] 7.3.1 Cape road graph + tiles
[ ] 7.3.2 Hyannis tiles + roads
[ ] 7.3.3 Brockton tiles + roads
[ ] 7.3.4 Act II/III missions unblocked (§8.6)
[ ] 7.3.5 No void reachable by driving from start (test)

7.4 Water & weather gameplay — (L)

[ ] 7.4.1 Swim mode (enter water, stamina, drown risk)
[ ] 7.4.2 Storm-surge "Gloria" event
[ ] 7.4.3 Stronger water reflections (tiered)
[ ] 7.4.4 Weather → tire friction (§1.4, §1.9)
[ ] 7.4.5 Gloria surge + handling change; swim from any shoreline (test)

7.5 Fog — (S)

- [~] Fog wired (toggle clear↔rain today)
[ ] 7.5.1 Fog reachable in cycle + toggle
[ ] 7.5.2 Fog affects draw distance + streaming hint
[ ] 7.5.3 Toggling fog changes visibility immediately (test)

7.6 Night lighting — (M)

[ ] 7.6.1 Streetlights (instanced, tiered)
[ ] 7.6.2 Lit windows (emissive atlas or instanced)
[ ] 7.6.3 Light count cap per tile
[ ] 7.6.4 Night reads as lit without frame-budget drop (test)

7.7 LOD — (M)

[ ] 7.7.1 Distant LOD for non-building content
[ ] 7.7.2 Dithered/faded LOD transitions
[ ] 7.7.3 No visible pop at 200m on Device A (test)

7.8 Hero content — (M)

[ ] 7.8.1 ≥ 2 hand-detailed hero interiors
[ ] 7.8.2 Hero exteriors with unique props/signage
[ ] 7.8.3 Hero interiors match external orientation/scale (test)

---

§8 Missions / narrative (deepened)

8.1 Chain — (L)

- [~] 11-mission chain + markers + persistence — finish
[ ] 8.1.1 All 11 complete start-to-finish
[ ] 8.1.2 Marker/route correct per step (§1.3)
[ ] 8.1.3 Step persists across save/reload per mission
[ ] 8.1.4 11/11 automated run passes (test)

Chain scaffold (fill beats as authored):

# Working title Beats (author) Entities Fail modes
M01 Fish pier opening … … …
M02 … … … …
… … … … …
M11 Finale … … …

8.2 Dialogue & cutscenes — (L)

[ ] 8.2.1 Dialogue system: lines, speaker, portrait/name, skip, log
[ ] 8.2.2 Cutscene camera tracks + entity animation cues
[ ] 8.2.3 Subtitle hook (§10.4)
[ ] 8.2.4 VO hook with Web Speech fallback (§9.5)
[ ] 8.2.5 Cutscene plays, skips, logs, no soft-lock (test)

8.3 Objective types — (L)

[ ] 8.3.1 Timed fails
[ ] 8.3.2 Escort (follow, protect HP)
[ ] 8.3.3 Destroy (targets, waves)
[ ] 8.3.4 Photo (framing + subject check)
[ ] 8.3.5 Delivery / pickup
[ ] 8.3.6 One implemented beat + test per type

8.4 Triggers — (M)

- [~] Basic triggers — richer
[ ] 8.4.1 Volume triggers with enter/exit
[ ] 8.4.2 Damage triggers
[ ] 8.4.3 Inventory/flag triggers
[ ] 8.4.4 Timer triggers
[ ] 8.4.5 Each type fires exactly once in replay (test)

8.5 Fail / retry / abandon / replay — (M)

[ ] 8.5.1 Fail overlay + retry/abandon menu
[ ] 8.5.2 Retry to checkpoint (§1.3)
[ ] 8.5.3 Abandon removes owned entities + markers
[ ] 8.5.4 Replay completed missions with no economy double-dip
[ ] 8.5.5 All four flows work on a 3+ entity mission (test)

8.6 Content — (XL)

[ ] 8.6.1 3D world arrow widget (on/off-screen)
[ ] 8.6.2 Authored opening fish-pier set piece
[ ] 8.6.3 Boat mode in target distance checks (§5.3)
[ ] 8.6.4 Playable mid/late campaign once map content exists (§7.3)
[ ] 8.6.5 Opening set piece plays with correct camera/audio/markers (test)

---

§9 Audio (deepened)

9.1 SFX — (L)

- [~] Procedural SFX + 4 stations — finish
[ ] 9.1.1 Surface footsteps (asphalt/grass/wood/water)
[ ] 9.1.2 Door/UI packs
[ ] 9.1.3 Ped VO barks (greeting/panic/hit)
[ ] 9.1.4 Impact variety (material × intensity matrix)
[ ] 9.1.5 Weapon SFX per weapon
[ ] 9.1.6 Every friction surface has footstep + impact (test)

9.2 Spatial audio — (L)

[ ] 9.2.1 Positional audio (PannerNode or equivalent)
[ ] 9.2.2 Distance attenuation per category
[ ] 9.2.3 Occlusion stub (muffle behind geometry)
[ ] 9.2.4 Listener from CameraRig
[ ] 9.2.5 Passing siren pans + attenuates correctly (test)

9.3 Radio — (M)

- [~] Fill Rage/Anvil track lists — finish
[ ] 9.3.1 Longer talk scripts, ads, station IDs
[ ] 9.3.2 ≥ 6 stations
[ ] 9.3.3 Station persisted (§11.2)
[ ] 9.3.4 No station has empty track list; persistence round-trips (test)

9.4 Music — (M)

[ ] 9.4.1 Deferred music loading (no boot block)
[ ] 9.4.2 Adaptive layers: explore/mission/chase/wanted
[ ] 9.4.3 Cross-fades without clicks
[ ] 9.4.4 Chase→wanted seamless + loop-safe (test)

9.5 Mobile VO — (S)

- [~] Mobile-safe VO path — finish
[ ] 9.5.1 Detect Web Speech; fallback to text-only subtitles
[ ] 9.5.2 Never block gameplay on VO
[ ] 9.5.3 VO-silent path still delivers all narrative text (test)

---

§10 UI / UX / accessibility (deepened)

10.1 HUD — (L)

- [~] HUD, minimap, big map, touch editor, menus — finish
[ ] 10.1.1 Compass
[ ] 10.1.2 Damage direction indicator
[ ] 10.1.3 Wanted full-screen tiers
[ ] 10.1.4 Unified interact prompts (§1.10)
[ ] 10.1.5 Weapon wheel (§5.2)
[ ] 10.1.6 Every element has a data source + updates without lag (test)

10.2 Map — (M)

[ ] 10.2.1 Legend
[ ] 10.2.2 Fog-of-war
[ ] 10.2.3 Richer blips (shops/safehouses/races/collectibles)
[ ] 10.2.4 Route line parity with minimap
[ ] 10.2.5 All marker classes with distinct icons + legend (test)

10.3 Input — (M)

[ ] 10.3.1 Context-sensitive touch sets (§1.10)
[ ] 10.3.2 Desktop remap UI + persistence
[ ] 10.3.3 Gamepad support (scope gate)
[ ] 10.3.4 Remapped keys persist + honored everywhere (test)

10.4 Accessibility — (M)

[ ] 10.4.1 Screen reader labels for HUD + menus
[ ] 10.4.2 Colorblind modes (wanted stars, map blips)
[ ] 10.4.3 Subtitle scale + background opacity
[ ] 10.4.4 Reduced motion (shake, flashes)
[ ] 10.4.5 Each a11y option toggles + persists independently (test)

10.5 Onboarding — (M)

[ ] 10.5.1 Tutorial beyond tip string (move, drive, mission, wanted)
[ ] 10.5.2 Skippable + replayable from menu
[ ] 10.5.3 New player completes tutorial unaided (playtest)

10.6 Settings — (S)

[ ] 10.6.1 Audio buses (master/music/sfx/radio)
[ ] 10.6.2 Language selection
[ ] 10.6.3 Graphics preset (ties to quality tiers §12.1)
[ ] 10.6.4 All settings persist (§1.5)

10.7 PWA — (S)

[ ] 10.7.1 theme-color
[ ] 10.7.2 apple-touch-icon
[ ] 10.7.3 Install prompt + manifest
[ ] 10.7.4 Offline shell (core assets)
[ ] 10.7.5 Installable on iOS + Android; offline shell → menu (test)

10.8 Branding — (S)

- [~] Dual branding cleanup — finish
[ ] 10.8.1 Pick canonical name; replace stragglers in UI/meta/save keys
[ ] 10.8.2 Zero conflicting brand strings in shipped UI (test)

---

§11 Persistence / Continue (deepened)

11.1 Schema — (M)

- [~] Stats, economy, mission, pos, settings, scrimshaw, touch layout
[ ] 11.1.1 Single versioned save + migrations (§1.5)
[ ] 11.1.2 One schema covers all domains; migration tests pass (test)

11.2 Missing domains — (M)

[ ] 11.2.1 Boat state
[ ] 11.2.2 Race bests
[ ] 11.2.3 Radio station
[ ] 11.2.4 Weapon/melee/armed state
[ ] 11.2.5 Waypoint
[ ] 11.2.6 Car damage
[ ] 11.2.7 Each domain round-trips (test)

11.3 Continue correctness — (S)

- [~] Continue must not succeed with missing pos/mission keys
[ ] 11.3.1 Validate required keys before enabling Continue
[ ] 11.3.2 Fall back to New Game with clear message
[ ] 11.3.3 Delete pos/mission key → Continue disabled, no crash (test)

11.4 Recovery & slots — (M)

[ ] 11.4.1 Corrupt-save recovery UI (discard/export/retry)
[ ] 11.4.2 Multi-slot saves
[ ] 11.4.3 Cloud sync (TBD — document)
[ ] 11.4.4 Clear race best / settings policy on New Game
[ ] 11.4.5 Corrupt payload never bricks; multi-slot swaps cleanly (test)

---

§12 Performance / mobile (deepened)

12.1 Targets — (M)

- [~] Quality tiers (DPR + stream ring)
[x] NPC caps (pedCount/carCount)
[x] Shadow map size
[ ] 12.1.1 Named-device matrix committed:
  | Device | Tier | FPS p50 | FPS p1 | Mem |
  |--------|------|---------|--------|-----|
  | Device A (mid Android 2021) | mid | ≥ 50 | ≥ 30 | < 400MB |
  | Device B (iPhone 12) | high | ≥ 55 | ≥ 40 | < 500MB |
  | Device C (low Android 2019) | low | ≥ 30 | ≥ 20 | < 300MB |
[ ] 12.1.2 Thermal budget: sustained 20 min within 10% of p50
[ ] 12.1.3 Measured matrix committed to repo

12.2 Disposal — (M)

- [~] GPU geometry dispose on tile unmount — verify
[ ] 12.2.1 Verify JSON eviction → mesh GC on unmount
[ ] 12.2.2 Heap snapshot flat across 30-min drive; no orphan geometries (test)

12.3 GC hygiene — (M)

- [~] Boat.tsx, earth paths — finish
[ ] 12.3.1 Audit per-frame allocations in sim + render
[ ] 12.3.2 Reuse temp vectors/quats; no new in update loops
[ ] 12.3.3 Zero minor-GC spikes > 8ms during chase (test)

12.4 Loading — (M)

[ ] 12.4.1 Code-splitting by route/feature
[ ] 12.4.2 Rapier + slice load budget (first playable < N s on 4G)
[ ] 12.4.3 Deferred non-critical assets (audio, GLBs)
[ ] 12.4.4 First playable within budget on throttled network (test)

12.5 Idle — (S)

[ ] 12.5.1 Pause stylized Canvas when tab hidden
[ ] 12.5.2 Pause render loop on idle (§2.2)
[ ] 12.5.3 Hidden-tab CPU < 2% on Device A (test)

---

§13 Tech debt / fragility (deepened)

13.1 StreetLife — (M)

- [~] Dual graph paths; ad-hoc yield/lights — finish
[ ] 13.1.1 Single path source (RoadGraph + PedGraph)
[ ] 13.1.2 Signal FSM replaces ad-hoc yield/lights
[ ] 13.1.3 One source of truth for pathing; no duplicated constants (test)

13.2 Corpses — (S)

[ ] 13.2.1 Cop/traffic reaction to corpses
[ ] 13.2.2 Persistent bodies with TTL + cap
[ ] 13.2.3 Corpses age out at cap; cops react (test)

13.3 Police soft-fail — (S)

- [~] Police requires sim.graph or chase soft-fails
[ ] 13.3.1 Chase degrades gracefully without sim.graph
[ ] 13.3.2 Chase runs (reduced) with graph missing; no crash (test)

13.4 Earth stack — (M)

[ ] 13.4.1 Resolve parallel earth stack vs shared sim (§2.11)
[ ] 13.4.2 One sim boot path documented + used (test)

13.5 Legal — (S)

[ ] 13.5.1 Provenance notes (CesiumMan / voice / music)
[ ] 13.5.2 License files committed per asset
[ ] 13.5.3 Asset audit: 100% licensed (test, CI gate §0.5)

13.6 Integration — (L)

[ ] 13.6.1 Integration playtest suite (§15)
[ ] 13.6.2 CI gate on suite
[ ] 13.6.3 Runs on PR, blocks on regression (test)

13.7 Housekeeping — (S)

- [~] Coord helper duplication / package naming — finish
[ ] 13.7.1 Single coord helper module, re-exported
[ ] 13.7.2 Package naming pass (QUAHOG_Web / Mount Hope / THE NARROWS)
[ ] 13.7.3 No duplicated coord math; naming consistent (test)

---

§14 Content pipeline & authoring tools (new)

14.1 Graph tooling — (L)

[ ] 14.1.1 Road/PedGraph visualizer (import manifest → SVG/Canvas)
[ ] 14.1.2 Orphan/connectivity report view
[ ] 14.1.3 Editing round-trip: visualize → tweak JSON → re-import
[ ] 14.1.4 Signal phase editor with preview

14.2 Mission tooling — (XL)

[ ] 14.2.1 Mission editor: objectives, triggers, spawns, markers
[ ] 14.2.2 Live preview: boot into mission at step N
[ ] 14.2.3 Validation: unreachable objective, missing actor, dangling marker
[ ] 14.2.4 Export to MissionDef with stable ids

14.3 Dialogue tooling — (M)

[ ] 14.3.1 Line editor with speaker/portrait/timing
[ ] 14.3.2 Subtitle timing preview
[ ] 14.3.3 Export/import for VO pipeline (§16)

14.4 Race & traffic tuning — (M)

[ ] 14.4.1 Race editor (checkpoints, class, laps)
[ ] 14.4.2 AI rubber-band tuning curves with live preview
[ ] 14.4.3 Traffic density/lighting timeline editor

14.5 Weather & time-of-day timeline — (M)

[ ] 14.5.1 Visual timeline for clock/weather keyframes
[ ] 14.5.2 Preview scrub with friction/wetness readout
[ ] 14.5.3 Export to ClockWeather schedule

14.6 Camera path editor — (M)

[ ] 14.6.1 Cutscene camera spline editor
[ ] 14.6.2 Playback preview in-engine
[ ] 14.6.3 Export to mission cutscene cues

14.7 Asset import — (M)

[ ] 14.7.1 GLB import with LOD generation
[ ] 14.7.2 Texture atlas builder + compression
[ ] 14.7.3 Audio loudness normalization
[ ] 14.7.4 Tile import from JSON → streamer-ready

14.8 Test content — (S)

[ ] 14.8.1 Sandbox map with all features
[ ] 14.8.2 Dummy missions for each objective type
[ ] 14.8.3 Perf stress scene (max entities)

---

§15 QA & test matrix (new)

15.1 Test tiers

[ ] 15.1.1 Unit: pure functions, graph math, conditions, save validators
[ ] 15.1.2 Integration: subsystem pairs (streamer↔buildings, police↔graph)
[ ] 15.1.3 Soak: 30-min drives, 50-cycle mission fuzz, memory plateau
[ ] 15.1.4 Determinism: replay hash equality across refresh rates
[ ] 15.1.5 Perf: per-stage budgets on Device A/B/C
[ ] 15.1.6 Device: real-device smoke per release
[ ] 15.1.7 A11y: automated label/lint + manual screen-reader pass
[ ] 15.1.8 Localization: pseudo-locale + RTL smoke
[ ] 15.1.9 Save: fuzz round-trip + corrupt payloads + migrations
[ ] 15.1.10 Fuzz: mission defs, manifests, network failures

15.2 Fixtures

[ ] 15.2.1 Legacy saves v1 (≥ 5 real)
[ ] 15.2.2 Bad manifests (one per lint rule)
[ ] 15.2.3 Bad mission defs (one per validation rule)
[ ] 15.2.4 Scripted input traces (boot, drive, chase, mission, boat)
[ ] 15.2.5 Golden screenshots per stage

15.3 CI stages

[ ] 15.3.1 typecheck → lint → unit on every push
[ ] 15.3.2 integration → perf-smoke on PR
[ ] 15.3.3 soak → device nightly
[ ] 15.3.4 Artifacts: reports, traces, screenshots, heap snapshots
[ ] 15.3.5 Flake policy: quarantine + fix within 2 days

---

§16 Localization & text (new)

[ ] 16.1 Externalize all player-facing strings to keys
[ ] 16.2 Key naming convention + lint for missing/unused keys
[ ] 16.3 Pluralization + gender + number formatting
[ ] 16.4 Font fallback for CJK/Cyrillic/Arabic
[ ] 16.5 RTL layout support (mirror where appropriate)
[ ] 16.6 Subtitle timing externalized with dialogue lines
[ ] 16.7 VO recording pipeline doc (script → record → import)
[ ] 16.8 Pseudo-locale build for expansion testing
[ ] 16.9 Screenshot diff per locale for overflow
[ ] 16.10 CI gate: no hardcoded UI strings

---

§17 Build / release / ops (new)

[ ] 17.1 Build targets: stylized, earth, diagnostic (flag-scoped)
[ ] 17.2 Environments: dev, staging, prod (config split)
[ ] 17.3 Semantic versioning + changelog generation
[ ] 17.4 Error reporting hook (Sentry or equivalent) with PII scrubbing
[ ] 17.5 Analytics opt-in + docs
[ ] 17.6 Feature-flag rollout plan (canary → full)
[ ] 17.7 Rollback procedure documented + tested
[ ] 17.8 PWA packaging (§10.7) + store listing (if any)
[ ] 17.9 Release checklist (save-migration dry-run, perf gate, a11y gate)
[ ] 17.10 Post-release hotfix path

---

§18 Risk register (new)

# Risk L I Mitigation Trigger to act
R1 Earth stack diverges permanently H H Decision record §2.11 by milestone M4 No shared SimBootstrap by M4
R2 Mobile thermal throttling breaks 30fps M H Tiered quality + thermal budget §12.1 Device A p1 < 20 for 5 min
R3 Google tile quota (429) blocks play M H Fallback ground §2.10 + backoff §2.3 429 rate > 1% sessions
R4 Content scope (Cape/FR) slips H H Stage authored content behind flags; ship NB+FR first M5 content < 70%
R5 Save corruption loses player progress L H Atomic writes + recovery UI §11.4 Any corruption report
R6 Legal provenance gap on an asset L H CI license audit §0.5 Audit miss
R7 Mission entity leaks M M Scope teardown + leak assert §1.3.10 Leak detector fires
R8 Determinism drift breaks replay/tests M M No Math.random lint + hash tests §0.3 Hash mismatch in CI
R9 PedGraph build perf on large maps M M Incremental build + budget §1.2 Build > 200ms
R10 Auth flow dead-ends on iPhone Safari M M Real-device pass §2.11 Any blocked session

---

§19 Milestones & critical path (new)

M0 — Foundations (1–2 weeks)

Exit: §0 complete; CI green; determinism + flags + telemetry schema live.

· Blocks: everything.

M1 — Fixed-step core (2–3 weeks)

Exit: §1.1 migrated; all systems on fixed step; replay hash stable.

· Blocks: §1.2, §1.3, §5.x, §8.x.

M2 — Peds + Missions (3–4 weeks)

Exit: §1.2 + §1.3 complete; 11-mission chain runs start-to-finish on NB.

· Blocks: §3.5, §4.3, §8.5.

M3 — Save + Continue (2 weeks)

Exit: §1.5 + §11 complete; fuzz + migration green.

· Blocks: release candidate gating.

M4 — Earth decision (1 week)

Exit: §2.11 decision recorded; if keep, §2.1 + §2.9 started.

· Gate: R1 mitigation.

M5 — Content: Cape/FR (4–6 weeks)

Exit: §1.6 + §7.2 + §7.3; no void from start map.

· Blocks: mid/late campaign (§8.6.4).

M6 — Combat + Wanted polish (3 weeks)

Exit: §3.2–§3.4 + §5.1–§5.2 complete; tiers + ammo persist.

· Blocks: late-campaign mission beats.

M7 — Audio + UI polish (3 weeks)

Exit: §9.2–§9.4 + §10.1–§10.5 complete; a11y pass.

· Blocks: release candidate.

M8 — Release candidate (2 weeks)

Exit: §12 targets met on Device A/B/C; §15 matrix green; §17 release checklist.

Critical path: §0 → §1.1 → §1.3 → §1.2 → §8.1 → §1.5 → §7.3 → §8.6 → §15 → M8.
Parallelizable off critical path: §3, §4, §5, §9, §10, §14.

---

§20 Cross-cutting gates (expanded)

Applies to every task above. A task is not done unless:

[ ] Header comment names fixed-step vs render-rate contract (§1.1.23)
[ ] New persisted field has a migration entry (§1.5.5)
[ ] New manifest field has validator + lint rule (§1.6.1–1.6.3)
[ ] New feature has one automated test in §15 suite
[ ] New per-frame system reports into §1.11 telemetry
[ ] New asset has a license entry (§13.5, §0.5)
[ ] New UI surface has an a11y label (§10.4.1)
[ ] New mission uses MissionRuntime ownership (§1.3.6)
[ ] New string is externalized (§16.1)
[ ] No Math.random in src/sim (§0.3)
[ ] No per-frame allocation in hot paths (Perf-safe)
[ ] No any in src/sim (lint)
[ ] Deterministic under replay (§0.3)
[ ] Covered by a feature flag if risky (§0.2)
[ ] Commit message references the task ID (feat(§1.1.7): ...)

---

Master dependency DAG (condensed)

```
§0 ──▶ §1.1 ──▶ §1.2 ──▶ §1.3 ──▶ §8.1 ──▶ §8.5
 │        │        │        │
 │        │        │        ├──▶ §3.5   (wanted UX needs runtime)
 │        │        │        ├──▶ §4.3   (ownership missions)
 │        │        │        └──▶ §8.2   (cutscenes)
 │        │        └──▶ §13.1 (signals) ──▶ §7.6 (night)
 │        └──▶ §1.9 ──▶ §5.3 ──▶ §7.4 (swim)
 ├──▶ §1.5 ──▶ §11.*
 ├──▶ §1.6 ──▶ §7.2 ──▶ §7.3 ──▶ §8.6.4
 ├──▶ §1.8 ──▶ §3.1 (witness LOS)
 └──▶ §1.11 ──▶ §12.*
§2.11 ──▶ §13.4
§15 ──▶ M8
```

---

Priority implementation order (updated)

1. [x] Close streamer evict/dispose + quality NPC/shadow caps
2. [~] §0 Foundations — flags, Rng, telemetry schema, registries shipped; tooling/assets TBD
3. [~] §1.1 GameLoop — core loop + pause/scale shipped; migrate systems next ← current
4. [~] §1.2 PedGraph — baseline sidewalk graph + PedestrianAI bind shipped; deepen per task tree
5. [~] §1.3 MissionRuntime — baseline event bus / ownership / fail-retry-abandon shipped; deepen per task tree
6. [ ] §1.6 WorldManifest + §7.3 Cape/FR — unblocks mid/late campaign
7. [ ] §1.5 SaveGame + §11 — unified save, migrations, recovery
8. [ ] §3.2–§3.4 heat escalation + §5.2 ammo/inventory
9. [ ] §2.11 earth decision — keep or demote (gate R1)
10. [ ] §9.2 spatial audio + §9.3 radio content
11. [ ] §10 HUD/a11y/tutorial + §6.2 interiors + §2.6/§2.7 GLB actors
12. [ ] §15 matrix green + §17 release checklist → M8

---

Changelog

· v3 — Deep expansion: §0 Foundations, §14–§19 new (pipeline, QA, l10n,
  release, risk, milestones), every epic now has Contract / Task tree / Test
  matrix / Perf budget / Edge cases / Accept, stable IDs, dependency DAG,
  effort tags, updated priority order.
· v2 — Decomposed parents into implementable units with file paths and
  acceptance criteria.
· v1 — Original tracked backlog.