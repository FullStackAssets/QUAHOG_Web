// Idle / walk / run for both the rigged human (clip time scale) and the rigid
// photoreal humanoid (joint angles). Thresholds sit between the stylized walk
// (6.5 m/s) and sprint (~11 m/s), and between the photoreal walk (4.5) and run (9).

export type Gait = "idle" | "walk" | "run";

export const RUN_SPEED = 7.5;

export function gaitFor(speed: number, moving = true): Gait {
  if (!moving || !(speed >= 0.25)) return "idle";
  if (speed >= RUN_SPEED) return "run";
  return "walk";
}

export function clipTimeScale(gait: Gait): number {
  if (gait === "run") return 1.65;
  if (gait === "walk") return 1;
  return 0;
}

export function gaitStep(phase: number, gait: Gait, dt: number): number {
  const rate = gait === "run" ? 14 : gait === "walk" ? 9 : 0;
  return phase + Math.max(0, dt) * rate;
}

export function gaitPose(phase: number, gait: Gait): { legL: number; legR: number; armL: number; armR: number; bob: number } {
  if (gait === "idle") return { legL: 0, legR: 0, armL: 0, armR: 0, bob: 0 };
  const amp = gait === "run" ? 0.95 : 0.6;
  const s = Math.sin(phase) * amp;
  return {
    legL: s,
    legR: -s,
    armL: -s * 0.8,
    armR: s * 0.8,
    bob: Math.abs(Math.sin(phase)) * (gait === "run" ? 0.08 : 0.05),
  };
}

/** Prefer a named walk/run clip when the GLB has one. Idle keeps the first clip and pauses it. */
export function pickClip(names: string[], gait: Gait): string | null {
  if (!names.length) return null;
  if (gait === "idle") return names[0];
  const wanted = gait === "run" ? ["run", "jog", "sprint"] : ["walk", "move"];
  const lower = names.map((name) => name.toLowerCase());
  for (const token of wanted) {
    const index = lower.findIndex((name) => name.includes(token));
    if (index >= 0) return names[index];
  }
  return names[0];
}
