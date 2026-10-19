import { Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import {
  TilesRenderer,
  TilesPlugin,
  GlobeControls,
  TilesAttributionOverlay,
  EastNorthUpFrame,
} from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import { WGS84_ELLIPSOID } from "3d-tiles-renderer/three";
import { loadSlice, type Slice } from "../slice";
import { installInput } from "../input";
import { computeSpawn } from "./follow";
import { useContext } from "react";
import { TilesRendererContext } from "3d-tiles-renderer/r3f";
import { PlayerRig, TileNpcs, type View } from "./PlayWorld";
import { Ambient, type Weather } from "./Ambient";
import { TilesBVH } from "./bvh";
import { Radio } from "../audio/Radio";

// Mount Hope on Google Photorealistic 3D Tiles. Browser fetches tiles from
// tile.googleapis.com. Provide a Google Maps key (Map Tiles API) via
// ?key=YOUR_KEY or VITE_GOOGLE_MAPS_API_KEY.

const FALLBACK = { lat: 41.636, lon: -70.9205 };
const PED_CENTER: [number, number] = [-266, 100];

// Spawn picker spots. New Bedford uses the slice origin (so the OSM road network
// + NPCs line up); the others re-anchor the ENU frame on the landmark.
const SPOTS = [
  { name: "New Bedford", sub: "Seamen's Bethel", nb: true, lat: 41.636, lon: -70.9205 },
  { name: "Battleship Cove", sub: "USS Massachusetts", nb: false, lat: 41.7044, lon: -71.1641 },
  { name: "Lizzie Borden", sub: "230 Second St", nb: false, lat: 41.6993, lon: -71.1558 },
  { name: "Fall River", sub: "Downtown", nb: false, lat: 41.7015, lon: -71.1547 },
];

const KEY_STORE = "mh.googleMapsKey";

function getApiKey(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("key");
  if (fromUrl) {
    // persist a URL-provided key so it survives reloads/teleports
    try { localStorage.setItem(KEY_STORE, fromUrl); } catch { /* private mode */ }
    // scrub ?key= from the address bar so the secret doesn't linger in history,
    // referrers, or screenshots (it's saved now)
    try {
      params.delete("key");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash);
    } catch { /* no-op */ }
    return fromUrl;
  }
  const fromEnv = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (fromEnv) return fromEnv;
  try { return localStorage.getItem(KEY_STORE); } catch { return null; }
}

const WX: Record<Weather, { sun: number; sunColor: string; bg: string; fog: [number, number]; sky: boolean }> = {
  clear: { sun: 2.2, sunColor: "#fff6e8", bg: "#bcd4ea", fog: [600, 3200], sky: true },
  cloudy: { sun: 1.4, sunColor: "#eef0f4", bg: "#c4ccd6", fog: [380, 2000], sky: true },
  rain: { sun: 1.0, sunColor: "#cfd6dd", bg: "#9aa4ae", fog: [200, 1100], sky: false },
};

export function EarthApp() {
  const apiKey = typeof window !== "undefined" ? getApiKey() : null;
  const [slice, setSlice] = useState<Slice | null>(null);
  const [mode, setMode] = useState<"play" | "orbit">("orbit");
  const [view, setView] = useState<View>("third");
  const [spotIdx, setSpotIdx] = useState(0);
  const [weather, setWeather] = useState<Weather>("clear");
  const [ready, setReady] = useState(false);
  const [tilesProblem, setTilesProblem] = useState(false);

  useEffect(() => installInput(), []);
  useEffect(() => { loadSlice().then(setSlice).catch((e) => console.error(e)); }, []);
  useEffect(() => { setReady(false); setTilesProblem(false); }, [spotIdx, mode]); // re-gate on teleport
  useEffect(() => {
    const order: Weather[] = ["clear", "clear", "cloudy", "rain", "cloudy"];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % order.length; setWeather(order[i]); }, 45000);
    return () => clearInterval(id);
  }, []);

  if (!apiKey) return <NoKeyNotice />;

  const spot = SPOTS[spotIdx];
  const anchor = spot.nb && slice ? slice.origin : { lat: spot.lat, lon: spot.lon };
  const spawn = spot.nb && slice ? computeSpawn(slice) : { x: 0, z: 0, heading: 0 };
  const wx = WX[weather];

  return (
    <>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 0, 2e7], near: 0.5, far: 1e8 }}>
        <ContextGuard />
        <color attach="background" args={[wx.bg]} />
        {mode === "play" && <fog attach="fog" args={[wx.bg, wx.fog[0], wx.fog[1]]} />}
        {wx.sky && <Sky sunPosition={[120, 80, 60]} turbidity={weather === "cloudy" ? 8 : 3} rayleigh={1.2} />}
        <hemisphereLight args={["#dceaff", "#8a8678", 0.9]} />
        <directionalLight position={[120, 200, 80]} intensity={wx.sun} color={wx.sunColor} castShadow />

        <Suspense fallback={null}>
        {/* errorTarget: the higher it is, the coarser/faster tiles load. Street-
            level (play) cameras need this raised or the deepest LOD never streams
            in and the ground stays blank. */}
        <TilesRenderer key={apiKey} errorTarget={32}>
          <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey }]} />
          {/* BVH-accelerated collision raycasts + bounded tile memory (prevents
              the street-level hitching and GPU-OOM WebGL context loss). */}
          <TilesBVH />
          <TilesDiag onMissing={() => setTilesProblem(true)} onOk={() => setTilesProblem(false)} />

          {mode === "orbit" ? (
            <>
              <FlyTo lat={anchor.lat} lon={anchor.lon} />
              <GlobeControls enableDamping />
            </>
          ) : (
            (slice || !spot.nb) && (
              <EastNorthUpFrame key={spot.name} lat={anchor.lat} lon={anchor.lon} height={0}>
                <group rotation={[Math.PI / 2, 0, 0]}>
                  <PlayerRig key={spot.name} spawn={spawn} view={view} onReady={() => setReady(true)} />
                  {spot.nb && slice && <TileNpcs slice={slice} center={PED_CENTER} />}
                  <Ambient weather={weather} />
                </group>
              </EastNorthUpFrame>
            )
          )}

          <TilesAttributionOverlay />
        </TilesRenderer>
        </Suspense>
      </Canvas>

      <Hud
        mode={mode} setMode={setMode}
        view={view} setView={setView}
        spotIdx={spotIdx} setSpotIdx={setSpotIdx}
        weather={weather}
      />
      <Radio />
      {mode === "play" && !ready && !tilesProblem && <Loading />}
      {tilesProblem && <TilesProblem />}
    </>
  );
}

// Watches the tile renderer: logs load errors and, if no tiles have appeared
// after a grace period, flags a likely key/quota/billing problem (vs. our code).
function TilesDiag({ onMissing, onOk }: { onMissing: () => void; onOk: () => void }) {
  const tiles = useContext(TilesRendererContext);
  useEffect(() => {
    if (!tiles) return;
    const t = tiles as unknown as { group?: { children?: unknown[] }; addEventListener: (k: string, f: (e: unknown) => void) => void; removeEventListener: (k: string, f: (e: unknown) => void) => void };
    const onErr = (e: unknown) => console.warn("[tiles] load-error:", (e as { error?: unknown })?.error ?? e);
    t.addEventListener("load-error", onErr);
    const id = window.setInterval(() => {
      const n = t.group?.children?.length ?? 0;
      if (n > 0) { onOk(); } else { onMissing(); }
    }, 6000);
    return () => { t.removeEventListener("load-error", onErr); clearInterval(id); };
  }, [tiles, onMissing, onOk]);
  return null;
}

function TilesProblem() {
  return (
    <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 5, maxWidth: 460, background: "rgba(40,10,10,.9)", border: "1px solid #7a2c2c", borderRadius: 8, padding: "10px 14px", color: "#ffd9d9", font: "12px/1.5 'Courier New', monospace", textAlign: "center" }}>
      <b>Photoreal tiles aren't loading.</b> The map data isn't coming back from Google —
      almost always the API key: Map Tiles API not enabled, billing off, or over quota.
      Check the key in Google Cloud, then reload. (Movement still works; you're just on an empty surface.)
    </div>
  );
}

// Recover from (rather than hard-crash on) a lost WebGL context.
function ContextGuard() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const c = gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); console.warn("[earth] WebGL context lost — attempting restore"); };
    const onRestored = () => console.warn("[earth] WebGL context restored");
    c.addEventListener("webglcontextlost", onLost);
    c.addEventListener("webglcontextrestored", onRestored);
    return () => { c.removeEventListener("webglcontextlost", onLost); c.removeEventListener("webglcontextrestored", onRestored); };
  }, [gl]);
  return null;
}

function FlyTo({ lat, lon }: { lat: number; lon: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const d2r = Math.PI / 180;
    const ground = new THREE.Vector3();
    const eye = new THREE.Vector3();
    WGS84_ELLIPSOID.getCartographicToPosition(lat * d2r, lon * d2r, 0, ground);
    WGS84_ELLIPSOID.getCartographicToPosition((lat - 0.014) * d2r, lon * d2r, 1400, eye);
    camera.up.copy(ground).normalize();
    camera.position.copy(eye);
    camera.lookAt(ground);
    camera.updateProjectionMatrix();
  }, [camera, lat, lon]);
  return null;
}

function Hud(props: {
  mode: "play" | "orbit"; setMode: (m: "play" | "orbit") => void;
  view: View; setView: (v: View) => void;
  spotIdx: number; setSpotIdx: (i: number) => void;
  weather: Weather;
}) {
  const { mode, setMode, view, setView, spotIdx, setSpotIdx, weather } = props;
  const btn = (active: boolean): React.CSSProperties => ({
    pointerEvents: "auto", cursor: "pointer", border: "1px solid #2c3a5e",
    background: active ? "#7ad9ff" : "rgba(5,7,13,.8)", color: active ? "#04121a" : "#e7e0ff",
    font: "11px 'Courier New', monospace", fontWeight: 700, padding: "5px 9px", borderRadius: 6,
  });
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", font: "12px/1.5 'Courier New', monospace", color: "#e7e0ff" }}>
      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(5,7,13,.82)", border: "1px solid #2c3a5e", borderRadius: 8, padding: "10px 12px", maxWidth: 340 }}>
        <b style={{ color: "#7ad9ff" }}>MOUNT HOPE · photoreal</b>
        <div style={{ opacity: 0.85, margin: "3px 0 8px" }}>
          {mode === "play"
            ? `WASD move · Shift run · E car · weather: ${weather}`
            : "Orbit: drag to look, scroll to zoom."}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <button style={btn(mode === "play")} onClick={() => setMode("play")}>PLAY</button>
          <button style={btn(mode === "orbit")} onClick={() => setMode("orbit")}>ORBIT</button>
          <button style={btn(view === "third")} onClick={() => setView("third")}>3RD</button>
          <button style={btn(view === "first")} onClick={() => setView("first")}>1ST</button>
        </div>
        <div style={{ opacity: 0.7, fontSize: 10, marginBottom: 3 }}>TELEPORT</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SPOTS.map((sp, i) => (
            <button key={sp.name} style={btn(spotIdx === i)} onClick={() => { setSpotIdx(i); setMode("play"); }} title={sp.sub}>
              {sp.name.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ opacity: 0.55, fontSize: 9, marginTop: 8 }}>
          Tiles © Google · Character: CesiumMan © Cesium, CC-BY 4.0
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ background: "rgba(5,7,13,.82)", border: "1px solid #2c3a5e", borderRadius: 10, padding: "16px 22px", color: "#e7e0ff", font: "14px 'Courier New', monospace" }}>
        Streaming photoreal tiles… dropping you on the street.
      </div>
    </div>
  );
}

function NoKeyNotice() {
  const [val, setVal] = useState("");
  const save = () => {
    const k = val.trim();
    if (!k) return;
    try { localStorage.setItem(KEY_STORE, k); } catch { /* private mode */ }
    location.reload();
  };
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#e7e0ff", background: "#05070d", font: "14px/1.6 'Courier New', monospace", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 560 }}>
        <h2 style={{ color: "#7ad9ff" }}>Mount Hope (photoreal) — needs a Google API key</h2>
        <p>Renders Google's Photorealistic 3D Tiles. Needs a Google Maps Platform key with the <b>Map Tiles API</b> enabled.</p>
        <p style={{ textAlign: "left", background: "#0c0f1a", padding: 12, borderRadius: 8 }}>
          1. Google Cloud → enable <b>Map Tiles API</b> (and turn on billing).<br />
          2. Restrict the key to your site's domain.<br />
          3. Paste the key below — it's saved in this browser only.
        </p>
        {/* paste-and-go: persists to localStorage, no URL editing / rebuild needed */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            placeholder="Paste Google Maps API key"
            spellCheck={false} autoCapitalize="off" autoCorrect="off"
            style={{ flex: 1, background: "#0c0f1a", color: "#e7e0ff", border: "1px solid #2c3a5e", borderRadius: 6, padding: "8px 10px", font: "13px 'Courier New', monospace" }}
          />
          <button onClick={save} style={{ cursor: "pointer", border: "1px solid #2c3a5e", background: "#7ad9ff", color: "#04121a", fontWeight: 700, padding: "8px 16px", borderRadius: 6 }}>
            LAUNCH
          </button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, marginTop: 10 }}>
          Or open <code style={{ color: "#9fd8ff" }}>/earth.html?key=YOUR_KEY</code>, or set <code>VITE_GOOGLE_MAPS_API_KEY</code> at build time.
          Google bills per tile session and its terms govern use.
        </p>
      </div>
    </div>
  );
}
