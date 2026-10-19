import { useMemo } from "react";
import { Vehicle, VEHICLE_TYPES, type VehicleType } from "../earth/Vehicles";
import type { Road } from "../slice";

// Parked cars lining the streets (§7/§12): static vehicles tucked against the
// curb on drivable roads near the core. Capped for performance.

const RADIUS = 240;
const MAX = 46;
const COLORS = ["#7a2a2a", "#2a3a6a", "#caa24a", "#3a5a3a", "#6a6a6a", "#8c6a3a", "#2a6a6a", "#9a9a9a",
  "#5a1f1f", "#c9c2b4", "#3a2a22", "#1f3a2a", "#7a6a30", "#40506a", "#8a8f96", "#b56a3a"];
const DRIVABLE = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street"]);

interface Parked { x: number; z: number; rot: number; type: VehicleType; color: string }

function build(roads: Road[], center: [number, number]): Parked[] {
  const out: Parked[] = [];
  let n = 0;
  for (const r of roads) {
    if (!DRIVABLE.has(r.highway) || r.points.length < 2) continue;
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
        out.push({
          x, z,
          rot: Math.atan2(ux, uz) + (((n * 0.6180339887) % 1) - 0.5) * 0.2, // parked-by-hand yaw jitter
          type: VEHICLE_TYPES[(n * 7) % VEHICLE_TYPES.length],
          color: COLORS[(n * 5) % COLORS.length],
        });
        n++;
        if (out.length >= MAX) return out;
      }
    }
  }
  return out;
}

export function ParkedCars({ roads, center }: { roads: Road[]; center: [number, number] }) {
  const cars = useMemo(() => build(roads, center), [roads, center]);
  return (
    <group>
      {cars.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation-y={c.rot}>
          <Vehicle type={c.type} color={c.color} />
        </group>
      ))}
    </group>
  );
}
