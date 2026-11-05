// Shared concurrency gate: fast-travel/quality changes cannot start additional
// parallel batches beyond the connection budget.
export function requestLimit(concurrency: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return <T>(task: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const start = () => {
      running++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        running--; waiting.shift()?.();
      });
    };
    if (running < concurrency) start(); else waiting.push(start);
  });
}

export function trimCache<T>(cache: Map<string, T>, keep: Set<string>, limit: number) {
  for (const key of cache.keys()) {
    if (cache.size <= limit) break;
    if (!keep.has(key)) cache.delete(key);
  }
}
