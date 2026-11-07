import type { DecoderStatus } from "./meshoptLifecycle";
import type { GlbProbe } from "./glbProbe";

export type LoadAction = "parse" | "fallback";

export function planGltfLoad(probe: GlbProbe, decoder: DecoderStatus): { action: LoadAction; reason: string | null } {
  if (!probe.meshopt) return { action: "parse", reason: null };
  if (decoder === "failed") return { action: "fallback", reason: "meshopt-decoder-failed" };
  if (decoder === "unsupported") return { action: "fallback", reason: "meshopt-decoder-unsupported" };
  // idle / pending / ready: the loader attaches the decoder object, and
  // GLTFLoader waits on decodeGltfBufferAsync / decoder.ready before decode.
  return { action: "parse", reason: null };
}

export function classifyGltfLoadError(message: string): { code: string; summary: string } {
  const lower = message.toLowerCase();
  if (lower.includes("setmeshoptdecoder")) {
    return { code: "meshopt-decoder-missing", summary: "Meshopt decoder was not attached, so this compressed model was not decoded" };
  }
  if (lower.includes("malformed buffer") || lower.includes("meshopt")) {
    return { code: "meshopt-decode-failed", summary: "Meshopt decode failed" };
  }
  if (lower.includes("abort")) return { code: "aborted", summary: "Model load was aborted" };
  if (lower.includes("404") || lower.includes("not found")) {
    return { code: "http-404", summary: "Model file was not found" };
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return { code: "network", summary: "Model request failed" };
  }
  const summary = message.trim().slice(0, 180) || "GLB could not be parsed";
  return { code: "decode-failed", summary };
}

const FALLBACK_SUMMARY: Record<string, string> = {
  "meshopt-decoder-failed": "Meshopt decoder failed to start, so this compressed model was not decoded",
  "meshopt-decoder-unsupported": "This runtime cannot run the Meshopt decoder, so this compressed model was not decoded",
  "meshopt-decoder-missing": "Meshopt decoder was not attached, so this compressed model was not decoded",
  "meshopt-decode-failed": "Meshopt decode failed",
  "too-small": "File is too small to be a GLB",
  "bad-magic": "File is not a GLB",
  "bad-json": "GLB JSON chunk could not be parsed",
  "no-json-chunk": "GLB has no JSON chunk",
  network: "Model request failed",
  "decode-failed": "GLB could not be parsed",
  aborted: "Model load was aborted",
};

export function summarizeLoadReason(reason: string): string {
  if (FALLBACK_SUMMARY[reason]) return FALLBACK_SUMMARY[reason];
  if (reason.startsWith("http-")) {
    const status = reason.slice("http-".length);
    if (status === "404") return "Model file was not found (HTTP 404)";
    return `Model request failed (HTTP ${status})`;
  }
  return reason;
}
