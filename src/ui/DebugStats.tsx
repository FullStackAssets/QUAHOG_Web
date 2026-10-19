import { useEffect, useRef, useState } from "react";
import { perfStats } from "./perfStats";

// Lightweight, off-by-default debug HUD (§ telemetry stub): FPS, frame time, and
// page load time. No analytics, nothing sent anywhere — purely local. Enable
// with `?debug` in the URL or localStorage `mounthope.debug=1`; toggle live with
// the backtick (`) key.
function debugOn(): boolean {
  try {
    if (location.search.includes("debug")) return true;
    return localStorage.getItem("mounthope.debug") === "1";
  } catch { return false; }
}

export function DebugStats() {
  const [on, setOn] = useState(debugOn);
  const [fps, setFps] = useState(0);
  const [ms, setMs] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`") {
        setOn((v) => {
          const nv = !v;
          try { localStorage.setItem("mounthope.debug", nv ? "1" : "0"); } catch { /* ignore */ }
          return nv;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0, frames = 0;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      acc += dt; frames++;
      if (acc >= 500) { // refresh twice a second
        setFps(Math.round((frames * 1000) / acc));
        setMs(Math.round((acc / frames) * 10) / 10);
        acc = 0; frames = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on) return null;
  // page load time (navigation start → load event)
  const load = (() => {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav ? Math.round(nav.loadEventEnd || nav.duration) : 0;
    } catch { return 0; }
  })();

  return (
    <div
      ref={box}
      style={{
        position: "absolute", top: 8, left: 8, zIndex: 40, pointerEvents: "none",
        background: "rgba(8,10,18,.7)", border: "1px solid #2c3a5e", borderRadius: 6,
        padding: "4px 8px", font: "11px/1.5 'Courier New', monospace",
        color: fps >= 50 ? "#7ee787" : fps >= 30 ? "#ffcf4a" : "#ff7a7a",
      }}
    >
      {fps} fps · {ms} ms · {perfStats.draws} draws · {(perfStats.tris / 1000).toFixed(0)}k tris{load ? ` · load ${load}ms` : ""}
    </div>
  );
}
