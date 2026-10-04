// 量幀率：標題畫面（兩台 AI 對打）跑 6 秒
import { open } from './lib.mjs';
const { browser, page, log } = await open('../../web/200-carball.html', { w: +(process.argv[2] || 1440), h: +(process.argv[3] || 900) });
try {
  const r = await page.evaluate(() => new Promise((res) => {
    let n = 0, worst = 0, last = performance.now(); const t0 = last;
    const f = (t) => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else res({ fps: n / ((t - t0) / 1000), worst }); };
    requestAnimationFrame(f);
  }));
  const gl = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; });
  const info = await page.evaluate(() => { const r = window.__cb.game.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
  console.log(log.gpu, gl, JSON.stringify(r), JSON.stringify(info));
} finally { await browser.close(); }
