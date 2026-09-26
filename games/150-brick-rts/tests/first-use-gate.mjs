// Prompt 19 first-time path for the town-center gate milestone. Pointer clicks on the scene, no coordinate fields.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
async function menu(p){if(await p.locator('#menu').isHidden())await p.locator('#menu-open').click();return p;}
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});const log=[];const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
const t0=Date.now();await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');note('首次進站',`載入到可操作 ${Date.now()-t0} ms；${await page.locator('#notice').textContent()}`);
const initialHash=await page.locator('#hash').innerText();
const pauseBox=await page.locator('#pause').boundingBox(),mapBox=await page.locator('#map').boundingBox();note('首屏控制',`開始模擬 y=${Math.round(pauseBox.y)}–${Math.round(pauseBox.y+pauseBox.height)}，場景 y=${Math.round(mapBox.y)}`);assert.ok(pauseBox.y+pauseBox.height<=900&&pauseBox.y+pauseBox.height<=mapBox.y,'start control visible above the scene without scrolling');
async function screen(wx,wy,wz){await page.evaluate(()=>scrollTo(0,0));await page.locator('#map').scrollIntoViewIfNeeded();const r=await page.locator('#map').boundingBox(),aspect=r.width/r.height,halfH=Math.max(10.5,12/aspect),scale=r.height/(2*halfH),dx=wx-8,dz=wz-8;return {x:r.x+r.width/2+(dx-dz)*Math.SQRT1_2*scale,y:r.y+r.height/2-(-.5*dx+Math.SQRT1_2*wy-.5*dz)*scale};}
const position=()=>page.locator('#position').innerText(),notice=()=>page.locator('#notice').innerText();
async function runUntil(){const start=Number(await page.locator('#tick').innerText());await page.locator('#pause').click();await page.waitForFunction(t=>Number(document.querySelector('#tick').textContent)>t+3&&document.querySelector('#position').textContent.includes('待命'),start,{timeout:40000});await page.locator('#pause').click();}
// 1. Select villager 2 by clicking its body in the scene.
let p=await screen(4.5,.6,7);await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);note('點選人偶',`${await position()}`);
// 2. Right-click the paved gate front on the plinth.
p=await screen(4,0,6);await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(150);note('點城鎮中心門前',await notice());
await runUntil('待命');note('抵達門前',await position());await page.screenshot({path:out+'/fu7-gate-front.png'});
// 3. Right-click the hall floor under the roof: ground picking ignores the roof.
p=await screen(4,0,4.2);await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(150);note('點大廳內地面（屋頂下）',await notice());
await runUntil('待命');note('進入大廳',await position());await page.screenshot({path:out+'/fu7-inside-hall.png'});
// 4. Right-click a hall pier: must be rejected without changing state.
const beforePier=await page.locator('#hash').innerText();p=await screen(3,0,4.5);await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(200);note('點石柱占地',await notice());assert.equal(await page.locator('#hash').innerText(),beforePier);
// 5. Rapid double order: second click replaces the first, no stuck job.
p=await screen(4,0,2.8);await page.mouse.click(p.x,p.y,{button:'right'});await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(150);note('快速連點後門外',await notice());
await runUntil('待命');note('穿過大廳到後方',await position());await page.screenshot({path:out+'/fu7-behind-hall.png'});
// 6. Save, restart, load, replay.
await (await menu(page)).locator('#save').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已儲存'));const saved=await page.locator('#hash').innerText();
await (await menu(page)).locator('#restart').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已建立新沙盒'));assert.equal(await page.locator('#hash').innerText(),initialHash);
await (await menu(page)).locator('#load').click();await page.waitForFunction(h=>document.querySelector('#hash').textContent===h,saved,{timeout:15000});note('存讀',`${saved} → 讀回 ${await page.locator('#hash').innerText()}；${await position()}`);
await (await menu(page)).locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('重播'));note('重播',await notice());
// 7. Phone width: layout without horizontal overflow.
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);note('390 寬',`水平溢出 ${overflow}px`);await page.screenshot({path:out+'/fu7-390.png',fullPage:true});
note('錯誤',JSON.stringify({errors,external}));
fs.writeFileSync(out+'/fu7-log.json',JSON.stringify({browser:browser.version(),log,errors,external},null,2));
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(overflow,0);
await browser.close();server.close();
