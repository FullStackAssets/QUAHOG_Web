import { mobileBudget } from "../mobile/profile";
import { useGame } from "../store";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { VEHICLE_TYPES, type VehicleType } from "../earth/vehicleTypes";
import { TRAFFIC_PACK_MODEL } from "./StreetLife";
import { PackGLB } from "../actors/PackGLB";
import type { Road } from "../slice";
import { setParkedCount } from "../debug/modelStatus";
import { BLENDERKIT_PARKED } from "./blenderkitCars";
import { buildFreewayCorridor, isCorridorName, type FreewayCorridor } from "./freeway";
import { shared, type ParkedEntry } from "../shared";

// Parked cars lining the streets (§7/§12): static vehicles tucked against the
// curb on drivable roads near a hub. NOT capped at build time: the builder
// collects every candidate near the hub, sorts nearest-first, and the
// quality budget (mobileBudget().parkedCars) picks how many render — so
// quality settings cull far cars first instead of hiding near cars behind
// a file-order slice (the old MAX=46 file-order cap hid 32 nearer cars
// behind a 223 m one at quality 0).

const RADIUS = 240;
const COLORS = ["#7a2a2a", "#2a3a6a", "#caa24a", "#3a5a3a", "#6a6a6a", "#8c6a3a", "#2a6a6a", "#9a9a9a",
  "#5a1f1f", "#c9c2b4", "#3a2a22", "#1f3a2a", "#7a6a30", "#40506a", "#8a8f96", "#b56a3a"];
const DRIVABLE = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street"]);
// Rt 18 programme (2026-11-02): motorway and motorway_link are NEVER in
// DRIVABLE — named here so the exclusion is a stated rule, not an accident
// of the set above, and so a future DRIVABLE edit can't silently re-admit
// the freeway. 0 parked cars on Rt 18, EVER.
const NEVER_PARK_HIGHWAYS = new Set(["motorway", "motorway_link"]);

interface Parked { x: number; z: number; rot: number; type: VehicleType; color: string }

/** The permanent Rt 18 parking guard, in one place so ParkedCars and
 *  ParkedCarColliders (same builder) can never drift apart. Runs BEFORE the
 *  quality-budget slice — a display-time filter would re-expose corridor
 *  cars whenever quality changes. Three layers:
 *  1. type — motorway/link never drivable (see NEVER_PARK_HIGHWAYS);
 *  2. name — the Rt 18 corridor names, including JFK Boulevard, the
 *     corridor's surface continuation;
 *  3. geometry — no candidate within 13 m of any motorway centerline,
 *     which covers the median AND both shoulders regardless of names or
 *     future data changes, and catches cross-street cars (the Elm Street
 *     car 3.7 m from the centerline) that both other layers miss. */
export function buildParkedCars(roads: Road[], center: [number, number]): Parked[] {
  const out: (Parked & { d: number })[] = [];
  const corridor: FreewayCorridor = buildFreewayCorridor(roads);
  let n = 0;
  for (const r of roads) {
    if (NEVER_PARK_HIGHWAYS.has(r.highway)) continue;
    if (!DRIVABLE.has(r.highway) || r.points.length < 2) continue;
    // Full-game plan item 5: no parked cars on bridges. The old 0 was luck
    // (no bridge segment happened to qualify); the guard makes it a rule.
    if (r.bridge) continue;
    if (isCorridorName(r.name)) continue;
    const off = r.width / 2 + 1.4;
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, an] = r.points[i];
      const [bx, bn] = r.points[i + 1];
      const x1 = ax, z1 = -an, x2 = bx, z2 = -bn;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 14) continue;
      const ux = dx / len, uz = dz / len;
      const nx = -uz, nz = ux;
      for (let d = 7; d < len; d += 30) {
        const side = (n & 1) ? 1 : -1;
        const x = x1 + ux * d + nx * off * side;
        const z = z1 + uz * d + nz * off * side;
        if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
        if (corridor.contains(x, z)) continue;
        out.push({
          x, z,
          rot: Math.atan2(ux, uz) + (((n * 0.6180339887) % 1) - 0.5) * 0.2, // parked-by-hand yaw jitter
          type: VEHICLE_TYPES[(n * 7) % VEHICLE_TYPES.length],
          color: COLORS[(n * 5) % COLORS.length],
          d: Math.hypot(x - center[0], z - center[1]),
        });
        n++;
      }
    }
  }
  // Full-game plan item 3: nearest-first, so the quality slice below keeps
  // the closest cars instead of the first cars in file order.
  out.sort((a, b) => a.d - b.d);
  return out.map(({ d: _d, ...c }) => c);
}

export function ParkedCars({ roads, center, reportCount = true, hub = "core" }: { roads: Road[]; center: [number, number]; reportCount?: boolean; hub?: string }) {
  const quality = useGame((s) => s.quality);
  const parkedVersion = useParkedVersion();
  void parkedVersion; // re-render when a car is taken, so it hides
  const entries = useMemo(() => {
    const cars = buildParkedCars(roads, center).slice(0, mobileBudget(quality).parkedCars);
    // Preserve `taken` across quality re-slices by position key (a taken car
    // stays taken while it remains in the rendered slice; see spec edge
    // cases). Keys are per-hub, so a district switch (remount) starts fresh.
    const taken = takenByHub.get(hub);
    // Stream A (2026-11-03): every parked car gets a rendered pack path
    // here, so the visual, the enter scan and the entered player car can
    // never disagree. Rotation pack slots keep their exact original
    // assignment (every 3rd car a rotation pack; every 4th pack slot a
    // BlenderKit vehicle — i.e. pack slots with i % 4 === 3); all other
    // cars render their logic-type-mapped P006 model instead of the old
    // procedural Vehicle. Pack paint is baked, so c.color is ignored for
    // every parked car now (it already was for rotation pack cars).
    return cars.map((c, i): ParkedEntry => {
      const isPackSlot = i % 3 === 0;
      const bk = isPackSlot && i % 4 === 3
        ? BLENDERKIT_PARKED[Math.floor(i / 4) % BLENDERKIT_PARKED.length]
        : null;
      const packPath = bk
        ? bk.path
        : isPackSlot
          ? PACK_CARS[i % PACK_CARS.length]
          : `/packs/pack006/${TRAFFIC_PACK_MODEL[c.type] ?? "economy_sedan"}.glb`;
      const packYOff = bk ? bk.yOff : (PACK_Y_OFF[packPath] ?? 0);
      return {
        ...c, packPath, packYOff, hub,
        taken: taken?.has(parkedKey(c.x, c.z)) ?? false,
      };
    });
  }, [roads, center, quality, hub]);
  // Publish the rendered list (post quality slice) so Player's proximity
  // scan targets exactly what's drawn — visuals, colliders and the scan
  // can never drift apart. Cleanup clears the hub (district switch / New
  // Game remount) including its taken keys.
  useEffect(() => {
    publishParked(hub, entries);
    return () => { publishParked(hub, null); };
  }, [entries, hub]);
  const visible = entries.filter((e) => !e.taken);
  // Debug overlay: report the visible parked count (post quality slice).
  // Only the core hub reports — a second hub (Dartmouth Mall) must not
  // overwrite the core count the overlay displays.
  useEffect(() => {
    if (reportCount) setParkedCount(visible.length);
  }, [visible.length, reportCount]);
  return (
    <group>
      {visible.map((c) => (
        <group key={`${c.x}|${c.z}`} position={[c.x, 0, c.z]} rotation-y={c.rot}>
          {/* Stream A (2026-11-03): every parked car is a real pack GLB —
              rotation pack / BlenderKit path from the entry (computed in
              the memo above, by post-slice index, so taking a car never
              reshuffles the other cars' models), or the logic-type-mapped
              P006 model. Same group transform (ground origin, +Z forward),
              same fixed collider below — a visual swap only, so parked
              cars stay solid. Pack paint is baked, so c.color is ignored.
              Parked cars don't move, so static wheels are correct.
              Every parked car is enterable (see Player.tsx). */}
          <group position={[0, c.packYOff ?? 0, 0]}>
            <PackGLB path={c.packPath ?? `/packs/pack006/${TRAFFIC_PACK_MODEL[c.type as VehicleType] ?? "economy_sedan"}.glb`} />
          </group>
        </group>
      ))}
    </group>
  );
}

// --- Parked-car registry (NB slice improvements, 2026-11-03) ---------------
// Per-hub published lists feed shared.parked (the scan target). Taken state
// lives in per-hub key sets (not on the entry objects alone) so visuals,
// colliders and the scan agree even though each rebuilds its own list.
// A version counter + useSyncExternalStore re-renders subscribers when a
// car is taken; hub cleanup (unmount) drops that hub's taken keys.
const hubLists = new Map<string, ParkedEntry[]>();
const takenByHub = new Map<string, Set<string>>();
let parkedVersion = 0;
const parkedListeners = new Set<() => void>();

export function parkedKey(x: number, z: number): string {
  return `${x.toFixed(1)}|${z.toFixed(1)}`;
}

export function publishParked(hub: string, list: ParkedEntry[] | null): void {
  if (list) hubLists.set(hub, list);
  else { hubLists.delete(hub); takenByHub.delete(hub); }
  shared.parked = [...hubLists.values()].flat();
  parkedVersion++;
  parkedListeners.forEach((l) => l());
}

/** Mark a parked entry taken: hides its visual + collider, removes it from
 *  the enter scan (the scan skips taken entries). */
export function markParkedTaken(entry: ParkedEntry): void {
  entry.taken = true;
  let set = takenByHub.get(entry.hub);
  if (!set) { set = new Set(); takenByHub.set(entry.hub, set); }
  set.add(parkedKey(entry.x, entry.z));
  parkedVersion++;
  parkedListeners.forEach((l) => l());
}

export function useParkedVersion(): number {
  return useSyncExternalStore(
    (cb) => { parkedListeners.add(cb); return () => { parkedListeners.delete(cb); }; },
    () => parkedVersion,
  );
}

// P006 road cars, civilian mix plus the cruiser. Bulk job 2026-11-03:
// the full remaining P006 VEHICLE set joins the parked rotation (trucks,
// buses, vans, motorcycle, workbody, unmarked sedan). Kits/parts, the
// bicycle and delivery_bike stay out: parts are not cars, and the bikes
// are not cars either (held with reason — no car-pool slot for them).
export const PACK_CARS = [
  "/packs/pack006/hatchback_hero.glb",
  "/packs/pack006/economy_sedan.glb",
  "/packs/pack006/mid_sedan.glb",
  "/packs/pack006/full_sedan.glb",
  "/packs/pack006/sports_coupe.glb",
  "/packs/pack006/sports_convertible.glb",
  "/packs/pack006/crossover_suv.glb",
  "/packs/pack006/family_suv.glb",
  "/packs/pack006/offroad_suv.glb",
  "/packs/pack006/pickup_crew.glb",
  "/packs/pack006/taxi_sedan.glb",
  "/packs/pack006/patrol_cruiser.glb",
  "/packs/pack006/ambulance_van.glb",
  "/packs/pack006/box_truck.glb",
  "/packs/pack006/delivery_van.glb",
  "/packs/pack006/dump_truck.glb",
  "/packs/pack006/fire_engine.glb",
  "/packs/pack006/flatbed_truck.glb",
  "/packs/pack006/motorcycle.glb",
  "/packs/pack006/pickup_workbody.glb",
  "/packs/pack006/salt_spreader_truck.glb",
  "/packs/pack006/semi_tractor.glb",
  "/packs/pack006/shuttle_bus.glb",
  "/packs/pack006/snow_plow_truck.glb",
  "/packs/pack006/step_van.glb",
  "/packs/pack006/street_sweeper.glb",
  "/packs/pack006/tow_truck.glb",
  "/packs/pack006/transit_bus.glb",
  "/packs/pack006/unmarked_sedan.glb",
];

// Measured ground drops for parked P006 models whose GLB floats above the
// ground plane (world Y-min from node-transform bounds). Only the
// motorcycle floats (Y-min 0.27); every other P006 vehicle sits at ~0.00.
export const PACK_Y_OFF: Record<string, number> = {
  "/packs/pack006/motorcycle.glb": -0.27,
};

// Playtest fix (2026-11-02, E-04): parked cars were visual-only, so the
// player car passed straight through the parked truck. These fixed
// colliders (same footprint as the player car's) make parked cars solid
// for the player car, the on-foot capsule, and the wall-probe. Mounted
// inside <Physics>; the visuals stay under <CullByDistance> as before.
export function ParkedCarColliders({ roads, center, hub = "core" }: { roads: Road[]; center: [number, number]; hub?: string }) {
  const quality = useGame((s) => s.quality);
  const parkedVersion = useParkedVersion();
  void parkedVersion; // re-render when a car is taken, so its collider goes
  const cars = useMemo(() => buildParkedCars(roads, center).slice(0, mobileBudget(quality).parkedCars), [roads, center, quality]);
  const taken = takenByHub.get(hub);
  const visible = cars.filter((c) => !(taken?.has(parkedKey(c.x, c.z))));
  return (
    <>
      {visible.map((c, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[c.x, 0, c.z]} rotation={[0, c.rot, 0]}>
          <CuboidCollider args={[1.0, 0.6, 2.1]} position={[0, 0.6, 0]} />
        </RigidBody>
      ))}
    </>
  );
}
