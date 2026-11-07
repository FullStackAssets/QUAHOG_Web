import { beforeEach, describe, expect, it } from "vitest";
import { useMission } from "../mission";

const m = () => useMission.getState();

describe("useMission", () => {
  beforeEach(() => m().reset());

  it("starts on the first mission, first step", () => {
    expect(m().mi).toBe(0);
    expect(m().step).toBe(0);
    expect(m().done).toBe(false);
    expect(m().title).toBe("Off the Boat");
    expect(m().objective).toBe(m().steps[0].text);
  });

  it("advance walks steps then chains to the next mission", () => {
    const firstTitle = m().title;
    const stepCount = m().steps.length;
    for (let i = 0; i < stepCount; i++) m().advance();
    // after finishing all steps of mission 0 we should be on mission 1, step 0
    expect(m().mi).toBe(1);
    expect(m().step).toBe(0);
    expect(m().title).not.toBe(firstTitle);
    expect(m().done).toBe(false);
  });

  it("objective always tracks the current step text", () => {
    m().advance();
    expect(m().objective).toBe(m().steps[m().step].text);
  });

  it("completing the whole campaign sets done and a terminal objective", () => {
    // advance a lot — more than the total number of steps across all missions
    for (let i = 0; i < 200; i++) m().advance();
    expect(m().done).toBe(true);
    expect(m().objective).toMatch(/complete/i);
  });

  it("reset returns to the opening mission", () => {
    for (let i = 0; i < 20; i++) m().advance();
    m().reset();
    expect(m().mi).toBe(0);
    expect(m().step).toBe(0);
    expect(m().done).toBe(false);
  });

  it("save then load restores mission progress", () => {
    m().advance();
    m().advance();
    const mi = m().mi;
    const step = m().step;
    m().save();
    m().reset();
    expect(m().step).toBe(0);
    m().load();
    expect(m().mi).toBe(mi);
    expect(m().step).toBe(step);
  });

  it("noteCarEnter latches enteredCarThisStep until advance", () => {
    expect(m().enteredCarThisStep).toBe(false);
    m().noteCarEnter();
    expect(m().enteredCarThisStep).toBe(true);
    m().advance();
    expect(m().enteredCarThisStep).toBe(false);
  });

  it("clearSave wipes persistence and returns to the opener", () => {
    m().advance();
    m().save();
    m().clearSave();
    expect(m().mi).toBe(0);
    expect(m().step).toBe(0);
    m().load();
    expect(m().mi).toBe(0);
  });

  it("fail then retry restores the active objective", () => {
    m().advance();
    const objective = m().objective;
    m().fail("busted");
    expect(m().phase).toBe("failed");
    expect(m().failReason).toBe("busted");
    m().retry();
    expect(m().phase).toBe("active");
    expect(m().objective).toBe(objective);
    expect(m().failReason).toBeNull();
  });

  it("abandon soft-resets the campaign cursor", () => {
    m().advance();
    m().abandon();
    expect(m().phase).toBe("abandoned");
    expect(m().mi).toBe(0);
    expect(m().step).toBe(0);
  });
});
