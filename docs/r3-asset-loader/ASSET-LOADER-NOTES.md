# Main-game asset loader (branch note)

This note belongs to the main-game Meshopt / GLB loader work. It is not the shared roadmap. `earth.html` and `src/earth/` are a separate path and were left alone.

## What was verified in this workspace

| Check | Result |
|---|---|
| `PRODUCTION-344-ASSET-INTEGRATION.md` | Not present. Searched the repo tree (skipped `node_modules`, `.git`, `dist`) and the candidate paths in `src/assets/handoffAssessment.ts`. |
| Handoff archive of 344 GLBs | Not attached. Nothing in the workspace was downloaded to stand in for it. A described count of 344 is recorded as an unverified external claim. |
| Loose GLBs under `public/models` | **3 files:** `CesiumMan.glb` (438044 B, uncompressed, 1 animation); `lizzie.glb` + `remington_borden.glb` (Borden pack, Meshopt required, no embedded walk cycle). Previews under `public/models/previews/`. |
| Tracked `quahog-web-preview 2.zip` (2026-10-19 preview build, already in the repo) | Listing only. **1 GLB:** `quahog-web-preview/models/CesiumMan.glb`, 438044 bytes. No markdown and no integration doc inside the zip. It was not extracted into `public/models`. |
| Music, tile, photo, and root `manifest.json` files | Left as they were. They are not the model manifest. |

`public/models/manifest.json` lists the three probed files. `handoffArchiveAttached` is false and `integrationDoc` is null. The loader registry in `src/assets/modelRegistry.ts` requests the same URLs. See also `docs/BORDEN-CONTENT.md`.

## Loader behavior

- The player and street pedestrians load character GLBs through `src/assets/mainGameGltf.ts` (CesiumMan by default; Lizzie / Remington Borden via Character menu or ped variety).
- The loader attaches three's `MeshoptDecoder` (`decodeGltfBufferAsync`, which waits on the WASM `ready` promise). drei's default `useGLTF` path installs three-stdlib's decoder instead, and that copy has no `decodeGltfBufferAsync`, so this path does not use `useGLTF`.
- Decoder init is one shared lifecycle. A failed init stays failed until **Retry assets**, so a crowd of characters cannot restart WASM in a loop.
- A GLB that uses `EXT_meshopt_compression` is parsed only when that decoder is ready or still starting. If the decoder is missing, unsupported, or failed, the character falls back to the existing primitive `Character` and the rest of the scene stays up.
- HTTP failures, truncated files, and GLTFLoader decode errors take the same fallback.
- In-flight loads for one URL are shared. Abort does not drop a newer load of the same URL. Cloned outfit materials are disposed with the instance; shared GLB geometry is not.
- Failures show a banner (and, with `?debug`, a meshopt/model line on the debug HUD) instead of only `console.error` plus a blank scene.
- `public/models/manifest.json` is checked against the loader registry at runtime (names and roles). Byte size and the meshopt flag are checked in unit tests against the files on disk, because the browser check does not download each GLB a second time.

## Tests

`src/__tests__/assetLoader.test.ts` covers the probe, decoder lifecycle, load plan, dedupe/abort/fallback session, manifest consistency, the unverified 344 claim, a real Meshopt encode/decode roundtrip (in-repo `meshoptimizer` encoder + three's decoder, not a production asset), and `ensureMainGameMeshopt()` reaching `ready`.

The roundtrip proves the decoder WASM in this runtime. Production Meshopt payloads are now also present (`lizzie.glb`, `remington_borden.glb`); the manifest test asserts their `meshoptRequired` flags.

`GLTFLoader.parseAsync` on the real `CesiumMan.glb`, with the decoder attached, returns a scene and one animation in Node. Node logs that it could not decode the embedded texture blob (no browser image decoder). A headless Chrome load of the dev server then fetched `/models/CesiumMan.glb` and `/models/manifest.json` with HTTP 200, showed a WebGL canvas, and after New Game showed no asset banner and no Meshopt or scene-stop notice.

## Remaining blockers

1. **No integration doc and no handoff archive.** The described 344 GLBs cannot be counted, hashed, or decoded here. When the archive and `PRODUCTION-344-ASSET-INTEGRATION.md` are actually in the tree, re-run the manifest test and fill `glb_count` only from that doc's explicit field. Do not paste 344 into the manifest to satisfy the claim.
2. **Borden models have no walk animation.** Meshopt decode works; idle/walk still falls through to paused/no action until authored clips land.
3. **CesiumMan provenance** is still the existing audit item (Cesium sample, CC-BY 4.0 is the in-file credit). The bytes were not modified.
4. **Browser/device pass** of the character on a real phone is outside this change. `earth.html` / Google 3D Tiles stays with its owner.
