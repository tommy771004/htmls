// 驗收：開打包後的單檔，在 1440×900（鍵盤）、390×844 與 667×375（觸控）下檢查
// 沒有 uncaught exception、console.error、外部網路請求、缺 viewport、水平溢出、模型缺檔；
// 並實際走過：出航 → 划船 → 點亮燈樁 → 到釣點 → 拋竿 → 等咬鉤 → 提竿 → 收線（依張力按放）→ 釣起（魚簍 1/8、吊牌在視窗內）
// → 木屋碼頭面板（主線／魚簍／外觀）→ 圖鑑 → 暫停面板，面板要完整在視窗內。
// node tools/accept.mjs [html]（截圖輸出到 dist/accept-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv[2] || '../../web/269-stillwater.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }, sel);
const inView = (r, w, h) => !!r && r[0] >= 0 && r[1] >= 0 && r[2] <= w && r[3] <= h;

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true], [667, 375, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  const st = () => page.evaluate(() => window.__st.state());
  const shot = async (name) => { await raf(page); await page.screenshot({ path: `dist/accept-${name}-${w}.png` }); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
  const ptr = (sel, type, x, y) => page.evaluate(([s, t, x, y]) => {
    const e = document.querySelector(s), b = e.getBoundingClientRect();
    e.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: x ?? b.left + b.width / 2, clientY: y ?? b.top + b.height / 2 }));
  }, [sel, type, x, y]);
  const press = async (down) => {
    if (touch) await ptr('#act', down ? 'pointerdown' : 'pointerup');
    else await (down ? page.keyboard.down('Space') : page.keyboard.up('Space'));
  };
  try {
    await page.waitForTimeout(1000);
    const lay = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), title: document.title, rep: window.__st.report() }));
    ok(lay.vp, `${tag} 有 viewport meta`);
    ok(lay.title.includes('靜水釣遊'), `${tag} 標題 ${lay.title}`);
    ok(!lay.rep.missing.length && !lay.rep.placeholders.length, `${tag} 模型：${lay.rep.loaded.join(' ')}${lay.rep.placeholders.length ? '；佔位：' + lay.rep.placeholders.join(' ') : ''}`);
    ok(await overflow(), `${tag} 開場沒有水平溢出`);
    ok(inView(await rect(page, '#intro .sign'), w, h) && inView(await rect(page, '#start'), w, h), `${tag} 開場招牌與「出航」完整在視窗內`);
    await shot('intro');
    if (touch) await page.tap('#start'); else await page.click('#start');
    await page.waitForTimeout(400);
    ok((await st()).mode === 'play', `${tag} 按「出航」開始`);

    // 划船
    const p0 = (await st()).boat;
    if (!touch) { await page.keyboard.down('KeyW'); await page.waitForTimeout(2600); await page.keyboard.up('KeyW'); }
    else {
      const b = await rect(page, '#joy');
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      await ptr('#joy', 'pointerdown', cx, cy - 40); await page.waitForTimeout(2600); await ptr('#joy', 'pointerup', cx, cy - 40);
    }
    const p1 = (await st()).boat;
    const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    ok(moved > 1.5 && p1.z < p0.z, `${tag} ${touch ? '搖桿' : 'W 鍵'}往北划（${moved.toFixed(2)} m）`);
    await shot('row');

    // 燈樁
    await page.evaluate(() => window.__st.toCp(1));
    await page.waitForTimeout(600);
    ok(await page.evaluate(() => window.__st.save().cps[1]), `${tag} 靠近燈樁會點亮（淺灘蘆葦灣）`);
    await shot('lantern');

    // 釣魚：最多拋 4 次，直到釣起一條
    let caught = false, sawBite = false, sawReel = false;
    for (let tries = 0; tries < 4 && !caught; tries++) {
      await page.evaluate(() => window.__st.toSpot(1));
      await page.waitForTimeout(500);
      await press(true); await page.waitForTimeout(60); await press(false);
      let s, t0 = Date.now();
      while (Date.now() - t0 < 45000) { s = await st(); if (s.phase === 'bite' || s.phase === 'idle' && Date.now() - t0 > 1500) break; await page.waitForTimeout(40); }
      if (s.phase !== 'bite') continue;
      sawBite = true;
      if (!(await page.evaluate(() => !document.getElementById('biteMark').classList.contains('hidden')))) ok(false, `${tag} 咬鉤時顯示驚嘆浮標記號`);
      await press(true);
      await page.waitForFunction(() => window.__st.state().phase !== 'bite', null, { timeout: 2000 }).catch(() => {});
      let hold = true; t0 = Date.now();
      while (Date.now() - t0 < 90000) {
        s = await st();
        if (s.phase === 'reel' && !sawReel && s.progress > 40) { sawReel = true; ok(inView(await rect(page, '#reelBox'), w, h), `${tag} 張力條在視窗內`); await shot('reel'); }
        if (!['hook', 'reel'].includes(s.phase)) break;
        const want = s.tension < 70;
        if (want !== hold) { hold = want; await press(want); }
        await page.waitForTimeout(30);
      }
      if (hold) await press(false);
      if (s.phase === 'land' || (await st()).caught > 0) {
        await page.waitForFunction(() => window.__st.state().tag, null, { timeout: 5000 }).catch(() => {});
        caught = (await st()).caught > 0;
      }
      console.log(`  第 ${tries + 1} 竿：${s.phase}，魚 #${s.fish}，進度 ${Math.round(s.progress)}%，張力 ${Math.round(s.tension)}%`);
      await page.waitForTimeout(400);
    }
    ok(sawBite, `${tag} 浮標沉下（咬鉤）`);
    ok(caught, `${tag} 收線釣起一條魚`);
    if (caught) {
      const s = await st();
      ok(s.creel === 1 && s.species === 1, `${tag} 魚簍 ${s.creel}/8、圖鑑 ${s.species} 種`);
      const tr = await rect(page, '#tag .paper');
      ok(inView(tr, w, h), `${tag} 漁獲吊牌完整在視窗內（${tr}）`);
      ok(await overflow(), `${tag} 吊牌沒有水平溢出`);
      await shot('tag');
      await page.evaluate(() => window.__st.ui.hideTag());
    }

    // 面板
    await page.evaluate(() => { const s = window.__st; s.unlockAll(); s.fillBook(24); s.give(3, 3, 2); s.toCp(0); });
    await page.waitForTimeout(500);
    ok((await st()).nearDock, `${tag} 返回木屋碼頭`);
    if (touch) await ptr('#use', 'click'); else await page.keyboard.press('KeyE');
    await page.evaluate(() => { if (!window.__st.state().sheet) document.getElementById('use').click(); });
    await page.waitForTimeout(300);
    ok((await st()).sheet, `${tag} ${touch ? '「碼頭」鈕' : 'E 鍵'}打開木屋碼頭面板`);
    for (const t of ['main', 'creel', 'look']) {
      await page.evaluate((t) => document.querySelector(`#sheet [data-tab=${t}]`)?.click(), t);
      await page.waitForTimeout(150);
      const r = await rect(page, '#sheet > .plank');
      ok(inView(r, w, h), `${tag} 碼頭「${t}」分頁在視窗內`);
    }
    await shot('dock');
    await page.evaluate(() => window.__st.ui.close());
    if (!touch) await page.keyboard.press('Tab'); else await page.click('#bBook');
    await page.waitForTimeout(300);
    ok(inView(await rect(page, '#sheet > .plank'), w, h) && await page.evaluate(() => document.querySelectorAll('#sheet .card').length === 11), `${tag} 圖鑑打開、第一區 11 張卡`);
    await page.evaluate(() => document.querySelector('#sheet .card')?.click());
    await page.waitForTimeout(200);
    await shot('book');
    await page.evaluate(() => window.__st.ui.close());
    if (touch) await page.click('#bPause'); else await page.keyboard.press('KeyP');
    await page.waitForTimeout(200);
    const c0 = (await st()).clock; await page.waitForTimeout(700); const c1 = (await st()).clock;
    ok((await st()).sheet && c0 === c1, `${tag} 暫停時時鐘停止`);
    await page.evaluate(() => window.__st.ui.close());
    ok(await overflow(), `${tag} 全程沒有水平溢出`);

    // 黃昏與瀑布潭的畫面
    await page.evaluate(() => { window.__st.setTime(1120); window.__st.toCp(3); });
    await page.waitForTimeout(1200); await shot('dusk');
    await page.evaluate(() => { window.__st.setTime(800); window.__st.toCp(4); });
    await page.waitForTimeout(1200); await shot('gorge');
  } catch (e) { ok(false, `${tag} 例外：${e.message}`); }
  ok(!log.pageerrors.length, `${tag} 沒有 uncaught exception ${log.pageerrors.join(' | ')}`);
  ok(!log.errors.length, `${tag} 沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  ok(!log.external.length, `${tag} 沒有外部網路請求 ${log.external.slice(0, 3).join(' ')}`);
  console.log(`  （${log.gpu}${log.warns.length ? `，warning ${log.warns.length}：${log.warns[0]}` : ''}）`);
  await browser.close();
}
console.log(fail ? `\n${fail} 項未通過` : '\n全部通過');
process.exit(fail ? 1 : 0);
