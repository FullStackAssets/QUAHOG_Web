import { describe, expect, it } from "vitest";
import { blockedWaterEntry } from "../world/waterZones";

// Water-entry block (2026-11-02): entry is refused only when the NEXT point
// is blocked water and the current point is not. A body already wet can
// always move back out, and dry-land moves are untouched.
describe("blockedWaterEntry", () => {
  // Toy water: everything east of x = 10 is blocked.
  const blocked = (x: number) => x > 10;
  it("blocks land -> water", () => {
    expect(blockedWaterEntry(9, 0, 11, 0, blocked)).toBe(true);
  });
  it("allows water -> water (so a wet body can keep moving)", () => {
    expect(blockedWaterEntry(11, 0, 12, 0, blocked)).toBe(false);
  });
  it("allows water -> land (the way back out)", () => {
    expect(blockedWaterEntry(11, 0, 9, 0, blocked)).toBe(false);
  });
  it("allows land -> land", () => {
    expect(blockedWaterEntry(5, 0, 9, 0, blocked)).toBe(false);
  });
});
