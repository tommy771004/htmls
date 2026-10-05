// 開發用：暫停對局，把英雄擺成各個動作的關鍵幀，在遊戲鏡頭下裁成特寫（和參考影片同尺度）。
// node tools/poses.mjs [英雄] [tag] [縮放]  → dist/ref/<tag>/
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';
const [hero = 'goku', tag = 'pose', zm = '1'] = process.argv.slice(2);
const out = `dist/ref/${tag}`; mkdirSync(out, { recursive: true });
const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w: 1920, h: 1080 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const raf = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await ev(([id, zm]) => {
  const k = window.__ki; k.start(id, 1); k.fog(false); k.fastForward(1);
  const q = k.lanePoint(0, 0, 0.42); k.teleport(q.x, q.z); k.fastForward(0.2);
  const P = k.G.player;
  for (const u of k.G.units) if (u !== P && Math.hypot(u.x - P.x, u.z - P.z) < 14) { u.x += 40; u.z += 40; } // 清場
  k.fastForward(0.1); k.freezeAI(true); k.camera(P.x, P.z, +zm);
}, [hero, zm]);
await page.waitForTimeout(900);
await ev(() => window.__ki.pause(true));
const IM = { atk1: 0.1, atk2: 0.12, atk3: 0.16, cast: 0.16, beam: 0.4, grab: 0.18, overhead: 0.3, slash: 0.12 };
const list = [
  ['idle', 0.5], ['run', 0, { steps: 20 }], ['run', 0, { steps: 27 }], ['run', 0, { steps: 34 }],
  ['atk1', IM.atk1 * 0.55], ['atk1', IM.atk1 + 0.03], ['atk2', IM.atk2 + 0.03], ['atk3', IM.atk3 * 0.5], ['atk3', IM.atk3 + 0.03],
  ['dash', 0.1], ['rush', 0.05], ['cast', IM.cast + 0.03], ['beam', 0.6], ['air', 0.4], ['idle', 0, { hit: [0, 1, 1], steps: 4 }], ['dead', 1],
];
const faces = [0.9, -0.9];
let n = 0;
for (const [name, t, o = {}] of list) {
  for (const f of faces) {
    if (o.hit) await ev(([f]) => window.__ki.pose('idle', 0.5, { face: f, steps: 40 }), [f]); // 先回到架式再挨打
    await ev(([name, t, o, f]) => window.__ki.pose(name, t, { ...o, face: f }), [name, t, o, f]);
    await raf();
    const c = await ev(() => { const P = window.__ki.G.player; return window.__ki.render.toScreen(P.x, 1.0, P.z); });
    const w = Math.round(300 / +zm), h = w;
    await page.screenshot({ path: `${out}/${String(n).padStart(2, '0')}-${name}${f > 0 ? 'a' : 'b'}.png`, clip: { x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), width: w, height: h } });
  }
  n++;
}
console.log(out, 'gpu', log.gpu, 'errors', log.pageerrors, log.errors.slice(0, 5));
await browser.close();
