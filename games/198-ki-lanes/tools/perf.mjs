// 效能：開打 4 分鐘後量 4 秒實際幀率（headless Metal）
import { open } from './lib.mjs';
for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w, h, touch });
  await page.evaluate(() => { const k = window.__ki; k.start('homura', 1); k.fastForward(240); k.follow(); });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res({ fps: n / ((performance.now() - t0) / 1000), units: window.__ki.G.units.length, q: window.__ki.render.quality, calls: window.__ki.render.renderer.info.render.calls, tris: window.__ki.render.renderer.info.render.triangles }); }; requestAnimationFrame(f); }));
  console.log(w, h, log.gpu, JSON.stringify(r));
  await browser.close();
}
