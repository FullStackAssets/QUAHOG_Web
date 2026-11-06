# Production reconciliation runbook

This runbook is the production deployment check. It does not deploy, create a staging environment, or edit the release record.

The channel is production only. `scripts/deploy-preview.py` publishes a `preview` branch and GitHub Pages. Do not run it for this rollout.

## What is already known

- The checked-in release record at `deployment/reconciliation/records/production.json` is unattested. Observed file hashes in a report are not pins. Do not paste them into the record to make the checker pass.
- `docs/audit/BUILD002-REPORT.md` names baseline `9295b91`, build `62f6d1e`, and docs `bfa20b1`. Those objects are not in this clone. A missing object is a failed ancestry check.
- `docs/audit/AUDIT-REPORT.md` and `docs/audit/findings-zip.md` name external commit `e8b88c8ece536cb3d86d09fc6edc2ab4582f9dad`. The waterfront archive those pages describe is not in the tree. The local `quahog-web-preview 2.zip`, when present, is a preview bundle and is not that archive.
- A read-only GitHub metadata query on 2026-11-06 found one deployment: environment `github-pages`, `production_environment: false`, ref `Preview`, sha `1586854c1c583abf13c4bfb7631652c068b7725a`, site `https://fullstackassets.github.io/QUAHOG_Web/`. The site body was not fetched. That metadata is not a production reconciliation. No Vercel production host is recorded. `ENV.md` names a project `projectsouthcoast` and does not give a production URL.

## Run the checks

From the repository root, with Node 22:

```sh
node --test deployment/reconciliation/*.test.mjs
node deployment/reconciliation/cli.mjs --out deployment/reconciliation/evidence/last-run.json
```

`npm test` does not run these files. Vitest is limited to `src/**/*.test.ts`.

Exit codes:

| Exit | Meaning |
|---|---|
| 0 | Every check passed. |
| 1 | One or more checks failed. Do not deploy. |
| 2 | The invocation asked to waive a failure, rewrite hashes, attest, deploy, or create staging. Nothing was checked. |

`--execute-build` runs `npm run build` in a disposable detached git worktree, then deletes that worktree. It does not create a branch, does not push, and does not run `scripts/deploy-preview.py`. It refuses to start when `node_modules` is missing rather than installing packages. Do not run it in the primary worktree: `scripts/gen_manifests.mjs` rewrites `public/music/**/manifest.json` with a new `generatedAt` on every `prebuild`.

The checker fails that build when any manifest hash changes. It does not copy the rewritten manifests back, and it does not update `records/production.json`.

## How a human attests a release

Attestation is a hand edit of `records/production.json` by a named person, reviewed in a pull request. The checker has no attest command.

The record has to set `attested` to true and include all of the following, matching the tree the checker just measured:

- `approver`: a person's name. `agent`, `bot`, `cursor`, and similar tokens are rejected.
- `approvedAt`: an ISO time.
- `subjectCommit`: the full commit that will be deployed. It has to be the tip of `main`.
- `productionHost`: the production hostname. Preview, staging, localhost, and `github.io` hosts are rejected.
- `assetPins`: every `public/music` manifest and audio file, path plus sha256.
- `publicTreeFingerprint`: sha256 of the sorted public-tree inventory.
- `previousProductionCommit`: a full commit that is an ancestor of `subjectCommit`.
- `previousArtifactSha256`: sha256 of the artifact currently serving production, captured before the new deploy.
- `externalCommitShas` and `externalArchiveSha256`: only after the external archive is actually attached and read.

`noRollbackTarget` is rejected. There is no flag that skips a missing ancestor, a hash mismatch, or an unread production host.

## Rollback design

Rollback is a redeploy of a previously attested artifact, identified by `previousProductionCommit` and `previousArtifactSha256`. It is not a rebuild of floating `main`, and it is not a push of the `Preview` branch.

Before any first production deploy, a human captures the bytes that are actually serving the production host and records their sha256. This repository does not contain that capture. GitHub Pages on `Preview` is not a stand-in.

When a bad release is already serving:

1. Stop. Do not edit pins so the bad release matches the checker.
2. Select the latest attested record whose subject is an ancestor of the bad commit and whose artifact hash is still in the artifact store.
3. A human redeploys those bytes to the production host only.
4. Re-run this checker against that restored commit. Ancestry and hash checks have to pass.
5. If no attested artifact exists, the rollback action is to leave production untouched.

## Blockers that stop this rollout

The deploy plan lists the check results from the last run. A failed check is a blocker. Do not deploy while `cli.mjs` exits 1.
