export type DecoderStatus = "idle" | "pending" | "ready" | "failed" | "unsupported";

export class MeshoptLifecycleError extends Error {
  readonly status: "failed" | "unsupported";
  constructor(message: string, status: "failed" | "unsupported") {
    super(message);
    this.name = "MeshoptLifecycleError";
    this.status = status;
  }
}

export type MeshoptLifecycle = {
  status: () => DecoderStatus;
  error: () => string | null;
  ensure: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
};

// One in-flight init shared by every caller. A failed init stays failed until
// retry() so a crowd of characters cannot restart WASM in a loop.
export function createMeshoptLifecycle(start: () => Promise<unknown>): MeshoptLifecycle {
  let state: DecoderStatus = "idle";
  let error: string | null = null;
  let pending: Promise<void> | null = null;
  let generation = 0;

  const api: MeshoptLifecycle = {
    status: () => state,
    error: () => error,
    ensure() {
      if (state === "ready") return Promise.resolve();
      if (state === "failed" || state === "unsupported") {
        return Promise.reject(new MeshoptLifecycleError(error ?? state, state));
      }
      if (pending) return pending;
      state = "pending";
      const gen = ++generation;
      pending = start().then(
        () => {
          if (gen !== generation) throw new MeshoptLifecycleError("Meshopt init was reset", "failed");
          state = "ready";
          error = null;
          pending = null;
        },
        (caught: unknown) => {
          if (gen !== generation) throw new MeshoptLifecycleError("Meshopt init was reset", "failed");
          const coded = caught instanceof MeshoptLifecycleError ? caught.status : "failed";
          state = coded;
          error = caught instanceof Error ? caught.message : String(caught);
          pending = null;
          throw caught instanceof Error ? caught : new Error(String(caught));
        },
      );
      return pending;
    },
    retry() {
      if (state === "pending" && pending) return pending;
      state = "idle";
      error = null;
      pending = null;
      return api.ensure();
    },
    reset() {
      generation += 1;
      state = "idle";
      error = null;
      pending = null;
    },
  };
  return api;
}
