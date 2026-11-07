import type { ModelRole, RegistryModel } from "./modelRegistry";

export type ModelManifestEntry = {
  id: string;
  file: string;
  bytes: number;
  meshopt: boolean;
  meshoptRequired: boolean;
  extensionsUsed: string[];
  extensionsRequired: string[];
  role: ModelRole;
  generator: string | null;
};

export type ModelManifest = {
  kind: "main-game-models";
  source: "repo-public-models";
  integrationDoc: string | null;
  handoffArchiveAttached: boolean;
  entries: ModelManifestEntry[];
};

export type ManifestFileRecord = {
  file: string;
  bytes: number;
  meshopt: boolean;
  meshoptRequired: boolean;
};

export type ManifestIssue = {
  code:
    | "invalid-manifest"
    | "kind-mismatch"
    | "duplicate-id"
    | "duplicate-file"
    | "missing-file"
    | "unlisted-file"
    | "byte-mismatch"
    | "meshopt-flag-mismatch"
    | "meshopt-required-mismatch"
    | "registry-missing"
    | "registry-extra"
    | "registry-url-mismatch"
    | "role-mismatch";
  detail: string;
};

const ROLES: readonly ModelRole[] = ["character", "prop", "vehicle", "building", "other"];

export function parseModelManifest(value: unknown): { manifest: ModelManifest | null; issues: ManifestIssue[] } {
  if (!value || typeof value !== "object") {
    return { manifest: null, issues: [{ code: "invalid-manifest", detail: "Model manifest is not a JSON object" }] };
  }
  const doc = value as Partial<ModelManifest>;
  if (doc.kind !== "main-game-models") {
    return {
      manifest: null,
      issues: [{ code: "kind-mismatch", detail: `Model manifest kind is ${JSON.stringify(doc.kind)}` }],
    };
  }
  if (!Array.isArray(doc.entries)) {
    return { manifest: null, issues: [{ code: "invalid-manifest", detail: "Model manifest entries is not a list" }] };
  }
  if (typeof doc.handoffArchiveAttached !== "boolean") {
    return { manifest: null, issues: [{ code: "invalid-manifest", detail: "handoffArchiveAttached must be a boolean" }] };
  }
  const issues: ManifestIssue[] = [];
  const entries: ModelManifestEntry[] = [];
  for (const raw of doc.entries) {
    const entry = parseEntry(raw);
    if (!entry) {
      issues.push({ code: "invalid-manifest", detail: "A model manifest entry is missing id, file, bytes, or role" });
      continue;
    }
    entries.push(entry);
  }
  if (issues.length) return { manifest: null, issues };
  return {
    manifest: {
      kind: "main-game-models",
      source: "repo-public-models",
      integrationDoc: typeof doc.integrationDoc === "string" ? doc.integrationDoc : null,
      handoffArchiveAttached: doc.handoffArchiveAttached,
      entries,
    },
    issues: [],
  };
}

export function checkModelManifest(input: {
  manifest: ModelManifest;
  files: readonly ManifestFileRecord[] | null;
  registry: readonly RegistryModel[];
}): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const ids = new Set<string>();
  const filesInManifest = new Set<string>();
  for (const entry of input.manifest.entries) {
    if (ids.has(entry.id)) issues.push({ code: "duplicate-id", detail: `Duplicate manifest id ${entry.id}` });
    ids.add(entry.id);
    if (filesInManifest.has(entry.file)) issues.push({ code: "duplicate-file", detail: `Duplicate manifest file ${entry.file}` });
    filesInManifest.add(entry.file);
  }

  if (input.files) {
    const onDisk = new Map(input.files.map((file) => [file.file, file]));
    for (const file of input.files) {
      if (!filesInManifest.has(file.file)) {
        issues.push({ code: "unlisted-file", detail: `${file.file} is on disk and missing from the model manifest` });
      }
    }
    for (const entry of input.manifest.entries) {
      const file = onDisk.get(entry.file);
      if (!file) {
        issues.push({ code: "missing-file", detail: `Manifest lists ${entry.file}, which is not in the file set` });
        continue;
      }
      if (file.bytes !== entry.bytes) {
        issues.push({
          code: "byte-mismatch",
          detail: `${entry.file} is ${file.bytes} bytes; manifest says ${entry.bytes}`,
        });
      }
      if (file.meshopt !== entry.meshopt) {
        issues.push({
          code: "meshopt-flag-mismatch",
          detail: `${entry.file} meshopt flag is ${file.meshopt}; manifest says ${entry.meshopt}`,
        });
      }
      if (file.meshoptRequired !== entry.meshoptRequired) {
        issues.push({
          code: "meshopt-required-mismatch",
          detail: `${entry.file} meshopt-required flag is ${file.meshoptRequired}; manifest says ${entry.meshoptRequired}`,
        });
      }
    }
  }

  const byId = new Map(input.manifest.entries.map((entry) => [entry.id, entry]));
  const registryById = new Map(input.registry.map((model) => [model.id, model]));
  const registryIds = new Set<string>();
  for (const entry of input.manifest.entries) {
    const model = registryById.get(entry.id);
    if (model && entry.role !== model.role) {
      issues.push({ code: "role-mismatch", detail: `${entry.id} role is ${model.role} in the registry and ${entry.role} in the manifest` });
    }
  }
  for (const model of input.registry) {
    registryIds.add(model.id);
    const entry = byId.get(model.id);
    if (!entry) {
      issues.push({ code: "registry-missing", detail: `Main game requests ${model.id} (${model.file}), which the manifest does not list` });
      continue;
    }
    if (entry.file !== model.file) {
      issues.push({
        code: "registry-url-mismatch",
        detail: `${model.id} registry file is ${model.file}; manifest file is ${entry.file}`,
      });
    }
    if (!model.url.endsWith(`/${model.file}`) && model.url !== model.file) {
      issues.push({ code: "registry-url-mismatch", detail: `${model.id} url ${model.url} does not end with ${model.file}` });
    }
  }
  for (const entry of input.manifest.entries) {
    if (!registryIds.has(entry.id)) {
      issues.push({ code: "registry-extra", detail: `Manifest lists ${entry.id} (${entry.file}), which the main game loader does not request` });
    }
  }
  return issues;
}

function parseEntry(value: unknown): ModelManifestEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<ModelManifestEntry>;
  if (typeof entry.id !== "string" || typeof entry.file !== "string") return null;
  if (typeof entry.bytes !== "number" || !Number.isFinite(entry.bytes)) return null;
  if (typeof entry.meshopt !== "boolean" || typeof entry.meshoptRequired !== "boolean") return null;
  if (typeof entry.role !== "string" || !ROLES.includes(entry.role as ModelRole)) return null;
  return {
    id: entry.id,
    file: entry.file,
    bytes: entry.bytes,
    meshopt: entry.meshopt,
    meshoptRequired: entry.meshoptRequired,
    extensionsUsed: stringList(entry.extensionsUsed),
    extensionsRequired: stringList(entry.extensionsRequired),
    role: entry.role as ModelRole,
    generator: typeof entry.generator === "string" ? entry.generator : null,
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
