import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Ground } from "./Ground";

// Real aerial imagery draped over the playable core — using Esri World Imagery
// public XYZ tiles, which need NO API key (attribution only). A block of tiles
// around the slice origin is fetched and each is placed as a ground plane at its
// true world position. CORS-clean (Esri sends Access-Control-Allow-Origin), so
// the WebGL textures aren't tainted. If a tile fails (offline / CORS / network),
// it's simply skipped and the procedural <Ground/> shows through — no regression.

const ZOOM = 18;       // ~0.45 m/px → crisp street-level aerial
const RADIUS = 5;      // tiles each way from origin → (2R+1)^2 = 121 tiles (~1.2km core)
const MAX_CONCURRENT = 6; // cap simultaneous tile fetches (network/GPU on mobile)
const TILE_URL = (z: number, x: number, y: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const D2R = Math.PI / 180;

function lonLatToTile(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2) * n;
  return { x, y };
}
// NW corner lon/lat of an integer tile
function tileToLonLat(x: number, y: number, z: number) {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) / D2R;
  return { lon, lat };
}

interface Tile { tex: THREE.Texture; x: number; z: number; size: number }

export function AerialGround({ origin }: { origin?: { lat: number; lon: number } }) {
  const [tiles, setTiles] = useState<Tile[]>([]);

  const mPer = useMemo(() => {
    if (!origin) return null;
    return { lat: 111320, lon: 111320 * Math.cos(origin.lat * D2R) };
  }, [origin]);

  useEffect(() => {
    if (!origin || !mPer) return;
    let alive = true;
    setTiles([]); // drop the previous location's tiles immediately (no wrong-place flash)
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const created: THREE.Texture[] = []; // every texture we make, for disposal
    const out: Tile[] = [];
    const c = lonLatToTile(origin.lon, origin.lat, ZOOM);
    const cx = Math.floor(c.x), cy = Math.floor(c.y);

    // build the job list, nearest-first, so the core fills in before the edges
    const jobs: { tx: number; ty: number; wx: number; wz: number; size: number; d: number }[] = [];
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        const tx = cx + dx, ty = cy + dy;
        const nw = tileToLonLat(tx, ty, ZOOM);
        const se = tileToLonLat(tx + 1, ty + 1, ZOOM);
        const midLon = (nw.lon + se.lon) / 2, midLat = (nw.lat + se.lat) / 2;
        const wx = (midLon - origin.lon) * mPer.lon;
        const wz = -(midLat - origin.lat) * mPer.lat;
        const size = Math.abs((se.lat - nw.lat) * mPer.lat); // square tile height in m
        jobs.push({ tx, ty, wx, wz, size, d: dx * dx + dy * dy });
      }
    }
    jobs.sort((a, b) => a.d - b.d);

    // progressive loader with a concurrency cap
    let next = 0, inFlight = 0;
    const pump = () => {
      while (alive && inFlight < MAX_CONCURRENT && next < jobs.length) {
        const job = jobs[next++];
        inFlight++;
        loader.load(
          TILE_URL(ZOOM, job.tx, job.ty),
          (t) => {
            inFlight--;
            if (!alive) { t.dispose(); return; }
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 8;
            created.push(t);
            out.push({ tex: t, x: job.wx, z: job.wz, size: job.size });
            setTiles([...out]);
            pump();
          },
          undefined,
          () => { inFlight--; pump(); /* tile failed → procedural ground shows through */ },
        );
      }
    };
    pump();

    return () => { alive = false; created.forEach((t) => t.dispose()); };
  }, [origin, mPer]);

  return (
    <>
      {/* base: collider + procedural fallback look, always present */}
      <Ground />
      {tiles.map((t, i) => (
        <mesh key={i} position={[t.x, 0.03, t.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[t.size, t.size]} />
          <meshBasicMaterial map={t.tex} toneMapped={false} />
        </mesh>
      ))}
      {/* shadow catcher: the aerial photo is unlit, so on its own nothing casts a
          shadow onto it and cars/peds/buildings look pasted-on. This transparent
          plane just above it renders only the shadows, grounding everything. The
          sun's shadow frustum follows the player, so only nearby shadows show. */}
      {tiles.length > 0 && (
        <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[4000, 4000]} />
          <shadowMaterial transparent opacity={0.38} />
        </mesh>
      )}
    </>
  );
}
