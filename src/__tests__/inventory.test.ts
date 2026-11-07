import { beforeEach, describe, expect, it } from "vitest";
import { useInventory } from "../inventory";

describe("inventory ammo", () => {
  beforeEach(() => useInventory.getState().reset());

  it("spends magazine then reloads from reserve", () => {
    const inv = useInventory.getState();
    expect(inv.spend("pistol")).toBe(true);
    expect(useInventory.getState().magPistol).toBe(11);
    // empty mag
    useInventory.setState({ magPistol: 0 });
    expect(useInventory.getState().spend("pistol")).toBe(false);
    expect(useInventory.getState().reload("pistol")).toBe(true);
    expect(useInventory.getState().magPistol).toBe(12);
  });
});
