#!/usr/bin/env node
/**
 * §0.5 / RELEASE Legal — fail closed when a shipped binary lacks a license row.
 * Usage: node scripts/assets_audit.mjs
 * Exit 0 = covered; exit 1 = missing coverage or malformed catalog.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const publicDir = join(root, "public");
const catalogPath = join(publicDir, "assets-licenses.json");
const registryPath = join(root, "src", "assets", "modelRegistry.ts");

const BINARY_EXT = new Set([".glb", ".mp3", ".png", ".jpg", ".jpeg", ".webp", ".ogg", ".wav"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "." || name === "..") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function toPosix(rel) {
  return rel.split(sep).join("/");
}

function matchGlob(path, glob) {
  // Minimal glob: ** and * only.
  const esc = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DS::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DS::/g, ".*");
  return new RegExp(`^${esc}$`).test(path);
}

function loadCatalog() {
  if (!existsSync(catalogPath)) {
    return { ok: false, issues: [`missing ${relative(root, catalogPath)}`], entries: [] };
  }
  const raw = JSON.parse(readFileSync(catalogPath, "utf8"));
  const issues = [];
  if (raw.kind !== "main-game-asset-licenses") issues.push("catalog kind mismatch");
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) issues.push("catalog has no entries");
  for (const e of raw.entries ?? []) {
    if (!e.id || !e.license || !e.status) issues.push(`entry missing id/license/status: ${JSON.stringify(e)}`);
    if (!e.paths?.length && !e.globs?.length && !e.runtime) {
      issues.push(`entry ${e.id} has no paths/globs/runtime`);
    }
  }
  return { ok: issues.length === 0, issues, entries: raw.entries ?? [], raw };
}

function coveredBy(rel, entries) {
  for (const e of entries) {
    if (e.paths?.some((p) => p === rel)) return e;
    if (e.globs?.some((g) => matchGlob(rel, g))) return e;
  }
  return null;
}

function registryCredits() {
  if (!existsSync(registryPath)) return { ids: [], missingCredit: ["modelRegistry.ts missing"] };
  const src = readFileSync(registryPath, "utf8");
  const ids = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  const blocks = src.split(/\{\s*\n/).slice(1);
  const missingCredit = [];
  for (const block of blocks) {
    const id = block.match(/id:\s*"([^"]+)"/)?.[1];
    if (!id) continue;
    if (block.includes('role: "character"') && !/credit:\s*"/.test(block)) {
      missingCredit.push(id);
    }
  }
  return { ids, missingCredit };
}

function main() {
  const catalog = loadCatalog();
  const issues = [...catalog.issues];

  const binaries = walk(publicDir)
    .map((abs) => toPosix(relative(publicDir, abs)))
    .filter((rel) => {
      const lower = rel.toLowerCase();
      return [...BINARY_EXT].some((ext) => lower.endsWith(ext));
    })
    // Manifest / preview tooling JSON is not a binary; skip non-media.
    .filter((rel) => !rel.endsWith(".json"))
    .sort();

  const uncovered = [];
  for (const rel of binaries) {
    if (!coveredBy(rel, catalog.entries)) uncovered.push(rel);
  }
  if (uncovered.length) {
    issues.push(`unlicensed binaries (${uncovered.length}): ${uncovered.slice(0, 12).join(", ")}${uncovered.length > 12 ? "…" : ""}`);
  }

  // Explicit paths in the catalog must exist (skip runtime-only rows).
  for (const e of catalog.entries) {
    for (const p of e.paths ?? []) {
      if (!existsSync(join(publicDir, p))) issues.push(`catalog path missing on disk: ${p}`);
    }
  }

  const reg = registryCredits();
  for (const id of reg.missingCredit) issues.push(`registry character ${id} missing credit field`);

  // Every character model id in the registry should have a catalog row.
  for (const id of reg.ids) {
    if (!catalog.entries.some((e) => e.id === id)) {
      // Only flag known character ids from MAIN_GAME_MODELS style entries.
      if (["cesium-man", "lizzie", "remington-borden"].includes(id)) {
        issues.push(`registry model ${id} missing from assets-licenses.json`);
      }
    }
  }

  const pending = catalog.entries.filter((e) => e.status === "pending-commercial").map((e) => e.id);

  if (issues.length) {
    console.error("[assets:audit] FAIL");
    for (const i of issues) console.error(" -", i);
    process.exit(1);
  }

  console.log("[assets:audit] OK");
  console.log(`  binaries covered: ${binaries.length}`);
  console.log(`  catalog entries: ${catalog.entries.length}`);
  if (pending.length) {
    console.log(`  pending-commercial (not a failure): ${pending.join(", ")}`);
  }
}

main();
