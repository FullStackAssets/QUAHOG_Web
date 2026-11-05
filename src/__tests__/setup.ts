// Minimal in-memory localStorage so the zustand stores' save()/load() paths
// (which are wrapped in try/catch anyway) exercise real serialization in tests.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  key(i: number): string | null { return Array.from(this.m.keys())[i] ?? null; }
  get length(): number { return this.m.size; }
}

if (typeof globalThis.localStorage === "undefined") {
  // Assign the stub to the global for the Node test env.
  (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
}
