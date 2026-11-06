import { beforeEach, describe, expect, it } from "vitest";
import inputSrc from "../input.ts?raw";
import { consumeTap, isDown, moveAxis, setVirtualHold, setVirtualMove, virtualTap } from "../input";

// Every on-screen control in TouchControls feeds one of these codes. Clearing
// them keeps the module-level tap and hold sets deterministic across cases.
const CODES = [
  "Mouse0", "KeyE", "KeyG", "KeyF", "Space", "ShiftLeft", "KeyV", "KeyH", "KeyM",
  "KeyP", "KeyB", "KeyC", "KeyO", "KeyT", "KeyR",
  "Digit1", "Digit2", "Digit3", "Digit4",
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
];

function releaseTouch() {
  setVirtualMove(0, 0);
  for (const code of CODES) {
    setVirtualHold(code, false);
    consumeTap(code);
  }
}

describe("touch movement and button pipeline", () => {
  beforeEach(releaseTouch);

  it("reads the virtual stick and clamps each axis to the unit range", () => {
    setVirtualMove(0.25, -0.5);
    expect(moveAxis()).toEqual({ x: 0.25, y: -0.5 });

    setVirtualMove(2, -3);
    expect(moveAxis()).toEqual({ x: 1, y: -1 });

    setVirtualMove(-2, 3);
    expect(moveAxis()).toEqual({ x: -1, y: 1 });
  });

  it("returns the stick to zero on release", () => {
    setVirtualMove(1, 1);
    expect(moveAxis()).toEqual({ x: 1, y: 1 });
    setVirtualMove(0, 0);
    expect(moveAxis()).toEqual({ x: 0, y: 0 });
  });

  it("treats a virtual tap as one shot and not as a held key", () => {
    virtualTap("KeyE");
    expect(isDown("KeyE")).toBe(false);
    expect(consumeTap("KeyE")).toBe(true);
    expect(consumeTap("KeyE")).toBe(false);
  });

  it("coalesces repeated taps of the same code until something consumes it", () => {
    virtualTap("Mouse0");
    virtualTap("Mouse0");
    expect(consumeTap("Mouse0")).toBe(true);
    expect(consumeTap("Mouse0")).toBe(false);
  });

  it("holds and releases sprint and brake without moving the stick", () => {
    expect(moveAxis()).toEqual({ x: 0, y: 0 });
    setVirtualHold("ShiftLeft", true);
    setVirtualHold("Space", true);
    expect(isDown("ShiftLeft")).toBe(true);
    expect(isDown("Space")).toBe(true);
    expect(moveAxis()).toEqual({ x: 0, y: 0 });

    setVirtualHold("ShiftLeft", false);
    expect(isDown("ShiftLeft")).toBe(false);
    expect(isDown("Space")).toBe(true);
    setVirtualHold("Space", false);
    expect(isDown("Space")).toBe(false);
  });

  it("keeps a held button down while a different tap is consumed", () => {
    setVirtualHold("ShiftLeft", true);
    virtualTap("KeyE");
    expect(consumeTap("KeyE")).toBe(true);
    expect(isDown("ShiftLeft")).toBe(true);
    expect(consumeTap("ShiftLeft")).toBe(false);
  });

  it("locks the keyboard-plus-stick formula without starting the window listeners", () => {
    // installInput() binds key and gamepad listeners and an animation-frame
    // loop. The node harness does not start that loop. This asserts the
    // combine-and-clamp formula still names the physical keys the stick adds to.
    const src = inputSrc;
    expect(src).toContain("clamp1(x + virtual.x + gamepadMove.x)");
    expect(src).toContain('isDown("KeyW") || isDown("ArrowUp")');
    expect(src).toContain('isDown("KeyS") || isDown("ArrowDown")');
    expect(src).toContain('isDown("KeyD") || isDown("ArrowRight")');
    expect(src).toContain('isDown("KeyA") || isDown("ArrowLeft")');
    expect(src).toContain("Math.abs(n) < 0.18");
  });
});
