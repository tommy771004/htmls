#!/usr/bin/env node
// 偶發畫面異常重現器：每輪開全新瀏覽器跑一次非 clean 實機路徑，自動判全白與彩虹，出事時留圖並逐項關後處理找源頭。
// node tools/glitch.mjs [--page=dist/x.html] [--n=20] [--par=1] [--burn=0] [--q=...] [--size=1440x900] [--tag=x]
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const page = arg('page', 'dist/fix.html'), N = +arg('n', 20), PAR = +arg('par', 1), BURN = +arg('burn', 0), Q = arg('q', ''), TAG = arg('tag', 'g'), gap = +arg('gap', 0);
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

async function diag(p, tag) {
  const d = await p.evaluate(async () => {
    const O = __ol, x = O.ctx, e = x.scene.environmentTexture, sp = e?.sphericalPolynomial, W = ms => new Promise(f => setTimeout(f, ms));
    return { flash: O.G.flash, snap: x.engine.snapshotRendering, top: document.elementFromPoint(innerWidth / 2, innerHeight / 3)?.id, env: e?.isReady?.(), sph: sp ? [sp.x.x, sp.y.y, sp.xx.x, sp.yy.y].map(v => +v.toFixed(3)) : null, stats: O.stats() };
  });
  const steps = [['nobloom', () => { __ol.ctx.pipeline.bloomEnabled = false; }], ['nofxaa', () => { __ol.ctx.pipeline.fxaaEnabled = false; }], ['nosnap', () => { __ol.ctx.snapshot.disable(); }], ['noimg', () => { __ol.ctx.pipeline.imageProcessingEnabled = false; }]];
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
    await p.goto(`${s.url}/web/278-ochre-line.html${Q}`); await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 180000 });
    let hit = false;
    await p.waitForTimeout(800);
    const menu = await p.screenshot(); r.shots.menu = await judge(p, menu); if (r.shots.menu.white > .4) { hit = true; await p.screenshot({ path: `${dir}/${TAG}_${i}_menu.png` }); }
    await hud(p, async k => { const png = await p.screenshot(), j = await judge(p, png); r.shots[k] = j; if (j.white > .4 || j.sat > .002) { hit = true; await p.screenshot({ path: `${dir}/${TAG}_${i}_${k}.png` }); } }, i);
    r.boot = await p.evaluate(() => Math.round(__ol.boot));
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
