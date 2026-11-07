import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { parseArgs } from "./policy.mjs";

test("forbidden reconciliation flags are refused before any check", () => {
  for (const flag of ["--waive", "--update-hashes", "--rewrite-hashes", "--force", "--attest", "--staging", "--deploy", "--prod"]) {
    const parsed = parseArgs([flag]);
    assert.equal(parsed.refused, true, flag);
    assert.equal(parsed.forbidden.length, 1, flag);
  }
});

test("unknown flags and positionals are refused", () => {
  assert.equal(parseArgs(["--frob"]).refused, true);
  assert.equal(parseArgs(["now"]).refused, true);
});

test("the cli exits 2 for a waiver and does not print a passing report", () => {
  const result = spawnSync(process.execPath, ["deployment/reconciliation/cli.mjs", "--waive"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  const body = JSON.parse(result.stderr);
  assert.equal(body.ok, false);
  assert.equal(body.refused, true);
  assert.equal(result.stdout, "");
});
