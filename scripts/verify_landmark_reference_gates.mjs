#!/usr/bin/env node
/**
 * Read-only verification of landmark photographic acceptance and named OSM footprints.
 * Run: node scripts/verify_landmark_reference_gates.mjs
 * Run: node scripts/verify_landmark_reference_gates.mjs --json
 *
 * A named OSM polygon is a candidate association, NOT visual or geographic
 * confirmation that a photographed frontage has been matched to the correct edge.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(ROOT, "docs/reference-pack/southcoast-landmark-photo-footprint-gates.json");
const errors = [];
const warn = [];
const assert = (value, message) => { if (!value) errors.push(message); };
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const validPoint = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
const dist2 = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
function pointToSegment(p,a,b) {
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const denom=dx*dx+dy*dy;
  const t=denom ? Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denom)) : 0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function insidePolygon(p, vertices) {
  let hit=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++) {
    const a=vertices[i],b=vertices[j];
    if ((a[1]>p[1]) !== (b[1]>p[1]) &&
        p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
}
function polygonDistance(p, vertices) {
  if(insidePolygon(p,vertices)) return 0;
  let best=Infinity;
  for(let i=0;i<vertices.length;i++) {
    best=Math.min(best,pointToSegment(p,vertices[i],vertices[(i+1)%vertices.length]));
  }
  return best;
}
const registry = JSON.parse(fs.readFileSync(registryPath,"utf8"));
const slice = read("public/slice-newbedford.json");
const records=registry.landmarks || [];
assert(registry.schema === "quahog.landmark-photo-footprint-qa.v1", "unknown registry schema");
assert(registry.target_repository === "FullStackAssets/QUAHOG_Web", "wrong repository");
assert(registry.deploy_authorized === false, "registry cannot authorize deployment");
assert(records.length === 19, "expected 19 distinct reference records");
assert(records.filter(x=>x.city === "Fall River").length === 10, "expected ten Fall River sites");
assert(records.filter(x=>x.city === "New Bedford").length === 9, "expected nine New Bedford sites");
assert(new Set(records.map(x=>x.id)).size === records.length, "duplicate reference ID");
const tileCache = new Map();
const geometryOut = [];
let markerCount = 0, exactNamedGeometry = 0;
for(const rec of records) {
  const prefix=rec.id + ": ";
  assert(rec.verification_state === "BLOCKED_PENDING_PHOTOS_AND_ORIENTATION" ||
    rec.verification_state === "REVIEWED_AND_ACCEPTED",prefix+"invalid verification state");
  assert(typeof rec.address === "string" && rec.address.length > 4,prefix+"missing address/identity note");
  assert(Array.isArray(rec.references) && rec.references.length > 0,prefix+"missing source page");
  assert(Array.isArray(rec.approved_photo_ids),prefix+"missing approved photo IDs");
  const status=rec.photo_acceptance || {};
  for (const shot of ["full_building_frontal","left_elevation","right_elevation","roofline","entrance_and_signage","material_closeup","street_context_both_directions"]) {
    assert(typeof status[shot] === "boolean",prefix+"missing shot gate: "+shot);
  }
  if(rec.source_media_imported) {
    assert(rec.references.some(r=>r.license_reviewed && r.usage_permission_verified),
      prefix+"image import requires explicit source-license and usage-permission review");
  }
  if(rec.marker_name) {
    const found=(slice.landmarks || []).filter(m=>m.name === rec.marker_name);
    assert(found.length === 1,prefix+"expected exactly one matching slice landmark marker");
    markerCount++;
  }
  if(rec.geometry) {
    exactNamedGeometry++;
    const geom=rec.geometry;
    assert(geom.match === "named_polygon_candidate",prefix+"geometry cannot be asserted as photo-matched");
    assert(geom.photo_to_polygon_match_verified === false || geom.front_orientation_verified === true,
      prefix+"cannot verify photo-to-polygon match before frontage orientation");
    assert(typeof geom.tile === "string" && geom.tile.startsWith("public/tiles/b_"),prefix+"invalid tile path");
    if(!tileCache.has(geom.tile)) {
      const bytes=fs.readFileSync(path.join(ROOT,geom.tile));
      const gitBlobSha=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
      tileCache.set(geom.tile,{arr:JSON.parse(bytes.toString("utf8")),sha:gitBlobSha});
    }
    const tile=tileCache.get(geom.tile);
    assert(tile.sha === geom.tile_sha_at_audit,prefix+"building tile blob changed; reconfirm the identity");
    const named=tile.arr.filter(b=>b.name === geom.mesh_name);
    assert(named.length === 1,prefix+"named geometry missing or ambiguous in source tile");
    if(named.length === 1) {
      const fp=named[0].footprint;
      assert(Array.isArray(fp) && fp.length >= 3 && fp.every(validPoint),prefix+"malformed footprint");
      assert(geom.vertex_count === fp.length,prefix+"footprint vertex count changed");
      assert(dist2(geom.first_vertex,fp[0]) < 0.001,prefix+"footprint first vertex changed");
      assert(geom.height_in_source_m === named[0].height,prefix+"tile height changed");
      const cx = fp.reduce((s,p)=>s+p[0],0)/fp.length;
      // Cross-city identity lock: New Bedford and Fall River must not share a
      // same-named OSM polygon (notably the distinct Andrew Robeson houses).
      if(rec.city === "New Bedford") assert(cx > -10000,prefix+"New Bedford record points at a Fall River polygon");
      if(rec.city === "Fall River") assert(cx < -10000,prefix+"Fall River record points at a New Bedford polygon");
      if(geom.front_orientation_verified) {
        assert(Number.isInteger(geom.front_edge_index) && geom.front_edge_index>=0 &&
          geom.front_edge_index<fp.length,prefix+"confirmed front must use a valid edge index");
        assert(typeof geom.frontage_evidence_id === "string" && geom.frontage_evidence_id.length>0,
          prefix+"confirmed front requires evidence reference");
      }
      const marker=(slice.landmarks || []).find(m=>m.name===rec.marker_name);
      const markerGap=marker ? Number(polygonDistance(marker.pos,fp).toFixed(2)) : null;
      if(markerGap !== null && markerGap>25) warn.push(prefix+"landmark marker is "+markerGap+"m outside named polygon");
      geometryOut.push({id:rec.id,mesh_name:geom.mesh_name,tile:geom.tile,vertices:fp.length,marker_to_polygon_distance_m:markerGap,front_edge_confirmed:geom.front_orientation_verified});
    }
  }
  if(status.full_building_frontal) {
    assert(rec.approved_photo_ids.length > 0,prefix+"full-frontal approval requires an approved photo ID");
    assert(rec.references.some(r=>r.full_front_accepted && r.license_reviewed !== undefined),
      prefix+"full-frontal approval requires a matched, reviewed image reference");
  }
  if(rec.verification_state === "REVIEWED_AND_ACCEPTED") {
    assert(status.full_building_frontal,prefix+"accepted landmark lacks entire-building frontal photo");
    assert(rec.geometry?.front_orientation_verified === true,
      prefix+"accepted landmark lacks footprint front-edge orientation check");
    assert(rec.geometry?.photo_to_polygon_match_verified === true,
      prefix+"accepted landmark lacks photo-to-footprint verification");
    assert(rec.geometry?.height_verified === true && rec.geometry?.physical_envelope_verified === true,
      prefix+"accepted landmark lacks measured height and physical envelope QA");
  }
  if(rec.id === "NB-05") {
    assert(rec.site_identity_documented === false && rec.geometry === null && rec.marker_name === null,
      "New Bedford Cove must remain unassigned until its parcel is identified");
  }
}
assert(exactNamedGeometry === 13,"expected thirteen repo-named geometry candidates");
assert(markerCount === 4,"expected four exact named POI matches");
const report={
  audit:"SouthCoast landmark photo-to-footprint gates",records:records.length,
  named_geometry_candidates:exactNamedGeometry,exact_named_markers:markerCount,
  physically_verified_photo_to_polygon:records.filter(x=>x.geometry?.photo_to_polygon_match_verified === true).length,
  frontal_shots_accepted:records.filter(x=>x.photo_acceptance.full_building_frontal === true).length,
  front_edges_confirmed:records.filter(x=>x.geometry?.front_orientation_verified === true).length,
  blocked:records.filter(x=>x.verification_state !== "REVIEWED_AND_ACCEPTED").length,
  geometry:geometryOut,warnings:warn,errors,passed:errors.length===0,
  deployment_performed:false
};
if (process.argv.includes("--json")) console.log(JSON.stringify(report,null,2));
else {
  console.log("Landmarks: "+report.records+"; named polygons: "+exactNamedGeometry+
    "; named markers: "+markerCount+"; accepted fronts: "+report.frontal_shots_accepted);
  for(const g of geometryOut) console.log(g.id+" "+g.mesh_name+" ["+g.tile+"] marker gap="+String(g.marker_to_polygon_distance_m)+"m");
  for(const w of warn) console.warn("WARNING "+w);
  for(const e of errors) console.error("ERROR "+e);
  console.log(errors.length ? "FAILED: data integrity checks" : "PASS: source matches and evidence gates valid; photo acceptance remains blocked");
}
if(errors.length)process.exitCode=1;
