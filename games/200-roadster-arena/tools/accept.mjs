// 驗收：開打包後的單檔（file://，離線模式），在 1440×900 與 390×844（觸控）下檢查
// 沒有 uncaught exception、console.error、外部網路請求、缺 viewport、水平溢出；
// 並實際走過：主選單 → Free Ride（Shift＋W 完成 0–60 任務、暫停）→ Time Attack（倒數、五個環、終點結算、幽靈車）
// → 車球聯賽離線練習（開球、進球計分）→ 展示間（開關門、換烤漆）→ 排行榜（我的紀錄）。
// node tools/accept.mjs [html]（截圖輸出到 dist/accept-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv[2] || '../../web/200-roadster-arena.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const wait = (page, fn, ms = 15000, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const visible = (page, id) => page.evaluate((i) => { const el = document.getElementById(i); return !!el && !el.classList.contains('hide') && el.getBoundingClientRect().height > 0; }, id);

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const shot = async (name) => { await raf(page); await page.screenshot({ path: `dist/accept-${name}-${w}.png` }); };
  const press = (sel) => (touch ? page.tap(sel) : page.click(sel));
  try {
    // ---- 主選單 ----
    await page.waitForTimeout(1200);
    const lay = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), title: document.title, screen: window.__rsa.screen }));
    ok(lay.vp, `${tag} 有 viewport meta`);
    ok(lay.screen === 'menu', `${tag} 開在主選單（${lay.title}）`);
    ok(await page.evaluate(() => /離線/.test(document.getElementById('online').textContent)), `${tag} 沒有伺服器時顯示離線模式`);
    ok(await overflow(), `${tag} 主選單沒有水平溢出`);
    await shot('menu');

    // ---- Free Ride ----
    await press('#modes button[data-mode=free]');
    ok(await wait(page, () => window.__rsa.screen === 'free'), `${tag} 進入 Free Ride`);
    await page.waitForTimeout(600);
    if (!touch) {
      await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
      await page.waitForTimeout(1600);
      await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
      ok(await wait(page, () => window.__rsa.drive.rules.done.launch, 2000), `${tag} Shift＋W 從靜止 1.1 秒內到 60 mph（任務完成）`);
    } else {
      // 觸控：真的按住搖桿往上推與推進鍵
      const st = await page.locator('#stick').boundingBox(), bt = await page.locator('#tBtns [data-hold=boost]').boundingBox();
      const cdp = await page.context().newCDPSession(page);
      const pts = [{ x: st.x + st.width / 2, y: st.y + 6, id: 1 }, { x: bt.x + bt.width / 2, y: bt.y + bt.height / 2, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: st.x + st.width / 2, y: st.y + st.height / 2, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[0]] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts });
      await page.waitForTimeout(1600);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      ok(await page.evaluate(() => window.__rsa.drive.car.state.speed > 15 || window.__rsa.drive.rules.done.launch), `${tag} 觸控搖桿＋推進鍵能開車`);
    }
    const hudSpeed = await page.evaluate(() => Number(document.getElementById('speedV').textContent));
    ok(hudSpeed > 0, `${tag} HUD 顯示速度（${hudSpeed}）`);
    await page.waitForTimeout(300);
    await shot('free');
    ok(await overflow(), `${tag} Free Ride 沒有水平溢出`);
    if (touch) await press('#pauseBtn'); else await page.keyboard.press('Escape');
    ok(await wait(page, () => !document.getElementById('pause').classList.contains('hide'), 2000), `${tag} 暫停面板`);
    await shot('pause');
    await press('#pause [data-act=resume]');
    ok(await wait(page, () => document.getElementById('pause').classList.contains('hide'), 2000), `${tag} 繼續`);

    // ---- Time Attack ----
    await page.evaluate(() => window.__rsa.go('menu'));
    await press('#modes button[data-mode=ta]');
    ok(await wait(page, () => window.__rsa.screen === 'ta' && window.__rsa.drive.rules.phase === 'countdown', 3000), `${tag} Time Attack 倒數`);
    await shot('ta-count');
    ok(await wait(page, () => window.__rsa.drive.rules.phase === 'run', 5000), `${tag} 倒數結束開跑`);
    // 每個環：計時加 9 秒，把車擺到環前面、沿穿越方向前進
    for (let i = 0; i < 6; i++) {
      await page.evaluate((i) => {
        const d = window.__rsa.drive, ta = d.rules, g = ta.gates[i], b = d.car.body;
        ta.time += 9;
        ta.prev = { x: g.x - g.dir[0], y: g.y - g.dir[1], z: g.z - g.dir[2] };
        b.setTranslation({ x: g.x + g.dir[0] * 0.5, y: g.y + g.dir[1] * 0.5, z: g.z + g.dir[2] * 0.5 }, true);
        b.setLinvel({ x: g.dir[0] * 20, y: g.dir[1] * 20, z: g.dir[2] * 20 }, true);
      }, i);
      ok(await wait(page, (i) => window.__rsa.drive.rules.next > i, 2000, i), `${tag} 通過第 ${i + 1} 個檢查點`);
      if (i === 1) await shot('ta-split');
    }
    ok(await wait(page, () => !document.getElementById('result').classList.contains('hide'), 3000), `${tag} 終點結算`);
    const res = await page.evaluate(() => ({ t: document.getElementById('resTime').textContent, m: document.getElementById('resMedal').textContent, best: window.__rsa.drive.best }));
    ok(/^00:5\d\./.test(res.t) && /金/.test(res.m), `${tag} 成績 ${res.t} · ${res.m}`);
    ok(res.best && res.best.ghost && res.best.ghost.length > 0, `${tag} 個人紀錄與幽靈車存進本機`);
    await shot('result');
    ok(await overflow(), `${tag} 結算畫面沒有水平溢出`);
    if (touch) await press('#result [data-act=restart]'); else await page.keyboard.press('Enter');
    ok(await wait(page, () => window.__rsa.drive.rules.phase === 'run', 6000), `${tag} 再跑一次`);
    ok(await wait(page, () => window.__rsa.drive.ghost.group.visible, 3000), `${tag} 幽靈車出現`);

    // ---- 車球聯賽（離線練習）----
    await page.evaluate(() => window.__rsa.go('menu'));
    await press('#modes button[data-mode=league]');
    ok(await visible(page, 'lobby'), `${tag} 聯賽大廳`);
    ok(await page.evaluate(() => document.querySelector('#lobby [data-act=quick]').disabled), `${tag} 離線時快速配對停用`);
    await shot('lobby');
    await press('#lobby [data-act=practice]');
    ok(await wait(page, () => window.__rsa.screen === 'league' && window.__rsa.match && window.__rsa.match.lg.cars.length === 6, 5000), `${tag} 3 對 3 練習賽`);
    ok(await wait(page, () => window.__rsa.match.lg.phase === 'play', 6000), `${tag} 開球`);
    await page.waitForTimeout(1500);
    await shot('league');
    await page.evaluate(() => { const L = window.__rsa.match.lg; L.lastTouch = L.cars[0].id; L.placeBall(0, 6, 86, 0, 0, 30); });
    ok(await wait(page, () => document.getElementById('lgS0').textContent === '1', 3000), `${tag} 進球計分`);
    await page.waitForTimeout(400);
    await shot('goal');
    ok(await overflow(), `${tag} 聯賽沒有水平溢出`);
    ok(await wait(page, () => window.__rsa.match.lg.phase === 'kickoff', 6000), `${tag} 進球後重新開球`);

    // ---- 展示間 ----
    await page.evaluate(() => window.__rsa.go('menu'));
    await press('#modes button[data-mode=show]');
    ok(await wait(page, () => window.__rsa.screen === 'show' && window.__rsa.show, 3000), `${tag} 展示間`);
    await press('#paints button:nth-child(3)');
    await press('#sAero [data-v=airbrake]');
    await page.waitForTimeout(1500);
    const sh = await page.evaluate(() => ({ paint: window.__rsa.settings.paint, wing: window.__rsa.show.state.wingH }));
    ok(sh.wing > 0.5 && sh.paint !== 'pearl', `${tag} 升尾翼、換烤漆（${sh.paint}）`);
    await shot('show');
    ok(await overflow(), `${tag} 展示間沒有水平溢出`);

    // ---- 排行榜 ----
    await page.evaluate(() => window.__rsa.go('menu'));
    await press('#modes button[data-mode=board]');
    ok(await visible(page, 'board'), `${tag} 排行榜`);
    await press('#boardTabs [data-v=mine]');
    ok(await wait(page, () => document.querySelectorAll('#boardTable tbody tr').length >= 1, 2000), `${tag} 我的紀錄列出本機成績`);
    await shot('board');
    ok(await overflow(), `${tag} 排行榜沒有水平溢出`);

    ok(!log.pageerrors.length, `${tag} 沒有 uncaught exception ${log.pageerrors.join(' | ')}`);
    ok(!log.errors.length, `${tag} 沒有 console.error ${log.errors.join(' | ').slice(0, 300)}`);
    ok(!log.external.length, `${tag} 沒有外部請求 ${log.external.join(' ')}`);
    console.log(`  （${log.gpu}${log.warns.length ? '；warning：' + log.warns.slice(0, 3).join(' | ').slice(0, 200) : ''}）`);
  } finally { await browser.close(); }
}
if (fail) { console.log(`${fail} 項未通過`); process.exit(1); }
console.log('全部通過');
