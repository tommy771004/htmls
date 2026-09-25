// Prompt 19 first-time path for the E2 milestone: place, build, cancel, housing. Pointer and keyboard only.
// Valid and invalid spots are found with the same placement rule the Worker uses, on the same seeded map.
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
// Barracks first (it needs the larger space), then a house that leaves it clear.
const barracksAt=spot('barracks',{x:700,y:900}),barracksBox=obstacleBounds({kind:'barracks',...barracksAt});
const houseAt=spot('house',{x:600,y:800},barracksBox),houseBox=obstacleBounds({kind:'house',...houseAt});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],external=[],log=[];
const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
try{
await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
const text=id=>page.locator('#'+id).innerText();
async function screen(wx,wy,wz){await page.evaluate(()=>scrollTo(0,0));const r=await page.locator('#map').boundingBox(),halfH=Math.max(10.5,12/(r.width/r.height)),scale=r.height/(2*halfH),dx=wx-8,dz=wz-8;return {x:r.x+r.width/2+(dx-dz)*Math.SQRT1_2*scale,y:r.y+r.height/2-(-.5*dx+Math.SQRT1_2*wy-.5*dz)*scale};}
const centre=box=>screen((box[0]+box[2])/200,0,(box[1]+box[3])/200);
async function click(p,opts={}){const old=await text('notice');await page.mouse.click(p.x,p.y,opts);await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');}
async function runUntil(check,timeout=90000){await page.locator('#pause').click();await page.waitForFunction(check,undefined,{timeout});await page.locator('#pause').click();}
note('首次進站 HUD',await text('stock'));assert.match(await text('stock'),/人口 3\/5/);
await page.locator('#map').scrollIntoViewIfNeeded();await page.keyboard.press('Escape');note('未選取時的建造說明',await text('build-reason'));assert.equal(await page.locator('#build-house').isDisabled(),true);assert.match(await text('build-reason'),/先選取村民/);
const c=[await screen(3,0,6.4),await screen(5.1,0,6.4),await screen(3,0,8.6),await screen(5.1,0,8.6)];
await page.mouse.move(Math.min(...c.map(p=>p.x)),Math.min(...c.map(p=>p.y))-40);await page.mouse.down();await page.mouse.move(Math.max(...c.map(p=>p.x)),Math.max(...c.map(p=>p.y)),{steps:6});await page.mouse.up();
await page.locator('#build-house').click();note('按住宅',await text('notice'));
// Over the town center: red preview with a reason; a click there is refused locally.
const tc=world.map.obstacles.find(o=>o.kind==='town-center'&&!o.red);let p=await centre(obstacleBounds(tc));await page.mouse.move(p.x,p.y);note('預覽在城鎮中心上',await text('build-reason'));assert.match(await text('build-reason'),/不能放在這裡：與建築或資源重疊/);
await page.screenshot({path:out+'build-preview-invalid.png'});
p=await centre(houseBox);await page.mouse.move(p.x,p.y);note('預覽在空地',await text('build-reason'));assert.match(await text('build-reason'),/左鍵放置住宅/);await page.screenshot({path:out+'build-preview-valid.png'});
note('放置住宅',await click(p));assert.match(await text('notice'),/前往建造住宅/);
await page.locator('#step').click();await page.waitForFunction(()=>/木材 170/.test(document.querySelector('#stock').textContent));note('扣款',await text('stock'));
await runUntil(()=>/施工中/.test(document.querySelector('#selection-list').textContent));note('開始施工',await text('selection-list'));await page.screenshot({path:out+'build-under-construction.png'});
await runUntil(()=>/人口 3\/10/.test(document.querySelector('#stock').textContent),120000);note('住宅完工',await text('stock'));await page.screenshot({path:out+'build-house-complete.png'});
// Barracks takes the remaining wood; then the house button explains why it is disabled.
await page.locator('#build-barracks').click();p=await centre(barracksBox);await page.mouse.move(p.x,p.y);note('兵營預覽',await text('build-reason'));note('放置兵營',await click(p));
await page.locator('#step').click();await page.waitForFunction(()=>/木材 20 /.test(document.querySelector('#stock').textContent));note('扣款',await text('stock'));
assert.equal(await page.locator('#build-house').isDisabled(),true);note('住宅停用原因',await text('build-reason'));assert.match(await text('build-reason'),/木材不足：需要 30，目前 20/);
// Select the barracks foundation and cancel it: full refund, ground free.
p=await centre(barracksBox);note('點選兵營地基',await click(p));note('建築面板',`${await text('building-title')} ${await text('building-status')}`);assert.match(await text('building-status'),/施工中/);
note('取消建造',await (async()=>{const old=await text('notice');await page.locator('#cancel-build').click();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old);return text('notice');})());
await page.locator('#step').click();await page.waitForFunction(()=>/木材 170/.test(document.querySelector('#stock').textContent));note('退款',await text('stock'));
// Placement mode can be left with Esc and with a right-click; neither issues an order.
await page.locator('[data-unit="1"]').click();await page.locator('#build-house').click();await page.keyboard.press('Escape');note('Esc 取消放置',await text('notice'));assert.match(await text('notice'),/已取消放置/);
await page.locator('#build-house').click();p=await centre(houseBox);await page.mouse.click(p.x+80,p.y+80,{button:'right'});note('右鍵取消放置',await text('notice'));assert.match(await text('notice'),/已取消放置/);
const before={hud:await text('stock'),hash:await text('hash')};await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已儲存'));
await page.locator('#restart').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已建立新沙盒'));assert.match(await text('stock'),/人口 3\/5/);
await page.locator('#load').click();await page.waitForFunction(h=>document.querySelector('#hash').textContent===h,before.hash);note('存讀',`${before.hud} → ${await text('stock')}`);assert.equal(await text('stock'),before.hud);
await page.locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('重播'));note('重播',await text('notice'));assert.match(await text('notice'),/重播一致/);
note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
fs.writeFileSync(out+'fu10-log.json',JSON.stringify({browser:browser.version(),log,errors,external},null,2));
}finally{await browser.close();server.close();}
