import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildCover, evaluateBuildConfig, evaluateBuildObservation, predictManifestMutation } from "./build.mjs";

const passing = {
  officialCommandExecuted: true,
  command: "npm run build",
  primaryTree: false,
  worktreeCleanup: "removed",
  exitCode: 0,
  distIndex: true,
  distEarth: true,
  mutatedPaths: [],
  primaryTreeDirty: false,
  stampMatchesHead: true,
  createdStaging: false,
  createdBranch: false,
  head: "a".repeat(40),
};

test("production build config accepts the checked-in shape and rejects staging", () => {
  const ok = evaluateBuildConfig({
    pkg: { scripts: { build: "tsc && vite build", prebuild: "node scripts/gen_manifests.mjs" } },
    vercel: { framework: "vite", buildCommand: "npm run build", outputDirectory: "dist" },
  });
  assert.equal(ok.ok, true, ok.failures.join("; "));
  const staging = evaluateBuildConfig({
    pkg: { scripts: { build: "tsc && vite build", prebuild: "node scripts/gen_manifests.mjs", staging: "vite build --mode staging" } },
    vercel: { framework: "vite", buildCommand: "npm run build", outputDirectory: "dist" },
  });
  assert.equal(staging.ok, false);
});

test("an official build that rewrites manifests fails and is not waived", () => {
  const cover = { ok: true, reason: "observation matches HEAD" };
  const clean = evaluateBuildObservation(passing, cover);
  assert.equal(clean.ok, true, clean.failures.join("; "));
  const mutated = evaluateBuildObservation({ ...passing, mutatedPaths: ["public/music/whale/manifest.json"] }, cover);
  assert.equal(mutated.ok, false);
  assert.match(mutated.failures.join("\n"), /rewrote manifests/);
  const skipped = evaluateBuildObservation(null, cover);
  assert.equal(skipped.ok, false);
  assert.match(skipped.failures.join("\n"), /not executed/);
});

test("build evidence covers HEAD only when later diffs stay inside reconciliation", () => {
  const head = "b".repeat(40);
  assert.equal(buildCover({
    observation: { head: passing.head },
    head,
    ancestor: true,
    changedPaths: ["deployment/reconciliation/RUNBOOK.md"],
    dirtyPaths: [],
  }).ok, true);
  assert.equal(buildCover({
    observation: { head: passing.head },
    head,
    ancestor: true,
    changedPaths: ["vite.config.ts"],
    dirtyPaths: [],
  }).ok, false);
});

test("the recorded official build exited 0 and still fails because it rewrote manifests", () => {
  const observation = JSON.parse(readFileSync(new URL("./evidence/official-build.json", import.meta.url), "utf8"));
  assert.equal(observation.exitCode, 0);
  assert.equal(observation.primaryTreeDirty, false);
  assert.equal(observation.createdBranch, false);
  assert.equal(observation.createdStaging, false);
  assert.equal(observation.worktreeCleanup, "removed");
  assert.ok(observation.mutatedPaths.length > 0);
  const result = evaluateBuildObservation(observation, { ok: true, reason: "fixture cover" });
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /rewrote manifests/);
});

test("a generator that stamps the current time is predicted to rewrite manifests", () => {
  assert.equal(predictManifestMutation('writeFileSync(join(dir, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString() }))'), true);
  assert.equal(predictManifestMutation("export const tracks = []"), false);
});
