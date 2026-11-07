import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseCommitClaims, verifyAncestry } from "./claims.mjs";
import { createGit } from "./git-repo.mjs";

const repoRoot = join(import.meta.dirname, "..", "..");

test("checked-in audit documents yield the build and external claims", () => {
  const claims = parseCommitClaims({
    build002: readFileSync(join(repoRoot, "docs/audit/BUILD002-REPORT.md"), "utf8"),
    audit: readFileSync(join(repoRoot, "docs/audit/AUDIT-REPORT.md"), "utf8"),
    findingsZip: readFileSync(join(repoRoot, "docs/audit/findings-zip.md"), "utf8"),
  });
  assert.deepEqual(claims.ancestry.map((claim) => claim.sha), ["9295b91", "62f6d1e", "bfa20b1"]);
  assert.deepEqual(claims.external.map((claim) => claim.sha), ["e8b88c8ece536cb3d86d09fc6edc2ab4582f9dad"]);
  assert.deepEqual(claims.ancestryParseFailures, []);
  assert.deepEqual(claims.externalParseFailures, []);
});

test("a missing documented object fails and a real ancestor passes", () => {
  const root = mkdtempSync(join(tmpdir(), "ancestry-"));
  try {
    spawnSync("git", ["init", "-b", "main"], { cwd: root });
    spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    spawnSync("git", ["config", "user.name", "Test"], { cwd: root });
    writeFileSync(join(root, "a.txt"), "a");
    spawnSync("git", ["add", "a.txt"], { cwd: root });
    spawnSync("git", ["commit", "-m", "base"], { cwd: root });
    const base = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
    writeFileSync(join(root, "a.txt"), "b");
    spawnSync("git", ["commit", "-am", "next"], { cwd: root });
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
    const git = createGit(root);
    const passed = verifyAncestry([{ sha: base, source: "fixture", role: "baseline" }], [], git, head);
    assert.equal(passed.ok, true, passed.failures.join("; "));
    const missing = verifyAncestry([{ sha: "9295b91", source: "fixture", role: "baseline" }], [], git, head);
    assert.equal(missing.ok, false);
    assert.equal(missing.unresolved[0].sha, "9295b91");
    const child = verifyAncestry([{ sha: head, source: "fixture", role: "build" }], [], git, base);
    assert.equal(child.ok, false);
    assert.equal(child.notAncestor.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
