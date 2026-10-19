// Loader + types for the OSM-derived New Bedford blockout.
// 2D coordinates are [east, north] meters in slice-local space (origin = bbox
// center). In 3D we map east -> +x, north -> -z, up -> +y.

export interface Building {
  footprint: [number, number][];
  height: number;
  name?: string;
}
export interface Road {
  highway: string;
  width: number;
  name: string | null;
  points: [number, number][];
  bridge?: boolean;
  layer?: number;
}
export interface Landmark {
  name: string;
  kind: string;
  pos: [number, number];
  hero?: boolean;
}
export interface Slice {
  name: string;
  origin: { lat: number; lon: number };
  buildings: Building[];
  roads: Road[];
  water: [number, number][][];
  /** Land polygons (small islands/wharves the OSM water didn't cut out). Cut as
   *  holes in the water so they render as land. Optional — may be absent. */
  islands?: [number, number][][];
  /** Hurricane-barrier breakwater polylines (slice metres). Rendered as a stone
   *  dike and registered as drivable corridors over the water. Optional. */
  barrier?: [number, number][][];
  /** Real OSM green spaces (parks/gardens/grass/pitches), rendered as lawns. */
  parks?: [number, number][][];
  /** Real OSM parking lots, rendered as asphalt. */
  parking?: [number, number][][];
  /** Real OSM beaches, rendered as sand. */
  beach?: [number, number][][];
  /** Real OSM railway lines, rendered as ballast bed + rails. */
  rail?: [number, number][][];
  /** Real OSM cemeteries / wooded areas, rendered as flat ground. */
  cemetery?: [number, number][][];
  wood?: [number, number][][];
  /** Real OSM piers, rendered as raised wooden docks. */
  pier?: [number, number][][];
  /** Real OSM church centroids, marked with steeples. */
  church?: [number, number][];
  landmarks: Landmark[];
  attribution: string;
}

/** Convert a slice 2D point to a THREE world position tuple (y configurable). */
export const toWorld = (p: [number, number], y = 0): [number, number, number] => [
  p[0],
  y,
  -p[1],
];

export async function loadSlice(
  url = "slice-newbedford.json",
  onProgress?: (frac: number) => void,
): Promise<Slice> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    // Network failure / offline / CORS — surface a clear, actionable message
    // instead of the raw "Failed to fetch" so the start screen can show why.
    throw new Error(`could not fetch slice "${url}": ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new Error(`failed to load slice "${url}": HTTP ${res.status}`);
  // Stream the (multi-MB) slice so the start screen can show a real progress
  // bar. If the body isn't streamable or has no length, fall back to res.json()
  // and just report indeterminate progress.
  const total = Number(res.headers.get("content-length")) || 0;
  let slice: Slice;
  if (res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress?.(Math.min(0.95, got / total)); // reserve the tail for overlays
    }
    const buf = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { buf.set(c, o); o += c.length; }
    try {
      slice = JSON.parse(new TextDecoder().decode(buf)) as Slice;
    } catch (e) {
      throw new Error(`slice "${url}" is not valid JSON (${got} bytes): ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    try {
      slice = (await res.json()) as Slice;
    } catch (e) {
      throw new Error(`slice "${url}" is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // Validate the shape enough to fail loudly here (with a useful message)
  // rather than crashing deep in the renderer on a missing array.
  if (!slice || typeof slice !== "object" || !Array.isArray(slice.buildings) || !Array.isArray(slice.roads)) {
    throw new Error(`slice "${url}" is missing required fields (buildings/roads)`);
  }
  onProgress?.(0.95);
  // Optional island/wharf land polygons (islands-<name>.json). Absent file is
  // fine — just no holes get cut from the water.
  try {
    const ir = await fetch(url.replace("slice-", "islands-"));
    if (ir.ok) slice.islands = (await ir.json()) as [number, number][][];
  } catch { /* no islands file — leave undefined */ }
  // Optional hurricane-barrier breakwater geometry.
  try {
    const br = await fetch(url.replace("slice-", "barrier-"));
    if (br.ok) slice.barrier = (await br.json()) as [number, number][][];
  } catch { /* no barrier file — leave undefined */ }
  // Optional OSM area overlays (green spaces, parking, beaches).
  await Promise.all([
    ["parks-", "parks"], ["parking-", "parking"], ["beach-", "beach"], ["rail-", "rail"],
    ["cemetery-", "cemetery"], ["wood-", "wood"], ["pier-", "pier"], ["church-", "church"],
  ].map(async ([pre, key]) => {
    try {
      const r = await fetch(url.replace("slice-", pre));
      if (r.ok) (slice as unknown as Record<string, unknown>)[key] = await r.json();
    } catch { /* absent overlay file is fine */ }
  }));
  onProgress?.(1);
  return slice;
}
