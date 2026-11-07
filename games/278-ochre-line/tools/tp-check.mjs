#!/usr/bin/env node
// 第三人稱持槍驗圖：node tools/tp-check.mjs m7,b90 [--page=dist/x.html] [--clips=idle_rifle:.4,run_rifle:.2] [--tag=x] [--far] [--side=def] [--w=800 --h=800] [--mode=near|left|far]
// 走主選單舞台，和 bot 同一條 updateSoldiers，FAST 快照照常。截圖存 dist/shots/tp_<tag>_<id>_<clip>_<near|left|far>.png。
// 開火（aim_rifle）、走、跑、蹲用 forceClip 固定片段與時間；手有沒有握到要自己看圖，也可以看輸出的掌心到支撐點距離。
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const ids = process.argv[2]?.split(',') ?? [], page = arg('page', 'dist/tp.html'), tag = arg('tag', 'x'), side = arg('side', 'atk');
const clips = arg('clips', 'idle_rifle:.4,aim_rifle:.4,walk_rifle:.3,run_rifle:.2,crouch_idle:.3,crouch_walk:.5').split(',').map(c => c.split(':'));
const W = +arg('w', 720), H = +arg('h', 720), modes = arg('mode', 'near,left').split(','), q = arg('q', '');
const dir = resolve(GAME_DIR, 'dist/shots'); mkdirSync(dir, { recursive: true });
const FACE = 120;
const CAM = {
  near: { az: FACE + 50, d: 1.5, h: 1.3, f: 36, mx: -0.45, my: -0.55 },     // 左前方近景：看槍口側
  left: { az: FACE - 35, d: 1.5, h: 1.25, f: 36, mx: 0.45, my: -0.55 },      // 左手那一側
  front: { az: FACE + 8, d: 1.0, h: 1.05, f: 22, mx: -0.1, my: -0.9 },   // 槍口方向微距：看手和護木的左右、上下關係
  side: { az: FACE - 78, d: 0.95, h: 1.15, f: 26, mx: 0.75, my: -0.75 }, // 左側微距：看手在護木前後的位置
  far: { az: FACE + 30, d: 7, h: 1.55, f: 40, mx: 0, my: 0 },            // 遊戲距離，直向視角接近遊戲內
};
const FOCUS = { gfront: { d: [-0.45, -0.1, 1], r: 1.1, f: 22 }, gsr: { d: [-1, -0.05, 0.1], r: 1.1, f: 22 }, gsl: { d: [1, -0.05, 0.1], r: 1.1, f: 22 }, gunder: { d: [0.5, -1, 0.3], r: 1.1, f: 22 } };
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, page) }), b = await launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }), p = await ctx.newPage(), bad = [];
p.on('console', m => { if (m.type() === 'error' || /validation|Destroyed texture/i.test(m.text())) bad.push(m.text().slice(0, 240)); });
p.on('pageerror', e => bad.push('uncaught ' + String(e.stack || e).slice(0, 260)));
await p.goto(`${s.url}/web/278-ochre-line.html?${q}`);
await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 120000 });
await p.waitForTimeout(1200);
await p.addStyleTag({ content: '#menu,.m-root,#ui{display:none!important}body>*:not(canvas){visibility:hidden}canvas{visibility:visible!important}' });
try {
  for (const id of ids) {
    await p.evaluate(([id, side]) => __ol.stageGun(id, side), [id, side]);
    await p.waitForTimeout(300);
    for (const [clip, t] of clips) for (const mode of modes) {
      await p.evaluate(([clip, t, side]) => { const O = __ol, o = O.pool[side][0]; O.forceClip(clip, +t); o.clipA = o.clipB = clip; }, [clip, t, side]);
      await p.waitForTimeout(250);   // 焦點要等片段換好再量
      await p.evaluate(([clip, t, c, side, foc]) => {
        const O = __ol, o = O.pool[side][0];
        if (!foc) { O.tuneStage(c, { face: 120 }); o.clipA = o.clipB = clip; return; }
        // 以左手為焦點、用槍框架的方向擺鏡頭，換算成舞台的 az／d／h／mx／my
        const m = o.gunM.m, hi = o.sk.bones.findIndex(b => b.name === 'hand_l'), h = o.bf[hi].multiply(o.world).m, P = [h[12], h[13], h[14]], F = { x: 1.6, z: -6 };
        const ax = i => { const v = [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]], l = Math.hypot(...v); return v.map(x => x / l); }, X = ax(0), Y = ax(1), Z = ax(2);
        const dir = [0, 1, 2].map(k => foc.d[0] * X[k] + foc.d[1] * Y[k] + foc.d[2] * Z[k]), l = Math.hypot(...dir), C = P.map((v, k) => v + dir[k] / l * foc.r);
        const D = 180 / Math.PI, az = Math.atan2(C[0] - F.x, C[2] - F.z), d = Math.hypot(C[0] - F.x, C[2] - F.z), a = innerWidth / innerHeight, tv = Math.tan(foc.f / 2 / D);
        const yaw = Math.atan2(P[0] - C[0], P[2] - C[2]), pitch = Math.atan2(P[1] - C[1], Math.hypot(P[0] - C[0], P[2] - C[2]));
        const mx = Math.tan(az + Math.PI - yaw) / (a * tv), my = Math.tan(Math.atan2(0.95 - C[1], d) - pitch) / tv;
        O.tuneStage({ az: az * D, d, h: C[1], f: foc.f, mx, my }, { face: 120 }); o.clipA = o.clipB = clip;
      }, [clip, t, CAM[mode], side, FOCUS[mode]]);
      await p.waitForTimeout(350);
      await p.screenshot({ path: `${dir}/tp_${tag}_${id}_${clip}_${mode}.png` });
    }
  }
} finally {
  console.log(bad.length ? 'ERR ' + bad[0] : 'ok 無錯誤');
  await b.close(); await s.close();
}
