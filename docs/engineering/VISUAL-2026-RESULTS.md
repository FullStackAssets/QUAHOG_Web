# The Narrows — November 1 visual aesthetics candidate

Owner: ChatGPT Work. Implementation authorized directly by Nic on November 1, 2026. Muse remains deployment/site-maintenance operator. This is a candidate for review, not a production release.

## Source intake and ancestry
- [Verified] Recovered `QUAHOG_Web_Blizzard_2026_Source.zip` from the project’s October 29 files. SHA-256 `79cd65b47c5f13781adb0b853568762683c7509f46929d6dcb199d716b7495e4`; 1,153 archive entries.
- [Verified] Isolated local baseline commit `8b146ad8defde31c2cb50cc9b8d59e489fc2af17`. This is a new recovery commit, NOT the historical deployed `64178e4` SHA.
- [Verified] No remotes configured in the isolated checkout. A read-only GitHub main-to-64178e4 comparison returned 404. Production ancestry is therefore not established by this candidate.
- [Reported] Muse’s October 30 source reissue identifies recovered 003A `64178e4a43d51802f78e7fbae952e7b9da6677d5`, tarball `1f65d2286e4b1084720bf08274572979849a78b17df5f87fc4431225fd427797`; its private transfer expired October 30 Eastern Time. Do not substitute old GitHub main or reset the damaged original worktree.
- [Verified] The newer user-supplied archive already includes the blizzard implementation. No second weather engine or W4 runtime was introduced.

## Implemented and connected to the game
- White clapboard on the Bethel, correctly scaled siding UVs, projecting corner/cornice trim, belfry louvers, inset arched sash and stone sills. The duplicate MassGIS visual shell is hidden; its existing hull collider remains enabled using `includeInvisible`. Hero colliders and position are retained.
- All existing GIS footprint geometry is retained. Added floor-scaled UVs, stable ID-based brick/clapboard/granite colors, recessed-window maps, dark roof caps and window-only night emission. No per-building downloaded photos.
- Batched plinths, floor bands and cornices around the Johnny Cake Hill district; Mariners’ Home footprint receives a restrained clapboard/trim treatment. This is architectural enhancement, NOT a surveyed reconstruction of its elevation or an interior.
- Nearby-only small landmark/business labels replace the previous skyline of large labels and neon landmark columns. Business purchase/rest/healing mechanics remain in place.
- Both sidewalks now face upward (one previously faced down). Street surfaces retain existing centerlines/widths; wet roads use dielectric roughness, not metallic paint. Winter roads show packed snow and decorative wheel tracks, and snow-covered sidewalks no longer multiply a dark summer texture.
- Reduced overexposure from the indoor reflection environment, restrained bloom/AO/grade, no chromatic aberration or film grain. Low quality bypasses postprocessing; shadow size, streamed view radius and district detail/cull budgets respond to quality. Existing DPR and snowfall quality scaling remain.
- Quieter maritime HUD with safe-area offsets, a compact mission panel, health/cash/heat, collapsible keyboard help, contextual touch buttons and one map/radio launcher each. All existing game actions remain accessible through touch controls/settings; purchase prompt has a touch button.
- Corrected north-up radar heading (yaw zero is +z/south).
- Bundled licensed DejaVu Sans for in-world labels, removing the observed startup dependency on the external unicode-font resolver for the shipped names. License ships beside the font. No new paid asset/service.
- Render telemetry counts all composer passes rather than reporting the final full-screen triangle. Debug HUD includes p95 frame time. The five fixed review cameras are development-only and cannot activate in the production bundle.
- Music manifest generation preserves unchanged file bytes instead of regenerating timestamps on every build.

## Verified preservation
`VISUAL-2026-PROTECTED-ASSETS.json` records original SHA-256 values for 1,000 files: music, JSON/GIS/road/building tile data, mission definitions, state/save modules, player/car controllers, and mission runner. All match the original archive after this visual pass. There are 62 GIS records and 26 music-directory files, including 16 audio clips. Existing blizzard mission progress/rewards/weather logic is unchanged.

## Validation
- [Verified locally] Baseline: 29 Vitest + seven blizzard checks + TypeScript/Vite production build passed.
- [Verified locally] Result: 34 Vitest + seven blizzard checks passed; production build passed. Added tests cover collider vertex/index preservation, stable building identity, roof UVs and both sidewalk normals across multiple directions.
- [Verified locally] Five before/after views: Bethel front, Bethel side, Mariners’ Home, Water Street, blizzard. Fixed world cameras at 10:00; medium; 1280×720, DPR 1. External aerial tiles and paid VO routes disabled for equal procedural-ground comparisons. The baseline views include the common local-font startup fix (the corrected winter capture also uses the same all-pass QA probe) so the original scene can render in this environment. Dynamic pedestrians/traffic/particles are not pixel-deterministic. A Vite duplicate-state capture issue was detected and the winter comparison was recaptured through the mounted store instance with weather/quality recorded. The reusable capture script uses that verified store handle.
- [Verified locally] Portrait 390×844 and landscape 844×390 touch emulation: checked HUD/actions in bounds, zero overlapping menu/action targets, settings reachable by touch. Existing saved/custom touch layouts and device rotation of an existing session still need device QA.
- [Verified locally] Production bundle browser smoke: new game starts, menu/settings open, no page errors or failed local assets. External aerial requests are deliberately disabled in this test. The separate Google Tiles page is not certified by this game test.
- [Limit] Chromium/SwiftShader Linux is software rendering, not an iPhone. FPS/p95 observations from it are not a mobile performance claim; all-pass draw/triangle counts are reference observations only. Earlier baseline telemetry counted only the final composer pass, so no valid before/after frame-time ratio is asserted.
- [Limit] Actual iPhone Safari FPS, p95, thermals, saves across Safari suspension, collision walk-through, all five live staging screenshots and the 15% regression gate remain open. No claim of 30 FPS or photorealism.
- [Known visual limit] Foreground streamed roofs occlude parts of the fixed winter/front view at some angles. This pass does not certify camera wall avoidance or resolve all blockout placement; those remain staging/gameplay QA items.
- [Known existing build warnings] vendor ↔ R3F circular chunk and large Rapier vendor chunk. Production smoke passed; these warnings were also present before this work.

## Staging and rollback handoff for Muse
1. Obtain this artifact privately. Read `release.json` and verify the candidate hashes.
2. Inventory the current authoritative VM tree, HEAD, status, existing worktrees, current staging/production build ID, rollback and all 26 music assets. Preserve pending work. Do not edit the damaged original tree or force-push.
3. Compare that tree against the October 29 archive and this patch. If the VM contains newer code, reconcile the changed files in an isolated worktree; do not blindly copy the archive or `git reset` to this baseline.
4. Run `npm ci`, `npm test`, `npm run test:blizzard`, `npm run build`. The download supplies a compiled `web-overlay/`, not a standalone served directory. In an isolated release, retain the verified original `public/` assets (music/models/tiles/GIS) from the matching source archive before copying the overlay; alternatively rebuild from the patched source for a complete `dist/`. Do not overwrite a newer installation. Reference-only photos are excluded.
5. Stage through the existing Muse deployment path only. Verify served build stamp and local assets. Capture the same five views on actual iPhone Safari, then record FPS, p95, draws, triangles, quality and device. Compare identical route/time/weather and confirm no >15% sustained regression.
6. Validate Bethel collision, road/curb traversal, vehicle entry, radio/music, mission progress, weather restore, save/load and touch safe areas. Do not declare the photographic accuracy of Mariners’ Home without fresh site references.
7. Submit staging evidence to Chat/Nic. Major production promotion awaits Nic’s acceptance. No game release was deployed by this build.
8. Rollback: retain the original served directory/config and known-good SHA. If staging fails, restore its prior directory atomically through the normal deploy path. Keep production unchanged. Revert only this candidate in its isolated branch if code rollback is needed; never delete saves/music or reset unrelated work.

W4, the Gmail trigger, South Coast 1986, hosting, credentials, domains and external communications were not changed by this work.
