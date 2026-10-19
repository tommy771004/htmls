// 開發用截圖：node tools/shot.mjs <輸出.png> [query] [要在頁面裡執行的 JS] [等待毫秒] [寬x高] [touch]
import { open, raf } from './lib.mjs';
const [out = 'dist/shot.png', query = '', js = '', wait = '1500', size = '1440x900', touch = ''] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const { browser, page, log } = await open('../../web/200-roadster-arena.html', { w, h, touch: !!touch, query: query ? '?' + query : '' });
try {
  await page.waitForTimeout(800);
  if (js) await page.evaluate(js);
  await page.waitForTimeout(Number(wait));
  await raf(page);
  await page.screenshot({ path: out });
  console.log(out, log.gpu, [...log.pageerrors, ...log.errors].join(' | ').slice(0, 600));
} finally { await browser.close(); }
