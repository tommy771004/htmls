// 開啟 HTML 並截圖。用法：node tools/shot.mjs <html> <out.png> [--w 1440] [--h 900] [--wait 1500] [--start] [--ground] [--eval "JS 運算式"]
// --start：__sw.start()；--ground：__sw.skipToGround()。--eval 的結果以 RESULT: 印出。
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const flag = (k) => a.includes('--' + k);
const [html, out] = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--') && !['--start', '--ground'].includes(a[i - 1])));
if (!html || !out) { console.error('usage: node tools/shot.mjs <html> <out.png> [--w --h --wait --start --ground --eval]'); process.exit(2); }
const { browser, page, log } = await open(html, { w: +opt('w', 1440), h: +opt('h', 900) });
if (flag('start')) await page.evaluate(() => window.__sw.start());
if (flag('ground')) await page.evaluate(() => window.__sw.skipToGround());
await page.waitForTimeout(+opt('wait', 1500));
let res;
const ev = opt('eval', null);
if (ev) { try { res = await page.evaluate(ev); } catch (e) { res = { evalError: String(e.message || e) }; } await page.waitForTimeout(300); }
await page.screenshot({ path: out });
await browser.close();
if (ev) console.log('RESULT: ' + JSON.stringify(res));
console.log(JSON.stringify({ saved: out, gpu: log.gpu, pageerrors: log.pageerrors, errors: log.errors, external: log.external }));
