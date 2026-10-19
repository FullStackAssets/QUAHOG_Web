#!/usr/bin/env node
// Scan public/music/<station>/ and write a manifest.json into each station
// folder listing its audio files. Zero dependencies. Run it after dropping in
// new MP3s (or let `prebuild`/`predev` run it automatically — see package.json).
//
//   node scripts/gen_manifests.mjs
//
// Output per station, e.g. public/music/whale/manifest.json:
//   { "station": "whale", "tracks": ["track1.mp3","track2.mp3"], "generatedAt": "…" }
//
// The radio (src/audio/radioEngine.ts) reads music/<station>/manifest.json and
// plays the listed tracks, falling back to the procedural synth when none exist.

import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = join(HERE, "..", "public", "music");
const AUDIO = /\.(mp3|m4a|aac|ogg|wav)$/i;

// Write a manifest.json into `dir` listing its audio files (URL-encoded, natural
// sorted). Returns the track count. Empty dirs still get a manifest so the
// runtime fetch is a clean 200 rather than a 404.
function writeManifest(dir, label) {
  const tracks = readdirSync(dir)
    .filter((f) => AUDIO.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((f) => encodeURIComponent(f));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ station: label, tracks, generatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`  [${label}] ${tracks.length} track(s) → manifest.json`);
  return tracks.length;
}

function main() {
  let entries;
  try {
    entries = readdirSync(MUSIC_DIR, { withFileTypes: true });
  } catch {
    console.log(`(no ${MUSIC_DIR} yet — create public/music/<station>/ and drop MP3s in)`);
    process.exit(0); // not an error: nothing to do
  }

  const stations = entries.filter((e) => e.isDirectory());
  let total = 0;

  for (const s of stations) {
    const dir = join(MUSIC_DIR, s.name);
    total += writeManifest(dir, s.name);
    // also emit a manifest for any sub-folder of audio (e.g. jingles/, vo/)
    for (const sub of readdirSync(dir, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      const subdir = join(dir, sub.name);
      total += writeManifest(subdir, `${s.name}/${sub.name}`);
    }
  }

  console.log(`✓ ${total} clip(s) across ${stations.length} station(s).`);
}

main();
