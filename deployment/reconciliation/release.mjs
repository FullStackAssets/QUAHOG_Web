const DENY = new Set(["agent", "auto", "bot", "cursor", "claude", "chatgpt", "unknown", "human"]);

export function approverAccepted(approver) {
  if (typeof approver !== "string") return false;
  const trimmed = approver.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  const tokens = trimmed.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return !tokens.some((token) => DENY.has(token));
}

export function comparePins(recorded, computed) {
  const failures = [];
  if (!Array.isArray(recorded) || recorded.length === 0) {
    failures.push("asset pins are empty");
    return failures;
  }
  const seen = new Set();
  for (const pin of recorded) {
    if (!pin || typeof pin.path !== "string" || pin.path.length === 0 || pin.path.includes("..")) {
      failures.push("asset pin path is invalid");
      continue;
    }
    if (!/^[a-f0-9]{64}$/.test(pin.sha256 || "")) failures.push(`asset pin hash is invalid: ${pin.path}`);
    if (seen.has(pin.path)) failures.push(`duplicate asset pin: ${pin.path}`);
    seen.add(pin.path);
  }
  const left = [...recorded]
    .filter((pin) => pin && typeof pin.path === "string")
    .map((pin) => `${pin.path}\t${pin.sha256}`)
    .sort();
  const right = [...computed].map((pin) => `${pin.path}\t${pin.sha256}`).sort();
  if (left.join("\n") !== right.join("\n")) failures.push("asset pins do not match the music manifests and audio bytes");
  return failures;
}

export function verifyReleaseRecord({ record, subjectSha, canonicalPins, observedFingerprint }) {
  const failures = [];
  if (!record || record.schemaVersion !== 1) failures.push("release record schemaVersion must be 1");
  if (record?.channel !== "production") failures.push("release record channel must be production");
  if (record && Object.prototype.hasOwnProperty.call(record, "noRollbackTarget")) {
    failures.push("noRollbackTarget is rejected");
  }
  if (record?.attested !== true) {
    failures.push("production release is not attested");
    return { ok: false, failures, wroteRecord: false };
  }
  if (!approverAccepted(record.approver)) failures.push("approver must be a named human");
  if (typeof record.approvedAt !== "string" || Number.isNaN(Date.parse(record.approvedAt))) {
    failures.push("approvedAt is not a time");
  }
  if (record.subjectCommit !== subjectSha) failures.push("attested subjectCommit does not match the commit being reconciled");
  failures.push(...comparePins(record.assetPins, canonicalPins));
  if (typeof observedFingerprint !== "string" || record.publicTreeFingerprint !== observedFingerprint) {
    failures.push("attested public-tree fingerprint does not match the tree");
  }
  return { ok: failures.length === 0, failures, wroteRecord: false };
}

export function verifyRollback(record, git) {
  const failures = [];
  if (record && Object.prototype.hasOwnProperty.call(record, "noRollbackTarget")) {
    failures.push("noRollbackTarget is rejected");
  }
  if (record?.attested !== true) failures.push("rollback target is not attested");
  const previous = record?.previousProductionCommit;
  if (typeof previous !== "string" || !/^[0-9a-f]{40}$/.test(previous)) {
    failures.push("previousProductionCommit is missing");
  } else {
    const resolved = git.revParse(previous);
    if (!resolved.ok) failures.push("previousProductionCommit does not resolve");
    else if (!record.subjectCommit || !git.isAncestor(resolved.sha, record.subjectCommit)) {
      failures.push("previousProductionCommit is not an ancestor of the attested subject");
    }
  }
  if (typeof record?.previousArtifactSha256 !== "string" || !/^[a-f0-9]{64}$/.test(record.previousArtifactSha256)) {
    failures.push("previousArtifactSha256 is missing");
  }
  return { ok: failures.length === 0, failures };
}

export function verifyDeployEntrypoint({ previewScriptPresent, record }) {
  const failures = [];
  if (previewScriptPresent) {
    failures.push("scripts/deploy-preview.py publishes the preview branch and GitHub Pages; it is not a production path and was not run");
  }
  const host = record?.productionHost;
  if (record?.attested !== true || typeof host !== "string" || host.trim() === "") {
    failures.push("no attested production host");
  } else if (/preview|staging|localhost|127\.0\.0\.1|github\.io/i.test(host)) {
    failures.push("productionHost is preview, staging, local, or GitHub Pages");
  }
  return { ok: failures.length === 0, failures };
}

export function verifyExternalClaim({ claims, parseFailures, record, archives }) {
  const failures = [...parseFailures];
  if (claims.length === 0) failures.push("no external commit claim was parsed");
  if (record?.attested !== true) failures.push("external archive was not read and is not attested");
  const expected = [...new Set(claims.map((claim) => claim.sha))].sort();
  const recorded = Array.isArray(record?.externalCommitShas) ? [...record.externalCommitShas].sort() : [];
  if (JSON.stringify(expected) !== JSON.stringify(recorded)) {
    failures.push("attested external commits do not match the audit documents");
  }
  if (typeof record?.externalArchiveSha256 !== "string" || !/^[a-f0-9]{64}$/.test(record.externalArchiveSha256)) {
    failures.push("external archive sha256 is not attested");
  }
  const hits = (archives ?? []).filter((archive) => archive.accepted && archive.sha256 === record?.externalArchiveSha256);
  if (hits.length !== 1) failures.push("no single attached archive matches an attested archive hash");
  return { ok: failures.length === 0, failures };
}
