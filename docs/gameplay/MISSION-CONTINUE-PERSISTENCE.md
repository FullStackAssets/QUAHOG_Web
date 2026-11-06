# Mission continue persistence

Date: 2026-11-06. Specialist note for this branch only. This file does not update `ROADMAP.md` and does not claim a production stage, playtest pass, or asset import.

## What was verified

| Document | Result |
|---|---|
| `ROADMAP.md` | Present at the repo root. Phase C names a mission framework with objective markers, triggers, states, and rewards. The stylized runtime already has that loop in `src/mission.ts` and `src/world/MissionRunner.tsx`. The roadmap's immediate stability pass is the photoreal `/earth.html` build. |
| `PRODUCTION-NEXT-PHASE.md` | Not in this checkout, not on `main` or the other remote branches, and not in `quahog-web-preview 2.zip`. |
| `QUAHOG-SINGLE-CONVERSATION-STATUS.md` | Not in this checkout, not on those branches, and not in that zip. |

No R3 archive was attached. Priorities below are from the files that are actually here plus the current `main` code. They are not a reconstructed next-phase list.

## Why this change

Other open work already covers the areas this branch was told to leave alone: draft PR #2 (facade / PBR / water), the photoreal `earth.html` Google 3D Tiles track, asset-loader / Meshopt import, deployment checks, and the Safari playtest harness. Draft PR #1 also already edits the HUD, minimap, chase camera, and road-marking files. Those files were not modified here.

The highest-impact gameplay hole left on `main` is campaign continuity. Continue restores `mounthope.save.v1` (cash, health, heat), `mounthope.economy.v1`, scrimshaw, and `mounthope.pos.v1`. Mission index and step lived only in memory, so Continue put the player back on "Off the Boat" while keeping their wallet and location. Standing inside the opener radius, or already in a car for a `needCar` step, let `MissionRunner` complete that step again and pay its reward on top of the restored cash.

## What changed

- `mounthope.mission.v1` stores `{ mi, step, done }` only. Step text and targets stay in code. Load rejects non-integers, out-of-range indexes, arrays, and broken JSON, and leaves the opener in place. `done: true` reloads the terminal campaign line.
- `advance()` writes that blob immediately. The step's cash reward is written to the wallet save in the same completion, so a quit cannot restore the next objective without the cash already paid.
- Autosave and page-hide write the mission blob next to the existing stats save. New Game deletes the key. Pause "Reset progress" writes the cleared wallet and the opener so a refresh cannot bring the old campaign back.
- Mission checks and the player-placed waypoint use the active actor. Boat mode reads the hull, not the on-foot body disabled at the dock. The big-map blip, first open, and recenter use the same rule. `needCar` is still car-only; piloting the boat does not satisfy it.

## Tests actually run

On this branch, after `npm ci`:

- `npm test` (Vitest 2.1.9): **39/39 passed**, 6 files. Mission file is 12 tests (save/load, corrupt and out-of-range blobs, finished campaign, car-vs-boat step rule, radius, heat gate). Presence file is 3 tests. The previous five files still pass (game 7, economy 6, quality 5, race 6).
- `npx tsc --noEmit`: exit 0.

No browser, WebGL, Rapier, or device session was run. Continue, boat objectives, and the big-map blip were not clicked in a running client.

## Remaining gameplay and asset blockers

- Legacy saves with no `mounthope.mission.v1` still Continue at "Off the Boat" with the old wallet and position. There is no migration flag in the old blob.
- A `needCar` step with no target still completes on the next frame if the player is already driving. That matches the previous rule; it was not retuned.
- `HUD.tsx` and `Minimap.tsx` still measure the on-foot body while `mode === "boat"`. They are in the open playtest branch and were left untouched. The big map and the completion checks on this branch follow the hull.
- Leaving the boat still moves the player to the Long Island dock (`EXIT` in `src/actors/Boat.tsx`). That is the authored "step off onto the dock" behavior, not changed here.
- Continue from a saved `mode: "boat"` still restores on foot. `applyRestore` only special-cases the car.
- Pause "Reset progress" still does not clear owned fronts, scrimshaw, or the position blob.
- No iPhone or desktop playthrough of Continue, boat objectives, or reward payout was run.
- CesiumMan, hero GLBs, reference photos, and the soundtrack were not audited or replaced. `ROADMAP.md` was not edited. Nothing here deploys, merges, or spends.
