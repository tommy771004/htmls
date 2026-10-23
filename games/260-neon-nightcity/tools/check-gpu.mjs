// 顯示卡分級（00-core.js 的 GPU_TIERS）驗收：?hdr=0 退回 8 位元、context lost／restored、選單換等級、第 1 版設定檔遷移、最低等級開場
// 用法：node tools/check-gpu.mjs（先 build；截圖寫到 SHOT_DIR，預設不存）
import { chromium } from 'playwright-core';
import { chromePath, GPU_ARGS, toUrl } from './lib.mjs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const here = new URL('.', import.meta.url).pathname, url = toUrl(resolve(here, '../../../web/260-neon-nightcity.html'));
const shotDir = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
const browser = await chromium.launch({ headless: true, args: GPU_ARGS, executablePath: chromePath() });
let fail = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fail++; };
async function open(q, pre) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => m.type() === 'error' && errs.push('CERR ' + m.text()));
  if (pre) await page.addInitScript(pre);
  await page.goto(url + q, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__nc.start()); await page.waitForTimeout(2500);
  return { page, errs, ctx };
}
// 亮度用 sharp 算截圖（WebGL 畫布沒有 preserveDrawingBuffer，讀不到像素）；sharp 借 197 的
const sharp = createRequire(resolve(here, '../../197-openworld/package.json'))('sharp');
const shotLum = async (page, f) => { const buf = await page.screenshot(shotDir ? { path: resolve(shotDir, f) } : {}); const st = await sharp(buf).stats(); return +((st.channels[0].mean + st.channels[1].mean + st.channels[2].mean) / 3).toFixed(1); };
// 1. 8 位元渲染目標
{
  const a = await open('?gpu=high'); const L1 = await shotLum(a.page, 'v-hdr1.png');
  const b = await open('?gpu=high&hdr=0'); const L0 = await shotLum(b.page, 'v-hdr0.png');
  const t = await b.page.evaluate(() => ({ hdr: window.__nc.gpu.hdr, type: window.__nc.menu.rt() }));
  ok(!t.hdr && L0 > L1 * .4, `?hdr=0 退回 8 位元仍畫得出來（亮度 ${L0}，半浮點 ${L1}）`);
  ok(!a.errs.length && !b.errs.length, `沒有錯誤 ${[...a.errs, ...b.errs].slice(0, 2).join(' | ')}`);
  // 2. 驅動重置
  const p = a.page;
  await p.evaluate(() => { window.__lc = window.__nc.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
  await p.waitForTimeout(800);
  const lost = await p.evaluate(() => ({ lost: window.__nc.gpu.lost, toast: document.getElementById('toast').textContent }));
  await p.evaluate(() => window.__lc.restoreContext()); await p.waitForTimeout(3000);
  const Lr = await shotLum(p, 'v-restored.png');
  const st = await p.evaluate(() => ({ calls: window.__nc.getStats().drawCalls, toast: document.getElementById('toast').textContent }));
  ok(lost.lost === 1 && /重置/.test(lost.toast), `context lost 提示 ${JSON.stringify(lost)}`);
  ok(st.calls > 100 && Lr > L1 * .6, `恢復後重新畫出來（${st.calls} 個 draw call、亮度 ${Lr}／${L1}、${st.toast}）`);
  ok(!a.errs.length, `重置前後沒有錯誤 ${a.errs.slice(0, 3).join(' | ')}`);
  // 3. 選單換等級
  const r = await p.evaluate(() => { const N = window.__nc, m = N.menu; m.set('msaa', 8); m.set('gpu', 'low'); /* 先在原本的等級改過 MSAA：換等級後不能留在設定檔裡 */ const lo = { tier: N.gpu.tier, msaa: m.SET.msaa, refl: m.SET.refl, dist: m.SET.dist, fps: m.SET.fps, rt: m.rt(), dpr: N.renderer.getPixelRatio(), saved: localStorage.getItem('nc260.settings') };
    m.set('gpu', 'auto'); return { lo, back: { tier: N.gpu.tier, auto: N.gpu.auto, msaa: m.SET.msaa, max: N.renderer.capabilities.maxSamples, rt: m.rt(), saved: localStorage.getItem('nc260.settings') } }; });
  ok(r.lo.tier === 'low' && r.lo.msaa === 0 && r.lo.refl === 1 && r.lo.fps === 60 && r.lo.rt.samples === 0 && !/msaa/.test(r.lo.saved), `選單換到低（改過的 MSAA 不留在設定檔） ${JSON.stringify(r.lo)}`);
  ok(r.back.tier === r.back.auto && r.back.rt.samples === Math.min(r.back.msaa, r.back.max) && r.back.saved === '{"v":2,"binds":{}}', `換回自動（這台是${r.back.auto}）${JSON.stringify(r.back)}`);
  await a.ctx.close(); await b.ctx.close();
}
// 4. 舊設定檔（第 1 版：全部的值都存）：和舊預設一樣的畫質值當成沒改過，改照等級；改過的（fov）留著
{
  const old = JSON.stringify({ sens: 1, fov: 70, msaa: 4, refl: 2, dist: 1, fps: 0, res: 'auto', binds: {} });
  const c = await open('?gpu=mid', `try { if (!sessionStorage.x) { localStorage.setItem('nc260.settings', ${JSON.stringify(old)}); sessionStorage.x = 1; } } catch (e) {}`);
  const s = await c.page.evaluate(() => { const S = window.__nc.menu.SET; return { msaa: S.msaa, refl: S.refl, dist: S.dist, fps: S.fps, fov: S.fov, rt: window.__nc.menu.rt() }; });
  ok(s.msaa === 2 && s.refl === 1 && s.dist === .9 && s.fps === 60 && s.fov === 70, `第 1 版設定檔遷移到中等級 ${JSON.stringify(s)}`);
  ok(!c.errs.length, `沒有錯誤 ${c.errs.slice(0, 2).join(' | ')}`);
  await c.ctx.close();
}
// 5. 最低等級開場
{
  const d = await open('?gpu=soft'); const s = await d.page.evaluate(() => ({ g: window.__nc.gpu.tier, rt: window.__nc.menu.rt(), S: window.__nc.menu.SET.refl, dpr: window.__nc.renderer.getPixelRatio() }));
  const L = await shotLum(d.page, 'v-soft.png');
  ok(s.g === 'soft' && s.S === 0 && s.dpr === 1 && L > 5 && !d.errs.length, `最低等級開場 ${JSON.stringify(s)} 亮度 ${L} ${d.errs.slice(0, 2).join(' | ')}`);
}
await browser.close();
console.log(fail ? `✗ ${fail} 項失敗` : '✓ 全部通過');
process.exit(fail ? 1 : 0);
