import { WheelRig } from "./WheelRig";
import { usePackGLB } from "./packLoader";

// A pack car driving in traffic (also reused for the player car after a
// steal/enter — see <Car>), with spinning wheels. The traffic car's own
// speed (not the player car's shared.carSpeed) drives WheelRig, so a
// braking or yielding car stops its wheels instead of spinning at the
// player's pace. Visual only: the traffic logic (type, collider, steal)
// still keys off the logic type the car was spawned with.
export function TrafficPackCar({
  pack,
  wheelR,
  getSpeed,
}: {
  pack: string;
  wheelR: number;
  /** Speed source in m/s. Traffic passes its own speed; <Car> passes
   *  () => shared.carSpeed for the player car. */
  getSpeed: () => number;
}) {
  const { scene } = usePackGLB(pack);
  if (!scene) return null;
  return (
    <>
      <primitive object={scene} />
      <WheelRig scene={scene} wheelR={wheelR} getSpeed={getSpeed} />
    </>
  );
}
