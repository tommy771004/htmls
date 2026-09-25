// Prompt 19 first-time path for the E3 milestone: train villagers, housing limit, rally, cancel, age up,
// barracks and militia, mixed selection. Pointer and keyboard only; positions come from the same seeded map.
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
const tcObstacle=world.map.obstacles.find(o=>o.kind==='town-center'&&!o.red),tcBox=obstacleBounds(tcObstacle);
const berries=world.map.resources.filter(r=>r.kind==='berries').sort((a,b)=>Math.abs(a.x-400)+Math.abs(a.y-700)-(Math.abs(b.x-400)+Math.abs(b.y-700)))[0];
const tree=world.map.resources.filter(r=>r.kind==='tree').sort((a,b)=>Math.abs(a.x-400)+Math.abs(a.y-700)-(Math.abs(b.x-400)+Math.abs(b.y-700)))[0];
const barracksAt=spot('barracks',{x:700,y:900}),barracksBox=obstacleBounds({kind:'barracks',...barracksAt});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],external=[],log=[];
const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
try{
await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
const text=id=>page.locator('#'+id).innerText();
async function screen(wx,wy,wz){await page.evaluate(()=>scrollTo(0,0));const r=await page.locator('#map').boundingBox(),halfH=Math.max(10.5,12/(r.width/r.height)),scale=r.height/(2*halfH),dx=wx-8,dz=wz-8;return {x:r.x+r.width/2+(dx-dz)*Math.SQRT1_2*scale,y:r.y+r.height/2-(-.5*dx+Math.SQRT1_2*wy-.5*dz)*scale};}
const centre=box=>screen((box[0]+box[2])/200,0,(box[1]+box[3])/200);
async function act(fn){const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');}
async function runUntil(check,timeout=150000){await page.locator('#pause').click();await page.waitForFunction(check,undefined,{timeout});await page.locator('#pause').click();}
async function boxSelect(x0,z0,x1,z1){const c=[await screen(x0,0,z0),await screen(x1,0,z0),await screen(x0,0,z1),await screen(x1,0,z1)];await page.mouse.move(Math.min(...c.map(p=>p.x)),Math.min(...c.map(p=>p.y))-40);await page.mouse.down();await page.mouse.move(Math.max(...c.map(p=>p.x)),Math.max(...c.map(p=>p.y)),{steps:6});await page.mouse.up();}
const trainBtn=id=>page.locator(`#production button[data-train="${id}"]`);
note('首次進站 HUD',await text('stock'));assert.match(await text('stock'),/^第一時代 · 食物 200/);
// 1. Select the town center.
let p=await centre(tcBox);note('點選城鎮中心',await act(()=>page.mouse.click(p.x,p.y)));note('建築面板',`${await text('building-title')} ${await text('building-status')}`);
note('生產按鈕',(await page.locator('#production button').allInnerTexts()).join('／'));note('停用原因',await text('production-reason'));
assert.match(await text('production-reason'),/第二時代：食物不足：需要 300，目前 200/);
// 2. Two villagers fit the housing, the third is refused with a reason on the button.
note('加入村民',await act(()=>trainBtn('villager').click()));await page.locator('#step').click();note('扣款',await text('stock'));
await act(()=>trainBtn('villager').click());await page.locator('#step').click();note('佇列',(await page.locator('#queue span').allInnerTexts()).join('／'));
assert.equal(await trainBtn('villager').isDisabled(),true);note('第三名村民',await text('production-reason'));assert.match(await text('production-reason'),/人口已滿（5\/5）：請蓋住宅/);
// 3. Rally point, then cancel the second item.
p=await screen(6,0,8.5);note('右鍵設集結點',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));await page.locator('#step').click();note('集結點',await text('rally-hint'));
note('取消第二項',await act(()=>page.locator('#queue button').nth(1).click()));await page.locator('#step').click();note('退款',await text('stock'));assert.match(await text('stock'),/食物 150 /);
await runUntil(()=>/人口 4\/5/.test(document.querySelector('#stock').textContent));note('村民出生',await text('stock'));await page.screenshot({path:out+'production-villager.png'});
// 4. Gather food for the second age with the three original villagers.
await page.keyboard.press('Escape');await boxSelect(3,6.4,5.1,8.6);note('框選',await text('selected'));
p=await screen((berries.x+30)/100,0,(berries.y+30)/100);note('右鍵野果',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
await runUntil(()=>{const m=/食物 (\d+)/.exec(document.querySelector('#stock').textContent);return m&&+m[1]>=300;},240000);note('食物達 300',await text('stock'));
p=await centre(tcBox);await page.mouse.click(p.x,p.y);note('研究第二時代',await act(()=>trainBtn('age-2').click()));await page.screenshot({path:out+'production-age1.png'});
await runUntil(()=>/^第二時代/.test(document.querySelector('#stock').textContent));note('升上第二時代',await text('stock'));await page.screenshot({path:out+'production-age2.png'});
note('第二時代按鈕',await trainBtn('age-2').getAttribute('title'));assert.equal(await trainBtn('age-2').getAttribute('title'),'已研究');
// 5. Barracks, then militia.
await page.keyboard.press('Escape');await boxSelect(1.5,8.5,3.5,11);note('框選採野果的村民',await text('selected'));
await page.locator('#build-barracks').click();p=await centre(barracksBox);await page.mouse.move(p.x,p.y);note('兵營預覽',await text('build-reason'));note('放置兵營',await act(()=>page.mouse.click(p.x,p.y)));
await runUntil(()=>/已完工/.test(document.querySelector('#building-status')?.textContent??'')||false,5000).catch(()=>{});
await page.locator('#pause').click();await page.waitForTimeout(12000);await page.locator('#pause').click();
p=await centre(barracksBox);await page.mouse.click(p.x,p.y);await runUntil(()=>/已完工/.test(document.querySelector('#building-status').textContent));note('兵營完工',await text('building-status'));
note('兵營按鈕',(await page.locator('#production button').allInnerTexts()).join('／'));note('停用原因',await text('production-reason'));
note('加入民兵',await act(()=>trainBtn('militia').click()));
await runUntil(()=>document.querySelector('#queue').children.length===0);note('民兵完成',await text('stock'));await page.screenshot({path:out+'production-militia.png'});
// 6. Mixed selection: only villagers are sent to gather.
await page.keyboard.press('Escape');await boxSelect((barracksBox[0]-80)/100,(barracksBox[1]-80)/100,(barracksBox[2]+80)/100,(barracksBox[3]+120)/100);note('框選兵營周圍',await text('selection-list'));
p=await screen((tree.x+30)/100,0,(tree.y+30)/100);note('混合選取右鍵樹木',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
const before={hud:await text('stock'),hash:await text('hash')};await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已儲存'));
await page.locator('#restart').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已建立新沙盒'));
await page.locator('#load').click();await page.waitForFunction(h=>document.querySelector('#hash').textContent===h,before.hash);note('存讀',`${before.hud} → ${await text('stock')}`);assert.equal(await text('stock'),before.hud);
await page.locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('重播'));note('重播',await text('notice'));assert.match(await text('notice'),/重播一致/);
note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
fs.writeFileSync(out+'fu11-log.json',JSON.stringify({browser:browser.version(),log,errors,external},null,2));
}finally{await browser.close();server.close();}
