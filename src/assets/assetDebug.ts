import { getAssetNoticeSnapshot } from "./assetNotices";
import { meshoptStatus } from "./mainGameMeshopt";
import { MAIN_GAME_MODELS } from "./modelRegistry";
import { sim } from "../sim/SimRuntime";

export function assetDebugLine(): string {
  const m = sim.streamer.metrics();
  const residentMb = (m.residentBytes / (1024 * 1024)).toFixed(1);
  return (
    `meshopt ${meshoptStatus()} · models ${MAIN_GAME_MODELS.length}` +
    ` · notices ${getAssetNoticeSnapshot().length}` +
    ` · stream ${m.ready}r/${m.queued}q ${residentMb}MB` +
    ` p50 ${m.loadMsP50.toFixed(0)}ms evict ${m.evictCount}`
  );
}
