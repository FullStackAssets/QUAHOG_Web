import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CollisionBudget, GROUND_INTERVAL_S, WALL_INTERVAL_S } from "./raycastBudget";
import { TILE_MEMORY, applyTileMemoryCaps } from "./tileCaps";
import { buildTileBVH, disposeTileBVH, type BoundsNode } from "./tileBounds";
import {
  classifyTileError,
  classifyTileEvent,
  faultBlocksView,
  faultCopy,
  faultsMatch,
  isGoogleTileUrl,
  mergeFault,
  observeTileFetch,
  redactSecrets,
} from "./tileFault";
import { installTileLogGuard } from "./tileLog";
import { guardPluginLifecycle } from "./googleAuth";
import { IDLE_PAUSE_MS, advanceIdle, tileActivityFor } from "./frameLoop";
import { awayInto, firstPerson, followCam, forwardHit, groundY, sampleRoute } from "./follow";
import { headingToCompass, healthColor, interactionPrompt, minimapSegments } from "./hud";
import { applyContactDamage, contactLatch } from "./health";
import { clipTimeScale, gaitFor, gaitPose, gaitStep, pickClip } from "../actors/gait";
import { MODEL_FACE, MODEL_SCALE, MODEL_Y_OFF, modelHeightMeters, modelTuneSane } from "../world/modelTune";
import { pedLook } from "./pedLook";
import { VEHICLE_TYPES, trafficLook } from "./vehicleTypes";
import { lampIntensity } from "./lamps";
import { inputIsActive, setVirtualHold, setVirtualMove } from "../input";

describe("collision budget", () => {
  it("samples ground at 10 Hz and eases between hits", () => {
    const budget = new CollisionBudget();
    let n = 0;
    const measure = () => {
      n += 1;
      return n === 1 ? 10 : 20;
    };
    expect(budget.sampleGround("p", 0, measure, { priority: true })).toBe(10);
    expect(budget.sampleGround("p", 0.05, measure, { priority: true })).toBe(10);
    expect(n).toBe(1);
    expect(budget.sampleGround("p", GROUND_INTERVAL_S, measure, { priority: true })).toBe(10);
    expect(n).toBe(2);
    expect(budget.sampleGround("p", GROUND_INTERVAL_S + 0.05, measure, { priority: true })).toBe(15);
  });

  it("does not raycast every frame while the actor is moving", () => {
    const budget = new CollisionBudget();
    let n = 0;
    for (let i = 0; i <= 60; i++) {
      budget.beginFrame(i);
      budget.sampleGround("p", i / 60, () => {
        n += 1;
        return i;
      }, { priority: true });
    }
    // 60 fps over one second, quantized onto a 100 ms clock. Float steps land
    // on about 10 hits, never one per frame.
    expect(n).toBeGreaterThanOrEqual(9);
    expect(n).toBeLessThanOrEqual(12);
  });

  it("throttles wall probes to 20 Hz", () => {
    const budget = new CollisionBudget();
    let n = 0;
    for (let i = 0; i <= 60; i++) {
      budget.beginFrame(i);
      budget.sampleWall("w", i / 60, () => {
        n += 1;
        return 4;
      }, { priority: true, interval: WALL_INTERVAL_S });
    }
    expect(n).toBeGreaterThanOrEqual(15);
    expect(n).toBeLessThanOrEqual(22);
  });

  it("caps non-priority casts per frame and still serves a priority query", () => {
    const budget = new CollisionBudget({ maxPerFrame: 2 });
    budget.beginFrame(1);
    let n = 0;
    const measure = () => {
      n += 1;
      return 1;
    };
    budget.sampleGround("a", 0, measure);
    budget.sampleGround("b", 0, measure);
    expect(budget.sampleGround("c", 0, measure)).toBeNull();
    expect(n).toBe(2);
    expect(budget.sampleGround("player", 0, measure, { priority: true })).toBe(1);
    expect(n).toBe(3);
    budget.beginFrame(1);
    expect(budget.sampleGround("d", 0, measure)).toBeNull();
    budget.beginFrame(2);
    expect(budget.sampleGround("d", 0, measure)).toBe(1);
  });

  it("evicts the oldest cached ground id", () => {
    const budget = new CollisionBudget({ maxEntries: 2 });
    budget.sampleGround("a", 0, () => 1, { priority: true });
    budget.sampleGround("b", 0, () => 1, { priority: true });
    budget.sampleGround("c", 0, () => 1, { priority: true });
    let n = 0;
    budget.sampleGround("c", 0.01, () => {
      n += 1;
      return 1;
    }, { priority: true });
    budget.sampleGround("a", 0.01, () => {
      n += 1;
      return 1;
    }, { priority: true });
    expect(n).toBe(1);
  });

  it("retries a miss on the next interval instead of every call", () => {
    const budget = new CollisionBudget();
    let n = 0;
    const measure = () => {
      n += 1;
      return n < 2 ? null : 4;
    };
    expect(budget.sampleGround("p", 0, measure, { priority: true })).toBeNull();
    expect(budget.sampleGround("p", 0.05, measure, { priority: true })).toBeNull();
    expect(n).toBe(1);
    expect(budget.sampleGround("p", 0.1, measure, { priority: true })).toBe(4);
    expect(n).toBe(2);
  });
});

describe("tile memory caps", () => {
  it("keeps the byte and count windows ordered and sets depth", () => {
    expect(TILE_MEMORY.minBytes).toBeLessThan(TILE_MEMORY.maxBytes);
    expect(TILE_MEMORY.minCount).toBeLessThan(TILE_MEMORY.maxCount);
    expect(TILE_MEMORY.maxDepth).toBeGreaterThan(1);
    expect(TILE_MEMORY.errorTarget).toBe(32);
    const host: {
      errorTarget?: number;
      maxDepth?: number;
      lruCache: { minBytesSize: number; maxBytesSize: number; minSize: number; maxSize: number };
      downloadQueue: { maxJobs: number };
      parseQueue: { maxJobs: number };
    } = {
      lruCache: { minBytesSize: 0, maxBytesSize: 0, minSize: 0, maxSize: 0 },
      downloadQueue: { maxJobs: 0 },
      parseQueue: { maxJobs: 0 },
    };
    applyTileMemoryCaps(host);
    expect(host.maxDepth).toBe(TILE_MEMORY.maxDepth);
    expect(host.errorTarget).toBe(32);
    expect(host.lruCache).toMatchObject({
      minBytesSize: TILE_MEMORY.minBytes,
      maxBytesSize: TILE_MEMORY.maxBytes,
      minSize: TILE_MEMORY.minCount,
      maxSize: TILE_MEMORY.maxCount,
    });
    expect(host.downloadQueue.maxJobs).toBe(6);
    expect(host.parseQueue.maxJobs).toBe(3);
  });

  it("still sets depth when the cache objects are absent", () => {
    const host: { maxDepth?: number } = {};
    applyTileMemoryCaps(host);
    expect(host.maxDepth).toBe(TILE_MEMORY.maxDepth);
  });
});

describe("tile BVH walk", () => {
  it("builds once, skips an existing tree, and counts a throw as a skip", () => {
    const ok: BoundsNode = { geometry: { computeBoundsTree: vi.fn() } };
    const ready: BoundsNode = { geometry: { computeBoundsTree: vi.fn(), boundsTree: {}, disposeBoundsTree: vi.fn() } };
    const bad: BoundsNode = { geometry: { computeBoundsTree: () => { throw new Error("odd"); } } };
    const scene: BoundsNode = { traverse: (fn) => [ok, ready, bad].forEach(fn) };
    expect(buildTileBVH(scene)).toEqual({ built: 1, skipped: 2 });
    expect(ok.geometry?.computeBoundsTree).toHaveBeenCalledOnce();
    expect(ready.geometry?.computeBoundsTree).not.toHaveBeenCalled();
    expect(disposeTileBVH(scene)).toBe(1);
  });
});

describe("google tile faults", () => {
  it("classifies 401, 403, and 429 without copying a key into the summary", () => {
    const key = "AIzaSyABCDEFGHIJKLMNOPQRSTUV";
    const denied = classifyTileError({ status: 401, message: `nope key=${key}` });
    expect(denied.kind).toBe("unauthorized");
    expect(JSON.stringify(denied)).not.toContain(key);
    expect(classifyTileError({ status: 403 }).kind).toBe("unauthorized");
    expect(classifyTileError({ code: 429 }).kind).toBe("quota");
    expect(classifyTileEvent({ error: { status: 503 }, url: `https://tile.googleapis.com/x?key=${key}` }).kind).toBe("unavailable");
    expect(classifyTileError(new Error("Failed to fetch")).kind).toBe("unavailable");
    const generic = classifyTileError(new Error("boom"));
    expect(generic.kind).toBe("unknown");
    expect(faultCopy(generic).body.toLowerCase()).not.toContain("billing");
    expect(faultCopy(classifyTileError({ status: 403, message: "billing account disabled" })).body.toLowerCase()).toContain("billing");
  });

  it("keeps a quota fault visible and drops an unknown fault once tiles exist", () => {
    const quota = classifyTileError({ status: 429 });
    const unknown = classifyTileError(new Error("boom"));
    expect(mergeFault(quota, unknown)).toBe(quota);
    expect(faultsMatch(quota, classifyTileError({ status: 429 }))).toBe(true);
    expect(faultBlocksView(quota, 4)).toBe(true);
    expect(faultBlocksView(unknown, 4)).toBe(false);
    expect(faultBlocksView(unknown, 0)).toBe(true);
  });

  it("redacts keys and session tokens", () => {
    expect(redactSecrets("https://tile.googleapis.com/v1?key=AIzaSyABCDEFGHIJ&session=abc123")).toBe(
      "https://tile.googleapis.com/v1?key=…&session=…",
    );
  });

  it("observes only Google tile HTTP errors and does not record the request", async () => {
    const seen: string[] = [];
    const wrapped = observeTileFetch(async () => new Response("quota exceeded", { status: 429 }), (fault) => {
      seen.push(JSON.stringify(fault));
    });
    const secret = "AIzaSyTHISKEYMUSTNOTLEAK";
    await wrapped(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${secret}`);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("quota");
    expect(seen[0]).not.toContain(secret);
    const other: string[] = [];
    const quiet = observeTileFetch(async (input) => {
      const url = String(input);
      const status = url.includes("example.com") ? 500 : 200;
      return new Response("x", { status });
    }, (fault) => other.push(fault.kind));
    await quiet("https://example.com/tile");
    await quiet("https://tile.googleapis.com/ok");
    expect(other).toEqual([]);
    expect(isGoogleTileUrl("/root.json")).toBe(false);
  });

  it("ignores dispose before init and a dispose that throws", () => {
    let calls = 0;
    const plugin = guardPluginLifecycle({
      tiles: null as unknown,
      init(_tiles: unknown) { this.tiles = {}; },
      dispose() {
        calls += 1;
        if (!this.tiles) throw new Error("dispose before init");
      },
    });
    plugin.dispose();
    expect(calls).toBe(0);
    plugin.init({});
    plugin.dispose();
    plugin.dispose();
    expect(calls).toBe(1);

    const exploding = guardPluginLifecycle({
      init(_tiles: unknown) {},
      dispose() { throw new Error("torn down"); },
    });
    exploding.init({});
    expect(() => exploding.dispose()).not.toThrow();
  });
});

describe("tile log guard", () => {
  it("redacts and collapses repeated tile failures without dropping other errors", () => {
    const lines: unknown[][] = [];
    const sink = {
      error: (...args: unknown[]) => { lines.push(args); },
      warn: (...args: unknown[]) => { lines.push(args); },
    };
    const restore = installTileLogGuard(sink);
    sink.error("TilesRenderer : Failed to load tile at url \"https://tile.googleapis.com/a?key=AIzaSyABCDEFGHIJKLMNOP\"");
    sink.error("TilesRenderer : Failed to load tile at url \"https://tile.googleapis.com/b?key=AIzaSyABCDEFGHIJKLMNOP\"");
    sink.error("unrelated explosion");
    restore();
    sink.error("after restore");
    expect(lines).toHaveLength(3);
    expect(JSON.stringify(lines)).not.toContain("AIzaSyABCDEFGHIJKLMNOP");
    expect(lines[1]).toEqual(["unrelated explosion"]);
    expect(lines[2]).toEqual(["after restore"]);
  });
});

describe("frame loop", () => {
  it("pauses when hidden, and only when idle during play", () => {
    expect(tileActivityFor({ hidden: true, idleMs: 0, pauseWhenIdle: false })).toEqual({ loop: "demand", tilesEnabled: false });
    expect(tileActivityFor({ hidden: false, idleMs: IDLE_PAUSE_MS, pauseWhenIdle: true })).toEqual({ loop: "demand", tilesEnabled: true });
    expect(tileActivityFor({ hidden: false, idleMs: IDLE_PAUSE_MS - 1, pauseWhenIdle: true }).loop).toBe("always");
    expect(tileActivityFor({ hidden: false, idleMs: 60_000, pauseWhenIdle: false }).loop).toBe("always");
    expect(advanceIdle(0, 60_000, false)).toBe(1000);
    expect(advanceIdle(7_500, 1_000, false)).toBe(8_500);
    expect(advanceIdle(7_500, 60_000, false)).toBe(8_500);
    expect(advanceIdle(4_000, 10, true)).toBe(0);
  });
});

describe("scratch-vector helpers", () => {
  it("reuses caller vectors for route samples and separation", () => {
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 10)];
    const point = new THREE.Vector3();
    const dir = new THREE.Vector3();
    sampleRoute(pts, 10, 5, point, dir);
    expect(point.toArray()).toEqual([0, 0, 5]);
    expect(dir.toArray()).toEqual([0, 0, 1]);
    const out = new THREE.Vector3();
    expect(awayInto(out, new THREE.Vector3(2, 9, 0), new THREE.Vector3(0, 0, 0))).toBe(out);
    expect(out.x).toBeCloseTo(1);
    expect(out.y).toBe(0);
  });

  it("raycasts a shared caster for ground and walls without allocating per call", () => {
    const parent = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4));
    mesh.position.y = 1;
    parent.add(mesh);
    parent.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 5; i++) {
      expect(groundY(parent, parent, ray, 0, 0, up)).toBeCloseTo(2);
      expect(forwardHit(parent, parent, ray, new THREE.Vector3(0, 1, -5), new THREE.Vector3(0, 0, 1), 20)).toBeCloseTo(3, 1);
    }
    const camera = new THREE.PerspectiveCamera();
    followCam(camera, parent, up, new THREE.Vector3(1, 2, 3), 0.4, 7, 4, 1);
    firstPerson(camera, parent, up, new THREE.Vector3(1, 2, 3), 0.2, 1.7);
    expect(Number.isFinite(camera.position.x)).toBe(true);
    expect(camera.position.y).toBeCloseTo(3.7);
  });
});

describe("play HUD", () => {
  it("maps headings onto a compass where north is -z", () => {
    expect(headingToCompass(Math.PI)).toBe("N");
    expect(headingToCompass(0)).toBe("S");
    expect(headingToCompass(Math.PI / 2)).toBe("E");
    expect(headingToCompass(-Math.PI / 2)).toBe("W");
    expect(headingToCompass((Math.PI * 3) / 4)).toBe("NE");
    expect(headingToCompass(-Math.PI)).toBe("N");
  });

  it("projects a northbound road upward when the player faces north", () => {
    const segs = minimapSegments(
      [{ highway: "residential", points: [[0, 0], [0, 10]] }, { highway: "path", points: [[0, 0], [10, 0]] }],
      { x: 0, z: 0, heading: Math.PI },
      100,
      100,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].y2).toBeLessThan(segs[0].y1);
    const east = minimapSegments(
      [{ highway: "residential", points: [[0, 0], [10, 0]] }],
      { x: 0, z: 0, heading: Math.PI },
      100,
      100,
    );
    expect(east[0].x2).toBeGreaterThan(east[0].x1);
  });

  it("prompts for the car, a punch, and an empty health bar", () => {
    expect(interactionPrompt({ driving: true, nearCar: true, pedInReach: true, health: 40 })).toBe("E  exit");
    expect(interactionPrompt({ driving: false, nearCar: true, pedInReach: false, health: 100 })).toBe("E  enter car");
    expect(interactionPrompt({ driving: false, nearCar: false, pedInReach: true, health: 100 })).toBe("F  punch");
    expect(interactionPrompt({ driving: false, nearCar: false, pedInReach: false, health: 0 })).toMatch(/Hurt/);
    expect(healthColor(80)).not.toBe(healthColor(10));
  });
});

describe("phase A/B actor tuning", () => {
  it("splits idle, walk, and run around the speeds both worlds use", () => {
    expect(gaitFor(0, true)).toBe("idle");
    expect(gaitFor(4.5, false)).toBe("idle");
    expect(gaitFor(4.5)).toBe("walk");
    expect(gaitFor(6.5)).toBe("walk");
    expect(gaitFor(9)).toBe("run");
    expect(gaitFor(11)).toBe("run");
    expect(clipTimeScale("idle")).toBe(0);
    expect(clipTimeScale("run")).toBeGreaterThan(clipTimeScale("walk"));
    expect(gaitPose(0, "idle")).toEqual({ legL: 0, legR: 0, armL: 0, armR: 0, bob: 0 });
    expect(Math.abs(gaitPose(Math.PI / 2, "run").legL)).toBeGreaterThan(Math.abs(gaitPose(Math.PI / 2, "walk").legL));
    expect(gaitStep(1, "idle", 0.5)).toBe(1);
    expect(gaitStep(0, "run", 0.1)).toBeCloseTo(1.4);
    expect(pickClip(["Take 001"], "run")).toBe("Take 001");
    expect(pickClip(["idle", "Walk", "Run"], "walk")).toBe("Walk");
    expect(pickClip(["Walk"], "idle")).toBe("Walk");
  });

  it("leaves the rigged human scale inside a standing range", () => {
    expect(modelTuneSane()).toBe(true);
    expect(modelHeightMeters()).toBeCloseTo(MODEL_SCALE * 2);
    expect(MODEL_FACE).toBe(0);
    expect(MODEL_Y_OFF).toBe(0);
    expect(modelTuneSane(4, 0, 0)).toBe(false);
  });

  it("gives pedestrians and traffic distinct looks without leaving the body range", () => {
    const looks = [0, 1, 2, 3, 4, 5].map(pedLook);
    expect(new Set(looks.map((look) => look.shirt)).size).toBeGreaterThan(1);
    expect(looks.some((look) => look.hat)).toBe(true);
    expect(looks.some((look) => !look.hat)).toBe(true);
    for (const look of looks) {
      expect(look.scale).toBeGreaterThan(0.9);
      expect(look.scale).toBeLessThan(1.15);
      expect(look.build).toBeGreaterThan(0.85);
      expect(look.build).toBeLessThan(1.15);
    }
    const cars = [0, 1, 2].map(trafficLook);
    expect(new Set(cars.map((car) => car.type)).size).toBe(3);
    expect(VEHICLE_TYPES).toContain(cars[0].type);
  });

  it("forces headlights on when asked and flares the brakes", () => {
    const day = lampIntensity(1, false, false);
    const forced = lampIntensity(1, false, true);
    const braking = lampIntensity(1, true, false);
    expect(forced.head).toBeGreaterThan(day.head);
    expect(braking.tail).toBeGreaterThan(day.tail);
  });

  it("applies contact damage once per overlap", () => {
    expect(applyContactDamage(100, 1)).toBe(92);
    expect(applyContactDamage(3, 1)).toBe(0);
    expect(contactLatch(false, true)).toEqual({ latched: true, hit: true });
    expect(contactLatch(true, true)).toEqual({ latched: true, hit: false });
    expect(contactLatch(true, false)).toEqual({ latched: false, hit: false });
  });
});

describe("input activity", () => {
  it("tracks the virtual stick and releases it", () => {
    setVirtualMove(0, 0);
    setVirtualHold("ShiftLeft", false);
    expect(inputIsActive()).toBe(false);
    setVirtualMove(0.5, 0);
    expect(inputIsActive()).toBe(true);
    setVirtualMove(0, 0);
    setVirtualHold("ShiftLeft", true);
    expect(inputIsActive()).toBe(true);
    setVirtualHold("ShiftLeft", false);
    expect(inputIsActive()).toBe(false);
  });
});
