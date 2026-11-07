// URLs the main game actually requests. earth.html does not use this list.
// Keep it aligned with public/models/manifest.json — the unit test fails when
// the registry, the manifest, and the files on disk disagree.

export type ModelRole = "character" | "prop" | "vehicle" | "building" | "other";
export type ModelFallback = "primitive-character";

export type RegistryModel = {
  id: string;
  file: string;
  url: string;
  role: ModelRole;
  fallback: ModelFallback;
};

export const CHARACTER_MODEL_URL = "/models/CesiumMan.glb";

export const MAIN_GAME_MODELS: readonly RegistryModel[] = [
  {
    id: "cesium-man",
    file: "CesiumMan.glb",
    url: CHARACTER_MODEL_URL,
    role: "character",
    fallback: "primitive-character",
  },
];

export function registryModelByUrl(url: string): RegistryModel | undefined {
  return MAIN_GAME_MODELS.find((model) => model.url === url);
}
