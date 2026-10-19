// Safe localStorage helpers. Every access to localStorage can throw — it's
// unavailable in private-mode Safari, blocked by some privacy settings, and
// absent in SSR/worker/test contexts. Across the codebase this was worked
// around by repeating `try { … } catch { /* ignore */ }` at each call site.
// These helpers centralise that guard so callers can read/write persisted
// state in one clear line and never crash on a storage failure.

/** Read a raw string, or `fallback` (default null) if storage is unavailable. */
export function getItem(key: string, fallback: string | null = null): string | null {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch { return fallback; }
}

/** Write a raw string; silently no-ops if storage is unavailable. */
export function setItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

/** Remove one or more keys; silently no-ops if storage is unavailable. */
export function removeItem(...keys: string[]): void {
  try { for (const k of keys) localStorage.removeItem(k); } catch { /* storage unavailable */ }
}

/** Parse a JSON value from storage, returning `fallback` on any error. */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

/** Serialize a value to storage as JSON; silently no-ops on any error. */
export function saveJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
