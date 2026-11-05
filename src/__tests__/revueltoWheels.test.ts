import { describe, expect, it } from "vitest";
import glbRaw from "../../public/assets/cars/revuelto_game.glb?raw";

// Revuelto floating-wheels regression (2026-11-03 playtest, bundle
// main-BdbDcIOB.js): the mount's wheel merge parked the old quadrant
// wheel meshes on static wheel_trim_* nodes with identity transform,
// dropping the 90-degree Y rotation the old fl/rl nodes carried — so two
// 2.22 m tire-material tubes rendered ALONG the car, outboard of the body,
// reading on device as floating tire rings. The fix detaches trim_fl/rl;
// this test pins the shipped GLB's reachable scene graph so the tubes can
// never come back, and pins the clean wheels (pivot, ground contact,
// matched front/rear pairs — the same audit caught a crossed stagger:
// front pair 0.744 vs 0.803 before the fix).
// Only the JSON chunk is parsed: the header/BIN bytes may not survive the
// ?raw UTF-8 read, but the JSON chunk is ASCII, so brace-matching from the
// first '{' recovers it exactly.

type GltfNode = {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};
type Gltf = {
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { primitives: { attributes: { POSITION: number } }[] }[];
  accessors: { min?: number[]; max?: number[] }[];
};

function parseGltfJson(raw: string): Gltf {
  const start = raw.indexOf("{");
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  expect(end).toBeGreaterThan(start);
  return JSON.parse(raw.slice(start, end)) as Gltf;
}

const gltf = parseGltfJson(glbRaw as unknown as string);

function reachableNames(g: Gltf): Set<string> {
  const seen = new Set<number>();
  const names = new Set<string>();
  const walk = (i: number) => {
    if (seen.has(i)) return;
    seen.add(i);
    const n = g.nodes[i];
    if (n.name) names.add(n.name);
    for (const c of n.children ?? []) walk(c);
  };
  for (const r of g.scenes[0].nodes) walk(r);
  return names;
}

function wheelWorld(g: Gltf, name: string) {
  const idx = g.nodes.findIndex((n) => n.name === name);
  expect(idx, `missing node ${name}`).toBeGreaterThanOrEqual(0);
  const node = g.nodes[idx];
  expect(node.mesh, `${name} has no mesh`).toBeDefined();
  const mesh = g.meshes[node.mesh!];
  // Ancestors are identity (root + wheel node carry no rotation/scale in
  // the shipped file), so world = translation + local bbox.
  const t = node.translation ?? [0, 0, 0];
  const prims = mesh.primitives.map((p) => {
    const a = g.accessors[p.attributes.POSITION];
    expect(a.min, `${name} prim missing min`).toBeDefined();
    expect(a.max, `${name} prim missing max`).toBeDefined();
    return a;
  });
  const centre = (a: (typeof prims)[number]) => [
    (a.min![0] + a.max![0]) / 2,
    (a.min![1] + a.max![1]) / 2,
    (a.min![2] + a.max![2]) / 2,
  ];
  const minY = Math.min(...prims.map((a) => a.min![1])) + t[1];
  const dia = Math.max(
    ...prims.map((a) => a.max![2] - a.min![2]),
  );
  return { prims, centre, minY, dia };
}

describe("revuelto wheels: no floating trim tubes", () => {
  it("wheel_trim_fl/rl are not reachable from the scene", () => {
    const names = reachableNames(gltf);
    expect(names.has("wheel_trim_fl")).toBe(false);
    expect(names.has("wheel_trim_rl")).toBe(false);
    for (const w of ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"]) {
      expect(names.has(w), `missing ${w}`).toBe(true);
    }
  });

  it("clean wheels pivot at their node origin and touch the ground", () => {
    for (const w of ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"]) {
      const { prims, centre, minY } = wheelWorld(gltf, w);
      for (const a of prims) {
        const c = centre(a);
        expect(Math.hypot(...c)).toBeLessThanOrEqual(0.01);
      }
      expect(Math.abs(minY)).toBeLessThanOrEqual(0.01);
    }
  });

  it("front pair matches and rear pair matches (no crossed stagger)", () => {
    const fl = wheelWorld(gltf, "wheel_fl").dia;
    const fr = wheelWorld(gltf, "wheel_fr").dia;
    const rl = wheelWorld(gltf, "wheel_rl").dia;
    const rr = wheelWorld(gltf, "wheel_rr").dia;
    expect(Math.abs(fl - fr)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(rl - rr)).toBeLessThanOrEqual(0.01);
  });
});
