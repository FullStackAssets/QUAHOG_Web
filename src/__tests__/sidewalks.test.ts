import { describe, expect, it } from "vitest";
import { buildSidewalks } from "../world/Roads";
import type { Road } from "../slice";

describe("sidewalk surface normals", () => {
  it("faces both walking surfaces upward on either road direction", () => {
    for (const points of [[[0,0],[20,0]],[[20,0],[0,0]],[[0,0],[10,15]]] as [number,number][][]) {
      const geometry = buildSidewalks([{ points, width: 8 } as Road], 0.14, 0.1, 2)!;
      const normal = geometry.getAttribute("normal");
      for (const start of [0,8]) for (let i = start; i < start+4; i++) expect(normal.getY(i)).toBeGreaterThan(0.99);
      geometry.dispose();
    }
  });
});
