// 驗收：開打包後的單檔，在 1440×900、390×844（觸控）與手機橫式 667×375（觸控）下檢查
// 沒有 uncaught exception、console.error、外部網路請求、缺 viewport、水平溢出；
// 並實際走過：開始 → 走路 → 到平台邊 → 按住蓄力放開甩竿 → 浮標落水 → 咬鉤 → 提竿 → 收線 → 釣起（魚簍 1/8）
// → E 收竿 → 魚簍 7 條再釣一條 → 結算卡 → 放回大海歸零；開場卡與魚卡要完整在視窗內、魚卡不蓋住舉魚的漁夫。
// 另外在 375×667／360×640（短直式觸控）、740×360／568×320（短橫式觸控）與 900×700（非觸控）只看魚卡：在視窗內、
// 內容不被切（scrollHeight ≤ clientHeight）、不蓋住漁夫的斗笠／頭／左手與手上的魚（骨頭與魚的包圍盒投影到螢幕），
// 短橫式不壓到右上的暫停／靜音鈕與魚簍；並在舉魚時暫停，魚卡要藏起來、繼續後回來並照常自動關閉。
// 主流程也檢查暫停（P）、靜音（M）、魚簍面板（C）與鍵盤焦點。
// node tools/accept.mjs [html]（截圖輸出到 dist/accept-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv[2] || '../../web/201-coral-cove.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const wait = (page, fn, ms = 15000, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const rect = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }, sel);
const inView = (r, w, h) => r[0] >= 0 && r[1] >= 0 && r[2] <= w && r[3] <= h;
// 舉魚時要看得到的點投影到螢幕：斗笠頂（head 骨上 0.55 m）、head 骨、左手 hand_L、手上的魚（中心與包圍盒頂）
const heroPx = (page) => page.evaluate(() => {
  const g = window.__cc.game, V = g.camera.position.constructor;
  const P = (v) => { v.project(g.camera); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)]; };
  const bone = (n) => g.fisher.obj.getObjectByName(n).getWorldPosition(new V());
  const head = bone('head'), hat = head.clone(); hat.y += 0.55;
  const out = { hat: P(hat), head: P(head), hand: P(bone('hand_L')) };
  const f = g.fishing.fish;
  if (f) {
    out.fish = P(f.obj.position.clone());
    f.obj.traverse((o) => { if (!o.isSkinnedMesh) return; o.computeBoundingBox(); const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld); const c = b.getCenter(new V()); c.y = b.max.y; out.fishTop = P(c); });
  }
  return out;
});
const covers = (r, p) => !!p && p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
const coveredBy = (r, hp) => Object.keys(hp).filter((k) => covers(r, hp[k]));
const hpText = (hp) => Object.entries(hp).map(([k, v]) => `${k} ${v}`).join('，');
const meets = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true], [667, 375, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  const st = () => page.evaluate(() => window.__cc.state());
  const shot = async (name) => { await raf(page); await page.screenshot({ path: `dist/accept-${name}-${w}.png` }); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= innerWidth);
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);
  // 觸控大圓鈕：Playwright 的 touchscreen 沒有「按住」，用 pointer 事件
  const btn = (sel, type) => page.dispatchEvent(sel, type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
  const press = async (down) => {
    if (touch) await btn('#btnMain', down ? 'pointerdown' : 'pointerup');
    else await (down ? page.keyboard.down('Space') : page.keyboard.up('Space'));
  };
  try {
    await page.waitForTimeout(1200);
    const lay = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), title: document.title, rep: window.__cc.report() }));
    ok(lay.vp, `${tag} 有 viewport meta`);
    ok(lay.title.includes('珊瑚灣垂釣'), `${tag} 標題 ${lay.title}`);
    console.log(`  模型：${lay.rep.loaded.join(' ') || '無'}${lay.rep.placeholders.length ? '；佔位：' + lay.rep.placeholders.join(' ') : ''}`);
    ok(await overflow(), `${tag} 開場卡沒有水平溢出`);
    const ir = await rect(page, '#intro'), sr = await rect(page, '#start');
    ok(inView(ir, w, h) && inView(sr, w, h), `${tag} 開場卡與「開始釣魚」完整在視窗內（卡 ${ir.join(',')}，按鈕 ${sr.join(',')}）`);
    await shot('title');
    if (touch) await page.tap('#start'); else await page.click('#start');
    ok(await wait(page, () => document.getElementById('intro').classList.contains('hidden')), `${tag} 按「開始釣魚」關閉開場卡`);

    // 走路
    const p0 = (await st()).pos;
    if (!touch) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
    } else {
      const box = await page.locator('#stick').boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + 6);
      await page.evaluate(() => { window.__cc.game.input.touch.y = -1; });
      await page.waitForTimeout(900);
      await page.evaluate(() => { window.__cc.game.input.touch.y = 0; });
    }
    const p1 = (await st()).pos;
    ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.8, `${tag} ${touch ? '搖桿' : '鍵盤'}走路（移動 ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)} m）`);
    await shot('walk');

    // 到平台邊、按住蓄力放開甩竿
    await page.evaluate(() => window.__cc.place(0.4, -11.3, Math.PI));
    await page.waitForTimeout(300);
    await press(true);
    ok(await wait(page, () => window.__cc.state().phase === 'charge', 2000), `${tag} 按住進入蓄力`);
    await page.waitForTimeout(650);
    await shot('charge');
    await press(false);
    ok(await wait(page, () => window.__cc.state().phase === 'cast', 2000), `${tag} 放開甩竿`);
    ok(await wait(page, () => window.__cc.state().phase === 'wait', 5000), `${tag} 浮標落水進入等待`);
    const s1 = await st();
    ok(s1.bob.z < -12 && Math.abs(s1.bob.y) < 0.2, `${tag} 浮標落在平台外的水面（${s1.bob.x}, ${s1.bob.z}）`);
    await page.waitForTimeout(600);
    await shot('wait');
    const info = await page.evaluate(() => window.__cc.info());
    ok(info.calls < 500, `${tag} 等待畫面 draw call ${info.calls}（三角形 ${info.triangles}）`);

    // 咬鉤 → 提竿
    ok(await page.evaluate(() => window.__cc.bite()), `${tag} bite() 讓魚咬鉤`);
    ok((await st()).phase === 'bite', `${tag} 進入咬鉤`);
    ok(await page.evaluate(() => !document.getElementById('bang').classList.contains('hidden')), `${tag} 浮標上方出現「！」`);
    await shot('bite');
    await press(true);
    ok(await wait(page, () => window.__cc.state().phase === 'fight', 1500), `${tag} 提竿進入拔河`);
    ok(await page.evaluate(() => !document.getElementById('tension').classList.contains('hidden')), `${tag} 顯示張力條`);
    // 按住收線
    const d0 = (await st()).dist;
    await page.waitForTimeout(1300);
    const s2 = await st();
    ok(s2.phase !== 'fight' || s2.dist < d0 - 0.3, `${tag} 按住收線距離縮短（${d0.toFixed(1)} → ${s2.dist.toFixed(1)} m，張力 ${s2.tension}）`);
    await shot('fight');
    await press(false);
    await page.waitForTimeout(400);
    // 繼續收線直到釣起（張力太高就放一下），超時就 land()
    for (let i = 0; i < 60; i++) {
      const s = await st();
      if (s.phase !== 'fight') break;
      await press(s.tension < 0.75);
      await page.waitForTimeout(250);
    }
    await press(false);
    let s3 = await st();
    if (s3.phase !== 'catch') { console.log(`  （拔河未完成：${s3.phase}，改用 land()）`); await page.evaluate(() => window.__cc.land()); }
    ok(await wait(page, () => window.__cc.state().phase === 'catch', 3000), `${tag} 釣起進入舉魚`);
    await page.waitForTimeout(700);
    await shot('catch');
    ok((await text('#creelText')).trim() === '魚簍 1/8', `${tag} 魚簍顯示 1/8（${await text('#creelText')}）`);
    ok(await page.evaluate(() => !document.getElementById('card').classList.contains('hidden')), `${tag} 顯示魚卡`);
    {
      await page.waitForTimeout(900);   // 鏡頭拉近到位
      const cr = await rect(page, '#card'), hp = await heroPx(page);
      ok(inView(cr, w, h), `${tag} 魚卡完整在視窗內（${cr.join(',')}）`);
      const cov = coveredBy(cr, hp);
      ok(!cov.length, `${tag} 魚卡沒有蓋住舉魚的漁夫（${cov.length ? '蓋住 ' + cov.join('、') + '；' : ''}${hpText(hp)}）`);
      if (w > h && h <= 520) ok(!meets(cr, await rect(page, '#sys')) && !meets(cr, await rect(page, '#creelBox')), `${tag} 魚卡沒有壓到暫停／靜音鈕與魚簍`);
    }
    if (touch) await page.tap('#card'); else await page.click('#card');
    ok(await wait(page, () => window.__cc.state().phase === 'explore', 2000), `${tag} 點卡片回到探索`);

    // E 收竿：先甩一竿再收
    ok(await page.evaluate(() => window.__cc.cast(0.5)), `${tag} cast(0.5)`);
    await wait(page, () => window.__cc.state().phase === 'wait', 5000);
    if (touch) { await btn('#btnStow', 'pointerdown'); await btn('#btnStow', 'pointerup'); } else await page.keyboard.press('KeyE');
    ok(await wait(page, () => window.__cc.state().phase === 'stow' || window.__cc.state().phase === 'explore', 1000), `${tag} ${touch ? '「E 收竿」鈕' : 'E'} 收竿`);
    ok(await wait(page, () => window.__cc.state().phase === 'explore', 3000), `${tag} 收竿後回到探索`);

    // 魚餌選單
    if (touch) await page.tap('#baitBtn'); else await page.keyboard.press('KeyB');
    ok(await wait(page, () => !document.getElementById('baitMenu').classList.contains('hidden'), 1000), `${tag} 開魚餌選單`);
    const opts = await page.evaluate(() => [...document.querySelectorAll('#baitMenu .opt')].map((o) => o.textContent + (o.classList.contains('locked') ? '[鎖]' : '')));
    ok(opts.length === 4 && opts.filter((o) => o.includes('[鎖]') && o.includes('之後開放')).length === 3, `${tag} 魚餌：${opts.join('、')}`);
    ok(await overflow(), `${tag} 魚餌選單沒有水平溢出`);
    await shot('bait');
    if (touch) await page.tap('#baitClose'); else await page.keyboard.press('Escape');
    ok(await wait(page, () => document.getElementById('baitMenu').classList.contains('hidden'), 1000), `${tag} 關閉魚餌選單`);

    // 魚簍 7 條再釣一條 → 結算
    await page.evaluate(() => { window.__cc.setCreel(7); window.__cc.land('parrot'); });
    ok((await text('#creelText')).trim() === '魚簍 8/8', `${tag} 魚簍 8/8`);
    await page.waitForTimeout(700);
    if (touch) await page.tap('#card'); else await page.keyboard.press('Space');
    ok(await wait(page, () => !document.getElementById('full').classList.contains('hidden'), 2000), `${tag} 魚簍滿了顯示結算卡`);
    const items = await page.evaluate(() => document.querySelectorAll('#full li').length);
    ok(items === 8, `${tag} 結算卡列出 8 條魚`);
    ok(await overflow(), `${tag} 結算卡沒有水平溢出`);
    await shot('full');
    ok((await text('#mainAct')).includes('再釣一簍'), `${tag} 結算時按鍵提示「${await text('#mainKey')} ${await text('#mainAct')}」`);
    // 桌機用空白鍵關（結算卡剛跳出的 0.4 秒內不收），觸控點按鈕
    if (touch) await page.tap('#releaseBtn'); else { await page.waitForTimeout(500); await page.keyboard.press('Space'); }
    ok(await wait(page, () => window.__cc.state().creel === 0 && document.getElementById('full').classList.contains('hidden'), 2000), `${tag} 放回大海後歸零`);
    ok((await text('#creelText')).trim() === '魚簍 0/8', `${tag} 魚簍顯示 0/8`);
    // 沙灘上不能甩竿
    await page.evaluate(() => window.__cc.place(4, 12, 0));
    await press(true); await page.waitForTimeout(150); await press(false);
    ok((await st()).phase === 'explore' && (await text('#toast')).includes('棧橋'), `${tag} 沙灘上提示「到棧橋上才能甩竿」`);
    // 走道末端與平台後半面海輕甩、中甩都要甩得出去（落點在平台外的水面）；面向岸邊要拒絕
    for (const [x, z, yaw, p, want] of [[0, -7.5, Math.PI, 0, 'wait'], [0, -9, Math.PI, 0, 'wait'], [0, -9, Math.PI, 0.5, 'wait'], [0, -11.5, 0.3, 0.5, 'explore']]) {
      const r = await page.evaluate(async ([x, z, yaw, p]) => {
        const c = window.__cc; c.stow(); await new Promise((r) => setTimeout(r, 900));
        c.place(x, z, yaw); c.cast(p); await new Promise((r) => setTimeout(r, 2200));
        const s = c.state(); return { phase: s.phase, bob: s.bob };
      }, [x, z, yaw, p]);
      ok(r.phase === want && (want === 'explore' || r.bob.z < -12.05 || Math.abs(r.bob.x) > 3), `${tag} 在 (${x}, ${z}) 朝 ${yaw.toFixed(1)} 力道 ${p} 甩竿 → ${r.phase}${r.bob ? ` (${r.bob.x.toFixed(1)}, ${r.bob.z.toFixed(1)})` : ''}`);
    }
    await page.evaluate(() => window.__cc.stow());
    ok(await overflow(), `${tag} 遊戲中沒有水平溢出`);
    await shot('end');

    // 魚簍面板（C／點魚簍）、暫停（P）、靜音（M）
    if (touch) await page.tap('#creelBox'); else await page.keyboard.press('KeyC');
    ok(await wait(page, () => !document.getElementById('creelPanel').classList.contains('hidden'), 1000), `${tag} ${touch ? '點魚簍' : 'C'} 打開魚簍面板`);
    ok(await page.evaluate(() => document.querySelectorAll('#creelPanel .dex li').length === 5), `${tag} 魚簍面板列出 5 種魚的圖鑑`);
    const pr = await rect(page, '#creelPanel');
    ok(inView(pr, w, h), `${tag} 魚簍面板在視窗內（${pr.join(',')}）`);
    await shot('creel');
    if (touch) await page.tap('#creelClose'); else await page.keyboard.press('Escape');
    ok(await wait(page, () => document.getElementById('creelPanel').classList.contains('hidden'), 1000), `${tag} 關閉魚簍面板`);
    if (touch) await page.tap('#btnPause'); else await page.keyboard.press('KeyP');
    ok(await wait(page, () => window.__cc.game.paused && !document.getElementById('pauseCard').classList.contains('hidden'), 1000), `${tag} 暫停並顯示暫停卡`);
    const tp = await page.evaluate(() => window.__cc.game.t); await page.waitForTimeout(300);
    ok((await page.evaluate(() => window.__cc.game.t)) === tp, `${tag} 暫停時遊戲時間停住`);
    if (touch) await page.tap('#resumeBtn'); else await page.keyboard.press('KeyP');
    ok(await wait(page, () => !window.__cc.game.paused, 1000), `${tag} 繼續遊戲`);
    if (touch) await page.tap('#btnMute'); else await page.keyboard.press('KeyM');
    ok(await page.evaluate(() => window.__cc.game.audio.muted), `${tag} 靜音`);
    if (touch) await page.tap('#btnMute'); else await page.keyboard.press('KeyM');
    ok(await page.evaluate(() => !window.__cc.game.audio.muted), `${tag} 取消靜音`);
    if (!touch) {
      // 鍵盤：B 開選單焦點移進選單，Esc 關閉；焦點在大圓鈕上按 Enter 能蓄力
      await page.keyboard.press('KeyB');
      ok(await wait(page, () => document.activeElement && document.activeElement.closest('#baitMenu'), 1000), `${tag} B 開選單後焦點在選單裡`);
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.__cc.place(0.3, -10.6, Math.PI));
      await page.focus('#btnMain'); await page.keyboard.down('Enter');
      ok(await wait(page, () => window.__cc.state().phase === 'charge', 1000), `${tag} 焦點在大圓鈕上按 Enter 進入蓄力`);
      await page.keyboard.up('Enter');
      await page.waitForTimeout(300); await page.evaluate(() => window.__cc.stow());
    }

    ok(!log.pageerrors.length, `${tag} 沒有 uncaught exception ${log.pageerrors.join(' | ')}`);
    ok(!log.errors.length, `${tag} 沒有 console.error ${log.errors.join(' | ').slice(0, 300)}`);
    ok(!log.warns.length, `${tag} 沒有 console warning ${log.warns.join(' | ').slice(0, 300)}`);
    ok(!log.external.length, `${tag} 沒有外部請求 ${log.external.join(' ')}`);
    console.log(`  （${log.gpu}）`);
  } finally { await browser.close(); }
}
// 只看魚卡的尺寸：短直式、短橫式（觸控）與窄桌機（861～930 px，卡片右緣不能超出視窗）。
// 先放一條魚再釣紅笛鯛：習性說明最長，又同時有「新魚種！」「這簍最大」兩個標籤，卡片最高
for (const [w, h, touch] of [[375, 667, true], [360, 640, true], [740, 360, true], [568, 320, true], [900, 700, false]]) {
  const tag = `${w}×${h} 魚卡`;
  const { browser, page, log } = await open(html, { w, h, touch });
  try {
    await page.evaluate(() => { const c = window.__cc; c.start(); c.setCreel(1); c.place(0, -9.5, Math.PI); c.land('snapper'); });
    await page.waitForTimeout(1600);   // 鏡頭拉近到位、卡片進場動畫結束
    const cr = await rect(page, '#card'), hp = await heroPx(page);
    ok(inView(cr, w, h), `${tag}完整在視窗內（${cr.join(',')}）`);
    const sc = await page.evaluate(() => { const c = document.getElementById('card'); return [c.scrollHeight, c.clientHeight, c.querySelectorAll('.rec').length]; });
    ok(sc[0] <= sc[1] && sc[2] === 2, `${tag}內容沒有被切（內容 ${sc[0]} px，卡片 ${sc[1]} px，標籤 ${sc[2]} 個）`);
    const cov = coveredBy(cr, hp);
    ok(!cov.length, `${tag}沒有蓋住舉魚的漁夫（${cov.length ? '蓋住 ' + cov.join('、') + '；' : ''}${hpText(hp)}）`);
    if (w > h && h <= 520) {
      const sr = await rect(page, '#sys'), br = await rect(page, '#creelBox');
      ok(!meets(cr, sr), `${tag}沒有壓到暫停／靜音鈕（卡 ${cr.join(',')}，鈕 ${sr.join(',')}）`);
      ok(!meets(cr, br), `${tag}沒有壓到魚簍（卡 ${cr.join(',')}，魚簍 ${br.join(',')}）`);
    }
    await page.screenshot({ path: `dist/accept-catch-${w}.png` });
    if (w === 375) {
      // 舉魚時暫停：魚卡藏起來（不和暫停卡疊在一起）、自動關閉的計時停住；繼續後魚卡回來，照常自動關閉
      await page.keyboard.press('KeyP');
      const t0 = await page.evaluate(() => window.__cc.game.fishing.catchT);
      ok(await wait(page, () => document.getElementById('card').classList.contains('hidden') && !document.getElementById('pauseCard').classList.contains('hidden'), 1000), `${tag}：暫停時藏起來，只顯示暫停卡`);
      await page.waitForTimeout(4500);
      const s = await page.evaluate(() => ({ phase: window.__cc.state().phase, t: window.__cc.game.fishing.catchT }));
      ok(s.phase === 'catch' && s.t === t0, `${tag}：暫停 4.5 秒沒有自動關閉（${s.phase}，計時 ${s.t.toFixed(2)} s）`);
      await page.screenshot({ path: `dist/accept-catchpause-${w}.png` });
      await page.keyboard.press('KeyP');
      ok(await wait(page, () => !window.__cc.game.paused && !document.getElementById('card').classList.contains('hidden'), 1000), `${tag}：繼續後回來`);
      ok(await wait(page, () => window.__cc.state().phase === 'explore', 5000), `${tag}：繼續後照常自動關閉`);
    }
    ok(!log.pageerrors.length && !log.errors.length, `${tag} 沒有錯誤 ${log.pageerrors.concat(log.errors).join(' | ').slice(0, 300)}`);
  } finally { await browser.close(); }
}
if (fail) { console.log(`${fail} 項未通過`); process.exit(1); }
console.log('全部通過');
