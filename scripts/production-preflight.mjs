#!/usr/bin/env node
/** Read-only, fail-closed production source reconciliation. No deployment.
 * Run ON the current production host with --live-dir before a cutover.
 * A changed file must match either the previous archived handoff or the new
 * package; otherwise there is an unmerged live edit and the operation blocks.
 */
import {readFileSync, existsSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const pkg=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(join(pkg,'scripts/production-baseline.json')));
const protectedPaths=[
 'package-lock.json','src/store.ts','src/input.ts','src/shared.ts',
 'src/actors/Car.tsx','src/earth/Vehicles.tsx','src/world/Water.tsx',
 'src/world/MissionRunner.tsx','src/ui/PerfProbe.tsx','src/mobile/profile.ts'
];
const idx=process.argv.indexOf('--live-dir');
if(idx<0 || !process.argv[idx+1] || process.argv[idx+1].startsWith('--')){
 console.error('usage: node scripts/production-preflight.mjs --live-dir /absolute/current/production/source');
 process.exit(2);
}
const live=resolve(process.argv[idx+1]);
if(!existsSync(live) || !statSync(live).isDirectory() || live===pkg){
 console.error('Live directory must be an existing, separate production source tree');
 process.exit(2);
}
const sha=(p)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const report={schemaVersion:2,readOnly:true,liveDir:live,baselineArchiveSHA256:manifest.baselineArchiveSHA256,
 checkedProtected:0,intentionalUpdates:[],intentionalAdditions:[], conflicts:[],
 verdict:'review_required'};
for(const relative of protectedPaths){
 const expected=join(pkg,relative),observed=join(live,relative);
 if(!existsSync(expected)||!existsSync(observed)){
  report.conflicts.push({path:relative,reason:'protected_file_missing'});continue;
 }
 report.checkedProtected++;
 if(sha(expected)!==sha(observed) && sha(observed)!==manifest.approvedR3?.[relative])
  report.conflicts.push({path:relative,reason:'protected_live_change'});
}
for(const [relative,hashes] of Object.entries(manifest.expectedModified)){
 const shipped=join(pkg,relative),observed=join(live,relative);
 if(!existsSync(shipped)||sha(shipped)!==hashes.afterSHA256){
  report.conflicts.push({path:relative,reason:'package_modified_outside_declared_manifest'});continue;
 }
 if(!existsSync(observed)){
  report.conflicts.push({path:relative,reason:'live_source_missing_cannot_reconcile'});continue;
 }
 const h=sha(observed);
 if(h!==hashes.beforeSHA256&&h!==hashes.afterSHA256&&h!==manifest.approvedR3?.[relative]){
  report.conflicts.push({path:relative,reason:'unmerged_live_change',liveSHA256:h});continue;
 }
 report.intentionalUpdates.push({path:relative,status:h===hashes.afterSHA256?'already_applied':'matches_prior_handoff'});
}
for(const relative of manifest.expectedAdded){
 const shipped=join(pkg,relative),observed=join(live,relative);
 if(!existsSync(shipped)){
  report.conflicts.push({path:relative,reason:'declared_new_file_missing_from_package'});continue;
 }
 if(existsSync(observed)&&sha(shipped)!==sha(observed)&&sha(observed)!==manifest.approvedR3?.[relative]){
  report.conflicts.push({path:relative,reason:'new_path_conflicts_with_live_file'});continue;
 }
 report.intentionalAdditions.push({path:relative,status:existsSync(observed)?'already_applied':'new'});
}
report.verdict=report.conflicts.length?'blocked_pending_reconciliation':'sources_compatible_review_and_checks_still_required';
console.log(JSON.stringify(report,null,2));
if(report.conflicts.length)process.exitCode=1;
