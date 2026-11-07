import { useContext, useLayoutEffect, useRef } from "react";
import { TilesRendererContext } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/core/plugins";
import { guardPluginLifecycle } from "./googleAuth";
import { applyTileMemoryCaps, type TileMemoryHost } from "./tileCaps";
import { observeTileFetch, type TileFault } from "./tileFault";
import { installTileLogGuard } from "./tileLog";

// Registers the Google auth plugin once per tiles session. Recommended settings
// are off so the plugin cannot overwrite errorTarget. Dispose is guarded, tile
// HTTP errors are classified without logging the request URL, and repeated
// renderer console errors are collapsed.

export function GoogleTilesAuth({ apiToken, onFault }: { apiToken: string; onFault: (fault: TileFault) => void }) {
  const tiles = useContext(TilesRendererContext);
  const onFaultRef = useRef(onFault);
  onFaultRef.current = onFault;

  useLayoutEffect(() => {
    if (!tiles || !apiToken) return;
    let cancelled = false;
    const restoreLog = installTileLogGuard(console);
    const baseFetch = window.fetch.bind(window);
    window.fetch = observeTileFetch(baseFetch, (fault) => {
      if (!cancelled) onFaultRef.current(fault);
    });

    const plugin = new GoogleCloudAuthPlugin({
      apiToken,
      useRecommendedSettings: false,
      autoRefreshToken: false,
    });
    const lifecycle = plugin as unknown as { init: (tiles: unknown) => void; dispose: () => void };
    guardPluginLifecycle(lifecycle);
    const host = tiles as unknown as {
      registerPlugin: (plugin: unknown) => void;
      unregisterPlugin: (plugin: unknown) => void;
    };
    host.registerPlugin(plugin);
    applyTileMemoryCaps(tiles as unknown as TileMemoryHost);

    return () => {
      cancelled = true;
      try { host.unregisterPlugin(plugin); } catch { lifecycle.dispose(); }
      window.fetch = baseFetch;
      restoreLog();
    };
  }, [tiles, apiToken]);

  return null;
}
