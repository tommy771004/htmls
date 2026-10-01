// Civilizations on the game screen (no ?debug=1). First visit: the top bar names the default civ (不列顛), the menu's
// pickers list the thirteen civs plus the neutral settlers (and 隨機 for red); a restart with 條頓 against 日本 reaches the
// worker (the page's own save carries those civs). The encyclopedia lists 14 civs and shows each civ's bonuses and its
// unique unit with the numbers the simulation computes (statsOf / costOf here in node); Esc closes the book, then the
// menu; at 390×844 the open book does not scroll the page sideways. Then a Britons third-age match with a finished
// Castle, played only through logged commands (tests/castle-age-fixture.ts, then stone and the Castle), is loaded
// from the menu: the Castle offers the Longbowman and Yeomen only, prices from costOf, and trains a Longbowman.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {submit,tick,serialize,rulesetHash} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {civDefs,neutralCiv} from '../packages/content/civs.ts';
import {statsOf} from '../packages/sim/stats.ts';
import {costOf,ownerOf} from '../packages/sim/civ.ts';
import {castleAgeMatch} from './castle-age-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const resourceOf={食物:'food',木材:'wood',黃金:'gold',石頭:'stone'};
const priced=cost=>Object.fromEntries(Object.entries(cost).filter(([,v])=>v>0));
// 1. The Castle match: the fixture's Britons (blue) reach the third age against idle Franks, then the three villagers
// quarry 300 stone and raise a Castle next to the town centre (every step a logged command, so the page re-derives it).
const s=castleAgeMatch(260925,{civs:['britons','franks']});
const order=(t,p)=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType:t,payload:p});
const stock=s.accounts[0].stock,tcB=s.buildings.find(b=>b.player===0&&b.kind==='town-center'),tc=s.map.obstacles.find(o=>o.id===tcB.id);
const villagers=s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id),idle=id=>!s.works[id]&&!s.units.find(u=>u.id===id)?.path.length;
const stone=()=>s.map.resources.filter(r=>r.kind==='stone'&&r.collectible).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];
order('gather',{unitIds:villagers,resourceId:stone().id});
for(const end=s.tick+40000;stock.stone<300;){assert.ok(s.tick<end,`stone stalled at tick ${s.tick}: ${JSON.stringify(stock)}`);for(let i=0;i<20;i++)tick(s);for(const id of villagers)if(idle(id))order('gather',{unitIds:[id],resourceId:stone().id});}
const castleSite=(()=>{for(let r=300;r<=1200;r+=50)for(let a=0;a<24;a++){const x=Math.round((tc.x+Math.cos(a*Math.PI/12)*r)/10)*10,y=Math.round((tc.y+Math.sin(a*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,'castle',x,y))return {x,y};}throw Error('no castle site');})();
order('build',{unitIds:villagers,kind:'castle',...castleSite});
for(const end=s.tick+6000;!s.buildings.some(b=>b.player===0&&b.kind==='castle'&&b.complete);){assert.ok(s.tick<end,'castle stalled');tick(s);}
const castle=s.buildings.find(b=>b.player===0&&b.kind==='castle'),castleBox=obstacleBounds(s.map.obstacles.find(o=>o.id===castle.id)),blue=ownerOf(s,0),longbowId=s.nextUnitId;
note('對局準備',`tick ${s.tick}，${s.civs.join(' 對 ')}，第 ${s.ages[0]} 時代，命令 ${s.log.length} 筆，庫存 ${JSON.stringify(stock)}，城堡 ${castle.hp}/${castle.maxHp}`);
assert.ok(stock.wood>=costOf('longbowman',blue).wood&&stock.gold>=costOf('longbowman',blue).gold,'the save can pay for a Longbowman');
const uniqueOf=c=>[...c.uniqueUnits,...c.eliteUpgrades,...c.uniqueTechs.map(t=>t.id)];
const foreign=new Set(civDefs.filter(c=>c.id!=='britons').flatMap(uniqueOf));
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});};
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const text=id=>page.locator('#'+id).innerText();
 // 2. First visit: the default civ in the top bar; both pickers list every civ, settlers last, 隨機 first for red.
 assert.equal(await text('civ-name'),'不列顛');note('頂列',`${await text('civ-name')}｜${await text('age-name')}`);note('場景重建（首次進站）',`${await page.locator('canvas').first().getAttribute('data-rebuild-ms')} ms`);
 await page.keyboard.press('F10');await page.waitForFunction(()=>!document.querySelector('#menu').hidden);
 const options=id=>page.locator(`#${id} option`).evaluateAll(o=>o.map(x=>({value:x.value,text:x.textContent})));
 const blueOpts=await options('civ-blue'),redOpts=await options('civ-red'),playable=civDefs.filter(c=>c.id!==neutralCiv);
 note('藍方選項',blueOpts.map(o=>o.text).join('、'));
 assert.equal(blueOpts.length,14);assert.deepEqual(blueOpts.map(o=>o.value),[...playable.map(c=>c.id),neutralCiv]);assert.deepEqual(blueOpts.map(o=>o.text),[...playable.map(c=>c.name),'拓荒者（無加成）']);
 assert.equal(redOpts.length,15);assert.deepEqual(redOpts[0],{value:'random',text:'隨機'});assert.deepEqual(redOpts.slice(1).map(o=>o.value),blueOpts.map(o=>o.value));
 assert.equal(await page.locator('#civ-blue').inputValue(),'britons');assert.equal(await page.locator('#civ-red').inputValue(),'franks');
 // 3. Teutons against the Japanese: the top bar and the notice follow the worker's state; the page's own save has them.
 await page.locator('#civ-blue').selectOption('teutons');await page.locator('#civ-red').selectOption('japanese');note('文明說明',await text('civ-note'));
 await page.locator('#restart').click();await page.waitForFunction(()=>/已建立新沙盒/.test(document.querySelector('#notice').textContent));
 note('重新開始',`${await text('notice')}｜頂列 ${await text('civ-name')}`);assert.match(await text('notice'),/已建立新沙盒：條頓對日本/);
 await page.waitForFunction(()=>document.querySelector('#civ-name').textContent==='條頓');
 await page.keyboard.press('F10');await page.locator('#save').click();await page.waitForFunction(()=>/已儲存 tick/.test(document.querySelector('#notice').textContent));
 const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('brick-rts:sandbox:1')));
 assert.equal(saved.format,'brick-sandbox-30');assert.deepEqual(saved.state.civs,['teutons','japanese']);note('頁面存檔',`${saved.format}，文明 ${saved.state.civs.join(' 對 ')}，tick ${saved.state.tick}`);
 // 4. The encyclopedia from the menu: 14 civs, the player's own first; the Britons' page matches the simulation.
 await page.keyboard.press('F10');await page.locator('#codex-open').click();await page.waitForFunction(()=>!document.querySelector('#codex').hidden&&document.querySelector('#cx-civ-name'));
 const civButtons=await page.locator('#codex .cx-civ').evaluateAll(b=>b.map(x=>({id:x.dataset.civ,current:x.getAttribute('aria-current'),mark:x.querySelector('.cx-mark')?.textContent??''})));
 assert.equal(civButtons.length,14);assert.deepEqual(civButtons.map(c=>c.id),[...playable.map(c=>c.id),neutralCiv]);
 assert.equal(civButtons.find(c=>c.current==='true')?.id,'teutons','the book opens on the player\'s civ');
 assert.equal(civButtons.find(c=>c.id==='teutons').mark,'你的文明');assert.equal(civButtons.find(c=>c.id==='japanese').mark,'對手');
 note('百科列表',civButtons.map(c=>c.mark?`${c.id}（${c.mark}）`:c.id).join(' '));
 async function checkCiv(id){const def=civDefs.find(c=>c.id===id),o={civ:id,age:3,techs:[]};
  await page.locator(`#codex .cx-civ[data-civ="${id}"]`).click();await page.waitForFunction(n=>document.querySelector('#cx-civ-name')?.firstChild?.textContent===n,def.name);
  const bricks=await page.locator('#codex .cx-page .cx-bricks:not(.off) li').allInnerTexts();
  const own=def.effects.filter(e=>!e.trigger.tech||!def.uniqueTechs.some(t=>t.id===e.trigger.tech));
  for(const e of own)assert.ok(bricks.some(b=>b.includes(e.text.replace(/^團隊加成：/,''))),`${id}: bonus shown: ${e.text}`);
  const kind=def.uniqueUnits[0],st=statsOf(kind,o),card=page.locator('#codex .cx-unit').first();
  const cost=Object.fromEntries(await card.locator('.cx-ubody > .cx-cost span:not(.t)').evaluateAll(sp=>sp.map(x=>[x.querySelector('img')?.alt??'',x.textContent.trim()])).then(p=>p.map(([a,v])=>[resourceOf[a],Number(v)])));
  assert.deepEqual(cost,priced(costOf(kind,o)),`${id}: ${kind} cost`);
  const rows=Object.fromEntries(await card.locator('.cx-stats tbody tr').evaluateAll(tr=>tr.map(r=>[r.querySelector('th').textContent,r.querySelector('td').textContent])));
  assert.equal(rows['生命'],String(st.hp),`${id}: hp`);assert.equal(rows['攻擊'],`${st.damage}（${st.attack==='melee'?'近戰':'遠程'}）`,`${id}: attack`);
  assert.equal(rows['護甲'],`${st.armor[0]}/${st.armor[1]}`,`${id}: armor`);assert.equal(rows['射程'],st.range<=50?'近戰':`${st.range/100} 格`,`${id}: range`);
  note(`百科・${def.name}`,`加成 ${own.length} 條｜${await card.locator('h5').innerText()}｜費用 ${JSON.stringify(cost)}｜${Object.entries(rows).map(([k,v])=>`${k} ${v}`).join('，')}`);
  return {kind,st,cost};}
 const teuton=await checkCiv('teutons');await checkCiv('japanese');const briton=await checkCiv('britons');
 assert.equal(briton.st.range,350,'the Longbowman\'s third-age range includes the Britons bonus');assert.deepEqual(briton.cost,{wood:35,gold:40});
 await page.screenshot({path:out+'civs-codex.png'});note('百科截圖',`條頓騎士 ${teuton.st.hp} 生命`);
 // Esc closes the book first (the menu stays), then the menu.
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#codex').hidden);assert.equal(await page.locator('#menu').isHidden(),false,'the menu stays open under the book');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#menu').hidden);note('Esc','先關百科，再關選單');
 // 5. Load the Britons Castle save from the menu (the page re-derives it from the command log).
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');const loadStart=Date.now();await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:90000});note('讀取耗時',`${Date.now()-loadStart} ms`);
 await page.waitForFunction(()=>document.querySelector('#age-name').textContent==='第三時代'&&document.querySelector('#civ-name').textContent==='不列顛');
 assert.equal(await page.locator('#civ-blue').inputValue(),'britons');assert.equal(await page.locator('#civ-red').inputValue(),'franks');
 note('讀取',`${await text('notice')}｜${await text('civ-name')}${await text('age-name')}｜人口 ${await text('res-pop')}｜石頭 ${await text('res-stone')}`);
 // Rebuild cost of the battlefield with the Castle and the regional styles (scene.ts records the last rebuild).
 note('場景重建（有城堡）',`${await page.locator('canvas').first().getAttribute('data-rebuild-ms')} ms`);
 // 6. Pick the Castle with the pointer, aimed with the camera the canvas reports after H; it is tall, so try high too.
 async function pickCastle(){await page.keyboard.press('KeyH');await page.keyboard.press('Escape');await page.waitForTimeout(300);
  const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=(castleBox[0]+castleBox[2])/200-fx,dz=(castleBox[1]+castleBox[3])/200-fz;
  for(const h of [.5,1.2,2,3])for(const [fx2,fz2] of [[0,0],[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]){const ox=dx+fx2*(castleBox[2]-castleBox[0])/100,oz=dz+fz2*(castleBox[3]-castleBox[1])/100;
   await page.mouse.click(r.x+r.width/2+(ox*Math.cos(a)-oz*Math.sin(a))*scale,r.y+r.height/2-(h-(ox*Math.sin(a)+oz*Math.cos(a)))*Math.SQRT1_2*scale);await page.waitForTimeout(120);
   if(await page.evaluate(()=>!document.querySelector('#building-panel').hidden&&document.querySelector('#building-title').textContent==='城堡'))return;}
  throw Error('could not pick the Castle');}
 await pickCastle();assert.equal(await text('building-owner'),'藍方 · 不列顛');
 const tiles=await page.locator('#production button[data-train]').evaluateAll(b=>b.map(x=>({id:x.dataset.train,disabled:x.disabled,label:x.getAttribute('aria-label')??''})));
 note('城堡指令格',tiles.map(t=>`${t.id}${t.disabled?'✗':'✓'}`).join(' '));
 const ids=tiles.map(t=>t.id);assert.ok(ids.includes('longbowman')&&ids.includes('yeomen'),'Longbowman and Yeomen at the Castle');
 assert.deepEqual(ids.filter(id=>foreign.has(id)),[],'no other civilization\'s unique items');
 assert.equal(tiles.find(t=>t.id==='longbowman').disabled,false);
 for(const t of tiles.filter(t=>t.id.startsWith('elite-')))assert.match(t.label,/需要第四時代/);
 // The hover card: the Britons' price, from costOf.
 await page.locator('#production button[data-train="longbowman"]').hover();await page.waitForFunction(()=>/長弓兵/.test(document.querySelector('#tip').textContent));
 const tipCost=Object.fromEntries(await page.locator('#tip .cost span').evaluateAll(sp=>sp.map(x=>[x.querySelector('img')?.alt??'',x.textContent.trim()])).then(p=>p.map(([a,v])=>[resourceOf[a],Number(v)])));
 note('長弓兵說明',(await text('tip')).replace(/\n/g,' / '));assert.deepEqual(tipCost,priced(costOf('longbowman',blue)));
 await page.locator('#production button[data-train="yeomen"]').hover();await page.waitForFunction(()=>/義勇騎兵/.test(document.querySelector('#tip').textContent));
 const yeomenCost=Object.fromEntries(await page.locator('#tip .cost span').evaluateAll(sp=>sp.map(x=>[x.querySelector('img')?.alt??'',x.textContent.trim()])).then(p=>p.map(([a,v])=>[resourceOf[a],Number(v)])));
 note('義勇騎兵說明',(await text('tip')).replace(/\n/g,' / '));assert.deepEqual(yeomenCost,priced(costOf('yeomen',blue)));
 await page.keyboard.press('KeyF');await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();await page.waitForTimeout(400);
 await page.screenshot({path:out+'civs-castle.png'});
 // 7. Train a Longbowman: wood and gold are spent, it walks out with its portrait, name and owner.
 const wood0=await text('res-wood'),pop0=await text('res-pop');await page.locator('#production button[data-train="longbowman"]').click();
 await page.waitForFunction(([w,p])=>document.querySelector('#res-wood').textContent!==w&&document.querySelector('#res-pop').textContent!==p,[wood0,pop0]);
 assert.equal(Number(wood0)-Number(await text('res-wood')),costOf('longbowman',blue).wood);note('訓練長弓兵',`木材 ${wood0} → ${await text('res-wood')}，黃金 ${await text('res-gold')}，人口 ${await text('res-pop')}`);
 await page.locator('#speed').selectOption('4');await page.waitForFunction(()=>/長弓兵已生產/.test(document.querySelector('#events').textContent),undefined,{timeout:60000});note('長弓兵出生',await text('events'));
 // The Longbowman is blue's only soldier (scout and monk are not army): 「,」 selects it alone.
 await page.keyboard.press('Escape');await page.keyboard.press('Comma');await page.waitForFunction(()=>/已選取全部軍隊：1 名/.test(document.querySelector('#notice').textContent));
 assert.equal(await text('unit-name'),'長弓兵');assert.match(await text('unit-owner'),new RegExp(`^藍方 · 不列顛 · #${longbowId}$`));
 const portrait=await page.locator('#unit-portrait').getAttribute('src');assert.ok(portrait,'the Longbowman has a portrait');
 note('長弓兵面板',`${await text('unit-name')}｜${await text('unit-owner')}｜${await text('unit-hp')}｜${(await text('unit-facts')).replace(/\n/g,' ')}`);
 const lb=statsOf('longbowman',blue);assert.equal(await text('unit-hp'),`${lb.hp}/${lb.hp}`);
 await page.keyboard.press('KeyF');await page.waitForTimeout(500);await page.screenshot({path:out+'civs-longbowman.png'});
 // 8. Phone: the book open at 390×844 does not scroll the page or the overlay sideways (its civ strip scrolls by design).
 const phone=await browser.newPage({viewport:{width:390,height:844}});watch(phone);
 await phone.goto(origin+'/web/150-brick-rts.html');await phone.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 await phone.keyboard.press('F10');await phone.locator('#codex-open').click();await phone.waitForFunction(()=>!document.querySelector('#codex').hidden&&document.querySelector('#cx-civ-name'));
 await phone.locator('#codex .cx-civ[data-civ="britons"]').click();await phone.waitForTimeout(300);
 const fit=await phone.evaluate(()=>{const c=document.querySelector('#codex'),cx=c.querySelector('.cx'),d=c.querySelector('.cx-detail');
  return {page:document.documentElement.scrollWidth,body:document.body.scrollWidth,width:innerWidth,host:[c.scrollWidth,c.clientWidth],book:cx.getBoundingClientRect().right,detail:[d.scrollWidth,d.clientWidth]};});
 note('手機百科',JSON.stringify(fit));
 assert.ok(fit.page<=fit.width&&fit.body<=fit.width,'no horizontal page scroll');assert.ok(fit.host[0]<=fit.host[1],'the overlay does not scroll sideways');
 assert.ok(fit.book<=fit.width,'the book fits the screen');assert.ok(fit.detail[0]<=fit.detail[1],'the civ page does not scroll sideways');
 await phone.screenshot({path:out+'civs-codex-mobile.png'});
 await phone.keyboard.press('Escape');await phone.waitForFunction(()=>document.querySelector('#codex').hidden);assert.equal(await phone.locator('#menu').isHidden(),false);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS civs: pickers, restart with 條頓 vs 日本, the encyclopedia matches the simulation, the Britons Castle trains a Longbowman, the book fits a phone');
}catch(e){if(page)await page.screenshot({path:out+'civs-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
