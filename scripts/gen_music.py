#!/usr/bin/env python3
"""Generate royalty-free station music with the ElevenLabs Music API.

Writes instrumental tracks to QUAHOG_Web/public/music/<station>/ plus a
manifest.json the radio reads at runtime. Tracks are owned/royalty-free per
ElevenLabs' terms — legitimate to ship.

Usage:
    ELEVENLABS_API_KEY=sk_... python3 scripts/gen_music.py
    # optional: TRACKS_PER_STATION=4 LENGTH_MS=75000 python3 scripts/gen_music.py

Docs: https://elevenlabs.io/docs/api-reference/music
"""
import os, json, sys, urllib.request

API = "https://api.elevenlabs.io/v1/music"
KEY = os.environ.get("ELEVENLABS_API_KEY")
N = int(os.environ.get("TRACKS_PER_STATION", "3"))
LEN = int(os.environ.get("LENGTH_MS", "75000"))
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.normpath(os.path.join(HERE, "..", "public", "music"))

# music stations (ids must match radioEngine STATIONS) → genre prompts (no vocals)
STATIONS = {
    "whale": "1980s American classic rock instrumental, crunchy electric guitars, "
             "driving drums, Hammond organ, anthemic, radio-ready, no vocals",
    "mare":  "Portuguese and Cape Verdean morna and coladeira instrumental, warm "
             "nylon acoustic guitar, cavaquinho, gentle percussion, saudade, no vocals",
}

def generate(prompt: str, out_path: str):
    body = json.dumps({"prompt": prompt, "music_length_ms": LEN}).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "xi-api-key": KEY, "content-type": "application/json", "accept": "audio/mpeg",
    })
    with urllib.request.urlopen(req, timeout=300) as r, open(out_path, "wb") as f:
        f.write(r.read())

def main():
    if not KEY:
        sys.exit("Set ELEVENLABS_API_KEY (see QUAHOG_Web/ENV.md).")
    for sid, prompt in STATIONS.items():
        d = os.path.join(PUB, sid)
        os.makedirs(d, exist_ok=True)
        files = []
        for i in range(N):
            name = f"track{i+1}.mp3"
            print(f"[{sid}] generating {name} …")
            try:
                generate(prompt, os.path.join(d, name))
                files.append(name)
            except Exception as e:
                print(f"  ! failed: {e}")
        json.dump({"tracks": files}, open(os.path.join(d, "manifest.json"), "w"))
        print(f"[{sid}] wrote {len(files)} tracks + manifest")

if __name__ == "__main__":
    main()
