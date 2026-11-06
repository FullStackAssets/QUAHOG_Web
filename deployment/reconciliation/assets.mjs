import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { fileEntry, fingerprintFiles, sha256File, toPosix, walkFiles } from "./fingerprint.mjs";

const AUDIO = /\.(mp3|m4a|aac|ogg|wav)$/i;

export function expectedStation(repoRoot, manifestPath) {
  const rel = toPosix(relative(join(repoRoot, "public", "music"), manifestPath));
  if (rel.startsWith("..") || rel === "manifest.json") return null;
  const folder = dirname(rel);
  if (!folder || folder === ".") return null;
  return folder;
}

export function verifyManifest(repoRoot, manifestPath) {
  const failures = [];
  const rel = toPosix(relative(repoRoot, manifestPath));
  let data;
  try {
    data = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { path: rel, ok: false, failures: ["manifest is not valid JSON"], files: [] };
  }
  if (!data || !Array.isArray(data.tracks)) failures.push("tracks must be an array");
  const station = expectedStation(repoRoot, manifestPath);
  const scoped = station !== null;
  if (!scoped) failures.push("manifest is outside public/music");
  else if (data.station !== station) failures.push(`station ${JSON.stringify(data.station)} does not match directory ${station}`);

  const dir = dirname(manifestPath);
  const seen = new Set();
  const files = [];
  for (const track of data.tracks ?? []) {
    if (typeof track !== "string" || track.length === 0) {
      failures.push("track entry is empty");
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(track)) {
      failures.push(`absolute URL is not a pinned local asset: ${track}`);
      continue;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(track);
    } catch {
      failures.push(`track encoding is invalid: ${track}`);
      continue;
    }
    if (decoded.includes("..") || decoded.includes("/") || decoded.includes("\\") || decoded !== basename(decoded)) {
      failures.push(`track path is not a single file name: ${track}`);
      continue;
    }
    if (seen.has(decoded)) failures.push(`duplicate track: ${decoded}`);
    seen.add(decoded);
    const full = join(dir, decoded);
    if (!existsSync(full) || !statSync(full).isFile()) failures.push(`missing track file: ${decoded}`);
    else files.push(fileEntry(repoRoot, full));
  }

  let onDisk = [];
  try {
    onDisk = readdirSync(dir).filter((name) => AUDIO.test(name));
  } catch {
    failures.push("manifest directory cannot be read");
  }
  for (const name of onDisk) {
    if (!seen.has(name)) failures.push(`audio file is not listed: ${name}`);
  }

  return { path: rel, ok: failures.length === 0, failures, files, scoped, station: data.station ?? null };
}

export function musicManifestPaths(repoRoot) {
  return walkFiles(join(repoRoot, "public", "music")).filter((full) => basename(full) === "manifest.json");
}

export function extraManifestPaths(repoRoot) {
  return walkFiles(repoRoot).filter((full) => {
    if (basename(full) !== "manifest.json") return false;
    const rel = toPosix(relative(repoRoot, full));
    if (rel.startsWith("public/music/")) return false;
    if (rel.startsWith("deployment/reconciliation/")) return false;
    return true;
  });
}

export function verifyMusicManifests(repoRoot) {
  const manifests = musicManifestPaths(repoRoot).map((full) => verifyManifest(repoRoot, full));
  const failures = manifests.flatMap((manifest) => manifest.failures.map((failure) => `${manifest.path}: ${failure}`));
  if (manifests.length === 0) failures.push("no manifests under public/music");
  return { ok: failures.length === 0, failures, manifests };
}

export function canonicalMusicPins(manifests) {
  const pins = [];
  for (const manifest of manifests) {
    const full = manifest.manifestPath;
    if (full) pins.push(full);
    for (const file of manifest.files ?? []) pins.push(file);
  }
  const unique = new Map();
  for (const pin of pins) unique.set(pin.path, { path: pin.path, sha256: pin.sha256 });
  return [...unique.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function verifyUnscoped(repoRoot) {
  const failures = [];
  const audio = walkFiles(repoRoot).filter((full) => AUDIO.test(full));
  const scoped = [];
  const unscoped = [];
  for (const full of audio) {
    const rel = toPosix(relative(repoRoot, full));
    const entry = { ...fileEntry(repoRoot, full), base: basename(full) };
    if (rel.startsWith("public/music/")) scoped.push(entry);
    else unscoped.push(entry);
  }
  const scopedByBase = new Map();
  for (const entry of scoped) {
    const list = scopedByBase.get(entry.base) ?? [];
    list.push(entry);
    scopedByBase.set(entry.base, list);
  }
  for (const entry of unscoped) {
    const twins = scopedByBase.get(entry.base) ?? [];
    if (twins.length === 1 && twins[0].sha256 === entry.sha256) {
      failures.push(`${entry.path} duplicates ${twins[0].path} and is outside public/music`);
    } else if (twins.length === 1) {
      failures.push(`${entry.path} diverges from ${twins[0].path}`);
    } else if (twins.length > 1) {
      failures.push(`${entry.path} matches more than one public/music file name`);
    } else {
      failures.push(`${entry.path} is audio outside public/music`);
    }
  }

  const extras = extraManifestPaths(repoRoot).map((full) => verifyManifest(repoRoot, full));
  for (const manifest of extras) {
    failures.push(`${manifest.path} is not a public/music manifest`);
    for (const failure of manifest.failures) {
      if (failure === "manifest is outside public/music") continue;
      failures.push(`${manifest.path}: ${failure}`);
    }
  }
  return { ok: failures.length === 0, failures, unscoped, extras };
}

export function verifyPublicTree(repoRoot, record) {
  const directory = join(repoRoot, "public");
  if (!existsSync(directory)) {
    return { ok: false, failures: ["public/ is missing"], fingerprint: null, fileCount: 0, totalBytes: 0 };
  }
  const entries = walkFiles(directory).map((full) => fileEntry(repoRoot, full));
  const summary = fingerprintFiles(entries);
  const failures = [];
  if (record?.attested !== true || typeof record.publicTreeFingerprint !== "string") {
    failures.push("no attested public-tree fingerprint; the observed fingerprint is not a reconciliation");
  } else if (record.publicTreeFingerprint !== summary.fingerprint) {
    failures.push("attested public-tree fingerprint does not match the tree");
  }
  return { ok: failures.length === 0, failures, ...summary };
}

export function attachManifestHashes(repoRoot, manifests) {
  return manifests.map((manifest) => {
    const full = join(repoRoot, manifest.path);
    return { ...manifest, manifestPath: fileEntry(repoRoot, full) };
  });
}

export function classifyArchiveName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("preview")) return { accepted: false, reason: "filename marks a preview artifact, not the documented waterfront archive" };
  if (lower.includes("waterfront-implementation") || lower === "sha256sums" || lower.includes("sha256sums")) {
    return { accepted: true, reason: "filename matches the documented external archive" };
  }
  return { accepted: false, reason: "not the documented external archive" };
}

export function findArchiveCandidates(repoRoot) {
  const found = [];
  for (const full of walkFiles(repoRoot)) {
    const name = basename(full);
    const lower = name.toLowerCase();
    if (!(lower.endsWith(".zip") || lower.includes("sha256sums"))) continue;
    const rel = toPosix(relative(repoRoot, full));
    if (rel.startsWith("deployment/reconciliation/")) continue;
    const verdict = classifyArchiveName(name);
    const item = { path: rel, bytes: statSync(full).size, accepted: verdict.accepted, reason: verdict.reason };
    if (verdict.accepted) item.sha256 = sha256File(full);
    found.push(item);
  }
  return found;
}
