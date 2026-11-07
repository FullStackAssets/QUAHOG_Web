# Mount Hope — Release checklist (§17.9)

Gate for M8 / release candidate. Check off only with evidence.

## Product

- [x] Earth demoted to diagnostic (`docs/EARTH-DECISION.md`)
- [x] Canonical brand on start menu (`BRAND.name`)
- [ ] Mid/late campaign map content (Cape / Fall River) — **blocked on authored tiles**
- [x] Continue disabled without pos+mission+stats
- [x] New Game clears unified + legacy save domains

## Sim

- [x] Fixed-step `GameLoop` with pause stack
- [x] Heat tier table + ★5 APB no-decay
- [x] Ammo inventory spend/reload + persistence
- [x] `WorldStreamer` evict/unwanted grace
- [x] All AI on fixed step (peds/traffic/heat/economy/car/boat)

## Quality

- [x] `npm test` green
- [x] `tsc --noEmit` green
- [x] Acceptance harness stages 0–7 (`AcceptanceHarness`)
- [ ] Named-device FPS matrix (§12.1) measured — template in `docs/FPS-MATRIX.md`
- [ ] 30-min stream memory soak — protocol in `docs/FPS-MATRIX.md`

## Legal / ops

- [x] Asset license catalog + `npm run assets:audit` (coverage 100%; ElevenLabs still `pending-commercial`)
- [x] Changelog entry for RC (`docs/CHANGELOG-RC.md`)
- [x] Rollback notes (`docs/ROLLBACK.md`)
