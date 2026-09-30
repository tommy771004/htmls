// 驗收測試：無頭 Chrome 開打包好的單檔，檢查 SPEC §9 與網站規則。先 npm run build。
// 用法：node tools/playtest.mjs [html=../../web/195-sidewinder.html] [--swiftshader] [--json] [--cap=600]
// 1. 1440×900 與 390×844：沒有 pageerror／console.error、除了單檔本身與 data:／blob: 沒有任何請求、有 viewport meta、沒有水平溢出、__sw 存在。
// 2. 玩家交給 AI 跑完 2 圈：全部完賽或在領先者完賽 20 秒後收尾、名次是 1..4 的排列、結算後玩家有獎金。
// 3. 車庫買引擎會改變等級與金錢；旋轉方向盤 feed(+40) 後 poll 的 steer > 0；音效掛點 API 齊全；四條賽道各跑 10 秒沒有 NaN；同 seed 可重現。
// 結束碼 0 = 全部通過。
import { statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, toUrl, waitReady, watch } from './shot.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const html = args.find((a) => !a.startsWith('--')) || resolve(root, '../../web/195-sidewinder.html');
const CAP = +opt('cap', 600); // 一場最多快轉的模擬秒數
const url = toUrl(html);

const results = [];
function check(group, name, ok, detail = '') {
  results.push({ group, name, ok: !!ok, detail: String(detail) });
}
const T = 16, TS = 32; // 狀態陣列：卡車從 16 開始，每台 32 格
const truck = (s, k) => {
  const o = T + TS * k;
  return { x: s[o], z: s[o + 2], speed: s[o + 6], laps: s[o + 13], prog: s[o + 14], pos: s[o + 15], fin: s[o + 20], finT: s[o + 21], best: s[o + 22], money: s[o + 24], ai: s[o + 28] };
};
const hasNaN = (s) => s.some((v) => !Number.isFinite(v));

let size = '?';
try {
  size = (statSync(html.split(/[?#]/)[0]).size / 1024 / 1024).toFixed(2) + ' MB';
} catch {}

const browser = await launch();
try {
  // ---- 1. 兩種尺寸的網站規則 ----
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const g = `${w}×${h}`;
    const mobile = w < 600;
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
    const log = watch(page, url);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    let ready = true;
    try {
      await waitReady(page);
    } catch {
      ready = false;
    }
    await new Promise((r) => setTimeout(r, 2000)); // 讓示範賽跑一下
    const info = await page.evaluate(() => ({
      viewport: !!document.querySelector('meta[name="viewport"]'),
      title: document.title,
      sw: typeof window.__sw === 'object' && window.__sw !== null,
      sidewinder: !!(window.Sidewinder && window.Sidewinder.audio),
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      canvas: document.querySelectorAll('canvas').length,
    }));
    check(g, '__sw 就緒', ready && info.sw, ready ? '' : '30 秒內 window.__sw 沒有就緒');
    check(g, 'viewport meta', info.viewport);
    check(g, '<title>', !!info.title, info.title);
    check(g, '沒有水平溢出', info.scrollW <= info.innerW, `scrollWidth ${info.scrollW} / innerWidth ${info.innerW}`);
    check(g, '有 canvas', info.canvas > 0, `${info.canvas} 個`);
    // 觸發一次比賽畫面再收錯誤（開局、HUD 也要乾淨）
    if (ready) {
      await page.evaluate(async () => {
        await window.__sw.startRace(0, { seed: 7, laps: 2, playerAI: true });
        if (window.__sw.fastForward) await window.__sw.fastForward(5);
      }).catch((e) => log.errors.push('startRace: ' + e.message));
      await new Promise((r) => setTimeout(r, 800));
      const ow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(g, '比賽中沒有水平溢出', ow <= 0, `多出 ${ow}px`);
    }
    check(g, '沒有錯誤', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
    check(g, '沒有外部請求', log.external.length === 0, log.external.slice(0, 3).join(' | '));
    await page.close();
  }

  // ---- 2. 玩法 ----
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const log = watch(page, url);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await waitReady(page).catch(() => {});
  // SPEC 的 176 格狀態陣列：__sw.state() 若回傳摘要物件，就改讀 __sw.core.state()
  await page.evaluate(() => {
    window.__ptRaw = () => {
      const sw = window.__sw, v = sw.state();
      return Array.from(v && typeof v.length === 'number' ? v : sw.core.state());
    };
  }).catch(() => {});
  const api = await page.evaluate(() => {
    const sw = window.__sw || {};
    return ['state', 'startRace', 'fastForward', 'buy', 'career'].filter((k) => typeof sw[k] !== 'function').concat(sw.input ? [] : ['input'], sw.audio ? [] : ['audio']);
  });
  check('API', '__sw 介面齊全', api.length === 0, api.length ? `缺少 ${api.join(', ')}` : 'state startRace fastForward buy career input audio');

  // 讀 career 的金錢與升級等級，欄位名稱容許幾種寫法
  const readCareer = () =>
    page.evaluate(() => {
      const c = window.__sw.career ? window.__sw.career() : null;
      if (!c) return null;
      const up = c.upgrades || c.levels || c;
      return { money: c.money ?? c.cash ?? c.bank, engine: up.engine, tires: up.tires, shocks: up.shocks, nitro: up.nitro, raw: JSON.stringify(c).slice(0, 200) };
    });

  if (!api.includes('startRace') && !api.includes('fastForward') && !api.includes('state')) {
    const before = await readCareer().catch(() => null);
    // 2 圈比賽，玩家由 AI 代駕
    const race = await page.evaluate(async (cap) => {
      const sw = window.__sw;
      await sw.startRace(0, { laps: 2, seed: 7, playerAI: true, mode: 'tour' });
      let t = 0, s = window.__ptRaw(), phases = [s[0]];
      while (t < cap && s[0] !== 3) {
        await sw.fastForward(10);
        t += 10;
        s = window.__ptRaw();
        if (phases[phases.length - 1] !== s[0]) phases.push(s[0]);
      }
      return { t, s, phases };
    }, CAP);
    const s = race.s;
    const trucks = [0, 1, 2, 3].map((k) => truck(s, k));
    check('比賽', '進入結束階段（phase 3）', s[0] === 3, `快轉 ${race.t} s，phase 變化 ${race.phases.join('→')}，比賽時間 ${s[1].toFixed(1)} s`);
    check('比賽', '狀態沒有 NaN', !hasNaN(s));
    check('比賽', '圈數設定為 2', s[3] === 2, `總圈數 ${s[3]}`);
    const pos = trucks.map((t) => t.pos);
    check('比賽', '名次是 1..4 的排列', [...pos].sort().join() === '1,2,3,4', pos.join(' '));
    const finT = trucks.filter((t) => t.fin === 1).map((t) => t.finT);
    const lead = finT.length ? Math.min(...finT) : NaN;
    const okEnd = trucks.every((t) => (t.fin === 1 && t.finT > 0 && t.laps >= 2) || (t.fin !== 1 && s[1] >= lead + 19.5));
    check('比賽', '全部完賽或在領先者 +20 s 收尾', okEnd && finT.length > 0,
      trucks.map((t, k) => `#${k} ${t.fin === 1 ? t.finT.toFixed(1) + 's' : `未完 ${t.laps}+${t.prog.toFixed(2)}`}`).join(', '));
    check('比賽', '完賽名次與時間一致', finT.length < 2 || trucks.filter((t) => t.fin === 1).sort((a, b) => a.finT - b.finT).every((t, i) => t.pos === i + 1),
      trucks.map((t) => `P${t.pos}`).join(' '));
    check('比賽', '有最佳單圈', trucks.some((t) => t.best > 0), trucks.map((t) => t.best.toFixed(1)).join(' '));
    check('比賽', '玩家名次（表頭）', s[6] >= 1 && s[6] <= 4, `P${s[6]}`);

    // 結算後玩家拿到獎金（app 可能在畫面切換時才入帳，最多等 5 秒）
    let after = null;
    for (let i = 0; i < 25; i++) {
      await page.evaluate(() => window.__sw.fastForward && window.__sw.fastForward(0.2));
      after = await readCareer().catch(() => null);
      if (after && before && after.money > before.money) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    check('車庫', '結算後獎金入帳', after && before && after.money > before.money && after.money > 0,
      after ? `$${before?.money} → $${after.money}` : `career() 讀不到（${before?.raw ?? ''}）`);

    // 買引擎；錢不夠（例如第 4 名）就再跑幾場短賽累積獎金
    const tryBuy = () =>
      page.evaluate(() => {
        const r = window.__sw.buy('engine');
        return r && typeof r.then === 'function' ? r.then((x) => String(x)) : String(r);
      }).catch((e) => 'error: ' + e.message);
    let pre = after, buy = await tryBuy(), bought = await readCareer().catch(() => null), extra = 0;
    while (pre && bought && bought.engine === pre.engine && extra < 4) {
      extra++;
      await page.evaluate(async (cap, n) => {
        const sw = window.__sw;
        await sw.startRace(n % 4, { laps: 1, seed: 100 + n, playerAI: true, mode: 'tour' });
        for (let t = 0; t < cap && window.__ptRaw()[0] !== 3; t += 10) await sw.fastForward(10);
        await sw.fastForward(1);
      }, CAP, extra).catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
      pre = await readCareer().catch(() => null);
      buy = await tryBuy();
      bought = await readCareer().catch(() => null);
    }
    const note = extra ? `，另跑 ${extra} 場累積獎金` : '';
    check('車庫', "buy('engine') 提升引擎等級", bought && pre && bought.engine === pre.engine + 1, `${pre?.engine} → ${bought?.engine}（回傳 ${buy}${note}）`);
    check('車庫', "buy('engine') 扣錢", bought && pre && bought.money < pre.money, `$${pre?.money} → $${bought?.money}`);
    check('車庫', '其他升級不受影響', bought && pre && bought.tires === pre.tires && bought.shocks === pre.shocks && bought.nitro === pre.nitro);
    const stat = await page.evaluate(() => {
      const c = window.__sw.core;
      return c && typeof c.upgradeStat === 'function' ? [c.upgradeStat(1, 0), c.upgradeStat(1, 1)] : null;
    }).catch(() => null);
    if (stat) check('車庫', '引擎升級提高極速（core.upgradeStat）', stat[1] > stat[0], `${stat[0].toFixed(1)} → ${stat[1].toFixed(1)} m/s`);
  }

  // 旋轉方向盤：速率模式 feed(+40) 後立刻 poll，steer 要向右
  const spin = await page.evaluate(() => {
    const inp = window.__sw.input;
    if (!inp || !inp.spinner) return { err: '沒有 __sw.input.spinner' };
    const prev = typeof inp.settings === 'function' ? inp.settings() : null;
    const keep = { ...inp.spinner.settings };
    // 設定可能走 setSettings（spinnerMode／spinnerInvert）或直接改 spinner.settings，兩種都做
    const set = (mode, invert) => {
      if (typeof inp.setSettings === 'function') inp.setSettings({ spinnerMode: mode, spinnerInvert: invert });
      try {
        Object.assign(inp.spinner.settings, { mode, invert });
      } catch {}
    };
    const rest = () => {
      for (let i = 0; i < 120; i++) inp.poll(1 / 60); // 讓轉向回中
    };
    set('rate', false);
    rest();
    inp.spinner.feed(40);
    const r = inp.poll(1 / 60);
    const src = inp.source();
    rest();
    inp.spinner.feed(-40);
    const l = inp.poll(1 / 60);
    rest();
    set('rate', true);
    inp.spinner.feed(40);
    const inv = inp.poll(1 / 60);
    rest();
    if (prev && typeof inp.setSettings === 'function') inp.setSettings(prev);
    try {
      Object.assign(inp.spinner.settings, keep);
    } catch {}
    return { right: r.steer, left: l.steer, inv: inv.steer, src, finite: [r, l, inv].every((p) => ['steer', 'throttle', 'brake'].every((k) => Number.isFinite(+p[k]))) };
  }).catch((e) => ({ err: e.message }));
  check('輸入', 'spinner feed(+40) → steer > 0', !spin.err && spin.right > 0, spin.err || `steer ${spin.right?.toFixed(3)}，source ${spin.src}`);
  check('輸入', 'spinner feed(−40) → steer < 0', !spin.err && spin.left < 0, spin.err || `steer ${spin.left?.toFixed(3)}`);
  check('輸入', 'spinner 反向設定生效', !spin.err && spin.inv < 0, spin.err || `steer ${spin.inv?.toFixed(3)}`);
  check('輸入', 'poll() 數值有限', !spin.err && spin.finite);

  // 音效掛點
  const audio = await page.evaluate(() => {
    const a = window.Sidewinder && window.Sidewinder.audio;
    if (!a) return { err: '沒有 window.Sidewinder.audio' };
    const need = ['on', 'off', 'registerSfx', 'setMusic', 'setVolume', 'getVolume', 'mute'];
    const miss = need.filter((k) => typeof a[k] !== 'function');
    let heard = 0;
    try {
      const fn = () => heard++;
      a.on('ui_move', fn);
      a.off('ui_move', fn);
      a.registerSfx('landing_test', () => {});
      a.setVolume('music', 0.5);
      const v = a.getVolume('music');
      const okMusic = a.setMusic('race', null) !== false && a.setMusic('race', 'default') !== false;
      a.registerSfx('landing_test', null);
      return { miss, v, okMusic, same: window.__sw.audio === a || window.__sw.audio?.api === a };
    } catch (e) {
      return { miss, err: e.message };
    }
  }).catch((e) => ({ err: e.message }));
  check('音效', 'Sidewinder.audio 方法齊全', !audio.err && audio.miss.length === 0, audio.err || (audio.miss.length ? `缺少 ${audio.miss.join(', ')}` : 'on off registerSfx setMusic setVolume getVolume mute'));
  check('音效', 'setVolume／getVolume 往返', !audio.err && Math.abs(audio.v - 0.5) < 1e-6, audio.err || `getVolume ${audio.v}`);
  check('音效', "setMusic(null／'default') 接受", !audio.err && audio.okMusic, '');
  check('音效', '__sw.audio 指向同一組掛點', !audio.err && audio.same, '');

  // 四條賽道各跑 10 秒（3 秒倒數後）：每 0.5 秒取樣位置累計行駛距離（迴圈賽道看淨位移不準）
  for (let t = 0; t < 4; t++) {
    const r = await page.evaluate(async (t) => {
      const sw = window.__sw;
      await sw.startRace(t, { seed: 11 + t, playerAI: true });
      await sw.fastForward(3);
      const pos = (s) => [0, 1, 2, 3].map((k) => [s[16 + 32 * k], s[18 + 32 * k]]);
      let s = window.__ptRaw(), p = pos(s), dist = [0, 0, 0, 0], nan = false;
      for (let i = 0; i < 20; i++) {
        await sw.fastForward(0.5);
        s = window.__ptRaw();
        if (s.some((v) => !Number.isFinite(v))) nan = true;
        const q = pos(s);
        q.forEach(([x, z], k) => (dist[k] += Math.hypot(x - p[k][0], z - p[k][1])));
        p = q;
      }
      return { s, dist, nan };
    }, t).catch((e) => ({ err: e.message }));
    if (r.err) {
      check('賽道', `賽道 ${t} 跑 10 秒`, false, r.err);
      continue;
    }
    const ok = !r.nan && r.s[7] === t && r.s[0] === 2 && r.dist.every((d) => d > 40);
    check('賽道', `賽道 ${t} 跑 10 秒`, ok, `phase ${r.s[0]}、track_id ${r.s[7]}、行駛 ${r.dist.map((d) => d.toFixed(0)).join('/')} m${r.nan ? '、有 NaN' : ''}`);
  }

  // 決定性：同 seed、同輸入（全 AI）跑 20 秒要逐位元相同
  const det = await page.evaluate(async () => {
    const sw = window.__sw;
    const run = async () => {
      await sw.startRace(2, { seed: 1234, playerAI: true });
      await sw.fastForward(20);
      return window.__ptRaw();
    };
    const a = await run(), b = await run();
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) diff++;
    return diff;
  }).catch((e) => 'error: ' + e.message);
  check('比賽', '同 seed 可重現', det === 0, typeof det === 'number' ? `${det} 格不同` : det);

  check('玩法頁', '沒有錯誤', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  check('玩法頁', '沒有外部請求', log.external.length === 0, log.external.slice(0, 3).join(' | '));
  await page.close();
} catch (e) {
  check('執行', '測試腳本本身', false, e.message.split('\n')[0]);
} finally {
  await browser.close();
}

// ---- 報表 ----
// 中日韓全形字算 2 欄寬，表格才對得齊
const cols = (s) => [...s].reduce((n, c) => n + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(c) ? 2 : 1), 0);
const pad = (s, w) => s + ' '.repeat(Math.max(0, w - cols(s)));
const wG = Math.max(...results.map((r) => cols(r.group))) + 2;
const wN = Math.max(...results.map((r) => cols(r.name))) + 2;
console.log(`${html}（${size}）\n`);
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${pad(r.group, wG)}${pad(r.name, wN)}${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 通過`);
if (args.includes('--json')) console.log(JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
