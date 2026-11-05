#!/usr/bin/env node
/** Read-only entire shipped production source reconciliation against the
 * previous authenticated handoff. This supplements the focused preflight.
 * Missing/different tracked files are blockers; newly added files are allowed
 * only if absent or exact-byte identical. It does not deploy or mutate files.
 */
import {readFileSync, existsSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(join(root,'scripts/production-fulltree-baseline.json'),'utf8'));
const idx=process.argv.indexOf('--live-dir');
if(idx<0||!process.argv[idx+1]||process.argv[idx+1].startsWith('--')){
 console.error('usage: node scripts/production-fulltree-preflight.mjs --live-dir /actual/current/production/source');process.exit(2);
}
const live=resolve(process.argv[idx+1]);
if(!existsSync(live)||!statSync(live).isDirectory()||live===root){console.error('Live source directory must be existing, separate from package');process.exit(2);}
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const report={schemaVersion:1,readOnly:true,scope:'all_prior_package_source_paths',basePackage:manifest.basePackage,
 trackedCount:0,matchingPrior:0,matchingIntermediate:0,alreadyUpdated:0,newAdded:0,conflicts:[],verdict:'review_required'};
for(const [p,before] of Object.entries(manifest.before)){
 report.trackedCount++;
 const shipped=join(root,p),current=join(live,p);
 const after=manifest.after[p];
 if(!after||!existsSync(shipped)||sha(shipped)!==after){report.conflicts.push({path:p,reason:'packaged_file_mismatch'});continue;}
 if(!existsSync(current)||!statSync(current).isFile()){report.conflicts.push({path:p,reason:'live_tracked_file_missing'});continue;}
 const observed=sha(current);
 if(observed===before)report.matchingPrior++;
 else if(observed===after)report.alreadyUpdated++;
 else if(observed===manifest.intermediates?.[p]) report.matchingIntermediate++;
 else if(observed===manifest.intermediates?.[p]) report.matchingIntermediate++;
 else if(observed===manifest.intermediates?.[p]) report.matchingIntermediate++;
 else report.conflicts.push({path:p,reason:'live_version_not_in_authenticated_lineage',sha256:observed});
}
for(const [p,after] of Object.entries(manifest.added)){
 const shipped=join(root,p),current=join(live,p);
 if(!existsSync(shipped)||sha(shipped)!==after){report.conflicts.push({path:p,reason:'packaged_new_file_mismatch'});continue;}
 if(existsSync(current)&&(!statSync(current).isFile()||(![after,manifest.addedIntermediates?.[p]].includes(sha(current)))))report.conflicts.push({path:p,reason:'new_file_conflicts_with_live'});
 else report.newAdded++;
}
report.verdict=report.conflicts.length?'BLOCK_PRODUCTION_UNRECONCILED':'SOURCE_PATHS_RECONCILED_REQUIRE_BUILD_AND_DEVICE_QA';
console.log(JSON.stringify(report,null,2));
if(report.conflicts.length)process.exitCode=1;
