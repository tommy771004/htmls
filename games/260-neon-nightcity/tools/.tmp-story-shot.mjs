import { open } from './lib.mjs';
const out = process.argv[2];
const { browser, page, log } = await open('http://127.0.0.1:8761/web/nc.html', { w: 1280, h: 800, query: '?story=1' });
try {
  await page.evaluate(() => window.__nc.start());
  await page.waitForTimeout(1500);
  // P-2 的起點：羅莎與門口等著的戴恩（配角身體）
  await page.evaluate(async () => {
    const N = window.__nc, St = N.story;
    St.go('P-2', false);
    for (let i = 0; i < 30; i++) N.step(1 / 60);
    const p = St.M['P-2'].at(); N.tp(p.x, p.z, 0);
    for (let i = 0; i < 30; i++) N.step(1 / 60);
  });
  await page.waitForTimeout(12000);   // 等掃描身體下載
  const r = await page.evaluate(() => {
    const N = window.__nc, St = N.story, p = N.player;
    for (let i = 0; i < 20; i++) N.step(1 / 60);
    const g = St.M['P-2'].giverAt();
    const mx = (p.x + g.x) / 2, mz = (p.z + g.z) / 2;
    N.camAt(mx + 3.2, 1.7, mz - 2.6, mx, 1.1, mz);
    for (let i = 0; i < 4; i++) N.step(1 / 60);
    return { p: [p.x, p.z], g: [g.x, g.z] };
  });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(800);
  await page.screenshot({ path: out });
} catch (e) { console.log('ERR', e.message); }
console.log('errors', log.pageerrors, log.errors.slice(0, 5), log.warns.filter(w => /掃描/.test(w)));
await browser.close();
