import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildingSeed, dressFootprint, districtStyle, BETHEL_FOOTPRINT } from "../world/districtStyle";
import { buildRibbon, buildSidewalks } from "../world/Roads";
import type { Building, Road } from "../slice";
const building: Building = { footprint: [[1, 1], [15, 1], [15, 9], [1, 9]], height: 8 };

describe("district geometry safety", () => {
  it("keeps identity when a GIS ring changes starting vertex or winding", () => {
    expect(buildingSeed(building)).toBe(buildingSeed({...building, footprint: [...building.footprint].reverse()}));
    expect(districtStyle({...building, name: BETHEL_FOOTPRINT}).kind).toBe("clapboard");
  });
  it("adds facade UVs without changing the hull used by physics", () => {
    const g = new THREE.BoxGeometry(14, 8, 8).translate(8, 4, -5);
    const positions = Array.from(g.getAttribute("position").array);
    const indices = Array.from(g.index!.array);
    dressFootprint(g, building);
    expect(Array.from(g.getAttribute("position").array)).toEqual(positions);
    expect(Array.from(g.index!.array)).toEqual(indices);
    const normal = g.getAttribute("normal"), uv = g.getAttribute("uv");
    for (let i = 0; i < normal.count; i++) if (Math.abs(normal.getY(i)) > 0.5) {
      expect(uv.getX(i)).toBeCloseTo(0.025); expect(uv.getY(i)).toBeCloseTo(0.025);
    }
    g.dispose();
  });
  for (const points of [[[0,0],[20,0]], [[0,0],[0,20]], [[10,10],[-10,-3]]] as [number,number][][]) {
    it(`keeps both sidewalk tops facing the sky for ${JSON.stringify(points)}`, () => {
      const road: Road = {points, name:"test", highway:"residential", width:7};
      const g = buildSidewalks([road], 0.14, 0.1, 2)!;
      const p = g.getAttribute("position"), idx = g.index!;
      let tops = 0;
      for (let i = 0; i < idx.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i));
        const b = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i+1));
        const c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i+2));
        if ([a.y,b.y,c.y].every(y=>Math.abs(y-0.14)<0.001)) {
          expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0); tops++;
        }
      }
      expect(tops).toBe(4); g.dispose();
      const ribbon = buildRibbon([road], 0.06, 0)!;
      for (const n of Array.from(ribbon.getAttribute("normal").array).filter((_,i)=>i%3===1)) expect(n).toBeGreaterThan(0.99);
      ribbon.dispose();
    });
  }
});
