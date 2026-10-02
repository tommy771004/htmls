// 效能量測：node tools/check-perf.mjs <html> [--out dir]
// 量 draw calls／三角形／fps：飛艇俯瞰、蜂蜜鎮廣場＋bot、錫罐港、150 件建材戰。遊戲視角 ≤ 350、飛艇俯瞰 ≤ 500。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--out') || 'dist/integ/index.html';
const oi = a.indexOf('--out'), outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/integ/perf');
mkdirSync(outDir, { recursive: true });
const { browser, page, log } = await open(html, { w: 1440, h: 900 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const res = [];
async function measure(name, limit) {
  await wait(700);
  let mx = 0, tri = 0, fps = 0, n = 0;
  for (let i = 0; i < 8; i++) { const s = await ev(() => window.__sw.stats()); mx = Math.max(mx, s.drawCalls); tri = Math.max(tri, s.triangles); fps += s.fps; n++; await wait(120); }
  const ri = await ev(() => { const i = window.__sw.ctx.renderer.info; return { geo: i.memory.geometries, tex: i.memory.textures, progs: i.programs ? i.programs.length : 0 }; });
  await page.screenshot({ path: resolve(outDir, name + '.png') });
  res.push({ name, drawCalls: mx, limit, ok: mx <= limit, triangles: tri, fps: Math.round(fps / n), ...ri });
}
const ring = (n, r0, r1, cx, cz) => ev(([n, r0, r1, cx, cz]) => {
  const c = window.__sw.ctx, bots = c.actors.filter((x) => !x.isPlayer && x.alive).slice(0, n);
  bots.forEach((b, i) => { const ang = i / n * 6.283 + 0.4, r = r0 + (r1 - r0) * ((i * 7) % n) / n, x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r; b.pos.set(x, c.physics.groundHeight(x, z, 1000, 0.38).y + 0.02, z); b.vel.set(0, 0, 0); b.state = 'ground'; b.grounded = true; b.yaw = ang; });
  window.__sw.freezeBots(true);
}, [n, r0, r1, cx, cz]);

await ev(() => window.__sw.start()); await wait(1500);
await measure('1-bus-aerial', 500);
await ev(() => window.__sw.skipToGround(8, 30)); await wait(500);
await ev(() => { const s = window.__sw; s.give('ar', 3); s.giveMats(); s.giveAmmo(); });
await ring(14, 8, 38, 8, 30);
await ev(() => window.__sw.look(0, -0.05)); await measure('2-honeywick-bots', 350);
await ev(() => { const s = window.__sw, c = s.ctx, t = c.world.pois.find((p) => /Tincan|錫罐/.test(p.en + p.name)); s.teleport(t.x + 6, t.z + 6); });
await ring(10, 8, 30, await ev(() => window.__sw.ctx.player.pos.x), await ev(() => window.__sw.ctx.player.pos.z)); await measure('3-tincan-harbor', 350);
// 150 件建材戰
await ev(() => {
  const s = window.__sw, c = s.ctx, p = c.player, B = c.build; s.teleport(60, -40); s.giveMats(); p.inventory.buildMat = 'wood';
  const ci = Math.floor(p.pos.x / 4), ck = Math.floor(p.pos.z / 4); let n = 0;
  for (let lv = 0; lv < 3; lv++) for (let i = -4; i <= 4; i++) for (let k = -4; k <= 4; k++) {
    p.inventory.buildMat = ['wood', 'stone', 'metal'][n % 3];
    const edge = (i + k + lv + 8) & 3, kinds = ['floor', 'wall', 'ramp'];
    const kind = kinds[(i * 3 + k + lv) % 3 < 0 ? 0 : (i * 3 + k + lv + 9) % 3];
    if (n < 150 && B.placeAt(p, { piece: kind, i: ci + i, k: ck + k, level: lv, edge, noReach: true })) n++;
  }
  s.fastForward(3);
});
await ring(12, 6, 24, await ev(() => window.__sw.ctx.player.pos.x), await ev(() => window.__sw.ctx.player.pos.z));
await ev(() => { window.__sw.freezeBots(false); window.__sw.fastForward(2); });
res.push({ pieces: await ev(() => window.__sw.state().pieces) });
await measure('4-build-fight', 350);
console.log(JSON.stringify({ ok: res.every((r) => r.ok !== false), res, errors: log.pageerrors.concat(log.errors) }, null, 1));
await browser.close();
