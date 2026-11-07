#!/usr/bin/env node
// 換彈逐格：node tools/gun-reel.mjs <id>[,<id>] [--page=dist/x.html] [--u=.1,.2,.3] [--size=1440x900] [--cell=480] [--out=dist/shots/reel_<id>.png]
// 凍在指定進度截圖拼成一張，看得到手接彈匣的那幾格（gun-check 的 reloadA／B 常常剛好錯過）。
// --cycle 改拍開火後的上膛動作，--inspect 拍檢視；u 都是 0..1。
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ids = process.argv[2]?.split(','), page = arg('page', 'dist/int.html'), [W, H] = arg('size', '1440x900').split('x').map(Number);
const us = arg('u', '0.1,0.18,0.26,0.34,0.44,0.5,0.56,0.66,0.8').split(',').map(Number), mode = process.argv.includes('--cycle') ? 'cycle' : process.argv.includes('--inspect') ? 'inspect' : 'reload';
const tall = H > W, cols = Math.min(us.length, tall ? 6 : 3), cw = +arg('cell', tall ? 260 : 480), ch = Math.round(cw * H / W);
const dir = resolve(GAME_DIR, 'dist/shots'); mkdirSync(dir, { recursive: true });
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, page) }), b = await launch();
try {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: tall, isMobile: tall, deviceScaleFactor: 1 }), p = await ctx.newPage(), bad = [];
  p.on('pageerror', e => bad.push(String(e.stack || e).slice(0, 260)));
  await p.goto(`${s.url}/web/278-ochre-line.html?clean=1`);
  await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 120000 });
  await p.evaluate(async () => { const O = __ol, G = O.G, W = ms => new Promise(f => setTimeout(f, ms)); O.startMatch({ side: 'def' }); O.setClean(true); G.time = 1; while (G.phase === 'buy') await W(50); G.time = 900; G.me.hp = 1e6; await W(500); });
  const page2 = await ctx.newPage();
  for (const id of ids) {
    await p.evaluate(id => { const O = __ol; O.G.time = 900; O.G.me.hp = 1e6; O.giveWeapon(id); }, id); await p.waitForTimeout(800);
    const cells = [];
    for (const u of us) {
      await p.evaluate(([u, mode]) => { const v = __GAME_MCP__.vm, O = __ol; O.G.time = 900; clearInterval(window.__fz); cancelAnimationFrame(window.__fz);
        const T = mode === 'reload' ? (O.G.me.reloadT = 0, 4) : mode === 'cycle' ? 1.25 : 2.6;
        const f = () => { if (mode === 'reload') { v.reloadT = T; v.reload = T * (1 - u); } else if (mode === 'cycle') v.cycle = u * T; else v.inspect = T * (1 - u); window.__fz = requestAnimationFrame(f); }; f(); }, [u, mode]);
      await p.waitForTimeout(220);
      cells.push({ u, png: (await p.screenshot()).toString('base64') });
    }
    await p.evaluate(() => { const v = __GAME_MCP__.vm; cancelAnimationFrame(window.__fz); v.reload = 0; v.cycle = -1; v.inspect = 0; });
    await page2.setViewportSize({ width: cw * cols, height: ch * Math.ceil(cells.length / cols) });
    await page2.setContent(`<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${cw}px)">` + cells.map(c => `<div style="position:relative;width:${cw}px;height:${ch}px;overflow:hidden"><img src="data:image/png;base64,${c.png}" style="width:100%;height:100%"><b style="position:absolute;left:4px;top:2px;color:#fff;font:13px sans-serif;background:#0009;padding:1px 4px">${id} u=${c.u}</b></div>`).join(''));
    await page2.waitForTimeout(250);
    const out = arg('out', `dist/shots/reel_${id}_${mode}${tall ? '_port' : ''}.png`).replace('<id>', id);
    await page2.screenshot({ path: resolve(GAME_DIR, out) }); console.log(out);
  }
  if (bad.length) console.log('錯誤', bad[0]);
} finally { await b.close(); await s.close(); }
