import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
let chromium; try { ({chromium}=require('playwright')); } catch { ({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright')); }
const {createServer}=await import('vite');
const root=new URL('../',import.meta.url).pathname;
const server=await createServer({root,server:{host:'127.0.0.1',port:5281,strictPort:true}});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const out=process.argv[2]||'result';mkdirSync(out,{recursive:true});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
// Read-only local rendering; silence paid VO and all aerial imagery so before/
// after use the same procedural fallback (no network-dependent appearance).
await context.route('**/api/**',r=>r.abort());
await context.route('https://services.arcgisonline.com/**',r=>r.abort());
const errors=[]; const results=[];
for(const shot of ['bethel-front','bethel-side','mariners-home','water-street','blizzard']) {
 const page=await context.newPage();page.on('pageerror',e=>errors.push({shot,error:e.message}));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push({shot,console:m.text().slice(0,300)})});
 await page.goto(`http://127.0.0.1:5281/?review=${shot}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>{const {useGame}=await import('/src/store.ts');const {shared}=await import('/src/shared.ts');return !!useGame.getState().slice&&!!shared.player},{timeout:45000});
 await page.waitForFunction(()=>!!window.__narrowsReviewState?.get().slice,{timeout:60000});
 await page.evaluate(s=>window.__narrowsReviewState.set({started:true,weather:s==='blizzard'?'snow':'clear',quality:1,fxOn:true,radioOpen:false}),shot);
 await page.waitForFunction(expected=>window.__narrowsReviewState.get().weather===expected,shot==='blizzard'?'snow':'clear',{timeout:10000});
 await page.waitForTimeout(3500);
 await page.waitForFunction(()=>window.__narrowsPerf?.samples>=30,{timeout:60000});
 await page.screenshot({path:`${out}/${shot}.png`});
 const stats=await page.evaluate(async()=>{const {perfStats}=await import('/src/ui/perfStats.ts');return {...(window.__narrowsPerf || perfStats),weather:window.__narrowsReviewState.get().weather,quality:window.__narrowsReviewState.get().quality,webgl:!!document.querySelector('canvas')?.getContext('webgl2')}});
 results.push({shot,...stats});console.log(shot,JSON.stringify(stats));await page.close();
}
writeFileSync(`${out}/capture.json`,JSON.stringify({environment:'Chromium/SwiftShader Linux, 1280x720 DPR1, medium, 10:00 game time, procedural ground; NOT iPhone',results,errors},null,2));
console.log('errors',JSON.stringify(errors));await browser.close();await server.close();
