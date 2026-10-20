// 除錯截圖：node tools/shot.mjs out.png "js 指令（可用 T = window.__terra）" [寬 高]
import { open, raf } from './lib.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [out, code = '', w = 1440, h = 900] = process.argv.slice(2);
const { browser, page, log } = await open(resolve(root, '../../web/268-terra-sandbox.html'), { w: +w, h: +h });
try {
  await page.waitForTimeout(500);
  const steps = code.split(';;');
  for (const s of steps) {
    const m = /^wait\s+(\d+)$/.exec(s.trim());
    if (m) await page.waitForTimeout(+m[1]);
    else if (s.trim()) {
      const r = await page.evaluate(`(async () => { const T = window.__terra; ${s} })()`);
      if (r !== undefined) console.log(JSON.stringify(r));
      await page.waitForFunction(() => window.__terra.ready, null, { timeout: 40000 });
    }
  }
  await page.waitForTimeout(600);
  await raf(page);
  await page.screenshot({ path: out });
  if (log.pageerrors.length || log.errors.length) console.log('ERR', log.pageerrors.slice(0, 3), log.errors.slice(0, 3).map((e) => e.slice(0, 300)));
} finally {
  await browser.close();
}
