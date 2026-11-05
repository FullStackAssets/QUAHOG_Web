const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve,dirname,join} = require('node:path');
const ts = require('typescript');
const root=resolve(__dirname,'../..');
/** Read actual TS modules through the installed compiler, isolating the geometry
 * generators from Three's GPU renderer. No mocks of the business algorithms. */
const cache=new Map();
function loadTs(path){
 path=resolve(path); if(cache.has(path)) return cache.get(path).exports;
 const module={exports:{}}; cache.set(path,module);
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=name => {
   if(name==='three') return {Color:class {constructor(){} }};
   if(!name.startsWith('.')) throw new Error('Unanticipated import '+name);
   return loadTs(resolve(dirname(path),name+'.ts'));
 };
 new Function('require','module','exports',code)(localRequire,module,module.exports);
 return module.exports;
}
const {generateArchitecturalShell}=loadTs(join(root,'src/world/architecturalShellLayout.ts'));
const box=(x=0,n=0,height=11,name='mill')=>({height,name,footprint:[[x,n],[x+13,n],[x+13,n+8],[x,n+8]]});
test('actual architectural generator emits dimensional cornices, plinth and masonry relief',()=>{
 const a=generateArchitecturalShell([box()],150);
 const kinds=new Set(a.map(x=>x.kind));
 for(const k of ['foundation','cornice','belt','pier'])assert.ok(kinds.has(k),`missing ${k}`);
 assert.ok(a.every(x=>x.position.every(Number.isFinite)&&x.scale.every(z=>z>0&&Number.isFinite(z))));
 assert.ok(a.some(p=>p.position[1]>8),'upper-story massing not generated');
});
test('architectural shell preserves strict whole-building mobile budgets',()=>{
 assert.deepEqual(generateArchitecturalShell([box()],0),[]);
 assert.deepEqual(generateArchitecturalShell([box()],NaN),[]);
 const low=generateArchitecturalShell([box(),box(30)],10);
 assert.ok(low.length<=10);
 assert.ok(generateArchitecturalShell(Array.from({length:200},(_,i)=>box(i*17)),10000).length<=480);
});
test('landmarks and corrupt or undersized GIS footprints do not receive replacement ornaments',()=>{
 assert.deepEqual(generateArchitecturalShell([box(0,0,11,"Seamen's Bethel")],100),[]);
 assert.deepEqual(generateArchitecturalShell([{...box(),height:NaN}],100),[]);
 assert.deepEqual(generateArchitecturalShell([{...box(),footprint:[[0,0],[12,Infinity],[12,8],[0,8]]}],100),[]);
 assert.deepEqual(generateArchitecturalShell([{...box(),height:2}],100),[]);
});
test('facade position remains oriented outward when footprint winding is reversed',()=>{
 const b=box(2,3,15);
 for(const footprint of [b.footprint,[...b.footprint].reverse()]){
  const parts=generateArchitecturalShell([{...b,footprint,name:''}],100);
  assert.ok(parts.length>0);
  const centroidX=footprint.reduce((a,p)=>a+p[0],0)/4;
  const centroidZ=-footprint.reduce((a,p)=>a+p[1],0)/4;
  const plinth=parts.find(p=>p.kind==='foundation');
  const normal=[Math.sin(plinth.rotationY),Math.cos(plinth.rotationY)];
  const face=[plinth.position[0]-centroidX,plinth.position[2]-centroidZ];
  assert.ok(normal[0]*face[0]+normal[1]*face[1]>0,'frontage faces inside GIS polygon');
 }
});
test('placement is deterministic for stable source coordinates and not tied to input array ordering',()=>{
 const a=box(4,7),b=box(43,21);
 const forward=generateArchitecturalShell([a,b],200);
 const again=generateArchitecturalShell([a,b],200);
 assert.deepEqual(forward,again);
});
const PNG=Buffer.from('89504e470d0a1a0a','hex');
for(const kind of ['brick','clapboard','granite']){
 for(const slot of ['albedo','normal','roughness','emissive']){
  test(`${kind} ${slot} is a locally bundled full-size v4 PBR atlas`,()=>{
   const file=join(root,'public/quahog-assets/production-facades',`${kind}-window-v4-${slot}.png`);
   const bytes=readFileSync(file);
   assert.ok(bytes.subarray(0,8).equals(PNG));
   assert.equal(bytes.readUInt32BE(16),512);
   assert.equal(bytes.readUInt32BE(20),512);
   assert.ok(bytes.length>800,`${file} suspiciously small`);
  });
 }
}
test('masonry type selects different atlas and retains explicit fallback',()=>{
 const s=readFileSync(join(root,'src/world/productionFacadeMaps.ts'),'utf8');
 assert.match(s,/Map<FacadeKind, FacadeMaps>/);
 assert.match(s,/\$\{kind\}-window-v4-\$\{type\}\.png/);
 assert.match(s,/fallback/);
 assert.doesNotMatch(s,/https?:\/\//);
});
test('three separate building mesh groups preserve attached collision and decorative shells outside Rapier',()=>{
 const s=readFileSync(join(root,'src/world/StreamingBuildings.tsx'),'utf8');
 assert.match(s,/parts\[materialKind\]\.push\(g\)/);
 assert.match(s,/colliders="trimesh"/);
 assert.match(s,/\{colliders && <ArchitecturalShell buildings=\{buildings\} \/>\}/);
 assert.match(s,/gableRoof\(b, roofH, roof\)/);
});
