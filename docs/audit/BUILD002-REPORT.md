# Build 002 Report — New Bedford GIS district integration

**Date:** 2026-10-19
**Baseline commit (pre-build):** `9295b91`
**Build commit:** `62f6d1e` (+ `bfa20b1` docs)
**Directive:** Integrate 62 real New Bedford GIS footprints + MassDOT roads into the playable world. Preserve gameplay.

## Baselines (step 1)

| Suite | Result |
|---|---|
| App tests (`npm test`) | 29/29 pass |
| GIS Build 001 tests (`test_build.py`) | 4/4 pass (deps installed to `~/workspace/venvs/narrows-gis`) |
| Production build (`npm run build`) | exit 0 |

## Buildings (step 2)

- Source: `the_narrows_build001/data/new-bedford-waterfront/` — 62 buildings, MassGIS roofprints, EPSG:26986.
- Converted to slice-local metres (same frame as `slice-newbedford.json`): SP → lon/lat → slice-local via the slice's `meters_per_degree`.
- **Alignment verified:** the game's hand-placed Seamen's Bethel landmark converts to State Plane (248013, 820696); the nearest GIS building (`massgis:201:248015_820696`) is **2 m** away. The conversion is correct.
- **Duplicates prevented:** 58 of 62 GIS footprints overlap an existing OSM blockout (tiles `b_-1_-1`, `b_-1_0`); those blockouts are filtered at load via an index+centroid-verified replacement map (`src/world/gisDistrict.ts`). 4 GIS buildings are genuinely new geometry.
- **Heights:** inherited from the replaced blockout (58) or a documented 8 m default (4). `heightSource` recorded per building. No invented "illustrative" heights presented as real.
- **Colliders:** every GIS footprint gets a Rapier collider (`colliderRadius={400}` on the district layer).
- Rendered through the existing `<Buildings>` pipeline — same materials, shadows, near/far split as OSM blockouts.
- Output: `public/gis-district-newbedford.json`. Visual proof: `docs/audit/build002-district-alignment.svg`.

## Roads (step 3)

- Source: MassDOT `EOTROADS_ARC` (409,586 shapes statewide, NAD83 / MA State Plane metres).
- **Projection corrected:** SP → slice-local via the slice origin; validated by alignment.
- **Alignment:** 82 MassDOT lines in the district vs 259 OSM roads — MassDOT→OSM nearest-line distance p50 **1.6 m**, p90 4.3 m. The OSM network is denser (footways, alleys); a full geometry swap would have *removed* 177 roads, so OSM remains the rendered geometry.
- **Connectivity:** 164/164 MassDOT road endpoints connect to the network (100%).
- **Integration shipped:** 79 unnamed OSM district roads now carry MassDOT street names (street signs show real names, e.g. Barkers Lane, Rodman Street); converted MassDOT district roads shipped as `public/massdot-roads-district.json` for future work.

## Study technique ports (step 4)

- `DebugStats` HUD now shows **draw calls + triangle counts** (via `gl.info.render`, sampled by `<PerfProbe/>` inside the Canvas). Supports the "measured, not assumed" gate.
- Quality presets now **drive render DPR**: Low → 1, Medium → up to 1.25, High → up to 1.5 (was fixed [1, 1.5] regardless of setting).
- No gameplay, physics, or control code touched.

## Deploy + verification (steps 5–6)

- Preview: GitHub Pages from the `preview` branch of `Full-Stack-Assets/QUAHOG_Web`.
- App tests 29/29 and build clean after all changes.
- **Not yet done:** real iPhone Safari playtest (Nic), 3D screenshots of the integrated district (pending live preview).

## Remaining defects / known limits

1. GIS heights are estimated from replaced blockouts (documented per building); true heights need the 2025 aerials or field survey (Build 003).
2. 4 GIS buildings use the 8 m default height — visually plausible, not surveyed.
3. No 3D screenshots yet — no local WebGL renderer; will capture from the live preview.
4. The `preview` branch deploy is still pushing (large binary assets); URL follows once Pages serves it.
