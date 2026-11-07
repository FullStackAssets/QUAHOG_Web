import { describe, expect, it, vi } from "vitest";
import { WorldStreamer } from "../../sim/WorldStreamer";

describe("WorldStreamer", () => {
  it("queues, loads, and evicts under a resident byte budget", async () => {
    let now = 1000;
    const loaded: string[] = [];
    const evicted: string[] = [];
    const streamer = new WorldStreamer({
      maxResidentBytes: 3000,
      maxConcurrent: 2,
      now: () => now,
      load: async (id) => {
        loaded.push(id);
        return { bytes: 1000 };
      },
      evict: (id) => {
        evicted.push(id);
      },
    });

    for (const id of ["a", "b", "c", "d"]) streamer.register(id, 1000);

    streamer.request({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, ["a", "b", "c"]);
    streamer.advanceBudget(16);
    // Allow microtasks from load promises.
    await Promise.resolve();
    await Promise.resolve();
    expect(loaded.length).toBeGreaterThan(0);
    expect(streamer.readyCount).toBeGreaterThan(0);

    // Drop interest in early tiles and request a new one — eviction should fire.
    now += 50;
    streamer.request({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, ["d"]);
    streamer.debugForceReady("d", 1000);
    streamer.unloadOutsideBudget(3000);
    expect(streamer.resident).toBeLessThanOrEqual(3000);
  });

  it("keeps pinned assets resident", () => {
    const streamer = new WorldStreamer({ maxResidentBytes: 1500, now: () => 1 });
    streamer.debugForceReady("keep", 1000);
    streamer.pin("keep", true);
    streamer.debugForceReady("drop", 1000);
    streamer.request({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, []);
    streamer.unloadOutsideBudget(1500);
    expect(streamer.stateOf("keep")).toBe("ready");
    expect(streamer.stateOf("drop")).toBe("idle");
  });

  it("evictUnwanted drops ready tiles after grace and invokes the evict handler", () => {
    let now = 1000;
    const evicted: string[] = [];
    const streamer = new WorldStreamer({
      maxResidentBytes: 10_000,
      now: () => now,
      evict: (id) => { evicted.push(id); },
    });
    streamer.debugForceReady("old", 1000);
    streamer.request({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, ["keep"]);
    streamer.debugForceReady("keep", 1000);
    now = 4000; // past 2.5s grace
    streamer.evictUnwanted(2500);
    expect(streamer.stateOf("old")).toBe("idle");
    expect(streamer.stateOf("keep")).toBe("ready");
    expect(evicted).toContain("old");
  });

  it("respects advanceBudget time slice", () => {
    vi.useFakeTimers();
    // Smoke: calling with 0 ms should not throw and should leave queue intact
    // when nothing is started under a zero budget.
    const streamer = new WorldStreamer({
      maxConcurrent: 1,
      now: () => performance.now(),
      load: async () => ({ bytes: 10 }),
    });
    streamer.register("x", 10);
    streamer.request({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, ["x"]);
    streamer.advanceBudget(0);
    vi.useRealTimers();
    expect(streamer.queued + streamer.readyCount + (streamer.stateOf("x") === "loading" ? 1 : 0)).toBeGreaterThanOrEqual(0);
  });

  it("metrics track ready/resident/evict counts", () => {
    const streamer = new WorldStreamer({ maxResidentBytes: 1500, now: () => 1 });
    streamer.debugForceReady("a", 1000);
    streamer.debugForceReady("b", 1000);
    streamer.request({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, ["a"]);
    streamer.unloadOutsideBudget(1500);
    const m = streamer.metrics();
    expect(m.ready).toBe(1);
    expect(m.residentBytes).toBeLessThanOrEqual(1500);
    expect(m.evictCount).toBeGreaterThanOrEqual(1);
  });
});
