import { describe, expect, it } from "vitest";
import { GameLoop } from "../../sim/GameLoop";

describe("GameLoop", () => {
  it("steps a fixed number of times independent of display rate", () => {
    const steps60: number[] = [];
    const steps30: number[] = [];

    const mk = (sink: number[]) => {
      const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 8 });
      loop.on("step", (dt) => sink.push(dt));
      loop.start();
      return loop;
    };

    const a = mk(steps60);
    // 1 second at 60Hz display
    for (let i = 0; i < 60; i++) a.tick(1 / 60);

    const b = mk(steps30);
    // 1 second at 30Hz display
    for (let i = 0; i < 30; i++) b.tick(1 / 30);

    expect(steps60.length).toBe(60);
    expect(steps30.length).toBe(60);
    expect(steps60.every((d) => d === 1 / 60)).toBe(true);
  });

  it("pause stack blocks steps but still runs input/render", () => {
    const loop = new GameLoop({ fixedDt: 1 / 60 });
    let steps = 0;
    let renders = 0;
    let inputs = 0;
    loop.on("step", () => { steps++; });
    loop.on("render", () => { renders++; });
    loop.on("input", () => { inputs++; });
    loop.start();
    loop.pause("menu");
    loop.tick(1 / 60);
    expect(steps).toBe(0);
    expect(renders).toBe(1);
    expect(inputs).toBe(1);
    loop.resume("menu");
    loop.tick(1 / 60);
    expect(steps).toBe(1);
  });

  it("time scale slows sim elapsed", () => {
    const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 20 });
    let steps = 0;
    loop.on("step", () => { steps++; });
    loop.start();
    loop.setTimeScale("cutscene", 0.25);
    // 2s wall → ~0.5s sim → ~30 steps
    for (let i = 0; i < 120; i++) loop.tick(1 / 60);
    expect(steps).toBeGreaterThanOrEqual(28);
    expect(steps).toBeLessThanOrEqual(32);
  });

  it("caps steps per frame and records overruns", () => {
    const overruns: number[] = [];
    const loop = new GameLoop({
      fixedDt: 1 / 60,
      maxFrameDt: 1,
      maxStepsPerFrame: 3,
      onOverrun: () => overruns.push(1),
    });
    loop.on("step", () => undefined);
    loop.start();
    loop.tick(1); // would need 60 steps; capped at 3
    expect(loop.stats.stepsThisFrame).toBe(3);
    expect(loop.stats.overruns).toBeGreaterThan(0);
    expect(overruns.length).toBe(1);
  });
});
