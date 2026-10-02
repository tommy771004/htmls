// The 戰術技巧 round's openings on the game screen (?debug=1, paused start). Practice: the menu's 練習開局 picks 肉馬開局;
// a match of logged commands (three villagers on the starting sheep, two new ones on wood) loaded through the menu
// ticks the checklist's first two steps, with their game times, and marks the third as current; F2 folds the list.
// The computer's opening: 電腦開局 = 純塔 starts a match the worker stores with that opening (the page's own save
// says so), and the select is off while red does nothing. A phone shows the list folded to one line that opens on a
// tap. No page errors, no outside requests, no sideways scrolling.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState,submit,tick,rulesetHash,serialize} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {openingView} from '../packages/sim/ai.ts';
import {openingById,needMet} from '../packages/content/openings.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
// Fixture: open map, idle red. The first villager raises a house (the town centre houses five: three villagers and the
// scout), then all three take the town centre's own sheep; two villagers are trained and sent to the nearest trees. Saved once both of 肉馬開局's first steps hold at the same tick.
const s=createState(260925,'open','idle',['mongols','franks']);
const order=(t,p)=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType:t,payload:p});
const run=n=>{for(let i=0;i<n;i++)tick(s);};
const tc=s.buildings.find(b=>b.player===0&&b.kind==='town-center');
const villagers=()=>s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id).sort((a,b)=>a-b);
const sheep=s.units.filter(u=>u.player===0&&u.kind==='sheep').sort((a,b)=>a.id-b.id);
// Onto the sheep the others work: their carcass while it lasts, else the next live sheep of the flock.
const toSheep=id=>{const w=Object.values(s.works).find(w=>w.kind==='gather'&&w.resourceId&&s.map.resources.find(r=>r.id===w.resourceId&&r.kind==='livestock'&&r.collectible));
 if(w){order('gather',{unitIds:[id],resourceId:w.resourceId});return;}const next=s.units.find(u=>u.player===0&&u.kind==='sheep');if(next)order('hunt',{unitIds:[id],animalId:next.id});};
const site=(()=>{for(let r=300;r<=800;r+=50)for(let a=0;a<24;a++){const x=Math.round((tc.x+135+Math.cos(a*Math.PI/12)*r)/10)*10,y=Math.round((tc.y+135+Math.sin(a*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,'house',x,y))return {x,y};}throw Error('no house site');})();
order('build',{unitIds:[villagers()[0]],kind:'house',...site});order('hunt',{unitIds:villagers().slice(1),animalId:sheep[0].id});run(2);
order('train',{buildingId:tc.id,entryId:'villager'});run(1);
for(let guard=0;guard<4000&&!s.buildings.some(b=>b.player===0&&b.kind==='house'&&b.complete);guard+=20)run(20);
toSheep(villagers()[0]);order('train',{buildingId:tc.id,entryId:'villager'});run(1);
const scrush=openingById('scrush'),steps=scrush.steps.filter(st=>st.done);
for(let guard=0;guard<6000;guard+=20){run(20);
 const fresh=villagers().slice(3).filter(id=>!s.works[id]);
 if(fresh.length){const seen=new Set(s.vision[0].explored),tree=s.map.resources.filter(r=>r.kind==='tree'&&r.collectible&&seen.has(Math.floor(r.y/100)*s.map.size+Math.floor(r.x/100))).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];order('gather',{unitIds:fresh,resourceId:tree.id});}
 // Keep the first three on sheep (the next one once a carcass runs out).
 for(const id of villagers().slice(0,3))if(!s.works[id])toSheep(id);
 const v=openingView(s,0);if(needMet(steps[0].done,v)&&needMet(steps[1].done,v))break;}
const view=openingView(s,0);note('夾具',`tick ${s.tick}，村民 ${view.villagers}，${JSON.stringify(view.gather)}`);
assert.ok(needMet(steps[0].done,view)&&needMet(steps[1].done,view),'the fixture meets the first two steps');assert.ok(!needMet(steps[2].done,view),'not the third');
const save=serialize(s);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});};
const loadSave=async p=>{await p.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),save);await p.locator('#menu-open').click();await p.locator('#load').click();await p.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:60000});};
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 const text=id=>page.locator('#'+id).innerText();
 // 1. No practice chosen: no list; F2 says where to pick one.
 assert.equal(await page.locator('#coach').isVisible(),false);await page.locator('#map').click({position:{x:40,y:400}});await page.keyboard.press('F2');note('F2（未選）',await text('notice'));assert.match(await text('notice'),/練習開局/);
 // 2. The menu's 練習開局 lists 不練習 and the nine openings; 肉馬開局 shows its checklist.
 await page.keyboard.press('F10');const practice=await page.locator('#practice option').allInnerTexts();note('練習開局選項',practice.join('、'));assert.equal(practice.length,10);
 await page.locator('#practice').selectOption('scrush');await page.keyboard.press('F10');
 await page.waitForFunction(()=>!document.querySelector('#coach').hidden);note('清單標題',`${await text('coach-title')} ${await text('coach-count')}`);assert.equal(await text('coach-title'),'練習：肉馬開局');
 const total=steps.length;assert.equal(await text('coach-count'),`0/${total}`);
 // 3. The fixture match: the first two steps tick with their times, the third is current.
 await loadSave(page);await page.waitForFunction(()=>document.querySelectorAll('#coach li[data-state=done]').length>=2);
 const done=await page.locator('#coach li[data-state=done]').allInnerTexts(),now=await page.locator('#coach li[aria-current=step]').innerText();
 note('已完成',done.join('｜'));note('目前步驟',now);assert.equal(done.length,2);assert.match(done[0],/3 人採羊肉\s*\d\d:\d\d/);assert.match(done[1],/2 人伐木\s*\d\d:\d\d/);assert.match(now,/打獵/);
 assert.equal(await text('coach-count'),`2/${total}`);assert.ok(await page.locator('#coach li[data-state=advice]').count()>=1,'advice lines without a box');
 note('配置',await page.locator('.coach-foot').innerText());
 await page.screenshot({path:out+'openings-coach-1440.png'});
 // 4. F2 folds the list to its title line and opens it again.
 await page.locator('#map').click({position:{x:760,y:520}});await page.keyboard.press('F2');assert.equal(await page.locator('#coach-body').isVisible(),false);assert.equal(await page.locator('#coach-toggle').getAttribute('aria-expanded'),'false');
 await page.keyboard.press('F2');assert.equal(await page.locator('#coach-body').isVisible(),true);
 // 5. The computer's opening: off while red does nothing; 純塔 starts a match stored with that opening.
 await page.keyboard.press('F10');await page.locator('#opponent').selectOption('idle');assert.equal(await page.locator('#ai-opening').isDisabled(),true);
 const choices=await page.locator('#ai-opening option').allInnerTexts();note('電腦開局選項',choices.join('、'));assert.equal(choices.length,11);
 await page.locator('#opponent').selectOption('ai');await page.locator('#layout').selectOption('open');await page.locator('#ai-opening').selectOption('towerrush');
 await page.locator('#restart').click();await page.waitForFunction(()=>/已建立新沙盒/.test(document.querySelector('#notice').textContent),undefined,{timeout:30000});
 note('新遊戲',await text('notice'));assert.match(await text('notice'),/電腦開局：純塔/);
 assert.equal(await page.locator('#coach li[data-state=done]').count(),0,'the checklist starts over');
 await page.keyboard.press('F10');await page.locator('#save').click();const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('brick-rts:sandbox:1')).state);
 note('存檔',`對手 ${stored.opponent}，電腦開局 ${stored.aiOpening}`);assert.equal(stored.opponent,'ai');assert.equal(stored.aiOpening,'towerrush');
 // 6. Random stays hidden in the notice.
 await page.keyboard.press('F10');await page.locator('#ai-opening').selectOption('random');await page.locator('#restart').click();
 await page.waitForFunction(()=>/電腦開局隨機/.test(document.querySelector('#notice').textContent),undefined,{timeout:30000});note('隨機',await text('notice'));assert.doesNotMatch(await text('notice'),/電腦開局：/);
 // 7. A phone: the list starts folded to one line; a tap opens it; nothing scrolls sideways.
 const phone=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});watch(phone);
 await phone.goto(origin+'/web/150-brick-rts.html?debug=1');await phone.evaluate(()=>localStorage.setItem('brick-rts:practice:1','scrush'));
 await phone.reload();await phone.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 await phone.waitForFunction(()=>!document.querySelector('#coach').hidden);assert.equal(await phone.locator('#coach-body').isVisible(),false,'folded on a phone');
 await phone.screenshot({path:out+'openings-coach-390-folded.png'});
 await loadSave(phone);await phone.locator('#coach-toggle').tap();await phone.waitForFunction(()=>document.querySelectorAll('#coach li[data-state=done]').length>=2);
 const box=await phone.locator('#coach').boundingBox();note('手機清單',`x ${Math.round(box.x)} 寬 ${Math.round(box.width)} 高 ${Math.round(box.height)}`);assert.ok(box.x>=0&&box.x+box.width<=390,'the list fits the phone');
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no sideways scrolling');
 await phone.screenshot({path:out+'openings-coach-390.png'});
 note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS openings: practice checklist ticks the first steps, F2 folds it, the computer plays the chosen opening, phone list');
}catch(e){if(page)await page.screenshot({path:out+'openings-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
