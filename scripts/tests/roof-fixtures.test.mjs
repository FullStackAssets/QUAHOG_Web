import test from "node:test";
import assert from "node:assert/strict";
import {selectRoofFixtures} from "../../src/world/roofFixtures.ts";
const building=(i, height=12) => ({footprint:[[i*14,0],[i*14+10,0],[i*14+10,7],[i*14,7]],height});
test("roof silhouette counts are bounded across presets",()=>{
 const list=Array.from({length:180},(_,i)=>building(i,7+i%39));
 assert.equal(selectRoofFixtures(list,10).length,10);
 assert.equal(selectRoofFixtures(list,32).length,32);
 assert.equal(selectRoofFixtures(list,90).length,90);
 assert.deepEqual(selectRoofFixtures(list,-8),[]);
 assert.deepEqual(selectRoofFixtures(list,Number.NaN),[]);
});
test("low is a deterministic subset of medium and high across reorder",()=>{
 const list=Array.from({length:160},(_,i)=>building(i,7+i%30));
 const low=selectRoofFixtures(list,10);
 assert.deepEqual(low,selectRoofFixtures(list.slice().reverse(),10));
 assert.deepEqual(low,selectRoofFixtures(list,32).slice(0,10));
 assert.deepEqual(low,selectRoofFixtures(list,90).slice(0,10));
});
test("invalid, tiny, and out-of-range buildings never produce fixtures",()=>{
 const invalid=[{footprint:[[0,1],[0,2]],height:10}, {footprint:[[0,0],[0,NaN],[10,10]],height:12},
 {footprint:[[0,0],[10,0],[10,10]],height:Infinity}, building(4,6), building(5,46)];
 assert.deepEqual(selectRoofFixtures(invalid,90),[]);
});
test("fixture generator does not mutate source GIS polygons",()=>{
 const b=[building(2),building(3,23)];const before=JSON.stringify(b);
 const output=selectRoofFixtures(b,5);
 assert.equal(JSON.stringify(b),before);
 assert.ok(output.every(f=>f.position.every(Number.isFinite) && Number.isFinite(f.seed)));
});
