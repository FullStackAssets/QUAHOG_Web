import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, basename, resolve } from "node:path";
import { fileEntry, fingerprintFiles, sha256File, toPosix, walkFiles } from "./fingerprint.mjs";

export function predictManifestMutation(source) {
  return typeof source === "string"
    && /writeFileSync/.test(source)
    && /manifest\.json/.test(source)
    && /new Date\(/.test(source);
}

export function evaluateBuildConfig({ pkg, vercel }) {
  const failures = [];
  if (pkg?.scripts?.build !== "tsc && vite build") failures.push('package.json scripts.build must be "tsc && vite build"');
  if (pkg?.scripts?.prebuild !== "node scripts/gen_manifests.mjs") {
    failures.push("package.json scripts.prebuild must be the music manifest generator");
  }
  if (vercel?.framework !== "vite") failures.push("vercel.json framework must be vite");
  if (vercel?.buildCommand !== "npm run build") failures.push('vercel.json buildCommand must be "npm run build"');
  if (vercel?.outputDirectory !== "dist") failures.push('vercel.json outputDirectory must be "dist"');
  const vercelText = JSON.stringify(vercel ?? {}).toLowerCase();
  const scriptText = JSON.stringify(pkg?.scripts ?? {}).toLowerCase();
  if (vercelText.includes("staging") || scriptText.includes("staging")) failures.push("build config mentions staging");
  if (/vercel --prod|deploy-preview|gh-pages/.test(scriptText)) failures.push("package.json scripts publish an environment");
  return { ok: failures.length === 0, failures };
}

export function evaluateBuildObservation(observation, cover) {
  const failures = [];
  if (!observation || observation.officialCommandExecuted !== true) {
    failures.push("official production build was not executed");
    return { ok: false, failures };
  }
  if (observation.command !== "npm run build") failures.push("observation is not npm run build");
  if (observation.primaryTree === true) failures.push("build ran in the primary worktree");
  if (observation.worktreeCleanup !== "removed") failures.push("disposable worktree was not removed");
  if (!cover?.ok) failures.push(cover?.reason || "build observation does not cover this commit");
  if (observation.exitCode !== 0) failures.push(`build exit code ${observation.exitCode}`);
  if (observation.distIndex !== true || observation.distEarth !== true) failures.push("dist is missing index.html or earth.html");
  if (!Array.isArray(observation.mutatedPaths)) failures.push("manifest mutation result was not recorded");
  else if (observation.mutatedPaths.length > 0) {
    failures.push(`build rewrote manifests: ${observation.mutatedPaths.join(", ")}`);
  }
  if (observation.primaryTreeDirty === true) failures.push("primary worktree changed during the build");
  if (observation.stampMatchesHead !== true) failures.push("bundle stamp does not match the built commit");
  if (observation.createdStaging === true) failures.push("build created a staging output");
  if (observation.createdBranch === true) failures.push("build created a git branch");
  return { ok: failures.length === 0, failures };
}

export function buildCover({ observation, head, ancestor, changedPaths, dirtyPaths }) {
  if (!observation?.head || !head) return { ok: false, reason: "build observation has no commit" };
  const dirtyOutside = (dirtyPaths ?? []).filter((path) => !path.startsWith("deployment/reconciliation/"));
  if (dirtyOutside.length > 0) {
    return { ok: false, reason: `worktree changes are outside the build: ${dirtyOutside.join(", ")}` };
  }
  if (observation.head === head) return { ok: true, reason: "observation matches HEAD" };
  const outside = (changedPaths ?? []).filter((path) => !path.startsWith("deployment/reconciliation/"));
  if (ancestor && outside.length === 0) {
    return { ok: true, reason: "only deployment/reconciliation files differ from the built commit" };
  }
  return { ok: false, reason: "build observation is for a different commit" };
}

function tail(text) {
  if (!text) return "";
  return text.slice(-4000);
}

function manifestHashes(root) {
  const map = {};
  for (const full of walkFiles(root)) {
    if (basename(full) !== "manifest.json") continue;
    map[toPosix(relative(root, full))] = sha256File(full);
  }
  return map;
}

function branches(root) {
  const result = spawnSync("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], {
    cwd: root,
    encoding: "utf8",
  });
  return (result.stdout || "").split("\n").filter(Boolean);
}

function bundleStampMatches(distDir, shortHead) {
  const needle = JSON.stringify(shortHead);
  const files = walkFiles(distDir).filter((full) => full.endsWith(".js"));
  for (const full of files) {
    if (readFileSync(full, "utf8").includes(needle)) return true;
  }
  return false;
}

export function executeOfficialBuild(repoRoot) {
  repoRoot = resolve(repoRoot);
  const parent = mkdtempSync(join(tmpdir(), "quahog-prod-build-"));
  const work = join(parent, "wt");
  const beforeBranches = branches(repoRoot);
  const primaryBefore = manifestHashes(repoRoot);
  let cleanup = "not-started";
  let observation = {
    officialCommandExecuted: false,
    command: "npm run build",
    primaryTree: false,
    worktreeCleanup: cleanup,
    createdStaging: false,
    createdBranch: false,
    mutatedPaths: [],
    primaryTreeDirty: false,
    distIndex: false,
    distEarth: false,
    stampMatchesHead: false,
    exitCode: null,
    head: null,
    shortHead: null,
  };
  try {
    if (!existsSync(join(repoRoot, "node_modules"))) {
      observation.stderrTail = "node_modules is missing; the reconciler does not install packages or call the network";
      return observation;
    }
    const added = spawnSync("git", ["worktree", "add", "--detach", work, "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (added.status !== 0) {
      observation.stderrTail = tail(added.stderr || added.stdout);
      return observation;
    }
    symlinkSync(join(repoRoot, "node_modules"), join(work, "node_modules"));
    const before = manifestHashes(work);
    const headResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: work, encoding: "utf8" });
    const head = (headResult.stdout || "").trim();
    const built = spawnSync("npm", ["run", "build"], {
      cwd: work,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 600000,
    });
    const after = manifestHashes(work);
    const mutated = new Set();
    for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (before[path] !== after[path]) mutated.add(path);
    }
    const dist = join(work, "dist");
    const distIndex = existsSync(join(dist, "index.html"));
    const distEarth = existsSync(join(dist, "earth.html"));
    let artifact = { fingerprint: null, fileCount: 0, totalBytes: 0 };
    if (distIndex && distEarth) {
      const entries = walkFiles(dist).map((full) => fileEntry(work, full));
      artifact = fingerprintFiles(entries);
    }
    const shortHead = /^[0-9a-f]{40}$/.test(head) ? head.slice(0, 7) : "";
    const afterBranches = branches(repoRoot);
    const created = afterBranches.filter((name) => !beforeBranches.includes(name));
    const primaryAfter = manifestHashes(repoRoot);
    const primaryDirty = JSON.stringify(primaryBefore) !== JSON.stringify(primaryAfter);
    observation = {
      officialCommandExecuted: true,
      command: "npm run build",
      primaryTree: false,
      head,
      shortHead,
      exitCode: built.status,
      distIndex,
      distEarth,
      mutatedPaths: [...mutated].sort(),
      primaryTreeDirty: primaryDirty,
      stampMatchesHead: Boolean(shortHead) && distIndex && bundleStampMatches(dist, shortHead),
      createdStaging: existsSync(join(dist, "staging")) || existsSync(join(work, "staging")),
      createdBranch: created.length > 0,
      newBranches: created,
      artifactFingerprint: artifact.fingerprint,
      artifactFiles: artifact.fileCount,
      artifactBytes: artifact.totalBytes,
      stdoutTail: tail(built.stdout),
      stderrTail: tail(`${built.stderr || ""}${built.error ? `\n${built.error}` : ""}`),
      signal: built.signal,
      timedOut: built.error?.code === "ETIMEDOUT",
    };
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", work], { cwd: repoRoot });
    const listed = spawnSync("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot, encoding: "utf8" });
    const stillThere = (listed.stdout || "").includes(work);
    if (!stillThere) {
      rmSync(parent, { recursive: true, force: true });
      cleanup = "removed";
    } else {
      cleanup = "failed";
    }
    observation.worktreeCleanup = cleanup;
  }
  return observation;
}

export function readGeneratorSource(repoRoot) {
  const path = join(repoRoot, "scripts", "gen_manifests.mjs");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}
