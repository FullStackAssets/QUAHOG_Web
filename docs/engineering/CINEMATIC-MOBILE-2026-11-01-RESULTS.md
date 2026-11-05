# The Narrows — cinematic mobile stability follow-up (November 1, 2026)

**Owner:** ChatGPT, this QUAHOG project conversation. **Source:** isolated candidate, not a deployed change. **User release instruction:** accepted Blizzard staging and production Build 003A remain unchanged. No Muse, deployment, spending, or externally hosted changes performed.

## Source identity and boundaries

- Input was the complete `QUAHOG_Cinematic_Mobile_Merged_Source_2026-11-01.zip`, SHA-256 `49bd9fbada0d3b4592d5be5471c69e3d586c130305510e6e043cf29ceca31112`, embedding cinematic candidate `7c6ce35e05e697f9f285682de6fa3dc354b24e26` over the previously protected Blizzard mobile source `e824028f51cffe0559c064df8e96e212b5ad5d74`.
- **1,195 source files** extracted and checked against archive SHA-256 manifest. The source contains the existing GIS/roads, missions, vehicles, physics, radio, saves, and private audio files.
- See companion preservation manifest: **1,001 public assets**, including **26 music files**, plus **24 protected application files** match the original cinematic source byte-for-byte.
- Changes are deliberately confined to procedural architectural/rooftop detail, transient geometry cleanup, low-preset performance and tests. No new map/asset source, collision layer, mission content, save format, audio or weather system.

## Completed modifications

1. **Visible-detail budget:** `generateArchitecturalDetails` accepts an optional allowed-kind set; excluded kinds no longer consume Low's visible decorative instance budget. Existing calls without the filter remain behavior-identical. Low allows only doors, storefronts and awnings.
2. **Rooftop LOD:** new deterministic `selectRoofFixtures` selects 10 / 32 / 90 fixtures per streamed tile for Low / Medium / High. Selection is stable across tile-file record reordering and nested (Low is a subset of Medium, Medium a subset of High). Nonfinite/invalid polygons and out-of-range building heights are excluded. No rooftop instanced mesh is created for empty results. Rooftop cast shadows are reserved for High.
3. **Streaming geometry lifetime:** temporary extrusion and coping/hip roof geometries are disposed after merging. Merged geometry created outside JSX is explicitly disposed when its corresponding React tile unmounts (or changes buildings), reducing CPU/GPU retention while driving across streamed tiles. Existing Rapier trimesh colliders remain unchanged.
4. **Tests:** two allowed-detail-budget cases and four new rooftop fixture cases, including cap, ordering invariance, invalid geometry and GIS immutability.

## Evidence available here

- [Verified locally] `node --experimental-strip-types --test scripts/tests/*.test.mjs`: **24 checks pass, zero fail** (13 architectural, seven Blizzard, four rooftop). Exact terminal log accompanies package.
- [Verified locally] TypeScript 5.6 parser: **143 TS/TSX source files, zero syntax errors**. This is **not** type checking.
- [Verified locally] Applied the new Low policy to the **954 existing public building tiles**, containing **68,482 raw building records**. No missing tile files. Every tile remained within **12 visible architectural pieces** and **10 rooftop fixtures**. The maximum measured synchronous Node generation time in that run was **3.13 ms per tile**; that does not measure GPU rendering or mobile FPS.
- [Verified locally] `git diff --check` clean; all preserved game content hashes match the imported baseline.
- [Blocked] `npm ci` failed while fetching registry tarballs with `EAI_AGAIN`; the npm CLI also emitted an exit-handler error. Dependencies are unavailable in this execution environment. The full Vitest suite, React/Three runtime and Vite/TypeScript production build **have not passed in this follow-up**.
- [Unverified] Browser-generated screenshots, iPhone Safari FPS, p95 frame time, GPU draw calls, triangles, thermal behavior, multitouch and 15% sustained frame-time gate. Zero source changes are claimed deployed to staging or production.

## Exact next gate

In this same QUAHOG conversation, with an authorized build runtime that can fetch the pinned dependencies: verify archive hash and result commit, run `npm ci`, `npm test`, `npm run test:blizzard`, `npm run build`; inspect the Johnny Cake Hill–Water Street route and camera/Bethel collisions, then test 10 minutes on iPhone Safari at the same device/preset against the accepted staging build. Verify FPS, frame-time p95, draw calls, triangles, touch controls, radio/music, saves, and recovery after background suspension. Do not deploy until explicitly authorized; retain both the current staging and Build 003A rollback.
