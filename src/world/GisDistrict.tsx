// Build 002: renders the real MassGIS New Bedford waterfront footprints as an
// overlay layer. The OSM blockouts these replace are filtered out of the
// streamed tiles by withoutReplaced() in StreamingBuildings.
import { useEffect, useState } from "react";
import { Buildings } from "./Buildings";
import { ArchitecturalDetails } from "./ArchitecturalDetails";
import { ensureGisBuildings } from "./gisDistrict";
import type { Building } from "../slice";

// This surveyed outline is already represented by the detailed, hand-built chapel.
// Avoid its duplicate opaque extrusion and physics collider.
const HAND_MODELED = new Set(["massgis:201:248015_820696"]);

export function GisDistrict() {
  const [data, setData] = useState<{ buildings: Building[]; center: [number, number] } | null>(null);

  useEffect(() => {
    let live = true;
    ensureGisBuildings().then((d) => {
      if (live && d.buildings.length > 0) setData({ ...d, buildings: d.buildings.filter(b => !HAND_MODELED.has(b.name ?? "")) });
    });
    return () => { live = false; };
  }, []);

  if (!data) return null;
  // District spans ~500m; every footprint gets a collider, not just the core.
  return (
    <group>
      <Buildings buildings={data.buildings} center={data.center} colliderRadius={400} detailed />
      <ArchitecturalDetails buildings={data.buildings} />
    </group>
  );
}
