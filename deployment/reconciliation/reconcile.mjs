import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  attachManifestHashes,
  canonicalMusicPins,
  findArchiveCandidates,
  verifyMusicManifests,
  verifyPublicTree,
  verifyUnscoped,
} from "./assets.mjs";
import {
  evaluateBuildConfig,
  evaluateBuildObservation,
  buildCover,
  executeOfficialBuild,
  predictManifestMutation,
  readGeneratorSource,
} from "./build.mjs";
import { parseCommitClaims, verifyAncestry } from "./claims.mjs";
import { createGit } from "./git-repo.mjs";
import { verifyLiveProduction, verifyProductionBranch } from "./live.mjs";
import {
  verifyDeployEntrypoint,
  verifyExternalClaim,
  verifyReleaseRecord,
  verifyRollback,
} from "./release.mjs";

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function readJson(path) {
  const text = readText(path);
  if (text == null) return { ok: false, missing: true, value: null };
  try {
    return { ok: true, missing: false, value: JSON.parse(text) };
  } catch {
    return { ok: false, missing: false, value: null };
  }
}

function check(id, ok, summary, evidence = {}) {
  return { id, ok, summary, evidence };
}

export function reconcile(options) {
  const repo = options.repo;
  const recordPath = join(repo, "deployment", "reconciliation", "records", "production.json");
  const recordBytes = existsSync(recordPath) ? readFileSync(recordPath) : null;
  const recordParsed = recordBytes ? readJson(recordPath) : { ok: false, missing: true, value: null };
  const record = recordParsed.value;

  const git = options.git ?? createGit(repo);
  const head = git.head();
  const subjectSha = head.ok ? head.sha : null;
  const branch = git.currentBranch();
  const main = git.revParse("main");
  const mainIsAncestor = Boolean(subjectSha && main.ok && git.isAncestor(main.sha, subjectSha));
  const branchState = verifyProductionBranch({
    branch,
    subjectSha,
    mainSha: main.ok ? main.sha : null,
    mainIsAncestor,
  });

  const pkg = readJson(join(repo, "package.json"));
  const vercel = readJson(join(repo, "vercel.json"));
  const buildConfig = evaluateBuildConfig({
    pkg: pkg.ok ? pkg.value : null,
    vercel: vercel.ok ? vercel.value : null,
  });
  if (!pkg.ok) buildConfig.failures.push(pkg.missing ? "package.json is missing" : "package.json is not valid JSON");
  if (!vercel.ok) buildConfig.failures.push(vercel.missing ? "vercel.json is missing" : "vercel.json is not valid JSON");
  buildConfig.ok = buildConfig.failures.length === 0;

  const generator = readGeneratorSource(repo);
  const mutationPredicted = predictManifestMutation(generator);

  let observation = options.buildObservation;
  if (observation === undefined && options.executeBuild === true) observation = executeOfficialBuild(repo);
  if (observation === undefined && options.loadBuildEvidence !== false) {
    const loaded = readJson(join(repo, "deployment", "reconciliation", "evidence", "official-build.json"));
    observation = loaded.ok ? loaded.value : null;
  }
  const changed = observation?.head && subjectSha ? git.diffNames(observation.head, subjectSha) : { ok: true, paths: [] };
  const dirty = git.dirtyPaths ? git.dirtyPaths() : { ok: true, paths: [] };
  const ancestor = Boolean(observation?.head && subjectSha && git.isAncestor(observation.head, subjectSha));
  const cover = buildCover({
    observation,
    head: subjectSha,
    ancestor,
    changedPaths: changed.ok ? changed.paths : ["<diff failed>"],
    dirtyPaths: dirty.ok ? dirty.paths : ["<status failed>"],
  });
  const buildOfficial = evaluateBuildObservation(observation, cover);

  const music = verifyMusicManifests(repo);
  const withHashes = attachManifestHashes(repo, music.manifests);
  const pins = canonicalMusicPins(withHashes);
  const unscoped = verifyUnscoped(repo);
  const tree = verifyPublicTree(repo, record);

  const claims = parseCommitClaims({
    build002: readText(join(repo, "docs", "audit", "BUILD002-REPORT.md")),
    audit: readText(join(repo, "docs", "audit", "AUDIT-REPORT.md")),
    findingsZip: readText(join(repo, "docs", "audit", "findings-zip.md")),
  });
  const ancestry = verifyAncestry(claims.ancestry, claims.ancestryParseFailures, git, subjectSha);
  const archives = findArchiveCandidates(repo);
  const external = verifyExternalClaim({
    claims: claims.external,
    parseFailures: claims.externalParseFailures,
    record,
    archives,
  });

  const release = recordParsed.ok
    ? verifyReleaseRecord({ record, subjectSha, canonicalPins: pins, observedFingerprint: tree.fingerprint })
    : {
      ok: false,
      failures: [recordParsed.missing ? "production release record is missing" : "production release record is not valid JSON"],
      wroteRecord: false,
    };
  const rollback = verifyRollback(record ?? {}, git);
  const entrypoint = verifyDeployEntrypoint({
    previewScriptPresent: existsSync(join(repo, "scripts", "deploy-preview.py")),
    record,
  });

  let liveEvidence = options.liveEvidence;
  if (liveEvidence === undefined) {
    const loaded = readJson(join(repo, "deployment", "reconciliation", "evidence", "github-metadata.json"));
    liveEvidence = loaded.ok ? loaded.value : null;
  }
  const live = verifyLiveProduction(liveEvidence);

  const recordAfter = existsSync(recordPath) ? readFileSync(recordPath) : null;
  const immutableOk = Buffer.compare(recordBytes ?? Buffer.from(""), recordAfter ?? Buffer.from("")) === 0;

  const checks = [
    check("build.config", buildConfig.ok, buildConfig.ok ? "Vercel and npm build config is production-shaped." : buildConfig.failures.join("; "), {
      failures: buildConfig.failures,
    }),
    check("build.official", buildOfficial.ok, buildOfficial.ok ? "Official build matched this commit and did not rewrite manifests." : buildOfficial.failures.join("; "), {
      failures: buildOfficial.failures,
      manifestMutationPredicted: mutationPredicted,
      observation: observation
        ? {
          head: observation.head ?? null,
          exitCode: observation.exitCode ?? null,
          mutatedPaths: observation.mutatedPaths ?? null,
          artifactFingerprint: observation.artifactFingerprint ?? null,
          artifactFiles: observation.artifactFiles ?? null,
          artifactBytes: observation.artifactBytes ?? null,
          primaryTreeDirty: observation.primaryTreeDirty ?? null,
          stampMatchesHead: observation.stampMatchesHead ?? null,
          worktreeCleanup: observation.worktreeCleanup ?? null,
          createdBranch: observation.createdBranch ?? null,
          createdStaging: observation.createdStaging ?? null,
        }
        : null,
    }),
    check("asset.music-manifests", music.ok, music.ok ? "public/music manifests match the files beside them." : music.failures.join("; "), {
      failures: music.failures,
      observedPins: pins,
    }),
    check("asset.unscoped", unscoped.ok, unscoped.ok ? "No audio or manifest sits outside public/music." : unscoped.failures.join("; "), {
      failures: unscoped.failures,
    }),
    check("asset.public-tree", tree.ok, tree.ok ? "Attested public-tree fingerprint matches." : tree.failures.join("; "), {
      failures: tree.failures,
      observedFingerprint: tree.fingerprint,
      fileCount: tree.fileCount,
      totalBytes: tree.totalBytes,
      doNotAttest: true,
    }),
    check("commit.ancestry", ancestry.ok, ancestry.ok ? "Documented build commits are ancestors of the subject." : ancestry.failures.join("; "), {
      failures: ancestry.failures,
      unresolved: ancestry.unresolved,
      notAncestor: ancestry.notAncestor,
      resolved: ancestry.resolved,
    }),
    check("commit.external", external.ok, external.ok ? "External archive claim is attested and the archive file is attached." : external.failures.join("; "), {
      failures: external.failures,
      archives,
    }),
    check("commit.descends-from-main", branchState.descends.ok, branchState.descends.ok ? "Subject contains main as an ancestor." : branchState.descends.failures.join("; "), {
      failures: branchState.descends.failures,
      branch,
      main: main.ok ? main.sha : null,
    }),
    check("commit.production-tip", branchState.tip.ok, branchState.tip.ok ? "Subject is the tip of main." : branchState.tip.failures.join("; "), {
      failures: branchState.tip.failures,
      branch,
      subjectSha,
    }),
    check("release.record", release.ok, release.ok ? "Attested release record matches this tree." : release.failures.join("; "), {
      failures: release.failures,
      attested: record?.attested === true,
      wroteRecord: false,
    }),
    check("release.rollback", rollback.ok, rollback.ok ? "Rollback commit and artifact hash resolve." : rollback.failures.join("; "), {
      failures: rollback.failures,
    }),
    check("release.immutable", immutableOk, immutableOk ? "Release record bytes were not modified." : "Release record bytes changed during reconciliation.", {}),
    check("deploy.entrypoint", entrypoint.ok, entrypoint.ok ? "An attested production host is recorded and the preview publisher is absent." : entrypoint.failures.join("; "), {
      failures: entrypoint.failures,
      previewScriptExecuted: false,
    }),
    check("live.production", live.ok, live.summary, live.evidence),
    check("policy.channel", record?.channel === "production", record?.channel === "production" ? "Record channel is production." : "Record channel is not production.", {
      channel: record?.channel ?? null,
      stagingCreated: false,
    }),
  ];

  const blockers = checks.filter((item) => !item.ok).map((item) => ({ id: item.id, summary: item.summary }));
  return {
    ok: blockers.length === 0,
    channel: "production",
    subjectCommit: subjectSha,
    branch,
    checks,
    blockers,
    doNotAttestObservedHashes: true,
  };
}
