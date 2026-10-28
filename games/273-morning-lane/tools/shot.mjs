// 截圖：node tools/shot.mjs out.png [寬 高] [JS（在頁面裡執行，可用 __ml）]
// 例：node tools/shot.mjs dist/a.png 1440 900 "__ml.start(); __ml.advance(240, {accel:true})"
import { open, raf } from './lib.mjs';
const [out = 'dist/shot.png', w = 1440, h = 900, js = '__ml.start(); __ml.advance(180, {})'] = process.argv.slice(2);
const { browser, page, log } = await open(new URL('../../../web/273-morning-lane.html', import.meta.url).pathname, { w: +w, h: +h, touch: +w < 600 });
const r = await page.evaluate(js);
await raf(page);
await page.screenshot({ path: out });
if (r !== undefined) console.log(JSON.stringify(r));
for (const k of ['pageerrors', 'errors']) if (log[k].length) console.log(k, log[k]);
await browser.close();
