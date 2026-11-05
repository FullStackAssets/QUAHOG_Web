import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceBasisRotation, shouldRenderDetailedModel, detailedHarborBoatLimit,
  ASSET_LOAD_CONCURRENCY, ASSET_FAILURE_BACKOFF_MS, GLB_VEHICLE_X_ROTATION,
  mobileModelRadius, streetDetailLimit} from '../../src/world/AssetRuntimePolicy.ts';
import {insidePolygon, waterSide} from '../../src/world/shorelinePlacement.ts';
const src = resolve(fileURLToPath(new URL('.',import.meta.url)), '../..');
const asset = (p) => resolve(src, 'public/quahog-assets',p);
const glb = (p) => {const b=readFileSync(asset(p));return JSON.parse(b.subarray(20, 20+b.readUInt32LE(12)).toString('utf8'));};
const posBounds = (j, name) => {
 const n=j.nodes.find(n => n.name===name); assert.ok(n,`missing node ${name}`);
 const mesh=j.meshes[n.mesh];return j.accessors[mesh.primitives[0].attributes.POSITION];
};
test('P006 GLB body uses source +Y forward and -Z vertical, corrected by runtime X rotation',()=>{
 for(const name of ['economy_sedan','patrol_cruiser','pickup_crew','taxi_sedan']){
  const j=glb(`P006/${name}.glb`);const body=posBounds(j,'body');
  const extent=body.max.map((v,i)=>v-body.min[i]);
  assert.ok(extent[1]>extent[0]*1.8,`model ${name} not longitudinal along +Y`);
  assert.ok(sourceBasisRotation(`/quahog-assets/P006/${name}.glb`)[0]===GLB_VEHICLE_X_ROTATION);
 }
 assert.deepEqual(sourceBasisRotation('/quahog-assets/P003/inshore_dragger.glb'),[0,0,0]);
});
test('detail-radius hysteresis prevents popping and rejects invalid distances',()=>{
 assert.equal(shouldRenderDetailedModel(170,false,175),true);
 assert.equal(shouldRenderDetailedModel(190,false,175),false);
 assert.equal(shouldRenderDetailedModel(190,true,175),true);
 assert.equal(shouldRenderDetailedModel(200,true,175),false);
 assert.equal(shouldRenderDetailedModel(Infinity,true,175),false);
 assert.equal(ASSET_LOAD_CONCURRENCY,3);
 assert.ok(ASSET_FAILURE_BACKOFF_MS>=10_000);
});
test('mobile boat details capped independently of physical boats',()=>{
 assert.deepEqual([0,1,2].map(q=>detailedHarborBoatLimit(q,true)),[2,5,8]);
 assert.deepEqual([0,1,2].map(q=>detailedHarborBoatLimit(q,false)),[5,10,16]);
});
test('newly referenced GLBs are present in production asset manifest',()=>{
 const manifest=JSON.parse(readFileSync(resolve(src,'public/quahog-assets/manifest/asset-library.json')));
 const paths=new Set(manifest.models.map(x=>x.path));
 for (const file of ['P011/streetlight_cobrahead.glb','P001/lamppost.glb','P001/fire_hydrant.glb','P011/bench_metal_wood.glb',
  'P003/inshore_dragger.glb','P003/lobster_workboat.glb','P003/scallop_dragger.glb','P003/dockside_skiff.glb',
  'P006/economy_sedan.glb','P006/patrol_cruiser.glb','P006/pickup_crew.glb','P006/taxi_sedan.glb',
  'P007/snowbank_medium.glb','P007/snowbank_small.glb','P007/plowed_berm.glb','P007/sidewalk_snow_pile.glb',
  'P012/harbor_tool_crate.glb'])
   assert.ok(paths.has(`/quahog-assets/${file}`),`missing referenced asset ${file}`);
});

test('shoreline vessel placement is independent of polygon winding',()=>{
 const ccw=[[0,0],[30,0],[30,20],[0,20]];
 const cw=[...ccw].reverse();
 assert.ok(insidePolygon([15,10],ccw));
 assert.ok(!insidePolygon([15,40],ccw));
 assert.equal(waterSide([0,0],[30,0],ccw),1);
 assert.equal(waterSide([30,0],[0,0],cw),-1);
 assert.equal(waterSide([100,0],[120,0],ccw),0);
});


test('mobile distance and street detail budgets are monotone and leave desktop unchanged',()=>{
 assert.deepEqual([0,1,2].map(q=>Math.round(mobileModelRadius(200,q,true))),[110,150,200]);
 assert.equal(mobileModelRadius(200,0,false),200);
 assert.deepEqual([0,1,2].map(q=>streetDetailLimit(q,true)),[2,4,6]);
 assert.deepEqual([0,1,2].map(q=>streetDetailLimit(q,false)),[4,6,8]);
 assert.equal(mobileModelRadius(Infinity,1,true),0);
 assert.equal(mobileModelRadius(-10,1,true),0);
});

test('coastal trees and postal model replacements exist in verified manifest',()=>{
 const manifest=JSON.parse(readFileSync(resolve(src,'public/quahog-assets/manifest/asset-library.json')));
 const paths=new Set(manifest.models.map(x=>x.path));
 for(const n of ['coastal_pine','red_oak','linden_street','postal_letterbox'])
  assert.ok(paths.has(`/quahog-assets/P011/${n}.glb`));
});

test('wharf gear lands opposite verified water side on simple shoreline',()=>{
 const ring=[[0,0],[60,0],[60,30],[0,30]];
 const start=[0,0],end=[60,0];const wet=waterSide(start,end,ring);
 assert.equal(wet,1);
 const ux=1,uz=0,x=15,z=0;
 const boat=[x-uz*14*wet,z+ux*14*wet];
 const gear=[x+uz*3*wet,z-ux*3*wet];
 assert.equal(insidePolygon(boat,ring),true);
 assert.equal(insidePolygon(gear,ring),false);
});
