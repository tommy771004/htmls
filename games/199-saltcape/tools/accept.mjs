// 驗收：以 file:// 開打包後的單檔，在 1440×900 與 390×844（觸控）下檢查
// 沒有 uncaught exception、console.error、外部網路請求、缺 viewport、手機水平溢出；並實際跑離線練習進到地面。
// node tools/accept.mjs [html]（截圖輸出到 dist/accept-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf, serve } from './lib.mjs';

const file = process.argv[2] || '../../web/199-saltcape.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
// 以檔案開啟：沒有素材也要能進大廳、不報錯
{
  const { browser, page, log } = await open(file, { w: 1440, h: 900 });
  await page.waitForTimeout(800);
  ok(!log.pageerrors.length && !log.errors.length && !log.external.length, `file:// 開啟大廳沒有錯誤 ${[...log.pageerrors, ...log.errors, ...log.external].join(' | ').slice(0, 200)}`);
  await browser.close();
}
const srv = await serve();
for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(srv.url, { w, h, touch });
  try {
    await page.waitForTimeout(1200);
    const lay = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, title: document.title }));
    ok(lay.vp, `${tag} 有 viewport meta`);
    ok(lay.sw <= lay.cw, `${tag} 沒有水平溢出（${lay.sw} ≤ ${lay.cw}）`);
    await raf(page); await page.screenshot({ path: `dist/accept-lobby-${w}.png` });
    await page.evaluate(() => window.__sc.solo('驗收'));
    await page.waitForFunction(() => window.__sc.G.match && window.__sc.match(), null, { timeout: 15000 });
    await page.evaluate(() => { window.__sc.place(-60, 14, 3); window.__sc.look(-Math.PI / 2, 0); window.__sc.give('ar', 2); });
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ mode: window.__sc.G.me.mode, alive: +document.querySelector('#alive').textContent, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(st.mode === 3 && st.alive > 40, `${tag} 離線練習進到地面（存活 ${st.alive}）`);
    ok(st.sw <= st.cw, `${tag} 遊戲中沒有水平溢出`);
    await raf(page); await page.screenshot({ path: `dist/accept-game-${w}.png` });
    ok(!log.pageerrors.length, `${tag} 沒有 uncaught exception ${log.pageerrors.join(' | ')}`);
    ok(!log.errors.length, `${tag} 沒有 console.error ${log.errors.join(' | ').slice(0, 300)}`);
    ok(!log.external.length, `${tag} 沒有外部請求 ${log.external.join(' ')}`);
    console.log(`  （${log.gpu}）`);
  } finally { await browser.close(); }
}
await srv.close();
if (fail) { console.log(`${fail} 項未通過`); process.exit(1); }
console.log('全部通過');
