// 開發截圖：草叢、眼、視線遮擋
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';
mkdirSync('dist/shots', { recursive: true });
const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w: 1440, h: 900 });
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const shot = async (n) => { await page.waitForTimeout(700); await raf(); await page.screenshot({ path: `dist/shots/b-${n}.png` }); };
await page.evaluate(() => {
  const k = window.__ki; k.start('vegeta', 1); k.fastForward(30); k.freezeAI(true);
  const G = k.G, P = G.player; const b = k.bushes().find((q) => Math.abs(q.x) < 50 && q.x < q.z);
  window.__b = b; k.teleport(b.x, b.z); P.cds.T = 0; k.ward(b.x + 5, b.z - 4); k.fastForward(0.5);
});
await shot('1-inbush');
await page.evaluate(() => { const k = window.__ki, b = window.__b; k.teleport(b.x + b.r + 4, b.z + 2); k.fastForward(0.5); });
await shot('2-outside');
console.log(log.pageerrors, log.errors.slice(0, 3));
await browser.close();
