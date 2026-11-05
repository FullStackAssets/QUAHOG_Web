# Integrating the 2026 kit into QUAHOG_Web

Do not start a second game runtime and do not replace existing source blindly.

## November 1 priority and source correction
Nic requested immediate visual aesthetics. Implement that pass before the previously proposed minimap-first merge. The October 29 Blizzard source archive is available in an isolated Work checkout; the original `~/workspace/quahog-web` was reported destroyed. Do not reset or overwrite it. Preserve all source archive music/GIS bytes. Verify the current VM tree and ancestry before staging; this local archive does not establish the current deployed SHA.

The February 2026 blizzard supersedes the fictional modern hurricane direction. Snowfall, drifts, winter roads, mission activation/restoration and reduced vehicle traction already exist in the source. The 52-inch number is a game drift target.

## 1. Inspect first
- Verify the recovered isolated source and current VM tree (commit, archive hash, working tree); never touch the destroyed original checkout.
- Identify minimap, map projection, camera, player, vehicle movement and animation-mixer sources.
- Read historical source paths only if still present: `src/mission.ts`, `src/world/MissionRunner.tsx`, `src/world/Safehouse.tsx`, `src/world/Experience.tsx`, `src/slice.ts`, `src/places.ts`, `src/world/Rain.tsx`, `src/world/DayNight.tsx`, `src/world/Heroes.tsx`, `src/world/HurricaneBarrier.tsx`, `src/store.ts`.
- Verify whether the player and car use +z or -z as forward, actual geographic world axes and units. Do not assume map x/z correspond to east/north.

## 2. First playable win: minimap pointer
- Port tested `heading.ts` behind an adapter, not by overwriting current files.
- Assert the arrow faces the road's driving direction regardless of camera rotation.
- Test all cardinal and diagonal headings for pedestrian and vehicle.
- In heading-up mode, map tiles rotate while the icon remains pointing up.
- Validate tap targets, safe areas and orientation on an actual iPhone Safari build.

## 3. Real GPS
- Build a verified connected road graph from drivable game geometry and MassGIS-MassDOT roads after coordinate reprojection.
- Add one-way and turn restrictions manually where the data is insufficient; never allow water-spanning imaginary edges.
- Snap to nearest *drivable edge* in production (prototype currently snaps to nodes).
- Port `route.ts` and `guidance.ts`; connect to landmark destination selection, UI route overlay and reroute cooldown.
- Storm closures must refer to known road edge IDs.

## 4. Unique buildings
- Keep existing GIS footprints, collider positions and heights as source-of-truth.
- Assign building IDs, land use and districts; use `buildingStyles.ts` to select deterministic material/roof/facade patterns.
- Implement actual facade geometry and material bindings in the existing render pipeline.
- Hand-model signature buildings and commercial/port landmarks with legally sourced reference data.
- Use material atlases, LOD, instancing and quality budgets; profile draw calls.

## 5. Animation and vehicle handling
- Inspect avatar rig before mapping animation clip plans. Implement physical movement first; then retarget clips and crossfade.
- The vehicle prototype is a tuning baseline. Preserve actual collision/suspension physics and integrate only after movement audit.
- Add enter/exit alignment and collision transitions, road friction and fixed-step behavior.

## 6. Modern storytelling and the February 2026 blizzard
- Preserve the current `Acquitted` and `Gloria` mission IDs/save data; introduce modern IDs rather than overwriting.
- The proposed contemporary Bordon heir in the source pack is **not approved canon**.
- Historical 1892 and 1985 events must remain backstory. The playable modern storm is the February 2026 blizzard, with fictionalized gameplay/drift depth.
- Bind symbolic story locations to verified landmarks, build the Maplecroft Highlands hub, implement safehouse unlock flag and mission progression.
- The recovered October 29 source supports clear/rain/fog/snow and already mounts snowfall and snowbanks. Extend those components; do not introduce a duplicate weather engine.

## 7. Delivery/release
- Work builds and tests on the authoritative source tree and provides source commit, changed files, test outcomes, preview, iPhone screenshots, performance and remaining blockers.
- Muse performs staging deployment and verifies live served bytes/title/assets. Product owner authorizes major production release.
- South Coast 1986, Gmail trigger, and held messages remain untouched.

## Geodata references
- MassGIS-MassDOT roads: https://www.mass.gov/info-details/massgis-data-massgis-massdot-roads
- MassGIS layer catalog: https://www.mass.gov/info-details/massgis-data-layers
- GIS data access: https://www.mass.gov/get-massgis-geospatial-data
