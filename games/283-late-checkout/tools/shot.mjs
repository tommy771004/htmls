// 單張截圖＋印出 console.error / 例外 / 外部請求。
// node tools/shot.mjs "<網址參數，如 ?cam=0,1.6,8,0,0>" out.png [寬=1440] [高=900] [等待毫秒=2500] [--page 檔名] [--pre "就緒後先執行的 js"] [--eval "截圖前執行並印出的 js"] [--cams "x,y,z,yaw°,pitch°;…"] [--seq "js;;js;;…"（每段執行後各截一張 out-N.png）]
import { chromium } from 'playwright-core';
const a = process.argv.slice(2);
const take = k => { const i = a.indexOf(k); return i >= 0 ? a.splice(i, 2)[1] : null; };
const cams = take('--cams'); const page_ = take('--page') || '283-late-checkout.html', ev = take('--eval'), pre = take('--pre'), seq = take('--seq'), port = take('--port') || '8283';
const [q = '', out = '/tmp/283.png', w = '1440', h = '900', wait = '2500'] = a;
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type() + ':', m.text().slice(0, 600)); });
page.on('pageerror', e => console.log('pageerror:', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
page.on('request', r => { const u = r.url(); if (!u.startsWith(`http://127.0.0.1:${port}`) && !u.startsWith('data:') && !u.startsWith('blob:')) console.log('external:', u); });
await page.goto(`http://127.0.0.1:${port}/web/${page_}${q}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__lc && window.__lc.ready, null, { timeout: 60000 }).catch(() => console.log('timeout: __lc.ready'));
if (pre) await page.evaluate(pre);
await page.waitForTimeout(+wait);
if (ev) console.log('eval:', JSON.stringify(await page.evaluate(ev)));
console.log('info:', JSON.stringify(await page.evaluate(() => window.__lc && window.__lc.info ? window.__lc.info() : null)));
if (seq) { let i = 0; for (const c of seq.split(';;')) { const r = await page.evaluate(c); if (r !== undefined && r !== null) console.log('seq' + (i + 1) + ':', JSON.stringify(r)); await page.waitForTimeout(450); await page.screenshot({ path: out.replace('.png', '-' + (++i) + '.png') }); } }
else if (cams) { let i = 0; for (const c of cams.split(';')) { await page.evaluate(c => { window.__lc.cam = c.split(',').map(Number); }, c); await page.waitForTimeout(+wait > 600 ? 600 : +wait); await page.screenshot({ path: out.replace('.png', '-' + (++i) + '.png') }); } }
else await page.screenshot({ path: out });
await browser.close();
