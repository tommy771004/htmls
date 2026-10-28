// 驗收：開打包後的單檔，在 1440×900（鍵盤）與 390×844（觸控）下檢查
// 沒有 uncaught exception、console.error、外部網路請求、缺 viewport、水平溢出；
// 實際操作：出發 → 加速 → 轉向 → 丟報（鍵盤／觸控按鈕）→ 對準訂戶信箱丟進去（+100）→ 騎完整條街 → 送報單在視窗內。
// 另外量平均幀時間（開／關 GTAO）。node tools/accept.mjs [html]（截圖輸出到 dist/accept-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv[2] || '../../web/273-morning-lane.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }, sel);
const inView = (r, w, h) => !!r && r[0] >= 0 && r[1] >= 0 && r[2] <= w && r[3] <= h;

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  const st = () => page.evaluate(() => window.__ml.state());
  const shot = async (name) => { await raf(page); await page.screenshot({ path: `dist/accept-${name}-${w}.png` }); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
  const ptr = (sel, type) => page.evaluate(([s, t]) => {
    const e = document.querySelector(s), b = e.getBoundingClientRect();
    e.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
  }, [sel, type]);
  const hold = async (key, pad, ms) => {
    if (touch) { await ptr(`#pad [data-k=${pad}]`, 'pointerdown'); await page.waitForTimeout(ms); await ptr(`#pad [data-k=${pad}]`, 'pointerup'); }
    else { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }
  };
  try {
    await page.waitForTimeout(600);
    const lay = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), title: document.title }));
    ok(lay.vp, `${tag} 有 viewport meta`);
    ok(lay.title.includes('晨巷送報'), `${tag} 標題 ${lay.title}`);
    ok(await overflow(), `${tag} 開場沒有水平溢出`);
    ok(inView(await rect(page, '#intro'), w, h), `${tag} 開場卡片完整在視窗內`);
    await shot('intro');
    if (touch) await page.tap('#start'); else await page.click('#start');
    await page.waitForTimeout(300);
    ok((await st()).started, `${tag} 按「出發」開始騎`);
    for (const s of ['#day', '#route', '#missions', '#score', '#stock', touch ? '#pad [data-k=throw]' : '#keys']) ok(inView(await rect(page, s), w, h), `${tag} ${s} 在視窗內`);

    // 加速、轉向（真實輸入）
    const v0 = (await st()).bike.v;
    await hold('ArrowUp', 'accel', 1200);
    const v1 = (await st()).bike.v;
    ok(v1 > v0 + 1.5, `${tag} ${touch ? '加速鈕' : '↑'} 加速 ${v0.toFixed(1)} → ${v1.toFixed(1)} m/s`);
    const x0 = (await st()).bike.x;
    await hold('ArrowLeft', 'left', 500);
    const x1 = (await st()).bike.x;
    ok(x1 < x0 - 0.3, `${tag} ${touch ? '◀' : '←'} 往左（x ${x0.toFixed(2)} → ${x1.toFixed(2)}）`);
    const s0 = (await st()).stock;
    if (touch) { await ptr('#pad [data-k=throw]', 'pointerdown'); await ptr('#pad [data-k=throw]', 'pointerup'); } else await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    ok((await st()).stock === s0 - 1, `${tag} ${touch ? '丟報鈕' : '空白鍵'}丟出一份（剩 ${(await st()).stock}）`);
    await shot('ride');

    // 對準信箱丟（確定性步進）：右車道騎到第一個訂戶信箱前 0.95 m 出手
    await page.evaluate(() => { window.__ml.reset(0); window.__ml.start(); });
    let s = await page.evaluate(() => window.__ml.advance(1));
    while (s.next[0].side < 0) s = await page.evaluate(() => window.__ml.advance(20));   // 等到下一個訂戶在右側
    const next = s.next[0];
    const lead = 0.95;
    const steps = Math.max(1, Math.round((s.bike.z - (next.mz + lead)) / (s.bike.v / 60)));
    await page.evaluate((n) => window.__ml.advance(n), steps);
    await page.evaluate(() => window.__ml.advance(1, { throw: true }));
    await page.evaluate(() => window.__ml.advance(8));
    await shot('throw');
    s = await page.evaluate(() => window.__ml.advance(50));
    ok(s.mailbox === 1 && s.score >= 100, `${tag} 對準訂戶信箱丟進去（分數 ${s.score}、信箱 ${s.mailbox}）`);

    // 效能：即時跑 3 秒（只在桌面尺寸量 GTAO 開關）
    await page.evaluate(() => { window.__ml.reset(0); window.__ml.start(); window.__ml.pause(false); });
    await page.waitForTimeout(3000);
    const pOn = await page.evaluate(() => window.__ml.perf());
    const info = await page.evaluate(() => window.__ml.info());
    let msg = `${tag} 平均幀時間 ${pOn.avg.toFixed(1)} ms（p95 ${pOn.p95.toFixed(1)}），draw calls ${info.calls}、三角形 ${(info.tris / 1000).toFixed(0)}k`;
    if (!touch) {
      const bOn = await page.evaluate(() => { window.__ml.pause(true); window.__ml.bench(60); return window.__ml.bench(90); });   // 先暖機
      const bOff = await page.evaluate(() => { window.__ml.gtao(false); const r = window.__ml.bench(90); window.__ml.gtao(true); return r; });
      msg += `；同步量測 ${bOn.toFixed(1)} ms／關掉 GTAO ${bOff.toFixed(1)} ms`;
    }
    console.log('  ' + msg + `（${log.gpu}）`);

    // 騎完整條街：自動駕駛（換車道、提前出手），送報單要出現在視窗內
    await page.evaluate(() => {
      const M = window.__ml; M.reset(0); M.start(); M.pause(true);
      for (let i = 0; i < 60 * 120; i++) {
        const s = M.state(); if (s.mode !== 'ride') break;
        const n = s.next[0], want = n ? n.side * 1.7 : 1.7;
        const d = n ? s.bike.z - n.mz : 99;
        const thr = n && Math.sign(s.bike.x) === n.side && Math.abs(s.bike.x - want) < 0.5 && d < 1.15 && d > 0.95;
        const steer = Math.abs(s.bike.x - want) > 0.3 ? Math.sign(want - s.bike.x) * 0.6 : 0;
        M.advance(1, { steer: thr ? 0 : steer, throw: thr });
      }
    });
    s = await st();
    ok(s.mode === 'done', `${tag} 騎完整條街（${s.t.toFixed(1)} s，送到 ${s.delivered}/${s.subs}，分數 ${s.score}）`);
    await page.waitForTimeout(200);
    ok(inView(await rect(page, '#sheet'), w, h), `${tag} 送報單完整在視窗內`);
    await shot('end');
    ok(await overflow(), `${tag} 結束時沒有水平溢出`);
    // 一週：結算存進存檔，按「明天」進到週二（白天、有狗與來車）；週日是凌晨、窗戶和路燈亮著
    const sv = await page.evaluate(() => window.__ml.state().save);
    ok(sv.day === 1, `${tag} 週一騎完存檔推進到週二（save.day ${sv.day}）`);
    if (touch) await page.tap('#next'); else await page.click('#next');
    s = await st();
    ok(s.day === 1 && s.mode === 'ride' && s.dogs.length === 1 && s.cars.length === 1, `${tag} 「明天」開始週二（狗 ${s.dogs.length}、車 ${s.cars.length}）`);
    // 週三：騎上跳台起飛、任務「飛過 1 個跳台」完成
    s = await page.evaluate(() => {
      const M = window.__ml; M.reset(2); M.start();
      const r = M.items().ramps[0]; let s = M.state();
      const st = (w) => Math.max(-1, Math.min(1, (w - s.bike.x) * 0.8 - s.bike.yaw * 2));
      for (let i = 0; i < 6000 && s.mode === 'ride' && !s.jumps; i++) s = M.advance(1, { steer: st(s.bike.z > r.z + 14 ? 0.5 : r.x), accel: true });
      return s;
    });
    ok(s.jumps === 1, `${tag} 週三騎上跳台起飛（飛躍 ${s.jumps}）`);
    const ms = await page.evaluate(() => [...document.querySelectorAll('#mList li')].map((l) => l.className));
    ok(ms[0] === 'done', `${tag} 任務「飛過 1 個跳台」打勾（${ms.join(',')}）`);
    s = await page.evaluate(() => { window.__ml.reset(6); window.__ml.start(); return window.__ml.advance(120); });
    ok(s.time === 'night' && s.mode === 'ride', `${tag} 週日凌晨可以騎`);
    await shot('night');
    await page.evaluate(() => window.__ml.wipe());
  } catch (e) {
    ok(false, `${tag} 例外：${e.message.split('\n')[0]}`);
  }
  ok(!log.pageerrors.length, `${tag} 沒有 uncaught exception ${log.pageerrors.slice(0, 2).join(' | ')}`);
  ok(!log.errors.length, `${tag} 沒有 console.error ${log.errors.slice(0, 2).join(' | ')}`);
  ok(!log.external.length, `${tag} 沒有外部請求 ${log.external.slice(0, 2).join(' ')}`);
  await browser.close();
}
console.log(fail ? `\n${fail} 項失敗` : '\n全部通過');
process.exit(fail ? 1 : 0);
