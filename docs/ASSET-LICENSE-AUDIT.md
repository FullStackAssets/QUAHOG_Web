# Asset license audit (§0.5 / §13.5 / RELEASE Legal)

Machine-checked by `npm run assets:audit` against `public/assets-licenses.json`.
Every shipped binary under `public/models` and `public/music` must appear here
(or be covered by a directory rule). Status meanings:

| Status | Meaning |
|--------|---------|
| `cleared` | License text + attribution known; OK for current non-commercial RC |
| `original` | Project-authored Mount Hope content |
| `pending-commercial` | Fine for RC playtests; **re-check before monetization** |
| `attribution-required` | Must keep on-screen / credits attribution |

## Inventory

| Id | Path / pattern | License | Status | Notes |
|----|----------------|---------|--------|-------|
| cesium-man | `public/models/CesiumMan.glb` | CC-BY 4.0 (Cesium sample) | cleared | Credits in PauseMenu + registry |
| lizzie | `public/models/lizzie.glb` | Original Mount Hope / Borden pack | original | See `docs/BORDEN-CONTENT.md` |
| remington-borden | `public/models/remington_borden.glb` | Original Mount Hope / Borden pack | original | See `docs/BORDEN-CONTENT.md` |
| model-previews | `public/models/previews/*.png` | Original Mount Hope / Borden pack | original | UI thumbnails only |
| osm-slice | `public/slice-*.json`, GIS JSON overlays | © OSM contributors, ODbL | attribution-required | StartMenu + PauseMenu |
| osm-tiles | `public/tiles/**` | Derived OSM bake | attribution-required | Same ODbL attribution |
| station-music | `public/music/{whale,mare,rage,anvil}/**/*.mp3` | ElevenLabs Music generation | pending-commercial | See `MUSIC.md`; royalty-free claim — confirm commercial terms before paid ship |
| radio-vo | `public/music/**/vo/**` | ElevenLabs TTS | pending-commercial | Same as above |
| aerial-esri | Esri World_Imagery XYZ (runtime) | Esri free endpoint | attribution-required | StartMenu + PauseMenu; no API key |
| three-stack | npm deps (three, R3F, rapier, …) | MIT / Apache-2.0 per package | cleared | npm licenses |

## Gaps still open for commercial

1. ElevenLabs Music + TTS: obtain/confirm commercial entitlement; keep generation prompts out of the product tree.
2. CesiumMan: CC-BY 4.0 attribution is in-game; keep credit if the asset stays.
3. Any future Cape/FR authored packs must land with a license row before merge.

## Accept

`npm run assets:audit` exits 0 when every on-disk GLB/MP3 and every registry model
has a matching license row. It does **not** assert commercial clearance of
`pending-commercial` rows.
