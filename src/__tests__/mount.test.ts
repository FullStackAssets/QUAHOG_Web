import { describe, expect, it } from "vitest";
import { TRAFFIC_PACK_MODEL, TRAFFIC_PACK_WHEEL_R, TRAFFIC_PACK_ROTATION, PED_BODIES, PED_GARMENTS } from "../world/StreetLife";
import { PACK_CARS } from "../world/ParkedCars";
import { BLENDERKIT_PARKED, BLENDERKIT_TRAFFIC, BLENDERKIT_TRAFFIC_WHEEL_R } from "../world/blenderkitCars";
import { STORY_ITEMS } from "../world/StoryProps";
import { MISSIONS } from "../mission";
import { VEHICLE_TYPES } from "../earth/vehicleTypes";

// Mount job (2026-11-03): data tests only. No file reads, no node: imports —
// runtime GLB load failures surface through the debug overlay modelStatus
// registry, not through this suite.

const RIGGED_BODIES = [
  "pedestrian_a", "pedestrian_b", "older_adult", "varied_stature",
  "crowd_lowdetail", "player_base_a", "player_base_b",
  "dockworker", "vessel_crew", "restaurant_worker", "warehouse_employee",
  "retail_cashier", "traffic_police", "patrol_officer", "paramedic",
  "firefighter", "snow_operator", "museum_attendant", "mission_contact",
];
const UNIFORM_BODIES = [
  "dockworker", "vessel_crew", "restaurant_worker", "warehouse_employee",
  "retail_cashier", "traffic_police", "patrol_officer", "paramedic",
  "firefighter", "snow_operator", "museum_attendant", "mission_contact",
];
const GARMENT_NAMES = [
  "hoodie", "streetwear_jacket", "insulated_parka", "puffer_jacket",
  "rain_shell", "bib_overalls", "hi_vis_vest", "utility_coveralls",
  "ems_uniform", "firefighter_turnout", "office_blazer", "police_uniform",
  "restaurant_apron", "graphic_tee",
];

describe("mount: traffic pack mapping", () => {
  it("covers every procedural traffic type with a parked-rotation model", () => {
    for (const vtype of VEHICLE_TYPES) {
      const model = TRAFFIC_PACK_MODEL[vtype];
      expect(model, `no pack model for ${vtype}`).toBeDefined();
      expect(PACK_CARS).toContain(`/packs/pack006/${model}.glb`);
      expect(TRAFFIC_PACK_WHEEL_R[model]).toBeGreaterThan(0);
    }
  });

  it("bulk job 2026-11-03: parked rotation holds the full P006 vehicle set, no parts kits or bikes", () => {
    const expected = [
      "hatchback_hero", "economy_sedan", "mid_sedan", "full_sedan",
      "sports_coupe", "sports_convertible", "crossover_suv", "family_suv",
      "offroad_suv", "pickup_crew", "taxi_sedan", "patrol_cruiser",
      "ambulance_van", "box_truck", "delivery_van", "dump_truck",
      "fire_engine", "flatbed_truck", "motorcycle", "pickup_workbody",
      "salt_spreader_truck", "semi_tractor", "shuttle_bus",
      "snow_plow_truck", "step_van", "street_sweeper", "tow_truck",
      "transit_bus", "unmarked_sedan",
    ];
    expect([...PACK_CARS].sort()).toEqual(expected.map((n) => `/packs/pack006/${n}.glb`).sort());
    for (const banned of ["bumper_kit", "dashboard", "wheel_sedan_set", "bicycle", "delivery_bike", "container_trailer", "plow_blade", "siren_lightbar"]) {
      expect(PACK_CARS.some((p) => p.includes(banned))).toBe(false);
    }
  });

  it("bulk job 2026-11-03: traffic rotation entries are mounted models with measured wheel radii", () => {
    const parkedPaths = new Set([...PACK_CARS, ...BLENDERKIT_PARKED.map((b) => b.path)]);
    for (const path of TRAFFIC_PACK_ROTATION) {
      expect(parkedPaths.has(path), `${path} not in a parked pool`).toBe(true);
      const base = path.split("/").pop()!.replace(/\.glb$/, "");
      const r = TRAFFIC_PACK_WHEEL_R[base] ?? BLENDERKIT_TRAFFIC_WHEEL_R[base];
      expect(r, `no wheel radius for ${base}`).toBeGreaterThan(0);
    }
    // BlenderKit traffic = ONLY the forward-verified pair.
    expect([...BLENDERKIT_TRAFFIC].sort()).toEqual(["/blenderkit/sedan.glb", "/blenderkit/van.glb"].sort());
    expect(BLENDERKIT_PARKED.map((b) => b.path).sort()).toEqual(
      ["van", "sedan", "box-truck", "sports-car", "bus", "motorcycle", "suv", "pickup"].map((n) => `/blenderkit/${n}.glb`).sort(),
    );
    // Long trucks/buses and the motorcycle are parked-only, never traffic.
    for (const held of ["box_truck", "dump_truck", "fire_engine", "flatbed_truck", "salt_spreader_truck", "semi_tractor", "shuttle_bus", "snow_plow_truck", "tow_truck", "transit_bus", "motorcycle"]) {
      expect(TRAFFIC_PACK_ROTATION).not.toContain(`/packs/pack006/${held}.glb`);
      expect(PACK_CARS).toContain(`/packs/pack006/${held}.glb`);
    }
    for (const heldBk of ["box-truck", "sports-car", "bus", "motorcycle", "suv", "pickup"]) {
      expect(TRAFFIC_PACK_ROTATION).not.toContain(`/blenderkit/${heldBk}.glb`);
    }
  });
});

describe("mount: pedestrian bodies and garments", () => {
  it("lists exactly the 19 rigged bodies, uniform bodies flagged", () => {
    expect(PED_BODIES.map((b) => b.body).sort()).toEqual([...RIGGED_BODIES].sort());
    for (const b of PED_BODIES) {
      expect(b.uniform).toBe(UNIFORM_BODIES.includes(b.body));
    }
  });
  it("lists exactly the 14 garment names", () => {
    expect([...PED_GARMENTS].sort()).toEqual([...GARMENT_NAMES].sort());
  });
});

describe("mount: story props sit inside their mission step radii", () => {
  it("every story item is within its anchor step's radius", () => {
    const steps = MISSIONS.flatMap((m) => m.steps).filter((s) => s.target);
    for (const item of STORY_ITEMS) {
      const step = steps.find(
        (s) => s.target![0] === item.anchor[0] && s.target![2] === item.anchor[1],
      );
      expect(step, `no mission step at anchor ${item.anchor} for ${item.path}`).toBeDefined();
      const d = Math.hypot(item.x - item.anchor[0], item.z - item.anchor[1]);
      expect(d).toBeLessThanOrEqual(step!.radius ?? 0);
    }
  });
});
