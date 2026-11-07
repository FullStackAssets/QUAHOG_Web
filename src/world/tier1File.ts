import { isMobileDevice } from "../mobile/profile";

// iPhone Safari jetsam guard (2026-11-07): the game crashed on Nic's iPhone
// with the classic out-of-memory signature — WebGL canvas goes black while
// the DOM HUD stays alive, Safari reloads the page, it crashes again, then
// "A problem repeatedly occurred". The detail-pass _detail models are much
// heavier than the originals they replace (14 files: 2.30 MB on disk vs
// 0.69 MB for the originals — up to ~34x per file, e.g. whaling_museum
// 9,288 B -> 318,768 B; decoded GPU cost is several times the disk size).
// On mobile the original Tier-1 file mounts instead — same footprint,
// position and height, slightly less detail. Desktop is unaffected.
//
// The manifests are untouched: the swap happens at render time, so the
// manifest tests keep pinning the _detail files, and the fallback is safe
// only because every _detail entry has its original still on disk
// (tier1File.test.ts asserts that for all 14 entries).
export function tier1FileForDevice(file: string, mobile: boolean = isMobileDevice()): string {
  if (!mobile) return file;
  return file.endsWith("_detail.glb")
    ? file.slice(0, -"_detail.glb".length) + ".glb"
    : file;
}
