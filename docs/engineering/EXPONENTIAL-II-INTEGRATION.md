# QUAHOG / The Narrows: Exponential Expansion II, first living-world slice

Date: 2026-11-01. Sole game implementation workspace: the present QUAHOG conversation. Source: isolated, previously validated mobile cinematic candidate at `12dde5e13c134eb30c75cd8cfbb52290b9596dba`. **Undeployed.** Existing accepted Blizzard staging and production Build 003A are not changed.

## Input and authoritative interpretation

The three user-supplied original files are preserved, byte-for-byte, under `docs/vision/`:
- `Exponential Expansion II Philosophy.txt` is a **vision**, with three laws: persistent consequences, cross-system feedback, and observable interiority. It proposes AAA-scale systems, a 60× time clock, and a 4–6-year production. These are proposals, not current capabilities.
- `Actionable Task Breakdown.txt` is a **future long-term task inventory** (P0–P5). The minimum viable world, small integrated sandbox, build pipeline, event log and persistence are its first critical gates. Its proposed large team, new ECS/job system and renderer are **not automatically approved** migrations.
- `Exponential Expansion Rendering(1).txt` is a **technical and artistic wish list**, not evidence that SSR, ray-marched volumetrics, motion matching, MetalFX or millions of simulated particles are present. This first slice does not claim those features.

## Implemented without engine migration

1. `worldContinuity.ts`: a bounded, versioned event model, defensive parsing, deterministic 64-event cap, and a capped offline game-clock advance of at most six in-game hours. Older saves lacking `savedAtMs` load without jumping. No invented offline NPC behavior, mission completion or cash payout.
2. `worldJournal.ts`: storage-backed recently-happened log under `mounthope.world.events.v1`, with previous-known-good backup fallback, bounded runtime observers and a reset on New Game. Existing mission/position/economy save keys remain unchanged.
3. `GameSystems.tsx`: records weather changes, real business purchases, revenue changes, police escalation/escape, mission progression and new game days. Each record uses the active game clock. Weather now feeds live owned-business income, at 0.93× in rain and 0.85× in snow. These are intentionally small balancing assumptions, not researched real-world economic figures. No offline income is generated.
4. `WorldJournalPanel.tsx`, `HUD.tsx`, `game.css`: a compact, touch-accessible **Journal** in the existing action menu, with a bounded scrollable overlay for real observed game events. The default HUD remains compact; no extra full-screen simulation canvas or postprocessing pass.
5. `StartMenu.tsx`: New Game clears history; Continue resumes it. This preserves current gameplay and the original save format.
6. `scripts/tests/world-continuity.test.mjs`: dependency-free tests of schema rejection, retention, event identity, long-absence cap, time rollover, mission event text bounds and weather-income multiplier.

## Known limits, not implemented

This is an event-based *world memory prototype*, not a complete event-sourced simulation. NPC schedules, traffic rerouting, collision-aware interiors, offline AI, police evidence graphs, commodity simulation, economic stock or shop inventories, fire propagation, new accessibility modes and shader/renderer migration remain unimplemented. The existing game clock continues to use the current 600-second day cycle, not the proposed 60× speed. Old NPC/entity state is not magically persistent. New Game continues to clear mission progress using existing rules.

## Release gates

- [Verified locally] Node's dependency-free architecture, Blizzard and continuity checks pass. Count and details are in `EXPONENTIAL-II-TESTS.txt`.
- [Verified locally] Existing 1,001 public files, including all 26 music files, and 23 protected core gameplay files match the imported follow-up archive byte-for-byte. Existing module/layout syntax checked with the global TypeScript parser.
- [Blocked] Full `npm ci`, `vitest run`, `tsc --noEmit` and `vite build` could not be completed because the package registry was unavailable and this environment has no complete pinned dependency cache. Parse success is **not** a passing TypeScript typecheck, app build or runtime integration test.
- [Unverified] Real Safari playback, HUD overlap, event persistence across iPhone process termination, full-world FPS, p95 frame time, draw calls and a 15% frame-time regression check.

## Next specific integration step

First restore pinned npm dependencies in the **same authorized QUAHOG implementation workspace**, rerun `npm test`, `npm run test:blizzard`, `npm run build`, and complete a mobile gameplay smoke pass. Then connect one named recurring NPC to a schedule that uses this clock and writes small observable events; use strict distance-based AI LOD and integrate with existing roads/GIS. Do not scale into a citywide ECS replacement before that one-NPC vertical slice is proven on an actual iPhone.

No Muse work, infrastructure change, deployment, spending, new automation or external outreach was performed.
