// 手把驗收（模擬輸入）：無頭 Chrome 沒有真的手把，所以把 navigator.getGamepads 換成假的，
// 用「按鈕按下 → 放開」的序列操作：標題按 Start 開始 → A 略過轉場 → 選單用十字鍵移焦點、A 確認 →
// 十字鍵移動格子游標、A 走過去 → X 換技能 → Y 結束回合 → Start 開設定、B 關掉。
// node tools/padtest.mjs [--page 280-cancel-anytime.html] [--port 8280] [--shots 目錄]
// 只驗證按鍵有接到遊戲流程；實體手把（各家按鍵配置、類比搖桿死區）沒有測過。
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PAGE = opt('--page', '280-cancel-anytime.html'), port = opt('--port', '8280'), shots = opt('--shots', '/tmp/280-pad');
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.addInitScript(() => {
  const pad = { connected: true, id: 'fake', index: 0, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
});
let fail = 0;
const bad = (m) => { fail++; console.log('FAIL ' + m); };
const press = async (i, ms = 90) => {
  await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1; }, i);
  await page.waitForTimeout(ms);
  await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = false; b.value = 0; }, i);
  await page.waitForTimeout(110);
};
const A = 0, B = 1, X = 2, Y = 3, RB = 5, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
const G = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await G(fn)) return true; await page.waitForTimeout(200); } return false; };

try {
  await page.goto(`http://127.0.0.1:${port}/web/${PAGE}?vdbg=1`, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1500);
  await G(() => window.__meta.padKick());   // 無頭環境不會發 gamepadconnected 事件
  await page.waitForTimeout(300);
  // 標題：十字鍵移焦點
  await press(DOWN); await press(DOWN);
  const foc = await G(() => document.activeElement && (document.activeElement.id || document.activeElement.textContent));
  if (!foc) bad('標題選單沒有焦點');
  // Start 開始遊戲
  await press(START);
  if (!await waitFor(() => !!window.__game.s, 15000)) bad('Start 沒有開始遊戲');
  // 轉場、魔王登場用 A 略過，等到戰前嘴砲
  for (let i = 0; i < 40; i++) { if (await G(() => document.querySelector('#modal').classList.contains('check'))) break; await page.waitForTimeout(600); if (i > 3) await press(A); }
  // 嘴砲對話框：往回移到最後一顆（不嘴砲）再按 A
  await page.waitForTimeout(500);
  let skip = null;
  for (let i = 0; i < 8 && skip !== 'skip'; i++) { await press(UP); skip = await G(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.v); }
  if (skip !== 'skip') bad('對話框焦點沒有移到「不嘴砲」：' + skip);
  await press(A);
  if (!await waitFor(() => window.__game.playerTurn && !window.__game.busy, 60000)) bad('等不到玩家回合');
  await page.waitForTimeout(500);
  // 游標移動：往四個方向各試一次，找一個走得到的格子
  const cur0 = await G(() => { const g = window.__game, u = g.R.current(g.s); return [u.x, u.z]; });
  let moved = false;
  for (const d of [RIGHT, UP, LEFT, DOWN]) {
    await press(d);
    await press(A);
    await page.waitForTimeout(500);
    await waitFor(() => !window.__game.busy, 8000);
    const now = await G(() => { const g = window.__game, u = g.R.current(g.s); return [u.x, u.z]; });
    if (now[0] !== cur0[0] || now[1] !== cur0[1]) { moved = true; console.log(`游標＋A：${cur0} → ${now}`); break; }
  }
  if (!moved) bad('十字鍵＋A 沒有讓角色移動');
  await page.screenshot({ path: `${shots}/pad-move.png` });
  // X 換技能
  const sel0 = await G(() => window.__game.sel);
  await press(X);
  const sel1 = await G(() => window.__game.sel);
  if (sel0 === sel1) bad('X 沒有切換技能'); else console.log(`X：${sel0} → ${sel1}`);
  await press(B);
  if (await G(() => window.__game.sel) !== 'move') bad('B 沒有取消回到移動');
  // RB 轉鏡頭
  const y0 = await G(() => window.__view.camYaw());
  await press(RB); await page.waitForTimeout(600);
  const y1 = await G(() => window.__view.camYaw());
  if (Math.abs(y1 - y0) < 0.3) bad('RB 沒有轉鏡頭');
  // Start 開設定、B 關
  await press(START);
  if (await G(() => document.querySelector('#gear').hidden)) bad('Start 沒有打開設定');
  await page.screenshot({ path: `${shots}/pad-gear.png` });
  await press(B);
  if (!await G(() => document.querySelector('#gear').hidden)) bad('B 沒有關掉設定');
  // Y 結束回合
  const id0 = await G(() => window.__game.R.current(window.__game.s).id);
  await press(Y);
  // 下一個可能也是英雄（玩家回合幾乎沒有中斷），所以看「輪到的人換了」而不是看 playerTurn
  let id1 = id0;
  for (let i = 0; i < 300 && id1 === id0; i++) { await page.waitForTimeout(200); id1 = await G(() => { const g = window.__game; return g.s.over ? 'over' : g.R.current(g.s).id; }); }
  if (id0 === id1) bad('Y 沒有結束回合'); else console.log(`Y：${id0} → ${id1}`);
} catch (e) { bad(e.message.split('\n')[0]); await page.screenshot({ path: `${shots}/pad-error.png` }).catch(() => {}); }
if (errs.length) { fail++; console.log([...new Set(errs)].slice(0, 6).join('\n')); }
await browser.close();
console.log(fail ? `FAIL（${fail} 項）` : 'PASS（模擬手把輸入；實體手把未測）');
process.exit(fail ? 1 : 0);
