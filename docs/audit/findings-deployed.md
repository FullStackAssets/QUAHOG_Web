# Audit: deployed Mount Hope photoreal viewer — void-render diagnosis

Date: 2026-10-18 ~23:50 EDT · Auditor: read-only subagent (no live browser; all claims from fetched code/text)
Claim labels: **VERIFIED** = fetched/read this session · **REPORTED** = prior agent/user claim · **INFERRED** = reasoned from code, not observed live

## 1. Host identification

- **VERIFIED**: The correct host is `https://narrows-waterfront-study-oct18.blaizexb.chatgpt.site` (source: `~/workspace/narrows-audit/zip-extract/START-HERE.txt`, the prior agent's own deploy bundle).
- The guessed host `it-study-oct18.blaizexb.chatgpt.site` returned "URL not found" — the iPhone's truncated `...t-study-oct18.blaizexb.chatgpt.site` was the tail of `narrows-waterfront-study-oct18`.
- **VERIFIED**: `GET /` (waterfront study) → HTTP 200, title "The Narrows · Waterfront Study". `GET /earth.html` (photoreal viewer) → HTTP 200, title "The Narrows — Photoreal 3D Tiles (test)". When fetched without a key it renders the key-entry notice (expected — see §4).

## 2. Deployed bundles (response-level facts, VERIFIED)

| Asset | Size | Status |
|---|---|---|
| `/assets/earth-DdYZQI8p.js` (photoreal page) | 540,016 bytes, 2402 lines | HTTP 200 |
| `/assets/main-D4-gExYU.js` (waterfront page) | 39,974 bytes | listed in build dir |
| `/assets/GLTFLoader-tzS4ldOi.js` (shared) | 733,900 bytes | listed in build dir |

- **VERIFIED**: the deployed `earth-DdYZQI8p.js` contains the prior agent's patch: the `GoogleTilesPlugin.dispose()` null-guard, the memoized `useMemo(() => [{apiToken, useRecommendedSettings:false}])` plugin args, `errorTarget={32}` on `TilesRenderer`, and the new "Still waiting for real-world imagery" banner text. The deployed build matches the patched source.

## 3. How the world loads — earth (voiding page) vs waterfront (working page)

**Earth page** (`src/earth/EarthApp.tsx` + `GoogleTilesAuth.tsx`, confirmed in deployed bundle):
- 100% of world geometry (ground plane, buildings) comes from **Google Photorealistic 3D Tiles** via `3d-tiles-renderer@0.4.28` `GoogleCloudAuthPlugin`.
- Tile session flow (VERIFIED in deployed bundle): token manager POSTs `https://tile.googleapis.com/v1/createSession?key=<KEY>`; every tile URL carries `?key=<KEY>&session=<TOKEN>`; root tileset is `https://tile.googleapis.com/v1/3dtiles/root.json`.
- **VERIFIED**: there is **no procedural ground plane, no fallback mesh, and no tile cache** in `src/earth/` (no `planeGeometry`/`circleGeometry` anywhere in earth source).
- The "blocky CesiumMan-style figures" are rigid primitive `Character` meshes, the "red truck" is a procedural red (`#b81d24`) mustang/bronco `Vehicle`, the pale-blue is the clear-weather sky background `#bcd4ea`. **All render with zero tiles loaded.** This exactly reproduces the REPORTED iPhone symptom.
- Key sourcing: `?key=` URL param (persisted to `localStorage["mh.googleMapsKey"]`, then scrubbed from the address bar) → `localStorage` → build-time `VITE_GOOGLE_MAPS_API_KEY`. **VERIFIED**: the `VITE_` branch is dead-code-eliminated in the deployed bundle (env var not set at build) — the only live key source is the browser's localStorage.

**Waterfront page** (working): bundle contains **zero** Google references (VERIFIED). World = local GLB models, PNG textures, HDR sky, and a JSON street slice, all served from the same static host. **The two pages share no world-loading code.** The structural diff is the prime suspect, as hypothesized.

## 4. Failure handling in the earth tile pipeline (VERIFIED from deployed bundle)

- Session/token fetch failure throws `Error("GoogleCloudAuth: Failed to load data with error code " + status)` inside the token manager. That rejection surfaces **only** as a `load-error` event → `console.warn("[tiles] load-error:", …)`.
- A 6-second interval checks `tiles.group.children.length`; if zero → sets `tilesProblem` → shows the generic banner: *"Still waiting for real-world imagery. Tiles may be delayed by the connection, unavailable coverage, or a rejected request. If this persists, check the Maps key, domain restrictions, and quota, then reload."*
- **There is no retry, no cause-specific UI, and no crash.** Any 4xx from `tile.googleapis.com` (or a network failure) produces exactly the observed state: HUD + actors + pale blue sky, no ground — with only a console warning distinguishing it.

## 5. JS-errors vs billing-errors verdict (from code — do not confuse)

- **JS errors**: No unhandled-crash path found that would void the world while leaving HUD/actors running. Error paths are handled (console warn + banner). The ErrorBoundary exists for render crashes. **A JS crash is ruled OUT as the void cause by code inspection.**
- **Billing errors**: The code has **zero billing-specific branches**. It cannot distinguish invalid key / Map Tiles API not enabled / billing disabled / HTTP-referrer domain restriction mismatch / quota exhausted / network block — all are identical voids with the same generic banner. Billing state is a Google Cloud console fact, not observable from this code.
- The prior agent's note ("error screens no longer diagnose billing or memory from a code exception") is accurate — the screens now deliberately refuse to guess.

## 6. Does the "patched and redeployed" claim hold up?

- **Mostly yes, with the original caveat intact.** The 4 fixes described (dispose-before-init guard, memoized plugin args so parent re-renders don't churn the Google session, `useRecommendedSettings:false` so the plugin no longer forces `errorTarget=20` over the app's `32`, non-diagnosing error screens) are **all present in the deployed bundle** (VERIFIED). Test files total 4+6+7+5+5+5+10+2 = **39 tests**, including the 4 plugin-lifecycle regressions — consistent with REPORTED "39/39 pass".
- **But**: the tests use a dummy key (`"local-test-no-network"`) with the renderer disabled — they verify lifecycle mechanics, **not tile streaming**. The patch fixed lifecycle/crash bugs, not tile delivery. The REPORTED iPhone void (23:20 EDT, after deploy) is a tile-delivery failure, which this patch cannot fix if the cause is key/auth/billing. The claim's own caveat ("live Google tile loading remains unverified") is the crux.

## 7. Most likely root cause (INFERRED from code + REPORTED symptom)

- The iPhone rendered **past the key gate** (REPORTED: in-app HUD with PLAY/ORBIT/3RD/1ST + TELEPORT buttons, not the "needs a Google API key" notice) — so a key **is** stored in that browser's localStorage.
- Tiles then failed to stream. Per §4, the app cannot say why; candidate causes, most likely first:
  1. **HTTP-referrer restriction on the key doesn't include `narrows-waterfront-study-oct18.blaizexb.chatgpt.site`** (the page itself instructs "Restrict the key to your site's domain" — a key restricted to an older/different host 403s).
  2. Map Tiles API not enabled on the key's Google Cloud project.
  3. Billing not enabled / billing account issue on the project.
  4. Key revoked, regenerated, or deleted since it was pasted.
  5. Device/network-level block of `tile.googleapis.com` (ad-blocker, DNS).
- The void is the code's **designed graceful degradation** for any of these — not a rendering bug per se.

## 8. Embedded secrets check (VERIFIED)

- **No embedded Google API key** in the deployed earth bundle (no `AIza…` pattern; the `VITE_GOOGLE_MAPS_API_KEY` branch is compiled out). Keys live only in the visitor's browser localStorage.
- Note: the key **is** transmitted as a URL query param (`?key=`, `&session=`) on every tile request to `tile.googleapis.com` — standard for this plugin, but it lands in request logs. The `?key=` in the page URL is scrubbed via `history.replaceState` after persisting (good).

## 9. Live-browser checks still needed (for parent to delegate — NOT done here)

1. On the iPhone (or desktop with the same key): confirm whether the key-notice or the in-app HUD renders (establishes key presence).
2. DevTools console: capture `[tiles] load-error` lines and any `GoogleCloudAuth: Failed to load data with error code NNN` — the status code separates 400 (bad request) vs 403 (key/billing/restriction) vs network failure.
3. Network waterfall: actual HTTP status + Google error JSON for `POST /v1/createSession?key=…` and `GET /v1/3dtiles/root.json?key=…` (look for `API_KEY_INVALID`, `BILLING_DISABLED`, `SERVICE_DISABLED`, referrer-mismatch details). **Redact the key value; report only the error JSON.**
4. WebGL state: confirm context intact; check `tiles.group.children.length` in console after ~30s.
5. Google Cloud Console (Nic's hands): verify the key's HTTP-referrer restrictions include the exact `narrows-waterfront-study-oct18.blaizexb.chatgpt.site` host, Map Tiles API enabled, billing linked and current.
6. Control test (Nic's hands): load `earth.html` with a fresh unrestricted test key to isolate key-config vs device-network causes.
