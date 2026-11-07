import { redactSecrets } from "./tileFault";

// Collapse the tiles renderer's per-tile console errors and strip credentials
// before they reach the console. Unrelated messages still pass through.

export interface LogSink {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (value instanceof Error) {
    const copy = new Error(redactSecrets(value.message));
    copy.name = value.name;
    return copy;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const status = typeof record.status === "number" ? record.status : null;
    const message = typeof record.message === "string" ? redactSecrets(record.message) : "";
    if (status != null || message) return { status, message };
    return "[object]";
  }
  return value;
}

function bucket(args: unknown[]): string {
  const text = args.map((arg) => {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.message;
    if (arg && typeof arg === "object") return JSON.stringify(arg);
    return String(arg);
  }).join(" ");
  if (/failed to load tile|tile\.googleapis|load-error/i.test(text)) {
    const status = text.match(/\b(401|403|429|408|500|502|503|504)\b/);
    return `tile-load:${status?.[1] ?? "x"}`;
  }
  return text.slice(0, 180);
}

export function installTileLogGuard(sink: LogSink): () => void {
  const original = { error: sink.error, warn: sink.warn };
  const seen = new Set<string>();
  const forward = (method: "error" | "warn") => (...args: unknown[]) => {
    const safe = args.map(sanitize);
    const key = `${method}:${bucket(safe)}`;
    if (seen.has(key)) return;
    if (seen.size > 40) seen.clear();
    seen.add(key);
    original[method].apply(sink, safe);
  };
  sink.error = forward("error");
  sink.warn = forward("warn");
  return () => {
    sink.error = original.error;
    sink.warn = original.warn;
  };
}
