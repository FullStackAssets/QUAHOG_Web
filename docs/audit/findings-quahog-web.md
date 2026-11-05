# Audit: QUAHOG_Web (Mount Hope vertical slice)

**Auditor:** subagent, read-only audit
**Date:** 2026-10-18
**Source path:** `~/workspace/quahog-web/QUAHOG_Web/QUAHOG_Web` (extracted from QUAHOG_Web.zip; parent `quahog-web/` also holds a 42MB `QUAHOG_Web.zip` copy)
**Evidence labels:** VERIFIED = I ran/saw it myself this session · REPORTED = prior agent's claim (2026-09-20), not re-proven · INFERRED = code presence only, not tested at runtime

## 1. Repo / git state

- VERIFIED: **not a git repository** (no `.git` in the tree; `git log`/`git status` fail with "not a git repository"). This is a zip-extracted snapshot. No commit history, branches, or remotes available to inspect.
- VERIFIED: `.gitignore` exists (38 bytes). `dist/` is **committed into the snapshot** (timestamped Sep 20 20:14, same as the extract), along with `node_modules/`.
- `package.json`: name `quahog-web`, version `0.0.0`, private, ESM. Description: "The Narrows — web 3D open-world crime game (Three.js / R3F) on the real Massachusetts South Coast."

## 2. Stack (VERIFIED from package.json)

| Package | Version |
|---|---|
| three | 0.169.0 |
| @react-three/fiber | 8.17.10 |
| @react-three/drei | 9.114.3 |
| @react-three/rapier | 1.5.0 |
| @react-three/postprocessing | ^2.16.3 (→2.16.x) |
| postprocessing | ^6.36.4 |
| three-mesh-bvh | ^0.7.8 |
| 3d-tiles-renderer | ^0.4.28 |
| zustand | 4.5.5 |
| react / react-dom | 18.3.1 |
| vite | 5.4.10, typescript 5.6.3, vitest ^2.1.9 |
| @vercel/blob | ^0.27.0 |

Scripts: `dev` (vite), `build` = `tsc && vite build`, `predev`/`prebuild` = `node scripts/gen_manifests.mjs` (regenerates radio manifests from `public/music`), `test` = `vitest run`.

## 3. Source tree (VERIFIED)

~110 source files. Layout:
- Entry/UI: `src/main.tsx`, `App.tsx`, `Experience.tsx`, `HUD.tsx`, `Minimap.tsx`, `store.ts`, `input.ts`, `shared.ts`, `game.ts`, `economy.ts`, `mission.ts`, `race.ts`, `quality.ts`, `storage.ts`, `places.ts`
- `src/actors/`: `Player.tsx`, `Car.tsx`, `FollowCamera.tsx`, `Boat.tsx`
- `src/audio/`: `Radio.tsx`, `radioEngine.ts`, `sfx.ts`, `vo.ts`
- `src/ui/`: `StartMenu`, `PauseMenu`, `CharacterMenu`, `MusicPlayer`, `Toasts`, `BigMap`, `DebugStats`, `ErrorBoundary`, `TouchControls`
- `src/world/`: ~60 components — Roads, Buildings (+StreamingBuildings tile loader), Ground, Water, Landmarks, Heroes (hero buildings), Police, StreetLife (peds/traffic), Race, MissionRunner, Consequence, Respray, Safehouse, Marina, Piers, HurricaneBarrier, Rail, Bridges, NeonSigns, Graffiti, Gull/ambient, Weather (Rain, DayNight, EnvLight), Effects, Hazards, Pickups/HealthPickups/Collectibles, SkidMarks, Tracers, Impacts, etc.
- `src/earth/`: a **second, parallel build** — photoreal world via Google 3D Tiles (`EarthApp.tsx`, `PlayWorld.tsx`, `Vehicles.tsx`, `bvh.ts`, `follow.ts`, `playState.ts`), served from `earth.html`.
- `src/__tests__/`: 5 test files — economy, game, mission, quality, race.

## 4. Tests — re-run (VERIFIED)

Command: `npm test` (vitest 2.1.9, run mode), `node_modules` already present.
Result: **29/29 pass** across 5 files (economy 6, game 7, race 6, mission 5, quality 5), ~5s. Matches REPORTED count.

## 5. Build — re-run (VERIFIED)

Command: `npm run build` (= `tsc && vite build`, with `prebuild` manifest regen).
Result: **SUCCESS, exit 0. tsc type-checks clean** (no type errors emitted).
- Prebuild regen found 16 radio clips across 4 stations (mare 3, mare/vo 1, rage/jingles 6, rage/vo 1, whale 5; anvil/rage tracks 0 — README/MUSIC.md document synth fallback).
- 828 modules transformed; built in 33.7s.
- Note: build prints `fatal: not a git repository` from `vite.config.ts`'s build-stamp helper (falls back to `git rev-parse --short HEAD`) — non-fatal, build proceeds.
- Note: Rollup warns `Circular chunk: vendor -> vendor-r3f -> vendor` (manualChunks tuning advised); also `vendor-rapier` chunk is 2.08 MB (768 KB gzip) — Rapier WASM dominates JS payload.

### Bundle / dist size (VERIFIED)

`dist/` = **58 MB** total, matching REPORTED. Breakdown:
- `dist/music` 36 MB (16 committed MP3s, largest ~4.1 MB)
- `dist/tiles` 14 MB (streaming building-block tiles `b_*.json`)
- `dist/slice-newbedford.json` 4.2 MB (OSM blockout)
- `dist/assets` 3.9 MB (JS: rapier 2.08 MB, three 858 KB, vendor 439 KB, react 238 KB, r3f 179 KB, main 186 KB, Radio 54 KB)
- `dist/models` 428 KB (CesiumMan.glb), misc JSON overlays ~200 KB

## 6. Coordinate conventions (VERIFIED)

`src/slice.ts` header documents: slice-local `[east, north]` meters, origin = bbox center. In 3D: east→+x, north→−z, up→+y.

```ts
export const toWorld = (p: [number, number], y = 0): [number, number, number] =>
  [p[0], y, -p[1]];   // src/slice.ts:56
```

Usage of `toWorld` in code (VERIFIED via grep):
- `Landmarks.tsx`, `SeamensBethel.tsx`, `Steeples.tsx` — landmark/marker placement.
- **NOT** used by Roads/Buildings/Water/Piers/Rail/Colliders: those convert inline, e.g. `const x1 = ax, z1 = -an` in `roadSamples.ts` (with the comment `// world: z = -northing`), `az = -path[i][1]` in `Piers.tsx`. Same convention, duplicated math rather than shared helper. Convention is consistent across both paths; the duplication is a maintainability smell, not a bug.
- Minimap (`Minimap.tsx`) works with world coords and rotates by heading ("north up" comment) — INFERRED correct, not verified on screen.
- Colliders: building convex-hull colliders generated from slice footprints under the same east/north→x/−z mapping (REPORTED by README as convex-hull colliders; INFERRED from StreamingBuildings/Buildings code that colliders inherit the same transform).

## 7. Game systems inventory (all INFERRED — code exists, not playtested)

| System | Implementing files |
|---|---|
| Missions | `src/mission.ts` (state machine), `src/world/MissionRunner.tsx` |
| Police / wanted heat | `src/world/Police.tsx` (spawns cop cars at heat ≥3, PD beacon), `game.ts` heat stat |
| Economy (cash, business income) | `src/economy.ts`, tested in `economy.test.ts` |
| Racing | `src/race.ts`, `src/world/Race.tsx` |
| Radio (4 stations: whale, mare, rage, anvil + talk VO) | `src/audio/Radio.tsx`, `radioEngine.ts`, `sfx.ts`, `vo.ts` |
| Touch controls (mobile) | `src/ui/TouchControls.tsx` (271 lines, wired in `App.tsx`) |
| Physics | `@react-three/rapier` (RigidBody/colliders), `three-mesh-bvh` for tiles build |
| Driving / enter-exit car | `src/actors/Car.tsx`, `src/actors/Player.tsx`, `E` key in `input.ts` |
| NPCs / traffic | `src/world/StreetLife.tsx` (358 lines, kinematic peds + road-network traffic), `Character.tsx`, `ModelCharacter.tsx`, `Heroes.tsx` |
| Persistence | `src/storage.ts` (guarded localStorage helpers — explicitly handles private-mode Safari) |
| Wanted consequences / respray | `src/world/Consequence.tsx`, `src/world/Respray.tsx` |
| Minimap / big map | `src/Minimap.tsx`, `src/ui/BigMap.tsx` |
| Quality scaling / debug | `src/quality.ts`, `src/ui/DebugStats.tsx` |
| Day/night, weather, harbor | `DayNight.tsx`, `Rain.tsx`, `Water.tsx`, `Waterfront.tsx`, `HarborProps.tsx`, `HurricaneBarrier.tsx`, `Marina.tsx` |

## 8. Asset provenance (VERIFIED from docs/files; licenses per project docs)

- **OSM data**: `slice-newbedford.json` + overlay JSONs generated from OpenStreetMap (attribution "© OpenStreetMap contributors, ODbL" in README). Generator `../quahog-project-files/mapdata/make_slice.py` is referenced but NOT in this snapshot (external path).
- **CesiumMan.glb** (428 KB): no provenance note in the repo; filename matches the Cesium sample avatar (INFERRED — verify license before shipping; Cesium sample assets are typically CC-BY 4.0).
- **Textures**: procedural (`src/world/textures.ts` — asphalt, cobble, noise) — no third-party texture packs (VERIFIED, no binary textures in public/).
- **Audio**: 16 committed MP3s in `public/music/`. MUSIC.md says tracks were generated by ElevenLabs Music ("royalty-free instrumental tracks") via `scripts/gen_music.py`; jingles have names like "Buddy Mello Radio Jingle" (INFERRED: AI-generated, station branding). No license files committed — for ElevenLabs Music output, commercial-use terms live in the ElevenLabs account/plan (INFERRED — flag for legal check before monetized release).
- **Aerial imagery (optional)**: Google Static Maps signed server-side, or direct Esri World_Imagery tile URL in `AerialGround.tsx` (free public endpoint, attribution required — no attribution string visible in the component; INFERRED minor gap).

## 9. Embedded secret scan (VERIFIED — patterns only, no values echoed)

- `grep` for Google (`AIza…`), Stripe/ElevenLabs-style secret prefixes across `src/`, `api/`, `scripts/`, configs: **no secret key values found in frontend source.**
- Matches found only in `api/tts.ts` and `api/music-webhook.ts` — these matched the regex on *names*: they read `process.env.ELEVENLABS_API_KEY`, `process.env.ELEVENLABS_WEBHOOK_SECRET` etc. — env-var references, server-side (`api/`, never shipped to browser). **No embedded keys.**
- `ENV.md` lists required secrets as placeholders (`<redacted>`) and documents them as Vercel env vars — nothing committed.
- ElevenLabs *voice IDs* (`nUEpF21E0nXsKMw4L4CS`, `SA7eD52NRr8WAehitVt1`) are committed in `ENV.md` — these are public identifiers per the project's own docs, not secrets.
- **Caveat**: `earth.html` photoreal build takes the Google Map Tiles key via `?key=` query param, scrubbed from the address bar after read (persisted to localStorage per `EarthApp.tsx`). Any deployed preview URL shared with `?key=` in it would leak the key (INFERRED risk, standard practice concern).

## 10. Deployment readiness — why it likely was never deployed (INFERRED)

Nothing in the code *prevents* a Vercel deploy (`vercel.json` is configured: framework vite, install `npm install`, build `npm run build`, output `dist`). Likely reasons it stayed local:
1. **No env vars configured anywhere** — `GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_URL_SIGNING_SECRET` (satellite ground), `ELEVENLABS_API_KEY` (VO/music gen). All have graceful fallbacks (procedural ground, synth radio, Web-Speech VO), so the deploy would "work" but ship the degraded experience.
2. **Photoreal direction is flagged unstable by its own ROADMAP.md**: GPU-memory crashes, per-frame tile raycasts, per-frame Vector3 garbage — mitigation partially applied (errorTarget, dpr cap, context-loss guard), several items still open. The stylized build is the stable one.
3. **58 MB dist** (36 MB music) — fine on Vercel but slow first paint on mobile; no code-splitting of routes, circular chunk warning, 2 MB Rapier WASM chunk.
4. **No backend**: persistence is localStorage only; high scores/economy don't sync. Multiplayer none.
5. **Name/legal**: README itself notes the project name still needs to change off "Quahog"; CesiumMan + ElevenLabs-music licensing not documented for commercial use.
6. Minor: build stamp degrades without git (cosmetic); no PWA manifest/service worker in `public/` (VERIFIED: none present), no `theme-color`/`apple-touch-icon` in `index.html`.

## 11. Mobile-readiness read (iPhone Safari) — honest assessment

- **What exists**: `TouchControls.tsx` is wired into `App.tsx` (INFERRED functional on-screen controls); viewport meta with `user-scalable=no`; localStorage access guarded for private-mode Safari; `dpr={[1,1.5]}` cap on the tiles build; audio gated on user gesture (per ROADMAP).
- **What I could not verify**: no device test, no simulator run, no Lighthouse/perf trace in this audit. Nothing in the repo is evidence of a real iPhone test pass.
- **Concrete risks**: (a) ~4 MB JS + 2 MB Rapier WASM + 4.2 MB slice JSON parse on first load — acceptable on Wi-Fi, heavy on cellular; (b) 36 MB of MP3s stream only when radio plays, fine, but no preload strategy documented; (c) Web-Speech VO fallback is "unreliable/often silent on mobile" per ENV.md's own note; (d) photoreal build streams Google 3D Tiles — GPU-memory crashes are the documented failure mode and iPhone GPUs are the most constrained target; (e) Rapier WASM + React 18 on iOS Safari generally works but jank risk is unmeasured.
- **Verdict**: the *stylized* build is plausibly iPhone-playable as a tech demo (touch controls exist, no native-only APIs), but shipping quality would need a real device pass: load-time budget, thermal throttling behavior during physics + 3D render, touch-control ergonomics, and the audio-unlock flow. The *photoreal* (`earth.html`) build should be treated as desktop-only until its ROADMAP stability items are closed.
