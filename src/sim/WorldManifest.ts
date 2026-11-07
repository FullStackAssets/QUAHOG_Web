/**
 * §1.6 WorldManifest — authored env schema + runtime validator.
 * Bootstraps from a Slice until dedicated JSON authoring lands.
 */

import type { Slice, Road, Landmark } from "../slice";

export interface ZoneDef {
  id: string;
  name: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface SpawnDef {
  id: string;
  kind: "player" | "traffic" | "ped" | "boat" | "mission";
  x: number;
  z: number;
}

export interface MarkerDef {
  id: string;
  kind: string;
  x: number;
  z: number;
  label?: string;
}

export interface WorldManifest {
  version: number;
  name: string;
  zones: ZoneDef[];
  roads: Road[];
  landmarks: Landmark[];
  markers: MarkerDef[];
  spawns: SpawnDef[];
  doors: { id: string; x: number; z: number; building?: string }[];
  signals: { id: string; x: number; z: number }[];
  raceTracks: { id: string; name: string }[];
  collectibles: { id: string; kind: string; x: number; z: number }[];
  fronts: { id: string; name: string; x: number; z: number; cost: number }[];
  territories: { id: string; faction: string }[];
}

export interface ManifestValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Build a minimal manifest from the loaded OSM slice. */
export function manifestFromSlice(slice: Slice): WorldManifest {
  const xs = slice.buildings.flatMap((b) => b.footprint.map((p) => p[0]));
  const ns = slice.buildings.flatMap((b) => b.footprint.map((p) => p[1]));
  const minX = xs.length ? Math.min(...xs) : -500;
  const maxX = xs.length ? Math.max(...xs) : 500;
  const minZ = ns.length ? -Math.max(...ns) : -500;
  const maxZ = ns.length ? -Math.min(...ns) : 500;

  return {
    version: 1,
    name: slice.name,
    zones: [{ id: "core", name: slice.name, bounds: { minX, maxX, minZ, maxZ } }],
    roads: slice.roads,
    landmarks: slice.landmarks,
    markers: slice.landmarks.map((l, i) => ({
      id: `lm-${i}`,
      kind: l.kind,
      x: l.pos[0],
      z: -l.pos[1],
      label: l.name,
    })),
    spawns: [
      { id: "player-start", kind: "player", x: 0, z: 0 },
    ],
    doors: [],
    signals: [],
    raceTracks: [],
    collectibles: [],
    fronts: [],
    territories: [],
  };
}

export function validateManifest(m: unknown): ManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!m || typeof m !== "object") return { ok: false, errors: ["manifest root must be object"], warnings };
  const man = m as WorldManifest;
  if (typeof man.version !== "number") errors.push("version: missing number");
  if (!man.name) errors.push("name: required");
  if (!Array.isArray(man.zones)) errors.push("zones: required array");
  if (!Array.isArray(man.roads)) errors.push("roads: required array");
  if (!Array.isArray(man.markers)) errors.push("markers: required array");
  if (Array.isArray(man.markers)) {
    const ids = new Set<string>();
    for (const mk of man.markers) {
      if (!mk.id) errors.push("marker missing id");
      else if (ids.has(mk.id)) errors.push(`duplicate marker id ${mk.id}`);
      else ids.add(mk.id);
    }
  }
  if (Array.isArray(man.roads) && man.roads.length === 0) warnings.push("roads: empty");
  return { ok: errors.length === 0, errors, warnings };
}
