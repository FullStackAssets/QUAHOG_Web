import { describe, expect, it } from "vitest";
import expSrc from "../Experience.tsx?raw";
import hpSrc from "../world/HarborProps.tsx?raw";
import wfSrc from "../world/Waterfront.tsx?raw";
import { DRESSING_ENABLED } from "../world/dressing";

// Clutter removal (2026-11-03, Nic: "Eliminate the solid gray dumpsters
// and the blue structure and any other similar items"): PortClutter's
// shipping containers (blue/gray solid boxes) survived the minimalist
// switch because the NB harbor layers were district-gated only. These
// tests pin the gate so a later edit can't silently re-expose the clutter.
// JSX gates can't be exercised without rendering, so the mount wiring is
// asserted at the source level — via ?raw imports, the same pattern the
// slice tests use for the shipped JSON (no node: imports: tsconfig types
// are vite/client only, so node:fs has no declarations here).

describe("harbor clutter gating", () => {
  it("dressing switch is OFF — gated mounts render nothing until Nic flips it", () => {
    expect(DRESSING_ENABLED).toBe(false);
  });

  it("PortClutter mount in Experience.tsx is gated by DRESSING_ENABLED", () => {
    const idx = (expSrc as string).indexOf("<PortClutter");
    expect(idx).toBeGreaterThan(-1);
    const window = (expSrc as string).slice(Math.max(0, idx - 200), idx);
    expect(window).toContain("DRESSING_ENABLED");
  });

  it("HarborProps land-side gear boxes are gated by DRESSING_ENABLED", () => {
    const gearMesh = (hpSrc as string).indexOf("<instancedMesh ref={gearRef}");
    expect(gearMesh).toBeGreaterThan(-1);
    // The gear instancedMesh JSX must sit inside a DRESSING_ENABLED conditional.
    const window = (hpSrc as string).slice(Math.max(0, gearMesh - 400), gearMesh);
    expect(window).toContain("DRESSING_ENABLED");
  });

  it("Waterfront renders no boxes (pilings + buoys only) — nothing to gate", () => {
    expect(wfSrc as string).not.toContain("boxGeometry");
  });
});
