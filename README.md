# Quahog — live lineage (private repo)

> **This is the live game.** The tree in this repo is the combined R4 tree that
> serves https://quahog.fullstackassets.com (production bundle `main-RYjrXl5f.js`
> as of 2026-11-05, detail pass live). `main` is the live-merged lineage; every
> production deploy is a tag (`prod-<YYYYMMDD>-<label>`).
>
> **History:** the old public repo `Full-Stack-Assets/QUAHOG_Web` (main HEAD
> `73450d2`, 2026-10-19, pre-003A) is pre-history only — not a source. Never
> fetch from it, never merge it in (it is older than everything live). The
> original engine-slice README below is kept for reference; the game has moved
> far beyond it — see `docs/` and the handoff notes in the repo.
>
> **Music never enters this repo** (see `.gitignore` + `scripts/check-no-music.sh`).
> Production deploys stay manual: backup → `rsync --delete --exclude 'music/'` →
> verify (see `SETUP.md` in the repo-setup draft).

# Mount Hope — Web 3D Vertical Slice

The browser-playable engine slice for **Mount Hope**, an original open-world game
set on the real Massachusetts South Coast.

This is the **plan-agnostic engine slice** (Step 3): third-person walk, car
enter/drive, collision, on the real **New Bedford waterfront** street grid +
auto-extruded building blockout pulled from OpenStreetMap.

## Stack

Three.js · React Three Fiber · @react-three/rapier (physics/collision) ·
zustand · Vite + TypeScript. 100% web — no native build step.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle to dist/
npm run preview  # serve the production build
```

## Controls

| Key | On foot | Driving |
|-----|---------|---------|
| `W A S D` / arrows | walk (camera-relative) | throttle / steer / brake |
| `E` | steal/enter the car (when near) | exit the car |

The chase camera eases behind whichever actor is active.

## What's in the slice

- **Real street grid** — 561 OSM road centerlines (Johnny Cake Hill, William /
  Union / Water St, MacArthur Dr…) rendered as flat ribbons.
- **Building blockout** — 316 OSM footprints auto-extruded with per-building
  convex-hull colliders (the "graybox" world-building technique).
- **Landmarks** — 15 named POIs with floating labels; the five **hero** buildings
  (Seamen's Bethel, Whaling Museum, Mariner's Home, Double Bank Building, Rodman
  Candleworks) are gold with neon marker beams, ready for hand-detailing.
- **Street life** — ambient kinematic pedestrians wandering the district plus
  decorative traffic that drives the real road network (ported from the legacy
  Unity `StreetLife.cs`).
- **Coastal Neon** starter look — dusk key light + harbor fog.

## Data

The world loads `public/slice-newbedford.json` — a slice-local blockout (origin
= bbox center, meters; `x` = east, `z` = -north, `y` = up). It's generated from
OpenStreetMap by
[`../quahog-project-files/mapdata/make_slice.py`](../quahog-project-files/mapdata/make_slice.py)
(raw pull: `nb_slice.osm.json`). To re-pull/re-bake, see the mapdata README.

Map data © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).

## Source layout

```
src/
  main.tsx, App.tsx        entry + Canvas + HUD
  Experience.tsx           scene graph: lights, fog, physics world
  slice.ts                 slice loader + types + coord mapping
  input.ts, shared.ts, store.ts   input, cross-component refs, UI state
  actors/  Player · Car · FollowCamera
  world/   Ground · Roads · Buildings · Landmarks
```

## Not yet (next slice work)

Hand-detailed Seamen's Bethel, fish-pier ambush mission scaffold, weather +
friction, audio, smarter pedestrian/traffic AI (collision avoidance, traffic
signals). The project name still needs to change off "Quahog" (seeds:
Quequechan, Spindle City, Mount Hope).

## Satellite ground (Google Static Maps, signed)

The world can drape a real aerial image over the streets via the Google Maps
**Static** API, signed server-side by `api/staticmap.ts` (a Vercel function) so the
key/secret never reach the browser. To enable, set in **Vercel → Project →
Settings → Environment Variables** and redeploy:

- `GOOGLE_MAPS_API_KEY` — your key (Maps Static API enabled, billing on)
- `GOOGLE_MAPS_URL_SIGNING_SECRET` — the "URL signing secret" for that key

Without these (or on local `vite dev`, which doesn't run the function) it falls
back silently to the procedural ground. Imagery © Google.
