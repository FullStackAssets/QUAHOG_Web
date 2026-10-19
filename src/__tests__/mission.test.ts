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
});
