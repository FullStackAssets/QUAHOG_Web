# QUAHOG / THE NARROWS — 2026 GAME CONVERSION
## Engineering backlog and acceptance criteria

**Authoring date:** 2026-10-29  
**Status:** Active visual implementation candidate; remaining backlog is proposed, not completed.  
**Source baseline:** October 29 `QUAHOG_Web_Blizzard_2026_Source.zip`, recovered November 1 in an isolated Work checkout. Archive SHA-256 `79cd65b47c5f13781adb0b853568762683c7509f46929d6dcb199d716b7495e4`. This archive is not proof of production ancestry; the destroyed original worktree must not be reset or reused.  
**Runtime:** Keep existing QUAHOG_Web, do **not** fork a second game or switch engine.  
**Release:** No staging, production, hosting, source control, or Gmail trigger changes performed.


## November 1 implementation update
- [Verified locally] Recovered October 29 game source, including the existing blizzard implementation. The package passes 29 Vitest tests, seven blizzard tests, and a full TypeScript/Vite build before the new visual changes.
- [Verified locally] 62 MassGIS roofprint records and 26 files under `public/music/` (including 16 audio clips) are present. Preserve all original archive bytes for music, GIS, roads, missions and saves through the visual pass.
- [Implemented candidate] Visual aesthetics take priority over the previously recommended minimap-first sequence: white clapboard/trim for the Bethel, stable district facade materials, architectural depth, granite street surfaces, coherent coastal lighting, and a quieter touch HUD. Navigation work remains in the backlog.
- [Limit] This is an isolated candidate, not a production deployment. GitHub comparison could not establish ancestry to the recovered `64178e4` commit. Muse must compare the current VM tree before applying the patch.
- [Verified locally] Visual candidate passes 34 Vitest tests, seven blizzard checks, and a full build; five fixed before/after views and original asset hashes are included. Actual iPhone Safari measurements and Muse staging remain separate acceptance gates.

## Working decisions for this draft
- Target setting: **2026**, while keeping the original 1986 material as archival/historical continuity.
- Target geography: New Bedford waterfront first, then district connections and Fall River story hubs that already exist in the documented game.
- Make one district **excellent** before multiplying shallow districts.
- Make map/GPS and movement physically truthful before photorealism everywhere.
- Fictional historical crime content remains strictly non-playable 1892 backstory; fictional present-day scenarios only.
- Historic Hurricane Gloria stays tied to **1985**; the playable storm follows Nic’s **February 2026 SouthCoast blizzard** direction. The existing source implements snowfall, snowbanks, winter roads, mission weather locking/restoration and reduced vehicle traction. The 52-inch depth is the game’s drift target, not a verified citywide snowfall total.
- Proposed new patron `Mara Bordon` is a placeholder for product approval; the 1986 Vivian storyline remains preserved.

## Evidence limits and labels
- [Reported] The Oct 28 handoff says `src/mission.ts` has a linear step engine; `MissionRunner.tsx` auto-chains missions; `Safehouse.tsx` has no unlock mechanic; `Rain.tsx` has only clear/rain/fog; 003A has a Fall River Borden House but not Maplecroft.
- [Verified locally] The integration kit TypeScript compiles, and its isolated unit tests pass.
- [Not verified] Current game repository contents, world-axis/yaw convention, modern asset count, live iPhone frame rate, current staging SHA, exact road mesh projection, source API signatures.
- [Not completed] In-game animations, meshes, high-resolution assets, GPS UI, road graph import, physics integration, runtime mission integration, live map replacement, staging/production deployment.

## Highest-leverage implementation sequence
1. Restore/inspect and lock the current authoritative source tree without checkout/reset/clean.
2. Read the real minimap/camera/car heading math and run the cardinal-direction tests in the game.
3. Connect the heading module to that real coordinate transform (do not assume +x east and +z north without checking).
4. Build a connected drivable graph from verified road GIS; respect directions, barriers, intersection topology, turn restrictions, and snapping.
5. Wire route result to minimap/HUD, destination controls, next-turn indicators and rerouting.
6. Classify existing GIS footprints by neighborhood and apply stable façade variation without touching colliders.
7. Replace prominent repeated boxes with manually authored hero meshes and district props.
8. Audit avatar animation rig/mixer; connect animation clip plan and implement visual entry/exit/turn states.
9. Audit existing vehicle physics before tuning control curves and suspension (the supplied kinematic helper is a reference, not a replacement physics engine).
10. Add 2026 world/asset data and migrate story IDs and save flags reversibly.
11. Integrate Maplecroft patron gating; extend the existing **February 2026 blizzard** with reversible road closures only after a verified road graph exists.
12. Profile real iPhone Safari builds, tune LOD/presets, produce signed-off Work build for Muse staging.

## Detailed backlog
Legend: P0 = next playable/visual baseline; P1 = expanding finished game; P2 = advanced polish.  
Completion criteria are observable checks, not handoff/coordination gates.


### 00 · Baseline & 2026 migration

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Verify authoritative current repo SHA and tree | Never overwrite newer files with recovered 003A. |
| P0 | Audit startup warnings/errors and broken assets | No unhandled startup errors on iPhone Safari. |
| P0 | Document real world x/z axes, yaw, scale, projection | Four known landmarks and vehicle headings align. |
| P0 | Capture existing performance and screenshot baselines | Identical route/time/weather for before/after. |
| P0 | Enumerate all 1986-specific missions, signage, cars, music, dialogue | Create reversible migration inventory; retain legacy assets. |
| P0 | Add a game-setting configuration for 2026 | Present-day era is data/config, not a forked engine. |
| P1 | Define modern wardrobe, signage, vehicle and prop art direction | Reference board with rights/attribution records. |
| P1 | Add continuity migration mapping for old save IDs | Old saves fail safely or migrate explicitly. |

### 01 · Minimap, GPS, geographic accuracy

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Measure camera, player, vehicle, map heading conventions | North/east/south/west tests pass with both avatar and car. |
| P0 | Fix reverse-facing player minimap arrow | Arrow remains aligned during reversing, camera orbit and driving. |
| P0 | Implement optional north-up and heading-up minimap | Correct map rotation and destination pointer in both modes. |
| P0 | Trace road centerlines into connected, directed graph | Intersections connected, actual restricted roads respected. |
| P0 | Route by travel time with closures and one-way streets | No routes over water, buildings, or blocked streets. |
| P0 | Create destination search/selection from existing landmarks | Tap destination, draw route, cancel navigation. |
| P0 | Create turn guidance, distance and reroute | Bad turn replans quickly, preserving user controls. |
| P0 | Improve snapping to road segment rather than only node | No incorrect large jumps across bridges or parallel roads. |
| P1 | Add road names, speed warnings, map zoom and recenter | Legible on small iPhone screen without covering driving view. |
| P1 | Add dynamic storm detours and missing-route fallback | No false routing during closed-road event. |

### 02 · City mapping & building diversity

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Validate GIS footprints against roadways and terrain | No floating, buried, or road-overlapping buildings. |
| P0 | Classify districts: waterfront, historic downtown, industrial, residential, Highlands | Each district visibly recognizable. |
| P0 | Apply deterministic facade variations per footprint ID | Reentering district preserves same appearance. |
| P0 | Replace identical roof shapes with context-sensitive typologies | Roofline silhouette noticeably different block-to-block. |
| P0 | Add storefront bays, doors, window patterns, cornices and awnings | Street-level 25m photo review passes. |
| P0 | Hand-build 15–25 signature buildings / recognizable hero landmarks | Recognizable major corridors and waterfront sites. |
| P0 | Calibrate building height and massing from verified sources | No unsupported skyscrapers or repeated box profiles. |
| P1 | Add parcel-aware parking lots, loading docks, alleys, backyards | World supports believable service spaces. |
| P1 | Add correct sidewalk/curb heights and crosswalks | Walking, driving and collision agree. |
| P1 | Add marina, fishing port and commercial dock set dressing | Working waterfront feels active and distinct. |
| P1 | Add modern road markings, barriers, stoplights, traffic signs | Contemporary roadway language, not 1980s-only props. |
| P1 | Add district props and greenery while managing draw calls | Variety and performance preserved on iPhone. |
| P2 | Implement streamed terrain/city LOD and occlusion rules | Low-detail silhouettes do not pop visibly. |

### 03 · Character animation & interactions

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Audit actual avatar rig, clips and coordinate conventions | No animation changes until skeleton compatibility confirmed. |
| P0 | Add idle/walk/jog/run blending with movement speed | No foot skating during controlled turns. |
| P0 | Implement smooth start/stop and 180-degree pivot states | Directional changes do not snap rigidly. |
| P0 | Add jump/fall/land states with ground contact | Movement matches collision and gravity. |
| P0 | Add enter/exit vehicle clips and alignment targets | No teleport through doors or roofs. |
| P1 | Add climbing, stairs, door open and object pickup clips | Interaction reads at both close and distant camera. |
| P1 | Add conversational gesture, gaze, idle behaviors and NPC schedules | Characters no longer stand frozen. |
| P2 | Add mobile-friendly IK foot placement and animation LOD | Feet sit on slopes without unstable CPU cost. |

### 04 · Driving, vehicle physics & collisions

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Audit the live physics tick, controller, colliders and vehicle mass | No duplicate physics engine or conflicting updates. |
| P0 | Calibrate acceleration, steering, brake force and reverse | Sedan, SUV, and commercial vehicle have distinct handling. |
| P0 | Improve tire grip, lateral slip and oversteer limits | Cars do not behave as hovercrafts or flip on shallow curbs. |
| P0 | Improve suspension, wheel contact and uneven road response | Smooth over realistic road slopes. |
| P0 | Fix curbs, street objects and building collision alignment | No ghost impacts or fall-throughs. |
| P0 | Stabilize fixed-step physics and interpolation | Same route reacts consistently at variable frame rates. |
| P1 | Implement vehicle-to-vehicle contact, impact feedback and recovery | Low-speed collisions are non-explosive. |
| P1 | Add braking lamps, steering-wheel animation, tires and signals | Control response visibly matches inputs. |
| P2 | Add vehicle damage stages without costly full-body simulation | Scalable damage feedback per quality preset. |

### 05 · Photorealistic graphics & atmosphere

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Establish PBR material library for brick, granite, wood, asphalt, roofs | No uniform plastic-looking city. |
| P0 | Set physically plausible daylight, shadows, tone mapping and exposure | Overcast/clear lighting readable on iPhone. |
| P0 | Upgrade hero landmarks with high-quality mesh and references | Foreground recognizable in screenshot comparisons. |
| P1 | Apply licensed/high-quality texture atlases with mipmaps/compression | No raw full-res photos mapped across generic boxes. |
| P1 | Improve glazing, windows, emissive interiors and surface breakup | Street elevations have appropriate depth and reflection. |
| P1 | Upgrade water, tide, harbor wet surfaces and boats | Waterfront reads as a living working port. |
| P1 | Add rain accumulation, puddles and storm lighting variants | Weather changes world mood without tanking frame rate. |
| P1 | Add realistic traffic/pedestrian shadows with dynamic LOD | Spatial cues preserved at low GPU budgets. |
| P2 | Add time-of-day and seasonal lighting/look development | Looks different by season without altering story canon. |

### 06 · Living city, traffic and audio

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P1 | Populate pedestrians with sidewalks, crosswalks and schedules | Avoid walking through moving cars or facades. |
| P1 | Implement lane-aware traffic and signal obedience | Vehicles obey intersections and don't intersect each other. |
| P1 | Add dispatch/service vehicles and parked cars | World feels contemporary, not empty. |
| P1 | Add working port cranes, dockworkers, fishing vessel motion | Port has distinct believable activity. |
| P1 | Give key NPCs look, interaction dialogue and encounter staging | Story characters materially present in game. |
| P1 | Add positional city ambience, horns, engines, birds and waterfront sounds | Audio follows distance/location without overwhelming music. |
| P2 | Add events and ambient NPC conversations with performance caps | High population feels alive while mobile remains playable. |

### 07 · 2026 narrative, Bordon / Gloria

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Keep 1892 true-crime inspiration as nonplayable historical backstory | Never reenact real killings or depict real victims. |
| P0 | Choose proposed contemporary Bordon descendant and update timeline | No age/era contradictions. |
| P0 | Integrate five Maplecroft missions without duplicate existing mission IDs | Older Acquitted/Gloria content remains preserved. |
| P0 | Build Maplecroft as a named landmark, hub, and earned safehouse | Correct unlock state persisted across saves. |
| P1 | Add safehouse unlock flag and patron mission giver | Works beyond existing linear auto-chain system. |
| P1 | Create modern gallery, family records, visitor tours and playable interactions | Environmental storytelling and navigable objectives. |
| P1 | Preserve Gloria (1985) as historical continuity and use the February 2026 blizzard for present-day weather | Existing blizzard mission is implemented locally; not deployed or device accepted. |
| P1 | Implement storm stage transitions, hazards and GPS closures | Detours reliable and reversible. |
| P1 | Add scripted aftermath props, missions and recovery cycle | World returns to stable state after event. |
| P2 | Record and validate distinct character voices/performances | No unapproved spend for external voice services. |

### 08 · iPhone UX & performance

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Profile actual iPhone Safari CPU/GPU/frame-time, not guesses | Baseline and changes have reproducible measurements. |
| P0 | Guarantee all primary actions work without hardware keyboard | Movement, GPS, vehicle entry, mission, pause, settings accessible. |
| P0 | Connect graphics presets to GPU cost parameters | Quality settings change draw distance/shadow resolution/particles. |
| P0 | Fix UI safe areas, virtual controls, tap hitboxes and landscape mode | HUD legible on modern iPhone sizes. |
| P0 | Ensure save/resume works after Safari suspension | No progress loss after app backgrounding. |
| P0 | Keep a stable 30fps mobile baseline at balanced settings where hardware permits | No sustained thermal throttling/unbounded memory growth. |
| P1 | Use geometry/material instancing, texture compression, asset streaming | Remove draw-call and texture-memory spikes. |
| P1 | Ensure browser console has no persistent warnings/errors | No silent missing asset failures. |
| P2 | Add optional advanced 60fps mode on capable devices | No regressions to balanced mode. |

### 09 · Test, staging, release discipline

| Priority | Engineering task | Completion evidence |
|---|---|---|
| P0 | Unit-test compass, signed angles, one-way routes and detours | All deterministic math cases pass. |
| P0 | Regression-test all existing mission IDs, rewards and saves | Existing player progress remains usable. |
| P0 | Automate visual screenshot comparisons for target neighborhoods | Unexpected visual drift visible before deploy. |
| P0 | Test district collision and all landmark spawn points | No unreachable mission objectives. |
| P0 | Provide per-build commit SHA, changed files, tests, preview, iPhone limitations | Each build independently reviewable. |
| P0 | Submit verified Work-built artifact to Muse for staging | No production change without product owner approval. |
| P1 | Validate story continuity and licensed-source asset manifest | No accidental factual/rights errors. |
| P1 | Maintain reversible migration and no-change South Coast freeze | Historical South Coast demo remains untouched. |

## Geographic inputs for a 2026 city
Use a verified coordinate transformation from geographic / projected data to the current game engine's world coordinates. Never directly substitute longitude/latitude for meters or switch the existing origin.
- MassGIS-MassDOT Roads: https://www.mass.gov/info-details/massgis-data-massgis-massdot-roads (public GIS linework; not a drop-in turn-by-turn graph).
- MassGIS layers, including roofprints and elevation sources: https://www.mass.gov/info-details/massgis-data-layers
- MassGIS datasets and services: https://www.mass.gov/get-massgis-geospatial-data
- For facade references, verify site-specific photography and rights. Generic GIS footprints cannot determine accurate elevations, roofs, windows, door location, or material PBR textures.
- Review attribution, licensing, photography rights and data freshness before embedding any third-party imagery.

## World and map quality methodology
### Generic building remediation
1. Preserve the authoritative building footprint ID, collider, elevation and position.
2. Give each district a curated library of facade and roof archetypes, not unconstrained citywide random styles.
3. Use an ID-seeded variant function so repeated sessions retain the same identity.
4. Add physical depth: inset windows, cornices, fire escapes, commercial doors, loading docks, signs, utility equipment, believable roof shapes.
5. Build hero landmarks with hand-authored geometry and legally sourced reference material, especially near missions.
6. Separate low/medium/high materials and detail budgets so the GPU workload changes substantially between presets.
7. Audit street-level screenshots at representative distances and times of day.

### Photorealism definition
Quality should emerge from building shape and accurate geometry first, then consistent materials, lighting, shadows, weather, postprocessing, surface decals and movement. A huge phototexture does not make a generic cuboid photorealistic. Do not trade away smooth iPhone controls for excessive shader cost.

## Animation implementation details
- Attach locomotion blends to the actual player controller speed (not simulated camera drift).
- Audit the rig skeleton, orientation, actual imported clip names, and frame events.
- Crossfade idle/walk/jog/run; use velocity-dependent turns and recoverable landing states.
- Enter/exit vehicles requires door handle positions, mounted camera change, collision toggling, and animation markers.
- NPCs need navigation paths, grounding, avoidance, schedules, and dialogue reactions.
- Tune animation LOD to update distant pedestrians less frequently.

## Vehicle and physics implementation details
- Confirm whether the authoritative game uses rigid-body simulation or custom kinematic movement.
- Use a fixed timestep with interpolation for camera smoothness.
- Measure meters per game unit; verify wheelbase, speed units, steering convention, gravity and ground normals.
- Fix street/curb and dynamic-object collisions before increasing vehicle speed.
- Introduce tuned presets for sedans, SUVs, pickups, commercial vans and working-port vehicles.
- The provided `handlingPrototype.ts` is only a deterministic reference model: it lacks tire forces, suspension, surface friction, chassis collisions, geometry raycasts and rollback-safe state.

## 2026 story integration details
- Existing campaign reportedly includes `Acquitted`, `Gloria`, and `The Undefeated`; do not create duplicate IDs or overwrite legacy saves.
- Proposed modern patron is **Mara Bordon** (fictional descendant). Vivian belongs to 1986 archival narrative, not as a 91-year-old in 2026.
- The five Maplecroft Files mission titles remain with 2026 objectives and modern dialogue.
- Build a separate Highlands location for Maplecroft; Second Street remains the historically framed tour site.
- Safehouse must be earned after `Forty Whacks`, with a flag stored in the existing save system.
- 1985 Gloria remains historical context. **Blizzard of '26** is the playable modern storm; preserve its existing checkpoint progression and weather restoration. Snow-clearing, closures and aftermath remain future work grounded in a verified road graph.
- Road closures must reference actual, verified edges in the existing map; temporary damage effects must be reversible.
- Keep the 1892 material as background text and archives, never a playable reenactment.
- Do not add paid voice services or third-party licenses without permission.

## Build/use instructions for the integration kit
- TypeScript source is in `src`; `dist` is compiled JavaScript; tests are in `test`.
- In a suitable Node environment with TypeScript 5.8+: `npm test`.
- Do not directly copy all code over same-named files in the existing game. First audit the source API and transform/units.
- Suggested wiring targets from the recovered docs:
  - navigation math and route HUD → actual minimap/camera/player/vehicle modules (filenames need discovery).
  - map data → `src/places.ts`, `src/slice.ts`, `src/world/Experience.tsx`.
  - new building style assignments → GIS extrusion/material pipeline in `Experience.tsx`.
  - new story data → `src/mission.ts`, `src/world/MissionRunner.tsx`, `src/world/Safehouse.tsx`.
  - storm state → `src/store.ts`, `src/world/Rain.tsx`, `src/world/DayNight.tsx`, `src/world/HurricaneBarrier.tsx`.
  - landmark assets → `src/world/Heroes.tsx`.
- Apply each adapter behind feature flags to preserve existing 003A/active campaign, savegame and music data.

## Work vs Muse and release
**Chat** owns direction, acceptance and review. **Work** integrates, implements, builds and runs in-game QA. **Muse** only deploys Work-provided bundles and maintains hosting. Major production release approval remains with the product owner. South Coast 1986 live demo and its roadmap stay frozen.
