// The 遊戲元素 round's taunts on the game screen (?debug=1, paused start): Enter opens the chat line, a number (text
// after it is ignored) previews its line and sends it; the line shows in the feed with the side's name once the game
// runs; the one-a-second limit, an unknown number and Esc; the game's letter shortcuts stay quiet while typing. On a
// phone the menu's 嘲諷 button opens the same line. No page errors, no outside requests (voices are local only).
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});};
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 const text=id=>page.locator('#'+id).innerText();
 const chatShown=()=>page.locator('#chat').isVisible();
 // 1. Enter opens the line with the input focused and a hint.
 await page.locator('#map').click({position:{x:40,y:400}});assert.equal(await chatShown(),false);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('#chat').hidden);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'chat-input');note('開啟',await text('chat-preview'));assert.match(await text('chat-preview'),/輸入編號 1–42/);
 // 2. Letters typed here are text, not shortcuts (S would stop the selection, N turn the build page).
 const before=await text('notice');await page.keyboard.type('s');assert.equal(await text('notice'),before);await page.keyboard.press('Backspace');
 // 3. An unknown number is shown and not sent; Esc closes the line.
 await page.keyboard.type('99');note('不存在的編號',await text('chat-preview'));assert.match(await text('chat-preview'),/沒有這個編號/);
 await page.keyboard.press('Enter');assert.equal(await chatShown(),true);
 await page.keyboard.press('Escape');assert.equal(await chatShown(),false);
 // 4. "11 哈" previews taunt 11 and sends it; paused, it waits for the game to run.
 await page.keyboard.press('Enter');await page.keyboard.type('11 哈');note('預覽',await text('chat-preview'));assert.equal(await text('chat-preview'),'（奸笑）');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#chat').hidden);note('送出',await text('notice'));assert.match(await text('notice'),/繼續後送出/);
 // 5. A second one at once: refused (one a second).
 await page.keyboard.press('Enter');await page.keyboard.type('3');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>/嘲諷太頻繁/.test(document.querySelector('#notice').textContent));note('太頻繁',await text('notice'));
 await page.keyboard.press('Escape');
 // 6. Running, the line appears in the feed with the side's name and its number.
 await page.locator('#pause').click();await page.waitForFunction(()=>document.querySelector('#events li[data-kind=chat]'));await page.locator('#pause').click();
 const bubble=page.locator('#events li[data-kind=chat]').first();note('訊息',await bubble.innerText());
 assert.equal(await bubble.getAttribute('data-side'),'blue');assert.match(await bubble.innerText(),/藍方\s*11\s*（奸笑）/);
 note('音效',await page.evaluate(()=>document.body.dataset.lastSound));
 await page.screenshot({path:out+'taunt-1440.png'});
 // 7. The voice setting: on when a local Chinese voice exists, otherwise disabled with the reason.
 await page.keyboard.press('F10');const voice=page.locator('#taunt-voice');note('朗讀設定',`${await voice.isDisabled()?'停用':'可用'}｜${await text('taunt-voice-note')}`);
 await page.keyboard.press('F10');
 // 8. A phone: the menu's 嘲諷 button opens the same line; the send button sends; no sideways scrolling.
 const phone=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});watch(phone);
 await phone.goto(origin+'/web/150-brick-rts.html?debug=1');await phone.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 await phone.locator('#menu-open').click();await phone.locator('#chat-open').click();await phone.waitForFunction(()=>!document.querySelector('#chat').hidden&&document.querySelector('#menu').hidden);
 await phone.locator('#chat-input').fill('16');assert.equal(await phone.locator('#chat-preview').innerText(),'發現敵人。');
 const box=await phone.locator('#chat').boundingBox();note('手機聊天列',`x ${Math.round(box.x)} 寬 ${Math.round(box.width)}`);assert.ok(box.x>=0&&box.x+box.width<=390,'the line fits the phone');
 await phone.screenshot({path:out+'taunt-390-open.png'});
 await phone.locator('#chat button[type=submit]').click();await phone.waitForFunction(()=>document.querySelector('#chat').hidden);
 await phone.locator('#pause').click();await phone.waitForFunction(()=>document.querySelector('#events li[data-kind=chat]'));await phone.locator('#pause').click();
 note('手機訊息',await phone.locator('#events li[data-kind=chat]').first().innerText());
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no sideways scrolling');
 await phone.screenshot({path:out+'taunt-390.png'});
 note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS taunts: Enter opens the chat line, a number previews and sends its taunt, the feed shows it, phone menu button');
}catch(e){if(page)await page.screenshot({path:out+'taunts-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
