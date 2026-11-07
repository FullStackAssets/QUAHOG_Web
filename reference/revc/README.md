# Reference archive (not a product dependency)

## Unified tree

All downloaded / uploaded zips are merged into:

```text
reference/revc/unified/
```

Build it (or rebuild) with the archives below. The folder is **gitignored** (~109 MB, ~1000 files).

| Artifact | Origin | Contributes |
|---|---|---|
| `reVC-miami.zip` | Drive `1M7Ia6ZHaIxyDGXCJ698Vh7-cTXwlp8kj` | Full project baseline |
| `uploads/Top_two_51d5.zip` | Chat upload | `android/`, `autoconf/` |
| `uploads/Files__5806.zip` | Chat upload | root build/docs (`premake*`, LICENSE, README) |
| `uploads/Last_3_f080.zip` | Chat upload | `src/`, `res/` |
| `uploads/Archive_6b71.zip` | Chat upload | `sdl2/`, `librw/`, `ogg/`, `opus/`, … |
| `uploads/openal-soft.zip` | Drive `1JHWfpdmA0du2dA12LygFDet9a0S4k2I3` | `openal-soft/` |

## Rules

- Do **not** import, copy, or transpile reconstructed C++ into `src/` (the QUAHOG_Web product tree).
- Do **not** ship Rockstar assets, maps, audio, or UI from these archives.
- QUAHOG_Web's independent layer lives in `/workspace/src/sim/` and is guided by
  `docs/reference/clean-room-engine-dossier.md`.

Zips, `extract/`, `uploads/`, and `unified/` are gitignored. Keep them local for research; never commit them.
