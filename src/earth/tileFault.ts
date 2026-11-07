// Classify Google tile failures without guessing billing from a generic exception.
// Summaries are canned. Details are redacted and length-capped so a request URL
// cannot carry the API key into the overlay or a log line.

export type TileFaultKind = "unauthorized" | "quota" | "unavailable" | "unknown";

export interface TileFault {
  kind: TileFaultKind;
  status: number | null;
  summary: string;
  detail: string;
}

const RANK: Record<TileFaultKind, number> = {
  unknown: 1,
  unavailable: 2,
  quota: 3,
  unauthorized: 4,
};

export function redactSecrets(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z\-_]{8,}/g, "AIza…")
    .replace(/([?&](?:key|session)=)[^&\s]+/gi, "$1…");
}

export function isGoogleTileUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "tile.googleapis.com";
  } catch {
    return false;
  }
}

function statusFromMessage(message: string): number | null {
  const named = message.match(/\b(401|403|429|408|500|502|503|504)\b/);
  if (named) return Number(named[1]);
  if (/UNAUTHENTICATED|PERMISSION_DENIED/i.test(message)) return 403;
  if (/RESOURCE_EXHAUSTED|quota/i.test(message)) return 429;
  return null;
}

function statusOf(error: unknown): number | null {
  if (typeof error === "number" && error >= 400 && error < 600) return error;
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? statusFromMessage(error) : null;
  }
  const record = error as Record<string, unknown>;
  if (typeof record.status === "number") return record.status;
  if (typeof record.statusCode === "number") return record.statusCode;
  if (typeof record.code === "number" && record.code >= 400 && record.code < 600) return record.code;
  const response = record.response;
  if (response && typeof response === "object") {
    const status = (response as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  const nested = record.error;
  if (nested && nested !== error) {
    const inner = statusOf(nested);
    if (inner) return inner;
  }
  if (typeof record.message === "string") return statusFromMessage(record.message);
  return null;
}

function detailOf(error: unknown): string {
  if (typeof error === "string") return redactSecrets(error).slice(0, 240);
  if (error instanceof Error) return redactSecrets(error.message).slice(0, 240);
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return redactSecrets(record.message).slice(0, 240);
    const nested = record.error;
    if (nested && nested !== error && typeof nested === "object") {
      const message = (nested as { message?: unknown }).message;
      if (typeof message === "string") return redactSecrets(message).slice(0, 240);
    }
  }
  return "";
}

export function classifyTileError(error: unknown): TileFault {
  const status = statusOf(error);
  const detail = detailOf(error);
  if (status === 401 || status === 403) {
    return { kind: "unauthorized", status, summary: "Google refused the map key.", detail };
  }
  if (status === 429) {
    return { kind: "quota", status, summary: "Google returned a tile quota response.", detail };
  }
  if (status === 408 || (status != null && status >= 500 && status <= 599)) {
    return { kind: "unavailable", status, summary: "The tiles service returned an error.", detail };
  }
  if (/failed to fetch|network|timeout|aborted/i.test(detail)) {
    return { kind: "unavailable", status, summary: "The tiles request did not complete.", detail };
  }
  return { kind: "unknown", status, summary: "A tile request failed without a Google status.", detail };
}

export function classifyTileEvent(event: unknown): TileFault {
  if (event && typeof event === "object" && "error" in event) {
    const error = (event as { error?: unknown }).error;
    if (error != null) return classifyTileError(error);
  }
  return classifyTileError(event);
}

export function mergeFault(current: TileFault | null, incoming: TileFault | null): TileFault | null {
  if (!incoming) return current;
  if (!current) return incoming;
  return RANK[incoming.kind] >= RANK[current.kind] ? incoming : current;
}

export function faultsMatch(a: TileFault | null, b: TileFault | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.status === b.status;
}

export function faultBlocksView(fault: TileFault, tileCount: number): boolean {
  if (fault.kind === "unauthorized" || fault.kind === "quota") return true;
  return tileCount <= 0;
}

export function faultCopy(fault: TileFault): { title: string; body: string } {
  const billing = /billing/i.test(fault.detail) ? " Google's response mentioned billing." : "";
  if (fault.kind === "unauthorized") {
    const code = fault.status ? ` (${fault.status})` : "";
    return {
      title: "Google refused the map key",
      body: `The tiles request was rejected${code}. Check that this browser key has the Map Tiles API enabled and that this site is an allowed referrer, then reload.${billing}`,
    };
  }
  if (fault.kind === "quota") {
    return {
      title: "Google tile quota",
      body: `Google returned ${fault.status ?? 429}. Photoreal tiles may stop until that quota window resets. Reload later to try again.${billing}`,
    };
  }
  if (fault.kind === "unavailable") {
    const code = fault.status ? ` (${fault.status})` : "";
    return {
      title: "Google tiles are unavailable",
      body: `The tiles service did not complete the request${code}. Movement still runs; reload to try again.`,
    };
  }
  return {
    title: "Photoreal tiles haven't arrived",
    body: "No Google status came back with this failure. It can be a slow link or a blocked request. Street movement still runs.",
  };
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Wrap fetch so a Google tile HTTP error becomes a fault. Never throws, never records the request URL. */
export function observeTileFetch(base: typeof fetch, onFault: (fault: TileFault) => void): typeof fetch {
  return async (input, init) => {
    const res = await base(input, init);
    try {
      const url = requestUrl(input);
      if (isGoogleTileUrl(url) && res.status >= 400) {
        let detail = "";
        try { detail = (await res.clone().text()).slice(0, 240); } catch { /* status is enough */ }
        onFault(classifyTileError({ status: res.status, message: detail }));
      }
    } catch { /* classification must not break the tile load */ }
    return res;
  };
}
