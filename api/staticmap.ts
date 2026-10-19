import crypto from "node:crypto";
import { guard } from "./_guard";

// Server-side Google Static Maps proxy. Signs the request with the URL-signing
// secret (kept server-side only) and streams the image back from our own origin
// — so the API key/secret never reach the browser and there's no CORS taint on
// the WebGL texture.
//
// Set these in Vercel → Project → Settings → Environment Variables:
//   GOOGLE_MAPS_API_KEY             (required)
//   GOOGLE_MAPS_URL_SIGNING_SECRET  (the "URL signing secret" from the same key)

const HOST = "https://maps.googleapis.com";
const ALLOWED = ["center", "zoom", "size", "scale", "maptype", "format", "map_id"];

function sign(pathAndQuery: string, secret: string): string {
  const key = Buffer.from(secret.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const digest = crypto.createHmac("sha1", key).update(pathAndQuery).digest("base64");
  return digest.replace(/\+/g, "-").replace(/\//g, "_");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  // Gate before signing/forwarding: this proxy spends Google Maps quota, so
  // reject cross-site callers and throttle per-IP to prevent quota abuse.
  if (!guard(req, res, 60)) return;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const secret = process.env.GOOGLE_MAPS_URL_SIGNING_SECRET;
  if (!apiKey) {
    res.status(500).json({ error: "GOOGLE_MAPS_API_KEY not configured" });
    return;
  }

  const params = new URLSearchParams();
  for (const k of ALLOWED) {
    const v = req.query?.[k];
    if (typeof v === "string" && v.length) params.set(k, v);
  }
  if (!params.has("maptype")) params.set("maptype", "satellite");
  params.set("key", apiKey);

  let pathAndQuery = "/maps/api/staticmap?" + params.toString();
  if (secret) pathAndQuery += "&signature=" + sign(pathAndQuery, secret);

  try {
    const r = await fetch(HOST + pathAndQuery);
    if (!r.ok) {
      res.status(r.status).send(await r.text());
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed", detail: String(e) });
  }
}
