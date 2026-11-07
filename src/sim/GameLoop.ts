/**
 * §1.1 Fixed-step GameLoop — accumulator + render interpolation.
 *
 * Sim-rate systems (subscribe to "step" / "postStep"):
 *   TrafficDirector, ChaseController, PedestrianAI, VehicleDynamics,
 *   boat physics, police heat decay, mission timers, economy ticks, weather.
 *
 * Render-rate systems (subscribe to "render" with alpha):
 *   CameraRig visual pose, HUD polling, mesh interpolation.
 *
 * Input phase runs once per frame before sim steps.
 */

export type LoopPhase = "input" | "step" | "postStep" | "render";
export type PauseSource = "menu" | "tab" | "cutscene" | "load" | "debug";

export interface LoopStats {
  stepMs: number;
  stepsThisFrame: number;
  accHighWater: number;
  overruns: number;
  timeScale: number;
  paused: boolean;
}

type PhaseCb = (dt: number, alpha: number) => void;

export interface GameLoopOptions {
  fixedDt?: number;
  maxFrameDt?: number;
  maxStepsPerFrame?: number;
  now?: () => number;
  onOverrun?: () => void;
}

export class GameLoop {
  readonly fixedDt: number;
  readonly maxFrameDt: number;
  readonly maxStepsPerFrame: number;

  private acc = 0;
  private lastNow = 0;
  private running = false;
  private pauseStack = new Map<PauseSource, number>();
  private scaleStack = new Map<PauseSource, number>();
  private subs: Record<LoopPhase, PhaseCb[]> = {
    input: [],
    step: [],
    postStep: [],
    render: [],
  };
  private now: () => number;
  private onOverrun: () => void;
  private overrunLastEmit = Number.NEGATIVE_INFINITY;

  stats: LoopStats = {
    stepMs: 0,
    stepsThisFrame: 0,
    accHighWater: 0,
    overruns: 0,
    timeScale: 1,
    paused: false,
  };

  constructor(opts: GameLoopOptions = {}) {
    this.fixedDt = opts.fixedDt ?? 1 / 60;
    this.maxFrameDt = opts.maxFrameDt ?? 0.25;
    this.maxStepsPerFrame = opts.maxStepsPerFrame ?? 5;
    this.now = opts.now ?? (() => performance.now());
    this.onOverrun = opts.onOverrun ?? (() => undefined);
  }

  on(phase: LoopPhase, cb: PhaseCb): () => void {
    this.subs[phase].push(cb);
    return () => {
      const list = this.subs[phase];
      const i = list.indexOf(cb);
      if (i >= 0) list.splice(i, 1);
    };
  }

  start(): void {
    this.running = true;
    this.lastNow = this.now();
    this.acc = 0;
  }

  stop(): void {
    this.running = false;
  }

  pause(src: PauseSource): void {
    this.pauseStack.set(src, (this.pauseStack.get(src) ?? 0) + 1);
    this.stats.paused = true;
  }

  resume(src: PauseSource): void {
    const n = (this.pauseStack.get(src) ?? 0) - 1;
    if (n <= 0) this.pauseStack.delete(src);
    else this.pauseStack.set(src, n);
    this.stats.paused = this.pauseStack.size > 0;
  }

  setTimeScale(src: PauseSource, scale: number): void {
    if (scale === 1) this.scaleStack.delete(src);
    else this.scaleStack.set(src, Math.max(0, Math.min(4, scale)));
    this.stats.timeScale = this.computeScale();
  }

  private computeScale(): number {
    let s = 1;
    for (const v of this.scaleStack.values()) s *= v;
    return Math.max(0, Math.min(4, s));
  }

  get alpha(): number {
    return this.acc / this.fixedDt;
  }

  /**
   * Drive one display frame. Pass raw wall-clock dt (seconds), or omit to
   * measure from the last call via `now()`.
   */
  tick(rawDt?: number): void {
    if (!this.running) return;

    const t0 = this.now();
    let dt: number;
    if (rawDt != null) {
      dt = rawDt;
      this.lastNow = t0;
    } else {
      dt = (t0 - this.lastNow) / 1000;
      this.lastNow = t0;
    }
    if (dt < 0) dt = 0;
    if (dt > this.maxFrameDt) dt = this.maxFrameDt;

    // Input always samples once per frame (even while paused — menus).
    for (const cb of this.subs.input) cb(dt, this.alpha);

    if (this.pauseStack.size > 0) {
      this.stats.stepsThisFrame = 0;
      this.stats.paused = true;
      for (const cb of this.subs.render) cb(0, this.alpha);
      return;
    }

    const scale = this.computeScale();
    this.stats.timeScale = scale;
    this.stats.paused = false;
    this.acc += dt * scale;
    if (this.acc > this.stats.accHighWater) this.stats.accHighWater = this.acc;

    let steps = 0;
    const stepT0 = this.now();
    while (this.acc >= this.fixedDt && steps < this.maxStepsPerFrame) {
      for (const cb of this.subs.step) cb(this.fixedDt, 0);
      for (const cb of this.subs.postStep) cb(this.fixedDt, 0);
      this.acc -= this.fixedDt;
      steps++;
    }
    if (this.acc >= this.fixedDt) {
      // Spiral guard: drop leftover beyond one frame's worth after cap.
      this.stats.overruns++;
      this.acc = Math.min(this.acc, this.fixedDt * 2);
      const nowMs = this.now();
      if (nowMs - this.overrunLastEmit > 1000) {
        this.overrunLastEmit = nowMs;
        this.onOverrun();
      }
    }
    this.stats.stepsThisFrame = steps;
    this.stats.stepMs = this.now() - stepT0;

    const a = this.acc / this.fixedDt;
    for (const cb of this.subs.render) cb(dt, a);
  }
}
