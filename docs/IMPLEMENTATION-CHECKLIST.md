# Mount Hope — Implementation Checklist

Tracked backlog for making QUAHOG_Web / Mount Hope a substantially complete
open-world browser game. Status tags:

- `[ ]` not started
- `[~]` partial / needs finish
- `[x]` done

Update this file when a checkbox lands. Highest-leverage order is at the bottom.

---

## Done baseline (sim layer)

- [x] `RoadGraph` + Dijkstra + `ObjectiveNav` (route, wrong-way, minimap polyline)
- [x] `CameraRig` + occlusion pull-in (`FollowCamera`)
- [x] `WorldStreamer` module (request / queue / load / LRU API)
- [x] `VehicleDynamics` + `VehicleState` (enter / exit / carjack)
- [x] `TrafficDirector` wired into `StreetLife`
- [x] `ChaseController` wired into `Police`
- [x] `PedestrianAI` + `SpatialIndex` (ped LOD)
- [x] `FrameBudget` + `SimBootstrap`
- [x] Mission step persistence (`mounthope.mission.v1`)

---

## 1. Core simulation architecture

- [ ] Fixed-step `GameLoop` (accumulator + render interpolation) — `src/sim/GameLoop.ts`
- [ ] Pedestrian sidewalk graph (`PedGraph`) — `src/sim/PedGraph.ts`
- [ ] Full `MissionRuntime` (event bus, entity ownership, spawn/cleanup) — `src/sim/MissionRuntime.ts`
- [ ] Unified `ClockWeather` (time + weather + friction API) — `src/sim/ClockWeather.ts`
- [ ] Versioned `SaveGame` blob + migrations — `src/sim/SaveGame.ts`
- [ ] `WorldManifest` for authored env data — `src/sim/WorldManifest.ts`
- [x] Close `WorldStreamer` real load/evict loop (tile cache eviction via handlers; `evictUnwanted` grace) — `WorldStreamer.ts` ↔ `StreamingBuildings.tsx`
- [x] Predictive focus applied by `StreamingBuildings` when building interest ids
- [~] SpatialIndex for buildings/vehicles/LOS — not only peds
- [~] Deeper vehicle model: suspension, surfaces, impact damage
- [~] Mode-aware mobile controls (foot / car / boat) — `TouchControls.tsx`
- [~] Telemetry: budget warnings, entity counts, streamer resident/queue, percentiles
- [ ] Stage 0–7 acceptance harness (device FPS, stream memory plateau, mission fail/retry)

---

## 2. Photoreal build (`earth.html`)

- [~] Finish stability pass (raycast throttle, alloc-free hot paths, `maxDepth`)
- [ ] Pause render when tab hidden / idle
- [~] Distinct Google 401 vs 429 overlays
- [ ] Idle / walk / run animation states
- [ ] Earth HUD parity (minimap, compass, health, prompts)
- [ ] CC0 GLB cars + night headlights (earth + stylized)
- [ ] Distinct pedestrian models
- [ ] Wire missions / wanted / economy into earth play loop
- [ ] Earth day/night ↔ weather; water/reflections; SFX; save/load
- [ ] Fallback ground when tiles fail
- [ ] Characters & Missions bible (ROADMAP deliverable)
- [ ] Real iPhone measurement pass
- [ ] Share `SimBootstrap` with earth **or** formally demote earth to diagnostic-only

---

## 3. Wanted / heat / police

- [~] Dual-axis heat + basic road chase (≥3★)
- [ ] Star-tier escalation table (witnesses, LOS, bribe, APB)
- [ ] Foot cops, roadblocks, helicopter tier
- [ ] PIT / Rapier collision with player car
- [ ] Faction-heat gameplay (territory, NPC aggro)
- [ ] Wanted radar / backup calls / lose-heat zones

---

## 4. Economy / properties / shops

- [~] Buy fronts + passive income + boom/leak events
- [ ] Property upgrades, employees, sell/foreclose
- [ ] Ownership-tied missions
- [ ] Shops: ammo, weapons, clothes, garage storage (beyond respray)
- [ ] Day-based payout UI / balance pass
- [~] Distant business markers need supporting world content

---

## 5. Combat / weapons / boats / races / traffic AI

- [~] Fists / bat / pistol / shotgun
- [ ] Ammo, reload, inventory, pickups, recoil/accuracy
- [ ] Weapon wheel / cover / better reticle
- [~] One marina boat
- [ ] Buoyancy/waves, boat damage, multiple boats, boat in Continue save
- [~] One race loop
- [ ] Multi-track races, AI opponents, fail timer, persisted bests, class locks
- [ ] Traffic collision avoidance, parking AI, door/sidewalk coupling

---

## 6. Safehouse / hospital / collectibles

- [~] Safehouse heat clear + sleep; visual hospital; wasted/busted flow
- [ ] Interiors, multiple unlockable safehouses, richer arrest/medical narrative
- [~] 8 downtown scrimshaw
- [ ] Citywide sets, map progress, unique rewards, FR/Cape collectibles

---

## 7. World content & streaming

- [~] NB tile stream + some FR heroes
- [x] Real JSON tile cache eviction under memory budget + unwanted grace
- [ ] Lived-in Fall River district
- [ ] Cape / Hyannis / Brockton tiles & roads (Act II/III currently void)
- [ ] Swim mode; storm-surge “Gloria” gameplay; stronger water reflections
- [ ] Weather → tire friction / handling
- [~] Fog weather type fully wired (toggle is clear↔rain today)
- [ ] Night streetlights / lit windows
- [ ] Distant LOD for non-building content
- [ ] Hand-detailed hero interiors
- [~] `tileImpostor()` used in active streaming set

---

## 8. Missions / narrative

- [~] Linear 11-mission chain + markers + step persistence
- [ ] Dialogues, cutscenes, timed fails, escort/destroy/photo beats
- [ ] Richer triggers (volumes, damage, inventory flags)
- [ ] Fail / retry / abandon / replay
- [ ] Mission-owned entities with cleanup
- [ ] 3D world arrow widget
- [ ] Authored opening fish-pier set piece
- [~] Boat mode included in mission target distance checks
- [ ] Playable mid/late campaign once distant map content exists

---

## 9. Audio

- [~] Procedural SFX + 4 radio stations
- [ ] Surface footsteps, door/UI packs, ped VO, impact variety
- [ ] Positional / spatial audio
- [~] Fill Rage/Anvil empty track lists
- [ ] Longer talk scripts, ads, more stations
- [ ] Deferred music loading
- [ ] Adaptive music layers beyond chase duck
- [~] Mobile-safe VO path (Web Speech often silent)

---

## 10. UI / UX / accessibility

- [~] HUD, minimap, big map, touch editor, pause/character menus
- [ ] Compass, damage direction, wanted full-screen tiers, unified interact prompts
- [ ] Map legend, fog-of-war, richer blips
- [ ] Context-sensitive touch sets; desktop key remapping
- [ ] A11y: SR labels, colorblind wanted, subtitle scale
- [ ] Tutorial / onboarding beyond tip string
- [ ] Audio bus settings, language
- [ ] PWA polish (`theme-color`, apple-touch, install)
- [~] Dual branding cleanup (THE NARROWS / Mount Hope / Quahog)

---

## 11. Persistence / Continue

- [~] Stats, economy, mission index, pos, settings, scrimshaw, touch layout
- [ ] Single versioned save + migrations
- [ ] Persist: boat, race best, radio station, weapon/melee/armed, waypoint, car damage
- [~] Continue must not succeed with missing pos/mission keys
- [ ] Corrupt-save recovery UI; multi-slot; cloud sync
- [ ] Clear race best / intentional settings policy on New Game

---

## 12. Performance / mobile

- [~] Quality tiers for DPR + stream ring
- [x] Quality-scaled NPC caps (`pedCount` / `carCount`)
- [x] Quality-scaled shadow map size (`shadowMapSize`)
- [~] Real GPU geometry dispose on tile unmount (JSON cache eviction done; GPU mesh GC follows React unmount)
- [x] Priority 1 complete: streamer evict loop + quality NPC/shadow caps
- [~] GC hygiene (`Boat.tsx`, earth paths)
- [ ] Named-device FPS/percentile targets; thermal budgets
- [ ] Code-splitting / Rapier+slice load budget
- [ ] Pause stylized Canvas when tab hidden

---

## 13. Tech debt / fragility

- [~] StreetLife dual graph paths; ad-hoc yield/lights
- [ ] Cop/traffic reaction to corpses; persistent bodies
- [~] Police requires `sim.graph` or chase soft-fails
- [ ] Parallel earth stack vs shared sim
- [ ] Legal provenance notes (CesiumMan / voice / music)
- [ ] Integration playtest suite
- [~] Coord helper duplication / package naming cleanup

---

## Priority implementation order

1. [x] Close streamer evict/dispose + quality NPC/shadow caps
2. PedGraph + MissionRuntime (fail/retry/ownership) ← next
3. Cape / Fall River content so mid-campaign isn’t empty
4. Heat escalation + faction response; weapons ammo/inventory
5. Unified SaveGame + Continue edge cases
6. Finish earth stability **or** demote earth
7. Audio spatialization + radio content fill
8. Polish (HUD, a11y, tutorials, interiors, GLB actors)
