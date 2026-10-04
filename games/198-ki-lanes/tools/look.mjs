// 開發用：固定幾個地點截圖，看地面、廣場、河道、野區與基地。node tools/look.mjs [w] [h] [tag]
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';
const a = process.argv.slice(2), w = +(a[0] || 1280), h = +(a[1] || 720), tag = a[2] || 'now';
const out = 'dist/shots'; mkdirSync(out, { recursive: true });
const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w, h });
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
await page.evaluate(() => { const k = window.__ki; k.start('goku', 1); k.fog(false); k.fastForward(26); });
const spots = await page.evaluate(() => {
  const S = window.__ki.G.structures, at = (id) => { const s = S.find((o) => o.sid === id); return [s.x, s.z]; };
  return { tower: at('t01o'), river: [2, -2], camp: [-48, -18], boss: [34, 34], top: at('t00o'), base: [-66, 66], jungle: [-40, -30, 1.3] };
});
for (const [n, [x, z, zm = 1]] of Object.entries(spots)) {
  await page.evaluate(([x, z, zm]) => { const k = window.__ki; k.teleport(x + 3, z + 3); k.camera(x, z, zm); }, [x, z, zm]);
  await page.waitForTimeout(350); await raf();
  await page.screenshot({ path: `${out}/look-${tag}-${n}.png` });
}
console.log('gpu', log.gpu, 'errors', log.pageerrors, log.errors.slice(0, 5));
await browser.close();
