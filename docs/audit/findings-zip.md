# Audit: Narrows Waterfront Implementation (zip archive)

*Auditor (read-only). Session: 2026-10-18. All claims labeled VERIFIED / REPORTED / INFERRED.*

## 1. Archive integrity — VERIFIED

- Extracted to `~/workspace/narrows-audit/zip-extract/`. Top-level: `START-HERE.txt`, `SOURCE-COMMIT.txt`, `TXT-FILE-MAP.csv`, `SHA256SUMS.txt`, `project/`, `site-build/`, `code-txt/`.
- `SHA256SUMS.txt`: **290/290 entries verify OK** (`sha256sum -c` run from the extract dir; absolute paths in the file matched the extracted locations).
- `TXT-FILE-MAP.csv`: 120 rows mapping `project/src/**` → `code-txt/**`. Independently re-hashed all 240 files against the CSV's SHA-256: **120/120 pairs match**, so code-txt is a byte-exact copy of the source.
- `SOURCE-COMMIT.txt` contains a single 40-hex string: `e8b88c8ece536cb3d86d09fc6edc2ab4582f9dad` (VERIFIED content; provenance of the commit itself is REPORTED — can't verify a commit I can't see).
- `START-HERE.txt` says: source commit above; live site `https://narrows-waterfront-study-oct18.blaizexb.chatgpt.site`; earth viewer at `/earth.html`; run with Node 20+ via `npm ci && npm test && npm run build && npm run dev -- --host 0.0.0.0`; `site-build/` is a ready-built static site; default scene needs no API key; earth viewer needs a user-supplied Google Maps browser key (Map Tiles API + billing). Validation claim: "39/39 tests passed… TypeScript and Vite production build passed… Actual iPhone rendering, touch behavior, sustained FPS, and live Google tile access remain unverified." — the "39/39" and build-pass claims are REPORTED (ChatGPT's own words in the archive), the iPhone-unverified disclaimer is likewise quoted.

## 2. Tech stack — VERIFIED (from `project/package.json`)

- **Waterfront study (index.html → `src/realism/main.ts`)**: plain **imperative Three.js 0.169.0** — no React, no R3F, no drei. Vite 5.4.10, TypeScript 5.6.3.
- **Google tiles viewer (earth.html → `src/earth.tsx`)**: React 18.3.1 + **@react-three/fiber 8.17.10** + **3d-tiles-renderer ^0.4.28** + drei 9.114.3.
- Also present in deps: @react-three/rapier 1.5.0, three-mesh-bvh, zustand, postprocessing — these serve the legacy game code (see §6).
- Lockfile `package-lock.json` shipped; deps pinned/caret-mixed.

## 3. What the "waterfront study" is built from — VERIFIED (read `src/realism/main.ts` 202 lines, `geometry.ts` 12 lines)

- **Footprints**: `public/realism/block.json` — "Johnny Cake Hill · New Bedford", source OpenStreetMap: **47 buildings (extruded from real footprints), 484 road segments**. Bounds/xz in meters. Note in the file: "Real footprints and street coordinates; detailed model replacements are illustrative reconstructions."
- **Buildings**: footprint polygons → `THREE.ExtrudeGeometry`, brick or clapboard PNG facade textures + gray roof material, UVs assigned per-face (roof vs wall). 4 largest footprints get "hero" GLB replacements (`mill.glb`, `triple.glb`, `store.glb`, `diner.glb`) scaled to fit; cars (`sedan.glb`) and lamps (`lamp.glb`) placed along a road. GLBs/assets: "reused from supplied The Narrows / QUAHOG_GODOT1 archive" (CREDITS.txt, VERIFIED). HDRI: Poly Haven Spruit Sunrise 1k, CC0, self-hosted, used via PMREM as scene environment.
- **Roads**: ribbon geometry built by `ribbon()` (unit-tested for both axis directions and diagonals); roads/pavements/paint markings merged into 3 batched meshes (`mergeGeometries`). Asphalt texture + **procedural** DataTexture normal map (sine/cosine noise — not scanned).
- **Lighting**: directional sun + hemisphere + `three` Sky object; two presets (Late sun / Overcast) altering intensity, color, turbidity, exposure, fog; **wet-pavement slider** (0–1) drives `roughness`/`clearcoat` on a MeshPhysicalMaterial road. Tone mapping ACESFilmic.
- **Water**: 600×400 plane with MeshPhysicalMaterial + `onBeforeCompile` vertex-wave animation (sine/cos displacement + adjusted normals). Illustrative harbor, not bathymetry (README says so — VERIFIED).
- **Performance architecture**: NO LOD system, no streaming in the study. Draw-call control comes from: 3 merged road meshes, 2 `InstancedMesh` (40 tree canopies, tree trunks) + instanced roof clutter boxes, merged per-material building meshes. Phone profile: DPR cap 1, 1024 shadow map, 18 trees/2 cars visible; Desktop: DPR 1.5, 2048 shadows, 40/4. Live FPS + draw-call readout on screen; `__NARROWS_REALISM__` debug handle exposes `fps/drawCalls/triangles/profile/wet/overcast`. WebGL context-loss shows a "reload" message rather than recovering.
- Nothing here is photoreal: facades are repeating brick/clapboard PNGs (INFERRED from file names + texture tiling code; I did not render).

## 4. The "Mount Hope photoreal" (Google 3D Tiles) viewer — VERIFIED (read `src/earth/EarthApp.tsx` 301 lines, `GoogleTilesAuth.tsx` 40 lines)

- R3F Canvas + `TilesRenderer` from 3d-tiles-renderer, Google Photorealistic 3D Tiles via `GoogleCloudAuthPlugin` (apiToken passed from React prop). Crash-fix patch in the archive: a local `GoogleTilesPlugin` subclass whose `dispose()` is safe before init and idempotent; plugin args memoized with `useMemo` so parent renders don't restart the tile session; `errorTarget={32}` preserved; error screen links back to the key-free study and does NOT diagnose billing/memory from an exception.
- **Auth flow (no bundled key — VERIFIED via grep)**: key comes from `?key=` URL param (then persisted to `localStorage` under `mh.googleMapsKey` and **scrubbed from the address bar** via history.replaceState), or `VITE_GOOGLE_MAPS_API_KEY` at build time, or localStorage. Without a key the viewer shows a notice — no tiles fetched, no paid calls possible.
- 4 spawn spots: New Bedford/Seamen's Bethel (anchored to the local OSM slice), Battleship Cove, Lizzie Borden house, Fall River downtown. Orbit + third-person "play" modes, globe controls, weather cycle (clear/cloudy/rain, 45s interval), `TilesBVH` for collision raycasts, attribution overlay.
- The old test-title "Mount Hope" is legacy naming; coordinates are New Bedford/Fall River (41.636, -70.9205 etc.) — VERIFIED from SPOTS constant.

## 5. Tests — VERIFIED (file listing + test-count grep), claims vs reality

- 7 test files: `earthTiles` (4), `economy` (6), `game` (7), `mission` (5), `quality` (5), `race` (6), `realismGeometry` (2). **Total `it(` blocks counted in shipped source: 35.**
- Discrepancy: docs (START-HERE.txt, README) claim **"39/39 tests passed"**. Shipped source contains 35 test blocks — 4 fewer than claimed. The 4 `earthTiles` lifecycle regressions are present and account for the crash fix; the missing 4 are unaccounted for (possibly tests removed after the claimed run, or claim inflation). **Do not repeat the "39/39" claim without this caveat.**
- Test scope per source comments: pure logic + plugin lifecycle in Node with mocked GL, "No WebGL rendering or HTTP." The Google tiles viewer is never exercised against the network. **Suite was NOT re-run by me** (read-only constraint — running it needs `npm ci`, network installs, and writes node_modules).

## 6. Built site output — VERIFIED

- `site-build/` (24 MB): `index.html`, `earth.html`, `assets/` (3 bundles: `main-D4-gExYU.js` ~40 KB, `earth-DdYZQI8p.js` 540 KB, `GLTFLoader-tzS4ldOi.js` 734 KB), `models/CesiumMan.glb` (428 KB), `realism/` (23 MB: GLBs, PNGs, HDRI, `block.json`, `CREDITS.txt`), `slice-newbedford.json`. All asset refs are relative (`./assets/...`, `base: './'`) — genuinely deployable as a static HTTPS upload (VERIFIED).
- Grep of built JS for embedded `AIza…` keys: **none found** (VERIFIED).

## 7. Secret/API-key scan — VERIFIED

- Scanned all frontend source + built bundles for Google `AIza` keys, `sk_live/sk_test`, and `api_key` assignments. **No embedded secrets found.** Only false positives: spoken dialogue lines in `radioEngine.ts` ("what's the secret?") and comments ("the secret doesn't linger in history", "Maps browser key").
- Google Tiles auth design is sound for a client-side viewer: user-supplied browser key (referrer-restricted per README), scrubbed from URL, localStorage only. Risk note (INFERRED): nothing stops a viewer from pasting an unrestricted key — that's Google-console hygiene, not a code defect.

## 8. Relationship to codebase #1 (QUAHOG_Web at `~/workspace/quahog-web/`) — VERIFIED / INFERRED

- **Fully separate, not a fork.** No shared source files, no `git` history linking, different package identity (`narrows-waterfront-study`), different entry points.
- Two references only, both in the *dead* legacy game code (see §9): a comment citing `QUAHOG_Web/ROADMAP.md §3 "per-frame garbage"` and a console tag `[quahog]`. INFERRED: ChatGPT read the QUAHOG_Web roadmap doc and borrowed a perf idiom (module-scope scratch vectors), not code.
- Art assets were lifted from the `QUAHOG_GODOT1` asset archive (CREDITS.txt, VERIFIED), not from QUAHOG_Web.

## 9. Important structural gotcha — VERIFIED

- The archive contains a **third codebase**: a full R3F driving-game world — `src/App.tsx`, `src/Experience.tsx`, 60+ files in `src/world/` (Buildings with rapier colliders + 160 m spatial-cell chunking + 1050 m draw-distance culling, traffic, police, missions, audio, HUD). **It is NOT in the Vite build inputs** (`rollupOptions.input` = `index.html` + `earth.html` only; `src/main.tsx` that mounts App is unreferenced). It's dead/reference code — including the only distance-culling and cell-chunking the repo has. The shipped "study" has none of that.
- Effect: the built product is a two-page demo (one-block viewer + key-gated tiles viewer), not the game the source tree suggests.

## 10. Honest read: better iPhone-Safari foundation than a fresh R3F app?

**For runtime leanness, yes; as a foundation, only with eyes open.** The study's stack choice is the right instinct for iPhone Safari: plain Three.js with no React render-loop overhead, explicit perf knobs (DPR caps, shadow sizes, merged geometry, instancing, phone/desktop profiles, live FPS/draw-call telemetry) — a hand-tuned 40 KB of app code will beat an equivalent R3F scene on GC pressure and frame budget, and R3F buys you little once you're managing materials and draw calls this explicitly. **BUT**: this is a *47-building demo*, not a framework — no LOD, no streaming, no world partitioning in the shipped code (that lives in the dead game code and would need porting), facades are repeating PNGs, and the archive itself admits iPhone rendering/FPS/memory were never verified on-device. A fresh R3F app would give faster iteration (drei, declarative scenes) at a runtime cost; this gives a tight runtime at the cost of extending hand-rolled code with no tests on the rendering path. Verdict: adopt its *discipline* (perf budgets, presets, diagnostics, key-free default scene); treat the code as a reference implementation for one block, not as a scalable world engine. And fix the 35-vs-39 test discrepancy before citing its QA numbers anywhere.
