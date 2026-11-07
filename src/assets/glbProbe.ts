// Read-only GLB header probe. Used to see whether a file needs
// EXT_meshopt_compression before GLTFLoader parses it.

export const MESHOPT_EXTENSION = "EXT_meshopt_compression";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

export type GlbProbe = {
  byteLength: number;
  declaredLength: number;
  version: number;
  extensionsUsed: string[];
  extensionsRequired: string[];
  meshopt: boolean;
  meshoptRequired: boolean;
  generator: string | null;
  meshCount: number;
  animationCount: number;
};

export type GlbProbeResult =
  | { ok: true; probe: GlbProbe }
  | { ok: false; reason: "too-small" | "bad-magic" | "bad-json" | "no-json-chunk" };

export function probeGlb(bytes: Uint8Array): GlbProbeResult {
  if (bytes.byteLength < 20) return { ok: false, reason: "too-small" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) return { ok: false, reason: "bad-magic" };
  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);
  let offset = 12;
  let jsonText: string | null = null;
  const decoder = new TextDecoder();
  while (offset + 8 <= bytes.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength <= 0 || offset + chunkLength > bytes.byteLength) break;
    if (chunkType === JSON_CHUNK) {
      jsonText = decoder.decode(bytes.subarray(offset, offset + chunkLength));
      break;
    }
    offset += chunkLength;
  }
  if (jsonText == null) return { ok: false, reason: "no-json-chunk" };
  let json: unknown;
  try {
    json = JSON.parse(jsonText);
  } catch {
    return { ok: false, reason: "bad-json" };
  }
  const doc = (json && typeof json === "object" ? json : {}) as {
    extensionsUsed?: unknown;
    extensionsRequired?: unknown;
    asset?: { generator?: unknown };
    meshes?: unknown;
    animations?: unknown;
  };
  const extensionsUsed = stringList(doc.extensionsUsed);
  const extensionsRequired = stringList(doc.extensionsRequired);
  return {
    ok: true,
    probe: {
      byteLength: bytes.byteLength,
      declaredLength,
      version,
      extensionsUsed,
      extensionsRequired,
      meshopt: extensionsUsed.includes(MESHOPT_EXTENSION),
      meshoptRequired: extensionsRequired.includes(MESHOPT_EXTENSION),
      generator: typeof doc.asset?.generator === "string" ? doc.asset.generator : null,
      meshCount: Array.isArray(doc.meshes) ? doc.meshes.length : 0,
      animationCount: Array.isArray(doc.animations) ? doc.animations.length : 0,
    },
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
