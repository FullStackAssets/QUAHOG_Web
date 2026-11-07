// Documented SHAs are parsed from the audit files. A missing line is a failure,
// not a reason to skip the ancestry check.

const BASELINE = /\*\*Baseline commit \(pre-build\):\*\*\s*`([0-9a-f]{7,40})`/;
const BUILD = /\*\*Build commit:\*\*\s*`([0-9a-f]{7,40})`\s*\(\+\s*`([0-9a-f]{7,40})`\s*docs\)/;
const FULL_SHA = /`([0-9a-f]{40})`/g;

export function parseCommitClaims({ build002, audit, findingsZip }) {
  const ancestry = [];
  const ancestryParseFailures = [];
  const external = [];
  const externalParseFailures = [];

  if (typeof build002 !== "string") {
    ancestryParseFailures.push("docs/audit/BUILD002-REPORT.md is missing");
  } else {
    const baseline = build002.match(BASELINE);
    const build = build002.match(BUILD);
    if (!baseline) ancestryParseFailures.push("BUILD002 baseline commit line is missing");
    else ancestry.push({ sha: baseline[1], source: "docs/audit/BUILD002-REPORT.md", role: "baseline" });
    if (!build) ancestryParseFailures.push("BUILD002 build commit line is missing");
    else {
      ancestry.push({ sha: build[1], source: "docs/audit/BUILD002-REPORT.md", role: "build" });
      ancestry.push({ sha: build[2], source: "docs/audit/BUILD002-REPORT.md", role: "docs" });
    }
  }

  const sources = [
    ["docs/audit/AUDIT-REPORT.md", audit],
    ["docs/audit/findings-zip.md", findingsZip],
  ];
  const seen = new Set();
  for (const [source, text] of sources) {
    if (typeof text !== "string") {
      externalParseFailures.push(`${source} is missing`);
      continue;
    }
    const found = [...text.matchAll(FULL_SHA)].map((match) => match[1]);
    if (found.length === 0) externalParseFailures.push(`${source} has no 40-hex commit`);
    for (const sha of found) {
      if (seen.has(sha)) continue;
      seen.add(sha);
      external.push({ sha, source, role: "external-archive" });
    }
  }

  return { ancestry, ancestryParseFailures, external, externalParseFailures };
}

export function verifyAncestry(claims, parseFailures, git, subjectSha) {
  const unresolved = [];
  const notAncestor = [];
  const resolved = [];
  for (const claim of claims) {
    const hit = git.revParse(claim.sha);
    if (!hit.ok) {
      unresolved.push({ sha: claim.sha, source: claim.source, role: claim.role });
      continue;
    }
    if (!subjectSha || !git.isAncestor(hit.sha, subjectSha)) {
      notAncestor.push({ sha: hit.sha, claimed: claim.sha, source: claim.source, role: claim.role });
      continue;
    }
    resolved.push({ sha: hit.sha, claimed: claim.sha, source: claim.source, role: claim.role });
  }
  const failures = [...parseFailures];
  if (claims.length === 0 && parseFailures.length === 0) failures.push("no documented commits to verify");
  if (unresolved.length > 0) {
    failures.push(`documented commit object missing: ${unresolved.map((item) => item.sha).join(", ")}`);
  }
  if (notAncestor.length > 0) {
    failures.push(`documented commit is not an ancestor of the subject: ${notAncestor.map((item) => item.claimed).join(", ")}`);
  }
  return { ok: failures.length === 0, failures, unresolved, notAncestor, resolved };
}
