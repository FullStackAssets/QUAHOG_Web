# Earth build decision record (§2.11 / R1)

**Date:** 2026-11-07  
**Decision:** Demote `earth.html` to **diagnostic / photoreal preview** for the Mount Hope release path. The stylized canvas remains the sole playable product boot.

## Rationale

1. The stylized build already owns the shared sim layer (`SimBootstrap`, RoadGraph, PedGraph, MissionRuntime, SaveGame). Duplicating that stack into earth diverges permanently (risk R1).
2. Earth depends on Google 3D Tiles auth/quota with no fallback ground — known void failure mode on iPhone.
3. Shipping one playable loop (stylized) unblocks SaveGame, missions, heat, and content without waiting on tile stability.

## Consequences

- Earth keeps existing tile viewer + actors for diagnostics; no requirement to wire missions/wanted/economy into earth before M8.
- Shared modules under `src/sim/` may still be imported by earth later if a future decision reverses this.
- Start menu photoreal link remains available and labeled as diagnostic.

## Revisit triggers

- Google tile auth/fallback ground (§2.10) lands and a real-device soak is green.
- Product explicitly prioritizes photoreal as the primary play mode.
