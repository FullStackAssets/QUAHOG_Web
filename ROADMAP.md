# Mount Hope — Roadmap & Stability Plan

Status of the **photoreal (Google 3D Tiles) build** at `/earth.html?key=…`, why it
can crash, how we make it solid, and what's next.

---

## 1. Where we are

**Two builds share the repo:**
- `index.html` — the original **stylized/procedural** world (OSM blockout). Stable, boxy by design.
- `earth.html` — the **photoreal** world (Google 3D Tiles). The chosen direction.

**Photoreal build already has:** player + drivable car, wall collision, NPC peds
+ traffic on real roads, melee (punch/KO/kill), 1st/3rd-person, spawn picker
(New Bedford / Battleship Cove / Lizzie Borden / Fall River), weather + clouds +
planes + rain, a rigged human model (CesiumMan), and the radio (talk hosts +
music + station switching).

---

## 2. Why the photoreal build crashes (diagnosis)

Most likely causes, in order of probability:

1. **GPU memory / WebGL context loss.** Google 3D Tiles stream *huge* amounts of
   geometry + textures. At high detail the GPU runs out of memory and the browser
   kills the WebGL context → black screen / "Rats! WebGL hit a snag" / tab crash.
2. **Raycast cost against streaming tiles.** Ground/wall collision raycasts run
   `intersectObject(tiles.group, true)` against every loaded tile mesh, every
   frame, for the player + car + NPCs. As tiles load this gets expensive and can
   stall frames.
3. **Per-frame garbage.** The movement/camera/collision code allocates many
   `THREE.Vector3`/`Quaternion` objects each frame → GC pauses → jank, and under
   pressure, instability.
4. **Tab backgrounding / context not resumed**, and **AudioContext** needing a
   user gesture (handled, but worth noting).

## 3. Stability fixes

### ✅ Applied now (this commit)
- **`errorTarget={16}`** on the tiles renderer — coarser tiles = dramatically less
  geometry/VRAM (the single biggest crash lever). Tune down toward 8 for more
  detail once stable, up toward 24 if still crashing.
- **`dpr={[1, 1.5]}`** — cap device-pixel-ratio so we don't render at 2–3× on
  hi-DPI screens (huge fill-rate/VRAM saving).
- **WebGL context-loss guard** — `preventDefault()` on `webglcontextlost` so the
  browser can *restore* instead of dying, with logging.
- **Fewer NPCs** (6 peds / 3 cars) — fewer per-frame tile raycasts + skinned clones.

### ▶️ Next stability pass (recommended, not yet done)
- **Throttle + cache collision raycasts**: ground-follow at ~10 Hz with height
  interpolation instead of every frame; reuse one shared `Raycaster`.
- **Reuse scratch vectors** in `follow.ts` / `PlayWorld.tsx` hot paths (kill
  per-frame allocations).
- **Cap the tiles LRU cache** (`lruCache.maxBytesSize`) and **`maxDepth`** to hard-
  bound memory.
- **Add a BVH** (`three-mesh-bvh` + the tiles `TileCompressionPlugin` /
  `MeshBVH`) so raycasts are O(log n) instead of scanning every triangle.
- **Pause rendering when the tab is hidden** and after the player is idle
  (on-demand `invalidate()` / `frameloop="demand"`).
- **Graceful key/quota errors**: surface Google 401/429 (bad key / over quota) as
  a friendly overlay instead of a console explosion.

> If it still crashes after the applied fixes, raise `errorTarget` to 24 first —
> that's the fastest knob.

---

## 4. Feature roadmap (next steps)

**Phase A — make it solid & legible**
- Finish the stability pass above.
- Tune the human model (`SCALE` / `FACE` / `Y_OFF` in `ModelCharacter.tsx`) once
  visible; add idle vs walk vs run animation states.
- HUD pass: minimap/compass, health, interaction prompts.

**Phase B — real actors & vehicles**
- Swap car silhouettes for CC0 GLB car models (generic sedan/SUV/sports skinned
  to our 5 names); shadows + headlight glow at night.
- A few distinct pedestrian models (not all the same person).

**Phase C — gameplay systems**
- Mission framework (objective markers, triggers, states, rewards) — see the
  Characters & Missions bible (next deliverable).
- Wanted/heat system; basic police response.
- Wallet/economy + property acquisition hooks (from the GDD).

**Phase D — content**
- Build out the cast + the opening mission (New Bedford fish-pier arrival) and the
  Fall River threads (Lizzie Borden, Battleship Cove).
- More radio: extra stations, longer scripts, music variety, ad reads.

**Phase E — polish**
- Day/night cycle tied to weather; better water/reflection; sound effects
  (footsteps, engine, punches, ambient gulls/harbor); save/load.

---

## 5. Immediate next two deliverables
1. **Stability pass** (Phase A) so the photoreal build stops crashing for good.
2. **Characters & Missions bible** (design doc) to drive Phase C/D.
