/**
 * Process-wide simulation coordinator for Mount Hope.
 * Owns road graph, objective nav, camera rig, streamer, and frame budget.
 * React components read/write through this singleton (no per-frame React state).
 */

import type { Road, Slice } from "../slice";
import type { Quality } from "../quality";
import { FrameBudget } from "./FrameBudget";
import { CameraRig } from "./CameraRig";
import { ObjectiveNav } from "./ObjectiveNav";
import { RoadGraph } from "./RoadGraph";
import { PedGraph } from "./PedGraph";
import { MissionRuntime } from "./MissionRuntime";
import { WorldStreamer } from "./WorldStreamer";
import { GameLoop } from "./GameLoop";
import { rng } from "./Rng";
import { ClockWeather } from "./ClockWeather";
import { manifestFromSlice, validateManifest, type WorldManifest } from "./WorldManifest";
import { streamPreset, type StreamPreset } from "./mobilePresets";
import { emitTelemetry } from "../telemetry/schema";
import type { CameraMode, NavGuidance, Vec2, Vec3 } from "./types";

class SimRuntime {
  readonly camera = new CameraRig();
  readonly nav = new ObjectiveNav();
  readonly streamer = new WorldStreamer();
  readonly missions = new MissionRuntime();
  readonly clock = new ClockWeather();
  readonly loop = new GameLoop({
    onOverrun: () => emitTelemetry("sim.loop.overrun", { acc: this.loop.stats.accHighWater }),
  });
  readonly rng = rng;
  budget = FrameBudget.forQuality(1);
  preset: StreamPreset = streamPreset(1);
  quality: Quality = 1;
  graph: RoadGraph | null = null;
  pedGraph: PedGraph | null = null;
  manifest: WorldManifest | null = null;
  private navAcc = 0;
  private lastGuidance: NavGuidance = {
    path: null,
    nextDir: null,
    distanceRemaining: 0,
    wrongWay: false,
    bearing: 0,
  };
  private boundSlice: string | null = null;

  configureQuality(q: Quality): void {
    this.quality = q;
    this.preset = streamPreset(q);
    this.budget = FrameBudget.forQuality(q);
    this.streamer.maxResidentBytes = this.preset.maxResidentBytes;
    this.streamer.maxConcurrent = this.preset.maxConcurrent;
    this.streamer.streamRadius = this.preset.streamRadius;
  }

  /** Build / rebuild road + sidewalk graphs when a slice loads. */
  bindSlice(slice: Slice): void {
    if (this.boundSlice === slice.name && this.graph && this.pedGraph) return;
    this.boundSlice = slice.name;
    const roads = slice.roads as Road[];
    this.graph = RoadGraph.fromRoads(roads);
    this.pedGraph = PedGraph.fromRoads(roads);
    this.nav.setGraph(this.graph);
    this.manifest = manifestFromSlice(slice);
    const v = validateManifest(this.manifest);
    if (!v.ok) console.warn("[WorldManifest]", v.errors.join("; "));
  }

  /** Active road graph (null until the slice binds). */
  get roadGraph(): RoadGraph | null {
    return this.graph;
  }

  /** Sidewalk graph for pedestrian routing. */
  get sidewalkGraph(): PedGraph | null {
    return this.pedGraph;
  }

  setNavGoal(goal: Vec2 | null): void {
    this.nav.setGoal(goal);
  }

  get guidance(): NavGuidance {
    return this.lastGuidance;
  }

  beginFrame(): void {
    this.budget.beginFrame();
  }

  /**
   * Tick navigation at a budgeted rate; returns latest guidance.
   */
  tickNav(dt: number, actor: Vec2, heading: number, speed: number): NavGuidance {
    this.navAcc += dt;
    const period = 1 / this.preset.navHz;
    if (this.navAcc >= period || !this.lastGuidance.path) {
      this.navAcc = 0;
      this.lastGuidance = this.nav.update(actor, heading, speed);
    } else if (this.lastGuidance.nextDir) {
      // Cheap wrong-way / bearing refresh between full repaths.
      this.lastGuidance = this.nav.update(actor, heading, speed);
    }
    return this.lastGuidance;
  }

  tickStreamer(
    position: Vec3,
    velocity: Vec3,
    idsInRange: Iterable<string>,
  ): void {
    this.streamer.request(position, velocity, idsInRange);
    const work = Math.min(this.preset.streamWorkMs, this.budget.remainingMs());
    if (work > 0.2) this.streamer.advanceBudget(work);
    this.streamer.unloadOutsideBudget(this.preset.maxResidentBytes);
    this.streamer.evictUnwanted(this.quality === 0 ? 1500 : 2500);
  }

  tickCamera(
    dt: number,
    follow: Vec3,
    heading: number,
    mode: CameraMode,
    speed: number,
    baseFov: number,
    shake: number,
    raycast?: (from: Vec3, to: Vec3) => Vec3 | null,
  ) {
    return this.camera.update(dt, follow, heading, mode, speed, baseFov, shake, raycast);
  }
}

/** Shared singleton — safe across HMR via globalThis stash. */
const g = globalThis as unknown as { __mounthopeSim?: SimRuntime };
export const sim: SimRuntime = g.__mounthopeSim ?? (g.__mounthopeSim = new SimRuntime());
