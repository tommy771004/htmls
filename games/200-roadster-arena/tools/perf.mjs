// 量幀率：Free Ride 全速開 6 秒、聯賽 3v3 跑 6 秒。node tools/perf.mjs [寬] [高] [畫質 low|mid|high]
import { open } from './lib.mjs';
const [w = 1440, h = 900, q = 'high'] = process.argv.slice(2);
const fps = (page) => page.evaluate(() => new Promise((res) => {
  let n = 0, worst = 0, last = performance.now(); const t0 = last;
  const f = (t) => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else res({ fps: +(n / ((t - t0) / 1000)).toFixed(1), worst: +worst.toFixed(1) }); };
  requestAnimationFrame(f);
}));
// 一幀裡所有 pass 的 draw call 與三角形（composer 每個 pass 都會重設計數，先關掉自動重設）
const info = (page) => page.evaluate(() => new Promise((res) => {
  const ri = window.__rsa.gfx.renderer.info;
  requestAnimationFrame(() => {
    ri.autoReset = false; ri.reset();
    requestAnimationFrame(() => { const r = ri.render; res({ calls: r.calls, tris: r.triangles, q: window.__rsa.gfx.q }); ri.autoReset = true; });
  });
}));
for (const mode of ['free', 'league']) {
  const { browser, page, log } = await open('../../web/200-roadster-arena.html', { w: +w, h: +h, query: `?mode=${mode}&q=${q}` });
  try {
    await page.waitForTimeout(1500);
    if (mode === 'free') await page.evaluate(() => { window.__rsa.auto = { throttle: 1, boost: true, steer: 0.15 }; });
    const r = await fps(page);
    console.log(mode, log.gpu, JSON.stringify(r), JSON.stringify(await info(page)));
  } finally { await browser.close(); }
}
