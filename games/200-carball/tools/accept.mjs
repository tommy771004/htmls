// 驗收：開打包後的單檔，在 1440×900 與 390×844（觸控）下檢查
// 沒有 uncaught exception、console.error、外部網路請求、缺 viewport、水平溢出；
// 並實際走過：開局倒數 → 按鍵開車 → 進球 → 重播 → 開球、被撞毀、平手延長賽 → 結算。
// node tools/accept.mjs [html]（截圖輸出到 dist/accept-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv[2] || '../../web/200-carball.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const wait = (page, fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  const st = () => page.evaluate(() => window.__cb.state());
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  try {
    await page.waitForTimeout(1500);
    const lay = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), title: document.title }));
    ok(lay.vp, `${tag} 有 viewport meta`);
    ok(await overflow(), `${tag} 標題畫面沒有水平溢出`);
    await raf(page); await page.screenshot({ path: `dist/accept-title-${w}.png` });
    // 開局：用真的按鈕
    await page.click('#start');
    ok(await wait(page, () => window.__cb.state().phase === 'play', 8000), `${tag} 倒數後開球`);
    // 按鍵開車
    if (!touch) {
      const z0 = (await st()).pos.z;
      await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
      await page.waitForTimeout(1200);
      await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
      const s = await st();
      ok(s.pos.z - z0 > 6 && s.boost < 33, `${tag} W＋Shift 往前衝並消耗加速（前進 ${(s.pos.z - z0).toFixed(1)} m）`);
    } else {
      const box = await page.locator('#stick').boundingBox();
      const z0 = (await st()).pos.z;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + 4);   // 點一下確認觸控有接上
      await page.evaluate(() => { const g = window.__cb.game; g.input.touch.y = -1; });
      await page.waitForTimeout(1200);
      await page.evaluate(() => { window.__cb.game.input.touch.y = 0; });
      ok((await st()).pos.z - z0 > 4, `${tag} 觸控搖桿能開車`);
    }
    await raf(page); await page.screenshot({ path: `dist/accept-drive-${w}.png` });
    ok(await overflow(), `${tag} 遊戲中沒有水平溢出`);
    // 進球 → 重播 → 開球
    await page.evaluate(() => { window.__cb.freezeAI(); window.__cb.place('car', -6, 0.3, 30, 0, 0, 0, 0); window.__cb.place('ball', 2, 2.5, 40, 0, 2, 16); });
    ok(await wait(page, () => window.__cb.state().score[0] === 1, 5000), `${tag} 進球計分`);
    await page.waitForTimeout(500); await raf(page); await page.screenshot({ path: `dist/accept-goal-${w}.png` });
    ok(await wait(page, () => window.__cb.state().replay, 8000), `${tag} 進入重播`);
    await page.waitForTimeout(1200); await raf(page); await page.screenshot({ path: `dist/accept-replay-${w}.png` });
    ok(await wait(page, () => !window.__cb.state().replay && window.__cb.state().phase === 'kickoff', 12000), `${tag} 重播結束回到開球`);
    // 被撞毀：對手以超音速撞上玩家
    await wait(page, () => window.__cb.state().phase === 'play', 6000);
    await page.evaluate(() => { const c = window.__cb; c.place('car', 0, 0.2, 0, 0, 0, 0, 0); c.place('ai', 0, 0.2, 6, 0, 0, -23, Math.PI); c.place('ball', 20, 0.92, 20); });
    ok(await wait(page, () => window.__cb.sim.cars[0].state.demolished > 0, 3000), `${tag} 超音速撞擊會撞毀`);
    await page.waitForTimeout(500); await raf(page); await page.screenshot({ path: `dist/accept-demo-${w}.png` });
    ok(await wait(page, () => window.__cb.sim.cars[0].state.demolished <= 0, 5000), `${tag} 3 秒後重生`);
    // 平手進延長賽（先把比分拉平），再進一球結束
    await page.evaluate(() => { const s = window.__cb.sim; s.score = [1, 1]; window.__cb.play(); s.clock = 0.3; window.__cb.place('ball', 0, 0.92, 0); });
    ok(await wait(page, () => window.__cb.sim.overtime, 5000), `${tag} 平手進延長賽`);
    await wait(page, () => window.__cb.state().phase === 'play', 6000);
    await page.evaluate(() => { window.__cb.place('car', -6, 0.3, 30, 0, 0, 0, 0); window.__cb.place('ball', -2, 2.5, 40, 0, 2, 16); });
    ok(await wait(page, () => window.__cb.state().phase === 'over', 8000), `${tag} 延長賽進球後結算`);
    await page.waitForTimeout(400); await raf(page); await page.screenshot({ path: `dist/accept-over-${w}.png` });
    ok(await page.evaluate(() => !document.getElementById('over').classList.contains('hidden')), `${tag} 顯示結算畫面`);
    ok(await overflow(), `${tag} 結算畫面沒有水平溢出`);
    ok(!log.pageerrors.length, `${tag} 沒有 uncaught exception ${log.pageerrors.join(' | ')}`);
    ok(!log.errors.length, `${tag} 沒有 console.error ${log.errors.join(' | ').slice(0, 300)}`);
    ok(!log.external.length, `${tag} 沒有外部請求 ${log.external.join(' ')}`);
    console.log(`  （${log.gpu}）`);
  } finally { await browser.close(); }
}
if (fail) { console.log(`${fail} 項未通過`); process.exit(1); }
console.log('全部通過');
