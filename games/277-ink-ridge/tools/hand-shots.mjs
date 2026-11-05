// 手勢檢查：node tools/hand-shots.mjs <html>，輸出 dist/hand-*.png
import { open, raf } from './lib.mjs';
const html = process.argv[2] || 'dist/hero.html';
const { browser, page, log } = await open(html, { w: 900, h: 800 });
await page.click('#startBtn'); await page.waitForTimeout(300);
const run = (fn, ...a) => page.evaluate(fn, ...a);
const shot = async (n) => { await raf(page); await page.screenshot({ path: `dist/hand-${n}.png` }); };
await run(() => {
  const I = window.__ink; I.manual(true); I.setFov(24);
  window.S = (n) => { for (let i = 0; i < n; i++) I.step(1); return I.state(); };
});
await run(() => { const I = window.__ink; I.teleport(0, 0, 3, Math.PI); I.setCamYaw(1.2); I.input({}); S(60); });
await shot('idle');
await run(() => { const I = window.__ink; I.teleport(0, 0, 6, Math.PI); I.setCamYaw(0); S(1); I.input({ my: 1 }); S(16); I.setCamYaw(Math.PI * 0.55); S(2); });
await shot('run');
await run(() => { const I = window.__ink; I.setCamYaw(0); S(1); I.input({ my: 1, jump: true, jumpHeld: true }); S(10); I.setCamYaw(Math.PI * 0.6); S(2); I.input({}); });
await shot('air');
await run(() => { const I = window.__ink; I.input({}); S(50); I.teleport(0, 0, 3, Math.PI); I.setCamYaw(1.1); S(30); I.input({ strike: true }); S(1); I.input({}); S(7); });
await shot('strike1');
await run(() => S(5));
await shot('strike2');
await run(() => S(5));
await shot('strike3');
// 翻上：岩壁 W2 前緣
await run(() => { const I = window.__ink; I.input({}); S(30); I.setFov(30); I.teleport(9.6, 4, -41.5); I.setCamYaw(0); S(1); });
await run(() => { const I = window.__ink; I.teleport(4, 4, -43.2); I.setCamYaw(0); S(1); });
console.log(await run(() => {
  const I = window.__ink; I.input({ my: 1 }); S(6); I.input({ my: 1, jump: true, jumpHeld: true });
  for (let i = 0; i < 60; i++) if (I.step(1).mode === 'hang') break; I.input({}); S(14); return I.state().ledge;
}));
await run(() => { const I = window.__ink; I.input({ my: 1 }); for (let i = 0; i < 9; i++) I.step(1); I.input({}); I.setCamYaw(0.5); }); // 上攀到一半
await shot('hop1');
console.log(log.pageerrors, log.errors);
await browser.close();
