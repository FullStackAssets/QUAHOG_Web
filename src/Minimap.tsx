import { useEffect, useMemo, useRef } from "react";
import { useGame } from "./store";
import { useMission } from "./mission";
import { shared } from "./shared";
import { CIVIC } from "./places";
import { districtOfWorld } from "./districts";
import { useEconomy, BUSINESSES } from "./economy";

// Player-centered radar (§21): draws nearby roads, the objective, and a heading
// arrow on a small canvas. North-up. Cheap 2D — no WebGL.

const SIZE = 168;
const RANGE = 230; // metres mapped to the radar radius
const R = SIZE / 2;
const PPM = R / RANGE; // pixels per metre

export function Minimap() {
  const slice = useGame((s) => s.slice);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const routeCache = useRef<{ pKey: string; tKey: string; path: [number, number][] | null }>({ pKey: "", tKey: "", path: null });

  // Road graph for the A-04 route line: nodes are road points snapped to a
  // 5 m grid (GIS polylines that meet at junctions usually share exact
  // coordinates; snapping absorbs small mismatches). Dijkstra over it;
  // if no path exists, the draw falls back to a straight dashed line.
  //
  // Rt 18 programme (2026-11-02, item 6): RAMP-ONLY junctions. The plain
  // graph let a route hop straight from a freeway node onto a crossing
  // street wherever the polylines touch in the 5 m snap — the fake forks
  // the audit found. Dijkstra state is now node + ARRIVAL CLASS
  // (motorway / link / street / any-start): from a motorway you may only
  // continue on motorway or link edges; from a street only street or link;
  // from a link (a ramp) anything — ramps are the only legal way on/off
  // the freeway. A motorway-origin route that cannot reach a ramp falls
  // back to the straight dashed line, same as before.
  const graph = useMemo(() => {
    if (!slice) return null;
    const nodes = new Map<string, { x: number; z: number }>();
    const adj = new Map<string, { to: string; w: number; cls: string }[]>();
    const key = (x: number, z: number) => `${Math.round(x / 5) * 5},${Math.round(z / 5) * 5}`;
    const addNode = (x: number, z: number) => {
      const k = key(x, z);
      if (!nodes.has(k)) { nodes.set(k, { x, z }); adj.set(k, []); }
      return k;
    };
    const cls = (highway: string) => highway === "motorway" ? "m" : highway === "motorway_link" ? "l" : "s";
    for (const r of slice.roads) {
      const c = cls(r.highway);
      for (let i = 0; i < r.points.length - 1; i++) {
        const a = addNode(r.points[i][0], -r.points[i][1]);
        const b = addNode(r.points[i + 1][0], -r.points[i + 1][1]);
        const w = Math.hypot(nodes.get(b)!.x - nodes.get(a)!.x, nodes.get(b)!.z - nodes.get(a)!.z);
        adj.get(a)!.push({ to: b, w, cls: c });
        adj.get(b)!.push({ to: a, w, cls: c });
      }
    }
    const nearest = (x: number, z: number) => {
      let best = "", bd = Infinity;
      for (const [k, n] of nodes) {
        const d = (n.x - x) ** 2 + (n.z - z) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    const route = (px: number, pz: number, tx: number, tz: number): [number, number][] | null => {
      const start = nearest(px, pz), goal = nearest(tx, tz);
      if (!start || !goal) return null;
      const startState = `${start}|*`;
      const dist = new Map<string, number>([[startState, 0]]);
      const prev = new Map<string, string>();
      const done = new Set<string>();
      const open: [number, string][] = [[0, startState]];
      let goalState: string | null = null;
      while (open.length) {
        open.sort((a, b) => a[0] - b[0]);
        const [d, u] = open.shift()!;
        if (done.has(u)) continue;
        done.add(u);
        if (u.split("|")[0] === goal) { goalState = u; break; }
        const curCls = u.split("|")[1];
        for (const e of adj.get(u.split("|")[0]) ?? []) {
          // Ramp-only rule: motorway<->street direct transitions are
          // forbidden; links bridge both sides; start state is open.
          if (!(curCls === "*" || curCls === "l" || e.cls === "l" || curCls === e.cls)) continue;
          const v = `${e.to}|${e.cls}`;
          const nd = d + e.w;
          if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); open.push([nd, v]); }
        }
      }
      if (!goalState) return null;
      const states: string[] = [goalState];
      while (states[0] !== startState) {
        const p = prev.get(states[0]);
        if (!p) return null;
        states.unshift(p);
      }
      return states.map((s) => { const n = nodes.get(s.split("|")[0])!; return [n.x, n.z] as [number, number]; });
    };
    return { route, nearest };
  }, [slice]);

  useEffect(() => {
    if (!slice) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    // pre-flatten road segments once (world x,z)
    const segs: number[] = []; // x1,z1,x2,z2,classIdx...
    for (const r of slice.roads) {
      const major = ["motorway", "trunk", "primary", "secondary"].includes(r.highway) ? 1 : 0;
      for (let i = 0; i < r.points.length - 1; i++) {
        segs.push(r.points[i][0], -r.points[i][1], r.points[i + 1][0], -r.points[i + 1][1], major);
      }
    }
    const water = slice.water ?? [];
    const parks = slice.parks ?? [];
    const barrier = slice.barrier ?? [];

    let lastDraw = 0;
    const draw = (now: number) => {
      if (document.hidden || now - lastDraw < 100) { raf = requestAnimationFrame(draw); return; }
      lastDraw = now;
      const body = useGame.getState().mode === "car" ? shared.car : shared.player;
      const t = body?.translation();
      const px = t?.x ?? 0, pz = t?.z ?? 0;
      const heading = useGame.getState().mode === "car" ? shared.carYaw : shared.heading;

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.clip();

      // backdrop
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Heading-up radar (playtest D-03): rotate the world around the
      // player so the direction of travel is always screen-up. The player
      // arrow below is then drawn unrotated, pointing up.
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(heading - Math.PI);
      ctx.translate(-R, -R);

      // water polys
      ctx.fillStyle = "#15384a";
      for (const ring of water) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const sx = R + (ring[i][0] - px) * PPM;
          const sy = R + (-ring[i][1] - pz) * PPM;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      }

      // parks / green spaces
      ctx.fillStyle = "#2c4626";
      for (const ring of parks) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const sx = R + (ring[i][0] - px) * PPM;
          const sy = R + (-ring[i][1] - pz) * PPM;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      }

      // roads
      for (let i = 0; i < segs.length; i += 5) {
        const x1 = R + (segs[i] - px) * PPM;
        const y1 = R + (segs[i + 1] - pz) * PPM;
        const x2 = R + (segs[i + 2] - px) * PPM;
        const y2 = R + (segs[i + 3] - pz) * PPM;
        // skip far segments cheaply
        if (x1 < -10 && x2 < -10) continue;
        if (x1 > SIZE + 10 && x2 > SIZE + 10) continue;
        ctx.strokeStyle = segs[i + 4] ? "#c8a24a" : "#5a5f6e";
        ctx.lineWidth = segs[i + 4] ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // route line to the active objective (A-04): road-following path
      // from the graph, falling back to a straight dashed line when the
      // road graph has no connecting path.
      // Fall River integration (2026-11-03): Phase 1 is fast-travel only
      // between districts, so a route to an objective in ANOTHER district
      // is never drawn — no 20 km line across the gap. Same-district
      // behavior (including the straight-dashed fallback) is unchanged.
      {
        const ms = useMission.getState();
        const step = ms.done ? null : ms.steps[ms.step];
        const crossDistrict = step?.target
          ? districtOfWorld(step.target[0], step.target[2]) !== useGame.getState().district
          : false;
        if (step?.target && !crossDistrict) {
          const pKey = `${Math.round(px / 10)},${Math.round(pz / 10)}`;
          const tKey = `${step.target[0]},${step.target[2]}`;
          if (routeCache.current.pKey !== pKey || routeCache.current.tKey !== tKey) {
            routeCache.current = { pKey, tKey, path: graph?.route(px, pz, step.target[0], step.target[2]) ?? null };
          }
          const path = routeCache.current.path;
          ctx.save();
          ctx.strokeStyle = "#ffcf4a";
          ctx.lineWidth = 3;
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          if (path && path.length > 1) {
            for (let i = 0; i < path.length; i++) {
              const sx = R + (path[i][0] - px) * PPM;
              const sy = R + (path[i][1] - pz) * PPM;
              i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
            }
          } else {
            ctx.moveTo(R, R);
            ctx.lineTo(R + (step.target[0] - px) * PPM, R + (step.target[2] - pz) * PPM);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // hurricane barrier (stone dike)
      ctx.strokeStyle = "#9a978c";
      ctx.lineWidth = 2.5;
      for (const path of barrier) {
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
          const sx = R + (path[i][0] - px) * PPM;
          const sy = R + (-path[i][1] - pz) * PPM;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // civic markers (police = blue, hospital = green)
      for (const c of CIVIC) {
        ctx.fillStyle = c.kind === "hospital" ? "#4ad66d" : "#3a6bff";
        ctx.fillRect(R + (c.pos[0] - px) * PPM - 3, R + (c.pos[2] - pz) * PPM - 3, 6, 6);
      }

      // business fronts (gold squares): owned = filled, buyable = hollow outline
      const owned = useEconomy.getState().owned;
      for (const b of BUSINESSES) {
        const bx = R + (b.pos[0] - px) * PPM;
        const by = R + (b.pos[2] - pz) * PPM;
        if (owned[b.id]) {
          ctx.fillStyle = "#ffcf4a";
          ctx.fillRect(bx - 3, by - 3, 6, 6);
          ctx.strokeStyle = "#0a0e18"; ctx.lineWidth = 1; ctx.strokeRect(bx - 3, by - 3, 6, 6);
        } else {
          ctx.strokeStyle = "#caa24a"; ctx.lineWidth = 1.5;
          ctx.strokeRect(bx - 3, by - 3, 6, 6);
        }
      }

      // cop blips (pulsing blue dots)
      const pulse = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
      for (const cop of shared.cops) {
        if (cop.dead) continue;
        ctx.fillStyle = `rgba(90,150,255,${0.5 + pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(R + (cop.pos.x - px) * PPM, R + (cop.pos.z - pz) * PPM, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // objective marker — pulsing gold diamond, with an edge arrow when
      // the objective is beyond radar range (playtest 2026-11-02: the old
      // 4px dot was unreadable at touch size, and the player drove away
      // from it for the whole video).
      const ms = useMission.getState();
      const step = ms.done ? null : ms.steps[ms.step];
      if (step?.target) {
        const ox = (step.target[0] - px) * PPM;
        const oy = (step.target[2] - pz) * PPM;
        const m = Math.hypot(ox, oy);
        const clamped = m > R - 10;
        const k = clamped ? (R - 10) / m : 1;
        const cx = R + ox * k, cy = R + oy * k;
        const pulse = 6 + Math.sin(performance.now() * 0.006) * 1.5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = "#ffcf4a";
        ctx.strokeStyle = "#0a0e18"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (clamped) {
          // edge arrow pointing toward the off-radar objective
          ctx.rotate(Math.atan2(oy, ox) + Math.PI / 2);
          ctx.moveTo(0, -pulse - 2); ctx.lineTo(pulse * 0.7, pulse * 0.7); ctx.lineTo(-pulse * 0.7, pulse * 0.7);
        } else {
          ctx.moveTo(0, -pulse); ctx.lineTo(pulse * 0.7, 0); ctx.lineTo(0, pulse); ctx.lineTo(-pulse * 0.7, 0);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // player-placed waypoint (§21) — pink dot, clamped to the radar edge
      const w = useGame.getState().waypoint;
      if (w) {
        let wx = (w.x - px) * PPM, wy = (w.z - pz) * PPM;
        const m = Math.hypot(wx, wy);
        if (m > R - 6) { const k = (R - 6) / m; wx *= k; wy *= k; } // clamp to ring
        ctx.fillStyle = "#d7c08c";
        ctx.beginPath();
        ctx.arc(R + wx, R + wy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0a0e18"; ctx.lineWidth = 1; ctx.stroke();
      }

      ctx.restore(); // end heading-up rotation

      ctx.restore();

      // player heading arrow (always centered, pointing up: the world
      // above is rotated heading-up, so no rotation is needed here)
      ctx.save();
      ctx.translate(R, R);
      ctx.fillStyle = "#d7c08c";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ring
      ctx.strokeStyle = "#6b7f82";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [slice]);

  return (
    <div className="hud-map" aria-label="Local map">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE, borderRadius: "50%" }} />
    </div>
  );
}
