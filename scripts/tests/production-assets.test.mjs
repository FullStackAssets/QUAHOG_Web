import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "../..");
const registry = JSON.parse(readFileSync(resolve(app,"public/quahog-assets/manifest/asset-library.json"), "utf8"));
const expected = {P001:22,P003:61,P006:52,P007:43,P010:50,P011:81,P012:35};
if (JSON.stringify(registry.packCounts)!==JSON.stringify(expected)) throw new Error("Pack counts wrong");
if (registry.modelCount!==344 || registry.pngTextureSourceCount!==150) throw new Error("Asset totals wrong");
const paths = new Set();
for (const model of registry.models) {
  if (paths.has(model.path)) throw new Error(`Duplicate path ${model.path}`);
  paths.add(model.path);
  const full = resolve(app,"public",model.path.slice(1));
  const buf = readFileSync(full);
  if (buf.toString("ascii",0,4)!=="glTF" || buf.readUInt32LE(4)!==2 || buf.readUInt32LE(8)!==buf.length) throw new Error(`Invalid GLB ${model.path}`);
  const chunkLength=buf.readUInt32LE(12);
  const doc=JSON.parse(buf.subarray(20,20+chunkLength).toString("utf8"));
  if (!doc.extensionsRequired?.includes("EXT_meshopt_compression")) throw new Error(`Meshopt declaration missing: ${model.path}`);
  if (buf.length!==model.bytes || createHash("sha256").update(buf).digest("hex")!==model.sha256) throw new Error(`Bad hash ${model.path}`);
}
const textures=JSON.parse(readFileSync(resolve(app,'public/quahog-assets/manifest/texture-library.json')));
if(textures.imageCount!==150 || textures.images.length!==150)throw new Error('Texture manifest count mismatch');
const listed=new Map(textures.images.map(x=>[x.path,x]));
if(listed.size!==150)throw new Error('Duplicate texture paths');
const pngFiles = readdirSync(resolve(app,"public/quahog-assets/P010")).filter(x=>x.endsWith(".png"));
if (pngFiles.length!==registry.pngTextureSourceCount) throw new Error(`Texture PNG count wrong: ${pngFiles.length}`);
for(const file of pngFiles) {
 const buf=readFileSync(resolve(app,"public/quahog-assets/P010",file));
 if (buf.length<24 || buf.subarray(0,8).toString("hex")!=="89504e470d0a1a0a" ||
     buf.subarray(12,16).toString("ascii")!=="IHDR" ||
     buf.readUInt32BE(16)===0 || buf.readUInt32BE(20)===0)
   throw new Error(`Invalid texture PNG ${file}`);
 const record=listed.get(`/quahog-assets/P010/${file}`);
 if(!record || record.bytes!==buf.length || record.sha256!==createHash('sha256').update(buf).digest('hex'))
   throw new Error(`Texture integrity mismatch ${file}`);
}
const pngs=registry.models.length+pngFiles.length;
console.log(`PRODUCTION ASSETS: PASS ${registry.models.length} SHA-256 verified Meshopt GLBs; ${pngFiles.length} hash-verified PNGs; ${pngs} model + texture files`);
