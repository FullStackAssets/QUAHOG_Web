# QUAHOG / The Narrows — Blizzard of February 2026 Integration

**Local source implementation. Not deployed.** Base: user-provided `quahog-web-main.zip`.

## Scope completed
- Replaces the playable mission named **Gloria** with **Blizzard of '26**.
- Keeps the original mission progression, coordinates, checkpoints and cash rewards.
- Changes story mission steps to a February 23 storm emergency, with 52-inch snowdrifts.
- Adds a snow weather state, weather-locked mission activation, and restoration to the player's earlier weather afterward.
- Adds camera-centered quality-scaled snowfall (240/540/960 particles).
- Adds snow-tinted atmosphere and a moving snow-covered terrain plane (including beyond the New Bedford core).
- Snow-tints road and sidewalk materials.
- Adds instanced decorative roadside drifts up to 1.32 m (52 inches), without modifying collision or blocking routes.
- Applies reduced speed and steering authority to the player's car on snowy roads.
- Adds Weather menu preview (clear → rain → snow → clear), mission lockout, and a storm HUD alert.

## Historical and fictional boundary
The February 22–23, 2026 blizzard was real. Published local snowfall totals include **37 inches in New Bedford** and **up to 41 inches in Fall River**. The **52-inch figure is used for fictionalized GAME DRIFTS**, not as a verified citywide fresh snowfall total.

Sources (accessed 2026-10-29):
- CBS Boston: https://www.cbsnews.com/boston/news/snow-totals-boston-massachusetts-february-23-2026/
- New Bedford Light: https://newbedfordlight.org/new-bedford-walloped-by-largest-snowstorm-in-city-history/
- Massachusetts Government Hydrologic Conditions, February 2026: https://www.mass.gov/doc/2026-february-hydrologic-conditions-pdf/download

## Verification completed
- `node --experimental-strip-types --test scripts/tests/blizzard-2026.test.mjs`: 7 / 7 passed.
- `node scripts/tests/check-typescript.cjs ...`: 13 changed TypeScript/TSX files parsed without syntax errors.
- No full `npm test` or `npm run build` was possible: Node dependencies are absent, and registry requests failed with EAI_AGAIN.
- **No in-browser rendering, iPhone Safari performance, mission traversability, or staging validation performed.**

## Run in a development workspace
1. Extract `QUAHOG_Web_Blizzard_2026_Source.zip`.
2. `npm ci`
3. `npm run test:blizzard`
4. `npm test`
5. `npm run build`
6. `npm run dev`, check snow from Weather setting, then play to **Blizzard of '26**.
7. Profile on an actual iPhone Safari; confirm frame time, visibility, collision, weather restoration, and route viability.

Deployment is not authorized by this package. Muse remains deployment/site-maintenance operator only, subject to the user's release approval.

## Known follow-up
- Snow surface and snowbanks are visual, not persistent ground accumulation or deep-snow collision physics.
- Vehicle traction is first-pass arcade tuning, not a tire model.
- No snowplow AI, snow-clearing mechanics, road graph closures, outage simulation, snow depth map or new animations yet.
- The broader 2026 world conversion and remaining generic buildings are separate tasks; this package addresses the storm, not every game upgrade.
