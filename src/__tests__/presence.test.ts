import { describe, expect, it } from "vitest";
import { activeHeading, activePlanarPosition } from "../presence";

const bodies = {
  foot: { x: 1, z: 2 },
  car: { x: 10, z: 20 },
  boat: { x: 100, z: 200 },
};

describe("active actor", () => {
  it("reads the body for the current mode and ignores the others", () => {
    expect(activePlanarPosition("foot", bodies)).toEqual(bodies.foot);
    expect(activePlanarPosition("car", bodies)).toEqual(bodies.car);
    expect(activePlanarPosition("boat", bodies)).toEqual(bodies.boat);
  });

  it("returns null when the active body is missing", () => {
    expect(activePlanarPosition("boat", { foot: bodies.foot, car: bodies.car, boat: null })).toBeNull();
    expect(activePlanarPosition("car", { foot: bodies.foot })).toBeNull();
    expect(activePlanarPosition("foot", {})).toBeNull();
  });

  it("uses boat yaw while piloting", () => {
    const headings = { foot: 0.2, car: 1.2, boat: -0.4 };
    expect(activeHeading("boat", headings)).toBe(-0.4);
    expect(activeHeading("car", headings)).toBe(1.2);
    expect(activeHeading("foot", headings)).toBe(0.2);
  });
});
