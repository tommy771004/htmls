// 觀測模型：自動跑一組情境（街上、戰鬥、跟車、高處、白天、室內），每個情境：
//   1. 實際跑（LIVE 秒）：每幀幀時、CPU 邏輯／送出、draw call、卡頓與成因（新編管線記材質與渲染目標）、CPU 剖析（自身時間前幾名）
//   2. 一幀拆解（__nc.perf.sample）：每一趟的 draw、依材質分組、白畫的 draw 分類、可以實例化的、實例只有幾成在畫面裡的
//   3. 凍結畫面拆解（__nc.perf.frozen）：暫停後輪流關掉一項（畫面設定、或藏起某個材質群組），交錯量每幀的吞吐（連畫 8 幀等顯示卡做完再平均）與 CPU 送出，
//      得到每一項的成本（頭尾各量一次原狀，兩次的差就是雜訊）
// 結果寫進 .cache/observe/<建置雜湊>/：每個情境一份 JSON（跑完一個寫一個，中途掛掉也留得下來）與排好名次的 report.md。
//   node tools/observe.mjs
//   ONLY=street,battle  LIVE=15  ROUNDS=6  HTML=web/260-neon-nightcity.html  NOABL=1（不做凍結拆解）  NOPROF=1（不錄 CPU 剖析）
// 數字的用法：實際跑的數字每場飄 ±50%（同一建置 A/A 量過），只拿來排名與找卡頓成因，不拿來證明修改有效；
// 修改的效果用 tools/battle.mjs 的 HTMLS 同頁交錯 A/B，畫面不變與否用 tools/lossless.mjs 的凍結畫面逐像素比對
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromePath, GPU_ARGS } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(root, '../..');
const HTML = process.env.HTML || 'web/260-neon-nightcity.html', LIVE = +(process.env.LIVE || 15), ROUNDS = +(process.env.ROUNDS || 6);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const hash = createHash('sha1').update(readFileSync(resolve(repo, HTML))).digest('hex').slice(0, 10);
const OUT = process.env.OUT || resolve(root, '.cache/observe', hash); mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: [...GPU_ARGS, '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
const log = { errors: [], pageerrors: [] };
page.on('pageerror', e => log.pageerrors.push(String(e.message || e) + ' @ ' + String(e.stack || '').split('\n').slice(1, 5).join(' | ')));
page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text().slice(0, 300)); });
// civ 照預設（路人、車流都在：玩家平常看到的就是這樣），story=0 不跑主線過場
await page.goto(`http://127.0.0.1:${srv.address().port}/${HTML}?perf=1&gpu=${process.env.GPU || 'high'}&story=0${process.env.Q || ''}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 300000, polling: 300 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const env = await ev(() => { const N = __nc; N.start(); N.menu.set('fps', 0); N.menu.set('pauseBlur', false); N.menu.set('grain', false);
  return { gpu: N.gpu.short, tier: N.menu.SET.gpu, rt: N.menu.rt(), ua: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] }; });
console.log('build', hash, JSON.stringify(env));
await new Promise(r => setTimeout(r, 4000));

// 新建的 render pipeline（= 新編著色器）記是誰：材質、物件、渲染目標（tools/battle.mjs 的卡頓只知道數量）
await ev(() => {
  const N = __nc, R = N.renderer, P = R._pipelines, g0 = P.getForRender.bind(P);
  window.__obsPipe = [];
  const top = o => { const a = []; while (o && o !== N.scene && a.length < 3) { a.push(o.name || o.type); o = o.parent; } return a.join('<'); };
  P.getForRender = function (ro, pr) {
    const n0 = P.caches.size, r = g0(ro, pr);
    if (P.caches.size > n0) { const m = ro.material, rt = R.getRenderTarget(); window.__obsPipe.push({ t: +(performance.now() / 1000).toFixed(1), mat: m.name || m.type, obj: top(ro.object), rt: rt ? `${rt.width}x${rt.height}s${rt.samples}` : 'canvas' }); }
    return r;
  };
});

// ─── 情境：setup 傳送與設定時間天氣（回傳鏡頭動作要用的參數），act 是實際跑時的鏡頭與事件 ───
const node = i => `const nodes = N.roads.nodes.filter(n => n.out.length >= 3 && !n.out.some(o => o.e.kind === 'f')), nd = nodes[${i} % nodes.length];`;
const SCEN = [
  { id: 'street', name: '雨夜街口（路人、車流）', setup: `${node(260)} N.time(1320); N.weather('rain'); N.tp(nd.x, nd.z, .7); return { x: nd.x, z: nd.z };`, act: 'orbit', r: 9, h: 2.2 },
  { id: 'battle', name: '雨夜槍戰＋三星警察', setup: `${node(40)} N.time(1320); N.weather('rain'); N.tp(nd.x, nd.z, 1.1); return { x: nd.x, z: nd.z, a: 1.1 };`, act: 'battle', stars: 3 },
  { id: 'battle5', name: '雨夜五星＋爆炸', setup: `${node(777)} N.time(1320); N.weather('rain'); N.tp(nd.x, nd.z, 2.3); return { x: nd.x, z: nd.z, a: 2.3 };`, act: 'battle', stars: 5, boom: true },
  { id: 'follow', name: '晴夜跟著車流開', setup: `${node(500)} N.time(1290); N.weather('clear'); N.tp(nd.x, nd.z, 0); return { x: nd.x, z: nd.z };`, act: 'follow' },
  { id: 'high', name: '高處俯瞰市中心', setup: `${node(120)} N.time(1320); N.weather('rain'); N.tp(nd.x, nd.z, 0); return { x: nd.x, z: nd.z };`, act: 'orbit', r: 160, h: 140 },
  { id: 'day', name: '白天街道', setup: `${node(333)} N.time(780); N.weather('clear'); N.tp(nd.x, nd.z, .3); return { x: nd.x, z: nd.z };`, act: 'orbit', r: 10, h: 2 },
  { id: 'casino', name: '賭場大廳（室內）', setup: `N.time(1320); N.enter('casino'); return { x: N.player.x, z: N.player.z, inside: 1 };`, act: 'still' },
];

// 凍結拆解要關的東西：畫面設定（值是關掉或降低時的值），以及一幀拆解裡主畫面 draw 最多的幾個材質群組
const ABL = [['ssr', 0, '螢幕空間倒影 → 平面'], ['refl', 0, '倒影整個關掉'], ['bloom', 0, '泛光'], ['ao', 0, '環境光遮蔽'], ['vol', 0, '體積光'], ['blur', 0, '動態模糊'],
  ['rainFx', false, '雨滴特效'], ['ca', false, '色差'], ['eye', false, '眼睛適應'], ['fac', 0, '立面細模'], ['tex', 0, '照片材質'], ['msaa', 0, 'MSAA'], ['res', .5, '解析度一半（看是不是填充率）'], ['dist', .6, '細節距離最近']];

let prof = null;
const results = [];
for (const S of SCEN) {
  if (ONLY && !ONLY.includes(S.id)) continue;
  const t0 = Date.now();
  // 傳送、等平靜（沒有下載、沒有分幀載入、2 秒內沒有新編著色器或卡頓，最多 12 秒）
  const P = await ev(async ({ setup }) => {
    const N = __nc, G = N.gta; N.menu.close(); G.squad.clear(); G.wanted.clear('reset'); G.god.on = true; N.camAt();
    if (N.player.where !== 'out') N.tp(N.player.x, N.player.z);
    const p = await (new Function('N', setup))(N);
    const PF = N.perf.PF, t0 = performance.now(); let calm = t0, k = PF.n;
    while (performance.now() - t0 < 12000) {
      await new Promise(r => setTimeout(r, 200));
      const fr = PF.ring.slice(-Math.min(PF.n - k, 900)); k = PF.n;
      if (N.perf.busy() || fr.some(f => f.dp || f.stall)) calm = performance.now();
      if (performance.now() - calm > 2000) break;
    }
    p.y = N.player.y || 0; p.settle = Math.round(performance.now() - t0); return p;
  }, { setup: S.setup });
  await ev(() => { window.__obsPipe.length = 0; });
  if (!process.env.NOPROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start'); }
  // 實際跑：鏡頭動作在 rAF 裡每幀擺（loop 的相機吃 camState.over），跑到一半做一幀拆解
  const live = await ev(async ({ S, P, LIVE }) => {
    const N = __nc, G = N.gta, PF = N.perf.PF, k0 = PF.n, s0 = PF.nst;
    let run = true, ang = (P.a || 0) + 2.3, last = performance.now(), fol = null, nb = 0;
    if (S.act === 'battle') {
      const fx = Math.sin(P.a), fz = Math.cos(P.a), sx = fz, sz = -fx, guns = ['smg', 'rifle', 'pistol', 'shotgun'];
      for (let j = 0; j < 7; j++) { const o = (j - 3) * 2.6; G.squad.spawn('gang', P.x + fx * 20 + sx * o, P.z + fz * 20 + sz * o, guns[j % 4]); }
      for (let j = 0; j < 6; j++) { const o = (j - 2.5) * 2.4; G.squad.spawn('merc', P.x - fx * 8 + sx * o, P.z - fz * 8 + sz * o, j % 2 ? 'rifle' : 'smg'); }
      G.wanted.set(S.stars); P.cx = P.x + fx * 6; P.cz = P.z + fz * 6;
    }
    if (S.act === 'follow') fol = N.traffic.filter(c => Number.isFinite(c.x) && c.e).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    const cam = () => {
      if (!run) return; const t = performance.now(), dt = (t - last) / 1000; last = t;
      if (S.act === 'orbit') { ang += dt * (S.r > 50 ? .05 : .15); N.camAt(P.x + Math.sin(ang) * S.r, P.y + S.h, P.z + Math.cos(ang) * S.r, P.x, P.y + (S.r > 50 ? 0 : 1.2), P.z); }
      if (S.act === 'battle') { ang += dt * .2; N.camAt(P.cx + Math.sin(ang) * 26, P.y + 10, P.cz + Math.cos(ang) * 26, P.cx, P.y + 1.2, P.cz); }
      if (S.act === 'follow' && fol) { const a = fol.yaw + Math.PI; N.camAt(fol.x + Math.sin(a) * 7, P.y + 2.4, fol.z + Math.cos(a) * 7, fol.x, P.y + 1, fol.z); }
      requestAnimationFrame(cam);
    };
    cam();
    const t0 = performance.now(); let sample = null;
    while (performance.now() - t0 < LIVE * 1000) {
      await new Promise(r => setTimeout(r, 250));
      const t = (performance.now() - t0) / 1000;
      if (S.boom && t > nb * 1.6 + 2 && nb < 10) { nb++; const tg = G.squad.SQ.f.filter(f => f.on && f.state === 'act' && f.team === 'gang'); const p = tg.length ? tg[nb % tg.length] : { x: P.cx, z: P.cz }; G.blast(p.x + (Math.random() - .5) * 4, P.y + .5, p.z + (Math.random() - .5) * 4, 7, 120, 'npc'); }
      if (!sample && t > LIVE / 2) sample = await N.perf.sample();
    }
    run = false;
    const fr = PF.ring.slice(-Math.min(PF.n - k0, 900));
    const stalls = PF.stalls.filter(s => s.k > s0).map(s => ({ at: s.at, ms: +s.ms.toFixed(1), cpu: +s.cpu.toFixed(1), sub: +s.sub.toFixed(1), dp: s.dp, dt: s.dt, dg: s.dg, tags: s.tags }));
    const F = fr.map(f => [+f.ms.toFixed(2), +f.cpu.toFixed(2), +f.sub.toFixed(2), f.calls, f.tris]);
    const mem = { tex: N.renderer.info.memory.textures, geo: N.renderer.info.memory.geometries, pipes: N.renderer._pipelines.caches.size, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
    return { F, stalls, sample, mem, pipes: window.__obsPipe.splice(0), units: S.act === 'battle' ? G.squad.count('gang') + G.squad.count('merc') : null };
  }, { S, P, LIVE });
  let top = null;
  if (!process.env.NOPROF) {
    const { profile } = await cdp.send('Profiler.stop');
    const byId = new Map(profile.nodes.map(n => [n.id, n])), us = new Map();
    profile.samples.forEach((id, k) => { const n = byId.get(id), key = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber}`; us.set(key, (us.get(key) || 0) + (profile.timeDeltas[k] || 0)); });
    const fr = live.F.length || 1;
    top = [...us].filter(([k]) => !/^\((idle|program|root)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, +(v / 1000 / fr).toFixed(3)]);
    prof ||= new Map(); for (const [k, v] of top) prof.set(k, (prof.get(k) || 0) + v);
  }
  // 凍結拆解：暫停在這一幀（選單藏起來），每種設定交錯量 ROUNDS 輪
  let abl = null;
  if (!process.env.NOABL) {
    const groups = (live.sample?.find(p => p.nm === 'main')?.top || []).filter(([, d]) => d >= 15).slice(0, 6).map(([m]) => m);
    abl = await ev(async ({ ABL, groups, ROUNDS }) => {
      const N = __nc, SET = N.menu.SET; N.menu.open(); document.getElementById('menu').style.visibility = 'hidden';
      const keys = ABL.map(a => a[0]), S0 = Object.fromEntries(keys.map(k => [k, SET[k]])), hid = [];
      const reset = () => { for (const k of keys) if (SET[k] !== S0[k]) N.menu.set(k, S0[k]); for (const o of hid.splice(0)) o.visible = true; };
      const hide = name => { N.scene.traverse(o => { const m = o.material; if (o.visible && m && !Array.isArray(m) && (m.name || m.type) === name) { o.visible = false; hid.push(o); } }); };
      const items = [['base', '原狀', () => reset()],
        ...ABL.filter(([k, v]) => S0[k] !== v).map(([k, v, d]) => [`set:${k}=${v}`, d, () => { reset(); N.menu.set(k, v); }]),
        ...groups.map(g => [`hide:${g}`, `藏起材質 ${g}`, () => { reset(); hide(g); }]),
        ['base2', '原狀（再量一次，和第一次的差是雜訊）', () => reset()]];
      try {
        const r = await N.perf.frozen(ROUNDS, items.map(i => i[2]));
        return items.map((it, j) => ({ key: it[0], what: it[1], ...r[j] }));
      } finally { reset(); document.getElementById('menu').style.visibility = ''; N.menu.close(); }
    }, { ABL, groups, ROUNDS });
  }
  await ev(() => { const N = __nc; N.gta.squad.clear(); N.gta.wanted.clear('reset'); N.camAt(); });
  const F = live.F, ms = F.map(f => f[0]).sort((a, b) => a - b), q = p => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] || 0, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const r = { id: S.id, name: S.name, build: hash, env, settle: P.settle, secs: LIVE, frames: F.length, fps: F.length / LIVE, med: q(.5), p99: q(.99), max: ms.at(-1) || 0,
    cpu: avg(F.map(f => f[1])), sub: avg(F.map(f => f[2])), calls: avg(F.map(f => f[3])), tris: avg(F.map(f => f[4])), abs50: F.filter(f => f[0] > 50).length / LIVE * 10,
    stalls: live.stalls, pipes: live.pipes, mem: live.mem, sample: live.sample, prof: top, abl, units: live.units, wall: Math.round((Date.now() - t0) / 1000) };
  writeFileSync(resolve(OUT, S.id + '.json'), JSON.stringify(r));
  results.push(r);
  console.log(`${S.id} ${r.fps.toFixed(0)} fps p99 ${r.p99} 邏輯 ${r.cpu.toFixed(1)} 送出 ${r.sub.toFixed(1)} draw ${r.calls.toFixed(0)} 卡頓 ${r.stalls.length} 新管線 ${r.pipes.length}（${r.wall} s）`);
}

// ─── 報告 ───
const f1 = v => v == null || Number.isNaN(v) ? '—' : (+v).toFixed(1), L = [];
L.push(`# 260 觀測報告 ${hash}`, '', `建置 \`${HTML}\`（sha1 ${hash}）、${env.gpu}、${env.ua}、等級 ${env.tier}、內部 ${env.rt.w}×${env.rt.h} MSAA ${env.rt.samples}；每情境實際跑 ${LIVE} 秒，凍結拆解 ${ROUNDS} 輪`, '',
  '實際跑的數字每場飄 ±50%，只看排名與成因；凍結拆解的「整幀」是暫停時同一幀連畫 8 幀、等顯示卡做完的平均（CPU 送出與顯示卡重疊，取兩者中慢的；兩次原狀的差是雜訊）。整幀和送出差不多就是卡在 CPU 送出 draw call。', '');
L.push('## 各情境', '', '| 情境 | fps | 幀中位 ms | p99 | 最長 | CPU 邏輯 | 送出 | draw | 三角形 M | >50 ms /10 s | 卡頓 | 新管線 |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) L.push(`| ${r.name} | ${f1(r.fps)} | ${f1(r.med)} | ${f1(r.p99)} | ${f1(r.max)} | ${f1(r.cpu)} | ${f1(r.sub)} | ${Math.round(r.calls)} | ${(r.tris / 1e6).toFixed(2)} | ${f1(r.abs50)} | ${r.stalls.length} | ${r.pipes.length} |`);
L.push('', '## 凍結拆解：關掉一項省多少（每幀 ms，負的是變慢）', '');
for (const r of results) {
  if (!r.abl) continue;
  const b = r.abl[0], b2 = r.abl.at(-1), noise = Math.abs((b.gpu ?? 0) - (b2.gpu ?? 0)), base = ((b.gpu ?? 0) + (b2.gpu ?? 0)) / 2, sb = (b.sub + b2.sub) / 2;
  L.push(`### ${r.name}`, '', `原狀整幀 ${f1(base)} ms、送出 ${f1(sb)} ms、draw ${Math.round(b.draws)}；雜訊 ±${f1(noise)} ms；${sb >= base * .85 ? '卡在 CPU 送出' : `顯示卡（比送出多 ${f1(base - sb)} ms）`}`, '', '| 關掉 | 整幀省 | 送出省 | draw 少 |', '|---|---|---|---|');
  for (const a of r.abl.slice(1, -1).sort((x, y) => (y.gpu == null ? -1 : base - y.gpu) - (x.gpu == null ? -1 : base - x.gpu)))
    L.push(`| ${a.what} | ${a.gpu == null ? '—' : f1(base - a.gpu)}${a.gpu != null && Math.abs(base - a.gpu) <= noise ? '（雜訊內）' : ''} | ${f1(sb - a.sub)} | ${Math.round(b.draws - a.draws)} |`);
  L.push('');
}
L.push('## 一幀拆解：白畫的 draw（不影響畫面就能省的）', '', '| 情境 | 趟 | draw | 白畫 | 分類 | 例子 |', '|---|---|---|---|---|---|');
for (const r of results) for (const p of (r.sample || []).filter(p => p.draws > 20)) {
  const w = Object.values(p.waste).reduce((a, b) => a + b, 0);
  L.push(`| ${r.name} | ${p.nm} | ${p.draws} | ${w} | ${Object.entries(p.waste).map(([k, v]) => `${k} ${v}`).join('、')} | ${Object.values(p.wex).flat().slice(0, 4).join('；')} |`);
}
L.push('', '## 一幀拆解：主畫面 draw 最多的材質、可以實例化的、實例大多在畫面外的', '');
for (const r of results) { const m = (r.sample || []).find(p => p.nm === 'main'); if (!m) continue;
  L.push(`- **${r.name}**：${m.top.slice(0, 8).map(([n, d, t, w]) => `${n} ${d}（${(t / 1e6).toFixed(2)} M 面${w ? `，白畫 ${w}` : ''}）`).join('、')}；同幾何同材質分開畫 ${m.dupDraws} 個（併成實例可省 ${m.dupSave}）；實例不到四分之一在畫面裡：${m.instLow.map(([n, c, v]) => `${n} ${v}/${c}`).join('、') || '無'}`); }
L.push('', '## 卡頓與成因', '');
for (const r of results) { if (!r.stalls.length && !r.pipes.length) continue;
  const byMat = {}; for (const p of r.pipes) { const k = `${p.mat} → ${p.rt}`; byMat[k] = (byMat[k] || 0) + 1; }
  L.push(`- **${r.name}**：卡頓 ${r.stalls.length} 次（最長 ${f1(Math.max(0, ...r.stalls.map(s => s.ms)))} ms；著色器 ${r.stalls.filter(s => s.dp).length}、貼圖／幾何上傳 ${r.stalls.filter(s => !s.dp && (s.dt || s.dg)).length}、其他 ${r.stalls.filter(s => !s.dp && !s.dt && !s.dg).length}）；新建管線 ${r.pipes.length}：${Object.entries(byMat).slice(0, 8).map(([k, v]) => `${v}× ${k}`).join('、')}`); }
if (prof) {
  L.push('', '## CPU 自身時間前 25 名（各情境每幀 ms 加總）', '', '| ms/幀 | 函式:行 |', '|---|---|');
  for (const [k, v] of [...prof].sort((a, b) => b[1] - a[1]).slice(0, 25)) L.push(`| ${v.toFixed(3)} | \`${k}\` |`);
}
L.push('', `頁面錯誤 ${log.pageerrors.length}、console.error ${log.errors.length}${log.pageerrors.length ? '：' + log.pageerrors.slice(0, 3).join('；') : ''}`);
writeFileSync(resolve(OUT, 'report.md'), L.join('\n'));
writeFileSync(resolve(OUT, 'log.json'), JSON.stringify(log));
console.log(resolve(OUT, 'report.md'));
await browser.close(); srv.close();
