# QUAHOG Production R4 source candidate

**Base:** complete QUAHOG R3 Visual Fidelity, November 2, 2026. This is a source/archive candidate, not a live deployment or proof of photorealistic acceptance.

## Reconciliation and preservation

- R3 includes the 344 pack GLBs and original P010 texture collection as well as the seven 512px production surface PNG maps, GIS, missions, music, physics, parked vehicles, weather and on-demand Meshopt GLB loader.
- No original R3 content paths have been removed or replaced wholesale. This patch updates select rendering and safety files; all assets remain packaged byte-identical.
- R3 already includes architecture/road PBR implementation and selected GLB placements. The more basic `feat/photorealism-mobile-phase1` PR #2 is **not an interchangeable upstream replacement**. Do not merge the branches by copying entire files into R3. Reconcile differences per function and run build/visual gates.
- GitHub's main branch and the actual live production source have not been independently reconciled in this container. Production must not be overwritten blindly. The supplied preflight allows **exact per-file R2/R3/R4 known hashes**, but this is not proof of the current live version's ancestry.

## Implemented R4 changes

1. **Fix R3's TypeScript semantic blocker:** `Tile()` referenced undefined `quality`; R4 derives it from `useGame` inside the tile.
2. **Physically plausible water:** zero-metalness, IOR 1.333 water with quality-dependent clearcoat; high-quality-only 20 Hz CPU wave geometry, opaque lower-tier water to reduce overdraw.
3. **Asset memory:** bound completed GLB promise cache at 96 entries without evicting in-flight models. Retain the original runtime fallback and identity validation. Cache trimming does not prove GPU texture/geometry residency or GPU memory reduction on every browser.
4. **World resource lifetime:** dispose temporary merged geometry and released tile/road/water geometry on lifecycle change; reduce dynamic rooftop instance counts in mobile presets.
5. **Rendering:** slightly reduce emissive facade intensity and make decorative glass relief opaque/dielectric for fewer transparent layers.
6. **Device measurement:** opt-in `?perf=1` overlay showing frame cadence FPS, average/p95/worst frame time, approximate GL draw calls, and triangles. The displayed frame cadence is **not GPU timer telemetry**; use Xcode Safari/Web Inspector and thermal checks for GPU/long-session confirmation.
7. **Lineage safety:** update existing preflight scripts to accept exactly known immutable R3 predecessor hashes and fail closed on unknown live changes, including newly modified protected files.

## Source-based checks that must run before deployment

```sh
node --experimental-strip-types --test scripts/tests/*.mjs
npm ci --no-audit --no-fund
npm run build
npm test
npm run test:production-assets
npm run test:blizzard
node scripts/production-fulltree-preflight.mjs --live-dir /actual/current/production/source
node scripts/production-preflight.mjs --live-dir /actual/current/production/source
```

The package's Node source-level tests and TypeScript parsing may run offline. A successful full semantic TS/Vite build is **not** established until locked dependency installation succeeds in a networked environment. If either preflight flags an unknown difference, stop and merge that difference deliberately.

## Real-device visual acceptance (before any live cutover)

Use the same saved camera positions, time-of-day and quality setting for before/after captures:

1. Seamen's Bethel and adjacent historic streets: compare facade relief UV registration, window z-fighting, building outline/roof, signage and navigation.
2. Dense downtown block in daytime and rain: inspect asphalt albedo, normal roughness, metalness, crosswalks, horizon and facade frame illumination.
3. Harbor-facing waterfront at noon, dusk and fog: check correct waterline, boat position, water glints and specular continuity with docks. Do not confuse compositing with raytraced reflection.
4. During car entry, reversing, parked truck pass and first-person view: camera clips, physics contact, mission routes and objective distance.
5. During Blizzard weather: snowbanks, street visibility, snow physics, snowfall, environmental sound and overlay legibility.
6. iPhone Safari: run `?perf=1` Low/Medium/High, record 60-second cold-start and 10-minute warm/thermal performance, FPS median/p95 frame time, draw calls, triangles, visible GLB counts, load failures, memory warning/crash and context loss. Compare against live baseline. Regressions fail the gate; no fabricated target throughput.

## Deployment governance

No staging deployment or live cutover performed. Retain immutable current production source/data backups and an executable rollback. Never use a recursive delete or replace private music directories. The full source ZIP includes preserved music and should remain private. Only deploy after verified production-source ancestry, full clean build, actual GLB Meshopt decode in Safari, and physical device QA.
