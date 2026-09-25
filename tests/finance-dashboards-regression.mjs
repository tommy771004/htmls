// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE=/path/to/chrome node tests/finance-dashboards-regression.mjs
// 144–148 五件財務儀表板的共同驗收：兩種尺寸下無例外、無 console.error、無外部請求、有 viewport meta、手機不水平溢出、畫面上沒有 NaN / undefined。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fs.mkdtempSync(path.join(os.tmpdir(),'finance-qa-'));
const pages=['144-finance-passbook','145-pnl-bridge','146-cashflow-reservoir','147-budget-envelopes','148-cfo-runway'];
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(fs.readFileSync(file))});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let failed=0;
for(const name of pages){
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    page.on('request',req=>{const u=req.url();if(!u.startsWith(origin)&&!u.startsWith('blob:')&&!u.startsWith('data:'))external.push(u)});
    const label=`${name} @${viewport.width}`;
    try{
      await page.goto(`${origin}/web/${name}.html`,{waitUntil:'load'});
      await page.waitForTimeout(900);
      const state=await page.evaluate(()=>({
        viewport:!!document.querySelector('meta[name="viewport"]'),
        overflow:document.documentElement.scrollWidth-innerWidth,
        bad:(document.body.innerText.match(/NaN|undefined|Infinity/g)||[]).length,
        lang:document.documentElement.lang
      }));
      assert.equal(state.viewport,true,'缺少 viewport meta');
      assert.ok(state.overflow<=0,`水平溢出 ${state.overflow}px`);
      assert.equal(state.bad,0,'畫面出現 NaN / undefined / Infinity');
      assert.equal(state.lang,'zh-Hant');
      // 點過每個 select 的每個選項，確認切換不會拋錯或產生壞值
      for(const handle of await page.$$('select')){
        if(!await handle.isVisible())continue;
        const values=await handle.evaluate(s=>[...s.options].map(o=>o.value));
        for(const v of values)await handle.selectOption(v);
        await handle.selectOption(values[0]);
      }
      await page.waitForTimeout(300);
      const bad=await page.evaluate(()=>(document.body.innerText.match(/NaN|undefined|Infinity/g)||[]).length);
      assert.equal(bad,0,'切換選項後出現 NaN / undefined / Infinity');
      assert.deepEqual(errors,[],'有例外或 console.error');
      assert.deepEqual(external,[],'有外部網路請求');
      await page.screenshot({path:path.join(output,`${name}-${viewport.width}.png`),fullPage:true});
      console.log('ok  ',label);
    }catch(e){failed++;console.log('FAIL',label,e.message)}
    await page.close();
  }
}
await browser.close();server.close();
console.log('screenshots:',output);
process.exit(failed?1:0);
