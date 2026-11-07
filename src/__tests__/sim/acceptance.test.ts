import { describe, expect, it } from "vitest";
import { allStagesGreen, runAllStages } from "../../sim/AcceptanceHarness";

describe("AcceptanceHarness", () => {
  it("stages 0–7 are green in headless", async () => {
    const results = await runAllStages();
    expect(results.length).toBeGreaterThanOrEqual(8);
    expect(allStagesGreen(results)).toBe(true);
  });
});
