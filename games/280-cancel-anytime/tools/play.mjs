// 手動模式驗收：不用 ?auto=1，真的用滑鼠（或觸控）點擊走完第 1 關。
// 涵蓋自動驗收碰不到的流程：標題 → 新手引導（逐步前進）→ 過關評分 → 存戰報圖 → 紀錄與成就 → 每日挑戰。
// node tools/play.mjs [--page 280-cancel-anytime.html] [--port 8280] [--shots 目錄] [--mobile-only|--desktop-only]
// 需要在 repo 根目錄起 HTTP 伺服器：python3 -m http.server 8280
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PAGE = opt('--page', '280-cancel-anytime.html'), port = opt('--port', '8280'), shots = opt('--shots', '/tmp/280-play');
mkdirSync(shots, { recursive: true });
const sizes = args.includes('--mobile-only') ? [[390, 844]] : args.includes('--desktop-only') ? [[1440, 900]] : [[1440, 900], [390, 844]];
const base = `http://127.0.0.1:${port}/web/${PAGE}`;
const VERBOSE = args.includes('--verbose');

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
const bad = (tag, msg) => { fail++; console.log(`FAIL ${tag} ${msg}`); };

for (const [w, h] of sizes) {
  const mob = w < 500, tag = `${w}×${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const shot = (n) => page.screenshot({ path: `${shots}/${mob ? 'm' : 'd'}-${n}.png` });
  const tap = async (x, y) => { if (mob) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
  const tapEl = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('看不到 ' + sel); await tap(b.x + b.width / 2, b.y + b.height / 2); };
  const coach = () => page.evaluate(() => { const c = document.querySelector('#coach'); return c && !c.hidden ? c.querySelector('b').textContent : null; });
  // 找出某一格在畫面上的位置：掃過畫面用遊戲自己的 V.pick 反查，避開被介面蓋住的地方
  const tilePx = (x, z) => page.evaluate(([x, z]) => {
    const V = window.__view, cv = document.querySelector('#gl'), hits = [];
    for (let py = 70; py < innerHeight - 20; py += 12) for (let px = 8; px < innerWidth - 8; px += 12) {
      if (document.elementFromPoint(px, py) !== cv) continue;
      const p = V.pick(px, py);
      if (p && !p.pid && p.x === x && p.z === z) hits.push([px, py]);
    }
    if (!hits.length) return null;
    const cx = hits.reduce((a, b) => a + b[0], 0) / hits.length, cy = hits.reduce((a, b) => a + b[1], 0) / hits.length;
    return hits.reduce((a, b) => ((a[0] - cx) ** 2 + (a[1] - cy) ** 2 < (b[0] - cx) ** 2 + (b[1] - cy) ** 2 ? a : b));
  }, [x, z]);
  const clickTile = async (x, z) => {
    let p = await tilePx(x, z);
    if (!p) {
      // 不在畫面上（手機常見）：把鏡頭移過去，等它停下來
      await page.evaluate(([x, z]) => window.__view.focus(x, z), [x, z]);
      for (let i = 0; i < 6 && !p; i++) { await page.waitForTimeout(450); p = await tilePx(x, z); }
    }
    if (!p) return false;
    await tap(p[0], p[1]);
    if (mob) {
      // 觸控：第一下預覽、第二下確認。預覽可能帶動鏡頭，第二下前重新找一次位置
      await page.waitForTimeout(450);
      if (await page.evaluate(([x, z]) => { const q = window.__game.pending; return !!q && q.x === x && q.z === z; }, [x, z])) {
        const q = await tilePx(x, z) || p;
        await tap(q[0], q[1]);
      }
    }
    return true;
  };
  const waitFor = async (fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await page.evaluate(fn, arg); if (v) return v; await page.waitForTimeout(200); } return null; };

  try {
    // ── 標題 → 開始（故事難度，測流程不是測強度）──
    await page.goto(base + '?vdbg=1', { waitUntil: 'load' });
    await page.waitForSelector('#startBtn', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1800);
    await shot('title');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (over > 1) bad(tag, `標題水平溢出 ${over}px`);
    await tapEl('#diffs [data-d="story"]');
    await tapEl('#startBtn');
    // 關卡卡、魔王登場可以點掉；等到戰前嘴砲的對話框
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => document.querySelector('#modal').classList.contains('check'))) break;
      await page.waitForTimeout(700);
      if (i > 3 && i % 3 === 0) await page.keyboard.press('Space');
    }
    await tapEl('#modal [data-v="skip"]');
    // ── 回合迴圈 ──
    const seen = new Set();
    let turns = 0, result = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 300000) {
      const st = await waitFor(() => { const g = window.__game, s = g.s; if (!s) return null; if (s.over) return { over: s.over }; return g.playerTurn && !g.busy ? { turn: 1 } : null; }, 60000);
      if (!st) { bad(tag, '等不到玩家回合'); break; }
      if (st.over) { result = st.over; break; }
      turns++;
      await page.waitForTimeout(350);
      let c = await coach(); if (c) seen.add(c);
      if (turns === 1) { await shot('coach1'); if (!c) bad(tag, '第一個回合沒有出現引導'); }
      // 一個回合最多做 4 件事：能打就打，不能打就往最近的敵人走
      for (let step = 0; step < 4; step++) {
        const plan = await page.evaluate(() => {
          const g = window.__game, R = g.R, s = g.s;
          if (!s || s.over || !g.playerTurn || g.busy) return null;
          const u = R.current(s);
          const foes = s.units.filter(e => R.isFoe(u, e) && R.alive(e));
          if (!foes.length) return null;
          if (u.action) for (const sk of ['melee', 'ranged']) {
            if (!R.canUse(s, u, sk).ok) continue;
            const t = foes.filter(e => R.validTarget(s, u, sk, e.x, e.z).ok).sort((a, b) => a.hp - b.hp)[0];
            if (t) return { do: 'hit', sk, x: t.x, z: t.z };
          }
          if (u.moveLeft > 0) {
            const reach = [...R.reachable(s, u).keys()].map(k => k.split(',').map(Number));
            const d = (x, z) => Math.min(...foes.map(e => Math.abs(e.x - x) + Math.abs(e.z - z)));
            const best = reach.filter(([x, z]) => !(x === u.x && z === u.z)).sort((a, b) => d(a[0], a[1]) - d(b[0], b[1]))[0];
            if (best && d(best[0], best[1]) < d(u.x, u.z)) return { do: 'move', x: best[0], z: best[1] };
          }
          return null;
        });
        if (!plan) break;
        if (plan.do === 'hit') await tapEl(`#hotbar [data-sk="${plan.sk}"]`);
        else if (await page.evaluate(() => window.__game.sel !== 'move')) await tapEl('#hotbar [data-sk="move"]');
        await page.waitForTimeout(150);
        const ok = await clickTile(plan.x, plan.z);
        if (VERBOSE) console.log(`  回合 ${turns} 步驟 ${step}`, JSON.stringify(plan), ok ? '' : '（找不到這一格）', JSON.stringify(await page.evaluate(() => { const g = window.__game, u = g.R.current(g.s); return { sel: g.sel, busy: g.busy, act: u.action, mv: u.moveLeft, at: [u.x, u.z], pend: g.pending }; })));
        if (!ok && VERBOSE && !seen.has('_diag')) {
          seen.add('_diag');
          await shot('nopick');
          console.log('  診斷', JSON.stringify(await page.evaluate(() => {
            const cv = document.querySelector('#gl'), V = window.__view, cnt = {}; let free = 0, hit = 0;
            for (let py = 70; py < innerHeight - 20; py += 24) for (let px = 8; px < innerWidth - 8; px += 24) {
              const el = document.elementFromPoint(px, py);
              if (el !== cv) { const k = el ? (el.id ? '#' + el.id : el.tagName + '.' + el.className) : 'null'; cnt[k] = (cnt[k] || 0) + 1; continue; }
              free++; if (V.pick(px, py)) hit++;
            }
            return { free, hit, cnt, cls: document.body.className, shot: V.shot && { w: V.shot.w, wT: V.shot.wT } };
          })));
        }
        if (!ok) break;
        await page.waitForTimeout(400);
        // 沒打中會問要不要付小費重擲：一律按「算了」
        for (let i = 0; i < 100; i++) {
          if (await page.evaluate(() => { const g = window.__game; return !g.busy || (g.s && g.s.over); })) break;
          if (await page.evaluate(() => { const b = document.querySelector('#tipAsk'); return b && !b.hidden; })) await tapEl('#tipAsk .ghost');
          await page.waitForTimeout(200);
        }
        c = await coach(); if (c) seen.add(c);
        if (turns === 1 && step === 0) await shot('coach2');
      }
      if (await page.evaluate(() => window.__game.s && window.__game.s.over)) continue;
      await tapEl('#endBtn');
      await page.waitForTimeout(300);
    }
    if (result !== 'win') bad(tag, `沒有打贏（${result}，${turns} 個回合）`);
    if (seen.size < 3) bad(tag, `引導只走到 ${[...seen].join('、')}`);
    // ── 過關收據：評分、戰報圖 ──
    await page.waitForSelector('#modal.loot .rate', { timeout: 30000 });
    await page.waitForTimeout(2200);
    await shot('rating');
    const stars = await page.locator('#modal .rate .stars i.on').count();
    if (stars < 1 || stars > 3) bad(tag, `星數不對：${stars}`);
    let card = '沒有測';
    if (!mob) {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), tapEl('#cardBtn')]);
      await dl.saveAs(`${shots}/card.png`);
      card = dl.suggestedFilename();
    } else {
      // 無頭手機沒有分享面板，改成直接產圖檢查尺寸
      card = await page.evaluate(async () => { const M = window.__meta, g = window.__game; const cv = await M.card(g.s, { lv: 0, diff: 'story', rounds: 3, par: 5, stars: 3, downs: 0, crits: 1, kills: 4 }, window.__view.snap()); return cv.width + '×' + cv.height; });
    }
    const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('cancel-anytime-meta') || 'null'));
    if (!meta || !meta.stars['story:0'] || !meta.ach.first || !meta.coach) bad(tag, '紀錄沒有寫入：' + JSON.stringify(meta));
    console.log(`${tag} 第 1 關 ${result}，${turns} 個玩家回合，${stars} 星，引導：${[...seen].join(' → ')}，戰報圖：${card}，成就：${meta ? Object.keys(meta.ach).join(',') : ''}`);
    // ── 回標題看紀錄（同一個 context，localStorage 還在）──
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('#recBtn', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1500);
    await shot('title2');
    await tapEl('#recBtn');
    await page.waitForSelector('#modal.records .achs', { timeout: 5000 });
    await page.waitForTimeout(500);
    await shot('records');
    if (await page.locator('#modal .ach.got').count() < 1) bad(tag, '紀錄頁沒有已解鎖的成就');
    if (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) > 1) bad(tag, '紀錄頁水平溢出');
    // ── 每日挑戰的紀錄：非自動模式下過關要寫入 daily、標題的備註要更新、解鎖成就 ──
    const dr = await page.evaluate(() => {
      const M = window.__meta, g = window.__game, d = M.daily();
      const keep = g.daily; g.daily = d.date; M.begin();
      const r = M.result({ lv: d.lv, diff: d.diff, round: 3 });
      g.daily = keep;
      const saved = JSON.parse(localStorage.getItem('cancel-anytime-meta'));
      return { stars: r.stars, rec: saved.daily[d.date], ach: !!saved.ach.daily, note: M.dailyNote(), campaign: Object.keys(saved.stars) };
    });
    if (!dr.rec || dr.rec.stars !== dr.stars || !dr.ach || !dr.note.includes('今日已完成')) bad(tag, '每日挑戰紀錄沒有寫入：' + JSON.stringify(dr));
    if (dr.campaign.some(k => !k.startsWith('story:0'))) bad(tag, '每日挑戰寫進了戰役星數：' + dr.campaign);
    // ── 每日挑戰：自動模式打完，確認不會卡住、不動戰役存檔 ──
    const before = await page.evaluate(() => localStorage.getItem('cancel-anytime-v1'));
    await page.goto(base + '?daily=1&auto=1&speed=4', { waitUntil: 'load' });
    const done = await waitFor(() => window.__autoDone || (window.__autoLost || 0) >= 3, 240000);
    const after = await page.evaluate(() => localStorage.getItem('cancel-anytime-v1'));
    const d = await page.evaluate(() => ({ daily: window.__game.daily, lv: window.__game.lv, over: window.__game.s && window.__game.s.over }));
    if (!done || !d.daily) bad(tag, '每日挑戰沒有跑完：' + JSON.stringify(d));
    if (before !== after) bad(tag, '每日挑戰動到了戰役存檔');
    console.log(`${tag} 每日挑戰 ${d.daily} 第 ${d.lv + 1} 關 ${d.over}`);
  } catch (e) {
    bad(tag, e.message.split('\n')[0]);
    await shot('error').catch(() => {});
  }
  if (errs.length) { fail++; console.log([...new Set(errs)].slice(0, 6).join('\n')); }
  await ctx.close();
}
await browser.close();
console.log(fail ? `FAIL（${fail} 項）` : 'PASS');
process.exit(fail ? 1 : 0);
