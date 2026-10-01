// The 建築 round's water on the game screen (?debug=1, paused start): on the lakes map blue's villagers build a dock on
// the shore, the dock trains a fishing ship that fishes a deep shoal and brings the food home, then a transport takes
// the three villagers aboard and sets them down on another shore. Pointer, tiles and keys only; the starting match
// (wood cut, the dock site explored) is a fixture of logged commands loaded through the menu.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {serialize} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {clearSegment,nodeTotal,position} from '../packages/sim/navigation.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {economyMatch} from './buildings-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
// The fixture: wood for a dock, a fishing ship and a transport; the scout waits on the shore by the dock site.
const s=economyMatch(260925,'lakes',{wood:380,houses:1,scoutTo:{x:1450,y:1000},civs:['britons','franks']});
const tc=s.map.obstacles.find(o=>o.kind==='town-center'&&!o.red),size=s.map.size,seen=new Set(s.vision[0].explored);
let dock=null;for(let r=0;r<=600&&!dock;r+=100)for(let dy=-r;dy<=r&&!dock;dy+=100)for(let dx=-r;dx<=r;dx+=100){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=1600+dx,y=1000+dy;if(!authoritativeProblem(s,0,'dock',x,y)){dock={x,y};break;}}
assert.ok(dock,'a dock site by the lake');const dockBox=obstacleBounds({kind:'dock',...dock}),dc={x:(dockBox[0]+dockBox[2])/2,y:(dockBox[1]+dockBox[3])/2};
const fish=s.map.resources.filter(r=>r.kind==='fish'&&seen.has(Math.floor(r.y/100)*size+Math.floor(r.x/100))).sort((a,b)=>Math.hypot(a.x-dc.x,a.y-dc.y)-Math.hypot(b.x-dc.x,b.y-dc.y))[0];
assert.ok(fish,'a deep shoal blue has seen');
const nodes=[...Array(nodeTotal(s.map)).keys()].map(n=>position(s.map,n)),wet=p=>clearSegment(s.map,p,p,'water'),dry=p=>clearSegment(s.map,p,p);
// The dock's rally point: open water off the dock (clear of its footprint), towards the middle of the lake.
const mid=size*50,clear=p=>p.x<dockBox[0]-100||p.x>dockBox[2]+100||p.y<dockBox[1]-100||p.y>dockBox[3]+100,rally=nodes.filter(p=>wet(p)&&clear(p)).sort((a,b)=>Math.hypot(a.x-(dc.x+(mid-dc.x)*.35),a.y-(dc.y+(mid-dc.y)*.35))-Math.hypot(b.x-(dc.x+(mid-dc.x)*.35),b.y-(dc.y+(mid-dc.y)*.35)))[0];
// Another shore: land next to water, at least eight tiles from the dock, the nearest such spot to blue's town centre.
const shore=nodes.filter(p=>dry(p)&&nodes.some(q=>wet(q)&&Math.max(Math.abs(q.x-p.x),Math.abs(q.y-p.y))<=100)&&Math.hypot(p.x-dc.x,p.y-dc.y)>=800&&Math.abs(p.x-mid)<1200&&Math.abs(p.y-mid)<1200).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];
note('對局準備',`tick ${s.tick}，木材 ${s.accounts[0].stock.wood}；碼頭 (${dock.x}, ${dock.y})，魚群 (${fish.x}, ${fish.y})，集結 (${rally.x}, ${rally.y})，對岸 (${shore.x}, ${shore.y})`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 const text=id=>page.locator('#'+id).innerText();
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 async function screenOf(wx,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(0-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 const at=p=>screenOf(p.x/100,p.y/100);
 async function minimapAt(wx,wz){const r=await page.locator('#minimap').boundingBox(),a=Number((await page.locator('#map').getAttribute('data-camera')).split(',')[3]),K=Math.SQRT1_2,n=size,sc=Math.min(r.width/(n*Math.SQRT2),r.height/(n*Math.SQRT2*K))*.96,dx=wx-n/2,dz=wz-n/2;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*sc,y:r.y+r.height/2+(dx*Math.sin(a)+dz*Math.cos(a))*K*sc};}
 // Box-select round a world point (half a tile each way): ships float, so a box is surer than a click on the hull.
 async function boxAt(p,h=100){const c=[await at({x:p.x-h,y:p.y-h}),await at({x:p.x+h,y:p.y-h}),await at({x:p.x-h,y:p.y+h}),await at({x:p.x+h,y:p.y+h})];
  await page.mouse.move(Math.min(...c.map(q=>q.x)),Math.min(...c.map(q=>q.y)));await page.mouse.down();await page.mouse.move(Math.max(...c.map(q=>q.x)),Math.max(...c.map(q=>q.y)),{steps:6});await page.mouse.up();await page.waitForTimeout(150);}
 const posOf=async()=>{const m=/\(([\d.]+), ([\d.]+)\)/.exec(await text('position'));return m?{x:Number(m[1])*100,y:Number(m[2])*100}:null;};
 const look=async p=>{const m=await minimapAt(p.x/100,p.y/100);await page.mouse.click(m.x,m.y);await page.waitForTimeout(300);};
 async function runUntil(check,arg,timeout=120000){await page.locator('#pause').click();await page.waitForFunction(check,arg,{timeout});await page.locator('#pause').click();await page.waitForTimeout(200);}
 // Load the fixture through the menu.
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:90000});
 note('讀取',await text('stock'));assert.match(await text('world-label'),/湖畔/);
 // Villagers 1-3 (the debug drawer's buttons), the dock tile, the shore.
 await page.locator('[data-unit="1"]').click();await page.locator('[data-unit="2"]').click({modifiers:['Shift']});await page.locator('[data-unit="3"]').click({modifiers:['Shift']});
 await look(dc);assert.equal(await page.locator('#build-dock').isVisible(),true,'the dock tile is on the first page');
 note('按碼頭',await act(()=>page.locator('#build-dock').click()));
 let p=await at({x:dc.x,y:dc.y+700});await page.mouse.move(p.x,p.y);note('預覽在陸地',await text('build-reason'));assert.match(await text('build-reason'),/不能放在這裡/);
 p=await at(dc);await page.mouse.move(p.x,p.y);note('預覽在岸邊水面',await text('build-reason'));assert.match(await text('build-reason'),/左鍵放置碼頭/);
 await page.screenshot({path:out+'naval-dock-preview.png'});
 note('放置碼頭',await act(()=>page.mouse.click(p.x,p.y)));assert.match(await text('notice'),/前往建造碼頭/);
 await runUntil(()=>[...document.querySelectorAll('#events li')].some(li=>/碼頭已建造/.test(li.textContent)));note('碼頭完工',await text('stock'));
 // The dock: rally on the water, then the first tile (Q) trains a fishing ship.
 note('選取碼頭',await act(()=>page.mouse.click(p.x,p.y)));assert.equal(await text('building-title'),'碼頭');
 const r=await at(rally);note('集結點',await act(()=>page.mouse.click(r.x,r.y,{button:'right'})));assert.match(await text('notice'),/集結點設在/);assert.match(await text('rally-hint'),/右鍵水面/);
 note('訓練漁船',await act(()=>page.keyboard.press('KeyQ')));assert.match(await text('notice'),/漁船將在/);
 await runUntil(()=>[...document.querySelectorAll('#events li')].some(li=>/漁船已生產/.test(li.textContent)));
 await page.locator('#pause').click();await page.waitForTimeout(3000);await page.locator('#pause').click();
 // The ship waits at the rally point: click it, then right-click the shoal.
 await page.keyboard.press('Escape');await boxAt(rally);note('框選漁船',`${await text('unit-name')} ${await text('position')}`);assert.equal(await text('unit-name'),'漁船');
 assert.match(await text('unit-facts'),/右鍵魚群或魚網捕魚/);await page.screenshot({path:out+'naval-fishing-ship.png'});
 const food0=Number(await text('res-food'));const f=await at(fish);note('右鍵魚群',await act(()=>page.mouse.click(f.x,f.y,{button:'right'})));assert.match(await text('notice'),/前往捕魚/);
 await runUntil(f0=>Number(document.querySelector('#res-food').textContent)>=f0+10,food0,180000);note('漁獲入帳',`${food0} → ${await text('res-food')}`);
 // A transport (the second tile, W) to the same rally point; the villagers go aboard with a right-click on it.
 const dockAt=await at(dc);await act(()=>page.mouse.click(dockAt.x,dockAt.y));assert.equal(await text('building-title'),'碼頭');
 note('訓練運輸船',await act(()=>page.keyboard.press('KeyW')));assert.match(await text('notice'),/運輸船將在/);
 await runUntil(()=>[...document.querySelectorAll('#events li')].some(li=>/運輸船已生產/.test(li.textContent)));
 await page.locator('#pause').click();await page.waitForTimeout(2500);await page.locator('#pause').click();
 await page.keyboard.press('Escape');await boxAt(rally,100);note('框選運輸船',`${await text('unit-name')} ${await text('position')}`);assert.equal(await text('unit-name'),'運輸船');const tp=await posOf();
 await page.keyboard.press('Escape');await page.locator('[data-unit="1"]').click();await page.locator('[data-unit="2"]').click({modifiers:['Shift']});await page.locator('[data-unit="3"]').click({modifiers:['Shift']});
 const t=await at(tp);note('登船',await act(()=>page.mouse.click(t.x,t.y,{button:'right'})));assert.match(await text('notice'),/登上運輸船/);
 // Still paused: the transport is where it waited; select it and watch the passengers come aboard.
 await page.keyboard.press('Escape');await boxAt(tp);note('框選運輸船',await text('unit-name'));assert.equal(await text('unit-name'),'運輸船');
 await runUntil(()=>/乘客 3\/5/.test(document.querySelector('#unit-facts').textContent),undefined,120000);
 note('運輸船',`${await text('unit-name')}｜${await text('unit-facts')}`);assert.equal(await text('unit-name'),'運輸船');assert.match(await text('unit-facts'),/乘客 3\/5/);
 await page.screenshot({path:out+'naval-transport.png'});
 // Across the lake: right-click land; the transport sails over and sets them down.
 await look(shore);const sh=await at(shore);note('卸載',await act(()=>page.mouse.click(sh.x,sh.y,{button:'right'})));assert.match(await text('notice'),/卸下乘客/);
 await runUntil(()=>/乘客 0\/5/.test(document.querySelector('#unit-facts').textContent),undefined,120000);note('卸載完成',await text('unit-facts'));
 await page.screenshot({path:out+'naval-unloaded.png'});
 note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS naval: dock on the shore, fishing ship fishing a deep shoal, transport across the lake');
}catch(e){if(page)await page.screenshot({path:out+'naval-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
