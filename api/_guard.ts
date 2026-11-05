// Shared hardening helpers for the public Vercel serverless proxies
// (/api/tts and /api/staticmap). These endpoints call *paid* upstream APIs
// (ElevenLabs, Google Maps) using server-side keys, so without any gating an
// anonymous caller could hammer them and run up the bill ("denial of wallet").
//
// This module provides two cheap, dependency-free mitigations:
//   1. sameOriginOk() — reject cross-site callers by checking Origin/Referer
//      against an allowlist (our own deployment + configured ALLOWED_ORIGINS).
//   2. rateLimit()    — a best-effort in-memory, per-IP token bucket. It only
//      protects a warm function instance (serverless scales to many isolates),
//      so it is a speed bump, not a hard quota — pair it with upstream quotas
//      / a real store (e.g. Upstash) for strong guarantees.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Req = any;

/** Extract a best-effort client IP from proxy headers. */
export function clientIp(req: Req): string {
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]).split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

/**
 * Returns true when the request appears to originate from an allowed site.
 * Requests with no Origin/Referer at all (e.g. server-to-server, curl) are
 * allowed through only when ALLOW_NO_ORIGIN is set, otherwise blocked — a
 * browser fetch from our own pages always sends one of these headers.
 */
export function sameOriginOk(req: Req): boolean {
  const host = String(req.headers?.host ?? "").toLowerCase();
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const src = String(req.headers?.origin || req.headers?.referer || "").toLowerCase();
  if (!src) return process.env.ALLOW_NO_ORIGIN === "1";

  let originHost = "";
  try { originHost = new URL(src).host.toLowerCase(); } catch { return false; }

  // same host as the deployment (covers preview + prod domains)
  if (host && originHost === host) return true;
  // localhost dev
  if (originHost.startsWith("localhost") || originHost.startsWith("127.0.0.1")) return true;
  // explicit allowlist (exact host or suffix like ".vercel.app")
  return extra.some((a) => originHost === a || originHost.endsWith(a));
}

// --- in-memory token bucket (per warm instance) -------------------------
const buckets = new Map<string, { tokens: number; ts: number }>();

/**
 * Best-effort per-key rate limit. Returns true when the call is allowed.
 * @param key       usually the client IP
 * @param perMin    sustained requests allowed per minute (also the burst size)
 */
export function rateLimit(key: string, perMin = 30): boolean {
  const now = Date.now();
  const refillPerMs = perMin / 60000;
  const b = buckets.get(key) ?? { tokens: perMin, ts: now };
  // refill based on elapsed time, capped at the burst size
  b.tokens = Math.min(perMin, b.tokens + (now - b.ts) * refillPerMs);
  b.ts = now;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1;
  buckets.set(key, b);
  // opportunistic cleanup so the map can't grow unbounded on a long-lived isolate
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.ts > 120000) buckets.delete(k);
  }
  return true;
}

/** Apply origin + rate-limit gating; writes the response and returns false if blocked. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function guard(req: Req, res: any, perMin = 30): boolean {
  if (!sameOriginOk(req)) { res.status(403).json({ error: "forbidden origin" }); return false; }
  if (!rateLimit(clientIp(req), perMin)) { res.status(429).json({ error: "rate limited" }); return false; }
  return true;
}
