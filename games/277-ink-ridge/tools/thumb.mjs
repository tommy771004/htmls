// 縮圖候選：node tools/thumb.mjs → dist/thumb-*.png（1280×800），選定後縮成 ../../thumbs/277.jpg（640×400）
import { open, raf } from './lib.mjs';
const { browser, page } = await open('../../web/277-ink-ridge.html', { w: 1280, h: 800 });
await page.evaluate(() => { window.__ink.start(); window.__ink.manual(true); document.querySelectorAll('#sec,#meta,#pauseBtn,#hint').forEach((e) => (e.style.display = 'none')); });
const shots = {
  hang: async () => page.evaluate(() => { const I = window.__ink; I.teleport(1, 4, -41.2); I.setCamYaw(0.35); I.input({ my: 1 }); I.step(12); I.input({ my: 1, jump: true, jumpHeld: true }); for (let i = 0; i < 40 && I.state().mode !== 'hang'; i++) I.step(1); I.input({ mx: 1 }); I.step(30); I.input({}); I.setCamYaw(0.5); I.step(30); }),
  stairs: async () => page.evaluate(() => { const I = window.__ink; I.teleport(-0.6, 0, -3, Math.PI); I.setCamYaw(-0.35); I.input({}); I.step(40); }),
  pillars: async () => page.evaluate(() => { const I = window.__ink; I.teleport(1.7, 3.5, -26.9, Math.PI * 0.95); I.setCamYaw(0.6); I.input({}); I.step(40); }),
  top: async () => page.evaluate(() => { const I = window.__ink; I.teleport(10.6, 11, -45.4, Math.PI * 0.8); I.setCamYaw(-0.9); I.input({}); I.step(40); }),
};
for (const [k, f] of Object.entries(shots)) { await f(); await raf(page); await page.screenshot({ path: `dist/thumb-${k}.png` }); }
await browser.close();
