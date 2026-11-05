import { PackGLB } from "../actors/PackGLB";

// P012 story/mission pieces as always-visible scene dressing at mission
// targets. These are location context, NOT mission-state gated: they mark
// where a story beat happens, and gating them on the active step is future
// work. All offsets (2-4 m) keep props out from under the player's feet at
// the exact target point. Nothing here has a collider, so no prop can block
// a mission step or a route.
//
// Anchors (from mission.ts):
//   Bethel opener            [-272.23, 106.5]   r10
//   Off the Hook pickup      [6092, 4485]      r16 (dock top 0.75)
//   Quohog Republic          [-240, 122]       r16
//   Safehouse                [-188, 40]        r12
//   Borden House meeting     [-19599, -7080]   r18
//   Battleship Cove finale   [-20000, -7400]   r40
//   Downtown blizzard drop   [-560, 90]        r55
export interface StoryItem {
  path: string;
  x: number; y: number; z: number; rot: number;
  anchor: [number, number];
  radius: number;
}

export const STORY_ITEMS: StoryItem[] = [
  // Seamen's Bethel — the opener's meeting place.
  { path: "destination_plaque", x: -269.7, y: 0, z: 108, rot: 0.4, anchor: [-272.23, 106.5], radius: 10 },
  { path: "genealogy_frame_blank", x: -274.2, y: 0, z: 109, rot: -0.3, anchor: [-272.23, 106.5], radius: 10 },
  { path: "photo_frame_blank", x: -275.7, y: 0, z: 105.5, rot: 0.9, anchor: [-272.23, 106.5], radius: 10 },
  // Off the Hook — the Linguiça pickup, on the dock (top 0.75).
  { path: "pickup_parcel", x: 6092, y: 0.8, z: 4485, rot: 0.2, anchor: [6092, 4485], radius: 16 },
  // Quohog Republic — the handoff point.
  { path: "handoff_bag", x: -238, y: 0, z: 124, rot: -0.5, anchor: [-240, 122], radius: 16 },
  // Safehouse — the go-to-ground sign.
  { path: "safehouse_sign", x: -186, y: 0, z: 42, rot: 0.3, anchor: [-188, 40], radius: 12 },
  // Borden House — the Lady's man leaves evidence at the meeting.
  { path: "evidence_folder_stack", x: -19597, y: 0, z: -7078, rot: 0.6, anchor: [-19599, -7080], radius: 18 },
  { path: "maplecroft_gate_plaque", x: -19601, y: 0, z: -7082, rot: -0.4, anchor: [-19599, -7080], radius: 18 },
  // Battleship Cove — the finale's cordon.
  { path: "crime_barricade", x: -19997, y: 0, z: -7397, rot: 0.2, anchor: [-20000, -7400], radius: 40 },
  { path: "evidence_marker", x: -20003, y: 0, z: -7403, rot: 1.1, anchor: [-20000, -7400], radius: 40 },
  { path: "searchlight_tripod", x: -19996, y: 0, z: -7404, rot: -0.7, anchor: [-20000, -7400], radius: 40 },
  { path: "closure_gate", x: -20004, y: 0, z: -7396, rot: 0.5, anchor: [-20000, -7400], radius: 40 },
  { path: "ticket_booth", x: -19993, y: 0, z: -7398, rot: 0.0, anchor: [-20000, -7400], radius: 40 },
  // Downtown blizzard delivery — the relief drop.
  { path: "relief_supply_box", x: -558, y: 0, z: 92, rot: 0.3, anchor: [-560, 90], radius: 55 },
  { path: "emergency_heater", x: -562, y: 0, z: 88, rot: -0.6, anchor: [-560, 90], radius: 55 },
  { path: "generator_portable", x: -557, y: 0, z: 87, rot: 0.8, anchor: [-560, 90], radius: 55 },
  { path: "fuel_canister", x: -563, y: 0, z: 93, rot: 0.1, anchor: [-560, 90], radius: 55 },
];

export function StoryProps() {
  return (
    <group>
      {STORY_ITEMS.map((item, i) => (
        <group key={i} position={[item.x, item.y, item.z]} rotation-y={item.rot}>
          <PackGLB path={`/packs/pack012/${item.path}.glb`} />
        </group>
      ))}
    </group>
  );
}
