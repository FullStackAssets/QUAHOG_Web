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

### In the tree (unit-tested; not a device measurement)
- **`errorTarget={32}`** — coarser than the library default of 16, left at 32
  because street-level cameras were going blank below that. The Google auth
  plugin's recommended settings (which would overwrite this to 20) are turned
  off. This is the checked-in value, not a profiled sweet spot.
- **`dpr={[1, 1.5]}`** — cap device-pixel-ratio so we don't render at 2–3× on
  hi-DPI screens.
- **WebGL context-loss guard** — `preventDefault()` on `webglcontextlost` so the
  browser can restore the context, with logging.
- **Fewer NPCs** (6 peds / 3 cars).
- **Shared raycaster + sample clock.** Player ground height is sampled at 10 Hz
  and eased between hits. Wall probes are sampled at 20 Hz. NPC ground samples
  are 2 Hz and share a per-frame cap. One `Raycaster` lives on `tileCollision`.
- **Scratch vectors** in `follow.ts` / `PlayWorld.tsx` for the camera, probes,
  and route samples.
- **LRU window and `maxDepth`.** Bytes 180–280 MB, 2500–3500 entries (the count
  floor has to sit under the ceiling or the cache never evicts by count),
  `maxDepth` 24. In this library that stops refinement when
  `tile.depth + 1 >= 24`. Download/parse queues are capped at 6 and 3.
- **BVH on `load-model`** via `three-mesh-bvh` (`firstHitOnly`, dispose on
  `dispose-model`). `TileCompressionPlugin` is not enabled: it quantizes
  positions, which is a visual change, and it does not build the raycast tree.
- **Hidden tab** sets `frameloop="demand"` and disables tile updates. **Idle
  play** (8 s with no key, pointer, or virtual stick) drops to on-demand frames
  but leaves tile updates enabled so an in-flight load can still invalidate
  once.
- **Google faults.** 401/403 and 429 get a specific overlay. Other failures get
  a neutral message and do not mention billing unless Google's own body did.
  Request URLs are not copied into the overlay. Repeated tile console errors
  are collapsed and key-like strings are stripped. Auth-plugin `dispose()` is
  a no-op until init and ignores a throw.

### Still a device gate (not claimed fixed)
- A real iPhone / desktop session against live Google tiles: context loss, heat,
  and whether `maxDepth` 24 or `errorTarget` 32 is too coarse or still too heavy.
- A live 401 and 429 from this key's project. The classifier is tested against
  fake responses only.
- No frame-time, memory, or crash-rate number is reported from this pass.

> If a device run still loses the WebGL context, raise `errorTarget` (in
> `TILE_MEMORY`) before adding geometry. That knob is coarser as it goes up.

---

## 4. Feature roadmap (next steps)

**Phase A — make it solid & legible**
- Stability pass above is in the photoreal code and unit-tested. A live tile
  session is still required before calling it done.
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
