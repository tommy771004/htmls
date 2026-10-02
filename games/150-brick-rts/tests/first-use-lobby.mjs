// The pre-game lobby (前置開場, apps/web/lobby.ts) on a normal visit (no ?debug=1, no ?play=1): the page opens on the
// lobby with the match not running; picking 條頓, the second age and 高 resources then 遊戲開始 creates that match (top
// bar, stock, the match line) and it runs. The menu's 新遊戲設定 reopens the lobby with 取消, which returns to the match;
// a manual save is listed under 載入遊戲 and loads from there; 科技樹 opens the encyclopedia on the tree tab. At 390×844
// the lobby is one column without sideways scrolling and starts a match the same way.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {settingRules} from '../packages/sim/settings.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});};
const tickOf=async p=>Number(await p.locator('#tick').textContent());
const fits=p=>p.evaluate(()=>{const b=document.querySelector('.lobby-board');return document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth&&b.scrollWidth<=b.clientWidth;});
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForSelector('#lobby:not([hidden])');
 // The match behind the lobby waits for 遊戲開始.
 await page.waitForTimeout(1500);assert.equal(await tickOf(page),0,'nothing runs before 遊戲開始');assert.equal(await page.locator('#lobby-cancel').isHidden(),true,'no 取消 on first load');
 const preview=await page.evaluate(()=>{const c=document.querySelector('#lobby-preview');return [c.width,c.height];});assert.ok(preview[0]>100&&preview[1]>50,'the map preview is drawn');
 note('首次進站',`大廳顯示，tick ${await tickOf(page)}，預覽 ${preview.join('×')}`);await page.screenshot({path:out+'lobby-1440.png'});
 await page.locator('#lobby-name').fill('磚匠');await page.locator('#lobby-blue').selectOption('teutons');await page.locator('#lobby-red').selectOption('japanese');
 await page.locator('#lobby-startAge').selectOption('2');await page.locator('#lobby-resources').selectOption('high');await page.locator('#lobby-difficulty').selectOption('easy');await page.locator('#lobby-seed').fill('4242');
 assert.match(await page.locator('#lobby-resources-note').textContent(),/食物 1000/);
 await page.locator('#lobby-start').click();await page.waitForSelector('#lobby',{state:'hidden'});
 await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const top={civ:await page.locator('#civ-name').textContent(),age:await page.locator('#age-name').textContent(),food:Number(await page.locator('#res-food').textContent()),line:await page.locator('#sel-empty-title').textContent(),notice:await page.locator('#notice').textContent()};
 note('遊戲開始',JSON.stringify(top));
 assert.equal(top.civ,'條頓');assert.equal(top.age,'第二時代');assert.ok(top.food>=settingRules.resources.high.food-200&&top.food<=settingRules.resources.high.food,'high resources (a villager may already be queued)');
 assert.match(top.line,/磚匠（條頓）/);assert.match(top.line,/電腦簡單/);assert.match(top.line,/資源高/);assert.match(top.line,/從封建時代開始/);assert.match(top.notice,/磚匠（條頓）對電腦（日本）/);
 // Save from the menu, then reopen the lobby: 取消 returns to the running match.
 await page.keyboard.press('F10');await page.locator('#save').click();await page.waitForFunction(()=>/已儲存/.test(document.querySelector('#notice').textContent));
 const saved=await tickOf(page);await page.keyboard.press('F10');await page.locator('#lobby-open').click();await page.waitForSelector('#lobby:not([hidden])');
 assert.equal(await page.locator('#lobby-cancel').isVisible(),true);assert.equal(await page.locator('#lobby-name').inputValue(),'磚匠','the last settings are remembered');
 const paused=await tickOf(page);await page.waitForTimeout(600);assert.equal(await tickOf(page),paused,'paused while the lobby is open');
 await page.locator('#lobby-cancel').click();await page.waitForSelector('#lobby',{state:'hidden'});await page.waitForFunction(t=>Number(document.querySelector('#tick').textContent)>t+5,paused);
 note('取消',`回到對局，tick ${paused} → ${await tickOf(page)}`);
 // 科技樹 opens the book on the tree tab; Esc returns to the lobby.
 await page.keyboard.press('F10');await page.locator('#lobby-open').click();await page.waitForSelector('#lobby:not([hidden])');
 await page.locator('#lobby-tree').click();await page.waitForFunction(()=>!document.querySelector('#codex').hidden);
 const tab=await page.locator('#codex [aria-selected="true"]').first().textContent(),chosen=await page.locator('#codex .cx-civ[aria-current="true"]').getAttribute('data-civ');note('科技樹',`${tab}，${chosen}`);assert.match(tab,/科技樹/);assert.equal(chosen,'teutons','the lobby\'s civ is preselected');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#codex').hidden);assert.equal(await page.locator('#lobby').isVisible(),true);
 // 載入遊戲 lists the manual save; loading it restores that tick.
 await page.locator('#lobby-load').click();const slots=await page.locator('#lobby-saves .lobby-save').allTextContents();note('存檔清單',slots.join('／'));
 assert.ok(slots.some(t=>/手動存檔/.test(t)&&/條頓 對 日本/.test(t)));
 await page.locator('#lobby-saves .lobby-save',{hasText:'手動存檔'}).click();await page.waitForSelector('#lobby',{state:'hidden'});
 await page.waitForFunction(()=>/已恢復 tick/.test(document.querySelector('#notice').textContent));const restored=Number((await page.locator('#notice').textContent()).match(/tick (\d+)/)[1]);
 assert.ok(Math.abs(restored-saved)<=40,`restored ${restored} near the saved ${saved}`);note('載入',`存檔 tick ${saved}，恢復 tick ${restored}`);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 // Phone: one column, no sideways scrolling, and it starts a match.
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});watch(phone);
 await phone.goto(origin+'/web/150-brick-rts.html');await phone.waitForSelector('#lobby:not([hidden])');await phone.waitForTimeout(800);
 assert.ok(await fits(phone),'the lobby fits a phone');await phone.screenshot({path:out+'lobby-390.png'});
 const cols=await phone.evaluate(()=>getComputedStyle(document.querySelector('.lobby-board')).gridTemplateColumns.split(' ').length);assert.equal(cols,1);
 await phone.locator('#lobby-layout').selectOption('lakes');await phone.locator('#lobby-start').tap();await phone.waitForSelector('#lobby',{state:'hidden'});
 await phone.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);assert.match(await phone.locator('#sel-empty-title').textContent(),/湖畔/);
 note('手機',`單欄、沒有水平捲動，湖畔對局開始（tick ${await tickOf(phone)}）`);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS lobby: first visit waits in the lobby, settings reach the match, 取消 returns, saves load, the tree opens, the phone layout fits');
}catch(e){if(page)await page.screenshot({path:out+'lobby-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
