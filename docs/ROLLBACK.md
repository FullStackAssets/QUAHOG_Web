# Rollback notes (RC)

## What “rollback” means here

This product ships as a static web build (Vite → `dist/`). Rollback is
**redeploy the previous known-good `dist/` / git SHA**, not a database migration.

## Procedure

1. Identify the last green SHA from the release checklist / deploy log.
2. `git checkout <sha>` (or re-download that CI artifact).
3. `npm ci && npm test && npm run build`.
4. Redeploy `dist/` with the same host config (`vercel.json` or static host).
5. Hard-refresh clients; localStorage save domains are forward-compatible within
   schema v2 — older clients ignore unknown fields.

## Save compatibility

| Schema | Key | Notes |
|--------|-----|-------|
| v2 | `mounthope.save.v2` (see `SAVE_KEYS`) | Current unified blob |
| legacy | stats / pos / mission / inventory / radio / … | Still read by Continue migrate |

Clearing saves: New Game → `clearAllSaves()`. Manual: remove `mounthope.*` keys.

## Do not roll back into

- Mixing an old `dist/` with newer authored Cape/FR tiles that the old streamer
  cannot address — prefer rolling tiles + JS together.
- Re-enabling earth as the primary boot without revisiting `EARTH-DECISION.md`.

## Evidence to keep

- Git SHA deployed
- `npm test` + `npm run assets:audit` exit codes
- Host URL + deploy timestamp (America/New_York)
