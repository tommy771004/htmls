// Relic victory on the game screen (no ?debug=1): a match where blue's monk has carried all five relics into the
// monastery (tests/castle-age-fixture.ts, explore + collect: logged commands only). The top bar shows the count and the
// countdown; the match ends when it runs out: 200 years (20000 ticks), at 4x speed about four minutes.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {serialize} from '../packages/sim/sim.ts';
import {castleAgeMatch} from './castle-age-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const s=castleAgeMatch(260925,{explore:true,collect:true});
note('對局準備',`tick ${s.tick}，命令 ${s.log.length} 筆，聖物勝利於 tick ${s.relicVictory?.endsTick}`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const text=id=>page.locator('#'+id).innerText();
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:60000});
 const first=await text('res-relics');note('聖物',`${first}｜${await page.locator('#relics').getAttribute('title')}`);
 assert.match(first,/^5·0\/5 1[56]:\d\d$/);assert.match(await page.locator('#relics').getAttribute('title'),/藍方持有全部聖物/);
 await page.screenshot({path:out+'relic-countdown.png'});
 await page.locator('#speed').selectOption('4');await page.waitForTimeout(3000);const later=await text('res-relics');note('三秒後',later);assert.notEqual(later,first,'the countdown runs');
 await page.locator('#result').waitFor({state:'visible',timeout:420000});note('結果',`${await text('result-title')}｜${await text('result-detail')}`);
 assert.equal(await text('result-title'),'勝利');assert.match(await text('result-detail'),/藍方持有全部聖物 200 年/);
 await page.screenshot({path:out+'relic-victory.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS relic victory: all relics held, countdown shown and running, victory by relics');
}catch(e){if(page)await page.screenshot({path:out+'relic-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
