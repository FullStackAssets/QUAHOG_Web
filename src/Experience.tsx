import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { mobileBudget } from "./mobile/profile";
import { Physics } from "@react-three/rapier";
import { loadSlice, type Building, type Landmark, type Slice } from "./slice";
import { prepareRoads } from "./world/roadPrep";
import { DISTRICTS, worldCenter } from "./districts";
import { DRESSING_ENABLED } from "./world/dressing";
import { ensureGisBuildings } from "./world/gisDistrict";
import { useGame } from "./store";
import { AerialGround } from "./world/AerialGround";
import { Roads } from "./world/Roads";
import { MedianBarriers } from "./world/MedianBarriers";
import { RoadPuddles } from "./world/RoadPuddles";
import { CinematicExposure } from "./world/CinematicExposure";
import { Bridges } from "./world/Bridges";
import { StreamingBuildings } from "./world/StreamingBuildings";
import { Tier1Models } from "./world/Tier1Models";
import { NbTier1Models } from "./world/NbTier1Models";
import { DowntownTier1Models } from "./world/DowntownTier1Models";
import { withoutTier1 } from "./world/tier1Models";
import { GisDistrict } from "./world/GisDistrict";
import { Water } from "./world/Water";
import { Landmarks } from "./world/Landmarks";
import { StreetLife } from "./world/StreetLife";
import { StoryProps } from "./world/StoryProps";
import { setBuildingFootprints } from "./world/buildingAvoid";
import { setCameraBuildings, clearCameraBuildings } from "./actors/cameraBuildings";
import { SeamensBethel } from "./world/SeamensBethel";
import { Props } from "./world/Props";
import { HighMasts } from "./world/HighMasts";
import { Awnings } from "./world/Awnings";
import { Crosswalks } from "./world/Crosswalks";
import { UtilityPoles } from "./world/UtilityPoles";
import { Decals } from "./world/Decals";
import { Graffiti } from "./world/Graffiti";
import { Businesses } from "./world/Businesses";
import { Respray } from "./world/Respray";
import { NeonSigns } from "./world/NeonSigns";
import { StreetSigns } from "./world/StreetSigns";
import { TrafficLights } from "./world/TrafficLights";
import { ParkedCars, ParkedCarColliders } from "./world/ParkedCars";
import { TrafficColliders } from "./world/TrafficColliders";
import { StreetExtras } from "./world/StreetExtras";
import { RoadFixtures } from "./world/RoadFixtures";
import { Foliage } from "./world/Foliage";
import { Fences } from "./world/Fences";
import { Billboards } from "./world/Billboards";
import { Dumpsters } from "./world/Dumpsters";
import { HurricaneBarrier } from "./world/HurricaneBarrier";
import { FlatAreas } from "./world/FlatAreas";
import { Rail } from "./world/Rail";
import { Piers } from "./world/Piers";
import { AreaTrees } from "./world/AreaTrees";
import { CullByDistance } from "./world/CullByDistance";
import { Steeples } from "./world/Steeples";
import { Posters } from "./world/Posters";
import { Collectibles } from "./world/Collectibles";
import { Pickups } from "./world/Pickups";
import { HealthPickups } from "./world/HealthPickups";
import { Race } from "./world/Race";
import { Impacts } from "./world/Impacts";
import { HarborProps } from "./world/HarborProps";
import { Waterfront } from "./world/Waterfront";
import { PortClutter } from "./world/PortClutter";
import { Marina } from "./world/Marina";
import { Gulls } from "./world/Gulls";
import { SkidMarks } from "./world/SkidMarks";
import { Rain } from "./world/Rain";
import { Snow } from "./world/Snow";
import { Snowbanks } from "./world/Snowbanks";
import { Tracers } from "./world/Tracers";
import { Consequence } from "./world/Consequence";
import { Hazards } from "./world/Hazards";
import { setWaterZones } from "./world/waterZones";
import { Safehouse } from "./world/Safehouse";
import { Hospital } from "./world/Hospital";
import { Heroes } from "./world/Heroes";
import { Ambient } from "./earth/Ambient";
import { DayNight } from "./world/DayNight";
import { EnvLight } from "./world/EnvLight";
import { GameSystems } from "./world/GameSystems";
import { MissionRunner } from "./world/MissionRunner";
import { ObjectiveBeacon } from "./world/ObjectiveBeacon";
import { RenderDiagnostics } from "./world/RenderDiagnostics";
import { Effects } from "./world/Effects";
import { Player } from "./actors/Player";
import { Car } from "./actors/Car";
import { Boat } from "./actors/Boat";
import { FollowCamera } from "./actors/FollowCamera";

// Post-processing, toggleable from settings (§26).
function FxGate() {
  const on = useGame((s) => s.fxOn);
  const quality = useGame((s) => s.quality);
  return on && quality > 0 ? <Effects /> : null;
}

// Shadow rendering toggle (§26) — a real perf lever for low-end / mobile: when
// off, the per-frame shadow-map pass is skipped entirely.
function ShadowGate() {
  const on = useGame((s) => s.shadows);
  const quality = useGame((s) => s.quality);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.enabled = on && mobileBudget(quality).shadows;
    gl.shadowMap.needsUpdate = true;
  }, [gl, on, quality]);
  return null;
}

// Landmarks rendered as hand-detailed models (so the generic beam/label is skipped).
const MODELED = new Set(["Seamen's Bethel"]);
// Fall River integration (2026-11-03): the playable core is no longer a
// single hardcoded point — it comes from the active district registry
// (districts.ts). newBedford keeps CORE exactly ([-266, -100]); fallRiver
// uses its package center. Layers that take slice [east, north] get
// `center`; layers that take world [x, z] get `world` (below, in the
// component). NB-only mounts (GIS district, mall hub, harbor dressing)
// are gated on district.id === "newBedford" so Fall River renders
// roads + buildings + water only, per the minimalist directive.
// Dartmouth Mall (full-game plan item 2): the mall building's tile footprint
// centroid (tile b_-12_1, named "Dartmouth Mall"), slice coords and its world
// equivalent. The mall interior-roads centroid sits ~180 m south; the
// building is the landmark anchor. The FAST_TRAVEL "Dartmouth Mall" point
// was moved 2026-11-03 from Route 6 ([-3921, 360], ~2.1 km away) to the
// mall's interior drive (world [-5887.3, -552.3], slice (-5887.3, 552.3)):
// nearest drivable road to the centroid (110.1 m), outside the footprint
// (7.5 m clear; car spawn 10.7 m clear) — NOT the centroid itself, which
// sits inside the building footprint.
const MALL_SLICE: [number, number] = [-5932.5, 652.7];
const MALL_WORLD: [number, number] = [-5932.5, -652.7];
const MALL_LANDMARK: Landmark = { name: "Dartmouth Mall", kind: "mall", pos: MALL_SLICE };

export function Experience({ onReady, onProgress }: { onReady?: (s: Slice) => void; onProgress?: (f: number) => void }) {
  const [slice, setSlice] = useState<Slice | null>(null);
  // Fall River integration: the active district drives the slice file and
  // every center prop below. App remounts Experience (key={district}) on
  // a district switch, so this effect re-runs fresh for the new district.
  const district = DISTRICTS[useGame((s) => s.district)];
  const center = district.center; // slice [east, north]
  const world = worldCenter(district); // world [x, z]
  const isNB = district.id === "newBedford";
  // Tier-1 approved-model mount (batches 2 + 3, Nic 2026-11-03): the 10
  // replaced generic extrusions are filtered out of the fallback list so
  // the GLBs do not double-render (coincident walls would z-fight). In New
  // Bedford the slice list is empty, so this is a no-op there; camera
  // sweeps, ped avoidance, and graffiti keep the FULL list elsewhere.
  const buildingsNoTier1 = useMemo(
    () => (slice ? withoutTier1(slice.buildings) : []),
    [slice],
  );
  // Rt 18 programme (2026-11-02, item 7): the real 62 GIS footprints for
  // the awning facade filter. The slice's own buildings array is empty, so
  // passing it made the filter a no-op. GIS load is cached/shared with
  // <GisDistrict>, so this costs no extra fetch.
  const [gisBuildings, setGisBuildings] = useState<Building[]>([]);
  const paused = useGame((s) => s.paused);
  const gameId = useGame((s) => s.gameId); // remount per-game props (collectibles) on New Game

  useEffect(() => {
    let alive = true;
    loadSlice(district.sliceFile, (f) => { if (alive) onProgress?.(f); })
      .then((s) => {
        if (!alive) return;
        // Load-time road pipeline (roadPrep.prepareRoads): SKIP filter,
        // causeway flags, fork cleanup, name normalization, plus the
        // district exemptions (mall interior for NB, named service
        // access roads for FR). NB output is bit-identical to the old
        // inline code.
        s.roads = prepareRoads(s.roads, s.water ?? [], s.landmarks.map((l) => l.name), district.id);
        setSlice(s);
        useGame.getState().setSlice(s);
        // Camera-inside-building fix (2026-11-03): register the district's
        // shipped footprints for the geometric camera sweep — this is what
        // keeps the camera out of visual-only buildings (Fall River's whole
        // slice; New Bedford's slice array is empty, its buildings come
        // from tiles + GIS below). No collider cost, no gameplay change.
        setCameraBuildings("slice", s.buildings);
        // Ped building-avoidance: OSM footprints around the district core.
        // NB box preserved exactly (core (-266,-100) -> x[-360,-170],
        // north[-200,0]); FR uses the same relative offsets from its
        // package center so the rule is one rule, not two boxes.
        const dxMin = -360 - -266, dxMax = -170 - -266;
        const dnMin = -200 - -100, dnMax = 0 - -100;
        setBuildingFootprints("osm", s.buildings.filter((b) => {
          let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
          for (const [e, n] of b.footprint) {
            if (e < minE) minE = e; if (e > maxE) maxE = e;
            if (n < minN) minN = n; if (n > maxN) maxN = n;
          }
          return maxE >= center[0] + dxMin && minE <= center[0] + dxMax
            && maxN >= center[1] + dnMin && minN <= center[1] + dnMax;
        }));
        setWaterZones(s.water ?? [], s.roads, s.islands ?? [], s.barrier ?? []);
        onReady?.(s);
      })
      .catch((e) => console.error(e));
    ensureGisBuildings().then((d) => { if (alive) { setGisBuildings(d.buildings); setCameraBuildings("gis", d.buildings); } });
    return () => {
      alive = false;
      setBuildingFootprints("osm", []);
      clearCameraBuildings();
    };
  }, [onReady, onProgress]);

  return (
    <>
      <DayNight />
      <EnvLight />
      <CinematicExposure />
      <GameSystems />
      <MissionRunner />
      <ObjectiveBeacon />
      <RenderDiagnostics />
      <Consequence />
      <Hazards />

      <Physics gravity={[0, -9.81, 0]} paused={paused}>
        <AerialGround origin={slice?.origin} />
        <Player />
        <Car />
        <Boat />
        {slice && (
          <>
            <Roads roads={slice.roads} />
            <MedianBarriers roads={slice.roads} />
            <RoadPuddles roads={slice.roads} center={world} />
            <Snowbanks roads={slice.roads} />
            <Bridges roads={slice.roads} />
            <StreamingBuildings fallback={buildingsNoTier1} center={center} />
            {/* Build 002: real MassGIS roofprints for the New Bedford waterfront.
                NB-only: Fall River's buildings come from its own slice. */}
            {isNB && <GisDistrict />}
            {/* generic markers, minus landmarks we hand-model, plus the
                Dartmouth Mall landmark (full-game plan item 2 — the slice
                has no mall landmark; the tile building gives the anchor).
                NB-only: FR landmarks come from its own slice. */}
            <Landmarks landmarks={[...slice.landmarks.filter((l) => !MODELED.has(l.name)), ...(isNB ? [MALL_LANDMARK] : [])]} />
            {slice.landmarks
              .filter((l) => l.name === "Seamen's Bethel")
              .map((l, i) => (
                <SeamensBethel key={i} landmark={l} />
              ))}
          </>
        )}
        {/* Heroes use RigidBody colliders → must live inside <Physics> */}
        <Heroes />
        {/* Rt 18 programme (2026-11-02, item 2): lamp, stop/meter and
            utility pole colliders are GONE — street furniture is
            drivable-through with a small damage hook in <Car> now, not a
            physics wall. Parked cars and traffic stay solid. */}
        {slice && <ParkedCarColliders roads={slice.roads} center={world} />}
        {/* Full-game plan item 2: the mall's second parking hub — same
            builder, same guards, its own center. Colliders live here
            inside <Physics>; the visuals mount outside <CullByDistance>
            below (the mall is 5.9 km from the core, beyond its radius).
            NB-only. */}
        {isNB && slice && <ParkedCarColliders roads={slice.roads} center={MALL_WORLD} hub="mall" />}
        <TrafficColliders />
        <FollowCamera />
      </Physics>

      {/* Area polys sit BELOW the road apron (0.04) so roads/sidewalks always
          render over them — at the old 0.05-0.06 they tied the road surface
          (0.06) and z-fought, bleeding green/grey through the pavement. */}
      {slice && <FlatAreas polys={slice.parking} color="#46474d" y={0.03} repeat={0.06} roughness={0.95} />}
      {slice && <FlatAreas polys={slice.beach} color="#c8b88a" y={0.026} repeat={0.04} />}
      {slice && <FlatAreas polys={slice.wood} color="#39512c" y={0.032} />}
      {slice && <FlatAreas polys={slice.cemetery} color="#566048" y={0.034} />}
      {slice && <FlatAreas polys={slice.parks} color="#4f6e3a" y={0.036} />}
      {slice && <Rail paths={slice.rail} />}
      {slice && <Piers paths={slice.pier} />}
      {slice && <AreaTrees areas={slice.wood} step={9} cap={800} />}
      {slice && <AreaTrees areas={slice.parks} step={16} cap={300} />}
      {slice && <Steeples points={slice.church} />}
      {slice && slice.water?.length > 0 && <Water polys={slice.water} holes={slice.islands ?? []} />}
      {/* NB harbor dressing (pilings, buoys, boats): NB-only. The container
          clutter (PortClutter) is gated by the minimalist dressing switch
          below; HarborProps' own land-side gear boxes are gated inside
          HarborProps itself (see that file). */}
      {isNB && slice && slice.water?.length > 0 && (
        <HarborProps polys={slice.water} center={world} />
      )}
      {isNB && slice && slice.water?.length > 0 && (
        <Waterfront polys={slice.water} center={world} />
      )}
      {DRESSING_ENABLED && isNB && slice && slice.water?.length > 0 && (
        <PortClutter polys={slice.water} center={world} />
      )}
      <Marina />
      <Gulls />
      <CullByDistance center={center} radius={820}>
      {/* Minimalist directive (2026-11-03): the dressing layer is gated by
          the single DRESSING_ENABLED switch (world/dressing.ts, default
          OFF). Each mount below renders nothing while off; the code stays
          so one flip restores it. Parked cars, crosswalks, utility poles,
          traffic signals and the overlay are NOT dressing and stay on. */}
      {DRESSING_ENABLED && slice && <Props roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <HighMasts roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <Awnings roads={slice.roads} center={world} buildings={gisBuildings} />}
      {slice && <Crosswalks roads={slice.roads} center={world} />}
      {slice && <UtilityPoles roads={slice.roads} center={world} />}
      {slice && <Decals roads={slice.roads} center={world} />}
      {slice && <Graffiti roads={slice.roads} buildings={slice.buildings} center={world} />}
      {DRESSING_ENABLED && slice && <StreetSigns roads={slice.roads} center={world} />}
      {slice && <TrafficLights roads={slice.roads} center={world} />}
      {slice && <ParkedCars roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <StreetExtras roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <RoadFixtures roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <Foliage roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <Fences roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <Billboards roads={slice.roads} center={world} />}
      {DRESSING_ENABLED && slice && <Dumpsters roads={slice.roads} center={world} />}
      </CullByDistance>
      {/* Full-game plan item 2: mall-hub parked cars. Mounted OUTSIDE the
          cull block above on purpose — the mall is far beyond its 820 m
          radius, so inside it these cars would never render. reportCount
          is off so the overlay keeps reporting the core hub's count.
          NB-only. */}
      {isNB && slice && <ParkedCars roads={slice.roads} center={MALL_WORLD} reportCount={false} hub="mall" />}
      {slice && <HurricaneBarrier paths={slice.barrier} />}
      {slice && <StreetLife roads={slice.roads} center={world} />}
      <StoryProps />
      {/* Tier-1 approved-model mount (batches 2 + 3): visual-only GLBs at
          their real Fall River footprints. OUTSIDE <Physics> (no colliders)
          and OUTSIDE <CullByDistance> (FR models sit kilometres from the NB
          core, beyond its radius) on purpose. FR-district only. */}
      {!isNB && <Tier1Models />}
      {/* New Bedford Tier-1 mount (batches 4–8, bulk job 2026-11-03):
          visual-only GLBs at their GIS/tile footprints. Same outside-
          Physics, outside-CullByDistance placement. NB-district only. */}
      {isNB && <NbTier1Models />}
      {isNB && <DowntownTier1Models />}
      <Safehouse />
      <Hospital />
      <Businesses />
      <Respray />
      <NeonSigns />
      <Collectibles key={gameId} />
      <Pickups />
      <HealthPickups />
      <Race />
      <Posters />
      {/* <Police /> removed 2026-11-02 per Nic (see POLICE_ENABLED in world/Police.tsx) */}
      <Tracers />
      <Impacts />
      <SkidMarks />
      <Rain />
      <Snow />
      <Ambient weather="clear" />

      <FxGate />
      <ShadowGate />
    </>
  );
}
