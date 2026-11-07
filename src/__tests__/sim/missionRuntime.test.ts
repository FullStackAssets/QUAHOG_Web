import { describe, expect, it } from "vitest";
import { MissionRuntime } from "../../sim/MissionRuntime";

describe("MissionRuntime", () => {
  it("cleans owned entities on fail and retry", () => {
    const rt = new MissionRuntime();
    const cleaned: string[] = [];
    rt.start(0, 0);
    rt.claim({ id: "cop-1", kind: "chase", cleanup: () => cleaned.push("cop-1") });
    rt.claim({ id: "crate", kind: "prop", step: 0, cleanup: () => cleaned.push("crate") });
    expect(rt.ownedCount).toBe(2);

    rt.fail("busted");
    expect(rt.phase).toBe("failed");
    expect(cleaned).toEqual(["cop-1", "crate"]);
    expect(rt.ownedCount).toBe(0);

    rt.retry(0);
    expect(rt.phase).toBe("active");
    expect(rt.failReason).toBeNull();
  });

  it("fails when the step timer expires", () => {
    const rt = new MissionRuntime();
    rt.start(0, 0, 1.0);
    expect(rt.advance(0.4)).toBe(false);
    expect(rt.advance(0.7)).toBe(true);
    expect(rt.phase).toBe("failed");
    expect(rt.failReason).toBe("Time's up");
  });

  it("emits events on the bus", () => {
    const rt = new MissionRuntime();
    const seen: string[] = [];
    rt.onAny((e) => seen.push(e.type));
    rt.start(1, 0);
    rt.completeStep(1);
    rt.completeMission();
    expect(seen).toContain("mission.start");
    expect(seen).toContain("mission.step");
    expect(seen).toContain("mission.complete");
  });

  it("abandon clears ownership without leaving a soft-lock on hydrate", () => {
    const rt = new MissionRuntime();
    let cleaned = 0;
    rt.start(0, 1);
    rt.claim({ id: "escort", kind: "npc", cleanup: () => { cleaned++; } });
    rt.abandon();
    expect(cleaned).toBe(1);
    expect(rt.phase).toBe("abandoned");
    const snap = rt.serialize();
    rt.hydrate(snap);
    expect(rt.phase).toBe("active");
  });
});
