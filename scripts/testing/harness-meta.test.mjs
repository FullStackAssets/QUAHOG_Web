// Node-side checks for the isolated harness. Kept out of src/ so the test
// suite can use node:fs and node:child_process without adding @types/node.
// This file is not a production gate.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HANG_GUARD_MS = 5_000;

describe("harness stays out of the runtime", () => {
  it("is not imported by the game, earth, materials, or loaders", () => {
    const offenders = sourceFiles(path.join(root, "src")).filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes("testing/perfHarness") || text.includes("perf-harness");
    });
    expect(offenders).toEqual([]);

    const harness = readFileSync(path.join(root, "src/testing/perfHarness.ts"), "utf8");
    const imports = harness.split("\n").filter((line) => line.startsWith("import "));
    expect(imports.join("\n")).not.toMatch(/earth|three|react|webgl/i);

    const cli = readFileSync(path.join(root, "scripts/testing/run-main-game-harness.ts"), "utf8");
    const cliImports = cli.split("\n").filter((line) => line.startsWith("import ") || line.includes(" from "));
    expect(cliImports.join("\n")).not.toMatch(/src\/earth|src\/world|src\/actors/);
    expect(cliImports.join("\n")).toContain("src/testing/perfHarness.ts");
  });

  it("runs the node CLI and parses a renderer-free report", () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/testing/run-main-game-harness.ts"],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/not a physical phone session/);
    const report = JSON.parse(result.stdout);
    expect(report.schema).toBe("main-game-isolated-harness/v1");
    expect(report.label).toBe("not-physical-iphone-safari");
    expect(report.physicalIphoneSafari).toBe(false);
    expect(report.fps).toBeNull();
    expect(report.thermal).toBeNull();
    expect(report.readsRenderer).toBe(false);
    expect(report.environment.runtime).toBe("node");
    expect(report.environment.renderer).toBe("none");
    expect(report.environment.browser).toBeNull();
    expect(report.classification.acceptedAsPhysicalIphoneSafari).toBe(false);
    expect(report.classification.label).toBe("not-physical-iphone-safari");
    expect(report.workload).toBe("inline-integer-mix-does-not-import-renderer");
    expect(report.samples).toHaveLength(1);
    expect(report.samples[0].name).toBe("bounded-integer-mix");
    expect(report.samples[0].iterations).toBe(20_000);
    expect(report.samples[0].elapsedMs).toBeGreaterThanOrEqual(0);
    expect(report.samples[0].elapsedMs).toBeLessThan(HANG_GUARD_MS);
    expect(report.samples[0].checksum).toBeUndefined();
    expect(report.physicalTraversal.minutesPerQuality).toBe(10);
    expect(report.physicalTraversal.qualities).toEqual(["Low", "Medium", "High"]);
    expect(report.physicalTraversal.performedInThisRun).toBe(false);
    expect(report.r3Archive.attachedToWorkspace).toBe(false);
    expect(report.r3Archive.inspected).toBe(false);
  });
});

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "testing") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}
