// Voice-over client (§33). Routes a spoken line through the server ElevenLabs
// proxy (/api/tts) for a real character voice; if the key isn't configured (503)
// or the request fails, it transparently falls back to the Web Speech API so VO
// always works offline/unconfigured. Character → env-var mapping lives in
// api/tts.ts (voice "mike" → ELEVENLABS_MIKE_VOICE).

let remoteAvailable: boolean | null = null; // null = unknown, false = key absent
// Cancels the in-flight line's watchdog timers so a stopped/zapped station can't
// fire a stray fallback line later. Set by speak()/speakLocal, cleared on finish.
let cancelActive: (() => void) | null = null;
// Per-voice health: a single character (e.g. a misconfigured ELEVENLABS_MIKE_VOICE)
// can return empty/garbage audio while the others are fine. Two strikes and we
// route THAT voice straight to Web Speech for the session — no repeated dead-air
// while the watchdog waits. This is what makes one bad voice ("only the first
// line spoken") fail over cleanly instead of stalling every line of that host.
const voiceFails = new Map<string, number>();
const badVoice = (v: string) => (voiceFails.get(v) ?? 0) >= 2;
function markVoiceBad(v: string) { voiceFails.set(v, (voiceFails.get(v) ?? 0) + 1); }
function markVoiceGood(v: string) { if (voiceFails.has(v)) voiceFails.delete(v); }

export interface VoiceReq {
  text: string;
  voice: string;        // character key, e.g. "mike", "sully", "buddy"
  rate?: number;        // Web Speech fallback tuning
  pitch?: number;
  prefs?: string[];     // Web Speech voice-name fragments
  onend?: () => void;
}

// Rough spoken duration of a line (ms), used to size the watchdog timers below
// so the talk loop ALWAYS advances even if an audio/speech "ended" event never
// fires. ~13 chars/sec of speech + a generous tail; floored so short lines still
// get breathing room.
function estimateMs(text: string, rate = 1) {
  return Math.max(2500, (text.length / 13) * 1000) / Math.max(0.5, rate) + 1500;
}

function speakLocal(req: VoiceReq) {
  if (typeof speechSynthesis === "undefined") { req.onend?.(); return; }
  // Single-fire guard: Web Speech has a long-standing bug where `onend` never
  // fires for some voices/utterances, which would stall the radio talk loop.
  // A watchdog forces completion if neither onend nor onerror lands in time.
  let done = false;
  let watchdog = 0;
  const finish = () => {
    if (done) return;
    done = true;
    if (watchdog) clearTimeout(watchdog);
    if (cancelActive === silence) cancelActive = null;
    req.onend?.();
  };
  const silence = () => { if (watchdog) clearTimeout(watchdog); done = true; };
  cancelActive = silence;
  const u = new SpeechSynthesisUtterance(req.text);
  const vs = speechSynthesis.getVoices();
  if (vs.length && req.prefs) {
    for (const p of req.prefs) {
      const v = vs.find((x) => x.name.toLowerCase().includes(p.toLowerCase()));
      if (v) { u.voice = v; break; }
    }
    if (!u.voice) u.voice = vs.find((x) => x.lang.startsWith("en")) || vs[0];
  }
  u.rate = req.rate ?? 1;
  u.pitch = req.pitch ?? 1;
  u.onend = finish;
  u.onerror = finish;
  // +6s slack over the estimate before we give up waiting on the engine.
  watchdog = window.setTimeout(finish, estimateMs(req.text, u.rate) + 6000);
  speechSynthesis.speak(u);
}

let audio: HTMLAudioElement | null = null;

/** Speak a line with the best available voice; never throws, always ends. */
export async function speak(req: VoiceReq) {
  if (remoteAvailable === false) { speakLocal(req); return; }
  // This voice has already failed twice this session — don't re-try the remote
  // and eat another dead-air gap; go straight to Web Speech for the rest of it.
  if (badVoice(req.voice)) { speakLocal(req); return; }
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: req.text, voice: req.voice }),
    });
    // 503 == server has no API key at all → stop trying remote for the session.
    // Any other failure (a single voice, a transient upstream error) just falls
    // back for THIS line so one bad call can't mute every host (§33).
    if (r.status === 503) { remoteAvailable = false; speakLocal(req); return; }
    if (!r.ok) { markVoiceBad(req.voice); speakLocal(req); return; }
    remoteAvailable = true;
    const blob = await r.blob();
    // A 200 with an empty/implausibly-tiny body is a misconfigured voice — no
    // valid audio. Skip the <audio> dance entirely and fail over immediately.
    if (blob.size < 256) { markVoiceBad(req.voice); speakLocal(req); return; }
    const url = URL.createObjectURL(blob);
    audio?.pause();
    const el = new Audio(url);
    audio = el;

    // Single-fire completion guard + watchdog. The talk loop only advances when
    // onend fires, so a voice that returns a 200 with an empty/garbage blob (a
    // misconfigured ELEVENLABS_*_VOICE) must NOT be able to stall the radio:
    // if neither `ended` nor `error` lands within the expected window, we end it.
    let done = false;
    let watchdog = 0;
    const cleanup = () => { if (watchdog) clearTimeout(watchdog); if (cancelActive === silence) cancelActive = null; URL.revokeObjectURL(url); };
    const silence = () => { if (watchdog) clearTimeout(watchdog); done = true; URL.revokeObjectURL(url); };
    cancelActive = silence;
    const finish = () => { if (done) return; done = true; markVoiceGood(req.voice); cleanup(); req.onend?.(); };
    const fallback = () => {
      if (done) return;
      done = true;
      markVoiceBad(req.voice); // empty blob / error / watchdog → strike this voice
      cleanup();
      try { el.pause(); } catch { /* ignore */ }
      speakLocal(req); // play this line via Web Speech, which advances the loop
    };

    el.onended = finish;
    el.onerror = fallback;
    // Once we know the real clip length, size the watchdog to it (+3s). Until
    // then (or for a zero-length/garbage blob), fall back to a text estimate.
    el.onloadedmetadata = () => {
      const d = el.duration;
      const ms = Number.isFinite(d) && d > 0 ? d * 1000 + 3000 : estimateMs(req.text, req.rate);
      if (watchdog) clearTimeout(watchdog);
      watchdog = window.setTimeout(fallback, ms);
    };
    watchdog = window.setTimeout(fallback, estimateMs(req.text, req.rate) + 4000);
    await el.play();
  } catch {
    speakLocal(req);
  }
}

/** Stop any in-flight VO (both paths) and cancel its watchdog. */
export function stopVO() {
  cancelActive?.();
  cancelActive = null;
  audio?.pause();
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
