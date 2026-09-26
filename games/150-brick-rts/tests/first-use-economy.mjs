// Prompt 19 first-time path for the E1 milestone: find villagers, gather wood and food, return, save/load.
// Pointer and keyboard only; resource positions come from the same seeded map the page shows.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState} from '../packages/sim/sim.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
async function menu(p){if(await p.locator('#menu').isHidden())await p.locator('#menu-open').click();return p;}
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const world=createState(260925),find=kind=>world.map.resources.filter(r=>r.kind===kind).sort((a,b)=>Math.abs(a.x-400)+Math.abs(a.y-700)-(Math.abs(b.x-400)+Math.abs(b.y-700)))[0];
const tree=find('tree'),berries=find('berries'),hunt=find('hunt');
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],external=[],log=[];
const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
try{
await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
const text=id=>page.locator('#'+id).innerText();const stock=async()=>Object.fromEntries([...(await text('stock')).matchAll(/(食物|木材|黃金|石頭) (\d+)/g)].map(m=>[m[1],+m[2]]));
note('首次進站 HUD',await text('stock'));assert.deepEqual(await stock(),{食物:200,木材:200,黃金:100,石頭:100});
async function screen(wx,wy,wz){await page.evaluate(()=>scrollTo(0,0));const r=await page.locator('#map').boundingBox(),halfH=Math.max(10.5,12/(r.width/r.height)),scale=r.height/(2*halfH),dx=wx-8,dz=wz-8;return {x:r.x+r.width/2+(dx-dz)*Math.SQRT1_2*scale,y:r.y+r.height/2-(-.5*dx+Math.SQRT1_2*wy-.5*dz)*scale};}
const centre=(r,w,d)=>screen((r.x+w)/100,0,(r.y+d)/100);
// Orders go to the Worker asynchronously: wait for the notice to change before reading it.
async function order(p,opts={}){const old=await text('notice');await page.mouse.click(p.x,p.y,opts);await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old);return text('notice');}
async function runUntil(check,timeout=60000){await page.locator('#pause').click();await page.waitForFunction(check,undefined,{timeout});await page.locator('#pause').click();}
// Box-select all three villagers, then right-click the nearest tree.
const c=[await screen(3,0,6.4),await screen(5.1,0,6.4),await screen(3,0,8.6),await screen(5.1,0,8.6)];
await page.mouse.move(Math.min(...c.map(p=>p.x)),Math.min(...c.map(p=>p.y))-40);await page.mouse.down();await page.mouse.move(Math.max(...c.map(p=>p.x)),Math.max(...c.map(p=>p.y)),{steps:6});await page.mouse.up();
note('框選',await text('selected'));assert.equal(await text('selected'),'#01 #02 #03');
let p=await centre(tree,30,30);note('右鍵樹木',await order(p,{button:'right'}));assert.match(await text('notice'),/前往採集/);
await runUntil(()=>/採集中/.test(document.querySelector('#selection-list').textContent));note('開始採集',await text('selection-list'));await page.screenshot({path:out+'economy-gathering.png'});
await runUntil(()=>/木材 2[1-9]\d/.test(document.querySelector('#stock').textContent),90000);note('第一次送返',await text('stock'));await page.screenshot({path:out+'economy-returned.png'});
// Villager 3 alone to the berries.
const v3=await screen(4,.6,8);const pos3=await text('selection-list');const m3=/村民 3 \(([\d.]+), ([\d.]+)\)/.exec(pos3);p=await screen(+m3[1],.6,+m3[2]);await page.mouse.click(p.x,p.y);note('點選村民 3',await text('selected'));assert.equal(await text('selected'),'#03');
p=await centre(berries,30,30);note('右鍵野果',await order(p,{button:'right'}));assert.match(await text('notice'),/村民 3 前往採集/);
await runUntil(()=>/食物 2[1-9]\d/.test(document.querySelector('#stock').textContent),120000);note('食物送返',await text('stock'));
// Hunting is not implemented: the order is refused with a reason, not faked.
p=await centre(hunt,30,30);note('右鍵獵物',await order(p,{button:'right'}));assert.match(await text('notice'),/狩獵尚未實作/);
// Stop keeps whatever is carried.
await page.locator('#pause').click();await page.waitForFunction(()=>/攜帶/.test(document.querySelector('#position').textContent),undefined,{timeout:60000});await page.keyboard.press('KeyS');await page.locator('#pause').click();
await page.locator('#pause').click();await page.waitForTimeout(700);await page.locator('#pause').click();note('停止後',await text('position'));assert.match(await text('position'),/待命 · 攜帶/);
// Save, restart, load: stock and hash come back.
const before={hud:await text('stock'),hash:await text('hash')};await (await menu(page)).locator('#save').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已儲存'));
await (await menu(page)).locator('#restart').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已建立新沙盒'));assert.match(await text('stock'),/木材 200/);
await (await menu(page)).locator('#load').click();await page.waitForFunction(h=>document.querySelector('#hash').textContent===h,before.hash);note('存讀',`${before.hud} → ${await text('stock')}`);assert.equal(await text('stock'),before.hud);
await (await menu(page)).locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('重播'));note('重播',await text('notice'));assert.match(await text('notice'),/重播一致/);
note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
fs.writeFileSync(out+'fu9-log.json',JSON.stringify({browser:browser.version(),log,errors,external},null,2));
}finally{await browser.close();server.close();}
