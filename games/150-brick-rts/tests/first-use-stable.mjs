// Stable on the game screen (no ?debug=1): a second-age match with a finished stable is played for real in the
// simulation (every command logged, so the page's restore re-derives it), saved, loaded from the menu, and the
// stable is picked with the pointer to train a scout.
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
// 1. Play it: berries to 300 food, second age, a stable, then wood and a farm for the scout's 80 food.
const s=createState(260925,'open','idle');
const order=(t,p)=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType:t,payload:p});
const until=(done,limit=20000)=>{const end=s.tick+limit;while(!done()){assert.ok(s.tick<end,'setup stalled');tick(s);}};
const tcBuilding=s.buildings.find(b=>b.player===0&&b.kind==='town-center'),tc=s.map.obstacles.find(o=>o.id===tcBuilding.id);
const nearest=kind=>s.map.resources.filter(r=>r.kind===kind).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];
function site(kind){for(let r=300;r<=900;r+=50)for(let a=0;a<16;a++){const x=Math.round((tc.x+Math.cos(a*Math.PI/8)*r)/10)*10,y=Math.round((tc.y+Math.sin(a*Math.PI/8)*r)/10)*10;if(!authoritativeProblem(s,0,kind,x,y))return {x,y};}throw Error('no site for '+kind);}
order('gather',{unitIds:[1,2,3],resourceId:nearest('berries').id});until(()=>s.accounts[0].stock.food>=300);
order('train',{buildingId:tcBuilding.id,entryId:'age-2'});until(()=>s.ages[0]===2);
order('build',{unitIds:[1,2,3],kind:'stable',...site('stable')});until(()=>s.buildings.some(b=>b.kind==='stable'&&b.complete));
order('gather',{unitIds:[1,2,3],resourceId:nearest('tree').id});until(()=>s.accounts[0].stock.wood>=100);
order('build',{unitIds:[1],kind:'farm',...site('farm')});until(()=>s.buildings.some(b=>b.kind==='farm'&&b.complete));
order('gather',{unitIds:[1],resourceId:'resource-'+s.buildings.find(b=>b.kind==='farm').id});until(()=>s.accounts[0].stock.food>=100);
const stable=s.buildings.find(b=>b.kind==='stable'),box=obstacleBounds(s.map.obstacles.find(o=>o.id===stable.id));
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
 // 3. Pick the stable with the pointer, aimed with the camera the canvas reports after H.
 await page.keyboard.press('KeyH');await page.keyboard.press('Escape');await page.waitForTimeout(300);
 const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=(box[0]+box[2])/200-fx,dz=(box[1]+box[3])/200-fz;
 await page.mouse.click(r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,r.y+r.height/2-(.4-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale);
 await page.waitForFunction(()=>!document.querySelector('#building-panel').hidden);assert.equal(await text('building-title'),'馬廄');
 const tile=page.locator('#production button[data-train="scout"]');assert.equal(await tile.isVisible(),true);assert.equal(await tile.isDisabled(),false);
 note('選取馬廄',`${await text('building-title')}｜${await tile.getAttribute('aria-label')}`);await page.screenshot({path:out+'stable-panel.png'});
 // 4. Train: food is spent, the population is reserved, and a scout rides out.
 await tile.click();await page.waitForFunction(p=>document.querySelector('#res-pop').textContent!==p,pop0);note('訓練斥候',`人口 ${await text('res-pop')}，食物 ${await text('res-food')}`);
 await page.locator('#speed').selectOption('4');await page.waitForFunction(()=>/斥候已生產/.test(document.querySelector('#events').textContent),undefined,{timeout:60000});
 note('斥候出生',await text('events'));assert.match(await tile.getAttribute('aria-label'),/食物不足/,'the next scout waits for food');
 await page.screenshot({path:out+'stable-scout.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS stable: second age, stable picked on the battlefield, scout trained from the production grid');
}catch(e){if(page)await page.screenshot({path:out+'stable-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
