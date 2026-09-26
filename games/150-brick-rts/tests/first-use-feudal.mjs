// Second-age military buildings on the game screen (no ?debug=1): a match with a barracks, a stable and an archery
// range is played for real in the simulation (every command logged, so the page's restore re-derives it), saved,
// loaded from the menu; each building is picked with the pointer and trains its unit.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState,submit,tick,serialize,rulesetHash} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
// 1. Play it: berries to 300 food, second age, wood, then barracks, stable and archery range, and a farm for food.
const s=createState(260925,'open','idle');
const order=(t,p)=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType:t,payload:p});
const until=(done,limit=20000)=>{const end=s.tick+limit;while(!done()){assert.ok(s.tick<end,'setup stalled');tick(s);}};
const tcBuilding=s.buildings.find(b=>b.player===0&&b.kind==='town-center'),tc=s.map.obstacles.find(o=>o.id===tcBuilding.id);
const nearest=kind=>s.map.resources.filter(r=>r.kind===kind).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];
function site(kind){for(let r=300;r<=900;r+=50)for(let a=0;a<16;a++){const x=Math.round((tc.x+Math.cos(a*Math.PI/8)*r)/10)*10,y=Math.round((tc.y+Math.sin(a*Math.PI/8)*r)/10)*10;if(!authoritativeProblem(s,0,kind,x,y))return {x,y};}throw Error('no site for '+kind);}
order('gather',{unitIds:[1,2,3],resourceId:nearest('berries').id});until(()=>s.accounts[0].stock.food>=300);
order('train',{buildingId:tcBuilding.id,entryId:'age-2'});until(()=>s.ages[0]===2);
order('gather',{unitIds:[1,2,3],resourceId:nearest('tree').id});until(()=>s.accounts[0].stock.wood>=640,40000);
for(const kind of ['house','barracks','stable','archery-range']){order('build',{unitIds:[1,2,3],kind,...site(kind)});until(()=>s.buildings.some(b=>b.kind===kind&&b.complete));}
order('build',{unitIds:[1],kind:'farm',...site('farm')});until(()=>s.buildings.some(b=>b.kind==='farm'&&b.complete));
order('gather',{unitIds:[1],resourceId:'resource-'+s.buildings.find(b=>b.kind==='farm').id});until(()=>s.accounts[0].stock.food>=100);
const boxOf=kind=>obstacleBounds(s.map.obstacles.find(o=>o.id===s.buildings.find(b=>b.kind===kind).id));
note('對局準備',`tick ${s.tick}，第 ${s.ages[0]} 時代，食物 ${s.accounts[0].stock.food}，命令 ${s.log.length} 筆`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const text=id=>page.locator('#'+id).innerText();
 // 2. Load the save from the menu (the page re-derives it from the command log).
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent));
 await page.waitForFunction(()=>document.querySelector('#age-name').textContent==='第二時代');const pop0=await text('res-pop');note('讀取',`${await text('notice')}｜${await text('age-name')}｜人口 ${pop0}`);
 // 3. Pick a building with the pointer, aimed with the camera the canvas reports after H.
 async function pick(kind,title){await page.keyboard.press('KeyH');await page.keyboard.press('Escape');await page.waitForTimeout(300);const box=boxOf(kind);
  const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=(box[0]+box[2])/200-fx,dz=(box[1]+box[3])/200-fz;
  // Other buildings may hide part of it from this camera: try the centre, then points nearer each corner, low and high.
  for(const [fx2,fz2,h] of [[0,0,.4],[-.3,-.3,.4],[.3,-.3,.4],[-.3,.3,.4],[.3,.3,.4],[0,0,1.6]]){const ox=dx+fx2*(box[2]-box[0])/100,oz=dz+fz2*(box[3]-box[1])/100;
   await page.mouse.click(r.x+r.width/2+(ox*Math.cos(a)-oz*Math.sin(a))*scale,r.y+r.height/2-(h-(ox*Math.sin(a)+oz*Math.cos(a)))*Math.SQRT1_2*scale);await page.waitForTimeout(120);
   if(await page.evaluate(t=>!document.querySelector('#building-panel').hidden&&document.querySelector('#building-title').textContent===t,title))return;}
  throw Error(`could not pick the ${title}`);}
 // Archers come from the archery range, as in the original: the barracks offers militia only.
 await pick('barracks','兵營');note('兵營',(await page.locator('#production button').allInnerTexts()).map(t=>t.split('\n')[0]).join('／'));
 assert.equal(await page.locator('#production button[data-train="archer"]').count(),0,'no archer tile at the barracks');
 // 4. Stable: a scout rides out; food is spent and the population reserved.
 await pick('stable','馬廄');const scout=page.locator('#production button[data-train="scout"]');assert.equal(await scout.isDisabled(),false);
 note('選取馬廄',`${await text('building-title')}｜${await scout.getAttribute('aria-label')}`);await page.screenshot({path:out+'feudal-stable.png'});
 await scout.click();await page.waitForFunction(p=>document.querySelector('#res-pop').textContent!==p,pop0);note('訓練斥候',`人口 ${await text('res-pop')}，食物 ${await text('res-food')}`);
 await page.locator('#speed').selectOption('4');await page.waitForFunction(()=>/斥候已生產/.test(document.querySelector('#events').textContent),undefined,{timeout:60000});note('斥候出生',await text('events'));
 // 5. Archery range: an archer walks out.
 await pick('archery-range','靶場');const archer=page.locator('#production button[data-train="archer"]');assert.equal(await archer.isDisabled(),false);
 note('選取靶場',`${await text('building-title')}｜${await archer.getAttribute('aria-label')}`);await page.screenshot({path:out+'feudal-range.png'});
 const wood0=await text('res-wood');await archer.click();await page.waitForFunction(w=>document.querySelector('#res-wood').textContent!==w,wood0);note('訓練弓手',`木材 ${await text('res-wood')}，黃金 ${await text('res-gold')}，人口 ${await text('res-pop')}`);
 await page.waitForFunction(()=>/弓手已生產/.test(document.querySelector('#events').textContent),undefined,{timeout:60000});note('弓手出生',await text('events'));
 await page.screenshot({path:out+'feudal-units.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS feudal: barracks without archers, stable trains a scout, archery range trains an archer, all picked on the battlefield');
}catch(e){if(page)await page.screenshot({path:out+'feudal-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
