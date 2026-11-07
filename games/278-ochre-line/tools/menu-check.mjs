#!/usr/bin/env node
// 主選單實測：真實指標點過每個分頁、模式與按鈕，量溢出與遮擋，存 dist/shots/menu_*.png。node tools/menu-check.mjs [--only desk,port,land] [--match]
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const has = k => process.argv.includes(k), only = has('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const dir = resolve(GAME_DIR, 'dist/shots'); mkdirSync(dir, { recursive: true });
// desk／port／land 走完整流程；x 開頭的尺寸只量開戰頁
const SIZES = [['desk', 1440, 900, false], ['port', 390, 844, true], ['land', 844, 390, true], ['x320', 320, 568, true], ['x360', 360, 640, true], ['x667', 667, 375, true], ['x568', 568, 320, true], ['x768', 768, 1024, true], ['x1024', 1024, 768, false], ['x1920', 1920, 1080, false], ['x2560', 2560, 1440, false]].filter(x => !only || only.includes(x[0]));
const pageArg = process.argv.find(a => a.startsWith('--page='))?.slice(7);   // --page=dist/x.html：驗收自己的打包，不動 web/
const s = await startServer(undefined, pageArg ? { '/web/278-ochre-line.html': resolve(GAME_DIR, pageArg) } : {}), b = await launch(); let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); };
// 量可見互動元素：不可溢出視窗、不可被別的元素蓋住、觸控高度至少 40
const audit = (p, touch) => p.evaluate(touch => {
  const bad = [], W = innerWidth, H = innerHeight;
  for (const e of document.querySelectorAll('.pn.main button,.pn.main a,.pn.main input')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
    const sheet = e.closest('.m-sheet,#m-roster');   // 捲動區裡的元素可以在捲動範圍外
    if (r.left < -0.5 || r.right > W + 0.5 || (!sheet && (r.top < -0.5 || r.bottom > H + 0.5))) { bad.push('出界 ' + (e.textContent || e.dataset.set).trim().slice(0, 10) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); continue; }
    if (sheet && (r.bottom > H || r.top < 0)) continue;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (t !== e && !e.contains(t) && !t?.closest('label')?.contains(e)) bad.push('被蓋 ' + (e.textContent || '').trim().slice(0, 10) + ' <- ' + (t?.id || t?.className || t?.tagName));
    if (touch && r.height < 32) bad.push('太矮 ' + (e.textContent || '').trim().slice(0, 10) + ' ' + Math.round(r.height));
  }
  return { bad, ow: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
}, touch);
try {
  for (const [tag, w, h, touch] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    const p = await ctx.newPage(), bad = [];
    p.on('console', m => { if (m.type() === 'error' || /validation/i.test(m.text())) bad.push(m.text().slice(0, 220)); });
    p.on('pageerror', e => bad.push('uncaught ' + String(e).slice(0, 220)));
    await p.goto(`${s.url}/web/278-ochre-line.html`);
    await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const click = async sel => { if (touch) await p.tap(sel); else await p.click(sel); await p.waitForTimeout(350); };
    await p.screenshot({ path: `${dir}/menu_${tag}.png` });
    const r0 = await audit(p, touch); check(`${tag} 開戰頁版面`, !r0.bad.length && r0.ow <= r0.cw, r0.bad.join('；') + ` ${r0.ow}/${r0.cw}`);
    const go = await p.evaluate(() => { const r = document.querySelector('#m-go').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; });
    check(`${tag} 開始鈕在第一屏`, go[0] >= 0 && go[1] <= go[2], go.map(Math.round).join(','));
    if (tag[0] === 'x') { check(`${tag} 無錯誤`, !bad.length, bad[0] ?? ''); await ctx.close(); continue; }
    const tabs = await p.$$eval('[role=tab]', e => e.filter(x => x.offsetWidth).map(x => x.dataset.tab));
    for (const t of tabs) {
      await click(`[data-tab=${t}]`);
      const a = await p.evaluate(() => ({ tab: document.querySelector('.pn.main').dataset.tab, sel: document.querySelector('[role=tab][aria-selected=true]').dataset.tab, txt: [...document.querySelectorAll('.m-page')].find(x => x.offsetWidth)?.innerText.length ?? 0 }));
      const r = await audit(p, touch);
      await p.waitForTimeout(500); await p.screenshot({ path: `${dir}/menu_${tag}_${t}.png` });
      check(`${tag} 分頁 ${t}`, a.tab === t && a.sel === t && a.txt > 20 && !r.bad.length && r.ow <= r.cw, `字數 ${a.txt} ${r.bad.join('；')}`);
    }
    await click('[data-tab=arms]');
    const gun = await p.evaluate(() => [...document.querySelectorAll('.m-tile')].map((e, i) => i));
    for (const i of gun) { const t = (await p.$$('.m-tile'))[i]; await t.scrollIntoViewIfNeeded(); if (touch) await t.tap(); else await t.click(); await p.waitForTimeout(60); const n = await p.evaluate(i => { const b = document.querySelectorAll('.m-tile')[i]; return b.getAttribute('aria-pressed') === 'true' && document.querySelector('.m-info h3').textContent === b.querySelector('span').textContent; }, i); if (!n) check(`${tag} 軍械第 ${i} 格`, false); }
    for (const id of ['l40', 'p9', 'ar5']) { const i = await p.$$eval('.m-tile span', (e, n) => e.findIndex(x => x.textContent.startsWith(n)), id.toUpperCase()); const t = (await p.$$('.m-tile'))[i]; await t.scrollIntoViewIfNeeded(); if (touch) await t.tap(); else await t.click(); await p.waitForTimeout(500); await p.screenshot({ path: `${dir}/menu_${tag}_arm_${id}.png` }); }
    await click('[data-tab=set]');
    const set = await p.evaluate(() => { const e = document.querySelector('.m-set [data-set=vol]'); e.value = 0.35; e.dispatchEvent(new Event('input', { bubbles: true })); const s = document.querySelector('.m-set [data-set=sens]'); s.value = 0.0044; s.dispatchEvent(new Event('input', { bubbles: true })); return [__ol.input.sens, document.querySelector('[data-out=vol]').textContent, localStorage.getItem('ochre-line.settings.v1')]; });
    check(`${tag} 設定寫入`, set[0] === 0.0044 && set[1] === '35%' && /0\.35/.test(set[2]), JSON.stringify(set));
    await click('[data-tab=play]');
    for (const m of ['def', 'rand', 'atk']) { await click(`[data-mode=${m}]`); const o = await p.evaluate(m => [document.querySelector(`[data-mode=${m}]`).getAttribute('aria-checked'), document.querySelector('#m-go').dataset.s, document.querySelector('#m-go').getBoundingClientRect().bottom <= innerHeight], m); check(`${tag} 模式 ${m}`, o[0] === 'true' && o[1] === m && o[2], o.join()); if (m === 'def') await p.screenshot({ path: `${dir}/menu_${tag}_def.png` }); }
    check(`${tag} 離開鈕指向作品集`, await p.getAttribute('.m-exit', 'href') === '../index.html');
    if (tag === 'port') {   // 停在隊伍分頁時轉橫向：分頁消失，要退回開戰，再轉回直式也正常
      await click('[data-tab=team]'); await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(400);
      const a = await p.evaluate(() => { const t = document.querySelector('[role=tab][aria-selected=true]'); return [document.querySelector('.pn.main').dataset.tab, t.dataset.tab, t.offsetWidth > 0, document.querySelector('#m-go').getBoundingClientRect().width > 0]; });
      const r = await audit(p, touch); await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(300);
      check(`${tag} 轉橫向退回開戰`, a[0] === 'play' && a[1] === 'play' && a[2] && a[3] && !r.bad.length, a.join() + ' ' + r.bad.join('；'));
    }
    if (has('--match') && !touch) {
      await click('#m-go'); await p.waitForTimeout(600);
      const a = await p.evaluate(() => ({ menu: getComputedStyle(document.querySelector('.pn.main')).display, ph: __ol.G.phase, me: !!__ol.G.me }));
      check(`${tag} 開始後進遊戲`, a.menu === 'none' && a.ph === 'buy' && a.me, JSON.stringify(a));
      await p.evaluate(() => { __ol.speed(10); }); await p.waitForFunction(() => __ol.G.phase === 'over', null, { timeout: 280000 });
      await p.waitForTimeout(400); await p.screenshot({ path: `${dir}/menu_${tag}_result.png` });
      const r = await p.evaluate(() => [document.querySelector('#rs').textContent, document.querySelector('#rsd').textContent, localStorage.getItem('ochre-line.record.v1')]); check(`${tag} 賽果與戰績`, /勝利|落敗/.test(r[0]) && /"matches":1/.test(r[2]), r.join(' | '));
      await p.evaluate(() => { __ol.speed(1); });
      await p.click('#tomenu'); await p.waitForTimeout(900); await p.screenshot({ path: `${dir}/menu_${tag}_back.png` });
      const m = await p.evaluate(() => ({ menu: getComputedStyle(document.querySelector('.pn.main')).display, ph: __ol.G.phase, me: !!__ol.G.me, rec: document.querySelector('#m-rec').innerText, hud: getComputedStyle(document.querySelector('#hudroot')).display }));
      check(`${tag} 回到主選單`, m.menu === 'flex' && m.ph === 'menu' && !m.me && m.hud === 'none' && /勝|敗/.test(m.rec), JSON.stringify(m));
      await click('#m-go'); await p.waitForTimeout(800);
      await p.evaluate(() => { const G = __ol.G; G.winner = G.me.team; G.phase = 'over'; }); await p.waitForTimeout(400);
      await p.click('#again'); await p.waitForTimeout(800);
      const ag = await p.evaluate(() => ({ ph: __ol.G.phase, res: getComputedStyle(document.querySelector('#rs').closest('.pn')).display, matches: JSON.parse(localStorage.getItem('ochre-line.record.v1')).matches }));
      check(`${tag} 再來一場`, ag.ph === 'buy' && ag.res === 'none' && ag.matches === 2, JSON.stringify(ag));
      await p.evaluate(() => { document.exitPointerLock?.(); __ol.G.paused = true; document.querySelector('#leave').closest('.pn').style.display = 'flex'; }); await p.click('#leave'); await p.waitForTimeout(700);
      await click('[data-mode=def]'); await click('#m-go'); await p.waitForTimeout(1000);
      await p.evaluate(() => { __ol.G.time = 0; }); await p.waitForTimeout(2500); await p.screenshot({ path: `${dir}/menu_${tag}_second.png` });
      const n = await p.evaluate(() => ({ ph: __ol.G.phase, team: __ol.G.me.team, agents: __ol.G.agents.length, fov: __ol.ctx.camera.fov }));
      check(`${tag} 第二場可開`, (n.ph === 'live' || n.ph === 'planted') && n.team === 1 && n.agents === 10 && Math.abs(n.fov - Math.PI / 2) < 1e-6, JSON.stringify(n));
      await p.keyboard.press('Escape'); await p.evaluate(() => { document.exitPointerLock?.(); __ol.G.paused = true; document.querySelector('#leave').closest('.pn').style.display = 'flex'; });
      await p.click('#leave'); await p.waitForTimeout(600);
      const q = await p.evaluate(() => ({ ph: __ol.G.phase, matches: JSON.parse(localStorage.getItem('ochre-line.record.v1')).matches, paused: __ol.G.paused }));
      check(`${tag} 中途離開不計戰績`, q.ph === 'menu' && q.matches === 2 && !q.paused, JSON.stringify(q));
      await click('[data-tab=set]'); await click('#m-clear'); const c1 = await p.textContent('#m-clear'), kept = await p.evaluate(() => !!localStorage.getItem('ochre-line.record.v1')); await click('#m-clear');
      const c2 = await p.evaluate(() => [localStorage.getItem('ochre-line.record.v1'), document.querySelector('#m-rec').innerText, document.querySelector('#m-clear').disabled]);
      check(`${tag} 清除戰績要按兩次`, /再按一次/.test(c1) && kept && c2[0] === null && /尚無戰績/.test(c2[1]) && c2[2], JSON.stringify(c2));
      await p.click('.m-exit'); await p.waitForURL('**/index.html', { timeout: 15000 }).catch(() => {});
      check(`${tag} 離開鈕回作品集`, /\/index\.html$/.test(p.url()), p.url());
    }
    check(`${tag} 無錯誤`, !bad.length, bad[0] ?? '');
    await ctx.close();
  }
  if (!only || only.includes('still')) {   // 減少動態：鏡頭與士兵都要靜止，內容照常可見
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }), p = await ctx.newPage();
    await p.goto(`${s.url}/web/278-ochre-line.html`); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 }); await p.waitForTimeout(1200);
    const cam = () => p.evaluate(() => { const c = __ol.ctx.camera.position; return [c.x, c.y, c.z].map(v => +v.toFixed(5)).join(); });
    const a = await cam(); await p.waitForTimeout(1500); const c = await cam();
    const r = await p.evaluate(() => ({ go: document.querySelector('#m-go').getBoundingClientRect().width > 0, anim: getComputedStyle(document.querySelector('.m-left>*')).animationName, line: getComputedStyle(document.querySelector('.m-line')).transitionDuration }));
    check('still 鏡頭靜止、無入場動畫', a === c && r.go && r.anim === 'none' && r.line === '0s', `${a} / ${c} ${JSON.stringify(r)}`);
    await ctx.close();
  }
} finally { await b.close(); await s.close(); }
console.log(fails ? `\n未通過 ${fails} 項` : '\n全部通過'); process.exitCode = fails ? 1 : 0;
