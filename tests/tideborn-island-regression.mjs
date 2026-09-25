import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),output=fs.mkdtempSync(path.join(os.tmpdir(),'tideborn-qa-'));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':/\.(js|mjs)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],external=[];
page.on('console',m=>{if(m.text().startsWith('INVALID LOT'))console.log(m.text())});page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url())});
await page.goto(origin+'/web/139-tideborn-island.html');await page.waitForFunction(()=>window.islandGame?.actors.length===5);await page.locator('#pauseGame').click();await page.locator('#terrainSettings').click();
async function validateLots(){
assert.equal(await page.evaluate(()=>window.islandPreview.village.facilities.length),13);
const overlaps=await page.evaluate(()=>{const lots=window.islandPreview.village.facilities.filter(f=>f.base!==undefined),pairs=[];for(let i=0;i<lots.length;i++)for(let j=i+1;j<lots.length;j++){const a=lots[i],b=lots[j];const axes=f=>[[Math.cos(f.yaw),-Math.sin(f.yaw)],[Math.sin(f.yaw),Math.cos(f.yaw)]];const aa=axes(a),bb=axes(b),extent=(f,basis,axis)=>Math.abs(basis[0][0]*axis[0]+basis[0][1]*axis[1])*f.w/2+Math.abs(basis[1][0]*axis[0]+basis[1][1]*axis[1])*f.d/2;const collision=[...aa,...bb].every(axis=>Math.abs((b.x-a.x)*axis[0]+(b.z-a.z)*axis[1])<extent(a,aa,axis)+extent(b,bb,axis));if(collision)pairs.push([a.name,b.name]);}return pairs;});assert.deepEqual(overlaps,[],'building lots must not overlap');

assert(await page.evaluate(()=>{const {village,surface}=window.islandPreview;return village.facilities.filter(f=>f.base!==undefined).every(f=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const x=f.x+a*f.w/2*Math.cos(f.yaw)+b*f.d/2*Math.sin(f.yaw),z=f.z-a*f.w/2*Math.sin(f.yaw)+b*f.d/2*Math.cos(f.yaw);if(surface(x,z)<=0||surface(x,z)>f.base+.001){console.log('INVALID LOT',f.name,x,z,surface(x,z),f.base);return false;}}return true;});}));
}
await validateLots();
const signature=()=>page.evaluate(()=>JSON.stringify(Array.from(window.islandPreview.land.children[0].geometry.attributes.position.array)));
const initial=await signature();
await page.locator('#generate').click();await page.waitForFunction(()=>window.islandGame?.actors.length===5);await page.locator('#pauseGame').click();await page.locator('#terrainSettings').click();assert.equal(await signature(),initial);
await page.locator('#seed').fill('12345');await page.locator('#generate').click();await page.waitForFunction(()=>window.islandGame?.actors.length===5);await page.locator('#pauseGame').click();await page.locator('#terrainSettings').click();assert.notEqual(await signature(),initial);
for(const [size,height,seed] of [['160','30','12345'],['340','8','240925'],['240','18','1'],['160','30','999999']]){
await page.locator('#seed').fill(seed);await page.locator('#size').fill(size);await page.locator('#height').fill(height);await page.locator('#generate').click();await page.waitForFunction(()=>window.islandGame?.actors.length===5);await page.locator('#pauseGame').click();await page.locator('#terrainSettings').click();
assert.equal(await page.evaluate(()=>window.islandPreview.config.radius*2),Number(size));await validateLots();
assert(await page.evaluate(()=>{const {graph,surface}=window.islandPreview;const seen=new Set([0]);for(let i=0;i<graph.nodes.length;i++)for(const e of graph.edges){if(seen.has(e.from))seen.add(e.to);if(seen.has(e.to))seen.add(e.from);}return seen.size===graph.nodes.length&&graph.edges.every(e=>e.points.every(([x,z])=>Number.isFinite(surface(x,z))&&surface(x,z)>0))&&graph.edges.every(e=>{const n=graph.nodes.find(n=>n.id===e.from),m=graph.nodes.find(n=>n.id===e.to);return Math.hypot(n.x-e.points[0][0],n.z-e.points[0][1])<.001&&Math.hypot(m.x-e.points.at(-1)[0],m.z-e.points.at(-1)[1])<.001;});}));
}
await page.locator('#facility').selectOption({label:'木匠工坊'});assert.match(await page.locator('#facilityInfo').textContent(),/工作棚/);
await page.locator('#buildings').uncheck();assert.equal(await page.evaluate(()=>window.islandPreview.village.group.visible),false);await page.locator('#buildings').check();
await page.locator('#roads').uncheck();assert.equal(await page.evaluate(()=>window.islandPreview.roads.visible),false);await page.locator('#roads').check();await page.locator('#markers').uncheck();assert(await page.locator('#labels').isHidden());await page.locator('#markers').check();
await page.locator('#size').fill('240');await page.locator('#height').fill('18');await page.locator('#seed').fill('240925');await page.locator('#generate').click();await page.waitForFunction(()=>window.islandGame?.actors.length===5);await page.locator('#pauseGame').click();await page.locator('#terrainSettings').click();
await page.locator('#terrainSettings').click();await page.waitForTimeout(400);
const target=await page.evaluate(()=>{const {village,camera}=window.islandPreview;const f=village.facilities.find(f=>f.type==='燈塔');const p=f.root.position.clone();p.y+=12*window.islandPreview.config.radius/120;p.project(camera);return {x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};});await page.mouse.click(target.x,target.y);assert.equal(await page.locator('#facility option:checked').textContent(),'守潮燈塔');await page.locator('#facility').selectOption('');
await page.screenshot({path:output+'/desktop.png'});await page.screenshot({path:output+'/catalog.jpg',type:'jpeg',quality:85});
await page.locator('#top').click();await page.waitForTimeout(350);await page.screenshot({path:output+'/top.png'});await page.locator('#plus').click();await page.locator('#minus').click();await page.locator('#reset').click();
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await page.locator('#terrainSettings').click();await page.locator('#random').click();await page.waitForFunction(()=>window.islandGame?.actors.length===5);await page.locator('#reset').click();await page.screenshot({path:output+'/mobile.png'});
await page.goto(origin+'/');assert.equal(await page.locator('a[href="web/139-tideborn-island.html"]').count()>0,true);
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS deterministic terrain, size/height extremes, connected dry-land road graph, 13 facilities and foundations, building inspection, toggles, camera controls, mobile overflow, catalogue, no browser errors or external requests. Screenshots: '+output);
}finally{await browser.close();await new Promise(r=>server.close(r));}
