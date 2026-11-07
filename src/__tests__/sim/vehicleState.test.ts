import { describe, expect, it, vi } from "vitest";
import { canEnter, enterCar, exitCar, yawQuat } from "../../sim/VehicleState";

describe("VehicleState", () => {
  it("canEnter respects radius", () => {
    expect(canEnter(3, 4.5)).toBe(true);
    expect(canEnter(9, 4.5)).toBe(false);
  });

  it("enterCar disables the player and zeros car velocity", () => {
    const player = {
      setEnabled: vi.fn(),
      setTranslation: vi.fn(),
      setLinvel: vi.fn(),
      translation: () => ({ x: 1, y: 2, z: 3 }),
    };
    const car = {
      setTranslation: vi.fn(),
      setLinvel: vi.fn(),
      setRotation: vi.fn(),
      translation: () => ({ x: 10, y: 1.4, z: 20 }),
    };
    const setCarYaw = vi.fn();
    const setMode = vi.fn();
    const clearNear = vi.fn();
    expect(
      enterCar({
        handles: { player, car },
        yaw: 1.2,
        setCarYaw,
        setMode,
        clearNear,
      }),
    ).toBe(true);
    expect(player.setEnabled).toHaveBeenCalledWith(false);
    expect(car.setLinvel).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 }, true);
    expect(setMode).toHaveBeenCalledWith("car");
    expect(setCarYaw).toHaveBeenCalledWith(1.2);
  });

  it("exitCar re-enables the player beside the car", () => {
    const player = {
      setEnabled: vi.fn(),
      setTranslation: vi.fn(),
      setLinvel: vi.fn(),
      translation: () => ({ x: 0, y: 0, z: 0 }),
    };
    const car = {
      setTranslation: vi.fn(),
      setLinvel: vi.fn(),
      setRotation: vi.fn(),
      translation: () => ({ x: 0, y: 1.4, z: 0 }),
    };
    const setCarSpeed = vi.fn();
    expect(
      exitCar({
        handles: { player, car },
        yaw: 0,
        setMode: vi.fn(),
        setCarSpeed,
        sideOffset: 3,
      }),
    ).toBe(true);
    expect(player.setEnabled).toHaveBeenCalledWith(true);
    expect(setCarSpeed).toHaveBeenCalledWith(0);
    const pos = player.setTranslation.mock.calls[0][0] as { x: number; z: number };
    expect(Math.hypot(pos.x, pos.z)).toBeCloseTo(3, 5);
  });

  it("yawQuat matches half-angle convention", () => {
    const q = yawQuat(Math.PI);
    expect(q.y).toBeCloseTo(1, 5);
    expect(q.w).toBeCloseTo(0, 5);
  });
});
