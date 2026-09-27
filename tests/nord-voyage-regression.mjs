// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE=/path/to/chrome node tests/nord-voyage-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),output=fs.mkdtempSync(path.join(os.tmpdir(),'nord-qa-'));
const htmlPath='/web/173-nord-voyage.html';
// Expose the simulation only in this test server to exercise distant route states.
// The shipped HTML exposes read-only diagnostics, not these mutation hooks.
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');
 let body=fs.readFileSync(file);
 if(pathname===htmlPath)body=body.toString().replace('window.__nord={','window.__nordQA={state,update,center,width,camera,water,boat,refraction,reflection};window.__nord={');
 res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[],failed=[],external=new Set();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
 page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:'))external.add(r.url())});
 await page.goto(origin+htmlPath);await page.waitForSelector('body[data-ready=true]');
 const state=()=>page.evaluate(()=>__nord.state);
 const step=seconds=>page.evaluate(seconds=>{for(let t=0;t<seconds;t+=.05)__nordQA.update(.05)},seconds);
 assert.equal((await state()).sailing,false);assert.equal((await state()).contacts,0);
 assert.equal(await page.evaluate(()=>__nord.diagnostics.oars),12);
 assert.equal(await page.evaluate(()=>__nordQA.refraction.depthTexture.isDepthTexture),true);
 await page.screenshot({path:path.join(output,'desktop.png')});
 await page.click('#sail');await step(3);
 let s=await state();assert(s.distance>4);assert(s.speed>2);assert(s.contacts>=12);
 assert(await page.evaluate(()=>__nord.diagnostics.activeRipples>0));
 const startYaw=s.yaw;await page.keyboard.down('KeyD');await step(1);await page.keyboard.up('KeyD');
 assert((await state()).yaw<startYaw-.2);
 await page.keyboard.down('KeyA');await step(1);await page.keyboard.up('KeyA');
 assert(Math.abs((await state()).yaw-startYaw)<.1);
 await page.keyboard.down('KeyW');await step(1);await page.keyboard.up('KeyW');assert((await state()).power>.65);
 await page.keyboard.down('KeyS');await step(1);await page.keyboard.up('KeyS');assert((await state()).power<.45);
 await page.locator('#throttle').fill('100');await step(2);assert((await state()).speed>6.5);
 await page.screenshot({path:path.join(output,'rowing.png')});
 await page.click('#sail');await step(5);assert((await state()).speed<.01);
 const stopped=await state();await step(1);assert.equal((await state()).distance,stopped.distance);assert.equal((await state()).contacts,stopped.contacts);
 // Lighting must alter both the rendered result and the accessible selection.
 const lighting=[];
 for(const mode of ['gold','night','dawn']){await page.click(`[data-light=${mode}]`);assert.equal((await state()).light,mode);assert.equal(await page.getAttribute(`[data-light=${mode}]`,'aria-pressed'),'true');await page.waitForTimeout(100);lighting.push(await page.screenshot({path:path.join(output,`${mode}.png`)}));}
 assert(!lighting[0].equals(lighting[1]));assert(!lighting[1].equals(lighting[2]));
 await page.click('#help');assert(await page.locator('#guide').isVisible());const before=await state();await page.keyboard.press('KeyW');await page.keyboard.press('Space');assert.equal((await state()).power,before.power);assert.equal((await state()).sailing,before.sailing);await page.keyboard.press('Escape');assert(!(await page.locator('#guide').isVisible()));
 // Press and cancel controls: focus loss must never leave the rudder held down.
 await page.click('#sail');await page.keyboard.down('KeyD');await step(.5);await page.evaluate(()=>dispatchEvent(new Event('blur')));const cleared=(await state()).yaw;await step(.5);assert.equal((await state()).yaw,cleared);await page.keyboard.up('KeyD');
 await page.evaluate(()=>{const {state:s,center,width}=__nordQA;s.z=-240;s.x=center(s.z)+width(s.z)+12;s.yaw=-.6;});await step(.3);
 assert(await page.evaluate(()=>Math.abs(__nord.state.x-__nordQA.center(__nord.state.z))<=__nordQA.width(__nord.state.z)-7.9));
 // Later chapters, terminal state and restart reset the actual simulation.
 for(const [distance,no] of [[430,'02'],[840,'03'],[1230,'04']]){await page.evaluate(d=>{const q=__nordQA;q.state.z=-d;q.state.x=q.center(-d);q.state.distance=d;q.state.yaw=0;},distance);await step(.2);assert.equal(await page.textContent('#chapterNo'),no);}
 await page.evaluate(()=>{const q=__nordQA;Object.assign(q.state,{z:-1599.9,x:q.center(-1599.9),distance:1599.9,speed:7,power:1,sailing:true,yaw:0});});await step(.2);
 assert.equal((await state()).finished,true);assert.equal((await state()).sailing,false);assert.match(await page.textContent('#sail'),/再航行/);
 await page.click('#sail');assert.equal((await state()).finished,false);assert((await state()).distance<2);
 // Real touch events on a narrow viewport, plus a short landscape viewport.
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await mobile.goto(origin+htmlPath);await mobile.waitForSelector('body[data-ready=true]');await mobile.tap('#sail');
 const cdp=await mobile.context().newCDPSession(mobile),box=await mobile.locator('#right').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
 await mobile.evaluate(()=>{for(let i=0;i<40;i++)__nordQA.update(.05)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert((await mobile.evaluate(()=>__nord.state)).yaw<-.1);
 const released=(await mobile.evaluate(()=>__nord.state)).yaw;await mobile.evaluate(()=>{for(let i=0;i<10;i++)__nordQA.update(.05)});assert.equal((await mobile.evaluate(()=>__nord.state)).yaw,released);
 await mobile.screenshot({path:path.join(output,'mobile.png')});assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 for(const size of [{width:320,height:568},{width:844,height:390}]){await mobile.setViewportSize(size);assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));const b=await mobile.locator('#sail').boundingBox();assert(b.y>=0&&b.y+b.height<=size.height);}
 // CDN failure must recover via the existing local module; no new dependencies.
 const fallback=await browser.newPage();await fallback.route('https://cdn.jsdelivr.net/**',r=>r.abort());await fallback.goto(origin+htmlPath);await fallback.waitForSelector('body[data-ready=true]');assert.equal(await fallback.locator('#failure').isVisible(),false);
 // WebGL loss must provide a visible recovery path.
 await fallback.evaluate(()=>document.getElementById('sea').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));assert(await fallback.locator('#failure').isVisible());
 const catalog=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(catalog,/<a href="web\/173-nord-voyage.html">北境航記 · NORÐ<\/a>｜<span class="g">[^<]+<\/span>｜<span class="c">遊戲敘事<\/span>/);
 const count=[...catalog.matchAll(/<a href="web\/\d{3}-[^"\n]+\.html">/g)].length;assert(catalog.includes(`${count} 件網頁作品`));
 for(const file of ['README.md','llms.txt','sitemap.xml'])assert(fs.readFileSync(path.join(root,file),'utf8').includes('173-nord-voyage.html'));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log(JSON.stringify({result:'PASS',output,catalogCount:count,external:[...external],errors,failed,checks:['WebGL shaders','oar contact effects','rudder and throttle','stop and restart','lighting','dialog','input cancellation','bank boundary','chapters and arrival','touch controls','responsive layouts','CDN fallback','context loss','catalog metadata']},null,2));
}finally{await browser.close();server.close();}
