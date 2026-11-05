# Blizzard of ’26 — seven regression fixes and iPhone candidate

Date: 2026-11-01. Owner: ChatGPT Work. User direction: retain the accepted staging build, leave production on Build 003A, merge the seven known regressions first, then continue development. The preceding request to optimize for iPhone/mobile remains included. No deployment, infrastructure change or new recurring job was performed.

## Verified source lineage
- Blizzard base archive: `QUAHOG_Web_Blizzard_2026_Source.zip`, SHA-256 `79cd65b47c5f13781adb0b853568762683c7509f46929d6dcb199d716b7495e4`.
- Continued the existing visual candidate at `f6a95017b42129dde65d3403d2cc2a9e9fc2f75b`; no second feature implementation or old GitHub checkout.
- Downloaded and independently hash-checked donor `quahog-003A-recovered-64178e4.tar.gz`: 42,500,928 bytes; SHA-256 `1f65d2286e4b1084720bf08274572979849a78b17df5f87fc4431225fd427797`. This is Muse’s reported recovered production source, not a claim that Work inspected the live VM.
- Regression merge commit: `e3da39bec8118f84d376c91949555bb5030c6c00`. The mobile optimization commit and packaged build stamp are recorded in `release.json`.

## Seven fixes — merged at change level

| Fix | Implementation and reconciliation |
|---|---|
| Bethel clapboard | Restored `bethelSurface.ts`, its original deterministic albedo/bump textures and world-scaled body/tower UV helpers. Added the named body/tower meshes. Retained the visual candidate’s detailed trim, arched sashes, snow roof and light treatment. |
| Camera obstruction | Restored `cameraObstruction.ts` and the Rapier sphere sweep, near-plane coverage, teleport reset and post-smoothing/shake re-sweep. Moved `FollowCamera` **inside Physics**, required for `useRapier`. Development review cameras remain opt-in and excluded from production. |
| Pedestrian avoidance | Restored `buildingAvoid.ts`; register nearby OSM and GIS building footprints, clear on unmount, and push active kinematic pedestrians out of building AABBs. This is the donor’s conservative AABB method, not polygon navigation. |
| Touch HUD | Restored coarse-pointer detection and `fitTouchLayout`, and merged compact/expanded HUD behavior into the current visual theme. The More/Less control stays in the mobile panel launcher to avoid overlapping the title/objective. Saved layout migration and rotation handling are extended below. |
| Sidewalks/roads | Kept both upward top windings (also already repaired in the visual candidate). Restored the donor concrete sidewalk texture and asphalt normal strength 0.18. **Preserved snow tints, packed-snow road texture, snowy sidewalks and weather restoration; no wholesale donor Roads overwrite.** Retained the candidate’s nonmetallic wet-road material. |
| GIS Bethel exclusion | Restore `HANDLED` exclusion for `massgis:201:248015_820696`. Remove the generic Bethel render AND hull, leaving the chapel’s hand-modeled body/tower colliders. Raw 62-record GIS file is unchanged. Pedestrian avoidance still knows its footprint. |
| Safe fast travel | Seamen’s Bethel destination restored to `[-250, 106]`, east of the chapel/tower, replacing the inside-collider `[-272, 106]`. Other 10 destinations remain unchanged. |

Restored all four donor test files: Bethel surface (2), camera obstruction (3), sidewalks (1), touch layout (2). Added independent checks for pedestrian avoidance and safe spawn. The donor test suite totals 37 before the prior five visual tests and new mobile tests; the combined candidate has 50 unit tests plus seven blizzard checks.

## iPhone/mobile implementation
- Fresh touch profiles start on Low with shadows, postprocessing and the radio panel off. Existing stored user graphics choices are respected. Settings quality is bounded to 0–2 rather than allowing corrupt persisted values to break array lookups.
- Phone DPR caps: Low 1, Medium 1, High 1.25. Renderer targets 30 FPS on touch devices (60 on desktop); title/pause renders at 12 FPS. Target is not measured device performance.
- The manual R3F frame driver stops entirely when hidden. Resume resets its timestamp without fast-forwarding physics/clock timers through time spent suspended. Rapier is explicitly paused in the settings menu.
- FPS and p95 telemetry use real monotonic wall-clock intervals, independent of the capped simulation clock, so slow software rendering cannot be mislabeled as 20/30 FPS.
- Mobile Low aerial budget: at most 9 imagery tiles and two concurrent requests, vs the earlier fixed 121 / six. Snow skips aerial imagery downloads altogether. Failed tiles retain the procedural ground fallback.
- Building tile loads use a shared two-request mobile gate, nearest-first order, stale-generation checks, abort-on-unmount, bounded inactive cache (40/64/100 by quality), and retries after failures. Active collision tiles are retained; no road/building data is rewritten.
- Ambient Low budgets: 12 parked cars, 10 pedestrians, six traffic vehicles (High preserves 46/32/20). Mission NPCs, police rules, mission rewards, player-car parameters and snow traction are not rebalanced. Ambient populations remount when the user changes graphics quality.
- Added a touch Waypoint control on the full map (tap to place; drag remains pan), 44px map buttons and a scrollable fast-travel list. Browser-verified Bethel travel lands at x=-250 outside the chapel. This is waypoint placement, not connected GPS routing.
- Minimap refresh is bounded to 10 Hz; full map to 15 Hz. Both skip hidden document drawing. Main map/fast travel and mission directions remain available.
- Touch drags are tracked per pointer: joystick + sprint/brake work together and release independently. Blur, pointer cancel, menu/map/character opening, mode changes and visibility loss clear virtual movement/held buttons.
- Separate portrait/landscape saved layouts, compatible legacy migration, visual viewport resize handling and safe inset fitting. Reset retains all game controls in the layout editor.
- Settings scroll within the phone viewport, with 44px button targets. Landscape no longer clips the bottom settings/reset/quit controls.
- Added viewport-fit=cover, dynamic viewport height fallback, standalone Home Screen metadata, scoped manifest, original app icons and bundled fonts. Pinch zoom is no longer globally disabled by the viewport meta tag. No new service worker; the game is not advertised as offline-capable.
- Save existing stats, economy, position and settings on page hide; storage keys and mission definition format are retained. This is not a new mission-progress/save migration system.

## Verification
[Verified locally]
- `npm test`: 50/50 passed, including all eight restored donor tests and real Rapier wall/sensor/actor collision queries.
- `npm run test:blizzard`: 7/7 passed; mission text/checkpoints/rewards, snow state, snow-car traction and weather lock/restore preserved.
- `npm run build`: TypeScript clean and Vite success. Existing vendor/R3F circular-chunk and large-Rapier-chunk warnings remain.
- Touch Chromium (390×844, DPR 3 emulation) confirms mobile defaults Low/off/off, simultaneous joystick + sprint, release of both pointers, compact/expanded HUD, portrait→844×390 landscape rotation without out-of-bounds controls, scrollable settings, driving brake controls, touch waypoint placement, safe Bethel fast travel (observed x=-250, z=106), and stopped background clock.
- Manifest and app icons return 200; production bundle smoke verifies new game/settings and local assets. Browser evidence is **Chromium/Linux SwiftShader**, not Safari/iPhone.
- Tests exercise 30 FPS scheduling from 120 callbacks without simulation speedup, a five-minute suspension without fast-forward, concurrent request limits including errors, protected active tile-cache eviction and released held input.
- Original raw music/GIS/roads/tile data, missions, player/car controller and snow modules verified byte-for-byte against the Blizzard archive; the new `store.ts` mobile defaults/settings bound are an intentional code change. No original music file is modified.

[Still unverified]
- Actual iPhone Safari FPS/p95/thermal behavior and the >15% sustained regression gate; 30 FPS is a target, not an acceptance claim. Software-renderer FPS is not an iPhone result.
- Real iPhone Home Screen installation/launch, safe insets under the notch/browser toolbar, Safari suspension/reload, voice/audio interruptions, long-distance memory behavior and full on-device wall-walk/vehicle traversal.
- No new staging or production URL is claimed. User acceptance applies to the existing staging build; this source is a later **undeployed** candidate.

## Delivery and next work
The private source archive includes the complete merged source and original public assets. `release.json` gives source/result SHAs, file hashes and build identity. A compiled web overlay is provided for review but must be combined with the matching public assets or rebuilt from source. The original approved staging and live Build 003A must remain unchanged until a new release instruction.

Next source priorities: measure this candidate on iPhone Safari; then improve character idle/locomotion blending and vehicle/camera traversal on the protected Johnny Cake Hill route, followed by connected road-based GPS. No replacement physics engine, engine migration, new campaign, paid assets or external voice spend was introduced.
