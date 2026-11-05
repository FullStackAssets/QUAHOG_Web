// Build 002: renders the real MassGIS New Bedford waterfront footprints as an
// overlay layer. The OSM blockouts these replace are filtered out of the
// streamed tiles by withoutReplaced() in StreamingBuildings.
import { useEffect, useState } from "react";
import { DistrictDetails } from "./DistrictDetails";
import { Buildings } from "./Buildings";
import { ensureGisBuildings } from "./gisDistrict";
import { setBuildingFootprints } from "./buildingAvoid";
import { BETHEL_FOOTPRINT } from "./districtStyle";
import { NB_TIER1_GIS_IDS } from "./nbTier1Models";
import { DOWNTOWN_TIER1_GIS_IDS } from "./downtownTier1Models";
import type { Building } from "../slice";

// Bulk job 2026-11-03: the 10 NB Tier-1 GLBs replace their GIS records, so
// those records are filtered here (by record id — names can be null or
// duplicated) alongside the hero Bethel chapel, which keeps its own mesh.
const HANDLED = new Set([BETHEL_FOOTPRINT, ...NB_TIER1_GIS_IDS, ...DOWNTOWN_TIER1_GIS_IDS]);

export function GisDistrict() {
  const [data, setData] = useState<{ buildings: Building[]; center: [number, number] } | null>(null);

  useEffect(() => {
    let live = true;
    ensureGisBuildings().then((d) => {
      if (live && d.buildings.length > 0) {
        const filtered = d.buildings.filter((b) => !HANDLED.has(b.name ?? ""));
        setData({...d, buildings: filtered});
        // Include the chapel in pedestrian avoidance, but use only its hand-
        // modeled colliders/render mesh. No duplicate generic GIS hull.
        setBuildingFootprints("gis", d.buildings);
      }
    });
    return () => { live = false; setBuildingFootprints("gis", []); };
  }, []);

  if (!data) return null;
  // District spans ~500m; every footprint gets a collider, not just the core.
  return <><Buildings buildings={data.buildings} center={data.center} colliderRadius={400} /><DistrictDetails buildings={data.buildings} /></>;
}
