import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("SouthCoast landmark photographic evidence gates", () => {
  it("matches the frozen named-footprint registry against source geometry without accepting missing photos", () => {
    const cmd = spawnSync(process.execPath, [
      "scripts/verify_landmark_reference_gates.mjs", "--json",
    ], { encoding: "utf8" });
    expect(cmd.status, cmd.stderr || cmd.stdout).toBe(0);
    const result = JSON.parse(cmd.stdout);
    expect(result.passed).toBe(true);
    expect(result.records).toBe(19);
    expect(result.named_geometry_candidates).toBe(13);
    expect(result.exact_named_markers).toBe(4);
    expect(result.front_edges_confirmed).toBe(0);
    expect(result.frontal_shots_accepted).toBe(0);
    expect(result.physically_verified_photo_to_polygon).toBe(0);
    expect(result.blocked).toBe(19);
    expect(result.deployment_performed).toBe(false);
    expect(result.errors).toEqual([]);
  });
});
