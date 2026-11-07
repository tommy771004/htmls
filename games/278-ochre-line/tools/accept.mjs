#!/usr/bin/env node
// 赭線驗收：兩尺寸 × 兩後端、完整比賽、路線實走、零配置、快照 CPU 比較。結果寫到 dist/accept.json。
// node tools/accept.mjs [--only desk,flow,guns,follow,draws,route,gc,snap]
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const only = (process.argv[process.argv.indexOf('--only') + 1] ?? '').split(',').filter(Boolean), want = k => !process.argv.includes('--only') || only.includes(k);
// --page=dist/x.html：驗收自己的打包，不動 web/，截圖、計數版與結果都分開放，可以和別的 session 同時跑
const pageArg = process.argv.find(a => a.startsWith('--page='))?.slice(7), tag0 = pageArg ? '-' + basename(pageArg, '.html') : '';
const shots = resolve(GAME_DIR, 'dist/accept' + tag0); mkdirSync(shots, { recursive: true });
const countHtml = resolve(GAME_DIR, `dist/count${tag0}.html`);
if (want('gc')) execFileSync('node', ['tools/build.mjs', '--count', `--out=dist/count${tag0}.html`], { cwd: GAME_DIR, stdio: 'ignore' });
const s = await startServer(undefined, { '/web/__count.html': countHtml, ...(pageArg ? { '/web/278-ochre-line.html': resolve(GAME_DIR, pageArg) } : {}) }), b = await launch();
// draw 上限：2026-11-07 全部七把新槍載入後量到 569／281，換槍不變，上限只留一點餘裕，多一把槍或多拆一個網格要先想過再改這裡
const DRAW_LIMIT = [575, 285], DRAW_SPREAD = 4;
const out = { checks: [], fails: [] }, PAGE = '/web/278-ochre-line.html';
const check = (name, ok, detail = '') => { out.checks.push({ name, ok, detail }); if (!ok) out.fails.push(name); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };
const note = (name, detail) => { out.checks.push({ name, note: true, detail }); console.log(`--   ${name}  ${detail}`); };

async function open(path, { width, height, touch = false }) {
  const ctx = await b.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage(), bad = [], ext = [];
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' || /validation|GPUValidation|Destroyed texture/i.test(t)) bad.push(t.slice(0, 220)); });
  p.on('pageerror', e => bad.push('uncaught ' + String(e.stack || e).slice(0, 240)));
  p.on('request', r => { const u = r.url(); if (!u.startsWith(s.url) && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u); });
  await p.goto(s.url + path);
  await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 120000 });
  if (!(await p.evaluate(() => !!window.__ol))) throw new Error('開機失敗 ' + path + ' ' + (await p.title()) + ' ' + bad[0]);
  return { p, ctx, bad, ext };
}

try {
  if (want('desk')) for (const [label, q, size, touch] of [
    ['桌機 WebGPU', '', [1440, 900], false], ['手機 WebGPU', '', [390, 844], true],
    ['桌機 WebGL', '?gfx=webgl', [1440, 900], false], ['手機 WebGL', '?gfx=webgl', [390, 844], true],
  ]) {
    const { p, ctx, bad, ext } = await open(PAGE + q, { width: size[0], height: size[1], touch });
    await p.waitForTimeout(1500);
    const tag = label.replace(/\s/g, '_');
    await p.screenshot({ path: `${shots}/${tag}_menu.png` });
    const backend = await p.evaluate(() => __ol.stats().webgpu);
    check(`${label} 後端正確`, backend === !q, `webgpu=${backend}`);
    check(`${label} viewport meta`, await p.evaluate(() => !!document.querySelector('meta[name=viewport]')));
    const menuBox = await p.evaluate(() => { const r = document.querySelector('button[data-s=atk]').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    check(`${label} 開始鈕在畫面內`, menuBox[0] >= 0 && menuBox[1] >= 0 && menuBox[2] <= size[0] && menuBox[3] <= size[1], menuBox.map(Math.round).join(','));
    await p.evaluate(() => document.querySelector('button[data-s=atk]').click());
    await p.waitForTimeout(800);
    await p.evaluate(() => { __ol.G.time = 0; });
    await p.waitForTimeout(q ? 2500 : 6000);
    await p.screenshot({ path: `${shots}/${tag}_game.png` });
    const d0 = await p.evaluate(() => __ol.stats()); await p.waitForTimeout(1500);
    const m = await p.evaluate(() => ({ ...__ol.stats(), phase: __ol.G.phase, ow: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    m.draws = Math.round((m.draws - d0.draws) / Math.max(1, m.frame - d0.frame));
    check(`${label} 進入回合`, m.phase === 'live' || m.phase === 'planted', m.phase);
    check(`${label} 無水平溢出`, m.ow <= m.cw, `${m.ow}/${m.cw}`);
    if (touch) check(`${label} 觸控介面`, await p.evaluate(() => [...document.querySelectorAll('#ui *')].some(e => e.classList.contains('tc') && e.getBoundingClientRect().width > 0)));
    if (touch) {
      const t = await p.evaluate(async () => {
        const down = n => { const b = [...document.querySelectorAll('.tc')].find(e => e.getAttribute('aria-label') === n); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); return b; };
        const up = b => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        const f = down('射擊'), fire = __ol.input.fire; up(f);
        const u = down('使用'), use = __ol.input.use; up(u);
        return { fire, use };
      });
      check(`${label} 觸控射擊與使用`, t.fire && t.use, JSON.stringify(t));
      await p.evaluate(() => { __ol.startMatch({ side: 'atk' }); }); await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector('.tc.buy'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }); await p.waitForTimeout(300);
      const bx = await p.evaluate(() => { const e = document.getElementById('buy'), bs = [...e.querySelectorAll('.cols button')].map(x => x.getBoundingClientRect()); return { disp: getComputedStyle(e).display, minH: Math.min(...bs.map(r => r.height)), right: Math.max(...bs.map(r => r.right)), fs: parseFloat(getComputedStyle(e.querySelector('.cols button')).fontSize) }; });
      await p.screenshot({ path: `${shots}/${tag}_buy.png` });
      check(`${label} 購買面板`, bx.disp === 'flex' && bx.right <= size[0] && bx.minH >= 40 && bx.fs >= 15, JSON.stringify(bx));
    }
    check(`${label} 無錯誤`, !bad.length, bad[0] ?? '');
    check(`${label} 無外部請求`, !ext.length, ext[0] ?? '');
    note(`${label} 效能`, `fps ${m.fps.toFixed(1)}，draw ${m.draws}`);
    await ctx.close();
  }

  if (want('flow')) for (const side of ['atk', 'def']) {
    const { p, ctx, bad } = await open(PAGE + '?clean=1', { width: 960, height: 540 });
    await p.waitForTimeout(800);
    await p.evaluate(side => { __ol.startMatch({ side }); __ol.speed(10); }, side);
    const seen = { plant: 0, swap: 0 }; let was = 'buy', team = await p.evaluate(() => __ol.G.me.team), r;
    for (let i = 0; i < 3000; i++) {
      await p.waitForTimeout(200);
      const c = await p.evaluate(() => { const G = __ol.G; return { phase: G.phase, team: G.me.team }; });
      if (c.phase === 'planted' && was !== 'planted') seen.plant++;
      if (c.team !== team) { seen.swap++; team = c.team; }
      was = c.phase; if (c.phase === 'over') break;
    }
    r = await p.evaluate(() => { const G = __ol.G, c = {}; for (const x of G.history) c[x.why] = (c[x.why] || 0) + 1; return { phase: G.phase, score: [...G.score], winner: G.winner, rounds: G.history.length, why: c, kills: G.agents.reduce((a, x) => a + x.kills, 0) }; });
    Object.assign(r, seen);
    check(`比賽 ${side} 打完`, r.phase === 'over' && r.winner >= 0, JSON.stringify(r));
    check(`比賽 ${side} 換邊`, r.rounds <= 6 || r.swap === 1, `swap=${r.swap}`);
    check(`比賽 ${side} 有實際交戰`, r.kills >= r.rounds * 2, `擊殺 ${r.kills}／${r.rounds} 回合`);
    check(`比賽 ${side} 無錯誤`, !bad.length, bad[0] ?? '');
    await ctx.close();
  }

  if (want('flow')) {
    // 玩家沒有世界裡的士兵，命中走 weapons.js 的 bodyCaps；這項壞掉時玩家會變成打不死
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await p.goto(`${s.url}/web/278-ochre-line.html?clean=1`);
    await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 90000 });
    const r = await p.evaluate(async () => {
      const O = __ol, G = O.G, w = ms => new Promise(f => setTimeout(f, ms));
      O.startMatch({ side: 'def' }); O.fps(); G.time = 1;
      while (G.phase === 'buy') await w(50);
      await w(2500);
      const e = G.agents.find(a => a.alive && a.team !== G.me.team), hp = G.me.hp, t0 = performance.now();
      O.teleport(e.x + Math.sin(e.yaw) * 6, e.y, e.z + Math.cos(e.yaw) * 6, (e.yaw + Math.PI) * 180 / Math.PI, 0);
      while (performance.now() - t0 < 4000 && G.me.hp === hp) await w(30);
      return { hp, after: G.me.hp, ms: Math.round(performance.now() - t0) };
    });
    check('敵人子彈打得到玩家', r.after < r.hp, JSON.stringify(r));
    await p.close();
  }

  if (want('guns')) {
    // 七把新槍的規則：全走 tick（O.sim 同步推進），和有沒有真模型無關。index.json 為空時也要過
    const { p, ctx, bad } = await open(PAGE + '?clean=1', { width: 1280, height: 720 });
    const NEW = ['c7', 'm7', 'b90', 't4', 'x10', 's6', 'n9'];
    const r = await p.evaluate(async NEW => {
      const O = __ol, G = O.G, W = O.weapons, I = O.input, out = { g: {} }, wait = ms => new Promise(f => setTimeout(f, ms));
      O.startMatch({ side: 'def' }); O.setClean(true); G.time = 1; while (G.phase === 'buy') await wait(50);
      const m = G.me, hold = () => { G.time = 900; m.hp = 1e6; };
      const press = k => { I[k] = true; O.sim(0.05); I[k] = false; };
      // s6 打身體不致命：真的朝 bot 胸口開一槍。命中體跟著骨架，要經過渲染，這段不能用 O.sim
      { const id = 's6', w = W[id]; hold(); O.giveWeapon(id); O.sim(0.7); G.scoped = true; m.ammo[id] = w.mag; O.fps(); out.lethal = { tries: 0, max: w.dmg * 1.25, headK: w.head };   // 身體最高倍率是 weapons.js damage() 的 1.25
        for (const e of G.agents.filter(a => a.alive && a.team !== m.team)) for (const pitch of [-8, -6, -10]) {
          if (out.lethal.hit || !e.alive) continue;
          out.lethal.tries++; hold(); e.armor = 0; e.helmet = false; e.hp = 100; m.ammo[id] = w.mag;
          O.teleport(e.x + Math.sin(e.yaw) * 6, e.y, e.z + Math.cos(e.yaw) * 6, (e.yaw + Math.PI) * 180 / Math.PI, pitch); await wait(120);
          const f0 = O.ctx.engine.frameId; I.fire = true; while (O.ctx.engine.frameId < f0 + 3) await wait(4); I.fire = false; const hp = e.hp, alive = e.alive;   // 馬上讀，隔久了會算到隊友補的槍
          if (alive && hp < 100) out.lethal = { ...out.lethal, hit: true, pitch, hp, alive }; else if (!alive) out.lethal.dead = (out.lethal.dead || 0) + 1;   // 打到頭，換下一隻
          await wait(60 / w.rpm * 1000 + 80);
        }
        G.scoped = false; }
      for (const id of NEW) {
        const w = W[id]; hold(); O.giveWeapon(id); m.ammo[id] = w.mag; m.rsv[id] = w.rsv; O.sim(0.6);
        const a0 = m.ammo[id]; I.fire = true; O.sim(0.02); I.fire = false; O.sim(0.2); hold();
        const a1 = m.ammo[id]; O.sim(60 / w.rpm + 0.05); I.fire = true; O.sim(1.5); I.fire = false; hold();
        const a2 = m.ammo[id], fired = a1 - a2, autoOk = w.auto ? Math.abs(fired - Math.min(a1, Math.round(1.5 * w.rpm / 60))) <= 3 : fired >= 1;
        const rsv = m.rsv[id]; O.sim(0.3); press('reload'); const T = w.shell ? w.shell * (w.mag - a2 + 1) : w.reload; O.sim(T + 0.2); hold();
        out.g[id] = { a0, a1, a2, fired, autoOk, full: m.ammo[id], rsvUsed: rsv - m.rsv[id], mag: w.mag };
      }
      // 單發裝填：一次進一發、開火可以中斷
      { const id = 'x10', w = W[id]; hold(); O.giveWeapon(id); O.sim(0.6); m.ammo[id] = 3; m.rsv[id] = 20; press('reload');
        const a = [m.ammo[id]]; O.sim(w.shell + 0.02); a.push(m.ammo[id]); O.sim(w.shell + 0.02); a.push(m.ammo[id]);
        const reloading = m.reloadT > 0; I.fire = true; O.sim(0.03); I.fire = false; const shot = m.ammo[id]; O.sim(w.shell + 0.1); hold();
        out.shell = { a, reloading, shot, after: m.ammo[id] }; }
      // n9 打穿 100 發，後座表不能在第 31 發之後變 NaN
      { const id = 'n9', w = W[id]; hold(); O.giveWeapon(id); O.sim(0.6); m.ammo[id] = w.mag; I.fire = true; O.sim(9); I.fire = false; hold();
        out.n9 = { left: m.ammo[id], pitch: O.you.pitch, yaw: O.you.yaw }; }
      // bot 買槍：同步跑完整場，記錄每回合買了什麼
      O.fps(); const seen = {}; let n = 0, was = -1;
      while (G.phase !== 'over' && n++ < 800) { O.sim(5); if (G.round !== was) { was = G.round; for (const a of G.agents) if (a.bot && a.primary) seen[a.primary] = (seen[a.primary] || 0) + 1; } }
      out.bots = { seen, phase: G.phase }; await wait(600);
      return out;
    }, NEW);
    for (const id of NEW) { const x = r.g[id]; check(`新槍 ${id} 開火與換彈`, x.a1 < x.a0 && x.autoOk && x.full === x.mag && x.rsvUsed > 0, JSON.stringify(x)); }
    const S = r.shell; check('x10 一次裝一發、開火中斷', S.a[1] === S.a[0] + 1 && S.a[2] === S.a[1] + 1 && S.reloading && S.shot === S.a[2] - 1 && S.after === S.shot, JSON.stringify(S));
    check('n9 打穿 100 發、視角沒有壞', r.n9.left === 0 && Number.isFinite(r.n9.pitch) && Number.isFinite(r.n9.yaw), JSON.stringify(r.n9));
    check('s6 打身體不致命', r.lethal.max < 100 && r.lethal.headK >= 100 && r.lethal.hit && r.lethal.alive && r.lethal.hp > 0 && r.lethal.hp < 100, JSON.stringify(r.lethal));
    const bought = NEW.filter(id => r.bots.seen[id]); check('bot 會買新槍', r.bots.phase === 'over' && bought.length >= 3, JSON.stringify(r.bots));
    check('新槍流程無錯誤', !bad.length, bad[0] ?? '');
    await ctx.close();
  }

  if (want('follow')) {
    // 快照下第一人稱要跟著鏡頭：同一畫面藏槍前後相減，差異的重心要留在右下。矩陣寫錯緩衝時 CPU 端數值全對，只有畫面看得出來
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await p.goto(`${s.url}/web/278-ochre-line.html?clean=1`);
    await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 90000 });
    await p.evaluate(async () => { const O = __ol, G = O.G, w = ms => new Promise(f => setTimeout(f, ms)); O.startMatch({ side: 'def' }); O.setClean(true); G.time = 1; while (G.phase === 'buy') await w(50); G.time = 900; G.me.hp = 1e6; await w(700); });
    const shot = async () => (await p.screenshot()).toString('base64');
    const where = (a, c) => p.evaluate(async ([a, c]) => {
      const px = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const k = new OffscreenCanvas(i.width, i.height).getContext('2d'); k.drawImage(i, 0, 0); return k.getImageData(0, 0, i.width, i.height); };
      const A = await px(a), B = await px(c); let n = 0, sx = 0, sy = 0;
      for (let y = 0, o = 0; y < A.height; y++) for (let x = 0; x < A.width; x++, o += 4) if (Math.abs(A.data[o] - B.data[o]) + Math.abs(A.data[o + 1] - B.data[o + 1]) + Math.abs(A.data[o + 2] - B.data[o + 2]) > 40) { n++; sx += x; sy += y; }
      return { n, x: n ? sx / n / A.width : 0, y: n ? sy / n / A.height : 0 };
    }, [a, c]);
    const place = async (id, yaw, pitch) => {
      await p.evaluate(([id, yaw, pitch]) => { const O = __ol, y = O.you; O.G.time = 900; O.G.me.hp = 1e6; if (id === 'knife') O.select('knife'); else O.giveWeapon(id); y.yaw = yaw; y.pitch = pitch; }, [id, yaw, pitch]);
      await p.waitForTimeout(700); const a = await shot();
      await p.evaluate(() => __GAME_MCP__.vm.cur.holder.scaling.set(1e-5, 1e-5, -1e-5)); await p.waitForTimeout(150); const c = await shot();
      await p.evaluate(() => { const g = __GAME_MCP__.vm.cur; g.holder.scaling.copyFrom(g.scale); });
      return where(a, c);
    };
    const probe = async tag => {
      const y0 = await p.evaluate(() => __ol.you.yaw);
      for (const id of ['p9', 'ar5', 'knife', 'c7', 'm7', 'b90', 't4', 'x10', 's6', 'n9']) {
        // 同一把槍換三個朝向，畫面位置要一樣；留在世界裡的槍會跟著場景移動
        // 十把槍要跑三分鐘，bot 會走進畫面，相減時多出一大塊。錯緩衝是必然重現的，重量一次不會放過真的問題
        const once = async () => { const A = await place(id, y0, 0), B = await place(id, y0 + 0.7, 0.1), C = await place(id, y0 + 1.9, -0.15); return { n: [A.n, B.n, C.n], d: Math.max(Math.hypot(A.x - B.x, A.y - B.y), Math.hypot(A.x - C.x, A.y - C.y)) }; };
        const good = r => Math.min(...r.n) > 3000 && r.d < 0.05;
        let r = await once(); const retry = !good(r); if (retry) r = await once();
        check(`第一人稱跟著鏡頭（${tag} ${id}）`, good(r), JSON.stringify({ n: r.n, d: +r.d.toFixed(3), retry }));
      }
    };
    await probe('開局');
    await p.setViewportSize({ width: 1100, height: 700 }); await p.waitForTimeout(1500);   // 改尺寸會重錄快照
    await probe('改尺寸後');
    await p.close();
  }

  if (want('draws')) for (const [tag, q, limit] of [['WebGPU', '', DRAW_LIMIT[0]], ['WebGL', '&gfx=webgl', DRAW_LIMIT[1]]]) {
    // FAST 快照下所有武器都在場景裡（隱藏的也算 draw），換到哪把都不該多畫。bot 走動會讓數字跳動，取同一把的中位
    const { p, ctx, bad } = await open(PAGE + '?clean=1' + q, { width: 1280, height: 720 });
    const r = await p.evaluate(async ids => {
      const O = __ol, G = O.G, w = ms => new Promise(f => setTimeout(f, ms)), out = {}, med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
      O.startMatch({ side: 'def' }); O.setClean(true); G.time = 1; while (G.phase === 'buy') await w(50); G.me.hp = 1e6;
      for (const id of ids) { G.time = 900; O.giveWeapon(id); await w(500); const a = []; for (let i = 0; i < 5; i++) { const s0 = O.stats(); await w(160); const s1 = O.stats(); a.push(Math.round((s1.draws - s0.draws) / Math.max(1, s1.frame - s0.frame))); } out[id] = med(a); }
      return { out, snap: O.stats().webgpu };
    }, ['ar5', 'p9', 'c7', 'm7', 'b90', 't4', 'x10', 's6', 'n9']);
    const v = Object.values(r.out), mx = Math.max(...v);
    check(`FAST 下每把槍的 draw（${tag}）`, mx <= limit && mx - Math.min(...v) <= DRAW_SPREAD, JSON.stringify(r.out) + ` 上限 ${limit}`);
    check(`draw 量測無錯誤（${tag}）`, !bad.length, bad[0] ?? '');
    await ctx.close();
  }

  if (want('route')) {
    const { p, ctx } = await open(PAGE + '?clean=1', { width: 640, height: 360 });
    const r = await p.evaluate(() => { const sp = __ol.LAYOUT.spawns, o = {}; for (const [k, list] of [['atk', sp.atk], ['def', sp.def]]) for (const t of ['site-A', 'site-B']) { o[k + ' ' + t] = list.map(q => __ol.walk(q, t)); } return o; });
    for (const [k, v] of Object.entries(r)) {
      const [lo, hi] = k.startsWith('atk') ? [18, 24] : [9, 13], ts = v.map(x => x.t), stuck = v.find(x => !x.ok), mn = Math.min(...ts), mx = Math.max(...ts);
      check(`路線實走 ${k}`, !stuck && mn >= lo - 0.5 && mx <= hi + 0.5, `${mn.toFixed(1)}–${mx.toFixed(1)} s，目標 ${lo}–${hi}${stuck ? ' 卡住 ' + JSON.stringify(stuck) : ''}`);
    }
    await ctx.close();
  }

  if (want('gc')) {
    const { p, ctx, bad } = await (async () => {
      const ctxr = await b.newContext({ viewport: { width: 960, height: 540 } }), p = await ctxr.newPage(), bad = [];
      p.on('pageerror', e => bad.push(String(e).slice(0, 200)));
      await p.addInitScript(() => { window.__alloc = { on: false }; });
      await p.goto(s.url + '/web/__count.html?clean=1'); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 });
      return { p, ctx: ctxr, bad };
    })();
    await p.waitForTimeout(1500);
    const read = () => p.evaluate(() => { const { on, ...c } = window.__alloc; for (const k of Object.keys(window.__alloc)) if (k !== 'on') window.__alloc[k] = 0; window.__allocPrev = window.__allocStacks ?? []; window.__allocStacks = []; return c; });
    await p.evaluate(() => { __ol.startMatch({ side: 'atk' }); __ol.G.time = 0; }); await p.waitForTimeout(1200);
    await read();
    // 正向對照：計數器必須真的會數，否則 0 沒有意義
    const ctl = await p.evaluate(() => { window.__alloc.on = true; const v = __ol.ctx.camera.position.clone(), m = __ol.ctx.camera.getViewMatrix().clone(); window.__alloc.on = false; const { on, ...c } = window.__alloc; for (const k of Object.keys(c)) window.__alloc[k] = 0; return [c, !!v && !!m]; });
    check('零配置計數器對照', (ctl[0].Vector3 ?? 0) >= 1 && (ctl[0].Matrix ?? 0) >= 1, JSON.stringify(ctl[0]));
    await p.waitForTimeout(10000);
    const quiet = await read();
    await p.evaluate(() => { __ol.fire(40); }); await p.waitForTimeout(12000);
    const fight = await read();
    const sum = o => Object.values(o).reduce((a, x) => a + x, 0);
    note('零配置 10 s 行走交火（onBeforeRender 內建構子次數）', JSON.stringify(quiet));
    note('零配置 12 s 含玩家開火', JSON.stringify(fight));
    const stacks = await p.evaluate(() => (window.__allocPrev ?? []).slice(0, 6)); for (const x of stacks) note('配置來源', x.replace(/http:\/\/[^ ]*?:(\d+:\d+)/g, '$1'));
    check('零配置 onBeforeRender', sum(quiet) === 0 && sum(fight) === 0, `${sum(quiet)} / ${sum(fight)}`);
    if (bad.length) note('零配置頁面錯誤', bad[0]);
    await ctx.close();
  }

  if (want('snap')) {
    const measure = async q => { const { p, ctx } = await open(PAGE + '?clean=1&spot=key' + q, { width: 1440, height: 900 }); await p.waitForTimeout(2500); const r = await p.evaluate(() => __ol.cpu(240)); await ctx.close(); return r; };
    const on = [], off = [];
    for (let i = 0; i < 3; i++) { on.push(await measure('')); off.push(await measure('&nosnap=1')); }
    const med = a => a.map(x => x.median).sort((x, y) => x - y)[1], A = med(on), B = med(off);
    note('快照 CPU（每幀 scene.render + endFrame 主執行緒，3 次交錯取中位）', `FAST 開 ${A.toFixed(2)} ms；關 ${B.toFixed(2)} ms；降低 ${((1 - A / B) * 100).toFixed(1)}%`);
    out.snapshot = { on: A, off: B, reduction: 1 - A / B };
  }
} finally {
  await b.close(); await s.close();
  writeFileSync(resolve(GAME_DIR, `dist/accept${tag0}.json`), JSON.stringify(out, null, 1));
}
console.log(out.fails.length ? `\n未通過 ${out.fails.length} 項：${out.fails.join('、')}` : '\n全部通過');
process.exitCode = out.fails.length ? 1 : 0;
