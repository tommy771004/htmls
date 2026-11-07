#!/usr/bin/env node
// 手臂切口檢查：node tools/arm-check.mjs [p9,c7,...] [--page=dist/x.html] [--size=390x844] [--mode=reload|cycle|idle] [--step=.04]
// 袖子網格在手肘附近是開口的。逐格把開口（依位置焊接後只屬於一個三角形的邊）投影到畫面，開口在畫面內就是手臂「斷在半空」。不看手長，只看切口。
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ALL = 'knife,p9,c7,r50,v11,m7,b90,t4,ks,ar5,x10,s8,s6,l40,n9'.split(',');
const ids = !process.argv[2] || process.argv[2].startsWith('--') ? ALL : process.argv[2].split(','), page = arg('page', 'dist/int.html'), [W, H] = arg('size', '390x844').split('x').map(Number), mode = arg('mode', 'reload'), step = +arg('step', '.04');
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, page) }), b = await launch();
let fails = 0;
try {
  const tall = H > W, ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: tall, isMobile: tall, deviceScaleFactor: 1 }), p = await ctx.newPage();
  p.on('pageerror', e => console.log('錯誤', String(e).slice(0, 200)));
  await p.goto(`${s.url}/web/278-ochre-line.html?clean=1`);
  await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 120000 });
  await p.evaluate(async () => { const O = __ol, G = O.G, W = ms => new Promise(f => setTimeout(f, ms)); O.startMatch({ side: 'def' }); O.setClean(true); G.time = 1; while (G.phase === 'buy') await W(50); G.time = 900; G.me.hp = 1e6; await W(500);
    window.__arm = (id) => { const v = __GAME_MCP__.vm, g = v.groups[id], cam = v.anchor.parent, out = [];
      const VP = cam.getViewMatrix().multiply(cam.getProjectionMatrix()).m;
      for (const m of g.meshes) { if (!/^arms_/.test(m.name)) continue;
        m.__rim ??= (() => { const ix = m.getIndices(), Q = m.getVerticesData('position'), id = new Map(), w = new Int32Array(Q.length / 3); for (let i = 0; i < w.length; i++) { const k = `${Math.round(Q[i * 3] * 2e4)},${Math.round(Q[i * 3 + 1] * 2e4)},${Math.round(Q[i * 3 + 2] * 2e4)}`; if (!id.has(k)) id.set(k, i); w[i] = id.get(k); } const e = new Map(); for (let i = 0; i < ix.length; i += 3) for (let k = 0; k < 3; k++) { const a = w[ix[i + k]], b = w[ix[i + (k + 1) % 3]], c = a < b ? a * 1e6 + b : b * 1e6 + a; if (a !== b) e.set(c, (e.get(c) ?? 0) + 1); } const up = new Map(), root = a => { let r = a; while (up.get(r) !== r) r = up.get(r); return r; }; for (const [c, n] of e) if (n === 1) { const a = Math.floor(c / 1e6), b = c % 1e6; if (!up.has(a)) up.set(a, a); if (!up.has(b)) up.set(b, b); up.set(root(a), root(b)); }
          const cl = new Map(); for (const a of up.keys()) { const r = root(a); if (!cl.has(r)) cl.set(r, []); cl.get(r).push(a); } let best = null, bz = 1e9; for (const L of cl.values()) { const z = L.reduce((t, i) => t + Q[i * 3 + 2], 0) / L.length; if (L.length > 8 && z < bz) { bz = z; best = L; } } return best ?? []; })();   // 手臂朝槍後方伸，z 最小的開口才是手肘那端；其他開口是手腕的袖口夾層
        const P = (g.rl?.arm === m && g.rl.pw) || (g.rb?.arm === m && g.rb.pw) || m.getVerticesData('position'), W = m.computeWorldMatrix(true).m; let inn = 0, xs = 0, ys = 0, near = 0;
        for (const i of m.__rim) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], wx = W[0] * x + W[4] * y + W[8] * z + W[12], wy = W[1] * x + W[5] * y + W[9] * z + W[13], wz = W[2] * x + W[6] * y + W[10] * z + W[14], cw = VP[3] * wx + VP[7] * wy + VP[11] * wz + VP[15]; if (cw <= 0.01) { near++; continue; } const cx = (VP[0] * wx + VP[4] * wy + VP[8] * wz + VP[12]) / cw, cy = (VP[1] * wx + VP[5] * wy + VP[9] * wz + VP[13]) / cw; if (Math.abs(cx) < 1 && Math.abs(cy) < 1) { inn++; xs += cx; ys += cy; } }
        out.push({ m: m.name, n: m.__rim.length, inn, x: +(xs / Math.max(1, inn)).toFixed(2), y: +(ys / Math.max(1, inn)).toFixed(2) }); }
      return out; }; });
  for (const id of ids) {
    await p.evaluate(id => { const O = __ol; O.G.time = 900; O.G.me.hp = 1e6; O.giveWeapon(id); }, id); await p.waitForTimeout(700);
    const bad = [];
    for (let u = mode === 'idle' ? 0 : step; u < 1; u += step) {
      const r = await p.evaluate(async ([id, u, mode]) => { const v = __GAME_MCP__.vm, O = __ol; O.G.time = 900; const T = mode === 'cycle' ? 1.05 : 4; O.G.me.reloadT = 0;
        const set = () => { if (mode === 'reload') { v.reloadT = T; v.reload = T * (1 - u); } else if (mode === 'cycle') v.cycle = u * T; };
        set(); await new Promise(f => requestAnimationFrame(() => { set(); requestAnimationFrame(f); })); return __arm(id); }, [id, +u.toFixed(3), mode]);
      const w = r.filter(x => x.inn > 2);
      if (w.length) bad.push(`u=${u.toFixed(2)} ` + w.map(x => `${x.m.replace('arms_' + id, '') || '右'}:${x.inn}/${x.n}@(${x.x},${x.y})`).join(' '));
      if (mode === 'idle') break;
    }
    await p.evaluate(() => { const v = __GAME_MCP__.vm; v.reload = 0; v.cycle = -1; });
    await p.waitForTimeout(250);
    if (bad.length) fails++;
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${id}${bad.length ? '  ' + bad.join('；') : ''}`);
  }
  console.log(fails ? `${fails} 把切口在畫面內` : '全部通過');
} finally { await b.close(); await s.close(); }
process.exit(fails ? 1 : 0);
