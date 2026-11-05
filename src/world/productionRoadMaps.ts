import * as THREE from "three";
import { makeAsphaltTexture, makeNoiseNormal } from "./textures";

/** Shared production asphalt maps derived from the bundled P010 material swatch.
 * Always retain the original procedural material on texture load failure. */
let cached: { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture } | null = null;
export function productionRoadMaps() {
  if (cached) return cached;
  const base = makeAsphaltTexture(false);
  const noise = makeNoiseNormal();
  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = roughnessCanvas.height = 1;
  const ctx = roughnessCanvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1, 1);
  const road = {
    color: base.clone(),
    normal: noise.clone(),
    roughness: new THREE.CanvasTexture(roughnessCanvas),
  };
  const loader = new THREE.TextureLoader();
  for (const type of ["color", "normal", "roughness"] as const) {
    const t = road[type];
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    t.colorSpace = type === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    const filename = type === "color" ? "asphalt-albedo" : `asphalt-${type}`;
    loader.load(`/quahog-assets/production-roads/${filename}.png`, loaded => {
      t.image = loaded.image;
      t.needsUpdate = true;
      loaded.dispose();
    }, undefined, error => console.warn(`[QUAHOG road] procedural fallback ${type}:`, error));
  }
  cached = road;
  return cached;
}
