// D-stage input check: selection, box select, groups, right-click orders, stop, input isolation, HUD drag.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
async function screen(wx,wy,wz){await page.evaluate(()=>scrollTo(0,0));const r=await page.locator('#map').boundingBox(),halfH=Math.max(10.5,12/(r.width/r.height)),scale=r.height/(2*halfH),dx=wx-8,dz=wz-8;return {x:r.x+r.width/2+(dx-dz)*Math.SQRT1_2*scale,y:r.y+r.height/2-(-.5*dx+Math.SQRT1_2*wy-.5*dz)*scale};}
const text=id=>page.locator('#'+id).innerText();
async function drag(a,b,{shift=false,escape=false}={}){if(shift)await page.keyboard.down('Shift');await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});if(escape)await page.keyboard.press('Escape');await page.mouse.up();if(shift)await page.keyboard.up('Shift');await page.waitForTimeout(100);}
// 1. Box-select the three blue villagers around (3.5..4.5, 7..8).
const corners=[await screen(3,0,6.4),await screen(5.1,0,6.4),await screen(3,0,8.6),await screen(5.1,0,8.6)];
const a={x:Math.min(...corners.map(c=>c.x)),y:Math.min(...corners.map(c=>c.y))-40},b={x:Math.max(...corners.map(c=>c.x)),y:Math.max(...corners.map(c=>c.y))};
await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});assert.equal(await page.locator('#select-box').isVisible(),true);await page.screenshot({path:out+'controls-box-drag.png'});await page.mouse.up();await page.waitForTimeout(100);
assert.equal(await text('selected'),'#01 #02 #03');assert.match(await text('position'),/^3 名選取/);assert.equal(await page.locator('#select-box').isVisible(),false);
await page.screenshot({path:out+'controls-three-selected.png'});
// 2. Shift+click toggles one villager out and back in.
const v2=await screen(4.5,.6,7);await page.keyboard.down('Shift');await page.mouse.click(v2.x,v2.y);await page.keyboard.up('Shift');assert.equal(await text('selected'),'#01 #03');
await page.keyboard.down('Shift');await page.mouse.click(v2.x,v2.y);await page.keyboard.up('Shift');assert.equal(await text('selected'),'#01 #02 #03');
// 3. Ctrl+1 stores a group, Esc clears, 1 recalls; 2 is empty.
await page.keyboard.press('Control+Digit1');assert.match(await text('groups'),/1＝1、2、3/);
await page.keyboard.press('Escape');assert.equal(await text('selected'),'未選取');
await page.keyboard.press('Digit2');assert.match(await text('notice'),/編組 2 尚未建立/);assert.equal(await text('selected'),'未選取');
await page.keyboard.press('Digit1');assert.equal(await text('selected'),'#01 #02 #03');
// 4. Typing in a field never triggers shortcuts.
await page.locator('#seed').fill('');await page.locator('#seed').type('51');await page.keyboard.press('Escape');assert.equal(await page.locator('#seed').inputValue(),'51');assert.equal(await text('selected'),'#01 #02 #03');await page.locator('#seed').fill('260925');await page.locator('#seed').blur();
// 5. The browser context menu is suppressed on the scene.
assert.equal(await page.locator('#map').evaluate(c=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});c.dispatchEvent(e);return e.defaultPrevented;}),true);
// 6. A right-click on the hall floor sends all three through the single-file gate.
await page.keyboard.press('Digit1');const hall=await screen(4,0,4.2);await page.mouse.click(hall.x,hall.y,{button:'right'});await page.waitForFunction(()=>/村民 1、村民 2、村民 3 的移動指令已排入/.test(document.querySelector('#notice').textContent));
const start=Number(await text('tick'));await page.locator('#pause').click();
await page.waitForFunction(t=>Number(document.querySelector('#tick').textContent)>t+5&&!/移動中|等待|尋路/.test(document.querySelector('#selection-list').textContent),start,{timeout:60000});await page.locator('#pause').click();
const final=[...(await text('selection-list')).matchAll(/村民 (\d) \(([\d.]+), ([\d.]+)\)：(\S+)/g)].map(m=>({id:+m[1],x:+m[2],y:+m[3],status:m[4]}));
assert.equal(final.length,3);assert.ok(final.every(u=>u.status==='待命'),JSON.stringify(final));assert.equal(new Set(final.map(u=>`${u.x},${u.y}`)).size,3);
await page.screenshot({path:out+'controls-group-hall.png'});
// 7. S stops a long group order at the next node.
const far=await screen(12,0,12);await page.mouse.click(far.x,far.y,{button:'right'});await page.locator('#pause').click();await page.waitForTimeout(900);await page.keyboard.press('KeyS');await page.waitForFunction(()=>/將在下一個節點停下/.test(document.querySelector('#notice').textContent));
await page.waitForFunction(()=>!/移動中|等待|尋路/.test(document.querySelector('#selection-list').textContent),{},{timeout:10000});const stopped=await text('selection-list');await page.waitForTimeout(600);assert.equal(await text('selection-list'),stopped);await page.locator('#pause').click();
// 8. A drag that ends over the sidebar still box-selects (pointer capture) and presses nothing there.
await page.keyboard.press('Escape');const side=await page.locator('#restart').boundingBox();const tickBefore=await text('tick');
await drag({x:a.x-30,y:a.y-60},{x:side.x+side.width/2,y:side.y+side.height/2});assert.equal(await text('tick'),tickBefore);assert.doesNotMatch(await text('notice'),/已建立新沙盒/);
// 9. Escape during a drag cancels the box; clicking empty ground clears the selection without moving anyone.
await page.keyboard.press('Digit1');const hashBefore=await text('hash');const empty=await screen(10,0,5);await page.mouse.click(empty.x,empty.y);assert.equal(await text('selected'),'未選取');assert.equal(await text('hash'),hashBefore);
await page.mouse.click(empty.x,empty.y,{button:'right'});assert.match(await text('notice'),/請先選取村民/);
// 10. Camera: arrows pan only after the scene was clicked; elsewhere they scroll the page. F frames the selection.
const beforePan=await page.locator('#map').screenshot();const spot=await screen(10,0,5);await page.mouse.click(spot.x,spot.y);for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');
assert.equal(await page.evaluate(()=>scrollY),0,'arrow keys did not scroll the page');assert.notDeepEqual(await page.locator('#map').screenshot(),beforePan,'arrow keys pan the camera');
await page.evaluate(()=>scrollTo(0,0));
await page.locator('#selected').click();await page.keyboard.press('ArrowDown');await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>scrollY)>0,'arrow keys scroll the page outside the scene');
await page.keyboard.press('Digit1');await page.keyboard.press('KeyF');assert.match(await text('notice'),/鏡頭已對準/);await page.locator('#reset-view').click();
// 11. Speed: 4x runs 80 ticks per second without skipping; back to 1x.
await page.locator('#speed').selectOption('4');assert.match(await text('notice'),/4×/);const t0=Number(await text('tick'));await page.locator('#pause').click();await page.waitForTimeout(1000);await page.locator('#pause').click();
const ran=Number(await text('tick'))-t0;assert.ok(ran>=40,`4x advanced ${ran} ticks in ~1s`);await page.locator('#speed').selectOption('1');
// 12. Phone touch: tap a villager to select it, tap the ground to order a move.
const phone=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const touch=await phone.newPage();touch.on('pageerror',e=>errors.push(e.message));
await touch.goto(origin+'/web/150-brick-rts.html');await touch.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
const tapAt=async(wx,wy,wz)=>{await touch.evaluate(()=>scrollTo(0,0));const r=await touch.locator('#map').boundingBox(),halfH=Math.max(10.5,12/(r.width/r.height)),scale=r.height/(2*halfH),dx=wx-8,dz=wz-8;await touch.touchscreen.tap(r.x+r.width/2+(dx-dz)*Math.SQRT1_2*scale,r.y+r.height/2-(-.5*dx+Math.SQRT1_2*wy-.5*dz)*scale);await touch.waitForTimeout(150);};
await tapAt(9,0,9);assert.match(await touch.locator('#notice').innerText(),/移動指令已排入/);
await touch.screenshot({path:out+'controls-touch-390.png'});await phone.close();
assert.deepEqual(errors,[]);
console.log('PASS box select, shift toggle, Ctrl groups, Esc, input isolation, context menu, group right-click through gate, S stop, HUD drag, empty-ground deselect, camera pan/focus, 4x speed, touch tap move; '+browser.version());
}finally{await browser.close();server.close();}
