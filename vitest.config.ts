import { defineConfig } from "vitest/config";

// Unit tests target the pure game-logic modules (stats, economy, missions,
// races, quality presets). They run in Node with a tiny localStorage stub
// (setup.ts) so the zustand stores' save/load paths don't throw.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
