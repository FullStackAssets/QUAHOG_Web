# THE NARROWS — Foundation Audit Report

**Date:** 2026-10-18/19 (EDT) · **Coordinator:** audit subagent (read-only) · **Mode:** three independent worker audits synthesized
**Evidence labels:** VERIFIED = ran/saw this session · REPORTED = prior agent/user claim · INFERRED = reasoned from code, not observed live

---

## 1. Codebase A — QUAHOG_Web (`~/workspace/quahog-web/QUAHOG_Web/QUAHOG_Web`)

| Item | Finding |
|---|---|
| Stack | three 0.169 + R3F 8.17.10 + @react-three/rapier 1.5, zustand 4.5.5, Vite 5.4.10, TS 5.6.3, vitest 2.1.9, React 18.3.1 (VERIFIED) |
| Git state | **Not a git repository** — zip-extracted snapshot, no history; `dist/` and `node_modules/` committed in (VERIFIED) |
| Tests | `npm test` → **29/29 pass**, 5 files, ~5s (VERIFIED re-run; matches REPORTED Sep 20 count) |
| Build | `npm run build` → **exit 0, tsc clean**, 828 modules, 33.7s (VERIFIED re-run). Non-fatal "not a git repository" stamp warning; Rollup circular-chunk warning; rapier WASM chunk 2.08 MB (768 KB gzip) |
| Bundle | `dist/` = **58 MB**: music 36 MB, tiles 14 MB, `slice-newbedford.json` 4.2 MB, JS 3.9 MB, CesiumMan.glb 428 KB (VERIFIED) |
| Coordinates | `toWorld(p,[east,north],y) => [east,y,-north]` at `src/slice.ts:56`; Roads/Buildings/Piers/colliders use the same convention inline — consistent, duplicated (VERIFIED) |
| Game systems | missions, police heat, economy, races, 4-station radio + VO, TouchControls, Rapier driving, E enter/exit, StreetLife peds/traffic, localStorage persistence, minimap/big map, quality.ts + DebugStats, day/night + harbor weather, pickups/collectibles — **all INFERRED (code exists, never playtested)** |
| Photoreal side build | `src/earth/` → `earth.html`, Google 3D Tiles viewer, second parallel build target (VERIFIED exists; REPORTED as crash-prone per its own ROADMAP) |
| Secrets | **No embedded secret keys** in frontend; env vars read server-side in `api/` only (VERIFIED). ElevenLabs voice IDs committed are public identifiers. Caveat: `?key=` shared in a preview URL leaks the key (INFERRED) |
| Deployment | `vercel.json` ready; never deployed. Likely blockers: no env vars configured (graceful fallbacks exist), photoreal build unstable per ROADMAP, 58 MB dist, localStorage-only persistence, name/legal items, no PWA manifest (VERIFIED/Inferred) |
| iPhone readiness | TouchControls wired, viewport locked, guarded storage — but **no evidence of any real device test**; ~4 MB JS + 2 MB WASM + 4.2 MB JSON parse on first load unmeasured; own docs say Web-Speech VO "often silent on mobile" (VERIFIED/INFERRED) |

---

## 2. Codebase B — ChatGPT zip (`~/workspace/user/files/9FDC0675-…-Narrows-Waterfront-Implementation.zip`, extracted to `~/workspace/narrows-audit/zip-extract/`)

| Item | Finding |
|---|---|
| Integrity | SHA256SUMS **290/290 verify OK**; TXT-FILE-MAP 120/120 byte-hash-match (VERIFIED) |
| Commit | `e8b88c8ece536cb3d86d09fc6edc2ab4582f9dad` (VERIFIED content; provenance REPORTED) |
| Waterfront study stack | **Plain imperative three.js 0.169**, Vite 5, TS 5.6 — no React/R3F (VERIFIED). App bundle ~40 KB |
| Study construction | 47 real OSM footprints (Johnny Cake Hill, New Bedford) + 484 road segments, extruded + brick/clapboard PNG facades + procedural normal map; 4 largest footprints replaced by hero GLBs (mill/triple/store/diner/sedan/lamp) from the **QUAHOG_GODOT1 asset archive**; Poly Haven Spruit Sunrise HDRI (CC0) via PMREM; roads = 3 merged ribbon meshes; instanced trees + roof clutter; 2 lighting presets + wet-pavement slider; animated water via `onBeforeCompile`; ACES tone mapping (VERIFIED) |
| Perf architecture | Phone profile: DPR cap 1, 1024 shadow, 18 trees/2 cars; Desktop: DPR 1.5, 2048 shadows; live FPS + draw-call readout; `__NARROWS_REALISM__` debug handle. **No LOD, no streaming** in shipped code (VERIFIED) |
| Tiles viewer | R3F 8.17 + 3d-tiles-renderer 0.4.28 (separate `earth.html`). Auth: `?key=` → localStorage `mh.googleMapsKey`, scrubbed from URL bar; **no bundled key** (VERIFIED grep of source + built JS). Crash-fix patch present |
| Tests | 7 files; workers counted **35 vs 39 `it()` blocks** (discrepancy unresolved — see §6). Node-only (no WebGL/HTTP). Not re-run (read-only). |
| Built site | `site-build/` 24 MB static bundle, relative paths, genuinely deployable; no embedded keys (VERIFIED) |
| Secrets | **None found** in frontend source or built bundles (VERIFIED). Auth design sound: user-supplied browser key |
| Relation to A | **Fully separate, not a fork** — no shared source, different package identity; one comment cites QUAHOG_Web's ROADMAP perf idiom (VERIFIED) |
| Gotcha | Tree contains a **dead 60-file R3F driving game** (rapier colliders, 160 m cell chunking, 1050 m culling) **not in Vite build inputs** — the only distance-culling in the repo ships nothing (VERIFIED) |

---

## 3. Codebase C — Deployed viewer (`https://narrows-waterfront-study-oct18.blaizexb.chatgpt.site`)

| Item | Finding |
|---|---|
| Host | `narrows-waterfront-study-oct18.blaizexb.chatgpt.site` (VERIFIED; iPhone's truncated `…t-study-oct18…` was this). `/` → 200 (study), `/earth.html` → 200 (photoreal) |
| Void symptom | iPhone shows HUD + blocky CesiumMan figures + red truck + pale-blue sky, **no ground/tiles** (REPORTED 2026-10-18 23:20 EDT) |
| Root cause | **INFERRED, strong code evidence:** iPhone rendered past the key gate (HUD visible, not the key notice) → a Google key is stored in that browser's localStorage → tiles failed to stream. **100% of world geometry comes from Google tiles; there is no fallback ground mesh** (VERIFIED — no `planeGeometry`/`circleGeometry` in earth source). The void is the code's **designed graceful degradation** for any tile-delivery failure. **JS crash ruled OUT** — failures surface only as `console.warn("[tiles] load-error:")` + a generic banner; no retry, no cause-specific UI |
| JS vs billing | Code has **zero billing-specific branches** — invalid key, Map Tiles API disabled, billing disabled, HTTP-referrer restriction mismatch, quota exhausted, and network block are **indistinguishable in-app** (all → same void + same banner). Billing state is a Cloud-console fact, not observable from code (VERIFIED by code inspection) |
| Likeliest causes (ranked) | 1. Key's HTTP-referrer restriction doesn't include this exact `chatgpt.site` host · 2. Map Tiles API not enabled · 3. Billing not enabled/account issue · 4. Key revoked · 5. Device-level block of `tile.googleapis.com` (INFERRED) |
| Patch claim | The 4 crash fixes **are present in the deployed bundle** (VERIFIED) — but they fixed lifecycle crashes, **not tile delivery**. Tests use a dummy key with the renderer disabled, so they never exercised live tiles. The claim's own caveat ("live Google tile loading remains unverified") is the crux |
| Secrets | **No embedded key** in deployed bundles; `VITE_` branch compiled out; key lives only in visitor localStorage (VERIFIED). Note: key travels as `?key=`/`&session=` query params on every tile request — lands in request logs |
| Live-browser checks still needed (delegated, NOT done) | 1. Confirm key-notice vs HUD on the iPhone · 2. DevTools console `[tiles] load-error` + `GoogleCloudAuth: Failed to load data with error code NNN` · 3. Network status + Google error JSON for `createSession`/`root.json` (redact key) · 4. WebGL state + `tiles.group.children.length` after 30s · 5. **Nic's hands:** key referrer restrictions include the exact host, Map Tiles API enabled, billing current · 6. Control test with a fresh unrestricted key |

---

## 4. Asset provenance summary

| Asset | Source | License/status |
|---|---|---|
| OSM slice data (`slice-newbedford.json`, 47-footprint `block.json`) | OpenStreetMap | © OSM contributors, ODbL — attribution required (VERIFIED in docs) |
| Hero GLBs (mill/triple/store/diner/sedan/lamp) | QUAHOG_GODOT1 archive | Per CREDITS.txt; verify before commercial use (VERIFIED exists, terms INFERRED) |
| Spruit Sunrise HDRI | Poly Haven | CC0 (VERIFIED, self-hosted) |
| Brick/clapboard PNG facades | ChatGPT-generated for the study | Project-owned per ChatGPT handoff (REPORTED) |
| CesiumMan.glb (428 KB) | No provenance note in repo | INFERRED Cesium sample asset — typically CC-BY 4.0; **verify before shipping** |
| 16 MP3s (36 MB) | ElevenLabs Music-generated | "Royalty-free" per MUSIC.md; **no license files committed — legal flag before monetization** |
| Esri World_Imagery aerial ground (optional) | Esri free endpoint | Attribution required; no attribution string visible in component (INFERRED minor gap) |

---

## 5. RECOMMENDATION

**Base the single authoritative runtime on QUAHOG_Web (codebase A).** Reuse the waterfront study (codebase B) as a *reference implementation* for district construction and performance discipline; relegate the Google Tiles viewer (codebase C) to a reference-only diagnostic route until the key-config issue is resolved on Nic's side.

**Why A, in three load-bearing facts:**
1. **It is the only codebase with verified build + verified tests + a complete game loop.** `npm run build` → exit 0, tsc clean; `npm test` → 29/29 pass (both re-run this session). Missions, police, economy, races, radio, driving, enter/exit, peds/traffic, persistence, touch controls, and quality scaling all exist as implemented code in one coherent tree — everything the directive says to preserve.
2. **The study (B) is a 47-building demo, not a game.** It has zero game systems — no player controller, physics, missions, driving, NPCs, or persistence — and no LOD/streaming in the shipped code. Adopting it as the base would mean porting the entire game layer over, which is a rewrite wearing a reuse costume, directly contradicting the directive's "preserve existing working game logic" rule.
3. **B's real value is portable discipline, not its codebase.** Its construction pattern (real OSM footprints → extruded + hero GLBs + merged roads + instanced detail + CC0 HDRI) and its perf architecture (phone/desktop profiles, DPR/shadow caps, live FPS/draw-call telemetry, quality presets that actually change GPU workload) can be ported into A's `quality.ts` + `DebugStats` + world builders incrementally. The four hero GLBs' source chain (QUAHOG_GODOT1 archive) is verified and reusable.

**Migration effort (estimated, not committed):**
- Small: initialize git on QUAHOG_Web, commit snapshot as baseline; wire the reference photos + provenance into the asset pipeline.
- Medium: port B's phone/desktop perf profiles into `quality.ts` (verify presets actually change DPR/shadow/draw distance); add the live FPS/draw-call overlay to `DebugStats`; build the first district on B's construction pattern (OSM footprints + facades + hero GLBs + merged roads + instanced detail + wet pavement).
- Medium: build the `/debug` diagnostics page (acceptance gate 3).
- Small paperwork, high legal weight: resolve CesiumMan license, ElevenLabs music commercial terms, Esri attribution.
- Defer: `earth.html` tiles viewer becomes a clearly-labeled reference route with key-config docs; void resolution needs Nic's Cloud console (referrer restriction → exact host, Map Tiles API enabled, billing current).

---

## 6. Ranked blockers

1. **No real iPhone test of QUAHOG_Web — severity: HIGHEST.** Every iPhone claim about A is INFERRED. All acceptance gates are phone-gated; the first device pass (load time, thermals, touch ergonomics, audio unlock) is the highest-impact next action.
2. **Snapshot has no git history — severity: HIGH.** The "one authoritative runtime and repository" rule plus the rollback requirement cannot be satisfied until the snapshot is committed (recommend: fresh repo, snapshot as initial commit).
3. **Void on the deployed photoreal page is unresolved key/auth config — severity: HIGH (for the imagery route; not blocking the game base).** Needs Nic's hands in Google Cloud console.
4. **Asset licensing gaps — severity: MEDIUM-HIGH (before any commercial step).** CesiumMan provenance, ElevenLabs music terms, Esri attribution.
5. **58 MB dist / 36 MB music — severity: MEDIUM.** First-paint budget on cellular unmeasured; consider music streaming/deferred loading.
6. **Test-count discrepancy in the zip (35 vs 39 counted by the two workers) — severity: LOW.** Do not cite its QA numbers anywhere until reconciled; neither suite exercises the rendering path.

---

## 7. Evaluation criteria scorecard (acceptance gates vs candidates)

| Gate | QUAHOG_Web | Waterfront study | Tiles viewer |
|---|---|---|---|
| No unhandled startup errors | VERIFIED (build+tests clean) | INFERRED (code only) | VERIFIED present-patched, voids by design on tile failure |
| Opens/responsive in iPhone Safari | INFERRED only — never device-tested | REPORTED (Nic's recording) — fps number unverified | REPORTED — renders a void |
| Geo/buildings/roads/collision align | INFERRED (consistent convention verified in code) | INFERRED | N/A (Google geometry) |
| No blocking geometry | INFERRED | INFERRED | N/A |
| No desktop keyboard needed | INFERRED (TouchControls exist) | INFERRED (touch UI) | INFERRED |
| Quality presets change GPU workload | INFERRED (`quality.ts` exists) | VERIFIED in code (phone/desktop profiles) | Partial (DPR cap) |
| Performance measured | NOT measured | NOT measured (overlay read ≠ measurement) | NOT measured |
| Build + regression checks | VERIFIED | Partial (counts disputed) | Partial |
| Existing functionality intact | VERIFIED buildable/testable | N/A (demo) | N/A (viewer) |

*Worker findings: [findings-quahog-web.md](sandbox://workspace/narrows-audit/findings-quahog-web.md) · [findings-zip.md](sandbox://workspace/narrows-audit/findings-zip.md) · [findings-deployed.md](sandbox://workspace/narrows-audit/findings-deployed.md) · Extract: `~/workspace/narrows-audit/zip-extract/`*
