import { beforeEach, describe, expect, it } from "vitest";
import { CHECKPOINTS, useRace } from "../race";

const r = () => useRace.getState();

describe("useRace", () => {
  beforeEach(() => useRace.setState({ active: false, idx: 0, time: 0, best: null }));

  it("start activates the race and resets progress", () => {
    useRace.setState({ idx: 3, time: 42 });
    r().start();
    expect(r().active).toBe(true);
    expect(r().idx).toBe(0);
    expect(r().time).toBe(0);
  });

  it("tick accrues time only while active", () => {
    r().tick(1); // inactive → ignored
    expect(r().time).toBe(0);
    r().start();
    r().tick(1.5);
    expect(r().time).toBeCloseTo(1.5, 6);
  });

  it("hit advances checkpoints and returns null until the final one", () => {
    r().start();
    for (let i = 0; i < CHECKPOINTS.length - 1; i++) {
      expect(r().hit()).toBeNull();
      expect(r().idx).toBe(i + 1);
    }
  });

  it("finishing the last checkpoint returns the reward and records best", () => {
    r().start();
    r().tick(30);
    let reward: number | null = null;
    for (let i = 0; i < CHECKPOINTS.length; i++) reward = r().hit();
    expect(reward).toBeGreaterThan(0);
    expect(r().active).toBe(false);
    expect(r().best).toBeCloseTo(30, 6);
  });

  it("best keeps the fastest of multiple runs", () => {
    // first run: 30s
    r().start();
    r().tick(30);
    for (let i = 0; i < CHECKPOINTS.length; i++) r().hit();
    expect(r().best).toBeCloseTo(30, 6);
    // second run: 20s (faster) → best updates
    r().start();
    r().tick(20);
    for (let i = 0; i < CHECKPOINTS.length; i++) r().hit();
    expect(r().best).toBeCloseTo(20, 6);
  });

  it("cancel deactivates and clears progress", () => {
    r().start();
    r().tick(5);
    r().cancel();
    expect(r().active).toBe(false);
    expect(r().idx).toBe(0);
    expect(r().time).toBe(0);
  });
});
