// ElevenLabs Music webhook receiver. ElevenLabs (via Svix) POSTs here when an
// async music generation finishes; we verify the signature, pull the audio, and
// store it in Vercel Blob under music/<station>/. The radio reads the resulting
// public URLs from /api/music. No repo writes (functions are read-only at run).
//
// Configure in Vercel → Settings → Environment Variables:
//   ELEVENLABS_WEBHOOK_SECRET   the Svix signing secret (wsec_… / whsec_…)
//   BLOB_READ_WRITE_TOKEN       auto-set when a Vercel Blob store is linked
// Point ElevenLabs' webhook at:
//   https://<your-domain>/api/music-webhook?station=whale   (and …?station=mare)

import crypto from "crypto";
import { put } from "@vercel/blob";

export const config = { api: { bodyParser: false } };

async function readRaw(req: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

// Svix/standard-webhook HMAC: base64( HMAC-SHA256( `${id}.${ts}.${body}` ) )
function verify(secret: string, h: Record<string, any>, body: string): boolean {
  const id = h["svix-id"] || h["webhook-id"];
  const ts = h["svix-timestamp"] || h["webhook-timestamp"];
  const sig = h["svix-signature"] || h["webhook-signature"];
  if (!id || !ts || !sig) return false;
  const key = Buffer.from(secret.replace(/^w?h?sec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  const expectedBuf = Buffer.from(expected);
  // header is a space-separated list of "v1,<sig>" entries. Compare with a
  // constant-time check (timingSafeEqual) so an attacker can't recover the
  // valid signature byte-by-byte via response-timing differences.
  return String(sig).split(" ").some((p) => {
    const provided = p.includes(",") ? p.split(",")[1] : p;
    const providedBuf = Buffer.from(provided);
    return providedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(providedBuf, expectedBuf);
  });
}

const pickStr = (...vals: any[]) => vals.find((v) => typeof v === "string" && v) as string | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) { res.status(503).json({ error: "ELEVENLABS_WEBHOOK_SECRET not set" }); return; }

  const station = String(req.query?.station ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!station) { res.status(400).json({ error: "?station= required (whale|mare)" }); return; }

  const raw = await readRaw(req);
  const ctype = String(req.headers["content-type"] ?? "");
  if (!verify(secret, req.headers, raw.toString("utf8"))) { res.status(401).json({ error: "bad signature" }); return; }

  // pull the audio: raw audio body, a download URL, or base64 in the JSON
  let audio: Buffer | null = null;
  if (ctype.includes("audio") || ctype.includes("octet-stream")) {
    audio = raw;
  } else {
    let data: any = {};
    try { data = JSON.parse(raw.toString("utf8") || "{}"); } catch { /* not json */ }
    const d = data.data ?? data;
    const url = pickStr(d.audio_url, d.url, d.download_url, d.output_url, d.output?.url, d.audio?.url);
    const b64 = pickStr(d.audio_base64, d.audio_b64, typeof d.audio === "string" ? d.audio : undefined);
    if (url) { const rr = await fetch(url); if (rr.ok) audio = Buffer.from(await rr.arrayBuffer()); }
    else if (b64) audio = Buffer.from(b64, "base64");
  }
  if (!audio || audio.length < 1024) { res.status(422).json({ error: "no audio in payload" }); return; }

  try {
    const id = String(req.headers["svix-id"] ?? Date.now());
    const { url } = await put(`music/${station}/${id}.mp3`, audio, {
      access: "public", contentType: "audio/mpeg", addRandomSuffix: false,
    });
    res.status(200).json({ ok: true, station, url });
  } catch (e) {
    res.status(502).json({ error: "blob upload failed", detail: String(e) });
  }
}
