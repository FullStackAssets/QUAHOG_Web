// GoogleCloudAuthPlugin.dispose() calls `this.tiles.removeEventListener` with no
// null check. A teardown that races init (or a failed init) throws and can take
// the React tree down with it. This guard makes dispose a no-op until init has
// been entered, and swallows a dispose that still throws.

export interface PluginLifecycle {
  init: (tiles: unknown) => void;
  dispose: () => void;
}

export function guardPluginLifecycle<T extends PluginLifecycle>(plugin: T): T {
  const init = plugin.init.bind(plugin);
  const dispose = plugin.dispose.bind(plugin);
  let started = false;
  plugin.init = ((tiles: unknown) => {
    started = true;
    return init(tiles);
  }) as T["init"];
  plugin.dispose = (() => {
    if (!started) return;
    started = false;
    try { dispose(); } catch { /* session never finished attaching */ }
  }) as T["dispose"];
  return plugin;
}
