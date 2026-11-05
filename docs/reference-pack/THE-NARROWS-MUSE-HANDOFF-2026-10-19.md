# THE NARROWS / QUAHOG_Web — Muse Implementation Handoff

**Date:** 2026-10-19  
**Source:** User-provided `AUDIT-REPORT.md` dated 2026-10-18/19.  
**Directive:** Preserve the working architecture and gameplay code. Do not replace it with the waterfront-study demo or Google Tiles viewer. First ship a recognizable, playable two-block New Bedford waterfront slice, then scale.

## 1. Evidence and constraints

- **Audit-reported verified in Muse's source workspace:** QUAHOG_Web's `npm test` passed 29/29; `npm run build` exited 0; projection `toWorld([east,north],y) => [east,y,-north]`; source files implement driving, touch controls, missions, economy, pedestrians, radio, and persistence; QUAHOG_Web itself is an extracted snapshot without a Git repository.
- **Not yet verified in a real device:** startup behavior, handling, enter/exit, collision continuity, performance, first-load time, sound unlock, current visual quality, real iPhone Safari input. Passing unit tests and TypeScript compilation do not prove browser-runtime acceptance.
- **Waterfront study:** 47 OSM footprints and 484 road segments, facade imagery, hero GLBs, instancing, merged roads, HDRI, wet asphalt, FPS/draw-call display. Useful as a reference and asset donor, **not** an alternative authoritative application.
- **Google 3D Tiles viewer:** the source contains no non-tile world-ground fallback. Blank ground on iPhone means tile delivery/rendering needs diagnosis, but it does not establish a specific Cloud billing/key cause or rule out all runtime errors. Keep behind an optional diagnostics route; never block gameplay.
- **Asset status:** OSM attribution is required; recheck license/source trail of CesiumMan, original GODOT GLBs, soundtrack, and optional Esri imagery. Do not ship third-party copyrighted photo pixels as game textures without rights.

## 2. Single authoritative codebase and safety

1. Locate the real `~/workspace/quahog-web/QUAHOG_Web/QUAHOG_Web` source. Never create a second game runtime or port the game to plain Three.js.
2. Remove only regenerated artifacts from source control expectations (`dist`, `node_modules`) **after** archiving the baseline; create `.gitignore`, initialize Git (if not already set up), and make a baseline commit. Record HEAD SHA. Never assume an existing Git history.
3. Run and log `npm ci`, `npm test`, `npm run build`; inspect package scripts before interpreting warnings.
4. Host QUAHOG_Web over HTTPS on a preview route accessible from the user's iPhone. Supply the URL and a `/debug` route for user testing. Zero credentials in browser bundles or shared URLs.
5. Restrict graphics changes to small reviewable commits, with a before/after screenshot and rollback point for each.

## 3. First geographic implementation slice

**Candidate focus (validate against actual footprints/tiles before implementation):** downtown New Bedford near North Water Street, Centre Street, Front Street and the harbor-facing vista. Prefer two physically connected playable street blocks represented in the existing GIS slice; do not force incorrect coordinates or invent streets. Integrate any already-placed Johnny Cake Hill landmark silhouettes only where geospatially consistent.

**Minimum functional scene:**

- Two continuous streets/blocks with correct geometry, sidewalk winding, curb height, intersection seam, crosswalks, exposed harbor-facing view and locally accurate architectural surfaces.
- One controllable vehicle with acceleration, steering, braking, enter/exit transitions, visible/rotating wheels, collisions and mobile controls. Reuse current Rapier car and input stack; do not swap it for a spline-driven AI car.
- One genuinely enterable building: make a doorway gap, omit the blocking solid-building collider over the doorway/interior, add floor/wall/ceiling colliders and fit an interior furnishing scene to the actual footprint. Trigger entry/exit without keyboard.
- Day and evening light preset; coastal sky and lightweight water. No SSR or blanket expensive shader passes on iPhone.
- On-screen diagnostics: FPS distribution, draw calls, triangles, DPR, quality, loaded tile count, geometry/memory estimates where exposed, touch-control status, JS errors, tile/auth errors, user agent, WebGL capabilities. No secrets in logs.
- Preserve every existing mission/economy/police/audio system as-is; exercise one representative mission hook but do not expand gameplay scope yet.

## 4. Photo acquisition and source-to-asset workflow

### Highest-value images in order

1. Present-day, wide-angle **street-level corner views** with buildings visible on both sides, curb/road widths and grade; take overlapping viewpoints for geometry alignment.
2. **Each hero building:** front elevation, oblique 45-degree left/right, side, door, window, roofline, masonry/siding close-ups. Capture scale cues.
3. **Surface details:** granite, red brick bond, clapboard, trim, curb/cobblestone joints, sidewalk slabs, drain grates, pole/traffic signage, roof flashing.
4. **Working harbor:** wharf edge geometry, pilings, trawlers/rigging, harbor water coloration and reflections, cranes, stacks, pier clutter and lighting.
5. **Evening/rain** lighting and wet pavement only after the daylight baseline is correct.

### Initial sourced references (links in companion CSV)

- National Park Service, Seamen's Bethel and Mariners' Home, 2015: broad building proportions, white clapboard, cornice, windows and lantern. US public domain as labeled on Wikimedia Commons.
- National Park Service, downtown fishing fleet, 2006: trawler silhouettes, rigging, paint, harbor reflections. US public domain as labeled on Wikimedia Commons.
- National Historic Landmark documentation, North Water Street, circa 1964: historical clapboard/block arrangement only. Commons labels public domain; **do not mistake for present-day conditions**.
- Seamen's Bethel doorway, 1968: entrance sign proportions and doorway shape. Commons states a public-domain dedication.
- NPS 'Around the Park' photo gallery: high-resolution candidate elevations, including Waterfront Visitor Center, Custom House, Rodman Candleworks, Corson Building; **each file's own rights must be checked**.

### Required capture manifest fields

`photo_id, area, street_or_feature, facing, approximate_geo, captured_date, current_or_historic, source_url, creator, license_status, usage_permission, target_osm_id, target_mesh_id, priority, modeling_notes`

Retain original and optimized files separately; group each building's references in a named folder. Photos are geometry/material references by default, **not automatically cleared in-game textures**. Confirm present-day details and source alignment before baking any facade. Aim for image-based proportions rather than artificially generating architecture absent from photos.

## 5. Implementation order

| Order | Task | Gate |
|---|---|---|
| 0 | Git baseline + clean install + report build/test | Record test output and commit SHA |
| 1 | HTTPS deploy original QUAHOG_Web + iPhone smoke test | User loads, moves, enters vehicle, attempts building entry, reports screen/video and diagnostics |
| 2 | Select two contiguous GIS blocks + photo/provenance manifest | Every hero facade has identified reference(s), coordinates align with current world convention |
| 3 | Port waterfront-study low-cost assets: facade PBR, hero GLBs, merged street meshes | Compare screenshots; no gameplay regressions |
| 4 | Correct enterable-building collider and doorway | Player traverses from sidewalk into room and back without clipping |
| 5 | Validate existing driving/control loop and tune touch steering/braking | One car completes block without keyboard and without collision glitches |
| 6 | Mobile performance hardening: adaptive DPR, meaningful presets, instancing/culling/LOD, streaming only as needed | Profile real iPhone after sustained gameplay, record p50/p95 frame times and thermal experience |
| 7 | Add coastal lighting/water and minimal street-life detail | Visual gain documented without unacceptable mobile regression |
| 8 | Freeze two-block vertical slice, regression run, accept/reject | Written acceptance table and working preview URL |

## 6. Acceptance criteria

- Original `npm test` and `npm run build` still pass; failures are listed and explained, never hidden.
- No new unhandled exceptions in browser on a real iPhone Safari session; app works over HTTPS.
- Touch navigation, vehicle steering/braking, enter/exit, one enterable building, collision and geometry continuity tested on-device.
- No buildings/furniture floating, no doorway covered by fixed colliders, no sidewalk winding inversion or mismatched normals.
- Low quality **actually** disables expensive effects and reduces DPR, distances and density; measured p50/p95 FPS/draw calls reported for a 2-minute interactive session. Proposed target: roughly 30 FPS sustained or better on test device, **not a verified current result**.
- Reference manifest gives source and rights for every exterior/hero asset; attribution displayed as needed.
- Screenshots cover the two blocks from matching angles, plus interior and vehicle. Output contains before/after, test logs, SHA and rollback instruction.

## 7. Guardrails

- No wholesale upgrade from the earlier 6,456-line code proposal; its competing revisions and first-wave syntax errors are not a clean patch.
- No user API key in URL, screenshot, exported manifest, public env var or client bundle. Diagnose Google Tiles key and API activation separately and privately; provide a reliable terrain/scene fallback.
- No postprocessing on iPhone just because a "high" toggle exists. No uncontrolled thousands-of-mesh traffic or expensive physical lights.
- No pretending that a successful TypeScript build verifies a functioning iPhone game or that sourced historical photos prove today's street appearance.
- Zero paid APIs or asset purchases without explicit approval.

## 8. Immediate Muse execution prompt

> Work in the **existing QUAHOG_Web** source, not the separately built waterfront study. Read AUDIT-REPORT.md and this handoff. First create a version-controlled baseline and report the SHA, then deploy the unchanged base to a private HTTPS preview for a real iPhone Safari playtest. Build a photo-source manifest for two adjacent New Bedford waterfront blocks around North Water/Centre/Front, using the source links and current photos where licensed. With the phone baseline in hand, port only selected waterfront-study visual techniques: real footprint-aligned hero architecture, PBR materials, merged streets, instancing and mobile telemetry. Preserve and verify original Rapier vehicle/character input, missions and touch HUD. Fix a genuine enterable doorway/interior with correct colliders. Do not integrate Google 3D Tiles into the authoritative game runtime. Deliver working URL, baseline commit, modified-file diff, QA logs, mobile measurement table, matching-angle screenshots, evidence labels and rollback. Stop and request the exact missing input if the source workspace or phone test is inaccessible; do not fabricate a deployment or pass status.

## 9. Source audit caveat

This is a plan derived from the **uploaded read-only audit report** and independently located public reference pages. It is not evidence that this ChatGPT session accessed the VM, ran the code, took an iPhone reading, or deployed a build.
