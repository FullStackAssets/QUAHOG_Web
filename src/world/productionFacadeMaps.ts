import * as THREE from "three";
import { makeFacadeMaps, makeNoiseNormal } from "./textures";
import type { FacadeKind } from "./districtStyle";

/**
 * P010-grounded production material atlas. New files are stored locally under
 * public/; the procedural legacy maps remain usable if any HTTP request fails.
 * One shared set for streamed building tiles (no per-tile image downloads).
 */
interface FacadeMaps {
  albedo: THREE.Texture;
  emissive: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
}
const sharedMaps = new Map<FacadeKind, FacadeMaps>();

function fallbackRoughness(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  canvas.getContext("2d")!.fillStyle = "#ffffff";
  canvas.getContext("2d")!.fillRect(0, 0, 1, 1);
  const t = new THREE.CanvasTexture(canvas);
  t.needsUpdate = true;
  return t;
}

export function productionFacadeMaps(kind: FacadeKind = "brick"): FacadeMaps {
  const cached = sharedMaps.get(kind);
  if (cached) return cached;
  const legacy = makeFacadeMaps();
  const defaults: FacadeMaps = {
    albedo: legacy.albedo.clone(),
    emissive: legacy.emissive.clone(),
    normal: makeNoiseNormal().clone(),
    roughness: fallbackRoughness(),
  };
  const loader = new THREE.TextureLoader();
  const types = ["albedo", "emissive", "normal", "roughness"] as const;
  for (const type of types) {
    const texture = defaults[type];
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = type === "albedo" || type === "emissive" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    loader.load(`/quahog-assets/production-facades/${kind}-window-v4-${type}.png`, (loaded) => {
      texture.image = loaded.image;
      texture.needsUpdate = true;
      loaded.dispose();
    }, undefined, (error) => {
      console.warn(`[QUAHOG facade] fallback ${type}:`, error);
    });
  }
  sharedMaps.set(kind, defaults);
  return defaults;
}
