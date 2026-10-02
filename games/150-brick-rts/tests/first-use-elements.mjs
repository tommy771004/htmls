// The 遊戲元素 round on the game screen (?debug=1, paused start): villagers repair a house (住宅) red knocked hit points off
// (its hit points rise, the wood drops by the repair's share), a barracks with its rally point on itself trains a militia
// that goes straight inside, and two militia board a ram (the panel shows them and their boost) and step out again (U).
// The starting match is a fixture of logged commands loaded through the menu (tests/elements-fixture.ts). Pointer and
// tiles only; 1440x900 and 390x844, no page errors, no outside requests, no sideways scroll on the phone.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {serialize} from '../packages/sim/sim.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {elementsMatch} from './elements-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const m=elementsMatch(),s=m.s,boxOf=id=>obstacleBounds(s.map.obstacles.find(o=>o.id===id)),centre=b=>({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2});
const house=centre(boxOf(m.house)),barracks=centre(boxOf(m.barracks)),ram=s.units.find(u=>u.id===m.ram),militia=m.militia.map(id=>s.units.find(u=>u.id===id));
note('對局準備',`tick ${s.tick}，第 ${s.ages[0]} 時代，命令 ${s.log.length} 筆，庫存 ${JSON.stringify(s.accounts[0].stock)}；住宅 ${s.buildings.find(b=>b.id===m.house).hp}/${s.buildings.find(b=>b.id===m.house).maxHp}`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 const text=id=>page.locator('#'+id).innerText(),num=async id=>Number(await text(id));
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 async function screenOf(wx,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(0-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 const at=p=>screenOf(p.x/100,p.y/100);
 async function minimapAt(wx,wz){const r=await page.locator('#minimap').boundingBox(),a=Number((await page.locator('#map').getAttribute('data-camera')).split(',')[3]),K=Math.SQRT1_2,n=s.map.size,sc=Math.min(r.width/(n*Math.SQRT2),r.height/(n*Math.SQRT2*K))*.96,dx=wx-n/2,dz=wz-n/2;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*sc,y:r.y+r.height/2+(dx*Math.sin(a)+dz*Math.cos(a))*K*sc};}
 const look=async p=>{const q=await minimapAt(p.x/100,p.y/100);await page.mouse.click(q.x,q.y);await page.waitForTimeout(300);};
 async function runUntil(check,arg,timeout=120000){await page.locator('#pause').click();await page.waitForFunction(check,arg,{timeout});await page.locator('#pause').click();await page.waitForTimeout(200);}
 const step=async()=>{const t=await num('tick');await page.locator('#step').click();await page.waitForFunction(t0=>Number(document.querySelector('#tick').textContent)>t0,t);};
 const leftAt=async p=>{await page.keyboard.press('Escape');const q=await at(p);await page.mouse.click(q.x,q.y);await page.waitForTimeout(150);};
 const rightAt=async p=>{const q=await at(p);return act(()=>page.mouse.click(q.x,q.y,{button:'right'}));};
 const phone=async name=>{await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:out+`${name}-390.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at 390 (${name})`);await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(400);};
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:120000});
 note('讀取',await text('stock'));
 // 1. Repair: the house's panel offers it with the cost of a full repair; villagers sent there restore it point by point.
 await look(house);await leftAt(house);assert.equal(await text('building-title'),'住宅');
 note('受損住宅',`${await text('building-hp')}｜${await text('building-status')}`);assert.equal(await text('building-hp'),'90/150');assert.match(await text('building-status'),/可修理（修滿 木材 15）/);
 await page.keyboard.press('Escape');await page.locator('[data-unit="1"]').click();await page.locator('[data-unit="2"]').click({modifiers:['Shift']});await page.locator('[data-unit="3"]').click({modifiers:['Shift']});
 const wood0=await num('res-wood');note('右鍵住宅',await rightAt(house));assert.match(await text('notice'),/前往修理住宅：修滿約需 木材 15/);
 // Mid-repair: the house counts its repairers, a villager names its job (the selection does not change the orders).
 await leftAt(house);await runUntil(()=>/名村民修理中/.test(document.querySelector('#building-status').textContent),undefined,60000);
 note('修理中',`${await text('building-hp')}｜${await text('building-status')}`);await page.screenshot({path:out+'elements-repair-house.png'});
 await page.keyboard.press('Escape');await page.locator('[data-unit="1"]').click();const job=`${await text('unit-status')}｜${(await text('unit-facts')).replace(/\s+/g,' ')}`;note('村民 1',job);assert.match(job,/修理住宅：生命 \d+\/150/);
 await page.screenshot({path:out+'elements-repair.png'});await phone('elements-repair');await leftAt(house);
 await runUntil(()=>document.querySelector('#building-hp').textContent==='150/150',undefined,120000);
 note('修好',`${await text('building-hp')}｜${await text('stock')}`);assert.equal(await num('res-wood'),wood0-6,'60 of 150 hit points cost 6 of the house\'s 15 (half of 30)');
 // 2. The barracks: a right-click on itself sets the rally inside; a militia trained there goes in and shows on the panel.
 await look(barracks);await leftAt(barracks);assert.equal(await text('building-title'),'兵營');note('兵營',await text('rally-hint'));assert.match(await text('rally-hint'),/右鍵建築本身讓新兵進駐/);
 note('右鍵兵營本身',await rightAt(barracks));assert.match(await text('notice'),/新兵將直接進駐建築/);await step();
 assert.match(await text('rally-hint'),/集結：進駐建築內/);note('集結',await text('rally-hint'));
 const food0=await num('res-food');note('訓練民兵',await act(()=>page.keyboard.press('KeyQ')));await step();assert.equal(await num('res-food'),food0-60);
 await runUntil(()=>/進駐 1\/10/.test(document.querySelector('#building-status').textContent),undefined,120000);
 note('進駐',await text('building-status'));assert.equal(await page.locator('#building-riders img').count(),1,'one portrait inside');assert.equal(await page.locator('#building-riders').isVisible(),true,'portraits show on the desktop panel (the phone keeps the count only)');
 await page.screenshot({path:out+'elements-rally-inside.png'});await phone('elements-rally-inside');
 // 3. The ram: the two militia board it (right-click), its panel shows them and their boost; U lets them out.
 await look(militia[0]);await page.keyboard.press('Escape');{const [a,b]=await Promise.all(militia.map(at)),x0=Math.min(a.x,b.x)-40,x1=Math.max(a.x,b.x)+40,y0=Math.min(a.y,b.y)-50,y1=Math.max(a.y,b.y)+30;
  await page.mouse.move(x0,y0);await page.mouse.down();await page.mouse.move(x1,y1,{steps:6});await page.mouse.up();await page.waitForTimeout(200);}
 note('選取民兵',await text('group-summary'));assert.match(await text('group-summary'),/已選取 2 名/);
 await look(ram);note('右鍵攻城槌',await rightAt(ram));assert.match(await text('notice'),/登上攻城槌/);
 await leftAt(ram);assert.equal(await text('unit-name'),'攻城槌');
 await runUntil(()=>/乘客 2\/4/.test(document.querySelector('#unit-facts').textContent),undefined,60000);
 const facts=(await text('unit-facts')).replace(/\s+/g,' ');note('攻城槌',facts);assert.match(facts,/步兵 2 名：速度 \+20%、對建築 \+6/);assert.equal(await page.locator('#unit-facts .riders img').count(),2);
 assert.equal(await page.locator('#unload-cmd').isVisible(),true,'the release tile shows for a loaded ram');
 await page.screenshot({path:out+'elements-ram.png'});await phone('elements-ram');
 note('放出（U）',await act(()=>page.keyboard.press('KeyU')));assert.match(await text('notice'),/乘客下來了/);await step();
 await page.waitForFunction(()=>/乘客 0\/4/.test(document.querySelector('#unit-facts').textContent),undefined,{timeout:10000});note('放出後',(await text('unit-facts')).replace(/\s+/g,' '));
 // 4. The codex's 遊戲元素 tab: the taunts page offers the page's own voice (朗讀) on every spoken line; checked on the phone too.
 await page.keyboard.press('F10');await page.locator('#codex-open').click();await page.waitForFunction(()=>!document.querySelector('#codex').hidden);
 await page.locator('.cx-tab',{hasText:'遊戲元素'}).click();await page.locator('.cx-uitem[data-element="taunts"]').click();
 const say=await page.locator('#codex .cx-say').count();note('百科・嘲諷語音',`朗讀按鈕 ${say} 個`);assert.ok(say>=30,'the taunts table offers 朗讀 on the spoken lines');
 await page.screenshot({path:out+'elements-codex-taunts.png'});await phone('elements-codex-taunts');await page.keyboard.press('Escape');
 note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS elements: a house repaired for its share of wood, a militia trained into its barracks, a ram boarded and emptied');
}catch(e){if(page)await page.screenshot({path:out+'elements-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
