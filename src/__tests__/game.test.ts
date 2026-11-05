import { beforeEach, describe, expect, it } from "vitest";
import { useStats } from "../game";

const stats = () => useStats.getState();

describe("useStats", () => {
  beforeEach(() => stats().reset());

  it("starts with the canonical opening values", () => {
    const s = stats();
    expect(s.cash).toBe(250);
    expect(s.health).toBe(100);
    expect(s.police).toBe(0);
    expect(s.faction).toBe(0);
  });

  it("addCash never lets the wallet go negative", () => {
    stats().addCash(100);
    expect(stats().cash).toBe(350);
    stats().addCash(-10_000);
    expect(stats().cash).toBe(0);
  });

  it("setHealth clamps to 0..100", () => {
    stats().setHealth(250);
    expect(stats().health).toBe(100);
    stats().setHealth(-50);
    expect(stats().health).toBe(0);
  });

  it("heat clamps both axes to 0..5", () => {
    stats().heat(10, 10);
    expect(stats().police).toBe(5);
    expect(stats().faction).toBe(5);
    stats().heat(-10, -10);
    expect(stats().police).toBe(0);
    expect(stats().faction).toBe(0);
  });

  it("decay reduces heat over time but never below 0", () => {
    stats().heat(5, 5);
    stats().decay(10); // 10s * 0.05 = 0.5 off each axis
    expect(stats().police).toBeCloseTo(4.5, 5);
    expect(stats().faction).toBeCloseTo(4.5, 5);
    stats().decay(10_000); // large dt must floor at 0, not go negative
    expect(stats().police).toBe(0);
    expect(stats().faction).toBe(0);
  });

  it("decay is a no-op when there is no heat", () => {
    const before = stats();
    stats().decay(5);
    expect(stats().police).toBe(0);
    expect(stats().faction).toBe(0);
    expect(stats().cash).toBe(before.cash);
  });

  it("save then load round-trips the persisted stats", () => {
    stats().addCash(1000);
    stats().heat(3, 2);
    stats().save();
    stats().reset();
    expect(stats().cash).toBe(250);
    stats().load();
    expect(stats().cash).toBe(1250);
    expect(stats().police).toBe(3);
    expect(stats().faction).toBe(2);
  });
});
