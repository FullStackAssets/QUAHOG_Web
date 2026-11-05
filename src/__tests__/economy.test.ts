import { beforeEach, describe, expect, it } from "vitest";
import { BUSINESSES, ownedBusinesses, rollRevenueEvent, useEconomy } from "../economy";

const eco = () => useEconomy.getState();

// Deterministic RNG sequence for rollRevenueEvent tests.
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("useEconomy", () => {
  beforeEach(() => useEconomy.setState({ owned: {}, near: null }));

  it("buy marks a front owned and ownedBusinesses reflects it", () => {
    expect(ownedBusinesses()).toHaveLength(0);
    eco().buy(BUSINESSES[0]);
    const owned = ownedBusinesses();
    expect(owned).toHaveLength(1);
    expect(owned[0].id).toBe(BUSINESSES[0].id);
  });

  it("incomePerSec sums perDay of owned fronts divided by the day length", () => {
    expect(eco().incomePerSec(60)).toBe(0);
    eco().buy(BUSINESSES[0]); // perDay 220
    eco().buy(BUSINESSES[1]); // perDay 320
    expect(eco().incomePerSec(60)).toBeCloseTo((220 + 320) / 60, 6);
  });

  it("rollRevenueEvent returns null when nothing is owned", () => {
    expect(rollRevenueEvent(() => 0.1)).toBeNull();
  });

  it("rollRevenueEvent produces a boom (positive) with a low good-roll", () => {
    eco().buy(BUSINESSES[0]);
    // rng calls: pick front (0), good check (<0.55 → boom), amount, text pool
    const ev = rollRevenueEvent(seq([0, 0.1, 0.5, 0]))!;
    expect(ev).not.toBeNull();
    expect(ev.good).toBe(true);
    expect(ev.amount).toBeGreaterThan(0);
    expect(ev.text).toContain(BUSINESSES[0].name);
  });

  it("rollRevenueEvent produces a leak (negative) with a high good-roll", () => {
    eco().buy(BUSINESSES[0]);
    const ev = rollRevenueEvent(seq([0, 0.9, 0.5, 0]))!;
    expect(ev.good).toBe(false);
    expect(ev.amount).toBeLessThan(0);
  });

  it("save/load round-trips owned fronts", () => {
    eco().buy(BUSINESSES[2]);
    eco().save();
    useEconomy.setState({ owned: {} });
    expect(ownedBusinesses()).toHaveLength(0);
    eco().load();
    expect(ownedBusinesses().map((b) => b.id)).toContain(BUSINESSES[2].id);
  });
});
