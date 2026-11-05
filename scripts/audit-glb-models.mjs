#!/usr/bin/env node
/** Read-only structural inspection of the exact 344 model assets shipped with
 * QUAHOG. This is NOT a Meshopt browser decode, render, or gameplay proof.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(join(root,'public/quahog-assets/manifest/asset-library.json'),'utf8'));
const report={schemaVersion:1,mode:'read_only_structural',modelCount:0,triangleEstimate:0,
 packs:{},missingReferencedAssets:[],invalidModels:[],externalUriModels:[],
  largestModels:[],notes:['No runtime Meshopt decoding or Three.js rendering performed','Triangles are inferred from primitive index/vertex counts, not measured GPU draw calls']};
function assertValid(ok,reason){if(!ok)throw Error(reason)}
for(const m of manifest.models){
 try {
  assertValid(/^\/quahog-assets\/P\d{3}\/[a-zA-Z0-9_-]+\.glb$/.test(m.path),'invalid path');
  const bytes=readFileSync(join(root,'public',m.path.slice(1)));
  const sha=createHash('sha256').update(bytes).digest('hex');
  assertValid(sha===m.sha256 && bytes.length===m.bytes,'manifest hash/byte mismatch');
  assertValid(bytes.length>=28 && bytes.toString('ascii',0,4)==='glTF' && bytes.readUInt32LE(4)===2 && bytes.readUInt32LE(8)===bytes.length,'invalid glb header');
  const jsonBytes=bytes.readUInt32LE(12);
  assertValid(20+jsonBytes+8<=bytes.length && bytes.toString('ascii',16,20)==='JSON','missing JSON chunk');
  const doc=JSON.parse(bytes.subarray(20,20+jsonBytes).toString('utf8'));
  const binaryStart=20+jsonBytes;
  assertValid(bytes.toString('ascii',binaryStart+4,binaryStart+8)==='BIN\0','missing embedded BIN chunk');
  const binarySize=bytes.readUInt32LE(binaryStart);
  assertValid(binaryStart+8+binarySize<=bytes.length,'truncated BIN chunk');
  assertValid(doc.asset?.version==='2.0' && doc.extensionsRequired?.includes('EXT_meshopt_compression'),'missing required Meshopt');
  const sourceBuffer=doc.buffers?.[0];
  assertValid(sourceBuffer && !sourceBuffer.uri && sourceBuffer.byteLength<=binarySize,'compressed buffer is not embedded');
  const accessors=doc.accessors??[];const meshes=doc.meshes??[];
  const views=doc.bufferViews??[];let hasMeshopt=false;
  for(const v of views){
   const ext=v.extensions?.EXT_meshopt_compression;
   if(!ext)continue;
   hasMeshopt=true;
   assertValid(ext.buffer===0 && Number.isInteger(ext.byteOffset) && ext.byteOffset>=0 && ext.byteOffset+ext.byteLength<=sourceBuffer.byteLength,'compressed range out of bounds');
   assertValid(ext.count>0 && ext.byteStride>0,'compressed stride/count invalid');
  }
  assertValid(hasMeshopt,'no compressed buffer views');
  let tris=0;
  for(const mesh of meshes){for(const p of mesh.primitives??[]){
   const idx=p.indices===undefined?p.attributes?.POSITION:p.indices;
   assertValid(Number.isInteger(idx) && idx>=0 && idx<accessors.length,'invalid mesh accessor');
   const n=accessors[idx].count;
   const mode=p.mode??4;
   if(mode===4)tris+=Math.floor(n/3);
   else if(mode===5||mode===6)tris+=Math.max(0,n-2);
  }}
  for(const node of doc.nodes??[]){
   assertValid(node.mesh===undefined || (Number.isInteger(node.mesh) && node.mesh>=0 && node.mesh<meshes.length),'invalid node mesh reference');
   for(const child of node.children??[])assertValid(Number.isInteger(child) && child>=0 && child<(doc.nodes?.length??0),'invalid node child');
  }
  const external=(doc.images??[]).some(img=>img.uri&&!img.uri.startsWith('data:')) || (doc.buffers??[]).some(buf=>buf.uri&&!buf.uri.startsWith('data:'));
  if(external)report.externalUriModels.push(m.path);
  report.modelCount++;report.triangleEstimate+=tris;
  const group=report.packs[m.pack]??={count:0,compressedBytes:0,trianglesEstimated:0};
  group.count++;group.compressedBytes+=bytes.length;group.trianglesEstimated+=tris;
  report.largestModels.push({path:m.path,bytes:bytes.length,trianglesEstimated:tris,meshes:meshes.length});
 }catch(e){report.invalidModels.push({path:m.path,error:String(e.message)});}
}
report.largestModels.sort((a,b)=>b.trianglesEstimated-a.trianglesEstimated);
report.largestModels=report.largestModels.slice(0,12);
report.verified=report.modelCount===manifest.modelCount && report.invalidModels.length===0 && report.externalUriModels.length===0;
const output=process.argv.indexOf('--out');
if(output!==-1 && process.argv[output+1])writeFileSync(resolve(process.argv[output+1]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.verified)process.exitCode=1;
