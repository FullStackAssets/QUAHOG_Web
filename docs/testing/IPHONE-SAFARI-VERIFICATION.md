# Main-game iPhone Safari verification

Scope for this checklist: the stylized main game (`index.html` / `src/main.tsx`), its tests, and the isolated performance harness. Google 3D Tiles / `earth.html` is a separate agent's work and is not a result in this document. Main-game production gate scripts are also a separate agent's work. Nothing here deploys, merges, spends, or opens an account.

The R3 archive was described in the task and was not attached to this workspace. It was not inspected. The audit notes under `docs/audit/` and the handoff under `docs/reference-pack/` were read. They are not that archive. `quahog-web-preview 2.zip` was not treated as the R3 archive and was not inspected.

## Human gate — still open

A physical iPhone, in Safari, still has to play the main game for **10 minutes** at **Low**, **10 minutes** at **Medium**, and **10 minutes** at **High**. This environment has no physical iPhone. That gate was not run. Browser emulation, WebKit, SwiftShader, headless Chromium, and desktop Chrome are not that session and must never be written up as one.

| Check | Low | Medium | High |
|---|---|---|---|
| 10 minutes of waterfront traversal on a physical iPhone in Safari | human gate — not run | human gate — not run | human gate — not run |
| Thumbstick walks the player with no keyboard | human gate — not run | human gate — not run | human gate — not run |
| On-screen CAR enters and exits a vehicle | human gate — not run | human gate — not run | human gate — not run |
| RUN and BRAKE hold for the whole press | human gate — not run | human gate — not run | human gate — not run |
| FIRE and HIT work with no mouse | human gate — not run | human gate — not run | human gate — not run |
| Canvas stays up (no context-loss reload) | human gate — not run | human gate — not run | human gate — not run |
| Audio starts after a touch | human gate — not run | human gate — not run | human gate — not run |
| Phone heat, in the player's own words | human gate — not run | human gate — not run | human gate — not run |

Whoever holds the phone should record the device model, iOS version, and Safari version in their own notes. Frame rate belongs in those notes only when that person reads it off the on-device debug HUD (`?debug` or `` ` ``) during the session. This repository run did not read that HUD and does not contain a frame rate or a temperature.

## What this environment is

Observed on the agent VM while preparing this checklist:

- Linux x86_64, Node v22.23.4
- No Safari binary, no WebKit framework, no iOS Simulator
- Google Chrome 156.0.8078.47 is installed. It was not launched. A Chrome window, headless session, WebKit build, or SwiftShader fallback would be desktop or software rendering, not physical iPhone Safari
- A filesystem search found no SwiftShader library. SwiftShader was not run
- No phone was attached

`npm test` and `node --experimental-strip-types scripts/testing/run-main-game-harness.ts` are the checks that were actually available. Their output is process-level. `elapsedMs` in the harness report is wall-clock around a bounded call loop. It is not a frame time.

On 2026-11-06 this VM recorded `npx vitest run` at 11 files / 67 tests, all passed, and `npx tsc --noEmit` exiting 0. The CLI report from that same run had `label` `not-physical-iphone-safari`, `fps` null, `thermal` null, and `physicalTraversal.performedInThisRun` false. The wall-clock figure in that report is not copied here, so it cannot be reused as a frame time.

## Automated coverage

These tests do not close the human gate. They lock behavior that a phone session depends on, using the Node vitest harness (`vitest.config.ts`, `src/__tests__/setup.ts`):

| Check | Where |
|---|---|
| Virtual stick range, release, tap-vs-hold, RUN/BRAKE | `src/__tests__/touchInput.test.ts` |
| On-screen button actions, coarse-pointer gate, layout key, DPR caps, viewport, audio resume on pointerdown | `src/__tests__/mobileContract.test.ts` |
| Private-mode storage throws are swallowed | `src/__tests__/storage.test.ts` |
| Corrupt stat and economy saves cannot inject non-finite cash | `src/__tests__/game.test.ts`, `src/__tests__/economy.test.ts` |
| Mission steps stay finite and `advance` stops at the end | `src/__tests__/mission.test.ts` |
| Quality radii and impostor rings | `src/__tests__/quality.test.ts` |
| East/north mapping, water barrier, road sampling | `src/__tests__/worldDeterminism.test.ts` |
| Bounded sampler, surface classification, CLI report | `src/__tests__/perfHarness.test.ts` |

The DPR contract locked by the mobile test is the current main-game table: Low `1`, Medium `[1, 1.25]`, High `[1, 1.5]`. That is a source lock, not a measurement of fill rate on a phone.

## Harness

`src/testing/perfHarness.ts` is not imported by the game, by `src/earth`, or by materials and loaders. The CLI is:

```sh
node --experimental-strip-types scripts/testing/run-main-game-harness.ts
```

The CLI workload is an inline integer mix. It does not import the renderer. A vitest case also times `viewRadius`, `tileImpostor`, `moveAxis`, `toWorld`, and `isBlockedWater` for 2,000 iterations each, under a 5 second hang guard. That guard is there so a runaway loop fails the test. It is not a frame budget.

Every report from this harness sets:

- `label`: `not-physical-iphone-safari`
- `physicalIphoneSafari`: `false`
- `fps`: `null`
- `thermal`: `null`
- `readsRenderer`: `false`
- `physicalTraversal.performedInThisRun`: `false`
- `r3Archive.attachedToWorkspace`: `false`
- `r3Archive.inspected`: `false`

`classifySurface` keeps that label for WebKit, SwiftShader, browser emulation, headless Chromium, Chrome, and any name that asks for a phone or Safari. There is no argument that flips the device bit.

## Tooling blockers

1. No physical iPhone, so the 10-minute Low / Medium / High Safari traversal cannot be run here.
2. No Safari, WebKit, or iOS Simulator in this VM.
3. Desktop Chrome is present and was left unused on purpose, so a software renderer cannot be mistaken for the phone.
4. The R3 archive was not attached, so archive-specific steps were not checked off from it.
5. This harness does not sample `gl.info`, the debug HUD, or device thermals. Those exist only in a real browser session and were not observed.
6. Passing `npm test` does not show that the canvas, the thumbstick, or the audio unlock work on a phone. The audit notes already say the main game had no device pass. That is still true.
