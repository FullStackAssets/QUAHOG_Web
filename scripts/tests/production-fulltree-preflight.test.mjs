import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, cpSync, mkdirSync, rmSync, appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const cli=join(root,'scripts/production-fulltree-preflight.mjs');
test('full-tree preflight accepts identical current source and blocks an altered protected file',()=>{
 const scratch=mkdtempSync(join(tmpdir(),'quahog-fulltree-'));
 const live=join(scratch,'production-source');
 try{
  // Reuse exact shipped bytes. No network, no deployment, no mutating source.
  cpSync(root,live,{recursive:true,filter:p=>!p.includes('/node_modules/')&&!p.endsWith('/node_modules')&&!p.includes('/dist/')});
  const clean=spawnSync(process.execPath,[cli,'--live-dir',live],{encoding:'utf8'});
  assert.equal(clean.status,0,clean.stdout||clean.stderr);
  assert.equal(JSON.parse(clean.stdout).verdict,'SOURCE_PATHS_RECONCILED_REQUIRE_BUILD_AND_DEVICE_QA');
  appendFileSync(join(live,'src/store.ts'),'\n// simulated unmerged live modification\n');
  const corrupt=spawnSync(process.execPath,[cli,'--live-dir',live],{encoding:'utf8'});
  assert.equal(corrupt.status,1);
  const report=JSON.parse(corrupt.stdout);
  assert.equal(report.verdict,'BLOCK_PRODUCTION_UNRECONCILED');
  assert.ok(report.conflicts.some(x=>x.path==='src/store.ts'));
 }finally{rmSync(scratch,{recursive:true,force:true});}
});
