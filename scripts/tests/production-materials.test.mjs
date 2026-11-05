import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../public/quahog-assets/', import.meta.url));
for (const [folder, names] of [
 ['production-facades', ['brick-window-albedo', 'brick-window-normal', 'brick-window-roughness', 'brick-window-emissive']],
 ['production-roads', ['asphalt-albedo', 'asphalt-normal', 'asphalt-roughness']],
]) {
 for (const name of names) {
  test(`${folder}/${name} is locally bundled 512px PNG`,()=>{
    const b = readFileSync(join(root,folder,`${name}.png`));
    assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(b.readUInt32BE(16),512);
    assert.equal(b.readUInt32BE(20),512);
    assert.ok(b.length>1000);
  });
 }
}
test('PBR materials have locally resolved URLs and procedural fallbacks',()=>{
 const maps = readFileSync(fileURLToPath(new URL('../../src/world/productionFacadeMaps.ts',import.meta.url)),'utf8');
 const roads = readFileSync(fileURLToPath(new URL('../../src/world/productionRoadMaps.ts',import.meta.url)),'utf8');
 assert.match(maps,/\/quahog-assets\/production-facades\//);
 assert.match(roads,/\/quahog-assets\/production-roads\//);
 assert.match(maps,/fallback/i);
 assert.match(roads,/fallback/i);
 assert.doesNotMatch(maps+roads, /https?:\/\//);
});
