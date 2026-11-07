import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

describe("assets:audit", () => {
  it("passes against the committed license catalog", () => {
    const script = join(process.cwd(), "scripts", "assets_audit.mjs");
    const out = execFileSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(out).toMatch(/OK/);
  });
});
