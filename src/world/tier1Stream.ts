// Distance streaming for Tier-1 models (2026-11-07 real fix for the iPhone
// Safari jetsam crash — Nic, 2026-11-07 11:34 EST).
//
// Diagnosis (parent-verified): the game crashed ~5s after spawning at the
// Bethel, then — after the quick fix trimmed the _detail models — while
// DRIVING AROUND. Memory fills over time as new areas load in and nothing
// ever unloads: CullByDistance only sets visible=false, the three mount
// components mounted all 126 tier1 models at once, and PackGLB never
// disposed anything on unmount. The unload side is the critical part:
// models behind the player must actually leave GPU memory, or any longer
// drive fills the phone up to the ceiling again.
//
// Radii (measured from the manifests, not guessed):
// - LOAD_RADIUS 150 m: at the Bethel spawn (-256, 106) 41 of the 83 NB
//   models mount (vs 83 before); the densest point anywhere downtown
//   holds 42 within 150 m. Driving at the 32 m/s max speed, 150 m is
//   ~4.7 s of travel — models have time to fetch + decode before they
//   are close enough to matter.
// - UNLOAD_RADIUS 250 m: 100 m hysteresis band. A model mounts at <=150 m
//   and unmounts only past 250 m, so driving back and forth across the
//   boundary cannot flip it every frame.
// - MAX_MOUNTED 48: hard cap on the resident set. It only ever trims
//   models in the hysteresis band (never a within-load model): the
//   densest real cluster within load radius is 42, so the cap has 6 band
//   slots of headroom. If a future manifest ever packed >48 models
//   within load radius, the cap degrades to a soft cap (documented in
//   nextStreamedIds) — the manifests pin the 42 number in the tests.
// - MOUNTS_PER_FRAME 4 (nearest first): stages the spawn burst. The 41
//   spawn models mount over ~11 frames (~0.4 s at 30 fps) instead of all
//   decoding in the same frames — lag was worst at spawn.
// - UNMOUNTS_PER_FRAME 8 (farthest first): unmounts drain fast after a
//   teleport or a fast drive; dispose of one small GLB is microseconds,
//   so 8/frame cannot hitch.
//
// Honest limits:
// - FR fast-travel spawn mounts 0 tier1 models: the nearest FR model
//   (ships_cove) is 202 m from the FR spawn, outside the load radius.
//   Generic extrusions still render there, and landmarks pop in as the
//   player drives within 150 m of them.
// - Pop-in: a model appears when the camera comes within 150 m. At that
//   distance on a phone screen it is small; the admission cap means a
//   fast drive can lag a mount by a frame or two.
// - This streams the tier1 models only. The streaming tile system already
//   trims its own cache, and the 4.3 MB NB slice JSON.parse is a single
//   load-time hitch (sub-second) — both outside this module's scope.
import { tier1FileForDevice } from "./tier1File";

/** Minimal shape a mount manifest entry must satisfy to be streamed. All
 *  three manifests (DowntownTier1Model, NbTier1Model, Tier1Model) are
 *  assignable to this: id + world position + file, nothing else. */
export interface Tier1StreamEntry {
  id: string;
  position: [number, number, number];
  file: string;
}

/** Mount a model's GLB when the camera comes within this distance (m). */
export const TIER1_STREAM_LOAD_RADIUS = 150;
/** Unmount (and dispose) a mounted model only past this distance (m). */
export const TIER1_STREAM_UNLOAD_RADIUS = 250;
/** Hard cap on mounted tier1 models. See the header: only trims the
 *  hysteresis band while the densest within-load cluster is 42. */
export const TIER1_STREAM_MAX_MOUNTED = 48;
/** New mounts admitted per rendered frame, nearest first (spawn staging). */
export const TIER1_STREAM_MOUNTS_PER_FRAME = 4;
/** Unmounts per rendered frame, farthest first (teleport drain). */
export const TIER1_STREAM_UNMOUNTS_PER_FRAME = 8;

/** Horizontal distance (m) between the camera and a model's position. */
export function tier1StreamDistance(
  camX: number,
  camZ: number,
  modelX: number,
  modelZ: number,
): number {
  return Math.hypot(camX - modelX, camZ - modelZ);
}

/**
 * One streaming tick. Pure function: given the currently mounted ids, the
 * manifest entries and the camera position, returns the mounted set for
 * the next frame — applying, in order:
 * 1. hysteresis (mount <= LOAD, unmount only > UNLOAD),
 * 2. the per-frame mount/unmount budgets,
 * 3. the MAX_MOUNTED cap (evicts the farthest mounted models that are
 *    beyond the load radius; never a within-load model).
 * Returns `prev` itself (same reference) when nothing changes, so a React
 * setState with the result bails out of re-rendering.
 *
 * Soft-cap note: if more than MAX_MOUNTED models were ever within load
 * radius at once, the cap cannot evict them (they are all visible core)
 * and the set stays over the cap. The real manifests cap that case at 42
 * (pinned by tier1Stream.test.ts); a future manifest that broke it would
 * need a smaller load radius, not a bigger cap.
 */
export function nextStreamedIds(
  prev: ReadonlySet<string>,
  entries: readonly Tier1StreamEntry[],
  camX: number,
  camZ: number,
): ReadonlySet<string> {
  const dist = new Map<string, number>();
  for (const e of entries) {
    dist.set(e.id, tier1StreamDistance(camX, camZ, e.position[0], e.position[2]));
  }
  const d = (id: string): number => dist.get(id) ?? Infinity;

  // Must-drop: mounted and past the unload radius, farthest first.
  const mustDrop = [...prev]
    .filter((id) => d(id) > TIER1_STREAM_UNLOAD_RADIUS)
    .sort((a, b) => d(b) - d(a));
  // Must-mount: unmounted and within the load radius, nearest first.
  const mustMount = entries
    .filter((e) => !prev.has(e.id) && d(e.id) <= TIER1_STREAM_LOAD_RADIUS)
    .sort((a, b) => d(a.id) - d(b.id));

  const next = new Set<string>(prev);
  let dropped = 0;
  for (const id of mustDrop) {
    if (dropped >= TIER1_STREAM_UNMOUNTS_PER_FRAME) break;
    next.delete(id);
    dropped++;
  }
  let mounted = 0;
  for (const e of mustMount) {
    if (mounted >= TIER1_STREAM_MOUNTS_PER_FRAME) break;
    next.add(e.id);
    mounted++;
  }
  // Hard cap: evict the farthest mounted models that are beyond the load
  // radius (the hysteresis band) until the set fits. The unmount budget
  // covers these too, so a teleport drains over a few frames, not one.
  if (next.size > TIER1_STREAM_MAX_MOUNTED) {
    const evictable = [...next]
      .filter((id) => d(id) > TIER1_STREAM_LOAD_RADIUS)
      .sort((a, b) => d(b) - d(a));
    for (const id of evictable) {
      if (next.size <= TIER1_STREAM_MAX_MOUNTED) break;
      if (dropped >= TIER1_STREAM_UNMOUNTS_PER_FRAME) break;
      next.delete(id);
      dropped++;
    }
  }

  if (next.size === prev.size) {
    let same = true;
    for (const id of next) {
      if (!prev.has(id)) {
        same = false;
        break;
      }
    }
    if (same) return prev;
  }
  return next;
}

/** Run ticks at a fixed camera position until the mounted set is stable
 *  (or maxFrames). Used by the tests to pin the settled spawn/drive sets;
 *  the live component converges the same way over real frames. */
export function settleStreamedIds(
  entries: readonly Tier1StreamEntry[],
  camX: number,
  camZ: number,
  maxFrames = 200,
): ReadonlySet<string> {
  let cur: ReadonlySet<string> = new Set();
  for (let i = 0; i < maxFrames; i++) {
    const next = nextStreamedIds(cur, entries, camX, camZ);
    if (next === cur) return next;
    cur = next;
  }
  return cur;
}

/** Resolve a manifest file through the quick-fix device fallback, so a
 *  streamed mount on mobile still falls back from _detail to the original
 *  (and desktop still mounts the _detail file). The manifests are
 *  untouched; the swap happens here, at render time. */
export function resolveStreamedTier1File(file: string, mobile?: boolean): string {
  return tier1FileForDevice(file, mobile);
}
