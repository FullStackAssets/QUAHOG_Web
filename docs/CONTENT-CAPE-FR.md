# Cape / Fall River content status (§7.3)

**Status:** Blocked on authored tile/road data. Code scaffolding is ready.

## Ready in code

- `WorldManifest` builds zones/markers from the loaded slice
- Mission chain already references distant FR/Cape coordinates (e.g. Braga Bridge, USS Massachusetts)
- Businesses include Dartmouth Mall + Long Island marina

## Missing authored data

| District | Roads | Tiles | Landmarks | Collectibles |
|----------|-------|-------|-----------|--------------|
| Fall River downtown | — | — | partial heroes | — |
| Cape / Hyannis | — | — | — | — |
| Brockton | — | — | — | — |

## Unblock plan

1. Export OSM slices for FR / Cape / Brockton into `public/` (same schema as New Bedford).
2. Extend tile bake pipeline for those bboxes.
3. Register zones in `WorldManifest` + streamer tile keys.
4. Re-enable Act II/III mission beats once driving from NB reaches non-void.

Until then, mid-campaign destinations remain reachable only as empty space.
