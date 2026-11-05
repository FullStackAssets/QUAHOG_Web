import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";
import { useMission } from "../mission";
import { useStats } from "../game";
import { shared, type ProbeStop } from "../shared";
import { perfStats } from "../ui/perfStats";
import { DEBUG_API_TOKEN, DEBUG_BEACON_PATH, DEBUG_REPORT_PATH } from "./endpoint";
import { isBlockedWater, getWaterRingCount, getWaterRoadSegCount } from "../world/waterZones";
import { hazardsProbe } from "../world/Hazards";
import {
  buildBeaconPayload,
  getConsoleEntries,
  getModelSnapshot,
  getParkedCount,
  installConsoleCapture,
  requestCapture,
  takeCapturedFrame,
  type BeaconInput,
  type ModelEntry,
} from "./modelStatus";

// Capture console errors/warnings from app start (module import runs when
// App mounts this overlay). Guarded once inside installConsoleCapture.
installConsoleCapture();

const BUILD_ID = `${__BUILD_SHA__} · ${__BUILD_DATE__}`;
const BEACON_KEY = "quahog.debug.beacon";
const REVUELTO_URL = "/assets/cars/revuelto_game.glb?v=wheelfix-20261103"; // keep in sync with MODEL_URL in actors/RevueltoCar.tsx

interface PanelSnap {
  fps: number;
  draws: number;
  tris: number;
  p95: number;
  quality: number | string;
  mode: string;
  pos: { x: number; y: number; z: number } | null;
  speed: number;
  headingDeg: number;
  carType: string;
  carModel: string;
  damage: number;
  police: number;
  faction: number;
  missionTitle: string;
  objective: string;
  objectiveDist: number | null;
  traffic: number;
  trafficTotal: number;
  parked: number;
  hour: number;
  models: ModelEntry[];
  errors: { level: string; msg: string }[];
  // Water/wall probes (2026-11-03 diagnosis).
  waterBlocked: boolean | null;
  waterRings: number;
  waterRoadSegs: number;
  hazardWet: number;
  lastStop: ProbeStop | null;
  nearTraf: { d: number; x: number; z: number } | null;
}

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

// Reads live state without subscribing (panel polls at 2 Hz, beacon at
// 1 Hz) so the overlay never re-renders the game. Never throws: every read
// is guarded, because a debug tool must not crash the session it watches.
function readSnapshot(): PanelSnap {
  try {
    const g = useGame.getState();
    const m = useMission.getState();
    const s = useStats.getState();
    const mode = g.mode;
    const body = mode === "car" ? shared.car : mode === "boat" ? shared.boat : shared.player;
    let pos: PanelSnap["pos"] = null;
    let speed = 0;
    try {
      const t = body?.translation();
      if (t) pos = { x: t.x, y: t.y, z: t.z };
      const v = body?.linvel();
      speed = mode === "car" ? shared.carSpeed : v ? Math.hypot(v.x, v.y, v.z) : 0;
    } catch {
      /* body gone mid-frame — stale values are fine */
    }
    const yaw = mode === "car" ? shared.carYaw : mode === "boat" ? shared.boatYaw : shared.heading;
    const target = m.steps[m.step]?.target;
    let objectiveDist: number | null = null;
    if (pos && target) {
      objectiveDist = Math.hypot(target[0] - pos.x, target[2] - pos.z);
    }
    const models = getModelSnapshot();
    const rev = models.find((e) => e.path === REVUELTO_URL);
    // Stream A (2026-11-03): a non-Revuelto player car now renders a pack
    // GLB, so report that file's load state instead of "procedural".
    const packEntry = g.playerCarPack
      ? models.find((e) => e.path === g.playerCarPack)
      : undefined;
    const carModel =
      g.playerCarType === "revuelto"
        ? rev
          ? `${rev.state}${rev.error ? ` — ${rev.error}` : ""}`
          : "loading (no report yet)"
        : g.playerCarPack
          ? packEntry
            ? `${packEntry.state}${packEntry.error ? ` — ${packEntry.error}` : ""}`
            : "loading (no report yet)"
          : "pack (type-mapped, no report yet)";
    const trafficTotal = shared.traffic.length;
    // Water/wall probes (2026-11-03): same reads the beacon carries, so the
    // on-device panel and the box payload can never disagree. All guarded:
    // a probe must never break the panel that hosts it.
    let waterBlocked: boolean | null = null;
    let waterRings = 0;
    let waterRoadSegs = 0;
    let hazardWet = 0;
    let nearTraf: { d: number; x: number; z: number } | null = null;
    try {
      waterRings = getWaterRingCount();
      waterRoadSegs = getWaterRoadSegCount();
      hazardWet = hazardsProbe.wetSeconds;
      if (pos) {
        waterBlocked = isBlockedWater(pos.x, pos.z);
        let best = Infinity;
        let bx = 0;
        let bz = 0;
        for (const t of shared.traffic) {
          if (t.stolen) continue;
          const d = Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z);
          if (d < best) {
            best = d;
            bx = t.pos.x;
            bz = t.pos.z;
          }
        }
        if (best < Infinity) nearTraf = { d: best, x: bx, z: bz };
      }
    } catch {
      /* probe reads fall back to the defaults above */
    }
    return {
      fps: perfStats.fps,
      draws: perfStats.draws,
      tris: perfStats.tris,
      p95: perfStats.p95Ms,
      quality: g.quality,
      mode,
      pos,
      speed,
      headingDeg: normDeg((yaw * 180) / Math.PI),
      carType: g.playerCarType,
      carModel,
      damage: shared.carDamage,
      police: s.police,
      faction: s.faction,
      missionTitle: m.title,
      objective: m.objective,
      objectiveDist,
      traffic: shared.traffic.filter((t) => !t.stolen).length,
      trafficTotal,
      parked: getParkedCount(),
      hour: shared.hour,
      models,
      errors: getConsoleEntries().slice(-8),
      waterBlocked,
      waterRings,
      waterRoadSegs,
      hazardWet,
      lastStop: shared.lastStop,
      nearTraf,
    };
  } catch {
    return {
      fps: 0, draws: 0, tris: 0, p95: 0, quality: "?", mode: "?", pos: null,
      speed: 0, headingDeg: 0, carType: "?", carModel: "?", damage: 0,
      police: 0, faction: 0, missionTitle: "", objective: "", objectiveDist: null,
      traffic: 0, trafficTotal: 0, parked: -1, hour: 0, models: [], errors: [],
      waterBlocked: null, waterRings: 0, waterRoadSegs: 0, hazardWet: 0,
      lastStop: null, nearTraf: null,
    };
  }
}

function beaconInput(snap: PanelSnap): BeaconInput {
  return {
    buildId: BUILD_ID,
    ts: Date.now(),
    mode: snap.mode,
    pos: snap.pos,
    speed: snap.speed,
    headingDeg: snap.headingDeg,
    carType: snap.carType,
    carModel: snap.carModel,
    damage: snap.damage,
    objective: snap.objective,
    objectiveDist: snap.objectiveDist,
    fps: snap.fps,
    quality: snap.quality,
    hour: snap.hour,
    traffic: snap.traffic,
    parked: snap.parked,
    errors: snap.errors,
    waterBlocked: snap.waterBlocked,
    waterRings: snap.waterRings,
    waterRoadSegs: snap.waterRoadSegs,
    hazardWet: snap.hazardWet,
    lastStop: snap.lastStop
      ? {
          kind: snap.lastStop.kind,
          x: snap.lastStop.x,
          y: snap.lastStop.y,
          z: snap.lastStop.z,
          yaw: snap.lastStop.yaw,
          dist: snap.lastStop.dist,
          handle: snap.lastStop.handle,
        }
      : null,
    nearTraf: snap.nearTraf ? [snap.nearTraf.d, snap.nearTraf.x, snap.nearTraf.z] : null,
  };
}

type Flow = "idle" | "capturing" | "annotate" | "sending" | "sent" | "saved" | "failed";

interface Stroke {
  tool: "pen" | "high" | "arrow";
  pts: { x: number; y: number }[];
}

const PANEL: React.CSSProperties = {
  position: "fixed", right: 10, top: 164, zIndex: 91, width: "min(340px, calc(100vw - 20px))",
  maxHeight: "72vh", overflowY: "auto", background: "rgba(8,10,18,.92)",
  border: "1px solid #2c3a5e", borderRadius: 10, padding: "10px 12px",
  font: "12px/1.55 'Courier New', monospace", color: "#d7e2e2",
};
const BTN: React.CSSProperties = {
  minHeight: 40, padding: "8px 12px", borderRadius: 8, border: "1px solid #2c3a5e",
  background: "#16233a", color: "#e8eef2", font: "600 13px system-ui, sans-serif", cursor: "pointer",
};

export function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<PanelSnap | null>(null);
  const [beaconOn, setBeaconOn] = useState(() => {
    try {
      return localStorage.getItem(BEACON_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [flow, setFlow] = useState<Flow>("idle");
  const [shotFailed, setShotFailed] = useState(false);
  const [note, setNote] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [tool, setTool] = useState<Stroke["tool"]>("pen");
  const strokes = useRef<Stroke[]>([]);
  const cur = useRef<Stroke | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [hasShot, setHasShot] = useState(false);

  // Panel refresh (2 Hz, only while open — the closed button costs nothing).
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setSnap(readSnapshot()), 500);
    setSnap(readSnapshot());
    return () => window.clearInterval(id);
  }, [open ]);

  // Telemetry beacon (1 Hz, fire-and-forget — never awaits, never blocks).
  useEffect(() => {
    if (!beaconOn) return;
    const id = window.setInterval(() => {
      try {
        const snapNow = readSnapshot();
        const body = JSON.stringify({ token: DEBUG_API_TOKEN, ...buildBeaconPayload(beaconInput(snapNow)) });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(DEBUG_BEACON_PATH, new Blob([body], { type: "application/json" }));
        } else {
          fetch(DEBUG_BEACON_PATH, { method: "POST", body, keepalive: true }).catch(() => {});
        }
      } catch {
        /* telemetry must never break the game */
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [beaconOn]);

  const toggleBeacon = () => {
    setBeaconOn((v) => {
      const nv = !v;
      try {
        localStorage.setItem(BEACON_KEY, nv ? "1" : "0");
      } catch {
        /* ignore */
      }
      return nv;
    });
  };

  // --- Annotation canvas ---
  const drawAll = () => {
    const cv = canvasRef.current;
    const img = imgRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (img) ctx.drawImage(img, 0, 0, cv.width, cv.height);
    for (const s of strokes.current) {
      if (s.pts.length === 0) continue;
      ctx.save();
      if (s.tool === "high") {
        ctx.strokeStyle = "rgba(255,235,59,.45)";
        ctx.lineWidth = 18;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      } else {
        ctx.strokeStyle = "#ff3b30";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      for (const p of s.pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (s.tool === "arrow" && s.pts.length > 1) {
        const a = s.pts[0];
        const b = s.pts[s.pts.length - 1];
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - 16 * Math.cos(ang - 0.42), b.y - 16 * Math.sin(ang - 0.42));
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - 16 * Math.cos(ang + 0.42), b.y - 16 * Math.sin(ang + 0.42));
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const canvasPos = (e: React.PointerEvent): { x: number; y: number } => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * cv.width,
      y: ((e.clientY - r.top) / r.height) * cv.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    cur.current = { tool, pts: [canvasPos(e)] };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!cur.current) return;
    cur.current.pts.push(canvasPos(e));
    drawAll();
    // Draw the in-progress stroke on top without committing it twice:
    // drawAll already replays committed strokes only, so append the live one.
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    const s = cur.current;
    if (cv && ctx && s.pts.length > 1) {
      ctx.save();
      ctx.strokeStyle = s.tool === "high" ? "rgba(255,235,59,.45)" : "#ff3b30";
      ctx.lineWidth = s.tool === "high" ? 18 : 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      for (const p of s.pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
  };
  const onUp = () => {
    if (cur.current && cur.current.pts.length > 0) strokes.current.push(cur.current);
    cur.current = null;
    drawAll();
  };

  // --- Report flow ---
  const startReport = () => {
    strokes.current = [];
    setNote("");
    setSendMsg("");
    setShotFailed(false);
    setHasShot(false);
    setFlow("capturing");
    requestCapture();
    const t0 = Date.now();
    const poll = window.setInterval(() => {
      const shot = takeCapturedFrame();
      if (shot) {
        window.clearInterval(poll);
        const img = new Image();
        img.onload = () => {
          imgRef.current = img;
          const cv = canvasRef.current;
          if (cv) {
            const scale = Math.min(1, 1024 / img.width);
            cv.width = Math.round(img.width * scale);
            cv.height = Math.round(img.height * scale);
          }
          strokes.current = [];
          setHasShot(true);
          setFlow("annotate");
          // Paint after the canvas element exists in the annotate view.
          window.setTimeout(drawAll, 0);
        };
        img.onerror = () => {
          setShotFailed(true);
          setFlow("annotate");
        };
        img.src = shot;
      } else if (Date.now() - t0 > 1500) {
        // No frame arrived (game paused or frameloop idle): report with
        // note + state and no screenshot, rather than hanging.
        window.clearInterval(poll);
        setShotFailed(true);
        setFlow("annotate");
      }
    }, 150);
  };

  const sendReport = async () => {
    setFlow("sending");
    setSendMsg("");
    try {
      const state = readSnapshot();
      let image: string | null = null;
      if (hasShot && canvasRef.current) {
        image = canvasRef.current.toDataURL("image/jpeg", 0.82);
      }
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 20000);
      let res: Response;
      try {
        res = await fetch(DEBUG_REPORT_PATH, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: DEBUG_API_TOKEN, note, state, image }),
          signal: ctrl.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      if (res.ok) {
        setFlow("sent");
        setSendMsg("Sent to the debug inbox on Nic's box.");
        return;
      }
      throw new Error(`server ${res.status}`);
    } catch {
      // Fallback: save the annotated image locally so it can be pasted into
      // chat. A report must never silently vanish.
      try {
        if (hasShot && canvasRef.current) {
          const a = document.createElement("a");
          a.href = canvasRef.current.toDataURL("image/jpeg", 0.82);
          a.download = `quahog-report-${Date.now()}.jpg`;
          a.click();
          setFlow("saved");
          setSendMsg("Could not reach the server — the annotated image was saved to your downloads. Paste it into chat with your note.");
          return;
        }
      } catch {
        /* fall through to failed */
      }
      setFlow("failed");
      setSendMsg("Send failed and no image was available to save. Your note was not sent — try again.");
    }
  };

  const closeFlow = () => {
    setFlow("idle");
    setNote("");
    setSendMsg("");
  };

  const modelColor = (s: string) => (s === "loaded" ? "#7ee787" : s === "failed" ? "#ff7a7a" : "#ffcf4a");

  return (
    <>
      {/* Persistent wrench button: below the status box, above the actions
          column. Small, translucent, never blocks gameplay. */}
      <button
        aria-label="Debug overlay"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed", right: "max(10px, env(safe-area-inset-right))", top: 120,
          width: 38, height: 38, borderRadius: "50%", zIndex: 90, cursor: "pointer",
          background: "rgba(8,10,18,.75)", border: "1px solid #2c3a5e", color: "#c7d4d2",
          font: "700 11px system-ui, sans-serif",
        }}
      >
        DBG
      </button>

      {open && flow === "idle" && (
        <div style={PANEL}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ color: "#e8c87a" }}>DEBUG</b>
            <button onClick={() => setOpen(false)} style={{ ...BTN, minHeight: 30, padding: "4px 10px" }}>Close</button>
          </div>
          <div style={{ opacity: 0.7, margin: "4px 0 8px", wordBreak: "break-all" }}>build {BUILD_ID}</div>
          {snap ? (
            <>
              <div>{snap.fps} fps · {snap.draws} draws · {(snap.tris / 1000).toFixed(0)}k tris · p95 {snap.p95.toFixed(1)} ms · quality {snap.quality}</div>
              <div>mode {snap.mode} · pos {snap.pos ? `${snap.pos.x.toFixed(1)}, ${snap.pos.y.toFixed(1)}, ${snap.pos.z.toFixed(1)}` : "—"} · {snap.speed.toFixed(1)} m/s ({(snap.speed * 2.237).toFixed(0)} mph) · hdg {snap.headingDeg.toFixed(0)}°</div>
              <div>car {snap.carType} · model: <span style={{ color: modelColor(snap.carModel.split(" ")[0]) }}>{snap.carModel}</span> · damage {snap.damage}</div>
              <div>heat police {snap.police} · faction {snap.faction} · hour {snap.hour.toFixed(1)}</div>
              <div>mission {snap.missionTitle} — {snap.objective}{snap.objectiveDist !== null ? ` · ${snap.objectiveDist.toFixed(0)} m` : ""}</div>
              <div>traffic {snap.traffic}/{snap.trafficTotal} · parked {snap.parked >= 0 ? snap.parked : "—"}</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>Probes</div>
              <div>water blocked {snap.waterBlocked === null ? "—" : snap.waterBlocked ? "YES" : "no"} · rings {snap.waterRings} · road segs {snap.waterRoadSegs} · wet {snap.hazardWet.toFixed(1)}s</div>
              <div>
                last stop {snap.lastStop
                  ? `${snap.lastStop.kind} @ ${snap.lastStop.x.toFixed(1)}, ${snap.lastStop.z.toFixed(1)} yaw ${normDeg((snap.lastStop.yaw * 180) / Math.PI).toFixed(0)}°${snap.lastStop.dist !== null ? ` · hit ${snap.lastStop.dist.toFixed(2)} m` : ""}${snap.lastStop.handle !== null ? ` · handle ${snap.lastStop.handle}` : ""}`
                  : "none"}
              </div>
              <div>nearest traffic {snap.nearTraf ? `${snap.nearTraf.d.toFixed(1)} m @ ${snap.nearTraf.x.toFixed(1)}, ${snap.nearTraf.z.toFixed(1)}` : "none"}</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>Models</div>
              {snap.models.length === 0 && <div style={{ opacity: 0.6 }}>no model reports yet</div>}
              {snap.models.map((m) => (
                <div key={m.path} style={{ wordBreak: "break-all" }}>
                  <span style={{ color: modelColor(m.state) }}>{m.state}</span> {m.path}
                  {m.error ? <div style={{ color: "#ff7a7a" }}>{m.error}</div> : null}
                </div>
              ))}
              <div style={{ marginTop: 8, fontWeight: 700 }}>Recent errors</div>
              {snap.errors.length === 0 && <div style={{ opacity: 0.6 }}>none captured</div>}
              {snap.errors.slice(-8).map((e, i) => (
                <div key={i} style={{ color: e.level === "error" ? "#ff7a7a" : "#ffcf4a", wordBreak: "break-all" }}>
                  {e.level}: {e.msg}
                </div>
              ))}
            </>
          ) : (
            <div style={{ opacity: 0.6 }}>collecting…</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={toggleBeacon} style={BTN}>
              Beacon: {beaconOn ? "ON (1/sec → box)" : "OFF"}
            </button>
            <button onClick={startReport} style={{ ...BTN, background: "#3a2a12", borderColor: "#8a6a2a" }}>
              Report a problem
            </button>
          </div>
          <div style={{ opacity: 0.6, marginTop: 6, fontSize: 11 }}>
            Beacon + reports go to Nic&apos;s own box only. No third party, game state only.
          </div>
        </div>
      )}

      {open && flow === "capturing" && (
        <div style={PANEL}>
          <b style={{ color: "#e8c87a" }}>Capturing screenshot…</b>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Grabbing the next rendered frame.</div>
          <button onClick={closeFlow} style={{ ...BTN, marginTop: 10 }}>Cancel</button>
        </div>
      )}

      {open && (flow === "annotate" || flow === "sending") && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.92)",
          display: "flex", flexDirection: "column", padding: 12, gap: 10, overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ color: "#e8c87a", font: "700 14px system-ui, sans-serif" }}>Draw on it, then send</b>
            <button onClick={closeFlow} style={BTN}>Cancel</button>
          </div>
          {hasShot ? (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                {(["pen", "high", "arrow"] as Stroke["tool"][]).map((t) => (
                  <button key={t} onClick={() => setTool(t)} style={{ ...BTN, background: tool === t ? "#2c4a6a" : "#16233a" }}>
                    {t === "pen" ? "Pen" : t === "high" ? "Highlight" : "Arrow"}
                  </button>
                ))}
                <button onClick={() => { strokes.current.pop(); drawAll(); }} style={BTN}>Undo</button>
                <button onClick={() => { strokes.current = []; drawAll(); }} style={BTN}>Clear</button>
              </div>
              <canvas
                ref={canvasRef}
                style={{ width: "100%", touchAction: "none", borderRadius: 8, background: "#111" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
            </>
          ) : (
            <div style={{ color: "#ffcf4a", font: "13px system-ui, sans-serif" }}>
              No screenshot captured (game frame was not available) — your note and game state will still be sent.
            </div>
          )}
          {shotFailed && hasShot && (
            <div style={{ color: "#ffcf4a", font: "13px system-ui, sans-serif" }}>Screenshot loaded with a warning — annotations still work.</div>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs fixing? (optional)"
            rows={3}
            style={{ width: "100%", borderRadius: 8, padding: 10, font: "14px system-ui, sans-serif", background: "#101823", color: "#e8eef2", border: "1px solid #2c3a5e" }}
          />
          <button onClick={sendReport} disabled={flow === "sending"} style={{ ...BTN, background: "#3a2a12", borderColor: "#8a6a2a" }}>
            {flow === "sending" ? "Sending…" : "Send report"}
          </button>
        </div>
      )}

      {open && (flow === "sent" || flow === "saved" || flow === "failed") && (
        <div style={PANEL}>
          <b style={{ color: flow === "failed" ? "#ff7a7a" : "#7ee787" }}>
            {flow === "sent" ? "Report sent." : flow === "saved" ? "Image saved." : "Report failed."}
          </b>
          <div style={{ marginTop: 6 }}>{sendMsg}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {flow === "failed" && <button onClick={startReport} style={BTN}>Try again</button>}
            <button onClick={closeFlow} style={BTN}>Done</button>
          </div>
        </div>
      )}
    </>
  );
}
