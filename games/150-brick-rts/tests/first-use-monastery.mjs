// Monastery, monks and relics on the game screen (no ?debug=1). The third-age match comes from
// tests/castle-age-fixture.ts (explore option): played only through logged commands, so the page's restore re-derives
// it. Pointer, keyboard and minimap only: research Sanctity, walk monk and scout to the idle red villager, wound and
// convert it, watch the monk heal it, then fetch a remembered relic and store it in the monastery.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {serialize} from '../packages/sim/sim.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {castleAgeMatch} from './castle-age-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const s=castleAgeMatch(260925,{explore:true}),monk=s.units.find(u=>u.player===0&&u.kind==='monk'),scout=s.units.find(u=>u.player===0&&u.kind==='scout'),red=s.units.find(u=>u.id===4),size=s.map.size;
// The remembered relic nearest the red villager (where the monk will be after the conversion).
const relic=[...s.relicMemory[0]].sort((a,b)=>Math.hypot(a.x-red.x,a.y-red.y)-Math.hypot(b.x-red.x,b.y-red.y))[0];
const monasteryBox=obstacleBounds(s.map.obstacles.find(o=>o.id===s.buildings.find(b=>b.kind==='monastery').id));
note('對局準備',`tick ${s.tick}，第 ${s.ages[0]} 時代，命令 ${s.log.length} 筆，黃金 ${s.accounts[0].stock.gold}，記得的聖物 ${s.relicMemory[0].length} 個`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const text=id=>page.locator('#'+id).innerText();
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 async function screenOf(wx,wy,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(wy-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 async function minimapAt(wx,wz){const r=await page.locator('#minimap').boundingBox(),a=Number((await page.locator('#map').getAttribute('data-camera')).split(',')[3]),K=Math.SQRT1_2,n=size,sc=Math.min(r.width/(n*Math.SQRT2),r.height/(n*Math.SQRT2*K))*.96,dx=wx-n/2,dz=wz-n/2;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*sc,y:r.y+r.height/2+(dx*Math.sin(a)+dz*Math.cos(a))*K*sc};}
 const lookAt=async(wx,wz)=>{const m=await minimapAt(wx,wz);await page.mouse.click(m.x,m.y);await page.waitForTimeout(150);};
 // The monastery may be partly hidden behind other buildings: try its centre and corners, low and high.
 // A right click keeps the selection: the camera moves by minimap (H would select the town centre).
 async function clickMonastery(button='left'){if(button==='right')await lookAt((monasteryBox[0]+monasteryBox[2])/200,(monasteryBox[1]+monasteryBox[3])/200);else await page.keyboard.press('KeyH');await page.waitForTimeout(300);
  for(const [fx,fz,h] of [[0,0,.5],[-.3,.3,.5],[.3,.3,.5],[-.3,-.3,.5],[.3,-.3,.5],[0,0,1.8]]){const q=await screenOf((monasteryBox[0]+monasteryBox[2])/200+fx,h,(monasteryBox[1]+monasteryBox[3])/200+fz);
   if(button==='right'){const n=await act(()=>page.mouse.click(q.x,q.y,{button:'right'}));if(/修道院/.test(n))return n;continue;}
   await page.mouse.click(q.x,q.y);await page.waitForTimeout(120);if(await page.evaluate(()=>document.querySelector('#building-title').textContent==='修道院'&&!document.querySelector('#building-panel').hidden))return '修道院';}
  return null;}
 // 1. Load the save from the menu (the page re-derives it from the command log).
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');const loadStart=Date.now();await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:90000});note('讀取耗時',`${Date.now()-loadStart} ms`);
 await page.waitForFunction(()=>document.querySelector('#age-name').textContent==='第三時代');note('讀取',`${await text('notice')}｜${await text('age-name')}｜人口 ${await text('res-pop')}｜聖物 ${await text('res-relics')}`);
 assert.equal(await text('res-relics'),'0·0/5');
 // 2. The monastery: monk and technology tiles; the fourth-age ones say why they wait. Research Sanctity.
 await page.keyboard.press('Escape');assert.equal(await clickMonastery(),'修道院');
 const tiles=await page.locator('#production button').evaluateAll(b=>b.map(x=>`${x.dataset.train}${x.disabled?'✗':'✓'}`));note('修道院指令格',tiles.join(' '));
 assert.match(await page.locator('#production button[data-train="illumination"]').getAttribute('aria-label'),/需要第四時代/);
 await page.locator('#production button[data-train="sanctity"]').hover();await page.waitForFunction(()=>/聖潔/.test(document.querySelector('#tip').textContent));note('聖潔說明',(await text('tip')).replace(/\n/g,' / '));
 await page.locator('#speed').selectOption('4');note('研究聖潔',await act(()=>page.locator('#production button[data-train="sanctity"]').click()));
 await page.waitForFunction(()=>/已研究「聖潔」/.test(document.querySelector('#events').textContent),undefined,{timeout:60000});note('研究完成',await text('events'));
 await page.screenshot({path:out+'monastery-panel.png'});
 await page.screenshot({path:out+'monastery-tiles.png',clip:{x:0,y:720,width:300,height:180}});
 // 3. Select the monk (Sanctity: 45 hit points) and add the scout; keep them as group 1.
 await page.keyboard.press('Escape');let q=await screenOf(monk.x/100,.6,monk.y/100);await page.mouse.click(q.x,q.y);assert.equal(await text('unit-name'),'僧侶');
 note('僧侶面板',`${await text('unit-hp')}｜${(await text('unit-facts')).replace(/\n/g,' ')}`);assert.equal(await text('unit-hp'),'45/45');
 await lookAt(scout.x/100,scout.y/100);
 for(const h of [.9,.6,1.3,.3]){q=await screenOf(scout.x/100,h,scout.y/100);await page.keyboard.down('Shift');await page.mouse.click(q.x,q.y);await page.keyboard.up('Shift');await page.waitForTimeout(150);if(/斥候/.test(await page.locator('#group-summary').textContent()))break;}
 await page.keyboard.press('Control+Digit1');note('編組 1',await page.locator('#group-summary').textContent());assert.match(await page.locator('#group-summary').textContent(),/僧侶.*斥候|斥候.*僧侶/);
 // 4. Both walk to the red villager (minimap); a right click on it: the monk converts, the scout attacks.
 let m=await minimapAt(red.x/100-2.5,red.y/100);note('前往紅方',await act(()=>page.mouse.click(m.x,m.y,{button:'right'})));await lookAt(red.x/100,red.y/100);
 let ordered=null;for(let i=0;i<60&&!ordered;i++){q=await screenOf(red.x/100,.6,red.y/100);const n=await act(()=>page.mouse.click(q.x,q.y,{button:'right'}));if(/轉化紅方村民|攻擊紅方村民/.test(n)){ordered=n;break;}await page.waitForTimeout(300);}
 note('下令',ordered);assert.ok(ordered,'ordered against the red villager');
 // A few of the scout's blows land, then the scout stops (its portrait selects it alone, S stops it).
 await page.waitForTimeout(1800);await page.locator(`#group-grid [data-pick="${scout.id}"]`).click();await page.keyboard.press('KeyS');note('斥候停手',await text('notice'));
 await page.waitForFunction(()=>/轉化了紅方村民/.test(document.querySelector('#events').textContent),undefined,{timeout:60000});note('轉化結果',await text('events'));await page.screenshot({path:out+'monastery-converted.png'});
 // 5. The converted villager is wounded; the idle monk heals it back to full health.
 q=await screenOf(red.x/100,.6,red.y/100);await page.mouse.click(q.x,q.y);assert.equal(await text('unit-name'),'村民');const hurt=await text('unit-hp');note('轉化後的村民',hurt);
 assert.notEqual(hurt,'25/25','the scout wounded it before the conversion');
 await page.waitForFunction(()=>document.querySelector('#unit-hp').textContent==='25/25',undefined,{timeout:60000});note('治療後',await text('unit-hp'));
 // 6. Recall group 1, keep only the monk, and fetch the remembered relic nearest to it.
 await page.keyboard.press('Digit1');await page.locator(`#group-grid [data-pick="${monk.id}"]`).click();assert.equal(await text('unit-name'),'僧侶');
 await lookAt(relic.x/100,relic.y/100);q=await screenOf(relic.x/100,.2,relic.y/100);note('右鍵聖物',await act(()=>page.mouse.click(q.x,q.y,{button:'right'})));assert.match(await text('notice'),/前往撿起聖物/);
 await page.screenshot({path:out+'monastery-relic.png'});
 await page.waitForFunction(()=>/僧侶撿起了聖物/.test(document.querySelector('#events').textContent),undefined,{timeout:90000});note('撿起',await text('unit-status'));assert.equal(await text('unit-status'),'攜帶聖物');
 await page.screenshot({path:out+'monastery-carry.png'});
 // 7. Store it in the monastery with a right click; the relic count and the monastery panel show it.
 note('送回修道院',await clickMonastery('right'));assert.match(await text('notice'),/把聖物送進修道院/);
 await page.waitForFunction(()=>document.querySelector('#res-relics').textContent.startsWith('1·'),undefined,{timeout:120000});note('聖物',`${await text('res-relics')}｜${await text('events')}`);
 await page.keyboard.press('Escape');await clickMonastery();note('修道院狀態',await text('building-status'));assert.match(await text('building-status'),/聖物 1\/10（每分鐘 \+30 黃金）/);
 await page.screenshot({path:out+'monastery-stored.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS monastery: Sanctity researched, a wounded red villager converted and healed, a remembered relic fetched and stored');
}catch(e){if(page)await page.screenshot({path:out+'monastery-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
