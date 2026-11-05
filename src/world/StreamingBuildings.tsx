import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RigidBody } from "@react-three/rapier";
import { shared } from "../shared";
import { Buildings } from "./Buildings";
import { ArchitecturalDetails } from "./ArchitecturalDetails";
import { FacadeRelief } from "./FacadeRelief";
import { ArchitecturalShell } from "./ArchitecturalShell";
import { productionFacadeMaps } from "./productionFacadeMaps";
import { ensureGisReplacements, withoutReplaced } from "./gisDistrict";
import { makeFacadeMaps, makeNoiseNormal } from "./textures";
import { districtStyle, type FacadeKind } from "./districtStyle";
import { setCameraBuildings } from "../actors/cameraBuildings";
import { useGame } from "../store";
import { mobileBudget } from "../mobile/profile";
import { requestLimit, trimCache } from "../mobile/requests";
import { viewRadius } from "../quality";
import type { Building } from "../slice";

// Multi-tile building streamer (Step 19). Loads building tiles (public/tiles/
// b_<gx>_<gn>.json) within VIEW_R of the player and drops them when far, so
// memory/draw stays bounded as the map grows to the whole South Coast. The
// player's own tile + neighbours (COLLIDE_R) get a static collider. Falls back
// to the monolithic <Buildings> if the manifest isn't present.

const VIEW_R = 3;     // tiles loaded around the player (each TILE metres)
const COLLIDE_R = 1;  // tiles that get physics colliders
const WINDOW_GLOW = new THREE.Color("#ffcf8a");
// New Bedford palette: brick reds, painted clapboard, weathered wood (short
// residential/commercial) vs granite + concrete (tall downtown).
const WARM = ["#7e463a", "#8a5a48", "#9c6347", "#a8514a", "#6e4a3e", "#b0a48c", "#c2bcae", "#5e6b66", "#8a9488", "#b8b0a0"];
const GREY = ["#7c7e88", "#9aa0a6", "#8f8c86", "#6f7178", "#a7a59c", "#86837c"];
const ROOF = ["#2c2a28", "#37322c", "#31343a", "#2a2e30", "#3a352f"]; // tar / gravel roofs
const HERO_COLOR = "#caa24a";
const HERO = new Set(["Seamen's Bethel", "New Bedford Whaling Museum", "Mariner's Home", "Double Bank Building", "Rodman Candleworks"]);
const FLOOR = 3.2; // metres per window row

interface Manifest { tile: number; keys: string[] }

// A simple hip roof: triangles from each footprint edge up to a centre apex, so
// short residential buildings read as pitched houses (triple-deckers, capes)
// instead of flat-topped boxes. Winding is corrected so every face points up.
function hipRoof(b: Building, roofH: number, col: THREE.Color): THREE.BufferGeometry | null {
  const fp = b.footprint;
  if (fp.length < 3) return null;
  let cx = 0, cn = 0;
  for (const [e, n] of fp) { cx += e; cn += n; }
  cx /= fp.length; cn /= fp.length;
  const apex: [number, number, number] = [cx, b.height + roofH, -cn];
  const pos: number[] = [], colr: number[] = [], uv: number[] = [];
  const push = (x: number, y: number, z: number) => { pos.push(x, y, z); colr.push(col.r, col.g, col.b); uv.push(0.04, 0.04); };
  for (let i = 0; i < fp.length; i++) {
    const [e0, n0] = fp[i], [e1, n1] = fp[(i + 1) % fp.length];
    const a: [number, number, number] = [e0, b.height, -n0];
    const c: [number, number, number] = [e1, b.height, -n1];
    // face normal (a→c→apex); flip if it points down so roofs catch the sun
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2];
    const vx = apex[0] - a[0], vy = apex[1] - a[1], vz = apex[2] - a[2];
    const ny = uz * vx - ux * vz;
    if (ny >= 0) { push(...a); push(...c); push(...apex); }
    else { push(...a); push(...apex); push(...c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Pitched two-plane roof for GIS rectangles. Unlike the old all-edges-to-one
// point pyramid, the ridge follows the building's *long* axis. For irregular
// footprints retain the conservative hip roof, never invent a rectangle.
function gableRoof(b: Building, height: number, col: THREE.Color): THREE.BufferGeometry | null {
  const f = b.footprint;
  if (f.length !== 4 || !Number.isFinite(b.height) || b.height <= 0) return null;
  const p = f.map(([x, n]) => [x, -n] as const);
  const edges = p.map((v, i) => {
    const w = p[(i + 1) % 4]; return [w[0] - v[0], w[1] - v[1]] as const;
  });
  const lengths = edges.map(([dx, dz]) => Math.hypot(dx, dz));
  if (lengths.some(l => l < 1.5) || !lengths.every(Number.isFinite)) return null;
  const perpendicular = Math.abs((edges[0][0]*edges[1][0] + edges[0][1]*edges[1][1])/(lengths[0]*lengths[1]));
  if (perpendicular > 0.22 || Math.abs(lengths[0]-lengths[2]) > 0.18*lengths[0] || Math.abs(lengths[1]-lengths[3]) > 0.18*lengths[1]) return null;
  const btm = p.map(([x,z]) => [x,b.height,z] as [number,number,number]);
  const mid = (a: number, c: number): [number,number,number] => [
    (btm[a][0]+btm[c][0])/2, b.height+height, (btm[a][2]+btm[c][2])/2,
  ];
  const roofLong0 = lengths[0] >= lengths[1];
  const r0 = roofLong0 ? mid(0,3) : mid(0,1);
  const r1 = roofLong0 ? mid(1,2) : mid(3,2);
  const faces: [number[],number[],number[],boolean][] = [];
  const addQuad = (a:number[],b:number[],c:number[],d:number[]) => {
    faces.push([a,b,c,true],[a,c,d,true]);
  };
  if (roofLong0) {
    addQuad(btm[0],btm[1],r1,r0);
    addQuad(btm[3],btm[2],r1,r0);
    faces.push([btm[0],r0,btm[3],false], [btm[1],btm[2],r1,false]);
  } else {
    addQuad(btm[1],btm[2],r1,r0);
    addQuad(btm[0],btm[3],r1,r0);
    faces.push([btm[0],btm[1],r0,false], [btm[3],r1,btm[2],false]);
  }
  const cx=btm.reduce((n,p)=>n+p[0],0)/4, cz=btm.reduce((n,p)=>n+p[2],0)/4;
  const pos:number[]=[], cols:number[]=[], uv:number[]=[];
  for (const [a,b,c,isSlope] of faces) {
    const ab=[b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const ac=[c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const nx=ab[1]*ac[2]-ab[2]*ac[1];
    const ny=ab[2]*ac[0]-ab[0]*ac[2];
    const nz=ab[0]*ac[1]-ab[1]*ac[0];
    const outward = nx*((a[0]+b[0]+c[0])/3-cx) + nz*((a[2]+b[2]+c[2])/3-cz);
    const tri = (isSlope ? ny < 0 : outward < 0) ? [a,c,b] : [a,b,c];
    for (const [x,y,z] of tri) {
      pos.push(x,y,z); cols.push(col.r,col.g,col.b);
      uv.push(0.04,0.04);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  return g;
}

// A parapet: a short wall band standing just above the roof line, around the
// footprint perimeter, so flat-roofed commercial/mill/downtown blocks read with
// a real coping edge instead of a bare extruded-box top. Outward winding is
// derived from each edge vs. the centroid (deterministic, no guesswork).
function parapet(b: Building, h: number, col: THREE.Color): THREE.BufferGeometry | null {
  const fp = b.footprint;
  if (fp.length < 3) return null;
  let cx = 0, cn = 0;
  for (const [e, n] of fp) { cx += e; cn += n; }
  cx /= fp.length; cn /= fp.length;
  const cz = -cn; // centroid in world z
  const y0 = b.height, y1 = b.height + h;
  const pos: number[] = [], colr: number[] = [], uv: number[] = [];
  const push = (x: number, y: number, z: number) => { pos.push(x, y, z); colr.push(col.r, col.g, col.b); uv.push(0.04, 0.04); };
  for (let i = 0; i < fp.length; i++) {
    const [e0, n0] = fp[i], [e1, n1] = fp[(i + 1) % fp.length];
    const ax = e0, az = -n0, bx = e1, bz = -n1;
    const ex = bx - ax, ez = bz - az;
    if (Math.hypot(ex, ez) < 1e-4) continue;
    const mx = (ax + bx) / 2 - cx, mz = (az + bz) / 2 - cz; // edge midpoint → outward
    const outward = (-ez) * mx + ex * mz >= 0; // sign of the (A0,B0,B1) normal
    const A0: [number, number, number] = [ax, y0, az], B0: [number, number, number] = [bx, y0, bz];
    const B1: [number, number, number] = [bx, y1, bz], A1: [number, number, number] = [ax, y1, az];
    if (outward) { push(...A0); push(...B0); push(...B1); push(...A0); push(...B1); push(...A1); }
    else { push(...A0); push(...B1); push(...B0); push(...A0); push(...A1); push(...B1); }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function tileGeometry(buildings: Building[], lowQuality = false): Partial<Record<FacadeKind, THREE.BufferGeometry>> {
  const parts: Record<FacadeKind, THREE.BufferGeometry[]> = { brick: [], clapboard: [], granite: [] };
  buildings.forEach((b, i) => {
    const shape = new THREE.Shape();
    b.footprint.forEach(([e, n], k) => (k === 0 ? shape.moveTo(e, n) : shape.lineTo(e, n)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    // colour by use/height (style guide): short = brick/clapboard, tall = granite,
    // with per-building tonal variation so neighbours don't read identical. Roofs
    // get a dark tar tone and sample plain wall (no windows on the roof).
    const style = districtStyle(b);
    const materialKind = lowQuality ? "brick" : style.kind;
    const pal = b.height >= 14 ? GREY : WARM;
    const isHero = !!(b.name && HERO.has(b.name));
    const wall = new THREE.Color(style.wall);
    if (!isHero) wall.multiplyScalar(0.82 + ((style.seed % 997) / 997) * 0.34);
    const roof = new THREE.Color(ROOF[style.seed % ROOF.length]);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    for (let v = 0; v < count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      const ny = nor.getY(v);
      if (Math.abs(ny) > 0.5) { // roof / underside: roof tone, sample plain wall (no windows)
        colors.set([roof.r, roof.g, roof.b], v * 3);
        uv[v * 2] = 0.04; uv[v * 2 + 1] = 0.04;
      } else { // wall: window grid by floor
        colors.set([wall.r, wall.g, wall.b], v * 3);
        const horiz = Math.abs(nor.getX(v)) > Math.abs(nor.getZ(v)) ? z : x;
        uv[v * 2] = horiz / FLOOR; uv[v * 2 + 1] = y / FLOOR;
      }
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    parts[materialKind].push(g);
    // short residential buildings get a pitched hip roof so they don't read as
    // flat-topped boxes; taller commercial/downtown blocks get a parapet coping
    // band instead (both deterministic per-building).
    if (!isHero && b.height < 12) {
      const roofH = 1.5 + ((style.seed % 997) / 997) * 1.6;
      const r = (style.seed % 4 !== 0 ? gableRoof(b, roofH, roof) : null) ?? hipRoof(b, roofH, roof);
      if (r) parts[materialKind].push(r);
    } else if (!isHero) {
      // coping tone: the wall colour lightened toward limestone/concrete
      const coping = wall.clone().lerp(new THREE.Color("#cfc9bc"), 0.4);
      const p = parapet(b, 0.7 + ((style.seed % 997) / 997) * 0.7, coping);
      if (p) parts[materialKind].push(p);
    }
  });
  const result: Partial<Record<FacadeKind, THREE.BufferGeometry>> = {};
  for (const kind of ["brick", "clapboard", "granite"] as const) {
    const list = parts[kind];
    if (!list.length) continue;
    const merged = mergeGeometries(list, false);
    list.forEach(g => g.dispose());
    if (merged) result[kind] = merged;
  }
  return result;
}

function Tile({ buildings, colliders, tileKey }: { buildings: Building[]; colliders: boolean; tileKey: string }) {
  const quality = useGame((s) => s.quality);
  // Camera-inside-building fix (2026-11-03): streamed tiles are the New
  // Bedford building source, and only COLLIDE_R tiles get physics bodies —
  // the rest are visual-only. Register each loaded tile's footprints for
  // the geometric camera sweep; unregister when the tile drops.
  useEffect(() => {
    setCameraBuildings(`tile:${tileKey}`, buildings);
    return () => { setCameraBuildings(`tile:${tileKey}`, []); };
  }, [buildings, tileKey]);
  const geom = useMemo(() => tileGeometry(buildings, quality === 0), [buildings, quality]);
  useEffect(() => () => { Object.values(geom).forEach(g => g?.dispose()); }, [geom]);
  const procedural = useMemo(() => makeFacadeMaps(), []);
  const nrm = useMemo(() => makeNoiseNormal(), []);
  const mats = useMemo(() => {
    const result = {} as Record<FacadeKind, THREE.MeshStandardMaterial>;
    for (const kind of ["brick", "clapboard", "granite"] as const) {
      const maps = quality === 0 ? null : productionFacadeMaps(kind);
      result[kind] = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: maps?.albedo ?? procedural.albedo,
        emissiveMap: maps?.emissive ?? procedural.emissive,
        normalMap: maps?.normal ?? nrm,
        normalScale: new THREE.Vector2(0.34, 0.34),
        roughnessMap: maps?.roughness,
        roughness: 0.88,
        metalness: 0.025,
        emissive: WINDOW_GLOW,
        emissiveIntensity: 0,
      });
    }
    return result;
  }, [quality, procedural, nrm]);
  useEffect(() => () => { Object.values(mats).forEach(m => m.dispose()); }, [mats]);
  useFrame(() => {
    const night = 1 - THREE.MathUtils.smoothstep(shared.dayT, 0, 0.3);
    Object.values(mats).forEach(m => { m.emissiveIntensity = night * 0.35; });
  });

  // rooftop clutter (water tanks / AC units) on mid-rise buildings for skyline depth
  // NOTE (map-data upgrade, 2026-11-03): the 7–45 m gate below gates ONLY
  // this clutter instancing — not extrusion, colliders, or rendering. A
  // building taller than 45 m (e.g. a ~48 m levels-estimate) simply gets no
  // rooftop clutter; it still renders at full height. No tall height is
  // currently landed on any GIS row, so this needs no change.
  const roofs = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const b of buildings) {
      if (b.height < 7 || b.height > 45) continue;
      let x = 0, n = 0; for (const p of b.footprint) { x += p[0]; n += p[1]; }
      const k = b.footprint.length;
      out.push([x / k, b.height, -(n / k)]);
      if (out.length >= [12, 36, 90][quality]) break;
    }
    return out;
  }, [buildings, quality]);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = roofRef.current;
    if (!m) return;
    for (let i = 0; i < roofs.length; i++) {
      const [x, y, z] = roofs[i];
      const seed = Math.abs(Math.round(x * 13 + z * 7 + y * 19));
      _roofObject.position.set(x, y + 0.35 + (seed % 4) * 0.10, z);
      _roofObject.rotation.set(0, (seed % 8) * Math.PI / 4, 0);
      _roofObject.scale.set(0.7 + (seed % 5) * 0.23, 0.65 + (seed % 3) * 0.2, 0.8 + (seed % 7) * 0.19);
      _roofObject.updateMatrix();
      m.setMatrixAt(i, _roofObject.matrix);
      m.setColorAt(i, _roofPalette[seed % _roofPalette.length]);
    }
    m.count = roofs.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [roofs]);

  const meshes = ("brick clapboard granite".split(" ") as FacadeKind[])
    .filter(kind => !!geom[kind])
    .map(kind => <mesh key={kind} geometry={geom[kind]} material={mats[kind]} castShadow={colliders} receiveShadow />);
  if (!meshes.length) return null;
  return (
    <group>
      {colliders ? <RigidBody type="fixed" colliders="trimesh">{meshes}</RigidBody> : meshes}
      {colliders && <ArchitecturalDetails buildings={buildings} />}
      {colliders && <FacadeRelief buildings={buildings} />}
      {colliders && <ArchitecturalShell buildings={buildings} />}
      <instancedMesh ref={roofRef} args={[undefined, undefined, Math.max(1, roofs.length)]} castShadow={quality === 2}>
        <boxGeometry args={[1.8, 1, 1.8]} />
        <meshStandardMaterial color="#55585e" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
const _roofObject = new THREE.Object3D();
const _roofPalette = ["#626b70", "#9d9d91", "#4f5d61", "#706d62"].map((color) => new THREE.Color(color));

export function StreamingBuildings({ fallback, center }: { fallback: Building[]; center: [number, number] }) {
  const quality = useGame((s) => s.quality);
  const budget = mobileBudget(quality);
  const runRequest = useMemo(() => requestLimit(mobileBudget(0).tileConcurrency), []);
  const inflight = useRef(new Map<string, Promise<void>>());
  const wanted = useRef(new Set<string>());
  const generation = useRef(0);
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<{ key: string; collide: boolean }[]>([]);
  const cache = useRef<Map<string, Building[]>>(new Map());
  const keySet = useRef<Set<string>>(new Set());
  const sig = useRef("");
  const acc = useRef(0);

  useEffect(() => {
    alive.current = true;
    abort.current = new AbortController();
    fetch("tiles/manifest.json", { signal: abort.current.signal })
      .then((r) => { if (!r.ok) throw new Error("no manifest"); return r.json(); })
      .then(async (m: Manifest) => {
        // Build 002: resolve the GIS replacement map before any tile fetch so
        // duplicate filtering is deterministic from the first tile on.
        await ensureGisReplacements();
        if (!alive.current) return;
        keySet.current = new Set(m.keys); setManifest(m);
      })
      .catch(() => { if (alive.current) setFailed(true); });
    return () => { alive.current = false; generation.current++; abort.current?.abort(); cache.current.clear(); };
  }, []);

  useFrame((_, dt) => {
    const m = manifest;
    if (!m) return;
    acc.current += dt;
    if (acc.current < 0.4) return;
    acc.current = 0;

    const body = shared.car && shared.player ? (shared.player.isEnabled() ? shared.player : shared.car) : (shared.player ?? shared.car);
    const t = body?.translation();
    const px = t?.x ?? 0, pn = -(t?.z ?? 0); // north = -z
    const gx = Math.floor(px / m.tile), gn = Math.floor(pn / m.tile);

    const want: { key: string; collide: boolean }[] = [];
    for (let dx = -viewRadius(quality); dx <= viewRadius(quality); dx++) {
      for (let dn = -viewRadius(quality); dn <= viewRadius(quality); dn++) {
        const key = `${gx + dx}_${gn + dn}`;
        if (!keySet.current.has(key)) continue;
        want.push({ key, collide: Math.abs(dx) <= COLLIDE_R && Math.abs(dn) <= COLLIDE_R });
      }
    }
    const s = want.map((w) => w.key + (w.collide ? "*" : "")).sort().join(",");
    if (s === sig.current) return;
    sig.current = s;

    want.sort((a, b) => {
      const [ax, an] = a.key.split("_").map(Number), [bx, bn] = b.key.split("_").map(Number);
      return Math.hypot(ax - gx, an - gn) - Math.hypot(bx - gx, bn - gn);
    });
    wanted.current = new Set(want.map((w) => w.key));
    const token = ++generation.current;
    trimCache(cache.current, wanted.current, budget.tileCache);
    const missing = want.filter((w) => !cache.current.has(w.key));
    const load = (key: string) => {
      let pending = inflight.current.get(key);
      if (!pending) {
        const signal = abort.current?.signal;
        pending = runRequest(async () => {
          if (!alive.current || signal?.aborted || !wanted.current.has(key)) return;
          const response = await fetch(`tiles/b_${key}.json`, {signal});
          if (!response.ok) throw new Error("Building tile unavailable");
          const data = await response.json() as Building[];
          if (!alive.current || signal?.aborted || !wanted.current.has(key)) return;
          cache.current.set(key, withoutReplaced(key, data));
          trimCache(cache.current, wanted.current, budget.tileCache);
        }).finally(() => { inflight.current.delete(key); });
        inflight.current.set(key, pending);
      }
      return pending;
    };
    Promise.allSettled(missing.map((w) => load(w.key))).then((results) => {
      if (!alive.current || generation.current !== token) return;
      setActive(want.filter((w) => cache.current.has(w.key)));
      // Retry missing/failed tiles on a later streaming tick, not a hot loop.
      if (results.some((r) => r.status === "rejected") || want.some((w) => !cache.current.has(w.key))) sig.current = "";
    });
  });

  if (failed) return <Buildings buildings={fallback} center={center} />;

  // Fall River integration (2026-11-03): the tile manifest covers New
  // Bedford only. When the player is outside ALL tile coverage (the whole
  // Fall River district — no FR tiles exist), `want` is empty and no tile
  // ever becomes active, so without this the district would render zero
  // buildings. Fall back to the slice's own buildings, exactly as the
  // manifest-failure path does. New Bedford behavior is unchanged: its
  // slice buildings array is empty, so the fallback renders nothing there
  // (and tile areas still prefer tiles, since active is non-empty).
  if (manifest && active.length === 0 && fallback.length > 0) {
    return <Buildings buildings={fallback} center={center} />;
  }

  return (
    <group>
      {active.map(({ key, collide }) => {
        const b = cache.current.get(key);
        return b ? <Tile key={key} tileKey={key} buildings={b} colliders={collide} /> : null;
      })}
    </group>
  );
}
