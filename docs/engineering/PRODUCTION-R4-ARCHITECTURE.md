# QUAHOG production R4 | Architectural massing + distinct facade materials

Date: 2026-11-02. This is a PRODUCTION-ONLY source-package handoff, not a deployed build.

## Implemented source changes

- `StreamingBuildings.tsx`: streamed GIS/OSM buildings now merge geometry by deterministically selected brick, clapboard, or granite facade type on Medium/High. Low retains a single merged visual material and one render draw path. The actual extruded footprint and static `trimesh` collider geometry remain intact; only mesh-group material partition changes. Three material families use cached local assets with fallback to the previous original maps. The invalid preexisting unbound `quality` variable in the tile material hook is corrected.
- `architecturalShellLayout.ts` and `ArchitecturalShell.tsx`: bound, instanced projecting foundation plinths, cornices, horizontal belt bands, masonry corner piers, commercial lintels and selected chimney details. Frontage is calculated from each source polygon, with outward normal corrected independent of winding. Ornamentation is decorative, no collision objects, no mission or navmesh changes. The generator rejects corrupt coordinates, low buildings and protected modeled landmarks. Per-tile quality budgets are Low 35 / Medium 120 / High 240 pieces; only two mesh classes render on Low. No procedural mesh added to the authoritative GIS footprint itself.
- `StreamingBuildings.tsx`: gable roof ridge for suitable four-point rectangles (side length and right-angle checked); irregular polygons retain conservative hip roofs. Roof faces are triangle winding-corrected. Pitched roofs use low-cost existing vertex-colored roof finish and don't pretend to be surveyed landmark geometry.
- 12 original 512x512 baked local PBR facade textures: brick, clapboard and granite, with matching albedo, normal, roughness and low-level window emissive maps. The baked source uses the VALID cladding region of original P010 source swatches. Some P010 textures include a black unused half; sampling was cropped before production map creation. Old R3 maps are untouched as backstops.
- `Buildings.tsx`: fallback monolithic building path gains only budgeted decorative architectural shells in collider-near territory; no global per-building decoration of the 10k+ footprint collection.
- 19 additional source/material tests check physical dimensions, budgets, corrupt geometry, normals, local PBR maps, landmark preservation, and deterministic generation.

## Authenticity and limits

Geometry is plausible South Coast architecture, NOT building-accurate photogrammetry: wall colors, material kind, window rhythm, roof type and ornamental placement are heuristics derived from footprint and height, not verified facade surveys. The corresponding R4 images are synthesized/baked from owned P010 swatches and remain repeatable; they are not photographic texture captures. No original real-world landmark remodel is claimed.

This is a source-level release: there is no supported claim of a full TypeScript/Vite compilation, installed dependency runtime, WebGL screenshot, screenshot-matched landmark result, live device frame time, or completed deployment. Renderer-compatible material/UV integration and live iPhone memory/draw-call behavior require the production acceptance gate.

## Production-only acceptance gate for Muse

1. READ the live authoritative source/commit and collect an immutable full backup plus existing rollback hook.
2. Run `node scripts/production-fulltree-preflight.mjs --live-dir <live-source-copy>` against an exact read-only copy of current live source. The R4 full-tree baseline expects R3 (which itself was NOT deployed). A live Build003A or other unknown intermediate will intentionally FAIL CLOSED until reconciled by file-level analysis. Do not bypass it.
3. In a temporary offline working directory (NOT a deployment environment), install pinned dependencies and run `npm ci --no-audit --no-fund`, `npm test`, `npm run test:production-assets`, `npm run build`.
4. Confirm every referenced `.glb` and `.png` is HTTP 200 and Meshopt decodes on the actual production hardware. Inspect close-range brick/clapboard/granite facades from matched streets and verify no inverted roof normals, duplicate decorations, incorrect road-side entrances, or gaps at polygon corners.
5. On an iPhone, run Low/Medium/High quality 10-minute traversal, vehicle physics, missions, snow/rain, saved state, and frame-time diagnostics. Fail if an observed regression exceeds the agreed limit, crashes, or breaks collisions.
6. Only after ALL checks pass, perform one atomic production replacement with verified rollback. Verify CDN assets and game persistence after cutover; revert on failure.

Do not deploy the library as isolated GLBs in place of the game. Do not publish the private music or modify licenses/rights based on this package. No staging environment, no spending, no credentials rotation.
