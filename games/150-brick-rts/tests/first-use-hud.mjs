// Prompt 19 first visit on the game screen itself (no ?debug=1): the page is only the battlefield and its HUD.
// Pointer and keyboard only. World points are aimed with the camera the canvas reports in data-camera.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const world=createState(260925),tc=world.map.obstacles.find(o=>o.kind==='town-center'&&!o.red),tcBox=obstacleBounds(tc);
const berries=world.map.obstacles.filter(o=>o.kind==='berries').sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0],berryBox=obstacleBounds(berries);
function spot(kind,from){for(let r=0;r<=800;r+=50)for(let dy=-r;dy<=r;dy+=50)for(let dx=-r;dx<=r;dx+=50){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=from.x+dx,y=from.y+dy;if(!authoritativeProblem(world,0,kind,x,y))return {x,y};}throw Error('no spot');}
const houseBox=obstacleBounds({kind:'house',...spot('house',{x:500,y:750})});
const browser=await chromium.launch({headless:true});const errors=[],external=[],log=[];
const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
function watch(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});}
// Orthographic projection of a world point (board units) with the camera the page reports.
async function screenOf(page,wx,wy,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
 return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(wy-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
const centre=(page,box,h=0)=>screenOf(page,(box[0]+box[2])/200,h,(box[1]+box[3])/200);
const tick=page=>page.evaluate(()=>Number(document.querySelector('#tick').textContent));
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);const t0=Date.now();
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const text=id=>page.locator('#'+id).innerText();
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 note('首次進站',`${Date.now()-t0} ms 內開始運行；${await text('notice')}`);
 // 1. The page is only the game: top bar, battlefield, HUD. No scroll, no portfolio or engineering blocks.
 const [top,map,hud]=await Promise.all(['.topbar','#map','.hud'].map(s=>page.locator(s).boundingBox()));
 note('畫面配置',`頂列 0–${top.height}，戰場 ${map.y}–${map.y+map.height}，HUD ${hud.y}–${hud.y+hud.height}`);
 assert.equal(Math.round(top.y),0);assert.ok(Math.abs(map.y-(top.y+top.height))<=4&&Math.abs(map.y+map.height-hud.y)<=4,'battlefield fills the space between the bars');assert.equal(Math.round(hud.y+hud.height),900);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),true,'no page scroll');
 for(const hidden of ['#debug','#step','#tick','#fog-debug','#rules-inspector','#move','#reset-view','#menu'])assert.equal(await page.locator(hidden).isVisible(),false,`${hidden} is not on the game screen`);
 assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'true','the match starts running');
 assert.deepEqual([await text('res-food'),await text('res-wood'),await text('res-gold'),await text('res-stone'),await text('res-pop'),await text('age-name')],['200','200','100','100','3/5','第一時代']);
 assert.match(await page.locator('.r img[data-icon="food"]').getAttribute('src'),/^data:image\/png/,'resource icons are rendered from the brick models');
 await page.screenshot({path:out+'hud-first-visit.png'});
 // 2. Idle villager key: the selection panel shows the portrait and numbers; the command grid offers real buildings.
 assert.equal(await text('idle-count'),'3');note('閒置村民',await act(()=>page.keyboard.press('Period')));
 assert.equal(await page.locator('#sel-unit').isVisible(),true);assert.equal(await text('unit-name'),'村民');assert.match(await text('unit-hp'),/25\/25/);assert.match(await page.locator('#unit-portrait').getAttribute('src'),/^data:image\/png/);
 assert.equal(await page.locator('#build-house').isVisible(),true);assert.equal(await page.locator('#stop').isVisible(),true);assert.equal(await page.locator('#production button').count(),0);
 await page.locator('#build-house').hover();await page.waitForFunction(()=>!document.querySelector('#tip').hidden);note('住宅說明',await text('tip'));assert.match(await text('tip'),/住宅（Q）/);assert.match(await text('tip'),/30/);
 await page.screenshot({path:out+'hud-villager.png'});
 // 3. Gather: right-click the berries by the town centre; food rises in the top bar.
 await page.locator('#speed').selectOption('4');let p=await centre(page,berryBox,.3);note('右鍵野果',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));assert.match(await text('notice'),/前往採集/);
 await page.waitForFunction(()=>Number(document.querySelector('#res-food').textContent)>200,undefined,{timeout:60000});note('食物入帳',await text('res-food'));
 // 4. Build: next idle villager, Q, place on a valid spot. The preview explains, the click spends wood.
 await page.keyboard.press('Period');await page.keyboard.press('KeyQ');p=await centre(page,houseBox);await page.mouse.move(p.x,p.y);await page.waitForFunction(()=>/左鍵放置住宅/.test(document.querySelector('#build-reason').textContent));
 note('放置住宅',await act(()=>page.mouse.click(p.x,p.y)));assert.match(await text('notice'),/前往建造住宅/);await page.waitForFunction(()=>document.querySelector('#res-wood').textContent==='170');
 await page.waitForFunction(()=>document.querySelector('#res-pop').textContent==='3/10',undefined,{timeout:90000});note('住宅完工',`人口 ${await text('res-pop')}`);
 // 5. H selects the town centre: portrait, production tiles, queue with progress.
 await page.keyboard.press('KeyH');assert.equal(await page.locator('#building-panel').isVisible(),true);assert.equal(await text('building-title'),'城鎮中心');
 const villagerTile=page.locator('#production button[data-train="villager"]');assert.equal(await villagerTile.isVisible(),true);
 note('訓練村民',await act(()=>villagerTile.click()));await page.waitForFunction(()=>document.querySelector('#queue').children.length===1);note('佇列',await page.locator('#queue span').innerText());
 await page.screenshot({path:out+'hud-town-center.png'});
 await page.waitForFunction(()=>document.querySelector('#res-pop').textContent==='4/10',undefined,{timeout:60000});note('村民出生',await text('res-pop'));
 // 6. Menu pauses; closing resumes. F3 pauses with a banner.
 await page.keyboard.press('F10');assert.equal(await page.locator('#menu').isVisible(),true);assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'false');const frozen=await tick(page);await page.waitForTimeout(300);assert.equal(await tick(page),frozen,'menu pauses the match');
 await page.screenshot({path:out+'hud-menu.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'true','closing the menu resumes');
 await page.keyboard.press('F3');assert.equal(await page.locator('#paused-banner').isVisible(),true);await page.keyboard.press('F3');assert.equal(await page.locator('#paused-banner').isVisible(),false);
 // 7. Minimap: left click moves the camera, right click orders the selection.
 const before=await page.locator('#map').getAttribute('data-camera'),mm=await page.locator('#minimap').boundingBox();await page.mouse.click(mm.x+mm.width*.72,mm.y+mm.height*.5);note('小地圖左鍵',`${before} → ${await page.locator('#map').getAttribute('data-camera')}`);assert.notEqual(await page.locator('#map').getAttribute('data-camera'),before);
 await page.keyboard.press('Period');note('小地圖右鍵',await act(()=>page.mouse.click(mm.x+mm.width*.5,mm.y+mm.height*.55,{button:'right'})));assert.match(await text('notice'),/移動指令已排入/);
 await page.keyboard.press('KeyH');
 // Portfolio thumbnail from the real game screen: villagers working around the new house.
 await page.waitForTimeout(600);const shot=(await page.screenshot({type:'png'})).toString('base64');
 const thumb=await page.evaluate(async src=>{const img=new Image();img.src='data:image/png;base64,'+src;await img.decode();const c=document.createElement('canvas');c.width=640;c.height=400;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,640,400);return c.toDataURL('image/jpeg',.85).split(',')[1];},shot);fs.writeFileSync(root+'thumbs/150.jpg',Buffer.from(thumb,'base64'));
 await page.close();
 // 8. Phone: same screen, compact HUD, tap to select and tap to move.
 const phone=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const small=await phone.newPage();watch(small);
 await small.goto(origin+'/web/150-brick-rts.html');await small.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const [sHud,sMap]=await Promise.all(['.hud','#map'].map(s=>small.locator(s).boundingBox()));note('390 版面',`戰場高 ${Math.round(sMap.height)}，HUD 高 ${Math.round(sHud.height)}`);
 assert.equal(await small.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'no overflow at 390');assert.ok(sHud.height<=844*.32,'HUD stays under a third of the phone screen');
 await small.locator('#pause').tap();const villager=world.units.find(u=>u.player===0);let q=await screenOf(small,villager.x/100,.55,villager.y/100);await small.touchscreen.tap(q.x,q.y);await small.waitForFunction(()=>!document.querySelector('#sel-unit').hidden,undefined,{timeout:3000}).catch(()=>{});
 note('觸控選取',`${await small.locator('#unit-name').innerText()} ${await small.locator('#unit-owner').innerText()}`);assert.equal(await small.locator('#sel-unit').isVisible(),true);
 q=await screenOf(small,(tcBox[0]+tcBox[2])/200+1,0,(tcBox[3])/100+2);await small.touchscreen.tap(q.x,q.y);await small.waitForTimeout(150);note('觸控移動',await small.locator('#notice').innerText());assert.match(await small.locator('#notice').innerText(),/移動指令已排入/);
 await small.screenshot({path:out+'hud-390.png'});await phone.close();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(out+'first-use-hud.json',JSON.stringify(log,null,1));console.log('PASS game screen: full-window layout, auto-start, HUD resources, portraits, command tiles, gather, build, train, menu pause, minimap, phone touch');
}catch(e){if(page&&!page.isClosed())await page.screenshot({path:out+'hud-failure.png'}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{await browser.close();server.close();}
