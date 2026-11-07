import { describe, expect, it } from "vitest";
import { SpatialIndex } from "../../sim/SpatialIndex";

describe("SpatialIndex", () => {
  it("buckets items by sector and supports radius queries", () => {
    const idx = new SpatialIndex<{ id: number; x: number; z: number }>({ sectorSize: 10 });
    const a = { id: 1, x: 1, z: 1 };
    const b = { id: 2, x: 25, z: 0 };
    const c = { id: 3, x: 4, z: 3 };
    idx.insert(a, a.x, a.z);
    idx.insert(b, b.x, b.z);
    idx.insert(c, c.x, c.z);

    expect(idx.sectorOf(1, 1)).toEqual({ sx: 0, sz: 0 });
    expect(idx.sectorOf(25, 0)).toEqual({ sx: 2, sz: 0 });

    const near = idx.queryRadius(0, 0, 8, (i) => ({ x: i.x, z: i.z }));
    expect(near.map((i) => i.id).sort()).toEqual([1, 3]);
  });

  it("moves items when re-inserted", () => {
    const idx = new SpatialIndex<string>({ sectorSize: 10 });
    idx.insert("car", 1, 1);
    expect(idx.querySector(1, 1)).toEqual(["car"]);
    idx.insert("car", 55, 55);
    expect(idx.querySector(1, 1)).toEqual([]);
    expect(idx.querySector(55, 55)).toEqual(["car"]);
  });

  it("querySegment returns items near a corridor (LOS)", () => {
    const idx = new SpatialIndex<{ id: string; x: number; z: number }>({ sectorSize: 10 });
    const on = { id: "on", x: 5, z: 0 };
    const off = { id: "off", x: 5, z: 20 };
    const end = { id: "end", x: 10, z: 0 };
    idx.insert(on, on.x, on.z);
    idx.insert(off, off.x, off.z);
    idx.insert(end, end.x, end.z);
    const hit = idx.querySegment(0, 0, 10, 0, 1.5, (i) => ({ x: i.x, z: i.z }));
    expect(hit.map((i) => i.id).sort()).toEqual(["end", "on"]);
  });
});
