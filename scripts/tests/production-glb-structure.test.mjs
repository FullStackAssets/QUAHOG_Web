import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
test('344 source GLBs have structurally valid Meshopt buffers, scenes and embedded dependencies',()=>{
 const r=spawnSync(process.execPath,[join(root,'scripts/audit-glb-models.mjs')],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
 const audit=JSON.parse(r.stdout);
 assert.equal(audit.modelCount,344);
 assert.equal(audit.verified,true);
 assert.equal(audit.invalidModels.length,0);
 assert.equal(audit.externalUriModels.length,0);
 assert.ok(audit.triangleEstimate>0);
 assert.equal(Object.values(audit.packs).reduce((sum,x)=>sum+x.count,0),344);
});
