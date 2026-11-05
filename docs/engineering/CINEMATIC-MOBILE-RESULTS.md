# QUAHOG / The Narrows: selective cinematic merge, November 1, 2026

Owner: ChatGPT Work candidate integration. This work is **not deployed**. Preserve the previously accepted Blizzard staging build and production Build 003A. Muse remains deployment/rollback owner; Nic approves major production releases.

## Verified inputs

- Base file: `Narrows_Blizzard_Mobile_Merged_Source.zip`, SHA-256 `94631c17c6cffb7c095e32071aa03ac97e276d97363856b692e697aaa8d562a2`; embedded `release.json` reports result commit `e824028f51cffe0559c064df8e96e212b5ad5d74`. This ZIP is a previously generated source snapshot, **not** a direct authoritative VM checkout.
- Donor: `QUAHOG_2026_Cinematic_Visual_Pass_v01_Patch.zip`, SHA-256 `7e870ba885a1d43798dd651df2330657c963da69f2f6b3a6bad2f07ba4e60c1f`. Donor was based on an earlier Blizzard source, and its own report expressly did not claim typecheck/build/iPhone acceptance.
- Donor reference `GTA6_VISUAL_PASS_2026(1).md`; original assets not copied, licensed Rockstar content not used.
- The current source is an **isolated local candidate**; no remotes, deployment or production server access have been assumed.

## Implemented selectively

1. `src/world/architecturalLayout.ts`: deterministic frontage-facing placement for ground-floor storefronts, residential doors, canopies, shop sign plaques, fire escapes and roof tanks. Longest usable footprint edge is an approximate façade direction, not surveyed street-facing verification. Invalid/nonfinite GIS points are ignored. Limit is **total decorative pieces per tile**, not merely selected buildings; preserve complete visual groups when the budget is reached.
2. `src/world/ArchitecturalDetails.tsx`: geometry instanced by part type. Detail-budget limits are 12 / 34 / 70 for Low / Medium / High respectively. Low uses only doors, storefronts and canopies, with no new decorative shadow casting. Mount only on collision-near streamed tiles; decorative geometry is not included in Rapier colliders.
3. `src/world/StreamingBuildings.tsx`: integrate those near-tile details and varied, deterministic rooftop HVAC proportions, rotations and colors. **Kept** bounded requests, abort-on-unmount, generation checks, cache eviction, viewer-following tile radius, GIS replacements and old collision logic from the newer mobile base. The old donor version of this file was not wholesale copied.
4. `src/world/textures.ts`: selected 256×256 brick/sash/emissive façade albedo improvements only. Retained concrete sidewalk, ground, wet-road, snow, and other existing texture functions. Texture maps remain singletons. The new façade map is procedural and shared, not unique to each real building.
5. `scripts/tests/architectural-visuals.test.mjs`: eight donor architectural tests plus three tests for strict phone-budget limits, nonmutation of footprints and invalid input handling.

## Regression preservation

- No changed files in camera/Rapier sphere sweep, NPC building avoidance, Bethel clapboard/collision, GIS duplicate removal, fast-travel point, touch/HUD, road/sidewalk winding, mission progress, save/storage, FrameDriver, phone graphics budgets, snow/vehicle handling.
- `docs/engineering/CINEMATIC-PRESERVATION.json` establishes matching SHA-256 for **1,001 public files** (including **26 music files**) and **24 key source files** against the recovered mobile source. Nothing here is proof that the production VM contains these same bytes.
- The landmark collision model and mission/character controllers are unchanged. The scenic architecture is **decorative only**; there are no new walkable roofs or shop interiors.

## Evidence and exclusions

- [Verified locally] `node --experimental-strip-types --test scripts/tests/architectural-visuals.test.mjs scripts/tests/blizzard-2026.test.mjs`: **18 passed, zero failed** (11 architectural, 7 blizzard).
- [Verified locally] Global TypeScript parser: **142 TypeScript/TSX files, zero syntax errors**. Parsing is *not* a typecheck.
- [Verified locally] `git diff --check` clean. Reproducible patch and protected source manifest accompany delivery.
- [Blocked] `npm ci` could not fetch dependencies in this runtime; the offline attempt returned `ENOTCACHED` for `zustand-4.5.5.tgz`. **No full TS typecheck, Vitest suite, Vite build or browser screenshot was run here.** Earlier mobile build results may not be treated as results for these new changes.
- [Unverified] Actual iPhone Safari FPS, frame time p95, memory, thermals, texture upload, and the <15% sustained frame-time regression gate. No production or staging changes have been made.

## Next exact acceptance actions

In an **isolated matching source checkout**, run `npm ci`, `npm test`, `npm run test:blizzard`, `npm run build`. Then capture paired daytime/Blizzard views on identical Johnny Cake Hill and Water Street routes and inspect asset placement/roof clipping. Compare measured draw calls, triangles, frame time p95 at each Low/Medium/High preset. On actual iPhone Safari verify at least a sustained 10-minute walk/drive, pause/resume, rotation, mission checkpoint, Bethel fast travel and no >15% sustained frame-time regression. Record device/OS/preset and served bundle hash. Muse should only stage after checking exact VM ancestry and preserving the accepted current staging rollback. Nic separately decides production promotion.
