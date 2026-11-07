/**
 * §1.12 Stage 0–7 acceptance harness (headless-friendly).
 * Each stage returns pass/fail with a reason; CI can run `runAllStages()`.
 */

import { canContinue, validateSave, collectLegacySave } from "./SaveGame";
import { heatTier, desiredCops } from "./HeatTiers";
import { GameLoop } from "./GameLoop";
import { Rng } from "./Rng";
import { validateManifest, manifestFromSlice } from "./WorldManifest";
import type { Slice } from "../slice";

export interface StageResult {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
}

export type StageFn = () => StageResult | Promise<StageResult>;

const stages: { id: string; name: string; run: StageFn }[] = [
  {
    id: "0",
    name: "boot",
    run: () => {
      const loop = new GameLoop();
      loop.start();
      loop.tick(1 / 60);
      return { id: "0", name: "boot", ok: loop.stats.stepsThisFrame >= 1, detail: `steps=${loop.stats.stepsThisFrame}` };
    },
  },
  {
    id: "1",
    name: "determinism",
    run: () => {
      const a = new Rng(7, "traffic");
      const b = new Rng(7, "traffic");
      const ok = Array.from({ length: 32 }, () => a.next()).every((v, i) => {
        void i;
        return v === b.next();
      });
      // re-run for detail
      const a2 = new Rng(7, "traffic");
      const b2 = new Rng(7, "traffic");
      const match = Array.from({ length: 32 }, () => a2.next() === b2.next()).every(Boolean);
      return { id: "1", name: "determinism", ok: match, detail: match ? "rng match" : "rng drift" };
    },
  },
  {
    id: "2",
    name: "heat-tiers",
    run: () => {
      const ok = desiredCops(2) === 1 && heatTier(5).noDecay;
      return { id: "2", name: "heat-tiers", ok, detail: `t2=${desiredCops(2)} apb=${heatTier(5).noDecay}` };
    },
  },
  {
    id: "3",
    name: "continue-gate",
    run: () => {
      const gate = canContinue();
      // Gate must be a structured result (not throw).
      return { id: "3", name: "continue-gate", ok: typeof gate.ok === "boolean", detail: gate.reason ?? "ok-or-blocked" };
    },
  },
  {
    id: "4",
    name: "save-validate",
    run: () => {
      const blob = collectLegacySave();
      const errs = validateSave(blob);
      return { id: "4", name: "save-validate", ok: errs.length === 0, detail: errs.join(",") || "clean" };
    },
  },
  {
    id: "5",
    name: "manifest",
    run: () => {
      const slice = {
        name: "harness",
        origin: { lat: 0, lon: 0 },
        buildings: [],
        roads: [{ highway: "residential", width: 8, name: null, points: [[0, 0], [20, 0]] as [number, number][] }],
        water: [],
        landmarks: [],
        attribution: "",
      } as Slice;
      const v = validateManifest(manifestFromSlice(slice));
      return { id: "5", name: "manifest", ok: v.ok, detail: v.errors.join(",") || "ok" };
    },
  },
  {
    id: "6",
    name: "loop-pause",
    run: () => {
      const loop = new GameLoop();
      let steps = 0;
      loop.on("step", () => { steps++; });
      loop.start();
      loop.pause("menu");
      loop.tick(1 / 30);
      const pausedOk = steps === 0;
      loop.resume("menu");
      loop.tick(1 / 30);
      return { id: "6", name: "loop-pause", ok: pausedOk && steps >= 1, detail: `steps=${steps}` };
    },
  },
  {
    id: "7",
    name: "save-roundtrip-shape",
    run: () => {
      const blob = collectLegacySave();
      const ok = blob.schemaVersion === 2 && typeof blob.createdAt === "number";
      return { id: "7", name: "save-roundtrip-shape", ok, detail: `v${blob.schemaVersion}` };
    },
  },
];

export async function runAllStages(): Promise<StageResult[]> {
  const out: StageResult[] = [];
  for (const s of stages) {
    try {
      out.push(await s.run());
    } catch (e) {
      out.push({ id: s.id, name: s.name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

export function allStagesGreen(results: StageResult[]): boolean {
  return results.every((r) => r.ok);
}
