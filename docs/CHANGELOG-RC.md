# Changelog — release candidate track

## Unreleased / RC

### Added
- Independent open-world sim layer (`GameLoop`, `PedGraph`, `MissionRuntime`, `SaveGame` v2, heat tiers, streamer metrics).
- Borden character pack (Lizzie, Remington Borden) with Character menu picker.
- Asset license catalog (`public/assets-licenses.json`) + `npm run assets:audit`.
- Fog/rain stream-radius scaling; boat Continue persistence; fixed-step car/boat.

### Changed
- Earth demoted to diagnostic (`docs/EARTH-DECISION.md`); stylized canvas is the product boot.
- Continue gate requires stats + position + mission; New Game clears unified + legacy domains.

### Known blockers (not in this RC)
- Cape Cod / Fall River authored tiles (campaign mid/late map).
- Named-device FPS matrix + 30-minute stream memory soak (measurement pending).
- ElevenLabs music/TTS commercial entitlement confirmation (`pending-commercial` in license audit).
