import { describe, expect, it } from "vitest";
import { fitTouchLayout } from "../ui/touchLayout";

describe("touch layout rotation recovery", () => {
  it("brings saved landscape controls within a portrait viewport", () => {
    const saved = { stick: { left: 20, top: 250, size: 130 }, fire: { left: 750, top: 260, size: 62 } };
    const fitted = fitTouchLayout(saved, 390, 844, { left: 12, right: 12, top: 47, bottom: 34 });
    expect(fitted.fire.left + fitted.fire.size).toBeLessThanOrEqual(378);
    expect(fitted.stick).toEqual(saved.stick);
    expect(saved.fire.left).toBe(750);
  });
  it("rejects nonfinite saved positions and clamps oversized controls", () => {
    const fitted = fitTouchLayout({ stick: { left: NaN, top: -50, size: 500 } }, 320, 240);
    expect(fitted.stick.left).toBeGreaterThanOrEqual(8);
    expect(fitted.stick.top).toBeGreaterThanOrEqual(8);
    expect(fitted.stick.top + fitted.stick.size).toBeLessThanOrEqual(232);
  });
});
