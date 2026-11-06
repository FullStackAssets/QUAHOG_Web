export const VEHICLE_TYPES = ["bronco", "mustang", "infiniti", "nissanz", "rav4"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

const TRAFFIC_COLORS = ["#9c3a3a", "#2f6f7a", "#caa24a", "#3a5a9c", "#5a5a5a", "#8c6a3a"];

export function trafficLook(index: number): { type: VehicleType; color: string } {
  const i = Math.abs(index) | 0;
  return {
    type: VEHICLE_TYPES[i % VEHICLE_TYPES.length],
    color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
  };
}
