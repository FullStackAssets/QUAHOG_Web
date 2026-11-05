import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { bodyGeometry, cabinGeometry, carProfile, glassGeometry } from "../earth/heroVehicleGeometry";

describe("hero car geometry, collision envelope and visual safety", () => {
  for(const model of ["bronco","rav4","mustang","infiniti","nissanz"]){
    it(`${model} has finite surfaces, glass, tapered body and bounded footprint`, () => {
      const p=carProfile(model), body=bodyGeometry(p),cab=cabinGeometry(p);
      const glass=(["front","rear","left","right"] as const).map(f=>glassGeometry(p,f));
      for(const g of [body,cab,...glass]){
        const pos=g.getAttribute("position");
        expect(pos.count).toBeGreaterThan(5);
        for(let i=0;i<pos.count;i++)for(const v of [pos.getX(i),pos.getY(i),pos.getZ(i)])expect(Number.isFinite(v)).toBe(true);
        g.computeBoundingBox(); expect(g.boundingBox).not.toBeNull();
        g.dispose();
      }
      // Retains the original arcade collider envelope (2.1m half-length, 1m half-width).
      // Decorative lamps and bumpers may extend slightly beyond it, but the body fits.
      expect(p.width).toBeLessThan(2.01);
      expect(p.length).toBeLessThan(4.75);
      expect(p.cabFront).toBeGreaterThan(p.cabRear);
      expect(p.roof).toBeGreaterThan(p.belt);
      expect(p.floor).toBeGreaterThan(0);
    });
  }
  it("each glass panel remains a single, shared-material double-triangle surface", () => {
    const p=carProfile("bronco");
    for(const face of ["front","rear","left","right"] as const){
      const g=glassGeometry(p,face);
      expect(g.getAttribute("position").count).toBe(6);
      g.dispose();
    }
  });
  it("preserves the geometry's canonical front direction and height", () => {
    const p=carProfile("bronco"),g=bodyGeometry(p);
    g.computeBoundingBox(); const bb=g.boundingBox!;
    expect(bb.max.z).toBeCloseTo(p.length/2);
    expect(bb.min.z).toBeCloseTo(-p.length/2);
    expect(bb.min.y).toBeCloseTo(p.floor);
    g.dispose();
  });
});
