Mount Hope — Implementation Checklist (Expanded)

Tracked backlog for making QUAHOG_Web / Mount Hope a substantially complete
open-world browser game. Status tags:

· [ ] not started
· [~] partial / needs finish
· [x] done

Update this file when a checkbox lands. Highest-leverage order is at the bottom.

Notes on this revision

· Every prior item has been decomposed into implementable units with file paths,
  acceptance criteria, and dependencies where they matter.
· Parent items retain the original status; sub-items are the real work.
· Accept: lines are the definition of done for the sub-tree above them.
· Dep: lines call out cross-section blockers.

---

Legend / conventions

· Accept: = testable completion criterion.
· Dep: = hard dependency on another checkbox (referenced by section + slug).
· Perf: = must be measured, not assumed (device/browser named in §12).
· Perf-safe: = no per-frame allocation, no Array.prototype hot loops.

---

Done baseline (sim layer) — kept for history

[x] RoadGraph + Dijkstra + ObjectiveNav (route, wrong-way, minimap polyline)
[x] CameraRig + occlusion pull-in (FollowCamera)
[x] WorldStreamer module (request / queue / load / LRU API)
[x] VehicleDynamics + VehicleState (enter / exit / carjack)
[x] TrafficDirector wired into StreetLife
[x] ChaseController wired into Police
[x] PedestrianAI + SpatialIndex (ped LOD)
[x] FrameBudget + SimBootstrap
[x] Mission step persistence (mounthope.mission.v1)

Baseline follow-ups (regressions to watch)

[ ] Regression test: RoadGraph Dijkstra correctness on a 500-node fixture
[ ] Regression test: ObjectiveNav wrong-way detection flips at 180° only
[ ] Regression test: FollowCamera occlusion does not clip through thin walls
[ ] Regression test: WorldStreamer LRU evicts exactly capacity items
[ ] Regression test: carjack state transitions (enter → driving → exit → parked)
[ ] Regression test: FrameBudget yields without dropping a sim tick
[ ] Regression test: mission step reload mid-step resumes correctly
[ ] Add these to §13 integration playtest suite

---

1. Core simulation architecture

1.1 Fixed-step GameLoop — src/sim/GameLoop.ts

[ ] Create GameLoop.ts with FIXED_DT = 1/60 constant (configurable)
[ ] Accumulator loop: acc += clamp(rawDt); while (acc >= FIXED_DT) step(); acc -= FIXED_DT
[ ] Clamp rawDt to MAX_FRAME_DT (e.g. 0.25s) to prevent spiral-of-death
[ ] Cap stepsPerFrame (e.g. 5) and emit FrameBudget warning on overflow
[ ] Expose interpolation alpha = acc / FIXED_DT to render callbacks
[ ] pause() / resume() / setTimeScale(x) hooks (used by menus, cutscenes)
[ ] Order phases: input → sim step(s) → post-sim → render(alpha)
[ ] onStep / onRender subscriber lists (no per-frame alloc; reused arrays)
[ ] Determinism harness: seed RNG per step, replay N steps, assert state hash
[ ] Telemetry: stepMs, stepsPerFrame percentile, acc high-water mark
[ ] Tab-hidden behavior: auto-pause, single catch-up step on visible
[ ] Migrate TrafficDirector.update to fixed step (Dep: §1.1 loop)
[ ] Migrate ChaseController.update to fixed step
[ ] Migrate PedestrianAI.update to fixed step
[ ] Migrate VehicleDynamics.update to fixed step
[ ] Migrate boat physics (Boat.tsx) to fixed step
[ ] Migrate Police heat decay tick to fixed step
[ ] Migrate mission timer ticks to fixed step
[ ] Migrate economy passive-income tick to fixed step
[ ] Document which systems are render-rate vs sim-rate in a header comment
[ ] Accept: stepping a 60s session at 144Hz and 30Hz yields identical
  deterministic replay hash; no per-step allocation growth in heap snapshot.
[ ] Perf: stepMs p95 < 4ms on named mid-tier device (§12.1)

1.2 PedGraph — src/sim/PedGraph.ts

[ ] Define node type: { id, x, z, y?, kind: 'sidewalk'|'crosswalk'|'door'|'spawn' }
[ ] Define edge type: { a, b, width, cost, kind }
[ ] Derive sidewalk polylines from RoadGraph edges (offset both sides)
[ ] Generate crosswalk nodes at intersections with signal timing metadata
[ ] Generate door nodes from building footprints (WorldManifest §1.6)
[ ] Spawn-point nodes at block corners and transit stops
[ ] Connected-component check on build; log orphans; auto-prune
[ ] Nearest-node query via SpatialIndex (grid cell → node ids)
[ ] Path query: A* over PedGraph with cost = length * lanePenalty
[ ] Crowd occupancy map (cell → count) with decay
[ ] Local avoidance: neighbor sample within radius, steer away (Perf-safe)
[ ] Right-hand walk bias by edge direction (lane feel)
[ ] Crosswalk state machine: wait → cross → clear, driven by ClockWeather/signals
[ ] Pedestrian spawn/despawn tied to WorldStreamer tile residency
[ ] LOD: full path follow (near), anchor-to-node lerp (mid), freeze (far)
[ ] Bind to PedestrianAI (replace ad-hoc wander) — [~]
[ ] Debug overlay: draw PedGraph nodes/edges, occupancy heat
[ ] Unit test: 200-agent crowd on a 3×3 block grid never overlaps < 0.35m
[ ] Accept: peds stay on sidewalks in 10-minute soak; zero road clips
  outside crosswalks; A* p95 < 0.5ms for 100 concurrent queries.

1.3 MissionRuntime — src/sim/MissionRuntime.ts

[ ] Event bus: emit(name, payload), on(name, fn), off, typed names
[ ] Event names registry (single source of truth; imported everywhere)
[ ] Entity ownership: spawn(kind, def) → handle; handle.destroy() idempotent
[ ] Ownership scoping: runtime.scope('mission:11') auto-destroys children on end
[ ] Track owned entities for cleanup on: mission end, fail, retry, abandon, reload
[ ] Trigger system: volume (AABB/sphere), distance, flag, damage, inventory, timer
[ ] Condition DSL: all/any/not, leaf predicates with stable ids
[ ] Objectives: ordered/parallel steps, optional steps, hidden steps
[ ] Fail conditions: timeout, actor death, vehicle wreck, out-of-bounds, wanted
[ ] Retry: reset world to checkpoint, respawn owned entities, restore inventory
[ ] Checkpoint save hook (writes through SaveGame §1.5)
[ ] Cutscene/dialogue hand-off stub (Dep: §8.2)
[ ] Marker/arrow updates via runtime → HUD (Dep: §10.1, §8.6)
[ ] Mission-owned audio ducking hook (Dep: §9.4)
[ ] Persistence: serialize active mission id + step index + owned entity seeds
[ ] Migration from mounthope.mission.v1 → runtime-owned schema
[ ] Debug panel: list active missions, owned entity counts, trigger states
[ ] Soak test: 50 random fail/retry/abandon cycles leak zero entities
[ ] Accept: no mission can end with live owned entities; retry restores an
  identical world hash to the pre-fail checkpoint (modulo RNG seed).

1.4 ClockWeather — src/sim/ClockWeather.ts

[ ] Clock: dayIndex, timeOfDay (0..1), timeScale, pause on menu
[ ] Day length config; sunrise/sunset tables per season
[ ] Night/day blend factor consumed by lighting + shader uniforms
[ ] Weather state machine: clear → cloudy → rain → storm → fog → clear
[ ] Transition durations and cross-fade weights per weather
[ ] Wetness accumulator: rises in rain, decays after; drives tire friction
[ ] friction() API: { road, offroad, boat } multipliers — consumers listed
[ ] Wind vector (for rain slant, tree sway, boat drift)
[ ] Lightning flash event (visual + thunder audio hook)
[ ] Snow: visual only until road friction defined (explicit TBD note)
[ ] Fog density curve; wire toggles to full fog type (Dep: §7.5)
[ ] Weather → WorldStreamer hint (e.g. skip far LOD in fog)
[ ] Save/restore clock + weather + transition progress
[ ] Deterministic weather from seed for replay/regression tests
[ ] Telemetry: current weather, wetness, friction sampled to overlay
[ ] Accept: driving on wet road increases braking distance ≥ 20%; weather
  round-trips through save; no popping when toggling clear↔rain in < 1s.

1.5 SaveGame — src/sim/SaveGame.ts

[ ] Define versioned blob schema mounthope.save.v2 with schemaVersion
[ ] Enumerate all persisted domains (list explicitly in code comment):
  stats, economy, mission, position, settings, scrimshaw, touch layout,
  boat, race best, radio, weapons, waypoint, car damage, clock/weather
[ ] Migration runner: v1 → v2 functions, chained, idempotent
[ ] Migrate existing mounthope.mission.v1 and settings keys
[ ] Single-slot save first; multi-slot behind feature flag
[ ] Compression (LZ-string or structured clone) + size budget assert (< 256KB)
[ ] Atomic write (write temp key, then swap) to avoid torn saves
[ ] Corrupt-save detection (parse fail, schema fail, checksum fail)
[ ] Corrupt recovery UI hook (Dep: §11.4)
[ ] Export/import JSON for debugging
[ ] Quicksave/autosave throttling (no autosave during cutscene/chase spike)
[ ] Accept: round-trip fuzz (random valid state → save → load → deep-equal)
  1000 times; corrupt payloads never throw, always surface a recovery path.

1.6 WorldManifest — src/sim/WorldManifest.ts

[ ] Schema: zones, tiles, roads, buildings, props, markers, spawn points, doors
[ ] JSON schema file + runtime validator with actionable error paths
[ ] Version field + migration for authored-data changes
[ ] Authoring lint: dangling door→PedGraph node, missing tile, duplicate ids
[ ] Build step: manifest → RoadGraph + PedGraph + SpatialIndex seed
[ ] Manifest-driven WorldStreamer tile list (replace hardcoded rings)
[ ] Hot-reload in dev (watch JSON, rebuild graph, keep player position)
[ ] Accept: a malformed manifest fails fast with file+line; a valid manifest
  boots the sim with zero console errors.

1.7 WorldStreamer — done; follow-ups

[x] Real load/evict loop (tile cache eviction + evictUnwanted grace)
[x] Predictive focus in StreamingBuildings
[ ] Metrics surface: resident count, queue depth, evict count, load ms p50/p95
[ ] Prefetch on heading/velocity (not just position) for high-speed vehicles
[ ] Priority: player tile > camera frustum > predicted > ring
[ ] Cancellation: in-flight loads for evicted tiles are dropped on arrival
[ ] Error retry with backoff; surface persistent failures to HUD
[ ] Eviction hysteresis tuned so orbiting the player doesn't thrash
[ ] tileImpostor() wired into active streaming set (Dep: §7.12)
[ ] Soak: 30-minute drive, resident count plateaus, memory flat (Perf: §12.1)
[ ] Accept: no tile pop-in > 1 frame at 60 km/h on target device.

1.8 SpatialIndex — buildings / vehicles / LOS

· [~] Ped-only today — extend to all dynamic and static classes
[ ] Unified index keyed by (class, cellX, cellZ) with per-class cell size
[ ] Static class: buildings (large cells), props, markers
[ ] Dynamic class: vehicles, peds, boats, mission entities
[ ] Insert/remove O(1) amortized; no full rebuild per frame
[ ] Query API: radius(pos, r, mask), segment(a, b, mask) (LOS)
[ ] LOS raycast: segment walk with per-cell early-out, maxDepth guard
[ ] Broadphase integration with Rapier where physics exists
[ ] Debug overlay: draw cell occupancy + last query
[ ] Accept: 2000 entities, 500 queries/frame on target device < 1ms total.

1.9 Deeper vehicle model

· [~] Suspension, surfaces, impact damage — finish
[ ] Suspension: per-wheel spring/damper, ride height, body roll/pitch coupling
[ ] Tire model: slip ratio/angle, longitudinal vs lateral grip split
[ ] Surface friction table: asphalt, wet asphalt, dirt, grass, sand, pier planks
[ ] Surface queries from WorldManifest polygons → per-wheel sample
[ ] Weight transfer under accel/brake/corner (visual + handling)
[ ] Damage: panel HP, engine HP, wheel HP, steering pull, smoke/fire stages
[ ] Impact detection via Rapier contact events; threshold curve by relative speed
[ ] Vehicle deformation (visual) capped per quality tier
[ ] Engine/transmission: gear ratios, torque curve, reverse, handbrake
[ ] Brake/ABS tuning; handbrake drift model
[ ] Bike/motorcycle variant (if content exists; else TBD)
[ ] Boat integration: buoyancy/wave coupling (Dep: §5.3)
[ ] AI drivers use same model via TrafficDirector (shared controller)
[ ] Accept: lap time delta wet vs dry ≥ 8%; damage state persists to save.

1.10 Mobile controls — TouchControls.tsx

· [~] Mode-aware foot / car / boat — finish
[ ] Input mode state machine: foot | car | boat | swim | menu | cutscene
[ ] Auto-switch on enter/exit vehicle; manual override toggle
[ ] Foot set: move stick, look drag, sprint, interact, jump (if exists)
[ ] Car set: throttle/brake, steer (tilt/thumb toggle), handbrake, horn, camera
[ ] Boat set: throttle, rudder, camera, anchor
[ ] Context-sensitive action button (enter/exit/interact/pickup)
[ ] Layout editor: drag/resize, save to settings, reset to default
[ ] Safe-area insets (notch) + landscape/portrait handling
[ ] Haptics hooks (if supported; no-op otherwise)
[ ] Desktop parity map documented per mode (Dep: §10.4)
[ ] Accept: every sim action reachable on touch in each mode; no dead zones.

1.11 Telemetry

· [~] Budget warnings, counts, streamer stats, percentiles — finish
[ ] Percentile ring buffers (p50/p95/p99) for frame, sim, render, streamer
[ ] Entity counts: peds, vehicles, boats, mission entities, streamer resident
[ ] Streamer: queue depth, resident, evict, load ms, failures
[ ] FrameBudget: overrun events with system attribution
[ ] Memory: performance.memory where available; heap snapshots in dev
[ ] Toggleable overlay + JSON dump (dev-only key combo)
[ ] Threshold alarms (p95 frame > X for Ys) → console warn + overlay badge
[ ] Export last 60s to clipboard for bug reports
[ ] Accept: overlay costs < 0.3ms/frame when visible, 0 when hidden.

1.12 Stage 0–7 acceptance harness

[ ] Define stages 0–7 (boot, walk, drive, mission, chase, boat, economy, save)
[ ] Each stage: scripted input, assertions, screenshot hook
[ ] Device FPS gate per stage on named mid-tier + low-tier hardware
[ ] Stream memory plateau check (30 min, ±5% resident)
[ ] Mission fail/retry gate (deterministic seed)
[ ] CI: headless run of all stages, artifact bundle on failure
[ ] Accept: all stages green on both target devices; artifact uploads.

---

2. Photoreal build (earth.html)

2.1 Stability

· [~] Stability pass — finish
[ ] Raycast throttle: max N raycasts/frame, priority queue by importance
[ ] Alloc-free hot paths: preallocated vectors, no closures in update loops
[ ] maxDepth enforced on all recursive/iterative scene traversals
[ ] Guard NaN in transforms (assert + recover + telemetry)
[ ] Bounded retry for tile/asset fetch with backoff and circuit breaker
[ ] WebGL context-loss handler: pause, attempt restore, HUD notice
[ ] Frame-time watchdog: drop quality tier on sustained overrun
[ ] Accept: 20-minute soak with zero context-loss crashes on target device.

2.2 Idle / pause

[ ] Pause render on tab hidden (visibilitychange)
[ ] Idle detection (no input N seconds + no motion) → throttle to 15fps or pause
[ ] Resume fast-path: no catch-up sim on return (single step)
[ ] Accept: hidden-tab CPU < 2% on target device.

2.3 Auth overlays

· [~] Distinct Google 401 vs 429 overlays — finish
[ ] 401 copy: "sign-in required" + retry sign-in action
[ ] 429 copy: "quota exceeded" + backoff ETA + retry
[ ] Other codes (5xx, network) mapped to generic retry overlay
[ ] Never leave a blank/black canvas on auth failure; always fallback (§2.11)
[ ] Accept: each failure code renders correct copy; retry recovers without reload.

2.4 Locomotion animation

[ ] Idle pose + breathing loop
[ ] Walk cycle (blended by speed)
[ ] Run cycle + sprint
[ ] Foot IK to ground height (tile/mesh)
[ ] Jump/fall/land states
[ ] Blend tree: idle↔walk↔run by planar speed; no popping
[ ] Turn-in-place for sharp heading changes
[ ] Accept: no skating at walk/run speeds; no T-pose on any transition.

2.5 Earth HUD parity

[ ] Minimap + big map parity with stylized HUD
[ ] Compass parity
[ ] Health/damage parity
[ ] Wanted stars parity
[ ] Interact prompts parity
[ ] Mission markers parity
[ ] Shared HUD component layer between builds (Dep: §13.4)
[ ] Accept: every stylized HUD element has an earth equivalent or documented
  omission.

2.6 Vehicles

[ ] Source CC0 GLB car set (license file committed)
[ ] Import pipeline + LODs + material remap
[ ] Night headlights: emissive + spotlight, budgeted per quality tier
[ ] Shared with stylized build where feasible
[ ] Accept: headlights visible at night, cost < 1ms on target device.

2.7 Pedestrians

[ ] Distinct pedestrian models (≥ 3 variants)
[ ] Palette variation
[ ] Bound to PedGraph pathfollowing
[ ] Accept: 50 peds visible with no two identical adjacent models.

2.8 Earth gameplay loop

[ ] Wire missions into earth play loop (Dep: §1.3)
[ ] Wire wanted/heat into earth loop (Dep: §3)
[ ] Wire economy into earth loop (Dep: §4)
[ ] Persistence parity with stylized (Dep: §1.5)
[ ] Accept: a full mission completable start-to-finish in earth build.

2.9 Earth environment

[ ] Day/night ↔ weather coupling (Dep: §1.4)
[ ] Water rendering + reflections budgeted
[ ] SFX parity hooks
[ ] Save/load parity
[ ] Accept: weather change reflected in lighting + water within 1 frame of
  transition.

2.10 Fallbacks

[ ] Fallback ground plane when tiles fail (never void)
[ ] Fallback sky gradient when env fails
[ ] Fallback vehicle model when GLB fails
[ ] Accept: forced tile 500 → user can still walk/drive on fallback.

2.11 Documentation & measurement

[ ] Characters & Missions bible (ROADMAP deliverable) (Dep: §8)
[ ] Real iPhone measurement pass (named device, FPS/mem/thermal) (Perf:)
[ ] Decide: share SimBootstrap with earth or demote earth to
  diagnostic-only — write the decision down with rationale
[ ] Accept: decision recorded; if shared, both builds boot from same sim.

---

3. Wanted / heat / police

3.1 Heat model

· [~] Dual-axis heat + basic road chase (≥3★) — finish
[ ] Dual axes: suspicion (unseen) vs wanted (seen); decay curves per axis
[ ] Witness system: ped LOS → suspicion gain; cop LOS → wanted gain
[ ] Crime table: crime type → heat delta (assault, shots, hit-run, kill)
[ ] Line-of-sight gating via SpatialIndex.segment (Dep: §1.8)
[ ] Cooldown per crime type to prevent spam-farming heat
[ ] Heat decay when unseen and outside lose-heat zone
[ ] Accept: shooting a witness raises wanted; hiding lowers it predictably.

3.2 Star tiers

[ ] Tier table 1–5 with: spawn rate, units, roadblocks, helicopter, PIT
[ ] Tier 1: one cruiser, no roadblocks
[ ] Tier 2: two cruisers, light roadblocks
[ ] Tier 3: three + helicopter scout
[ ] Tier 4: roadblocks + helicopter spotlight + PIT enabled
[ ] Tier 5: full response + APB + no natural decay
[ ] Escalation triggers (witness count, officer down, repeated crimes)
[ ] De-escalation: bribe / lose-heat zone / safehouse / time (Dep: §6.1)
[ ] Accept: each tier produces the documented response within 10s of entry.

3.3 Police units

[ ] Foot cops: patrol PedGraph, chase on foot, tackle/arrest
[ ] Road cops: existing ChaseController polished
[ ] Roadblocks: spawn ahead of player on RoadGraph, static + manned
[ ] Helicopter: orbit + spotlight + report (LOS to player)
[ ] PIT maneuver: bounded impulse, damage, cooldown
[ ] Rapier collision between cop and player vehicles (Dep: §1.9)
[ ] Officer down / corpse persistence (Dep: §13.1)
[ ] Accept: helicopter maintains LOS 80% of a 60s chase on open road.

3.4 Faction heat

[ ] Territory polygons in WorldManifest
[ ] Faction aggro on entry while hostile
[ ] NPC response (drive-bys, foot squads) per faction
[ ] Faction heat decays outside territory
[ ] Accept: entering hostile territory escalates within one block.

3.5 Wanted UX

[ ] Wanted radar (nearby units blips)
[ ] Backup call event (audio + HUD)
[ ] Lose-heat zones (marked on map, decay inside)
[ ] Full-screen tier transition flash
[ ] Accept: player can always tell current tier + whether decaying.

---

4. Economy / properties / shops

4.1 Fronts

· [~] Buy fronts + passive income + boom/leak events — finish
[ ] Front definitions in WorldManifest (cost, income, risk, boom/leak)
[ ] Purchase flow: prompt → confirm → ownership persisted
[ ] Passive income tick (fixed step; Dep: §1.1)
[ ] Boom/leak random events with HUD notifications
[ ] Ownership reflected in world (signage, doors unlocked)
[ ] Accept: buy → income accrues → persists across save/load.

4.2 Upgrades / employees / sell

[ ] Upgrade tiers per front (income multiplier, risk)
[ ] Employee hiring (cost, effect, upkeep)
[ ] Sell / foreclose flow with penalty
[ ] UI panel for ownership management
[ ] Accept: upgrade changes income within one tick; sell refunds correctly.

4.3 Ownership-tied missions

[ ] Mission unlocks gated by owning specific front
[ ] Ownership changes trigger mission availability refresh
[ ] Accept: selling a front disables its tied mission cleanly.

4.4 Shops

[ ] Ammo shop
[ ] Weapons shop (gated by wanted/mission progress)
[ ] Clothes shop (appearance swap)
[ ] Garage storage (beyond respray)
[ ] Shop interiors or counter interaction (interim: counter prompt)
[ ] Accept: each shop purchase reflected in inventory/appearance immediately.

4.5 Payout / balance

[ ] Day-based payout summary UI (income, costs, net)
[ ] Balance pass: time-to-first-upgrade, time-to-wealth targets
[ ] Distant business markers need supporting world content (Dep: §7.2)
[ ] Accept: a fresh save reaches first upgrade in ≤ 20 min of play.

---

5. Combat / weapons / boats / races / traffic AI

5.1 Melee & guns

· [~] Fists / bat / pistol / shotgun — finish
[ ] Melee: swing arcs, hitboxes, stagger, finisher
[ ] Pistol: hitscan, spread, falloff, tracer
[ ] Shotgun: pellet spread, per-pellet damage, reload cycle
[ ] Weapon switching animation/state
[ ] Accept: each weapon has distinct TTK on a standard target dummy.

5.2 Inventory & ammo

[ ] Ammo counts per weapon; reserve vs magazine
[ ] Reload action with cancel + interrupt
[ ] Inventory model + persistence (Dep: §1.5)
[ ] Pickups: world ammo/weapon pickups, respawn rules
[ ] Recoil/accuracy: bloom, recovery, ADS (if exists)
[ ] Weapon wheel / quick-swap (Dep: §10.1)
[ ] Cover system (attach, peek, blind-fire) — scope gate
[ ] Better reticle (spread-aware, hit feedback)
[ ] Accept: firing empties magazine, reload refills, pickups update counts,
  all persist through save.

5.3 Boats

· [~] One marina boat — finish
[ ] Buoyancy model: sample wave height, spring to surface
[ ] Wave system (deterministic, tied to ClockWeather wind)
[ ] Boat damage + sinking state
[ ] Multiple boats (≥ 3) with distinct handling
[ ] Boat included in Continue save (Dep: §11.2)
[ ] Swim mode (Dep: §7.7)
[ ] Accept: boat floats, bobs, takes damage, sinks, persists.

5.4 Races

· [~] One race loop — finish
[ ] Multi-track race definitions in WorldManifest
[ ] AI opponents on RoadGraph with rubber-band tuning
[ ] Fail timer + DNF handling
[ ] Persisted best times per track + class
[ ] Class locks (vehicle type restrictions)
[ ] Race HUD (position, lap, splits)
[ ] Accept: 3 tracks × 3 opponents finish deterministically; best times save.

5.5 Traffic AI

[ ] Collision avoidance (car-following, lane change)
[ ] Parking AI (drive to slot, park, despawn)
[ ] Door/sidewalk coupling (parked drivers become peds)
[ ] Yield/lights (Dep: §13.1 street-light cleanup)
[ ] Accept: 5-minute soak, zero intersection deadlocks, ≤ 1% stuck cars.

---

6. Safehouse / hospital / collectibles

6.1 Safehouse

· [~] Heat clear + sleep; visual hospital; wasted/busted flow — finish
[ ] Safehouse entry → heat clear + save prompt
[ ] Sleep → advance clock (Dep: §1.4)
[ ] Multiple unlockable safehouses (with interiors) — Dep: §6.2
[ ] Wardrobe at safehouse (ties to clothes shop §4.4)
[ ] Accept: sleep advances to next morning; heat clears on entry.

6.2 Interiors

[ ] Interior scene loading (additive room volumes)
[ ] At least one detailed safehouse interior
[ ] Hospital interior (visual + respawn point)
[ ] Police station interior (busted flow)
[ ] Accept: interiors enter/exit without streaming errors.

6.3 Wasted / busted

· [~] Flow exists — finish
[ ] Wasted: fade, hospital respawn, fee, weapon loss rule
[ ] Busted: fade, station respawn, fee, inventory confiscation rule
[ ] Narrative flavor lines per cause
[ ] Accept: each cause produces correct respawn/fee/inventory outcome.

6.4 Collectibles

· [~] 8 downtown scrimshaw — finish
[ ] Citywide collectible sets (e.g. 30) with progress tracking
[ ] Map progress view + per-set rewards
[ ] Unique rewards (vehicles, weapons, cosmetics)
[ ] FR / Cape collectibles when content lands (Dep: §7.3)
[ ] Accept: collecting all of a set grants its reward exactly once, saves.

---

7. World content & streaming

7.1 Streaming

· [~] NB tile stream + some FR heroes — finish
[x] Real JSON tile cache eviction + unwanted grace
[ ] GPU mesh dispose on tile unmount verified (Dep: §12.4)
[ ] tileImpostor() in active streaming set (Dep: §1.7)
[ ] Accept: resident plateau + no GPU leak over 30 min.

7.2 Districts

[ ] Lived-in Fall River district (props, peds, businesses)
[ ] NB polish pass (props, signage, lighting)
[ ] Accept: each authored district passes a walk-through checklist.

7.3 Cape / Hyannis / Brockton (Act II/III)

[ ] Cape road graph + tiles
[ ] Hyannis tiles + roads
[ ] Brockton tiles + roads
[ ] Act II/III mission content unblocked (Dep: §8.6)
[ ] Accept: no void regions reachable by driving from start map.

7.4 Water & weather gameplay

[ ] Swim mode (enter water, stamina, drown risk)
[ ] Storm-surge "Gloria" gameplay event
[ ] Stronger water reflections (budgeted, quality-tiered)
[ ] Weather → tire friction (Dep: §1.4, §1.9)
[ ] Accept: Gloria event produces surge visuals + handling change; swim
  mode works from any shoreline.

7.5 Fog

· [~] Fog weather type fully wired (toggle is clear↔rain today)
[ ] Fog state reachable in cycle + toggle
[ ] Fog density affects draw distance + streaming hint
[ ] Accept: toggling fog changes visibility + draw distance immediately.

7.6 Night lighting

[ ] Streetlights (instanced, quality-tiered)
[ ] Lit windows (emissive atlas or instanced)
[ ] Night budget: light count cap per tile
[ ] Accept: night scene reads as lit without dropping below frame budget.

7.7 LOD

[ ] Distant LOD for non-building content (props, vegetation, distant cars)
[ ] LOD transitions without popping (dithered or fade)
[ ] Accept: no visible pop at 200m on target device.

7.8 Hero content

[ ] Hand-detailed hero interiors (≥ 2)
[ ] Hero exteriors with unique props/signage
[ ] Accept: hero interiors match their externals' orientation and scale.

---

8. Missions / narrative

8.1 Chain

· [~] Linear 11-mission chain + markers + step persistence — finish
[ ] Verify all 11 complete start-to-finish
[ ] Marker/route correctness on each step (Dep: §1.3)
[ ] Step persistence across save/reload per mission
[ ] Accept: 11/11 missions pass an automated start-to-finish run.

8.2 Dialogue & cutscenes

[ ] Dialogue system: lines, speaker, portrait/name, skip, log
[ ] Cutscene camera tracks + entity animation cues
[ ] Subtitle hook (Dep: §10.5)
[ ] VO hook (Web Speech fallback — Dep: §9.7)
[ ] Accept: a cutscene plays, skips, and logs without soft-locking.

8.3 Objective types

[ ] Timed fails
[ ] Escort (follow target, protect HP)
[ ] Destroy (targets, waves)
[ ] Photo (framing + subject check)
[ ] Delivery / pickup
[ ] Accept: each objective type has one implemented mission beat + test.

8.4 Triggers

· [~] Basic triggers — richer
[ ] Volume triggers (AABB/sphere) with enter/exit
[ ] Damage triggers (entity HP thresholds)
[ ] Inventory/flag triggers
[ ] Timer triggers
[ ] Accept: each trigger type fires exactly once in a replay test.

8.5 Fail / retry / abandon / replay

[ ] Fail overlay + retry/abandon menu
[ ] Retry to checkpoint (Dep: §1.3)
[ ] Abandon removes owned entities and markers
[ ] Replay completed missions (from menu) with no economy double-dip
[ ] Accept: all four flows work on a mission that spawns 3+ entities.

8.6 Content

[ ] 3D world arrow widget (off-screen + on-screen variants)
[ ] Authored opening fish-pier set piece
[ ] Boat mode included in target distance checks (Dep: §5.3)
[ ] Playable mid/late campaign once distant map content exists (Dep: §7.3)
[ ] Accept: opening set piece plays with correct camera/audio/markers.

---

9. Audio

9.1 SFX

· [~] Procedural SFX + 4 radio stations — finish
[ ] Surface footsteps (asphalt, grass, wood, water)
[ ] Door/UI packs (enter/exit, menus, prompts)
[ ] Ped VO barks (greetings, panic, hit)
[ ] Impact variety (material × intensity matrix)
[ ] Weapon SFX set per weapon
[ ] Accept: every material in the friction table has a footstep and impact.

9.2 Spatial audio

[ ] Positional audio via WebAudio PannerNode (or equivalent)
[ ] Distance attenuation curves per category
[ ] Occlusion stub (muffle behind geometry)
[ ] Listener updates from CameraRig
[ ] Accept: a passing siren pans and attenuates correctly.

9.3 Radio

· [~] Fill Rage/Anvil empty track lists — finish
[ ] Longer talk scripts, ads, station IDs
[ ] More stations (≥ 6 total)
[ ] Radio station persisted in save (Dep: §11.2)
[ ] Accept: no station has empty track list; persistence round-trips.

9.4 Music

[ ] Deferred music loading (no block on boot)
[ ] Adaptive music layers beyond chase duck (explore/mission/chase/wanted)
[ ] Cross-fades between layers without clicks
[ ] Accept: chase→wanted transition is seamless and loop-safe.

9.5 Mobile VO

· [~] Mobile-safe VO path (Web Speech often silent) — finish
[ ] Detect Web Speech availability; fallback to text-only subtitles
[ ] Never block gameplay on VO playback
[ ] Accept: VO-silent path still delivers all narrative text.

---

10. UI / UX / accessibility

10.1 HUD

· [~] HUD, minimap, big map, touch editor, pause/character menus — finish
[ ] Compass
[ ] Damage direction indicator
[ ] Wanted full-screen tiers
[ ] Unified interact prompts (Dep: §1.10)
[ ] Weapon wheel (Dep: §5.2)
[ ] Accept: every HUD element has a data source and updates without lag.

10.2 Map

[ ] Map legend
[ ] Fog-of-war
[ ] Richer blips (shops, safehouses, races, collectibles)
[ ] Route line parity with minimap
[ ] Accept: map shows all marker classes with distinct icons + legend.

10.3 Input

[ ] Context-sensitive touch sets (Dep: §1.10)
[ ] Desktop key remapping UI + persistence
[ ] Gamepad support (scope gate)
[ ] Accept: remapped keys persist and are honored in all modes.

10.4 Accessibility

[ ] Screen reader labels for all HUD + menus
[ ] Colorblind modes for wanted stars + map blips
[ ] Subtitle scale + background opacity
[ ] Reduced motion mode (camera shake, flashes)
[ ] Accept: each a11y option independently toggles and persists.

10.5 Onboarding

[ ] Tutorial beyond tip string (movement, drive, mission, wanted)
[ ] Skippable + replayable from menu
[ ] Accept: a new player completes the tutorial without external help.

10.6 Settings

[ ] Audio bus settings (master/music/sfx/radio)
[ ] Language selection (if localized)
[ ] Graphics quality preset (ties to FrameBudget tiers)
[ ] Accept: all settings persist via SaveGame.

10.7 PWA

[ ] theme-color
[ ] apple-touch-icon
[ ] Install prompt + manifest
[ ] Offline shell (cache core assets)
[ ] Accept: installable on iOS + Android; offline shell loads to menu.

10.8 Branding

· [~] Dual branding cleanup (THE NARROWS / Mount Hope / Quahog) — finish
[ ] Pick canonical name; replace stragglers in UI, meta, save keys
[ ] Accept: zero conflicting brand strings in shipped UI.

---

11. Persistence / Continue

11.1 Schema

· [~] Stats, economy, mission index, pos, settings, scrimshaw, touch layout
[ ] Single versioned save + migrations (Dep: §1.5)
[ ] Accept: one schema covers all domains; migration tests pass.

11.2 Missing domains

[ ] Persist boat state
[ ] Persist race bests
[ ] Persist radio station
[ ] Persist weapon/melee/armed state
[ ] Persist waypoint
[ ] Persist car damage
[ ] Accept: each domain round-trips through save/load.

11.3 Continue correctness

· [~] Continue must not succeed with missing pos/mission keys
[ ] Validate required keys before enabling Continue button
[ ] Fall back to New Game with clear message if invalid
[ ] Accept: deleting pos or mission key disables Continue, no crash.

11.4 Recovery & slots

[ ] Corrupt-save recovery UI (discard / export / retry)
[ ] Multi-slot saves
[ ] Cloud sync (if backend exists; else explicit TBD)
[ ] Clear race best / intentional settings policy on New Game
[ ] Accept: corrupt payload never bricks the game; multi-slot swaps cleanly.

---

12. Performance / mobile

12.1 Targets

· [~] Quality tiers for DPR + stream ring
[x] Quality-scaled NPC caps (pedCount / carCount)
[x] Quality-scaled shadow map size (shadowMapSize)
[ ] Named-device FPS/percentile targets (list devices + thresholds)
[ ] Thermal budgets per device (sustained 20 min)
[ ] Accept: measured matrix committed to repo.

12.2 Disposal

· [~] Real GPU geometry dispose on tile unmount — verify
[ ] Verify JSON cache eviction → mesh GC on React unmount
[ ] Accept: heap snapshot flat across 30-min drive; no orphan geometries.

12.3 GC hygiene

· [~] Boat.tsx, earth paths — finish
[ ] Audit per-frame allocations in sim + render hot paths
[ ] Reuse temp vectors/quaternions; no new in update loops
[ ] Accept: zero minor-GC spikes > 8ms during a chase.

12.4 Loading

[ ] Code-splitting by route/feature
[ ] Rapier + slice load budget (first playable < N s on 4G)
[ ] Deferred non-critical assets (audio, GLBs)
[ ] Accept: first playable within budget on throttled network.

12.5 Idle

[ ] Pause stylized Canvas when tab hidden
[ ] Pause render loop on idle (ties to §2.2)
[ ] Accept: hidden-tab CPU < 2% on target device.

---

13. Tech debt / fragility

13.1 StreetLife

· [~] Dual graph paths; ad-hoc yield/lights — finish
[ ] Collapse to single path source (RoadGraph + PedGraph)
[ ] Replace ad-hoc yield/lights with signal state machine
[ ] Accept: one source of truth for pathing; no duplicated constants.

13.2 Corpses

[ ] Cop/traffic reaction to corpses
[ ] Persistent bodies with TTL + cap
[ ] Accept: corpses age out at cap; cops react to them.

13.3 Police soft-fail

· [~] Police requires sim.graph or chase soft-fails
[ ] Make chase degrade gracefully without sim.graph
[ ] Accept: chase runs (reduced) with graph missing; no crash.

13.4 Earth stack

[ ] Resolve parallel earth stack vs shared sim (decision in §2.12)
[ ] Accept: one sim boot path documented and used.

13.5 Legal

[ ] Legal provenance notes (CesiumMan / voice / music)
[ ] Committed license files for every third-party asset
[ ] Accept: asset audit lists license for 100% of shipped assets.

13.6 Integration

[ ] Integration playtest suite (ties §1.12)
[ ] CI gate on the suite
[ ] Accept: suite runs on PR, blocks on regression.

13.7 Housekeeping

· [~] Coord helper duplication / package naming cleanup — finish
[ ] Single coord helper module, re-exported everywhere
[ ] Package naming pass (QUAHOG_Web / Mount Hope / THE NARROWS)
[ ] Accept: no duplicated coord math; naming consistent.

---

Priority implementation order

1. [x] Close streamer evict/dispose + quality NPC/shadow caps
2. [~] PedGraph + MissionRuntime baselines shipped; deepen + GameLoop next
   [ ] GameLoop first (everything downstream depends on fixed step) ← next after §0
   [~] PedGraph (baseline sidewalk graph; deepen)
   [~] MissionRuntime (baseline fail/retry/ownership; deepen)
3+. See IMPLEMENTATION-CHECKLIST-V3.md for §0 Foundations first
3. [ ] Cape / Fall River content so mid-campaign isn't empty
   [ ] WorldManifest schema + validator (Dep: §1.6)
   [ ] Cape road graph + tiles
   [ ] Act II/III mission beats unblocked
4. [ ] Heat escalation + faction response; weapons ammo/inventory
   [ ] Star-tier table (Dep: §3.2)
   [ ] Ammo/inventory persistence (Dep: §5.2, §1.5)
5. [ ] Unified SaveGame + Continue edge cases
   [ ] Schema + migration (Dep: §1.5)
   [ ] Missing-domain persistence (§11.2)
   [ ] Corrupt recovery UI (§11.4)
6. [ ] Finish earth stability or demote earth
   [ ] Decision record (§2.12)
   [ ] If keep: §2.1 stability + §2.9 environment
7. [ ] Audio spatialization + radio content fill
   [ ] Positional audio (Dep: §9.2)
   [ ] Radio track fills (§9.3)
8. [ ] Polish (HUD, a11y, tutorials, interiors, GLB actors)
   [ ] HUD parity (§10.1)
   [ ] A11y (§10.4)
   [ ] Tutorial (§10.5)
   [ ] Interiors (§6.2)
   [ ] CC0 GLB actors (§2.6, §2.7)

---

Cross-cutting acceptance gates (apply to every section)

[ ] Every new module has a header comment naming its fixed-step vs render-rate
  contract.
[ ] Every new persisted field has a migration entry.
[ ] Every new WorldManifest field has a validator + a lint rule.
[ ] Every new feature has one automated test in §13.6 suite.
[ ] Every new per-frame system reports into §1.11 telemetry.
[ ] Every new asset has a license entry in §13.5.
[ ] Every new UI surface has an a11y label (§10.4).
[ ] Every new mission uses MissionRuntime ownership (no orphan entities).