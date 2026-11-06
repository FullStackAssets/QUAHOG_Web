// CLI for the isolated main-game harness.
//
// Run:
//   node --experimental-strip-types scripts/testing/run-main-game-harness.ts
//
// This is not a production gate. The production-gate scripts are owned by
// another agent. This file does not import the renderer, materials, loaders,
// or src/earth. stdout is one JSON report. elapsedMs is process wall-clock.
//
// Do not copy that number into an FPS column or a thermal column, and do not
// describe it as iPhone Safari.

import {
  buildReport,
  collectEnvironment,
  runBoundedSample,
} from "../../src/testing/perfHarness.ts";

const sample = runBoundedSample("bounded-integer-mix", 20_000, (i) => ((i * 17) ^ (i >>> 3)) % 997);

const report = buildReport({
  samples: [sample],
  surface: "node-harness",
  environment: collectEnvironment(),
  workload: "inline-integer-mix-does-not-import-renderer",
});

process.stderr.write(
  "isolated node harness — not a physical phone session, not a frame rate, not a thermal reading\n",
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
