import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  FACADE_ANISOTROPY,
  FACADE_FLOOR_M,
  FACADE_GLASS_ROUGHNESS,
  FACADE_METALNESS,
  FACADE_OPENING,
  FACADE_RELIEF_SCALE,
  FACADE_WALL_ROUGHNESS,
  PLAIN_FACADE_UV,
  facadeBlockoutGlow,
  paintFacadeAttributes,
  facadeRasterSample,
  facadeReliefImage,
  facadeRoughnessImage,
  facadeStreamGlow,
  facadeTexelOffset,
  facadeUv,
  sampleFacade,
  writeFacadeVertex,
} from "./facadeSurface";

const GLASS_UV: [number, number] = [0.32, 0.3];

describe("facade PBR surfaces", () => {
  it("keeps paint, masonry, and glass dielectric", () => {
    const points: [number, number][] = [
      [PLAIN_FACADE_UV, PLAIN_FACADE_UV],
      GLASS_UV,
      [(FACADE_OPENING.u0 + FACADE_OPENING.u1) / 2, (FACADE_OPENING.v0 + FACADE_OPENING.v1) / 2],
      [FACADE_OPENING.u0 - 0.01, 0.45],
      [0.5, FACADE_OPENING.v0 - 0.015],
    ];
    for (const [u, v] of points) {
      expect(sampleFacade(u, v).metalness).toBe(FACADE_METALNESS);
    }
  });

  it("samples bare wall at the roof texel", () => {
    const s = sampleFacade(PLAIN_FACADE_UV, PLAIN_FACADE_UV);
    expect(s.zone).toBe("wall");
    expect(s.roughness).toBe(FACADE_WALL_ROUGHNESS);
    expect(Math.abs(s.normal[0])).toBeLessThan(0.05);
    expect(s.normal[2]).toBeGreaterThan(0.95);
  });

  it("makes glass smoother than the wall without turning it into a mirror", () => {
    const glass = sampleFacade(...GLASS_UV);
    const wall = sampleFacade(PLAIN_FACADE_UV, PLAIN_FACADE_UV);
    expect(glass.zone).toBe("glass");
    expect(glass.roughness).toBe(FACADE_GLASS_ROUGHNESS);
    expect(glass.roughness).toBeGreaterThan(0.2);
    expect(glass.roughness).toBeLessThan(wall.roughness);
  });

  it("treats the opening center as a muntin", () => {
    const { u0, u1, v0, v1 } = FACADE_OPENING;
    expect(sampleFacade((u0 + u1) / 2, (v0 + v1) / 2).zone).toBe("frame");
  });

  it("tilts the left jamb toward the opening", () => {
    const s = sampleFacade(FACADE_OPENING.u0 - 0.01, 0.45);
    expect(s.zone).toBe("frame");
    expect(s.normal[0]).toBeGreaterThan(0.3);
    expect(s.normal[2]).toBeGreaterThan(0.5);
  });

  it("points the sill upward", () => {
    const s = sampleFacade(0.5, FACADE_OPENING.v0 - 0.015);
    expect(s.zone).toBe("sill");
    expect(s.normal[1]).toBeGreaterThan(0.3);
  });

  it("stores roughness in the green channel, glass below wall", () => {
    const size = 128;
    const img = facadeRoughnessImage(size);
    const wallO = facadeTexelOffset(PLAIN_FACADE_UV, PLAIN_FACADE_UV, size);
    const glassO = facadeTexelOffset(GLASS_UV[0], GLASS_UV[1], size);
    const glass = facadeRasterSample(GLASS_UV[0], GLASS_UV[1], size);
    expect(img[glassO + 1]).toBe(Math.round(glass.roughness * 255));
    expect(img[glassO + 1]).toBeLessThan(img[wallO + 1]);
    expect(img[glassO]).toBe(img[glassO + 1]);
  });

  it("encodes the jamb relief and is deterministic", () => {
    const size = 64;
    const a = facadeReliefImage(size);
    const b = facadeReliefImage(size);
    expect(a).toEqual(b);
    const u = FACADE_OPENING.u0 - 0.01;
    const o = facadeTexelOffset(u, 0.45, size);
    const sample = facadeRasterSample(u, 0.45, size);
    expect(sample.zone).toBe("frame");
    expect(sample.normal[0]).toBeGreaterThan(0);
    const enc = (n: number) => Math.round((n * 0.5 + 0.5) * 255);
    expect(a[o]).toBe(enc(sample.normal[0]));
    expect(a[o + 1]).toBe(enc(sample.normal[1]));
    expect(a[o + 2]).toBe(enc(sample.normal[2]));
  });

  it("puts high v at the top of the image buffer", () => {
    expect(facadeTexelOffset(0.5, 0.99, 128)).toBeLessThan(facadeTexelOffset(0.5, 0.02, 128));
  });

  it("tiles wall UVs by floor and parks roofs on the plain texel", () => {
    expect(facadeUv(10, 3, -4, 0, 1, 0)).toEqual([PLAIN_FACADE_UV, PLAIN_FACADE_UV]);
    expect(facadeUv(10, 3.2, -4, 1, 0, 0)).toEqual([-4 / FACADE_FLOOR_M, 3.2 / FACADE_FLOOR_M]);
    expect(facadeUv(10, 6.4, -4, 0, 0, 1)).toEqual([10 / FACADE_FLOOR_M, 6.4 / FACADE_FLOOR_M]);
  });

  it("writes roof color with plain UVs and wall color with floor UVs", () => {
    const colors = new Float32Array(6);
    const uv = new Float32Array(4);
    const wall = { r: 1, g: 0, b: 0 };
    const roof = { r: 0, g: 0, b: 1 };
    writeFacadeVertex(0, 1, 8, 2, 0, 1, 0, wall, roof, colors, uv);
    writeFacadeVertex(1, 9, 2, 5, 1, 0, 0, wall, roof, colors, uv);
    expect(colors[2]).toBe(1);
    expect(uv[0]).toBeCloseTo(PLAIN_FACADE_UV);
    expect(uv[1]).toBeCloseTo(PLAIN_FACADE_UV);
    expect(colors[3]).toBe(1);
    // X-facing wall tiles along Z, not along X.
    expect(uv[2]).toBeCloseTo(5 / FACADE_FLOOR_M);
    expect(uv[3]).toBeCloseTo(2 / FACADE_FLOOR_M);
  });

  it("keeps blockout windows dark through the day and on at night", () => {
    expect(facadeBlockoutGlow(1)).toBe(0);
    expect(facadeBlockoutGlow(0.3)).toBe(0);
    expect(facadeBlockoutGlow(0)).toBe(1);
    expect(facadeBlockoutGlow(0.15)).toBeCloseTo(0.5);
  });

  it("keeps the streamed window ramp linear", () => {
    expect(facadeStreamGlow(1)).toBe(0);
    expect(facadeStreamGlow(0)).toBe(1);
    expect(facadeStreamGlow(0.25)).toBeCloseTo(0.75);
  });

  it("paints an extruded shell without moving vertices, and keeps windows off the roof", () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(10, 0);
    shape.lineTo(10, 8);
    shape.lineTo(0, 8);
    shape.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 12, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const before = Float32Array.from(g.attributes.position.array);
    g.computeVertexNormals();
    const painted = paintFacadeAttributes(
      g.attributes.position,
      g.attributes.normal,
      { r: 0.5, g: 0.2, b: 0.1 },
      { r: 0.1, g: 0.1, b: 0.1 },
    );
    expect(Float32Array.from(g.attributes.position.array)).toEqual(before);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    let walls = 0;
    let roofs = 0;
    for (let i = 0; i < pos.count; i++) {
      const u = painted.uv[i * 2];
      const v = painted.uv[i * 2 + 1];
      if (Math.abs(nor.getY(i)) > 0.5) {
        roofs += 1;
        expect(u).toBeCloseTo(PLAIN_FACADE_UV);
        expect(v).toBeCloseTo(PLAIN_FACADE_UV);
        expect(painted.color[i * 3]).toBeCloseTo(0.1);
      } else {
        walls += 1;
        expect(v).toBeCloseTo(pos.getY(i) / FACADE_FLOOR_M);
        expect(painted.color[i * 3]).toBeCloseTo(0.5);
      }
    }
    expect(walls).toBeGreaterThan(0);
    expect(roofs).toBeGreaterThan(0);
  });

  it("caps relief scale and anisotropy below the unmeasured-device danger zone", () => {
    expect(FACADE_RELIEF_SCALE).toBeGreaterThan(0.4);
    expect(FACADE_RELIEF_SCALE).toBeLessThan(1);
    expect(FACADE_ANISOTROPY).toBeLessThanOrEqual(8);
  });
});
