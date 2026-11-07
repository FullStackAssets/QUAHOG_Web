// URLs the main game actually requests. earth.html does not use this list.
// Keep it aligned with public/models/manifest.json — the unit test fails when
// the registry, the manifest, and the files on disk disagree.

export type ModelRole = "character" | "prop" | "vehicle" | "building" | "other";
export type ModelFallback = "primitive-character";

export type CharacterModelId = "cesium-man" | "lizzie" | "remington-borden";

export type RegistryModel = {
  id: CharacterModelId | string;
  file: string;
  url: string;
  role: ModelRole;
  fallback: ModelFallback;
  /** Display name in the character menu. */
  label?: string;
  /** Optional UI preview under /models/previews/. */
  preview?: string;
  /** World scale applied by ModelCharacter. */
  scale?: number;
  /** License / provenance note for credits. */
  credit?: string;
};

export const CHARACTER_MODEL_URL = "/models/CesiumMan.glb";

export const MAIN_GAME_MODELS: readonly RegistryModel[] = [
  {
    id: "cesium-man",
    file: "CesiumMan.glb",
    url: CHARACTER_MODEL_URL,
    role: "character",
    fallback: "primitive-character",
    label: "Dockhand",
    scale: 0.92,
    credit: "CesiumMan © Cesium — CC-BY 4.0",
  },
  {
    id: "lizzie",
    file: "lizzie.glb",
    url: "/models/lizzie.glb",
    role: "character",
    fallback: "primitive-character",
    label: "Lizzie",
    preview: "/models/previews/lizzie_preview.png",
    scale: 1.0,
    credit: "Lizzie — original Mount Hope / Borden content pack",
  },
  {
    id: "remington-borden",
    file: "remington_borden.glb",
    url: "/models/remington_borden.glb",
    role: "character",
    fallback: "primitive-character",
    label: "Remington Borden",
    preview: "/models/previews/remington_borden_preview.png",
    scale: 1.0,
    credit: "Remington Borden — original Mount Hope / Borden content pack",
  },
];

export const CHARACTER_MODELS = MAIN_GAME_MODELS.filter((m) => m.role === "character");

export function registryModelByUrl(url: string): RegistryModel | undefined {
  return MAIN_GAME_MODELS.find((model) => model.url === url);
}

export function registryModelById(id: string): RegistryModel | undefined {
  return MAIN_GAME_MODELS.find((model) => model.id === id);
}

export function characterModelUrl(id: CharacterModelId | string | undefined): string {
  return registryModelById(id ?? "cesium-man")?.url ?? CHARACTER_MODEL_URL;
}
