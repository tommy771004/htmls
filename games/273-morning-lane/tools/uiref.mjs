// UI 參考圖：直接從遊戲截圖（面板改成煙燻玻璃之後，遊戲本身就是 UI 規格）。
// ref/ref-ui-hud.png：週三清晨騎乘中（任務面板、訂戶標籤、命中跳字）；ref/ref-ui-results.png：週六黃昏騎完的結算畫面。
// 改成玻璃之前的米色紙版留在 ref/ui/paper-v1-*.png。node tools/uiref.mjs
import { open, raf } from './lib.mjs';
const url = new URL('../../../web/273-morning-lane.html', import.meta.url).pathname;
// 自動駕駛：前方 30 m 內有來車在同一條車道就先閃到右側車道；路邊停車（x 2.55、z −122 起每 150 m）那幾段靠中線
const drive = `const st = (s, w) => { const c = s.cars.find((c) => c.state === 'drive' && c.z < s.bike.z + 2 && c.z > s.bike.z - 30); if (c && w < 0.6) w = 1.7; if ((s.bike.z + 122 + 150 * 9) % 150 > 141 || (s.bike.z + 122 + 150 * 9) % 150 < 7) w = Math.min(w, 0.4); return Math.max(-1, Math.min(1, (w - s.bike.x) * 0.8 - s.bike.yaw * 2)); };`;
{
  const { browser, page } = await open(url, { w: 1600, h: 900 });
  await page.evaluate(`(() => { ${drive} const M = __ml; M.wipe(); M.reset(2); M.start(); let s = M.state();
    for (let i = 0; i < 6000 && s.mode === 'ride'; i++) {
      const n = s.next[0], want = n ? n.side * 1.7 : 1.7, d = n ? s.bike.z - n.mz : 99;
      const thr = n && Math.sign(s.bike.x) === n.side && Math.abs(s.bike.x - want) < 0.5 && d < 1.15 && d > 0.95;
      s = M.advance(1, { steer: thr ? 0 : st(s, want), throw: thr });
      if (s.mailbox >= 3 && thr) { s = M.advance(14, {}); break; }
    } })()`);
  await raf(page); await page.screenshot({ path: 'ref/ref-ui-hud.png' }); await browser.close();
}
{
  const { browser, page } = await open(url, { w: 1600, h: 900 });
  await page.evaluate(`(() => { ${drive} const M = __ml; M.wipe(); M.reset(5); M.start(); let s = M.state();
    for (let i = 0; i < 60 * 150 && s.mode === 'ride'; i++) {
      const n = s.next[0], want = n ? n.side * 1.7 : 1.7, d = n ? s.bike.z - n.mz : 99;
      const thr = n && Math.sign(s.bike.x) === n.side && Math.abs(s.bike.x - want) < 0.5 && d < 1.15 && d > 0.95;
      s = M.advance(1, { steer: thr ? 0 : st(s, want), throw: thr, accel: !n || d > 8 });
    } })()`);
  await page.waitForTimeout(300); await raf(page); await page.screenshot({ path: 'ref/ref-ui-results.png' }); await browser.close();
}
console.log('ref/ref-ui-hud.png、ref/ref-ui-results.png');
