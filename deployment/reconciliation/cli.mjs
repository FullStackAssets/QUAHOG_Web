#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "./policy.mjs";
import { reconcile } from "./reconcile.mjs";

const HELP = `Production reconciliation (read-only, fail closed).

  node deployment/reconciliation/cli.mjs [--repo path] [--out report.json] [--execute-build]

Exit 0 only when every check passes. Exit 1 when a check fails. Exit 2 when the
invocation asks to waive a failure, rewrite hashes, attest, deploy, or create
staging. This command never publishes and never edits the release record.
`;

const parsed = parseArgs(process.argv.slice(2));
if (parsed.refused) {
  console.error(JSON.stringify({
    ok: false,
    refused: true,
    forbidden: parsed.forbidden,
    unknown: parsed.unknown,
    positionals: parsed.positionals,
  }, null, 2));
  process.exit(2);
}
if (parsed.help) {
  console.log(HELP);
  process.exit(0);
}

if (parsed.executeBuild && parsed.values["--build-evidence"]) {
  console.error(JSON.stringify({
    ok: false,
    refused: true,
    unknown: ["--execute-build cannot be combined with --build-evidence"],
  }, null, 2));
  process.exit(2);
}

const repo = resolve(parsed.values["--repo"] ?? process.cwd());
const report = reconcile({
  repo,
  executeBuild: parsed.executeBuild,
  ...(parsed.values["--build-evidence"]
    ? { buildObservation: JSON.parse(readFileSync(parsed.values["--build-evidence"], "utf8")), loadBuildEvidence: false }
    : {}),
  ...(parsed.values["--live-evidence"]
    ? { liveEvidence: JSON.parse(readFileSync(parsed.values["--live-evidence"], "utf8")) }
    : {}),
});
const json = `${JSON.stringify(report, null, 2)}\n`;
if (parsed.values["--out"]) writeFileSync(resolve(parsed.values["--out"]), json);
else process.stdout.write(json);
process.exit(report.ok ? 0 : 1);
