import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = p => readFileSync(join(root, p), 'utf8');

test('R3 semantic TypeScript blocker: every streamed tile resolves its own quality preset', () => {
  const text = source('src/world/StreamingBuildings.tsx');
  assert.match(text, /function Tile\([^]*?const quality = useGame\(\(s\) => s\.quality\)/);
  assert.match(text, /roughnessMap=\{quality === 0 \? undefined : pbr\?\.roughness\}/);
});

test('R4 cleanup releases ephemeral streamed geometry rather than accumulating GPU buffers', () => {
  assert.match(source('src/world/StreamingBuildings.tsx'), /geoms\.forEach\(\(g\) => g\.dispose\(\)\)/);
  assert.match(source('src/world/StreamingBuildings.tsx'), /geom\?\.dispose\(\)/);
  assert.match(source('src/world/Roads.tsx'), /chunk\[key\]\?\.dispose\(\)/);
  assert.match(source('src/world/Water.tsx'), /geometry\?\.dispose\(\)/);
});

test('coastal water uses dielectric material and bounds CPU swell to High', () => {
  const water = source('src/world/Water.tsx');
  assert.match(water, /meshPhysicalMaterial/);
  assert.match(water, /metalness=\{0\}/);
  assert.match(water, /ior=\{1\.333\}/);
  assert.match(water, /quality === 2 && waveClock\.current >= 0\.05/);
  assert.match(water, /transparent=\{quality === 2\}/);
});

test('mobile facade relief avoids city-scale transparent-glass overdraw', () => {
  const glass = source('src/world/FacadeRelief.tsx');
  assert.match(glass, /meshPhysicalMaterial color="#345367"/);
  assert.doesNotMatch(glass, /transparent opacity=\{0\.40\}/);
  assert.match(glass, /metalness=\{0\}/);
});

test('asset decoder and bounded model cache retain source-linked fallbacks', () => {
  const asset = source('src/world/ProductionGLB.tsx');
  assert.match(asset, /setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(asset, /MAX_RESOLVED_MODEL_CACHE = 96/);
  assert.match(asset, /if \(!resolved\.has\(path\)\) continue/);
  assert.match(asset, /\{fallback\}/);
});

test('diagnostics require explicit opt-in and report p95 and approximate draw calls', () => {
  const metrics = source('src/world/RenderDiagnostics.tsx');
  assert.match(metrics, /get\("perf"\) === "1"/);
  assert.match(metrics, /Math\.ceil\(durations\.length \* 0\.95\)/);
  assert.match(metrics, /gl\.info\.render\.calls/);
  assert.match(source('src/Experience.tsx'), /<RenderDiagnostics \/>/);
});

test('R3 512px production assets stay resident in R4 and R2 model assets are not replaced', () => {
  for (const name of [
    'production-facades/brick-window-albedo.png',
    'production-facades/brick-window-normal.png',
    'production-facades/brick-window-roughness.png',
    'production-facades/brick-window-emissive.png',
    'production-roads/asphalt-albedo.png',
    'production-roads/asphalt-normal.png',
    'production-roads/asphalt-roughness.png',
  ]) assert.ok(existsSync(join(root, 'public/quahog-assets', name)), name);
  assert.match(source('src/world/StreamingBuildings.tsx'), /<FacadeRelief buildings=\{buildings\} \/>/);
});
