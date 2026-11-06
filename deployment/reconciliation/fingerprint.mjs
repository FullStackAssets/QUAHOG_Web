import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

export function toPosix(path) {
  return path.split(sep).join("/");
}

const PRUNE = new Set(["node_modules", "dist", ".git"]);

export function walkFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (PRUNE.has(entry.name)) continue;
        visit(full);
        continue;
      }
      if (entry.isFile()) out.push(full);
    }
  };
  visit(root);
  return out;
}

export function fingerprintFiles(entries) {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const lines = sorted.map((entry) => `${entry.path}\t${entry.sha256}\t${entry.bytes}`).join("\n");
  const totalBytes = sorted.reduce((sum, entry) => sum + entry.bytes, 0);
  return {
    fingerprint: sha256Buffer(Buffer.from(lines)),
    fileCount: sorted.length,
    totalBytes,
  };
}

export function fingerprintDirectory(root, repoRoot = root) {
  const entries = walkFiles(root).map((full) => {
    const bytes = statSync(full).size;
    return {
      path: toPosix(relative(repoRoot, full)),
      sha256: sha256File(full),
      bytes,
    };
  });
  return { ...fingerprintDirectoryFromEntries(entries), entries };
}

function fingerprintDirectoryFromEntries(entries) {
  return fingerprintFiles(entries);
}

export function fileEntry(repoRoot, full) {
  return {
    path: toPosix(relative(repoRoot, full)),
    sha256: sha256File(full),
    bytes: statSync(full).size,
  };
}
