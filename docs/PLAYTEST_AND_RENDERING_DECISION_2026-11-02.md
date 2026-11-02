# QUAHOG iPhone playtest corrective implementation and graphics decision
Date: 2026-11-02
Source: 93-second iPhone screen recording; 31 reviewed frames. Review was visual only.

## Decision
Adopt compatible graphics upgrades **after** the corrective playtest work. Do not treat the pasted photorealism TRD as an engine-migration authorization. Retain R3F/Three 0.169/Rapier and the existing procedural build. No deployment, production merge, spend, or bulk asset import is authorized by this PR.

## Evidence baseline
- 22m initial objective distance to Seamen's Bethel; 814m at the end of the 93s recording.
- Mission distance updated, but player never reached the target.
- Visible issues: blocked cameras, floating awnings, grey slabs, white sky seam, overlapping parked vehicle, conflicting road markings.
- The 93s recording showed **no visible freeze or crash**, so do not claim WebGPU fixes a measured crash.
- Clock: source DayNight.tsx deliberately uses DAY_LENGTH = 600 seconds (24 in-game hours / 10 real minutes).
- Original source already contains drei Sky, ACESFilmicToneMapping, mission beam, mission radar pin, directional HUD text, MPH, postprocessing, and a customisable touch HUD.
- More features are not proof the existing features are usable on a phone.

## Corrective patch in draft PR
| ID | Change | Evidence gate |
| --- | --- | --- |
| A-01/A-02 | Persistent mission arrow and sustained wrong-way warning | iPhone playtest from 22m and 814m |
| A-04/D-03 | Connected driving route, heading-up radar, better objective clipping, touch clearance | Road graph tests and landscape/portrait screenshot |
| E-04 | Fixed Rapier colliders for parked vehicles | Physics probe against grey truck; ensure no false barriers |
| R-04 | Disable awnings generated without facade anchors | Roadside inspection at f_005, f_006, f_014, f_015 |
| K-01 | Preserve current iPhone stability | 93s drive replay, FPS / frame-time capture |

## Still outstanding
- E-01/E-02/D-01/D-04: camera entry transition, sweep against poles/walls/buildings, smoother chase rig.
- R-02/R-03: investigate grey slabs / white sky seam with mesh visibility instrumentation. A developer working-tree sky-follow fix has been *reported* but is not claimed verified by this PR.
- R-01/E-07/A-03: reproduce bare digit near CAR and clarify mobile VIEW button. Current source already provides a separate MPH speedometer.
- E-05: intersection-aware road marking masks and crosswalk orientation.
- A-05/D-02/D-05: curb feel, steering curve and optional lane cues after input/physics replay.
- E-03: examine shadow anchoring before contemplating cascaded shadows.
- A-07: device audio/haptics verification; impossible to confirm from video frames alone.
- A-06: P001/P011 import requires separately validated manifests, compatibility, memory and device budgets.

## Rendering TRD amendments
1. **WebGPU:** feature-detect on actual Safari target hardware; no Babylon.js migration and no WebGPU-only feature requirement.
2. **Sky:** correct the existing drei Sky/world-origin placement if confirmed; do not replace it with another atmospheric shader without evidence.
3. **Clock:** 600s/day is intentional configuration, not proof of a timekeeping bug.
4. **Color:** retain already configured ACES; optionally compare a lightweight color grade against reference screenshots in an isolated A/B flag.
5. **KTX2:** investigate only when textured GLBs arrive. Test GLTFLoader + MeshoptDecoder + KTX2Loader against target assets; avoid assuming a 50% VRAM reduction.
6. **Shadows:** correct light/caster/receiver alignment first. CSM/SSCS only after device profiling.
7. **LOD:** remove near-field slabs, validate visibility/occlusion boundaries; advanced impostor shaders remain optional.
8. **Postprocessing:** SMAA/TAA/bloom behind quality flags and measured frame budget. Do not promise 60fps on unprofiled devices.
9. **Textures:** set sRGB on color maps, linear on data maps; tone mapping belongs to the renderer, not every texture.
10. **QA:** frame time, peak memory, context loss, draw calls and triangle count are *targets pending measurements*, not verified baselines.

## Acceptance gates before merge
- Typecheck and bundle: npm run build.
- Tests: npm test, including navigation connected/disconnected graphs.
- Device: iPhone portrait, continuous 93s drive, mission approach/retreat, car/truck contact, camera entering/exiting vehicles.
- Images: compare reproducible positions corresponding to f_001, f_002, f_009, f_013, f_015, f_016, f_019, f_020, f_021, f_025.
- Record actual FPS, frame times, WebGL context losses, error logs, draw calls, triangles and memory where obtainable.
- No green status without an observed test run. Reconcile external/uncommitted working-tree fixes before merge.

**Approval boundary:** code changes in isolated branches may proceed; production deployment remains separate.
