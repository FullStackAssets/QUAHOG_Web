# Station music (legit, royalty-free)

The radio's music stations (WHALE = `whale`, Maré Alta = `mare`) play real MP3
tracks when present and **fall back to the procedural synth bed** when not. Each
station loads `public/music/<id>/manifest.json` at runtime:

```json
{ "tracks": ["track1.mp3", "track2.mp3"] }
```

A track entry may be **either**:
- a bare filename → served from `public/music/<id>/` (committed to the repo), or
- an **absolute URL** (`https://…`) → served as-is (webhook → Blob/CDN delivery).

The radio picks a random track, plays it, and advances on `ended`.

## Generating the tracks

### A) Local / synchronous (simplest)
`scripts/gen_music.py` calls ElevenLabs Music synchronously and writes the MP3s
+ manifest straight into `public/music/<id>/`:
```
ELEVENLABS_API_KEY=sk_... python3 QUAHOG_Web/scripts/gen_music.py
# optional: TRACKS_PER_STATION=3 LENGTH_MS=75000
```
Then commit `public/music/`. Run this somewhere with network access to
`api.elevenlabs.io` (a normal dev machine).

> Note: the Claude-on-the-web container blocks `api.elevenlabs.io` by egress
> policy (`x-deny-reason: host_not_allowed`). To let Claude generate music in a
> web session, add `api.elevenlabs.io` to the environment's network egress
> allowlist.

### B) Webhook / async (for long-form composed tracks)
1. Request async generation from ElevenLabs Music with a callback URL.
2. ElevenLabs `POST`s your endpoint when the track is ready.
3. Your endpoint uploads the MP3 to durable storage (Vercel Blob / S3 / any CDN)
   — a Vercel function **cannot** write into `public/` at runtime (read-only,
   ephemeral).
4. Add the resulting absolute URL to `public/music/<id>/manifest.json` (the radio
   already accepts absolute URLs) and commit, or serve the manifest itself from
   storage and point the fetch at it.

If you want, Claude can scaffold `api/music-webhook.ts` (signature verify +
Vercel Blob upload + manifest update) — say which storage you're using.
