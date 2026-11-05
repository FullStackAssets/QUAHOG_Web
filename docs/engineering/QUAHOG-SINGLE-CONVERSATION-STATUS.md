# QUAHOG / The Narrows — single-conversation working baseline

Date: 2026-11-01T18:55:04+00:00 (UTC)
Scope: game implementation and coordination, this QUAHOG project conversation.

## One place, one source, one active implementation
- All new game instructions, changes, QA, evidence and release decisions stay in this conversation. The user should be able to say **Continue** here; no moving work between other chat threads or copying handoff prompts.
- Use the attached **QUAHOG_Cinematic_Mobile_Merged_Source_2026-11-01.zip** as the current **local candidate**, not GitHub main or an expired deployment transfer. Candidate commit: `7c6ce35e05e697f9f285682de6fa3dc354b24e26`.
- Do not invent live VM access or treat the imported local commit as a verified production ancestor. Before altering a live environment, compare the deployment and rollback state to this candidate.
- Do not invoke Muse unless specifically requested. Any unavailable deployment permissions are reported here rather than silently delegated. Nothing is deployed without explicit authorization.
- Existing Blizzard staging is **user-accepted** (reported in chat) and production stays on Build 003A (reported). No new deployment was initiated.

## Verified checks in this conversation
- Full source archive SHA-256: `49bd9fbada0d3b4592d5be5471c69e3d586c130305510e6e043cf29ceca31112`. ZIP CRC check passed.
- All 1,195 source files in ZIP matched the extracted isolated checkout byte-for-byte.
- Node 22 built-in checks: **11/11 architectural tests pass**, **7/7 Blizzard tests pass**.
- The globally available TypeScript 5.6 parser checked **142 TypeScript/TSX files, 0 syntax errors**. This is a syntax check, not a typecheck.
- Source preservation report records 1,001 unchanged public assets, including 26 music files, and 24 protected code files. The preservation manifest reports no mismatches. The current extracted public/music directory contains 26 files.
- `npm ci` could not resolve registry tarballs (EAI_AGAIN). This environment does not have Vite/Vitest/React/Three dependencies, so **full typecheck, 50+ unit tests, Vite build and rendered browser QA remain BLOCKED/UNVERIFIED** for this candidate. No claims of a successful new build are made.
- Physical iPhone Safari FPS, p95 frame time, thermals, touch interactions, navigation, saved sessions and long-session stability remain UNVERIFIED for this candidate.

## Preserved project boundaries
Keep the existing React/TypeScript/Vite, Three/R3F, Rapier, GIS, missions, vehicles, music, radio, fast-travel and saves. Preserve source rights, existing music and private files. Keep Google Photorealistic 3D Tiles separate from independent game geometry. No migration, public release or spending without approval. Stage before major production promotion and protect an established rollback.

## Immediate technical backlog
1. Reestablish pinned npm dependencies in a permitted reproducible build runtime. Run `npm ci`, `npm test`, `npm run test:blizzard`, `npm run build` and capture exact output/hash. If unavailable, report the blocker rather than substitute syntax parsing for a build.
2. Compare and visually verify the cinematic facade and rooftop batches on the downtown Johnny Cake Hill → waterfront route, matching the mobile baseline quality preset.
3. Check the seven 003A fixes (camera wall clipping, Bethel safe spawn, GIS duplicate exclusion, pedestrian avoidance, sidewalk normals/materials, clapboard textures, touch HUD) against real gameplay behavior.
4. Improve walk/run/turn animation and vehicle/camera traversal, then implement road-connected navigation with actual route topology.
5. Test an isolated candidate on actual iPhone Safari, recording FPS, p95, draw calls, triangle count, quality/device and save/restore. No >15% sustained frame-time regression without approval.

## Communication protocol
Give one concise progress report here with `[Verified]`, `[Reported]`, `[Blocked]` or `[Planned]`, the changed files and source/build SHA. Never claim deployment, production acceptance or a passing full build without fresh evidence. This document is a status ledger, not an invitation for separate agents or duplicate implementation.
