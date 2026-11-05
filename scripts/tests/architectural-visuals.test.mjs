import test from "node:test";
import assert from "node:assert/strict";
import { findFrontage, generateArchitecturalDetails } from "../../src/world/architecturalLayout.ts";

function b(x, n, height = 12, name) {
  return { footprint: [[x,n],[x+12,n],[x+12,n+9],[x,n+9]], height, ...(name ? {name}: {}) };
}
test("frontage points outside a GIS building", () => {
  const f = findFrontage(b(0,0));
  assert.ok(f);
  const cx = 6, cz = -4.5;
  assert.ok((f.x - cx) * f.nx + (f.z - cz) * f.nz > 0);
  assert.ok(Math.abs(Math.sin(f.yaw) - f.nx) < 1e-9);
  assert.ok(Math.abs(Math.cos(f.yaw) - f.nz) < 1e-9);
});
test("reject degenerate buildings", () => {
  assert.equal(findFrontage({ footprint: [[1,2],[3,4]], height: 10 }), null);
});
test("details are deterministic across calls", () => {
  const list = [b(0,0), b(21,3,18), b(43,5,8), b(67,7,24)];
  assert.deepEqual(generateArchitecturalDetails(list), generateArchitecturalDetails(list));
});
test("detail identities do not depend on tile ordering", () => {
  const list = Array.from({length:25}, (_,i)=>b(i*19, i*11, 5+i));
  assert.deepEqual(generateArchitecturalDetails(list), generateArchitecturalDetails(list.slice().reverse()));
});
test("details are capped in dense city tiles", () => {
  const list = Array.from({length:300}, (_,i)=>b(i*16, i*10, 5+i%30));
  const details = generateArchitecturalDetails(list, 10);
  assert.ok(details.length <= 10);
  assert.ok(details.length > 0);
});
test("avoid hand-modelled hero landmarks", () => {
  assert.deepEqual(generateArchitecturalDetails([b(0,0,12,"Seamen's Bethel")]), []);
});
test("all transforms are finite and world-aligned", () => {
  const details = generateArchitecturalDetails(Array.from({length:100}, (_,i)=>b(i*19,i*11,5+i%30)));
  assert.ok(details.length > 0);
  for (const d of details) {
    assert.ok(d.position.every(Number.isFinite));
    assert.ok(d.scale.every(v=> Number.isFinite(v) && v>0));
    assert.ok(Number.isFinite(d.rotationY));
  }
});
test("ornament varies by building type", () => {
  const details = generateArchitecturalDetails(Array.from({length:90},(_,i)=>b(i*21,i*13,6+i%30)));
  const kinds = new Set(details.map(x=>x.kind));
  assert.ok(kinds.has("door"));
  assert.ok(kinds.has("storefront"));
  assert.ok(kinds.has("fireLanding"));
  assert.ok(kinds.has("roofTank"));
});

// Defensive checks for the phone profile: render counts, odd polygons, no
// source geometry mutation. Decorative pieces have no physics colliders.
test("low-detail cap is strict for dense urban tiles", () => {
  const list = Array.from({length:150},(_,i)=>b(i*18,i*13,12+i%20));
  assert.ok(generateArchitecturalDetails(list,12).length<=12);
  assert.deepEqual(generateArchitecturalDetails(list,0),[]);
  assert.deepEqual(generateArchitecturalDetails(list,-9),[]);
  assert.deepEqual(generateArchitecturalDetails(list,NaN),[]);
});
test("detail generation does not mutate source geometry", () => {
  const list=[b(0,0),b(16,0,19)];const previous=JSON.stringify(list);
  generateArchitecturalDetails(list,20);
  assert.equal(JSON.stringify(list),previous);
});

test("invalid GIS coordinates cannot create nonfinite decoration transforms", () => {
  assert.equal(findFrontage({footprint:[[1,2],[3,Number.NaN],[5,6]],height:6}),null);
  assert.deepEqual(generateArchitecturalDetails([{footprint:[[1,2],[3,Number.POSITIVE_INFINITY],[5,6]],height:6}]),[]);
});
