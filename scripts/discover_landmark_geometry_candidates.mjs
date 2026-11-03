#!/usr/bin/env node
/**
 * Read-only discovery of additional named OSM footprint candidates.
 * It NEVER changes the reference registry or asserts an identity.
 * node scripts/discover_landmark_geometry_candidates.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,"docs/reference-pack/southcoast-landmark-photo-footprint-gates.json"),"utf8"));
const base=path.join(ROOT,"public/tiles");
const clean=s=>(s||"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g," ").trim();
const alias={
 "FR-08":["plumbers supply","plumber supply"],
 "FR-13":["the cove","cove restaurant"],
 "FR-14":["riverview towers","riverview tower"],
 "FR-15":["ships cove","ship s cove","ships cove apartments"],
 "NB-05":[], // unknown identity: never promote a generic "Cove" result
 "NB-06":["andrew robeson house"] // explicit same-name, cross-city guard below
};
const candidates=Object.fromEntries(registry.landmarks.filter(r=>!r.geometry).map(r=>[r.id,[]]));
let tilesScanned=0, namedBuildingsScanned=0;
for(const file of fs.readdirSync(base).filter(x=>/^b_-?\d+_-?\d+\.json$/.test(x))) {
  const buildings=JSON.parse(fs.readFileSync(path.join(base,file),"utf8"));
  tilesScanned++;
  for(const [index,b] of buildings.entries()) {
    if(!b.name || !Array.isArray(b.footprint) || b.footprint.length < 3) continue;
    namedBuildingsScanned++;
    const normalized=clean(b.name);
    const cx=b.footprint.reduce((sum,p)=>sum+p[0],0)/b.footprint.length;
    for(const record of registry.landmarks) {
      if(record.geometry) continue;
      const a=alias[record.id]||[record.name];
      const matches=a.some(v=>normalized===clean(v));
      if(!matches)continue;
      const inCity=record.city==="Fall River" ? cx < -10000 : cx > -10000;
      candidates[record.id].push({file:"public/tiles/"+file,index,name:b.name,
        center_x_m:+cx.toFixed(2),same_city:inCity,
        label_only:true,identity_verified:false,photo_or_frontage_accepted:false});
    }
  }
}
const report={tilesScanned,namedBuildingsScanned,candidates,warning:"Discovery does not establish a parcel match, facade match, source rights, physical height or front elevation."};
if(process.argv.includes("--json")) console.log(JSON.stringify(report,null,2));
else {
  console.log("Scanned "+tilesScanned+" tiles and "+namedBuildingsScanned+" named buildings.");
  for (const [id,items] of Object.entries(candidates)) {
    console.log(id+": "+(items.length ? JSON.stringify(items) : "no exact name-alias candidate; site stays unlinked"));
  }
  console.log(report.warning);
}
