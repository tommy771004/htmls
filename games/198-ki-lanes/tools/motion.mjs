// 開發用：實際對戰中拍跑動、轉身、急停時的頭髮與衣擺。node tools/motion.mjs [英雄] [鏡頭倍率]
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';
const [id = 'a18', zm = '0.32'] = process.argv.slice(2);
const out = 'dist/shots'; mkdirSync(out, { recursive: true });
const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w: 900, h: 700 });
await page.evaluate((id) => { const k = window.__ki; k.start(id, 1); k.fog(false); k.freezeAI(true); }, id);
const at = async (x, z) => page.evaluate(([x, z, zm]) => { const k = window.__ki, P = k.G.player; k.camera(P.x, P.z, zm); }, [x, z, +zm]);
await page.evaluate(() => { const k = window.__ki; k.teleport(0, 0); });
await page.waitForTimeout(600);
const shots = [['stand', null, 0], ['run', [14, 0], 650], ['turn', [-14, 0], 180], ['turn2', null, 160], ['stop', 'stop', 260], ['settle', null, 900]];
let k = 0;
for (const [name, mv, wait] of shots) {
  if (mv === 'stop') await page.evaluate(() => { const P = window.__ki.G.player; window.__ki.moveTo(P.x, P.z); });
  else if (mv) await page.evaluate(([x, z]) => { const P = window.__ki.G.player; window.__ki.moveTo(P.x + x, P.z + z); }, mv);
  const t0 = Date.now();
  while (Date.now() - t0 < wait) { await at(); await page.waitForTimeout(30); }
  await at(); await page.waitForTimeout(40);
  await page.screenshot({ path: `${out}/motion-${id}-${k++}-${name}.png` });
}
console.log('errors', log.pageerrors, log.errors.slice(0, 5));
await browser.close();
