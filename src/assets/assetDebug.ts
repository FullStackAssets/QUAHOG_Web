import { getAssetNoticeSnapshot } from "./assetNotices";
import { meshoptStatus } from "./mainGameMeshopt";
import { MAIN_GAME_MODELS } from "./modelRegistry";

export function assetDebugLine(): string {
  return `meshopt ${meshoptStatus()} · models ${MAIN_GAME_MODELS.length} · asset notices ${getAssetNoticeSnapshot().length}`;
}
