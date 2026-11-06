import { probeGlb, type GlbProbe } from "./glbProbe";
import { classifyGltfLoadError, planGltfLoad, summarizeLoadReason } from "./gltfLoadPlan";
import type { DecoderStatus } from "./meshoptLifecycle";

export type LoadPhase = "ready" | "fallback" | "aborted" | "failed";

export type LoadOutcome<T> = {
  url: string;
  phase: LoadPhase;
  value: T | null;
  reason: string | null;
  message: string;
  dispose: () => void;
};

export type GltfLoadSession<T> = {
  load: (url: string) => Promise<LoadOutcome<T>>;
  abort: (url: string) => void;
  forget: (url: string) => void;
  forgetAll: () => void;
};

export function createGltfLoadSession<T>(deps: {
  fetchBytes: (url: string, signal: AbortSignal) => Promise<{ ok: boolean; status: number; bytes: Uint8Array | null }>;
  decoderStatus: () => DecoderStatus;
  prepareDecoder?: () => Promise<void>;
  parse: (url: string, bytes: Uint8Array, probe: GlbProbe) => Promise<T>;
  release?: (value: T) => void;
}): GltfLoadSession<T> {
  const inflight = new Map<string, { controller: AbortController; promise: Promise<LoadOutcome<T>> }>();
  const settled = new Map<string, LoadOutcome<T>>();

  function finish(value: T | null, release: ((value: T) => void) | undefined): { dispose: () => void } {
    let released = false;
    return {
      dispose() {
        if (released || value == null || !release) return;
        released = true;
        release(value);
      },
    };
  }

  function outcome(
    url: string,
    phase: LoadPhase,
    value: T | null,
    reason: string | null,
    message: string,
  ): LoadOutcome<T> {
    return { url, phase, value, reason, message, ...finish(value, deps.release) };
  }

  async function run(url: string, signal: AbortSignal): Promise<LoadOutcome<T>> {
    if (signal.aborted) return outcome(url, "aborted", null, "aborted", summarizeLoadReason("aborted"));
    const preparing = deps.prepareDecoder ? deps.prepareDecoder() : Promise.resolve();
    let fetched: { ok: boolean; status: number; bytes: Uint8Array | null };
    try {
      fetched = await deps.fetchBytes(url, signal);
    } catch (error) {
      await preparing.catch(() => undefined);
      if (signal.aborted || isAbortError(error)) {
        return outcome(url, "aborted", null, "aborted", summarizeLoadReason("aborted"));
      }
      const message = error instanceof Error ? error.message : String(error);
      const classified = classifyGltfLoadError(message);
      return outcome(url, "fallback", null, classified.code, classified.summary);
    }
    await preparing.catch(() => undefined);
    if (signal.aborted) return outcome(url, "aborted", null, "aborted", summarizeLoadReason("aborted"));
    if (!fetched.ok || !fetched.bytes) {
      const reason = `http-${fetched.status}`;
      return outcome(url, "fallback", null, reason, summarizeLoadReason(reason));
    }
    const probed = probeGlb(fetched.bytes);
    if (!probed.ok) {
      return outcome(url, "fallback", null, probed.reason, summarizeLoadReason(probed.reason));
    }
    const plan = planGltfLoad(probed.probe, deps.decoderStatus());
    if (plan.action === "fallback") {
      const reason = plan.reason ?? "decode-failed";
      return outcome(url, "fallback", null, reason, summarizeLoadReason(reason));
    }
    try {
      const value = await deps.parse(url, fetched.bytes, probed.probe);
      if (signal.aborted) {
        deps.release?.(value);
        return outcome(url, "aborted", null, "aborted", summarizeLoadReason("aborted"));
      }
      return outcome(url, "ready", value, null, "loaded");
    } catch (error) {
      if (signal.aborted || isAbortError(error)) {
        return outcome(url, "aborted", null, "aborted", summarizeLoadReason("aborted"));
      }
      const message = error instanceof Error ? error.message : String(error);
      const classified = classifyGltfLoadError(message);
      return outcome(url, "fallback", null, classified.code, classified.summary);
    }
  }

  return {
    load(url: string) {
      const done = settled.get(url);
      if (done) return Promise.resolve(done);
      const existing = inflight.get(url);
      if (existing && !existing.controller.signal.aborted) return existing.promise;
      const controller = new AbortController();
      let promise!: Promise<LoadOutcome<T>>;
      promise = run(url, controller.signal).then((result) => {
        const current = inflight.get(url);
        if (current?.promise === promise) inflight.delete(url);
        if (result.phase !== "aborted") settled.set(url, result);
        return result;
      });
      inflight.set(url, { controller, promise });
      return promise;
    },
    abort(url: string) {
      inflight.get(url)?.controller.abort();
    },
    forget(url: string) {
      const done = settled.get(url);
      if (done) {
        done.dispose();
        settled.delete(url);
      }
      inflight.get(url)?.controller.abort();
    },
    forgetAll() {
      for (const url of [...settled.keys()]) this.forget(url);
      for (const url of [...inflight.keys()]) this.abort(url);
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
