import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const preflight=join(root,'scripts/production-preflight.mjs');
test('production preflight fails closed when live source differs, never writes live files',()=>{
 const t=mkdtempSync(join(tmpdir(),'quahog-live-source-'));
 try {
  const live=join(t,'live');mkdirSync(live);
  const missing=spawnSync(process.execPath,[preflight,'--live-dir',live],{encoding:'utf8'});
  assert.equal(missing.status,1);
  assert.equal(JSON.parse(missing.stdout).verdict,'blocked_pending_reconciliation');
  const protectedList=['package.json','package-lock.json','src/store.ts','src/input.ts','src/shared.ts',
   'src/actors/Car.tsx','src/earth/Vehicles.tsx','src/world/Water.tsx',
   'src/world/MissionRunner.tsx','src/world/HarborProps.tsx','src/world/ParkedCars.tsx',
   'src/world/Props.tsx','src/world/Snowbanks.tsx','src/ui/DebugStats.tsx',
   'src/ui/PerfProbe.tsx','src/mobile/profile.ts','src/world/ProductionGLB.tsx'];
  const modified=Object.keys(JSON.parse(readFileSync(join(root,'scripts/production-baseline.json'))).expectedModified);
  for(const p of new Set([...protectedList,...modified])){mkdirSync(join(live,p.split('/').slice(0,-1).join('/')),{recursive:true});cpSync(join(root,p),join(live,p));}
  let identical=spawnSync(process.execPath,[preflight,'--live-dir',live],{encoding:'utf8'});
  assert.equal(identical.status,0);
  assert.equal(JSON.parse(identical.stdout).verdict,'sources_compatible_review_and_checks_still_required');
  writeFileSync(join(live,'src/store.ts'),readFileSync(join(live,'src/store.ts'),'utf8')+'\n// new production edit\n');
  const changed=spawnSync(process.execPath,[preflight,'--live-dir',live],{encoding:'utf8'});
  assert.equal(changed.status,1);
  assert.ok(JSON.parse(changed.stdout).conflicts.some(x=>x.path==='src/store.ts'));
  assert.ok(readFileSync(join(live,'src/store.ts'),'utf8').endsWith('// new production edit\n'));
 } finally {rmSync(t,{recursive:true,force:true});}
});
