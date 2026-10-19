// Server-side ElevenLabs Text-to-Speech proxy. Keeps the API key server-side and
// streams MP3 back from our own origin (no key in the browser, no CORS taint).
//
// Set in Vercel → Project → Settings → Environment Variables:
//   ELEVENLABS_API_KEY                (required)
//   ELEVENLABS_<CHARACTER>_VOICE      (per-character voice — an ElevenLabs
//                                      voice_id OR the voice's display name)
//   e.g. ELEVENLABS_MIKE_VOICE = "Iron Mike"
//
// Client calls: POST /api/tts  { text, voice: "mike" }  →  audio/mpeg
// If the key isn't set, returns 503 so the client falls back to Web Speech.

import { guard } from "./_guard";

const API = "https://api.elevenlabs.io/v1";
const MODEL = "eleven_turbo_v2_5"; // fast, cheap, good for barks/VO
const looksLikeId = (s: string) => /^[A-Za-z0-9]{18,24}$/.test(s);

// Built-in premade ElevenLabs voices so EVERY host has a real voice out of the
// box (available to all accounts). Per-character env vars (ELEVENLABS_MIKE_VOICE
// …) override these; this just guarantees no host falls silent for lack of
// config. Keys match the character keys used by radioEngine.
const DEFAULT_VOICES: Record<string, string> = {
  MIKE: "pNInz6obpgDQGcFmaJgB",   // Adam — gravelly older male (the Anvil)
  BUDDY: "TxGEqnHWrfWFTfGW9XjX",  // Josh — energetic male (the Rage)
  SULLY: "yoZ06aMxZJJ28mfd3POQ",  // Sam — laid-back male (WHALE)
  TIA: "21m00Tcm4TlvDq8ikWAM",    // Rachel — warm female (Maré Alta)
  NARRATOR: "pNInz6obpgDQGcFmaJgB",
};

// cache display-name → voice_id lookups for the function's warm lifetime
const idCache = new Map<string, string>();

async function resolveVoiceId(apiKey: string, value: string): Promise<string | null> {
  if (looksLikeId(value)) return value;
  const key = value.toLowerCase();
  if (idCache.has(key)) return idCache.get(key)!;
  try {
    const r = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey } });
    if (!r.ok) return null;
    const data = await r.json();
    for (const v of data.voices ?? []) {
      if (typeof v.name === "string" && v.name.toLowerCase() === key) {
        idCache.set(key, v.voice_id);
        return v.voice_id;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  // Gate before touching the paid upstream: reject cross-site callers and
  // throttle per-IP so an anonymous client can't run up the ElevenLabs bill.
  if (!guard(req, res, 30)) return;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "ELEVENLABS_API_KEY not configured" }); return; }

  // req.body may be an unparsed string; never let a malformed payload throw a
  // 500 — treat bad JSON as an empty body and fall through to the 400 below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
  } catch { res.status(400).json({ error: "invalid JSON body" }); return; }
  const text: string = (body.text ?? "").toString().slice(0, 800);
  const voiceKey: string = (body.voice ?? "narrator").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!text) { res.status(400).json({ error: "missing text" }); return; }

  // map the character key → env var (ELEVENLABS_MIKE_VOICE), else a sensible
  // built-in premade voice so the host is never silent. Note: a per-voice
  // problem must NOT return 503 — that's reserved for "key missing" so the
  // client only gives up on remote VO globally when the key is truly absent.
  const envVal = process.env[`ELEVENLABS_${voiceKey}_VOICE`] || process.env.ELEVENLABS_DEFAULT_VOICE
    || DEFAULT_VOICES[voiceKey] || DEFAULT_VOICES.NARRATOR;
  const voiceId = await resolveVoiceId(apiKey, envVal);
  if (!voiceId) { res.status(502).json({ error: `could not resolve voice "${envVal}"` }); return; }

  try {
    const r = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) { res.status(r.status).send(await r.text()); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: "tts upstream failed", detail: String(e) });
  }
}
