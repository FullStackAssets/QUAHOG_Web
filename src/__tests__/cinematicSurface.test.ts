import { describe, it, expect } from "vitest";
import { exposureFor } from "../world/CinematicExposure";
import { layoutPuddles } from "../world/puddleLayout";
import type { Road } from "../slice";

const roads: Road[] = [
  { name: "Water Street", highway: "residential", width: 8, points: [[-310,-100],[-250,-100],[-190,-105]] },
  { name: "Path", highway: "footway", width: 3, points: [[-280,-104],[-190,-105]] },
  { name: "Bridge", highway: "residential", width: 10, bridge: true, points: [[-250,-99],[-220,-99]] },
];
describe("cinematic mobile surface policies", () => {
  it("bounds puddles and excludes pedestrian ways / bridges", () => {
    const r = layoutPuddles(roads, [-250, 100], 3);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r.length).toBeGreaterThan(0);
    for(const p of r) {
      expect([p.x,p.z,p.rx,p.rz,p.angle].every(Number.isFinite)).toBe(true);
      expect(p.rx).toBeLessThan(2.2);
    }
  });
  it("is deterministic regardless of road input ordering", () => {
    expect(layoutPuddles(roads,[-250,100],22)).toEqual(layoutPuddles([...roads].reverse(),[-250,100],22));
  });
  it("never creates thousands of transparent puddle planes", () => {
    expect(layoutPuddles(roads,[-250,100],1_000_000).length).toBeLessThanOrEqual(128);
    expect(layoutPuddles(roads,[-250,100],-1)).toEqual([]);
  });
  it("exposure remains bounded and brighter at golden hour", () => {
    expect(exposureFor(.24,"clear")).toBeGreaterThan(exposureFor(0,"clear"));
    for(const w of ["clear","rain","fog","snow"] as const)
      for(const d of [-2,0,.3,1,2]) expect(exposureFor(d,w)).toBeGreaterThanOrEqual(.82);
  });
});
