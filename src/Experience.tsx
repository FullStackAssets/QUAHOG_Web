import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { loadSlice, type Slice } from "./slice";
import { useGame } from "./store";
import { AerialGround } from "./world/AerialGround";
import { Roads } from "./world/Roads";
import { Bridges } from "./world/Bridges";
import { StreamingBuildings } from "./world/StreamingBuildings";
import { GisDistrict } from "./world/GisDistrict";
import { Water } from "./world/Water";
import { Landmarks } from "./world/Landmarks";
import { StreetLife } from "./world/StreetLife";
import { SeamensBethel } from "./world/SeamensBethel";
import { Props } from "./world/Props";
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
import { ParkedCars } from "./world/ParkedCars";
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
import { Tracers } from "./world/Tracers";
import { Police } from "./world/Police";
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
import { Effects } from "./world/Effects";
import { Player } from "./actors/Player";
import { Car } from "./actors/Car";
import { Boat } from "./actors/Boat";
import { FollowCamera } from "./actors/FollowCamera";

// Post-processing, toggleable from settings (§26).
function FxGate() {
  const on = useGame((s) => s.fxOn);
  return on ? <Effects /> : null;
}

// Shadow rendering toggle (§26) — a real perf lever for low-end / mobile: when
// off, the per-frame shadow-map pass is skipped entirely.
function ShadowGate() {
  const on = useGame((s) => s.shadows);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.enabled = on;
    gl.shadowMap.needsUpdate = true;
  }, [gl, on]);
  return null;
}

// Landmarks rendered as hand-detailed models (so the generic beam/label is skipped).
const MODELED = new Set(["Seamen's Bethel"]);
// OSM highway types that are not real streets and only added stray pavement to
// the city (driveways, parking-lot aisles, alleys, indoor corridors, etc.).
const SKIP_HIGHWAY = new Set(["service", "construction", "corridor", "track", "proposed", "raceway", "bus_guideway", "busway", "escape"]);
// Playable core (slice-local east, north) — drives building colliders + ped density.
const CORE: [number, number] = [-266, -100];

export function Experience({ onReady, onProgress }: { onReady?: (s: Slice) => void; onProgress?: (f: number) => void }) {
  const [slice, setSlice] = useState<Slice | null>(null);
  const gameId = useGame((s) => s.gameId); // remount per-game props (collectibles) on New Game

  useEffect(() => {
    let alive = true;
    loadSlice("slice-newbedford.json", (f) => { if (alive) onProgress?.(f); })
      .then((s) => {
        if (!alive) return;
        // Drop non-street OSM ways that cluttered the map with stray pavement:
        // service drives/parking aisles/alleys (7k+), plus construction/corridor/
        // track. Real streets, footpaths, and highways are kept.
        s.roads = s.roads.filter((r) => !SKIP_HIGHWAY.has(r.highway));
        setSlice(s);
        useGame.getState().setSlice(s);
        setWaterZones(s.water ?? [], s.roads, s.islands ?? [], s.barrier ?? []);
        onReady?.(s);
      })
      .catch((e) => console.error(e));
    return () => {
      alive = false;
    };
  }, [onReady, onProgress]);

  return (
    <>
      <DayNight />
      <EnvLight />
      <GameSystems />
      <MissionRunner />
      <Consequence />
      <Hazards />

      <Physics gravity={[0, -9.81, 0]}>
        <AerialGround origin={slice?.origin} />
        <Player />
        <Car />
        <Boat />
        {slice && (
          <>
            <Roads roads={slice.roads} />
            <Bridges roads={slice.roads} />
            <StreamingBuildings fallback={slice.buildings} center={CORE} />
            {/* Build 002: real MassGIS roofprints for the New Bedford waterfront */}
            <GisDistrict />
            {/* generic markers, minus landmarks we hand-model */}
            <Landmarks landmarks={slice.landmarks.filter((l) => !MODELED.has(l.name))} />
            {slice.landmarks
              .filter((l) => l.name === "Seamen's Bethel")
              .map((l, i) => (
                <SeamensBethel key={i} landmark={l} />
              ))}
          </>
        )}
        {/* Heroes use RigidBody colliders → must live inside <Physics> */}
        <Heroes />
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
      {slice && slice.water?.length > 0 && (
        <HarborProps polys={slice.water} center={[CORE[0], -CORE[1]]} />
      )}
      {slice && slice.water?.length > 0 && (
        <Waterfront polys={slice.water} center={[CORE[0], -CORE[1]]} />
      )}
      {slice && slice.water?.length > 0 && (
        <PortClutter polys={slice.water} center={[CORE[0], -CORE[1]]} />
      )}
      <Marina />
      <Gulls />
      <CullByDistance center={CORE} radius={820}>
      {slice && <Props roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Awnings roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Crosswalks roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <UtilityPoles roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Decals roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Graffiti roads={slice.roads} buildings={slice.buildings} center={[CORE[0], -CORE[1]]} />}
      {slice && <StreetSigns roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <TrafficLights roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <ParkedCars roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <StreetExtras roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <RoadFixtures roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Foliage roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Fences roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Billboards roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      {slice && <Dumpsters roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
      </CullByDistance>
      {slice && <HurricaneBarrier paths={slice.barrier} />}
      {slice && <StreetLife roads={slice.roads} center={[CORE[0], -CORE[1]]} />}
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
      <Police />
      <Tracers />
      <Impacts />
      <SkidMarks />
      <Rain />
      <Ambient weather="clear" />

      <FollowCamera />
      <FxGate />
      <ShadowGate />
    </>
  );
}
