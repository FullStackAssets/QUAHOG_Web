// Per-station music manifest, backed by Vercel Blob. The radio fetches
// /api/music?station=<id> and gets the public URLs of the tracks the webhook
// (api/music-webhook.ts) has delivered. Empty list → radio falls back to the
// static public/music manifest, then to the procedural synth bed.

import { list } from "@vercel/blob";
import type { ApiHandler } from "./_http";

const handler: ApiHandler = async (req, res) => {
  const station = String(req.query?.station ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!station) { res.status(400).json({ error: "?station= required" }); return; }
  try {
    const { blobs } = await list({ prefix: `music/${station}/` });
    const tracks = blobs.filter((b) => b.pathname.endsWith(".mp3")).map((b) => b.url);
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({ tracks });
  } catch {
    // Blob not configured / not reachable → no remote tracks (graceful)
    res.status(200).json({ tracks: [] });
  }
};

export default handler;
