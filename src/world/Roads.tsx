import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { makeAsphaltTexture, makeCobbleTexture, makeNoiseNormal, makeSidewalkTexture, makeFreewayTexture } from "./textures";
import { useGame } from "../store";
import { winterRoadTexture } from "./districtMaterials";
import { productionRoadMaps } from "./productionRoadMaps";
import type { Road } from "../slice";
import { buildFreewayCorridor, freewayDividers, trimRoadAtFreeway } from "./freeway";

const CELL = 1000;       // road chunk size (m)
const DRAW_DIST = 1500;  // hide road chunks beyond this from the camera

// Road classes → surface material. Highways get lane markings; vehicular streets
// get plain asphalt; footways/pedestrian/steps get historic cobblestone.
const HIGHWAY = new Set([
  "motorway", "trunk", "primary",
  "motorway_link", "trunk_link", "primary_link",
]);
const COBBLE = new Set(["footway", "path", "pedestrian", "steps", "cycleway", "track"]);
// parking-lot aisles / driveways / alleys — thousands of them. Drawn as a quiet,
// darker surface UNDER the real streets (no lane markings, no curb apron, no
// sidewalks) so the map doesn't read as a tangle of equal-weight roads converging.
const SERVICE = new Set(["service"]);
const TILE = 8; // metres of road per texture repeat along length

// Builds one merged ribbon geometry (with UVs). `uScale` controls cross-width
// texture repeats (cobble repeats across the width; asphalt spans 0..1 for lanes).
export function buildRibbon(roads: Road[], y: number, uScale: number, pad = 0, widthScale = 1): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let v = 0;
  for (const r of roads) {
    const half = (r.width * widthScale) / 2 + pad;
    const u = uScale === 0 ? 1 : r.width / uScale; // tiles across the width
    // world points (x=east, z=-north)
    const P: [number, number][] = r.points.map(([e, n]) => [e, -n]);
    const m = P.length;
    if (m < 2) continue;
    // per-segment unit direction + left normal + length
    const nrm: [number, number][] = [], seg: number[] = [];
    for (let i = 0; i < m - 1; i++) {
      const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1];
      const l = Math.hypot(dx, dz);
      if (l < 1e-6) { nrm.push([0, 0]); seg.push(0); continue; }
      nrm.push([-dz / l, dx / l]); seg.push(l);
    }
    // cumulative length at each vertex (for the lengthwise UV)
    const cum: number[] = [0];
    for (let i = 0; i < m - 1; i++) cum.push(cum[i] + seg[i]);
    // per-vertex MITERED offset: average the adjacent segment normals and scale
    // by 1/cos(half-angle) so the left/right edges stay continuous across a bend
    // instead of each segment overhanging/gapping (the "jutting/converging" look).
    const off: [number, number][] = [];
    for (let i = 0; i < m; i++) {
      if (i === 0) { off.push([nrm[0][0] * half, nrm[0][1] * half]); continue; }
      if (i === m - 1) { off.push([nrm[m - 2][0] * half, nrm[m - 2][1] * half]); continue; }
      let mx = nrm[i - 1][0] + nrm[i][0], mz = nrm[i - 1][1] + nrm[i][1];
      const ml = Math.hypot(mx, mz);
      if (ml < 1e-6) { off.push([nrm[i][0] * half, nrm[i][1] * half]); continue; }
      mx /= ml; mz /= ml;
      const cos = Math.max(mx * nrm[i][0] + mz * nrm[i][1], 0.33); // clamp sharp spikes
      off.push([(mx * half) / cos, (mz * half) / cos]);
    }
    // emit one quad per segment using the shared mitered vertex offsets
    for (let i = 0; i < m - 1; i++) {
      if (seg[i] < 1e-6) continue;
      const v0 = cum[i] / TILE, v1 = cum[i + 1] / TILE;
      const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1];
      const oa = off[i], ob = off[i + 1];
      pos.push(
        ax + oa[0], y, az + oa[1],
        bx + ob[0], y, bz + ob[1],
        bx - ob[0], y, bz - ob[1],
        ax - oa[0], y, az - oa[1],
      );
      uv.push(0, v0, 0, v1, u, v1, u, v0);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  if (pos.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Raised curb + sidewalk flanking each street: a top strip at height `top` with
// a short vertical curb face down to grade on the inner (street-facing) edge, on
// both sides of the centerline. Reads as a real walkway instead of flat paint.
export function buildSidewalks(roads: Road[], top: number, inner: number, width: number): THREE.BufferGeometry | null {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let v = 0;
  for (const r of roads) {
    const half = r.width / 2;
    const i0 = half + inner;        // inner (curb) offset from centerline
    const o0 = half + inner + width; // outer edge
    let len = 0;
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i];
      const [bx, bn] = r.points[i + 1];
      const x1 = ax, z1 = -an, x2 = bx, z2 = -bn;
      const dx = x2 - x1, dz = z2 - z1;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 1e-4) continue;
      const nx = -dz / segLen, nz = dx / segLen; // unit left normal
      const v0 = len / TILE, v1 = (len + segLen) / TILE;
      for (const s of [1, -1]) {
        const ix = nx * i0 * s, iz = nz * i0 * s; // inner offset vector
        const ox = nx * o0 * s, oz = nz * o0 * s; // outer offset vector
        // top strip (inner→outer) at height `top`
        pos.push(x1 + ix, top, z1 + iz, x2 + ix, top, z2 + iz, x2 + ox, top, z2 + oz, x1 + ox, top, z1 + oz);
        uv.push(0, v0, 0, v1, 1, v1, 1, v0);
        if (s === 1) idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
        else idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
        // vertical curb face along the inner edge (grade→top), wound to face the street
        const fwd = s === 1 ? 1 : -1; // keep outward-facing winding per side
        pos.push(x1 + ix, 0, z1 + iz, x2 + ix, 0, z2 + iz, x2 + ix, top, z2 + iz, x1 + ix, top, z1 + iz);
        uv.push(0, 0, 0, 1, 1, 1, 1, 0);
        if (fwd === 1) idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
        else idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
        v += 4;
      }
      len += segLen;
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Roads({ roads }: { roads: Road[] }) {
  const snowy = useGame((s) => s.weather === "snow");
  const snowRoad = useMemo(() => winterRoadTexture(), []);
  const surfaceTex = useMemo(() => makeAsphaltTexture(false), []);
  // Map-data upgrade (2026-11-03): one freeway texture per divider count.
  // Records with no lane data use the legacy 2-divider texture, so gaps
  // stay visually unchanged. Textures are shared across chunks.
  const freewayTexByDividers = useMemo(() => new Map(
    [0, 1, 2, 3].map((d) => [d, makeFreewayTexture(d)] as const),
  ), []);
  const cobbleTex = useMemo(() => {
    const t = makeCobbleTexture();
    t.repeat.set(1, 0.5); // bigger cobbles along length
    return t;
  }, []);
  const nrm = useMemo(() => makeNoiseNormal(), []);
  // Combined-tree fix: R3/R4 referenced `quality` here with no binding (the
  // tsc failure in both R4 packages). Declared before first use.
  const quality = useGame((s) => s.quality);
  const pbrRoad = useMemo(() => quality > 0 ? productionRoadMaps() : null, [quality]);
  const ns = useMemo(() => new THREE.Vector2(0.18, 0.18), []);
  const sidewalkTex = useMemo(() => { const t = makeSidewalkTexture(); t.repeat.set(1, 4); return t; }, []);

  // chunk roads into a spatial grid so off-screen/distant cells are culled
  const corridor = useMemo(() => buildFreewayCorridor(roads), [roads]);
  // Rt 18 programme (2026-11-02): crossing-street ribbons are trimmed at
  // the freeway edge (item 6) BEFORE chunking, so through streets stop
  // drawing flat at-grade junctions into the motorway. Freeway records
  // pass through untouched; the trim only splits non-freeway polylines.
  const trimmed = useMemo(() => roads.flatMap((r) => trimRoadAtFreeway(r, corridor)), [roads, corridor]);
  const chunks = useMemo(() => {
    const land = trimmed.filter((r) => !r.bridge); // bridges handled by <Bridges/>
    const cells = new Map<string, { cb: Road[]; sf: Road[]; hw: Road[]; sv: Road[]; cx: number; cz: number }>();
    for (const r of land) {
      const mid = r.points[Math.floor(r.points.length / 2)] ?? r.points[0];
      const gx = Math.floor(mid[0] / CELL), gn = Math.floor(mid[1] / CELL);
      const key = `${gx}_${gn}`;
      let c = cells.get(key);
      if (!c) { c = { cb: [], sf: [], hw: [], sv: [], cx: (gx + 0.5) * CELL, cz: -(gn + 0.5) * CELL }; cells.set(key, c); }
      if (HIGHWAY.has(r.highway)) c.hw.push(r);
      else if (COBBLE.has(r.highway)) c.cb.push(r);
      else if (SERVICE.has(r.highway)) c.sv.push(r);
      else c.sf.push(r);
    }
    return [...cells.values()].map((c) => ({
      cx: c.cx, cz: c.cz,
      // concrete curb/sidewalk apron under + around ordinary streets
      apron: buildRibbon(c.sf, 0.04, 0, 2.6),
      // Rt 18 programme: freeway shoulders are NOT the apron slab. The old
      // shared apron (pad 2.6) merged both carriageways into one flat
      // parking-looking slab; shoulders now read as shoulders — narrower
      // (pad 1.0), darker tone, outside the edge lines.
      shoulder: buildRibbon(c.hw, 0.04, 0, 1.0),
      // raised curb + walkway flanking ordinary streets (not highways/cobble)
      sidewalk: buildSidewalks(c.sf, 0.14, 0.1, 2.0),
      cobble: buildRibbon(c.cb, 0.05, 1.2),
      // service aisles/driveways: slightly trimmed, drawn just below street level
      service: buildRibbon(c.sv, 0.045, 0, 0, 0.9),
      surface: buildRibbon(c.sf, 0.06, 0),
      // painted centre line down arterials (>=8m: secondary/tertiary) so streets
      // read as real roads, not bare asphalt. Thin ribbon along the centerline.
      centerline: buildRibbon(c.sf.filter((r) => r.width >= 8), 0.066, 0, 0, 0.025),
      // trim highway carriageway width so close divided carriageways (the two
      // directions of I-195) read as separate roads with a median gap instead of
      // one squished/converging blob; the concrete apron keeps the shoulders.
      // Map-data upgrade (2026-11-03): highway ribbons split by lane-divider
      // count so each carriageway's dashes match its real lane count (Rt 18:
      // 2 near the core, 3 further north) instead of one uniform texture.
      // Records with no lane data fall in the 2-divider (legacy) group.
      highways: (() => {
        const groups = new Map<number, Road[]>();
        for (const r of c.hw) {
          const d = freewayDividers(r.lanes);
          const arr = groups.get(d);
          if (arr) arr.push(r); else groups.set(d, [r]);
        }
        return [...groups.entries()].map(([dividers, rs]) => ({
          dividers,
          geom: buildRibbon(rs, 0.08, 0, 0, 0.72),
        })).filter((g) => g.geom !== null);
      })(),
    }));
  }, [trimmed]);
  useEffect(() => () => {
    for (const chunk of chunks) {
      for (const key of ["apron", "shoulder", "sidewalk", "cobble", "service", "surface", "centerline"] as const) {
        chunk[key]?.dispose();
      }
      for (const h of chunk.highways) h.geom?.dispose();
    }
  }, [chunks]);

  // distance-cull cells + wet-road sheen (rain) via traversal
  const root = useRef<THREE.Group>(null);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const wet = useGame.getState().weather === "rain" ? 1 : 0;
    const cp = camera.position;
    chunks.forEach((c, i) => {
      const g = groups.current[i];
      if (g) g.visible = Math.hypot(cp.x - c.cx, cp.z - c.cz) < DRAW_DIST;
    });
    if (wet !== lastWet.current) {
      lastWet.current = wet;
      root.current?.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.isMeshStandardMaterial) { m.roughness = Math.max(0.24, (m.userData.base ?? 0.9) - wet * 0.30); m.metalness = 0; }
      });
    }
  });
  const lastWet = useRef(-1);

  return (
    <group ref={root}>
      {chunks.map((c, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)}>
          {c.apron && (
            <mesh geometry={c.apron} receiveShadow>
              <meshStandardMaterial map={snowy ? undefined : sidewalkTex} color={snowy ? "#e3edf4" : "#9a9890"} roughness={0.95} userData={{ base: 0.95 }} />
            </mesh>
          )}
          {c.shoulder && (
            <mesh geometry={c.shoulder} receiveShadow>
              <meshStandardMaterial map={snowy ? undefined : sidewalkTex} color={snowy ? "#d8dee2" : "#7a7872"} roughness={0.96} userData={{ base: 0.96 }} />
            </mesh>
          )}
          {c.sidewalk && (
            <mesh geometry={c.sidewalk} receiveShadow castShadow>
              <meshStandardMaterial map={snowy ? undefined : sidewalkTex} color={snowy ? "#f0f4f9" : "#d3cdc0"} roughness={0.92} userData={{ base: 0.92 }} />
            </mesh>
          )}
          {c.cobble && (
            <mesh geometry={c.cobble} receiveShadow>
              <meshStandardMaterial map={snowy ? snowRoad : cobbleTex} color={snowy ? "#dce2e5" : "#8a8580"} roughness={0.95} userData={{ base: 0.95 }} />
            </mesh>
          )}
          {c.service && (
            <mesh geometry={c.service} receiveShadow>
              <meshStandardMaterial map={snowy ? snowRoad : surfaceTex} color={snowy ? "#b9c5cb" : "#44464d"} roughness={0.96} userData={{ base: 0.96 }} polygonOffset polygonOffsetFactor={-0.5} polygonOffsetUnits={-0.5} />
            </mesh>
          )}
          {c.surface && (
            <mesh geometry={c.surface} receiveShadow>
              <meshStandardMaterial map={snowy ? snowRoad : (pbrRoad?.color ?? surfaceTex)} normalMap={snowy ? nrm : (pbrRoad?.normal ?? nrm)} roughnessMap={snowy ? undefined : pbrRoad?.roughness} normalScale={ns} color={snowy ? "#d5dfe5" : "#9a9da0"} roughness={0.9} userData={{ base: 0.9 }} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            </mesh>
          )}
          {c.centerline && (
            <mesh geometry={c.centerline}>
              <meshStandardMaterial color={snowy ? "#d5d8ca" : "#d8b43c"} roughness={0.7} emissive="#c8a028" emissiveIntensity={0.15} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
            </mesh>
          )}
          {c.highways.map((h, j) => (
            h.geom && (
              <mesh key={j} geometry={h.geom} receiveShadow>
                <meshStandardMaterial map={snowy ? snowRoad : freewayTexByDividers.get(h.dividers)} normalMap={nrm} normalScale={ns} color={snowy ? "#d5dfe5" : "#a7a9aa"} roughness={0.82} userData={{ base: 0.82 }} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
              </mesh>
            )
          ))}
        </group>
      ))}
    </group>
  );
}
