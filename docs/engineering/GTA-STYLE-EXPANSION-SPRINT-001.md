# QUAHOG / The Narrows | GTA-style visual upgrade, sprint 001

**Date:** November 1, 2026
**Owner:** ChatGPT, this QUAHOG project conversation. No Muse involvement or parallel code owner assigned.
**Input:** User-supplied `Exponential Expansion Rendering.txt` (689 lines).
**Source:** Isolated, previously verified complete cinematic candidate source corresponding to `7c6ce35` from November 1; its local Git root is an *archive import* and does **not** prove ancestry against production or the authoritative VM.
**Release status:** LOCAL/Sprite build candidate only; no staging/production deployment.

## Implemented [Verified source-level]

- **Player hero car:** Adds a purpose-built tapered body/cabin, distinct profiles for five car classes, recessed independent glass surfaces, bright small headlights, individual rear lamps and brake strip, grille, plate, bumpers, mirrors, wheels and quality-gated fine details. Multi-layer clearcoat PBR on hero paint and glass using the existing local room environment. Existing Rapier rigid body, 2.1 m collider, collision avoidance, drive controls, snow traction, game state and persistence unchanged. Ambient cars stay cheap; no wholesale increase in traffic draw calls.
- **Grounding:** One low-overdraw contact patch below the *player's* car even on mobile Low when shadow maps are disabled. It fades when the car is high above the ground instead of floating visibly through a jump. It does not collide.
- **Seamen's Bethel:** Texture-authored brick/stone walkway (albedo + bump), procedural lawn, full striped flag with a star canton and curved cloth, better sculpted shrub clusters and snow-state material. Existing hero geometry, camera collider and safe fast travel unchanged.
- **Street infrastructure:** Procedural albedo for iron utility covers, curb grates and patched asphalt, reusing exactly the existing **three instanced meshes**, not thousands of distinct meshes. No extra vendor assets or external texture network calls.
- **Rain-slick detail:** An original, deterministic puddle-placement algorithm along supported OSM street classes; excludes bridges and footways, with caps of **22 / 52 / 96** for Low/Medium/High. Rendered as one instanced, transparent draw call only while raining. No puddle collision, real reflections, runoff or accurate hydrology claimed.
- **Exposure:** Cheap continuous ACES exposure variation tied to day/night and weather state (0.82–1.10); avoids heavyweight global illumination and extra screen-space passes.
- **Cleaner skyline:** Far-away activity/mission beams and giant circles become low-opacity, short-range indicators. A pure distance-fade function changes only visuals, not mission, shop, safehouse, race or respray activation radii.

## Build and quality [Verified in a networked, isolated Sprite]

Build environment: `quahog-build-20261101` (private access), baseline checkpoint `v3` before this sprint. Dependencies installed earlier with `npm ci --no-audit --no-fund` from unchanged `package-lock.json`; the baseline was 50 unit + 7 Blizzard + 11 architectural tests. Following this sprint:

- Unit: **64 passing** (14 files), including 7 geometry, 4 surface/puddle/exposure and 3 marker fade tests.
- Blizzard: **7 passing**; no weather/mission changes.
- Architectural: **11 passing**; all source placement invariants retained.
- TypeScript `tsc` and Vite build: **passed**.
- **Public assets:** all **1,001 files byte-for-byte unchanged** relative to the original cinematic source archive; 26/26 music files unchanged.
- **Protected game systems:** 12 explicit physics, weather, camera, input, state, mission and GIS files unchanged; `Car.tsx` is visually extended *inside the existing rigid body*, not physics/controller rewritten.
- Existing warnings remain: circular vendor/R3F chunk, oversized Rapier chunk. An isolated code-only build emits public font/asset warnings because full assets are deliberately not copied into the Sprite. It does not certify a playable full build.

## Device and visual evidence still needed

**[Unverified]** Actual physical iPhone Safari frame time, p95, triangles, draw calls, thermal load, context-loss recovery and gameplay traversal. This sprint adds hero vehicle meshes, procedural CPU texture initialization and transparent puddles; no claim of under-15%-frame-time-regression is made without paired device readings. Browser render comparison is not established. No GTA VI native-console parity is asserted.

## Next gated sequence

1. Transfer or mount the complete verified `public/` asset tree to an isolated game build and run load/gameplay/browser checks; retain music privately and avoid publishing it externally.
2. Capture matched five-angle reference screenshots and test a 10-minute physical iPhone Safari run on Low/Medium/High, including p95 frame time, FPS, draw calls, triangles, resolution and thermal behavior.
3. If budget holds, advance toward the document's targets in order: source-matched hero architecture and photogrammetric/PBR material authoring; street-scale prop variation and decals; quality-gated lighting/reflection approximations; realistic car exterior/animation; locomotion/IK and weather response; interiors/NPC traffic only once road/door collision works. These are **proposals, not implemented claims**.
4. Staging is retained; production stays Build 003A. Any staged candidate must first reconcile live source SHA, ensure rollback/assets and receive a distinct deployment authorization. No spending beyond the already user-approved single Sprite and no new services.

## Scope and copyright

"GTA VI" is an **aesthetic benchmark**, not a claim of using or copying Rockstar code, graphics or licensed assets. The document describes aspirations including global illumination, millions of particles, destruction, advanced NPCs and whole-city interiors. Those systems are **not implemented** by this sprint and are not technically appropriate to enable simultaneously in mobile Safari. Accurate place-specific materials and performance-graded geometry take precedence.
