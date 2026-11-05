// NB slice improvements (2026-11-03): parked registry + taken flag,
// enter-target priority + heat policy, one-step opener, saved-car slot,
// infiniti profile fix.
import { describe, expect, it } from "vitest";
import { shared, type ParkedEntry, type TrafficCar } from "../shared";
import { publishParked, markParkedTaken, parkedKey } from "../world/ParkedCars";
import { pickEnterTarget, ENTER_HEAT, ENTER_LABEL, type EnterCandidates } from "../actors/enterTarget";
import { useMission } from "../mission";
import { useGame } from "../store";
import { carProfile } from "../earth/heroVehicleGeometry";
import { isCrossDistrictObjective } from "../districts";

// Stream A (2026-11-03): ParkedEntry no longer carries the old `pack`
// scenery flag; entries carry the rendered pack path (optional here —
// Player's enter branch maps by logic type when it is absent).
const parked = (x: number, z: number, packPath: string | undefined = undefined, hub = "core"): ParkedEntry => ({
  x, z, rot: 0, type: "mustang", color: "#111111", packPath, taken: false, hub,
});
const traffic = (): TrafficCar => ({ pos: { x: 0, y: 0, z: 0 } as never, yaw: 0, type: "bronco", color: "#222222", stop: 0, stolen: false });

const base: EnterCandidates = { traffic: null, trafficD: 4.5, parked: null, parkedD: 4.5, ownD: Infinity, boatD: Infinity };

describe("parked registry", () => {
  it("publishes per-hub lists into shared.parked and clears on unmount", () => {
    publishParked("core", [parked(1, 2), parked(3, 4)]);
    publishParked("mall", [parked(5, 6, undefined, "mall")]);
    expect(shared.parked).toHaveLength(3);
    publishParked("mall", null);
    expect(shared.parked).toHaveLength(2);
    publishParked("core", null);
    expect(shared.parked).toHaveLength(0);
  });

  it("markParkedTaken flags the entry and records its position key", () => {
    const e = parked(10, 20);
    publishParked("core", [e]);
    markParkedTaken(e);
    expect(e.taken).toBe(true);
    expect(shared.parked[0].taken).toBe(true);
    expect(parkedKey(10, 20)).toBe("10.0|20.0");
    publishParked("core", null);
    expect(shared.parked).toHaveLength(0);
  });
});

describe("enter target selection", () => {
  it("nearest traffic car wins a steal when nearer than own and parked", () => {
    expect(pickEnterTarget({ ...base, traffic: traffic(), trafficD: 2, parked: parked(0, 0), parkedD: 3, ownD: 4 })).toBe("steal");
  });

  it("nearest parked car wins when nearer than own car", () => {
    expect(pickEnterTarget({ ...base, parked: parked(0, 0), parkedD: 2, ownD: 3 })).toBe("parked");
  });

  it("own car wins when it is nearest", () => {
    expect(pickEnterTarget({ ...base, traffic: traffic(), trafficD: 4, parked: parked(0, 0), parkedD: 3, ownD: 2 })).toBe("own");
  });

  it("boat wins only when nearest and within 6 m", () => {
    expect(pickEnterTarget({ ...base, boatD: 5, ownD: 2 })).toBe("own");
    expect(pickEnterTarget({ ...base, boatD: 5, ownD: 8 })).toBe("boat");
    expect(pickEnterTarget({ ...base, boatD: 7, ownD: 8 })).toBe("none");
  });

  it("pack parked cars are never the target (scan skips them upstream)", () => {
    // The scan itself filters pack entries; here we pin the label contract
    // for the parked kind so a future scan change can't mislabel it.
    expect(ENTER_LABEL.parked).toBe("ENTER CAR");
    expect(ENTER_LABEL.steal).toBe("STEAL CAR");
  });

  it("own-car and parked enters add no heat; stealing does", () => {
    expect(ENTER_HEAT.own).toEqual([0, 0]);
    expect(ENTER_HEAT.parked).toEqual([0, 0]);
    expect(ENTER_HEAT.steal).toEqual([0.8, 0.4]);
  });
});

describe("one-step opener", () => {
  it("Off the Boat is exactly one step paying $250, then chains to Auction Rules", () => {
    const m = () => useMission.getState();
    m().reset();
    expect(m().title).toBe("Off the Boat");
    expect(m().steps).toHaveLength(1);
    expect(m().steps[0].text).toBe("Meet Deacon Mealy at Seamen's Bethel");
    expect(m().steps[0].target).toEqual([-272.23, 0, 106.5]);
    expect(m().steps[0].radius).toBe(10);
    expect(m().steps[0].reward).toBe(250);
    m().advance();
    expect(m().mi).toBe(1);
    expect(m().title).toBe("Auction Rules");
    expect(m().step).toBe(0);
    expect(m().objective).toBe("Grab a car — Sully's collectors are working the docks");
    expect(m().steps.length).toBeGreaterThan(1); // later missions stay multi-step
    m().reset();
  });
});

describe("saved-car slot", () => {
  it("defaults to the Revuelto and persists through setSavedCar", () => {
    const g = () => useGame.getState();
    expect(g().savedCarType).toBe("revuelto");
    expect(g().savedCarColor).toBe("#b81d24");
    g().setSavedCar("mustang", "#123456");
    expect(g().savedCarType).toBe("mustang");
    expect(g().savedCarColor).toBe("#123456");
    // restore the v1 default so no other suite sees a stray saved car
    g().setSavedCar("revuelto", "#b81d24");
  });
});

describe("infiniti profile", () => {
  it("no longer falls through to the generic default", () => {
    const p = carProfile("infiniti");
    expect(p.length).toBe(4.7);
    expect(p.width).toBe(1.85);
    expect(carProfile("definitely-not-a-car").length).toBe(4.6);
  });
});

describe("cross-district HUD objective gate", () => {
  it("flags an NB target while the player district is Fall River, and vice versa", () => {
    // Seamen's Bethel (opener target) is New Bedford; the Spindle City
    // target is inside the Fall River bbox.
    expect(isCrossDistrictObjective([-272.23, 0, 106.5], "fallRiver")).toBe(true);
    expect(isCrossDistrictObjective([-272.23, 0, 106.5], "newBedford")).toBe(false);
    expect(isCrossDistrictObjective([-20000, 0, -7400], "newBedford")).toBe(true);
    expect(isCrossDistrictObjective([-20000, 0, -7400], "fallRiver")).toBe(false);
  });
});
