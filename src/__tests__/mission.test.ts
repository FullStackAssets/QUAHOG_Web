import { beforeEach, describe, expect, it } from "vitest";
import { CAMPAIGN_COMPLETE, MISSION_SAVE_KEY, missionStepMet, useMission } from "../mission";

const m = () => useMission.getState();

describe("useMission", () => {
  beforeEach(() => {
    localStorage.removeItem(MISSION_SAVE_KEY);
    m().reset();
  });

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

  it("advance persists the step so a later load continues the campaign", () => {
    m().advance();
    const progressed = { mi: m().mi, step: m().step, title: m().title, objective: m().objective };
    m().reset();
    expect(m().step).toBe(0);
    m().load();
    expect(m().mi).toBe(progressed.mi);
    expect(m().step).toBe(progressed.step);
    expect(m().title).toBe(progressed.title);
    expect(m().objective).toBe(progressed.objective);
    expect(m().done).toBe(false);
  });

  it("a finished campaign reloads as finished instead of the opener", () => {
    for (let i = 0; i < 200; i++) m().advance();
    expect(m().done).toBe(true);
    m().reset();
    m().load();
    expect(m().done).toBe(true);
    expect(m().objective).toBe(CAMPAIGN_COMPLETE);
    expect(m().steps[m().step]).toBeUndefined();
  });

  it("ignores a missing or corrupt save and keeps the opener", () => {
    m().load();
    expect(m().title).toBe("Off the Boat");
    localStorage.setItem(MISSION_SAVE_KEY, "{");
    m().load();
    expect(m().mi).toBe(0);
    localStorage.setItem(MISSION_SAVE_KEY, JSON.stringify([]));
    m().load();
    expect(m().step).toBe(0);
    localStorage.setItem(MISSION_SAVE_KEY, JSON.stringify({ mi: 0, step: 99, done: false }));
    m().load();
    expect(m().title).toBe("Off the Boat");
    expect(m().step).toBe(0);
    localStorage.setItem(MISSION_SAVE_KEY, JSON.stringify({ mi: -1, step: 0, done: false }));
    m().load();
    expect(m().mi).toBe(0);
    localStorage.setItem(MISSION_SAVE_KEY, JSON.stringify({ mi: 0.5, step: 0, done: false }));
    m().load();
    expect(m().step).toBe(0);
  });

  it("reset does not rewrite a saved campaign until save() is called", () => {
    m().advance();
    m().reset();
    m().load();
    expect(m().step).toBe(1);
    m().reset();
    m().save();
    m().load();
    expect(m().mi).toBe(0);
    expect(m().step).toBe(0);
    expect(m().objective).toBe(m().steps[0].text);
  });
});

describe("missionStepMet", () => {
  const target = { text: "reach", target: [0, 0, 0] as [number, number, number], radius: 10 };

  it("requires the car mode, not the boat or feet, when the step says so", () => {
    const step = { text: "grab a car", needCar: true };
    expect(missionStepMet(step, { mode: "car", police: 0, position: null })).toBe(true);
    expect(missionStepMet(step, { mode: "boat", police: 0, position: { x: 0, z: 0 } })).toBe(false);
    expect(missionStepMet(step, { mode: "foot", police: 0, position: { x: 0, z: 0 } })).toBe(false);
  });

  it("measures the supplied actor position, so a docked body cannot satisfy a distant boat", () => {
    expect(missionStepMet(target, { mode: "boat", police: 0, position: { x: 0, z: 0 } })).toBe(true);
    expect(missionStepMet(target, { mode: "boat", police: 0, position: { x: 40, z: 0 } })).toBe(false);
    expect(missionStepMet(target, { mode: "boat", police: 0, position: null })).toBe(false);
  });

  it("blocks a no-heat step at one or more police stars and allows fractional heat below one", () => {
    const step = { ...target, noHeat: true };
    expect(missionStepMet(step, { mode: "foot", police: 1, position: { x: 0, z: 0 } })).toBe(false);
    expect(missionStepMet(step, { mode: "foot", police: 0.99, position: { x: 0, z: 0 } })).toBe(true);
  });
});
