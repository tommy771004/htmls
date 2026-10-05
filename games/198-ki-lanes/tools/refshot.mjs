// 開發用：以實際遊戲鏡頭（1920×1080、預設縮放）連拍玩家英雄，裁成角色特寫，和參考影片畫格同尺度比對。
// node tools/refshot.mjs [英雄] [tag] [敵方英雄]
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';
const [hero = 'goku', tag = 'now', foe = 'frieza'] = process.argv.slice(2);
const out = `dist/ref/${tag}`; mkdirSync(out, { recursive: true });
const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w: 1920, h: 1080 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const raf = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await ev(([id]) => { const k = window.__ki; k.start(id, 1); k.fog(false); k.fastForward(3); k.freezeAI(true); k.setLevel(6); k.learnAll(); k.give({ ki: 500, mp: 999 }); }, [hero]);
// 把一名敵方英雄放到玩家旁邊（地點選中路空地）
const spot = await ev(() => window.__ki.lanePoint(0, 0, 0.42));
await ev((q) => { const k = window.__ki; k.teleport(q.x, q.z); k.spawnEnemyHeroNear(3.2); }, spot);
let n = 0;
async function shot(name) {
  await raf();
  const c = await ev(() => { const k = window.__ki, P = k.G.player; k.camera(P.x, P.z, 1); const s = k.render.toScreen(P.x, 1.1, P.z); return s; });
  await page.waitForTimeout(60); await raf();
  const c2 = await ev(() => { const P = window.__ki.G.player; return window.__ki.render.toScreen(P.x, 1.1, P.z); });
  const w = 560, h = 360, x = Math.max(0, Math.min(1920 - w, Math.round(c2.x - w / 2))), y = Math.max(0, Math.min(1080 - h, Math.round(c2.y - h / 2)));
  await page.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${name}.png`, clip: { x, y, width: w, height: h } });
}
await page.waitForTimeout(500);
await shot('idle');
await ev(() => { const P = window.__ki.G.player; window.__ki.moveTo(P.x + 9, P.z - 3); });
for (let i = 0; i < 3; i++) { await page.waitForTimeout(140); await shot('run'); }
await ev((q) => { const k = window.__ki; k.teleport(q.x, q.z); k.spawnEnemyHeroNear(2.2); }, spot);
await page.waitForTimeout(200);
const eid = await ev(() => window.__ki.G.heroes.find((h) => h.team !== window.__ki.G.player.team && h.alive).id);
await ev((id) => window.__ki.attack(id), eid);
for (let i = 0; i < 8; i++) { await page.waitForTimeout(90); await shot('atk'); }
for (const key of ['Q', 'W', 'E']) {
  await ev(([k2]) => { const k = window.__ki, e = k.enemyHero(); if (e) k.cast(k2, e.x, e.z); }, [key]);
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(120); await shot(key); }
}
console.log(out, 'gpu', log.gpu, 'errors', log.pageerrors, log.errors.slice(0, 5));
await browser.close();
