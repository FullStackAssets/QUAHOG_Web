import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Build stamp: prefer Vercel's injected commit SHA; fall back to local git so a
// dev build is still identifiable. Surfaced in-game (HUD corner) so it's obvious
// which build is live after a deploy + hard refresh.
function commitSha(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __BUILD_SHA__: JSON.stringify(commitSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: "index.html", // the game slice
        earth: "earth.html", // Google Photorealistic 3D Tiles test
      },
      output: {
        // Split the heavy engine deps into their own long-lived vendor chunks so
        // they cache across deploys and don't bloat the main app chunk. Each only
        // re-downloads when that library actually changes, not on every game edit.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // order matters: match the more specific scoped packages before the
          // bare "three"/"react" substrings (which they also contain).
          if (id.includes("rapier")) return "vendor-rapier";
          if (id.includes("@react-three")) return "vendor-r3f";
          if (id.includes("node_modules/three")) return "vendor-three";
          if (id.includes("node_modules/react") || id.includes("react-dom") || id.includes("/scheduler/")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },
});
