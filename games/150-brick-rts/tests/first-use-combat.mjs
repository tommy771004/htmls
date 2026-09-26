// Prompt 19 first-time path for the E4 milestone: house + barracks, militia, scout with a rally point, attack a unit
// and the town center, victory, new game. Pointer and keyboard only, at 4x speed; positions from the same seeded map.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const world=createState(260925);
function spot(kind,from,avoid){for(let r=0;r<=800;r+=50)for(let dy=-r;dy<=r;dy+=50)for(let dx=-r;dx<=r;dx+=50){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=from.x+dx,y=from.y+dy,box=obstacleBounds({kind,x,y});
 if(avoid&&Math.min(box[2],avoid[2])>Math.max(box[0],avoid[0])-60&&Math.min(box[3],avoid[3])>Math.max(box[1],avoid[1])-60)continue;if(!authoritativeProblem(world,0,kind,x,y))return {x,y};}throw Error('no spot');}
const barracksAt=spot('barracks',{x:700,y:900}),barracksBox=obstacleBounds({kind:'barracks',...barracksAt});
const houseAt=spot('house',{x:600,y:800},barracksBox),houseBox=obstacleBounds({kind:'house',...houseAt});
const redTc=world.map.obstacles.find(o=>o.kind==='town-center'&&o.red),redTcBox=obstacleBounds(redTc),redVillager=world.units.find(u=>u.player===1);
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],external=[],log=[];
const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
try{
await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
const text=id=>page.locator('#'+id).innerText();
async function screen(wx,wy,wz){await page.evaluate(()=>scrollTo(0,0));const r=await page.locator('#map').boundingBox(),halfH=Math.max(10.5,12/(r.width/r.height)),scale=r.height/(2*halfH),dx=wx-8,dz=wz-8;return {x:r.x+r.width/2+(dx-dz)*Math.SQRT1_2*scale,y:r.y+r.height/2-(-.5*dx+Math.SQRT1_2*wy-.5*dz)*scale};}
const centre=box=>screen((box[0]+box[2])/200,0,(box[1]+box[3])/200);
async function act(fn){const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');}
async function runUntil(check,timeout=240000){await page.locator('#pause').click();await page.waitForFunction(check,undefined,{timeout});await page.locator('#pause').click();}
async function boxSelect(x0,z0,x1,z1){const c=[await screen(x0,0,z0),await screen(x1,0,z0),await screen(x0,0,z1),await screen(x1,0,z1)];await page.mouse.move(Math.min(...c.map(p=>p.x)),Math.min(...c.map(p=>p.y))-40);await page.mouse.down();await page.mouse.move(Math.max(...c.map(p=>p.x)),Math.max(...c.map(p=>p.y)),{steps:6});await page.mouse.up();}
const pick=async id=>{await page.locator(`[data-unit="${id}"]`).click();};
note('首次進站',await text('stock'));
note('速度 4×',await act(()=>page.locator('#speed').selectOption('4')));
// Villager 1 builds a house, villagers 2 and 3 a barracks.
await pick(1);await page.locator('#build-house').click();let p=await centre(houseBox);await page.mouse.move(p.x,p.y);note('放置住宅',await act(()=>page.mouse.click(p.x,p.y)));
await pick(2);await page.keyboard.down('Shift');await pick(3);await page.keyboard.up('Shift');await page.locator('#build-barracks').click();p=await centre(barracksBox);await page.mouse.move(p.x,p.y);note('放置兵營',await act(()=>page.mouse.click(p.x,p.y)));
await page.locator('#step').click();p=await centre(barracksBox);await page.mouse.click(p.x,p.y);
await runUntil(()=>/已完工/.test(document.querySelector('#building-status').textContent)&&/人口 3\/10/.test(document.querySelector('#stock').textContent));note('住宅與兵營完工',`${await text('stock')} | ${await text('building-status')}`);
// Rally the barracks toward the red base, then two militia.
// A rally point on the barracks itself is refused with a reason.
p=await centre(barracksBox);note('集結點設在兵營上',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));await page.locator('#step').click();
p=await screen(9.5,0,8.5);note('兵營集結點',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
const militia=page.locator('#production button[data-train="militia"]');note('加入民兵',await act(()=>militia.click()));await page.locator('#step').click();await page.waitForFunction(()=>document.querySelector('#queue').children.length===1);await act(()=>militia.click());await page.locator('#step').click();
note('佇列',(await page.locator('#queue span').allInnerTexts()).join('／'));
// Villagers scout toward the red base; villagers never engage on their own, so their attack is a real order.
await page.keyboard.press('Escape');await pick(1);await page.keyboard.down('Shift');await pick(2);await pick(3);await page.keyboard.up('Shift');
p=await screen(10,0,8.5);note('村民前往紅方',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
await runUntil(()=>(document.querySelector('#selection-list').textContent.match(/待命/g)||[]).length===3);note('抵達',await text('selection-list'));
p=await screen(redVillager.x/100,.6,redVillager.y/100);note('右鍵紅方村民',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));assert.match(await text('notice'),/攻擊紅方村民/);
await page.locator('#pause').click();await page.waitForFunction(()=>/攻擊中/.test(document.querySelector('#selection-list').textContent),undefined,{timeout:60000});await page.locator('#pause').click();note('交戰',await text('selection-list'));await page.screenshot({path:out+'combat-villagers-attack.png'});
// The barracks is no longer selected, so progress is read from the HUD population, not its queue panel.
await runUntil(()=>!/攻擊中/.test(document.querySelector('#selection-list').textContent)&&/人口 5\/10/.test(document.querySelector('#stock').textContent));
note('紅方村民倒下、民兵出生',`${await text('selection-list')} | ${await text('stock')}`);await page.screenshot({path:out+'combat-villager-down.png'});
await page.locator('#fog-debug summary').click();note('迷霧記憶',await page.locator('.fog-memories').innerText());await page.locator('#fog-debug summary').click();
await page.keyboard.press('Escape');await boxSelect(8.4,7.4,10.6,9.6);note('框選民兵',await text('selection-list'));
p=await centre(redTcBox);note('右鍵紅方城鎮中心',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
await page.locator('#pause').click();await page.waitForTimeout(6000);await page.locator('#pause').click();await page.screenshot({path:out+'combat-attacking-tc.png'});note('攻城中',await text('selection-list'));
await runUntil(()=>!document.querySelector('#result').hidden,240000);note('結果',`${await text('result-title')} · ${await text('result-detail')}`);assert.equal(await text('result-title'),'勝利');
await page.screenshot({path:out+'combat-victory.png'});
assert.throws===undefined;
note('再開一局',await act(()=>page.locator('#result-restart').click()));assert.equal(await page.locator('#result').isHidden(),true);assert.match(await text('stock'),/^第一時代 · 食物 200 · 木材 200/);
note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
fs.writeFileSync(out+'fu12-log.json',JSON.stringify({browser:browser.version(),log,errors,external},null,2));
}finally{await browser.close();server.close();}
