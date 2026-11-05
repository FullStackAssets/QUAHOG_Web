// Debug telemetry/report endpoint (same-origin, on Nic's own box).
// The token is a SPAM GATE, not a secret: it ships in the public game
// bundle, so anyone can read it. It exists so random internet scanners
// cannot POST junk without first reading the bundle; the receiver
// additionally enforces size caps, payload-shape validation, and per-IP
// rate limits. NEVER put a real password here (staging, rev, Narrows Ops
// credentials must never appear in the game bundle).
export const DEBUG_API_BASE = "/api/dbg-70082d49";
export const DEBUG_API_TOKEN = "760dbe0925388acb2ccd6d216e3178d1";
export const DEBUG_BEACON_PATH = `${DEBUG_API_BASE}/beacon`;
export const DEBUG_REPORT_PATH = `${DEBUG_API_BASE}/report`;
