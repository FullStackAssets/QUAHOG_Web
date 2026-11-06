# Production deploy plan

**Decision: no-go. This plan is not approval to deploy, and none of it was executed.**

The production reconciler exited **1** against commit `73450d2d7eed651f03db5d2fc1fa44c1425063bd` on branch `cursor/production-reconciliation-7090`. Five checks passed and ten failed. A failed check is a blocker. Do not copy observed hashes into `records/production.json`.

## What was not done

- No staging environment was created. No branch named staging or preview was created. The disposable build worktree was detached and then removed.
- Nothing was deployed. `scripts/deploy-preview.py` was not run. No Vercel project, GitHub Pages publish, or production host was changed.
- Live production was not read. The GitHub metadata below is not a production reconciliation, and the Pages HTML was not fetched.
- The waterfront archive named in the October audit (the R3 archive was not attached to this workspace) was not in the tree and was not read. `quahog-web-preview 2.zip`, when present on disk, is a preview bundle and was not accepted as that archive.
- No environment variable, secret, or CI workflow was changed.
- The release record was not rewritten. `release.immutable` passed.

## Check results

Command: `node deployment/reconciliation/cli.mjs --out deployment/reconciliation/evidence/last-run.json`

| Check | Result | Evidence |
|---|---|---|
| `build.config` | Pass | `package.json` build is `tsc && vite build`. `vercel.json` uses Vite, `npm run build`, and `dist`. Neither file mentions staging. |
| `build.official` | Fail | `npm run build` in a disposable worktree of `73450d2` exited 0, wrote `dist/index.html` and `dist/earth.html`, and the bundle stamp matched `73450d2`. The same command rewrote 8 music manifests. Primary worktree manifests were unchanged. No staging directory and no git branch were created. |
| `asset.music-manifests` | Pass | Each `public/music/**/manifest.json` lists the audio files beside it, including the decomposed Unicode mare filenames. |
| `asset.unscoped` | Fail | 14 tracked MP3s at the repo root are byte-identical duplicates of files under `public/music/`. Root `manifest.json` declares station `rage/jingles` and does not list the whale or mare copies that sit next to it. |
| `asset.public-tree` | Fail | No attested fingerprint. Observed only, not a pin: 995 files, 53,636,712 bytes, sha256 `50d083e10b5d946b33840ea080b5a0f58eca441cedebdd18610b8e7a5f2da8fa`. |
| `commit.ancestry` | Fail | `9295b91`, `62f6d1e`, and `bfa20b1` from `docs/audit/BUILD002-REPORT.md` are not objects in this clone. |
| `commit.external` | Fail | `e8b88c8ece536cb3d86d09fc6edc2ab4582f9dad` is documented and the archive that would support it is not attached. |
| `commit.descends-from-main` | Pass | This branch contains `main` as an ancestor. |
| `commit.production-tip` | Fail | The checked-out branch is not `main`. Do not deploy it as production. |
| `release.record` | Fail | `records/production.json` has `attested: false`. |
| `release.rollback` | Fail | No previous production commit and no previous artifact sha256. `noRollbackTarget` is not accepted. |
| `release.immutable` | Pass | Reconciliation did not modify the release record. |
| `deploy.entrypoint` | Fail | The only publisher in the repo is `scripts/deploy-preview.py`, which targets branch `preview` and GitHub Pages. No attested production host. |
| `live.production` | Fail | Metadata only. See below. |
| `policy.channel` | Pass | The record channel is `production`. The run created no staging channel. |

## Official build observation

Executed once, locally, from `73450d2d7eed651f03db5d2fc1fa44c1425063bd`:

- Worktree: detached `HEAD`, `node_modules` linked from the primary checkout, then `git worktree remove --force`.
- Command: `npm run build` (this runs `prebuild`, then `tsc && vite build`).
- Exit code: 0. `dist` had 1,005 files and 57,700,202 bytes. Inventory sha256 `365316ef95f68b2c4ecdd9ae8fbf7fb692c0f84ea56d8ce71f6ffe330ea91db5`.
- Stamp in the bundle matched `73450d2`.
- Manifests rewritten inside that worktree only: `public/music/anvil/manifest.json`, `public/music/anvil/vo/manifest.json`, `public/music/mare/manifest.json`, `public/music/mare/vo/manifest.json`, `public/music/rage/manifest.json`, `public/music/rage/jingles/manifest.json`, `public/music/rage/vo/manifest.json`, `public/music/whale/manifest.json`. `scripts/gen_manifests.mjs` writes a new `generatedAt` on every run.
- `primaryTreeDirty` was false. `createdBranch` was false. `createdStaging` was false.

That dist is not a production artifact. The exit code does not waive the manifest rewrite. The inventory hash above is an observation, not a pin.

## Live production evidence

Read-only `gh api` on 2026-11-06, saved in `evidence/github-metadata.json`:

- Repository `FullStackAssets/QUAHOG_Web`.
- One deployment, id `7166602492`, environment `github-pages`, `production_environment: false`, ref `Preview`, sha `1586854c1c583abf13c4bfb7631652c068b7725a`, created `2026-10-19T05:42:11Z`.
- Pages source branch `Preview`, path `/`, status `built`, URL `https://fullstackassets.github.io/QUAHOG_Web/`.
- The response body of that URL was not fetched. No Vercel production deployment was queried. `ENV.md` names project `projectsouthcoast` and does not record a production hostname.

`1586854c1c583abf13c4bfb7631652c068b7725a` is the tip of `origin/Preview` and an ancestor of `main`. It is not an attested production release.

## Rollback design

There is no rollback target today. The release record has neither `previousProductionCommit` nor `previousArtifactSha256`, and production bytes were not read. GitHub Pages on `Preview` is not a substitute.

Rollback, once a release exists, is a redeploy of the last attested artifact:

1. Stop the rollout. Do not edit pins so the bad build matches the checker.
2. Use the attested record whose `subjectCommit` is an ancestor of the bad commit and whose `previousArtifactSha256` still identifies stored bytes.
3. A human puts those bytes back on the production host only.
4. Re-run `node deployment/reconciliation/cli.mjs`. Ancestry and hash checks have to pass.
5. If no attested artifact exists, leave production untouched. Do not rebuild floating `main` and do not publish `Preview` as the rollback.

A first production release is blocked until a human has captured the bytes actually serving the production host. Setting a waiver field does not clear that block. The checker rejects `noRollbackTarget`.

## Blockers a human has to clear

1. Import or otherwise produce the missing BUILD002 commits (`9295b91`, `62f6d1e`, `bfa20b1`) and show they are ancestors of the commit to ship. Do not delete the claims from the audit to make ancestry pass.
2. Attach and read the external waterfront archive, or stop citing `e8b88c8ece536cb3d86d09fc6edc2ab4582f9dad` as if this repo had verified it.
3. Decide the 14 root MP3 duplicates and the root `manifest.json`. The production asset set is `public/music`. This change does not delete or rewrite those files.
4. Stop `npm run build` from rewriting tracked manifests, then re-run the official build. A clean exit is not sufficient while `generatedAt` changes.
5. Attest `records/production.json` by hand: named approver, time, full `subjectCommit` equal to the tip of `main`, production hostname, music pins, public-tree fingerprint, previous production commit, and previous artifact sha256. This tool has no attest command.
6. Record a real production host. Retire the preview publisher as the rollout path. Do not point production at `github.io` or at branch `Preview`.
7. Read the live production response and record its body sha256 against that same commit. Metadata from GitHub Pages does not satisfy the check.

## After the blockers are clear

A named human attests the record in a reviewed change, re-runs the reconciler on the tip of `main`, and only then publishes that commit's dist to the attested production host. This document does not contain that publish procedure as commands, because running them is out of scope and the checks above have not passed.
