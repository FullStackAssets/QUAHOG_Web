import { defineConfig } from "vitest/config";

// Unit tests target the pure game-logic modules (stats, economy, missions,
// races, quality presets). They run in Node with a tiny localStorage stub
// (setup.ts) so the zustand stores' save/load paths don't throw.
export default defineConfig({
  test: {
    environment: "node",
    // The .mjs file lives outside src so it can spawn the CLI and walk the
    // tree with Node's own fs. tsc does not typecheck it (no @types/node).
    include: ["src/**/*.test.ts", "scripts/testing/**/*.test.mjs"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
