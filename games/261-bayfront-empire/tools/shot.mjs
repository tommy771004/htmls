// 開發用截圖：node tools/shot.mjs <輸出.png> [寬] [高] [query] [js]
import { open, raf } from './lib.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [out, w = 1440, h = 900, query = '?auto=legacy', js = ''] = process.argv.slice(2);
const { browser, page, log } = await open(resolve(root, '../../web/261-bayfront-empire.html'), { w: +w, h: +h, touch: +w < 600, query });
try {
  if (js) await page.evaluate(js);
  await page.waitForTimeout(1500);
  await raf(page);
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ stats: await page.evaluate(() => window.__bf.stats()), gpu: log.gpu, errors: log.errors, pageerrors: log.pageerrors, external: log.external }));
} finally { await browser.close(); }
