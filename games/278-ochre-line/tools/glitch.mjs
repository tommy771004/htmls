#!/usr/bin/env node
// 偶發畫面異常重現器：每輪開全新瀏覽器跑一次非 clean 實機路徑，自動判全白與彩虹，出事時留圖並逐項關後處理找源頭。
// node tools/glitch.mjs [--page=dist/x.html] [--n=20] [--par=1] [--burn=0] [--q=...] [--size=1440x900] [--tag=x]
// --env=1 另外記錄環境貼圖數值；--mode=resize（快照前後改尺寸）、swap（快照啟用前後逐幀換槍，要 ?snapAt）、delay（素材隨機延遲 0–2 秒）
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const page = arg('page', 'dist/fix.html'), N = +arg('n', 20), PAR = +arg('par', 1), BURN = +arg('burn', 0), Q = arg('q', ''), TAG = arg('tag', 'g'), gap = +arg('gap', 0), MODE = arg('mode', '');
const [W, H] = arg('size', '1440x900').split('x').map(Number);
const dir = resolve(GAME_DIR, 'dist/glitch'); mkdirSync(dir, { recursive: true });
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, page) });

// 只算畫布中段（避開 HUD）：白比例、高亮高飽和比例
const judge = async (p, png) => p.evaluate(async png => {
  const i = new Image(); i.src = 'data:image/png;base64,' + png; await i.decode();
  const w = 160, h = 100, c = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true }); c.drawImage(i, 0, 0, w, h);
  const d = c.getImageData(0, 12, w, 72).data, n = d.length / 4; let wh = 0, sat = 0, lum = 0;
  for (let k = 0; k < d.length; k += 4) { const R = d[k], G = d[k + 1], B = d[k + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); lum += (R + G + B) / 3; if (mn > 245) wh++; if (mx > 200 && mn < 90 && !(R > G && G > B)) sat++; }
  return { white: +(wh / n).toFixed(3), sat: +(sat / n).toFixed(4), lum: +(lum / n).toFixed(0) };
}, png.toString('base64'));

const hud = async (p, cb, i) => {
  await p.evaluate(() => document.querySelector('button[data-s=def]')?.click() ?? __ol.startMatch({ side: 'def' })); await p.waitForTimeout(800);
  await cb('buy');
  await p.evaluate(async () => { const O = __ol, G = O.G, W = ms => new Promise(f => setTimeout(f, ms)); G.time = 1; while (G.phase === 'buy') await W(50); G.time = 900; G.me.hp = 1e6; O.giveWeapon('s6'); await W(700); O.input.alt = true; await W(100); O.input.alt = false; await W(400); });
  await cb('scope');
  await p.evaluate(async () => { const O = __ol, W = ms => new Promise(f => setTimeout(f, ms)); O.input.alt = true; await W(100); O.input.alt = false; O.giveWeapon('n9'); await W(700); });
  await cb('n9');
};

// 讀環境貼圖每個面、每層 mip 的數值範圍。half float 走 raw Uint16 自己解，Inf／NaN 才看得到
const texStats = () => {
  const half = v => { const e = (v >> 10) & 31, m = v & 1023, s = v >> 15 ? -1 : 1; return e === 31 ? (m ? NaN : s * Infinity) : s * (e ? (1 + m / 1024) * 2 ** (e - 15) : m / 1024 * 2 ** -14); };
  window.__texStats = async (t, name) => {
    const it = t?.getInternalTexture?.(); if (!it) return { name, none: true };
    const out = { name, w: it.width, type: it.type, fmt: it.format, gen: it.generateMipMaps, pre: t._prefiltered, lodS: t.lodGenerationScale, lodO: t.lodGenerationOffset, same: 0, lods: [] }, faces = it.isCube ? 6 : 1, lvls = Math.floor(Math.log2(it.width)) + 1;
    for (let l = 0; l < lvls; l++) {
      let mx = 0, mean = 0, n = 0, bad = 0;
      for (let f = 0; f < faces; f++) {
        const r = await t.readPixels(f, l, null, false, true).catch(e => null); if (!r) { bad = -1; continue; }
        const u = r instanceof Uint16Array ? r : r instanceof Float32Array ? r : new Uint16Array(r.buffer, r.byteOffset, r.byteLength >> 1), hf = u instanceof Uint16Array;
        for (let i = 0; i < u.length; i++) { if ((i & 3) === 3) continue; const v = hf ? half(u[i]) : u[i]; if (!Number.isFinite(v)) bad++; else { if (v > mx) mx = v; mean += v; n++; } }
      }
      out.lods.push([+mx.toFixed(2), +(mean / Math.max(1, n)).toFixed(3), bad]);
    }
    return out;
  };
};

async function envLog(p) {
  await p.evaluate(texStats);
  return p.evaluate(async () => {
    const x = __ol.ctx, s = x.scene, e = s.environmentTexture, sky = s.meshes.find(m => m.name === 'skydome')?.material?.reflectionTexture;
    const out = { env: await __texStats(e, 'env'), sky: await __texStats(sky, 'sky'), sameTex: e?.getInternalTexture?.() === sky?.getInternalTexture?.(), lightI: x.sun.intensity };
    const pp = x.camera._postProcesses?.filter(Boolean) ?? [], first = pp[0], it = first?.inputTexture?.texture ?? first?.inputTexture;
    out.chain = pp.map(q => q?.name); out.fmt = it && [it.type, it.format, it.width, it.height];
    if (it) { const eng = x.engine, W = it.width, H = it.height, r = await eng._readTexturePixels(it, W, H, -1, 0, null, false, true).catch(e => String(e).slice(0, 100)); if (typeof r === 'string') out.rt = r; else { out.rtCtor = r.constructor.name; const u = new Float32Array(r.buffer, r.byteOffset, r.byteLength >> 2), h16 = new Uint16Array(r.buffer, r.byteOffset, r.byteLength >> 1); const half = v => { const e = (v >> 10) & 31, m = v & 1023, s = v >> 15 ? -1 : 1; return e === 31 ? (m ? NaN : s * Infinity) : s * (e ? (1 + m / 1024) * 2 ** (e - 15) : m / 1024 * 2 ** -14); }; let inf = 0, nan = 0, mx = 0, sum = 0, n = 0; const hf = it.type === 2; for (let i = 0; i < (hf ? h16.length : u.length); i += 7) { const v = hf ? half(h16[i]) : u[i]; if (Number.isNaN(v)) nan++; else if (!Number.isFinite(v)) inf++; else { mx = Math.max(mx, v); sum += v; n++; } } out.rtS = { inf, nan, mx: +mx.toFixed(2), mean: +(sum / Math.max(1, n)).toFixed(3) }; } }
    return out;
  });
}

async function diag(p, tag) {
  const d = await p.evaluate(async () => {
    const O = __ol, x = O.ctx, e = x.scene.environmentTexture, sp = e?.sphericalPolynomial, W = ms => new Promise(f => setTimeout(f, ms));
    return { flash: O.G.flash, snap: x.engine.snapshotRendering, top: document.elementFromPoint(innerWidth / 2, innerHeight / 3)?.id, env: e?.isReady?.(), sph: sp ? [sp.x.x, sp.y.y, sp.xx.x, sp.yy.y].map(v => +v.toFixed(3)) : null, stats: O.stats() };
  });
  d.tex = await envLog(p);
  const steps = [['nosnap', () => { __ol.ctx.snapshot.disable(); }], ['noenv', () => { __ol.ctx.scene.environmentIntensity = 0; for (const m of __ol.ctx.scene.materials) if ('environmentIntensity' in m) { m.unfreeze?.(); m.environmentIntensity = 0; } }], ['nosun', () => { __ol.ctx.sun.intensity = 0; __ol.ctx.bounce.intensity = 0; }], ['noemis', () => { for (const m of __ol.ctx.scene.materials) if (m.emissiveColor) m.emissiveColor.set(0, 0, 0); }], ['nobloom', () => { __ol.ctx.pipeline.bloomEnabled = false; }], ['noimg', () => { __ol.ctx.pipeline.imageProcessingEnabled = false; }]];
  for (const [name, f] of steps) {
    await p.evaluate(f).catch(e => { d[name + 'Err'] = String(e).slice(0, 80); }); await p.waitForTimeout(600);
    const png = await p.screenshot(); d[name] = await judge(p, png);
  }
  return d;
}

let burners = []; if (BURN) burners = Array.from({ length: BURN }, () => new Worker('const t=Date.now();let x=0;for(;;){x+=Math.sqrt(Date.now()-t);}', { eval: true }));

let bad = 0, done = 0;
async function one(i) {
  const b = await launch();
  const r = { i, shots: {} };
  try {
    const p = await b.newPage({ viewport: { width: W, height: H } }), log = [];
    p.on('console', m => { const t = m.text(); if (['error', 'warning'].includes(m.type()) || /validation|Destroyed|lost/i.test(t)) log.push(t.slice(0, 180)); });
    p.on('pageerror', e => log.push('uncaught ' + String(e).slice(0, 180)));
    if (MODE === 'delay') await p.route(/\/assets\//, async r => { await new Promise(f => setTimeout(f, Math.random() * 2000)); await r.continue(); });
    await p.goto(`${s.url}/web/278-ochre-line.html${MODE === 'swap' ? '?snapAt=300' : Q}`); await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 180000 });
    const shake = async () => { for (const [w, h] of [[1280, 720], [1600, 1000], [W, H]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(i % 3 * 50); } };
    if (MODE === 'resize') { await p.waitForTimeout(i % 5 * 40); await shake(); }
    if (MODE === 'swap') r.swap = await p.evaluate(async () => {
      const O = __ol, en = O.ctx.engine, ids = ['p9', 'ar5', 's6', 'n9', 'knife'], F = () => new Promise(requestAnimationFrame); let k = 0, after = 0, before = 0;
      O.startMatch({ side: 'def' }); O.G.time = 900;
      while (after < 10 && before < 900) { O.giveWeapon(ids[k++ % ids.length]); await F(); if (en.snapshotRendering) after++; else before++; }
      await new Promise(f => setTimeout(f, 700)); return { before, after, snap: en.snapshotRendering };
    });
    let hit = false;
    await p.waitForTimeout(800);
    const menu = await p.screenshot(); r.shots.menu = await judge(p, menu); if (r.shots.menu.white > .4) { hit = true; await p.screenshot({ path: `${dir}/${TAG}_${i}_menu.png` }); }
    const shot = async k => { const png = await p.screenshot(), j = await judge(p, png); r.shots[k] = j; if (j.white > .4 || j.sat > .002) { hit = true; await p.screenshot({ path: `${dir}/${TAG}_${i}_${k}.png` }); } };
    if (MODE === 'swap') await shot('swap');
    await hud(p, shot, i);
    if (MODE === 'resize') { await shake(); await p.waitForTimeout(500); await shot('resized'); }
    r.boot = await p.evaluate(() => Math.round(__ol.boot));
    if (arg('env', '')) r.tex = await envLog(p);
    if (hit) { r.diag = await diag(p, TAG + i); bad++; }
    r.log = log.slice(0, 4);
  } catch (e) { r.err = String(e).slice(0, 200); }
  await b.close(); done++;
  console.log(JSON.stringify(r));
}

const q = Array.from({ length: N }, (_, i) => i);
await Promise.all(Array.from({ length: PAR }, async () => { while (q.length) { await one(q.shift()); if (gap) await new Promise(f => setTimeout(f, gap)); } }));
for (const w of burners) w.terminate();
await s.close();
console.log(`完成 ${done} 次，異常 ${bad} 次`);
