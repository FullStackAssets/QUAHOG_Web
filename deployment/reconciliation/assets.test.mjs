import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { classifyArchiveName, verifyManifest, verifyMusicManifests, verifyUnscoped } from "./assets.mjs";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "assets-"));
  mkdirSync(join(root, "public", "music", "whale"), { recursive: true });
  return root;
}

test("a manifest that matches the files beside it passes", () => {
  const root = repo();
  try {
    writeFileSync(join(root, "public", "music", "whale", "tone.mp3"), "tone");
    writeFileSync(join(root, "public", "music", "whale", "manifest.json"), JSON.stringify({
      station: "whale",
      tracks: ["tone.mp3"],
    }));
    const result = verifyMusicManifests(root);
    assert.equal(result.ok, true, result.failures.join("; "));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing files, absolute URLs, and unlisted audio fail closed", () => {
  const root = repo();
  try {
    writeFileSync(join(root, "public", "music", "whale", "extra.mp3"), "extra");
    writeFileSync(join(root, "public", "music", "whale", "manifest.json"), JSON.stringify({
      station: "whale",
      tracks: ["missing.mp3", "https://cdn.example/track.mp3"],
    }));
    const result = verifyManifest(root, join(root, "public", "music", "whale", "manifest.json"));
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /missing track file/);
    assert.match(result.failures.join("\n"), /absolute URL/);
    assert.match(result.failures.join("\n"), /not listed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("audio outside public/music fails even when the bytes match", () => {
  const root = repo();
  try {
    writeFileSync(join(root, "public", "music", "whale", "tone.mp3"), "same");
    writeFileSync(join(root, "tone.mp3"), "same");
    const result = verifyUnscoped(root);
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /duplicates/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a preview zip is not accepted as the external archive", () => {
  const verdict = classifyArchiveName("quahog-web-preview 2.zip");
  assert.equal(verdict.accepted, false);
  assert.equal(classifyArchiveName("narrows-waterfront-implementation.zip").accepted, true);
});
