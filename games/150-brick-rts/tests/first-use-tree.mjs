// The 科技樹 round on the game screen (?debug=1, paused start). A Britons match of logged commands (Loom researched, a
// villager in the town centre's queue) is loaded through the menu; F4 opens the codex on the tree of the player's own
// civilization with the match marks (Loom done, the queued villager in progress, villagers owned, the Castle not yet,
// the Hussar not in this tree, the eagle scout not in this game). Another civilization's tree has no match marks and
// greys out what that civilization lacks; an item opens its own page. F4 closes the book again. A phone opens the tree
// from the menu; the tree scrolls inside its own boxes, never the page. No page errors, no outside requests.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState,submit,tick,rulesetHash,serialize} from '../packages/sim/sim.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
// Fixture: open map, idle red, Britons against Franks. Loom is researched, then a villager is queued (and saved while
// it is still in the queue).
const s=createState(260925,'open','idle',['britons','franks']);
const order=(t,p)=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType:t,payload:p});
const run=n=>{for(let i=0;i<n;i++)tick(s);};
const tc=s.buildings.find(b=>b.player===0&&b.kind==='town-center');
order('train',{buildingId:tc.id,entryId:'loom'});run(1);
for(let guard=0;guard<4000&&!s.techs[0].includes('loom');guard+=20)run(20);
order('train',{buildingId:tc.id,entryId:'villager'});run(5);
assert.ok(s.techs[0].includes('loom'),'Loom researched');assert.equal(tc.queue[0]?.entryId,'villager','a villager in the queue');
note('夾具',`tick ${s.tick}，科技 ${s.techs[0].join('、')}，佇列 ${tc.queue.map(q=>q.entryId).join('、')}`);
const save=serialize(s);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});};
const loadSave=async p=>{await p.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),save);await p.locator('#menu-open').click();await p.locator('#load').click();await p.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:60000});};
const cls=(p,sel)=>p.locator(sel).first().getAttribute('class');
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 await loadSave(page);if(await page.locator('#menu').isVisible())await page.keyboard.press('F10');
 // 1. F4 on the battlefield: the book opens on 科技樹, on the player's own civilization, with the match marks.
 await page.locator('#map').click({position:{x:40,y:400}});await page.keyboard.press('F4');
 await page.waitForFunction(()=>!document.querySelector('#codex').hidden&&document.querySelector('#cx-tree-name'));
 assert.equal(await page.locator('#cx-tab-tree').getAttribute('aria-selected'),'true');
 const title=await page.locator('#cx-tree-name').innerText();note('標題',title.replace(/\n/g,' '));assert.match(title,/不列顛・科技樹/);
 assert.match(await page.locator('.cx-sub').first().innerText(),/目前對局：第一時代/);
 const loom=await cls(page,'.cx-tnode[data-page="loom"]'),vill=page.locator('.cx-tnode[data-page="villager"]').first();
 note('織布機',loom);assert.match(loom,/s-done/);
 note('村民',`${await vill.getAttribute('class')}｜${await vill.innerText()}`);assert.match(await vill.getAttribute('class'),/s-queued/);
 assert.equal(await page.locator('.cx-tblock h4 button[data-page="castle"]').getAttribute('data-state'),'later');
 const hussar=page.locator('.cx-tnode[data-page="scout"]',{hasText:'匈牙利輕騎兵'});assert.match(await hussar.getAttribute('class'),/\boff\b/);assert.match(await hussar.innerText(),/沒有/);
 const eagle=page.locator('.cx-tnode.ref',{hasText:'鷹斥候'});assert.equal(await eagle.count(),1);assert.match(await eagle.innerText(),/本作沒有/);
 const blocks=await page.locator('.cx-tblock h4').allInnerTexts();note('區塊',blocks.map(b=>b.split('\n')[0]).join('、'));assert.equal(blocks.length,15);
 await page.screenshot({path:out+'tree-1440.png'});
 // 2. The reference items can be hidden.
 await page.locator('.cx-tree-tools .cx-tool.pend').click();assert.equal(await page.locator('.cx-tnode.ref').count(),0);
 await page.locator('.cx-tree-tools .cx-tool.pend').click();assert.ok(await page.locator('.cx-tnode.ref').count()>0);
 // 3. Another civilization: no match marks; what the Franks lack is greyed out (the Keep).
 await page.locator('.cx-list .cx-civ[data-civ="franks"]').click();await page.waitForFunction(()=>/法蘭克・科技樹/.test(document.querySelector('#cx-tree-name').textContent));
 assert.match(await page.locator('.cx-sub').first().innerText(),/不是你這局的文明/);
 assert.equal(await page.locator('.cx-tnode[class*="s-"]').count(),0,'no match marks on another civ');
 assert.match(await cls(page,'.cx-tnode[data-page="keep"]'),/\boff\b/);
 // 4. An item opens its own page: the archer line in 單位.
 await page.locator('.cx-tnode[data-page="archer"]').first().click();
 await page.waitForFunction(()=>document.querySelector('#cx-tab-units').getAttribute('aria-selected')==='true');
 const unit=await page.locator('.cx-detail h3').first().innerText();note('點擊弓手',unit.split('\n')[0]);assert.match(unit,/弓手/);
 // 5. F4 closes the book.
 await page.keyboard.press('F4');await page.waitForFunction(()=>document.querySelector('#codex').hidden);
 // 6. A phone: the menu's 科技樹 button; the tree's boxes scroll, the page does not.
 const phone=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});watch(phone);
 await phone.goto(origin+'/web/150-brick-rts.html?debug=1');await phone.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 await loadSave(phone);if(!await phone.locator('#menu').isVisible())await phone.locator('#menu-open').tap();await phone.locator('#tree-open').tap();
 await phone.waitForFunction(()=>!document.querySelector('#codex').hidden&&document.querySelector('#cx-tree-name'));
 assert.match(await cls(phone,'.cx-tnode[data-page="loom"]'),/s-done/);
 const wide=await phone.evaluate(()=>Array.from(document.querySelectorAll('.cx-tblock .cx-scroll')).filter(e=>e.scrollWidth>e.clientWidth+1).length);note('手機可橫捲的區塊',wide);assert.ok(wide>0,'wide blocks scroll inside their box');
 const over=await phone.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth,book:Array.from(document.querySelectorAll('.cx,.cx-head,.cx-body,.cx-detail')).some(e=>e.getBoundingClientRect().right>innerWidth+0.5)}));
 note('手機溢出',JSON.stringify(over));assert.deepEqual(over,{page:false,book:false});
 await phone.screenshot({path:out+'tree-390.png'});
 await phone.locator('.cx-detail').evaluate(e=>{e.scrollTop=e.scrollHeight*0.35;});await phone.screenshot({path:out+'tree-390-blocks.png'});
 note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS tree: F4 opens the own tree with match marks, other civs greyed, items open their pages, phone scrolls inside');
}catch(e){if(page)await page.screenshot({path:out+'tree-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
