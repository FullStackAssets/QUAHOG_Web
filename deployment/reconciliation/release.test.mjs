import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyLiveProduction, verifyProductionBranch } from "./live.mjs";
import { approverAccepted, verifyReleaseRecord, verifyRollback } from "./release.mjs";

const subject = "a".repeat(40);
const previous = "b".repeat(40);
const pin = { path: "public/music/whale/tone.mp3", sha256: "c".repeat(64) };
const fingerprint = "d".repeat(64);

function attested() {
  return {
    schemaVersion: 1,
    channel: "production",
    attested: true,
    approver: "Nic Example",
    approvedAt: "2026-11-06T00:00:00Z",
    subjectCommit: subject,
    assetPins: [pin],
    publicTreeFingerprint: fingerprint,
    previousProductionCommit: previous,
    previousArtifactSha256: "e".repeat(64),
  };
}

test("an unattested record fails and a matching attested record passes", () => {
  const open = verifyReleaseRecord({
    record: { ...attested(), attested: false },
    subjectSha: subject,
    canonicalPins: [pin],
    observedFingerprint: fingerprint,
  });
  assert.equal(open.ok, false);
  assert.equal(open.wroteRecord, false);
  const closed = verifyReleaseRecord({
    record: attested(),
    subjectSha: subject,
    canonicalPins: [pin],
    observedFingerprint: fingerprint,
  });
  assert.equal(closed.ok, true, closed.failures.join("; "));
});

test("hash mismatches and rollback waivers fail without a rewrite path", () => {
  const wrong = verifyReleaseRecord({
    record: attested(),
    subjectSha: subject,
    canonicalPins: [{ ...pin, sha256: "f".repeat(64) }],
    observedFingerprint: fingerprint,
  });
  assert.equal(wrong.ok, false);
  assert.match(wrong.failures.join("\n"), /do not match/);
  const waived = verifyRollback({ ...attested(), noRollbackTarget: true }, {
    revParse: () => ({ ok: true, sha: previous }),
    isAncestor: () => true,
  });
  assert.equal(waived.ok, false);
  assert.match(waived.failures.join("\n"), /noRollbackTarget/);
});

test("machine approvers are rejected", () => {
  assert.equal(approverAccepted("Nic Example"), true);
  assert.equal(approverAccepted("agent"), false);
  assert.equal(approverAccepted("cursor agent"), false);
});

test("github pages metadata is not a production reconciliation", () => {
  const live = verifyLiveProduction({
    kind: "github-metadata",
    environment: "github-pages",
    fetchedProductionBody: false,
    pages: { source: { branch: "Preview" }, html_url: "https://example.github.io/QUAHOG_Web/" },
    deployments: [{ environment: "github-pages", sha: "1".repeat(40), ref: "Preview", production_environment: false }],
  });
  assert.equal(live.ok, false);
  assert.equal(live.evidence.productionEnvironmentFlag, false);
  assert.equal(live.evidence.pagesBranch, "Preview");
});

test("a feature branch is not the production tip", () => {
  const state = verifyProductionBranch({
    branch: "cursor/production-reconciliation-7090",
    subjectSha: subject,
    mainSha: previous,
    mainIsAncestor: true,
  });
  assert.equal(state.descends.ok, true);
  assert.equal(state.tip.ok, false);
});
