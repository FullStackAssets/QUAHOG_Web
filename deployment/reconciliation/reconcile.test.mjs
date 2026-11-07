import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { attachManifestHashes, canonicalMusicPins, verifyMusicManifests, verifyPublicTree } from "./assets.mjs";
import { sha256File } from "./fingerprint.mjs";
import { createGit } from "./git-repo.mjs";
import { reconcile } from "./reconcile.mjs";

const repoRoot = join(import.meta.dirname, "..", "..");

function git(repo, args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")}\n${result.stderr || result.stdout}`);
  return (result.stdout || "").trim();
}

function init(repo) {
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "Test"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
}

test("an attested fixture passes every production check", () => {
  const root = mkdtempSync(join(tmpdir(), "reconcile-ok-"));
  const scratch = mkdtempSync(join(tmpdir(), "reconcile-evidence-"));
  try {
    init(root);
    mkdirSync(join(root, "public", "music", "whale"), { recursive: true });
    mkdirSync(join(root, "docs", "audit"), { recursive: true });
    mkdirSync(join(root, "archives"), { recursive: true });
    mkdirSync(join(root, "deployment", "reconciliation", "records"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({
      scripts: { build: "tsc && vite build", prebuild: "node scripts/gen_manifests.mjs" },
    }));
    writeFileSync(join(root, "vercel.json"), JSON.stringify({
      framework: "vite",
      buildCommand: "npm run build",
      outputDirectory: "dist",
    }));
    writeFileSync(join(root, "public", "music", "whale", "tone.mp3"), "tone");
    writeFileSync(join(root, "public", "music", "whale", "manifest.json"), `${JSON.stringify({
      station: "whale",
      tracks: ["tone.mp3"],
      generatedAt: "2026-01-01T00:00:00.000Z",
    }, null, 2)}\n`);
    writeFileSync(join(root, "notes.txt"), "baseline");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "baseline"]);
    const baseline = git(root, ["rev-parse", "HEAD"]);
    writeFileSync(join(root, "notes.txt"), "build");
    git(root, ["commit", "-am", "build"]);
    const build = git(root, ["rev-parse", "HEAD"]);
    writeFileSync(join(root, "notes.txt"), "docs");
    git(root, ["commit", "-am", "docs"]);
    const docs = git(root, ["rev-parse", "HEAD"]);

    const external = "e8b88c8ece536cb3d86d09fc6edc2ab4582f9dad";
    writeFileSync(join(root, "docs", "audit", "BUILD002-REPORT.md"), `**Baseline commit (pre-build):** \`${baseline}\`\n**Build commit:** \`${build}\` (+ \`${docs}\` docs)\n`);
    writeFileSync(join(root, "docs", "audit", "AUDIT-REPORT.md"), `Commit \`${external}\`\n`);
    writeFileSync(join(root, "docs", "audit", "findings-zip.md"), `SOURCE-COMMIT \`${external}\`\n`);
    const archivePath = join(root, "archives", "narrows-waterfront-implementation.zip");
    writeFileSync(archivePath, "not-a-real-archive");
    const music = verifyMusicManifests(root);
    const pins = canonicalMusicPins(attachManifestHashes(root, music.manifests));
    const tree = verifyPublicTree(root, { attested: false });
    const record = {
      schemaVersion: 1,
      channel: "production",
      attested: true,
      approver: "Nic Example",
      approvedAt: "2026-11-06T00:00:00Z",
      subjectCommit: null,
      productionHost: "play.example.com",
      previousProductionCommit: build,
      previousArtifactSha256: "ab".repeat(32),
      assetPins: pins,
      publicTreeFingerprint: tree.fingerprint,
      externalCommitShas: [external],
      externalArchiveSha256: sha256File(archivePath),
    };
    const recordPath = join(root, "deployment", "reconciliation", "records", "production.json");
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "attest"]);
    const subject = git(root, ["rev-parse", "HEAD"]);
    record.subjectCommit = subject;
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    const head = git(root, ["rev-parse", "HEAD"]);
    assert.equal(head, subject);
    const before = readFileSync(recordPath);
    const observation = {
      officialCommandExecuted: true,
      command: "npm run build",
      primaryTree: false,
      worktreeCleanup: "removed",
      head,
      exitCode: 0,
      distIndex: true,
      distEarth: true,
      mutatedPaths: [],
      primaryTreeDirty: false,
      stampMatchesHead: true,
      createdStaging: false,
      createdBranch: false,
    };
    const live = {
      kind: "production-http",
      environment: "production",
      fetchedProductionBody: true,
      subjectShaMatch: true,
      bodySha256: "cd".repeat(32),
    };
    const report = reconcile({ repo: root, buildObservation: observation, liveEvidence: live });
    assert.equal(report.ok, true, report.blockers.map((item) => `${item.id}: ${item.summary}`).join("\n"));
    assert.equal(Buffer.compare(before, readFileSync(recordPath)), 0);

    writeFileSync(join(scratch, "build.json"), JSON.stringify(observation));
    writeFileSync(join(scratch, "live.json"), JSON.stringify(live));
    const cli = spawnSync(process.execPath, [
      join(repoRoot, "deployment", "reconciliation", "cli.mjs"),
      "--repo",
      root,
      "--build-evidence",
      join(scratch, "build.json"),
      "--live-evidence",
      join(scratch, "live.json"),
    ], { encoding: "utf8" });
    assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
    assert.equal(Buffer.compare(before, readFileSync(recordPath)), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("this clone fails closed on the unattested production record", () => {
  const recordPath = join(repoRoot, "deployment", "reconciliation", "records", "production.json");
  const before = readFileSync(recordPath);
  const report = reconcile({ repo: repoRoot, executeBuild: false, loadBuildEvidence: false });
  assert.equal(Buffer.compare(before, readFileSync(recordPath)), 0);
  assert.equal(report.ok, false);
  assert.equal(report.doNotAttestObservedHashes, true);
  const byId = Object.fromEntries(report.checks.map((item) => [item.id, item]));
  assert.equal(byId["build.config"].ok, true);
  assert.equal(byId["build.official"].ok, false);
  assert.equal(byId["asset.music-manifests"].ok, true);
  assert.equal(byId["asset.unscoped"].ok, false);
  assert.match(byId["asset.unscoped"].summary, /manifest\.json|outside public\/music|\.mp3/);
  assert.equal(byId["asset.public-tree"].ok, false);
  assert.equal(byId["asset.public-tree"].evidence.doNotAttest, true);
  assert.equal(byId["commit.ancestry"].ok, false);
  for (const sha of ["9295b91", "62f6d1e", "bfa20b1"]) {
    assert.ok(byId["commit.ancestry"].evidence.unresolved.some((item) => item.sha === sha), sha);
  }
  assert.equal(byId["commit.external"].ok, false);
  const git = createGit(repoRoot);
  const main = git.revParse("main").sha;
  const head = git.head().sha;
  assert.equal(byId["commit.descends-from-main"].ok, git.isAncestor(main, head));
  assert.equal(byId["commit.production-tip"].ok, git.currentBranch() === "main" && head === main);
  assert.equal(byId["release.record"].ok, false);
  assert.match(byId["release.record"].summary, /not attested/);
  assert.equal(byId["release.rollback"].ok, false);
  assert.equal(byId["release.immutable"].ok, true);
  assert.equal(byId["deploy.entrypoint"].ok, false);
  assert.match(byId["deploy.entrypoint"].summary, /preview/);
  assert.equal(byId["live.production"].ok, false);
  assert.equal(byId["live.production"].evidence.pagesBranch, "Preview");
  assert.equal(byId["live.production"].evidence.productionEnvironmentFlag, false);
  assert.equal(byId["live.production"].evidence.fetchedProductionBody, false);
  assert.equal(byId["policy.channel"].ok, true);
});
