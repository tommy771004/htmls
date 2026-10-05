// 新手測試：咬鉤後一直按住收線不放，看各魚種是釣起還是斷線（以及斷線前有沒有出現「放開」提示）。
// node tools/holdall.mjs [每種次數=3]
import { open } from './lib.mjs';
const N = +process.argv[2] || 3;
const { browser, page, log } = await open('../../web/201-coral-cove.html', { w: 1280, h: 800 });
try {
  await page.evaluate(() => window.__cc.start());
  for (const sp of ['clown', 'puffer', 'tang', 'snapper', 'parrot']) {
    const res = [];
    for (let i = 0; i < N; i++) {
      const r = await page.evaluate(async (sp) => {
        const c = window.__cc, g = c.game, fs = g.fishing;
        if (fs.phase === 'catch') fs.endCatch();
        c.setCreel(0); c.place(0.4, -11.3, Math.PI); c.cast(0.4 + Math.random() * 0.6);
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let k = 0; k < 100 && fs.phase !== 'wait'; k++) await sleep(50);
        // 讓指定魚種咬鉤
        const f = g.fishes.list.find((x) => x.id === sp && (x.state === 'roam' || x.state === 'flee')) || g.fishes.list.find((x) => x.id === sp && x.state !== 'held'); if (f.state === 'gone') g.fishes.respawn(f); f.state = 'roam';
        fs.engage(f); c.bite(); fs.hookFish();
        const d0 = fs.dist;
        g.input.down('key');
        const t0 = performance.now(); let warn = false, tip = false;
        while (fs.phase === 'fight' && performance.now() - t0 < 30000) {
          await sleep(30);
          warn ||= document.getElementById('btnMain').classList.contains('warn');
          { const ts = document.getElementById('toast'); tip ||= !ts.classList.contains('off') && /先放開/.test(ts.textContent); }
        }
        g.input.up('key');
        const out = { ph: fs.phase, t: ((performance.now() - t0) / 1000).toFixed(1), d0: d0.toFixed(1), warn, tip };
        if (fs.phase === 'catch') fs.endCatch();
        for (let k = 0; k < 60 && fs.phase !== 'explore'; k++) await sleep(50);
        return out;
      }, sp);
      res.push(`${r.ph === 'catch' ? '釣起' : r.ph === 'stow' || r.ph === 'explore' ? '斷線' : r.ph} ${r.t}s（${r.d0} m${r.warn ? '，有「放開」提示' : ''}${r.tip ? '，有教學' : ''}）`);
    }
    console.log(sp.padEnd(8), res.join('；'));
  }
  if (log.pageerrors.length || log.errors.length) console.log('錯誤：', log.pageerrors.concat(log.errors).join(' | ').slice(0, 400));
} finally { await browser.close(); }
