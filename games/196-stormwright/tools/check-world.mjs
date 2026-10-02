// 世界軌道自檢：各 POI 的鏡頭截圖、空拍、走進房屋上二樓、十字鎬打牆與樹、效能統計。
// 用法：node tools/check-world.mjs [html] [--out dir] [--only name,name] [--w 1440 --h 900]
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const html = a.find((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--'))) || 'dist/world/index.html';
const out = resolve(opt('out', 'dist/world/check')), only = opt('only', '') ? opt('only', '').split(',') : null;
const W = +opt('w', 1440), H = +opt('h', 900);
mkdirSync(out, { recursive: true });
const { browser, page, log } = await open(html, { w: W, h: H });
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const checks = [], check = (n, ok, d) => { checks.push({ n, ok: !!ok, d }); console.log((ok ? 'PASS ' : 'FAIL ') + n, d ?? ''); };
const want = (n) => !only || only.includes(n);

await ev(() => { window.__sw.start(); window.__sw.skipToGround(); window.__sw.freezeBots(true); });
await wait(600);
// 取代鏡頭更新：由腳本擺位
await ev(() => { const c = window.__sw.ctx; c.cam.update = () => {}; c.storm.fixedUpdate = () => {}; /* 長時間快轉不要被風暴淘汰 */ });
const pose = async (name, pos, look, fov = 62, extra = 700) => {
  await ev(([p, l, f]) => { const c = window.__sw.ctx, cam = c.camera; cam.position.set(...p); cam.lookAt(...l); cam.fov = f; cam.updateProjectionMatrix(); }, [pos, look, fov]);
  await wait(extra);
  await page.screenshot({ path: resolve(out, name + '.png') });
  const s = await ev(() => window.__sw.stats());
  console.log(name, JSON.stringify({ fps: s.fps, dc: s.drawCalls, tri: s.triangles }));
  return s;
};
const put = (x, y, z, yaw) => ev(([x, y, z, yaw]) => { const s = window.__sw, p = s.ctx.player; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.state = 'ground'; p.grounded = true; s.look(yaw, 0); s.ctx.cam.init = false; }, [x, y, z, yaw]);
const hAt = (x, z) => ev(([x, z]) => window.__sw.ctx.terrain.heightAt(x, z), [x, z]);
const stats = {};
// ---------- POI 鏡頭 ----------
const shots = {
  'hw-plaza': [[-22, 12, 58], [0, 6, 16]],
  'hw-street': [[30, 7, -12], [8, 6, 14]],
  'hw-hall': [[-2, 9, 8], [0, 8, -42]],
  'farm': [[-165, 14, -120], [-205, 6, -160]],
  'farm-barn': [[-170, 9, -138], [-195, 6, -155]],
  'harbor': [[200, 14, 150], [250, 3, 120]],
  'harbor-yard': [[212, 8, 100], [240, 4, 118]],
  'grove': [[-150, 12, 215], [-190, 6, 185]],
  'grove-in': [[-176, 5.5, 197], [-190, 5, 185]],
  'pit': [[216, 22, -160], [176, 4, -199]],
  'pit-rim': [[150, 15, -172], [178, 3, -202]],
  'aerial-hw': [[0, 120, 140], [0, 0, 10]],
  'aerial-island': [[0, 380, 520], [0, 0, 0]],
  'beach': [[300, 5, -10], [330, 0, -60]],
  'lake': [[40, 12, -20], [105, 0, -55]],
};
for (const [name, [p, l]] of Object.entries(shots)) {
  if (!want(name) && !want('shots')) continue;
  stats[name] = await pose(name, p, l);
}
if (want('lighthouse') || want('shots')) {
  const lh = await ev(() => window.__sw.ctx.world.landmarks.lighthouse), wm = await ev(() => window.__sw.ctx.world.landmarks.windmill);
  if (lh) stats.lighthouse = await pose('lighthouse', [lh.x - 26, lh.y + 8, lh.z - 22], [lh.x, lh.y + 11, lh.z]);
  if (wm) stats.windmill = await pose('windmill', [wm.x + 16, wm.y + 6, wm.z + 22], [wm.x, wm.y + 9, wm.z]);
}
if (want('props') || want('shots')) {
  const lm = await ev(() => { const w = window.__sw.ctx.world, car = w.clusters.misc.panels.types.get('car').items[2].center; return { gas: w.landmarks.gas, cont: w.landmarks.containers[1], car: { x: car.x, y: car.y, z: car.z } }; });
  stats.car = await pose('car', [lm.car.x + 5, lm.car.y + 2.4, lm.car.z + 6], [lm.car.x, lm.car.y + 0.8, lm.car.z]);
  stats.gas = await pose('gas', [lm.gas.x - 22, lm.gas.y + 7, lm.gas.z + 24], [lm.gas.x, lm.gas.y + 2, lm.gas.z]);
  stats.containers = await pose('containers', [lm.cont.x - 14, lm.cont.y + 7, lm.cont.z + 10], [lm.cont.x, lm.cont.y + 2, lm.cont.z]);
}
// ---------- 所有房屋：從正門走得進去；兩層房屋樓梯走得上二樓 ----------
if (want('allhouses')) {
  const list = await ev(() => window.__sw.ctx.world.houses.map((h, i) => ({ i, x: h.x, z: h.z, y: h.y, yaw: h.yaw, W: h.W, D: h.D, floors: h.floors, door: h.doors.find((d) => d.side === 'front') || h.doors[0], stairs: h.stairs })));
  let bad = [], badStairs = [];
  for (const h of list) {
    if (!h.door) { bad.push(h.i + ':nodoor'); continue; }
    const cs = Math.cos(h.yaw), sn = Math.sin(h.yaw), L = (lx, lz) => [h.x + lx * cs + lz * sn, h.z - lx * sn + lz * cs], sgn = h.door.side === 'front' ? -1 : 1;
    const [sx, sz] = L(h.door.a, sgn * (h.D / 2 + 2.6)), face = h.yaw + (sgn < 0 ? Math.PI : 0);
    await put(sx, (await hAt(sx, sz)) + 0.05, sz, face);
    const pos = await ev(() => { const s = window.__sw; s.press({ moveZ: 1 }); s.fastForward(1.7); s.press(null); return s.state().pos; });
    const dx = pos[0] - h.x, dz = pos[2] - h.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    if (!(Math.abs(lx) < h.W / 2 && Math.abs(lz) < h.D / 2)) bad.push(h.i + `@${pos.map((v) => v.toFixed(0))}`);
    if (h.stairs) {
      const [bx, bz] = L(h.stairs.lx, h.stairs.zs + 0.2);
      await put(bx, h.y + 0.05, bz, h.yaw + Math.PI);
      const top = await ev(() => { const s = window.__sw; s.press({ moveZ: 1 }); let m = 0; for (let i = 0; i < 30; i++) { s.fastForward(0.1); m = Math.max(m, s.state().pos[1]); } s.press(null); return m; });
      if (top - h.y < 3.2) badStairs.push(h.i + `:${(top - h.y).toFixed(1)}`);
    }
  }
  check(`全部 ${list.length} 棟房屋走得進去`, bad.length === 0, bad.join(' '));
  check('全部兩層房屋樓梯走得上二樓', badStairs.length === 0, badStairs.join(' '));
}
// ---------- 走進房屋、上二樓 ----------
if (want('house')) {
  const info = await ev(() => { const w = window.__sw.ctx.world; const h = w.houses.find((x) => x.floors === 2 && x.poi === '蜂蜜鎮' && Math.abs(x.yaw) < 1e-6 || x.floors === 2 && x.poi === '蜂蜜鎮'); return { x: h.x, z: h.z, yaw: h.yaw, y: h.y, W: h.W, D: h.D }; });
  console.log('house', JSON.stringify(info));
  // 門在局部 -Z；站在門外 3m
  const cs = Math.cos(info.yaw), sn = Math.sin(info.yaw), L = (lx, lz) => [info.x + lx * cs + lz * sn, info.z - lx * sn + lz * cs];
  // 門所在欄：front 欄 doorCol = floor((n-1)/2)，n = W/2
  const n = Math.round(info.W / 2), cw = info.W / n, dc = Math.floor((n - 1) / 2), doorLx = -info.W / 2 + (dc + 0.5) * cw;
  const [sx, sz] = L(doorLx, -info.D / 2 - 3);
  await put(sx, info.y + 0.05, sz, info.yaw + Math.PI);
  await ev(() => { window.__sw.press({ moveZ: 1 }); window.__sw.fastForward(1.6); window.__sw.press(null); });
  let st = await ev(() => window.__sw.state());
  const inside = (p) => { const dx = p[0] - info.x, dz = p[2] - info.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) < info.W / 2 && Math.abs(lz) < info.D / 2; };
  check('走進房屋門口', inside(st.pos), st.pos.map((v) => v.toFixed(1)).join(','));
  // 往樓梯：樓梯在左牆（lx≈-W/2+1.1），從 lz = D/2-0.3-6 往 +z 爬。先走到樓梯底
  const lx0 = -info.W / 2 + 1.1, zs = info.D / 2 - 0.3 - 6 - 0.3;
  const [bx, bz] = L(lx0, zs);
  // 面向 +Z(局部) = 世界方向 yaw+π
  await put(bx, info.y + 0.05, bz, info.yaw + Math.PI);
  await ev(() => { const s = window.__sw; s.press({ moveZ: 1 }); let m = 0; window.__trace = []; for (let i = 0; i < 40; i++) { s.fastForward(0.1); const p = s.state().pos; m = Math.max(m, p[1]); if (i % 4 === 0) window.__trace.push(p.map((v) => +v.toFixed(1)).join(',')); } s.press(null); window.__top = m; });
  console.log('trace', JSON.stringify(await ev(() => window.__trace)));
  st = await ev(() => window.__sw.state());
  const top = await ev(() => window.__top);
  check('樓梯可走上二樓', top - info.y > 3.2, `y0=${info.y.toFixed(2)} 最高=${top.toFixed(2)}`);
  // 二樓截圖（第三人稱鏡頭交給原相機，暫時還原）
  await ev(() => { const c = window.__sw.ctx; delete c.cam.update; });
  await wait(900); await page.screenshot({ path: resolve(out, 'house-2f.png') });
  await ev(() => { const c = window.__sw.ctx; c.cam.update = () => {}; });
}
// ---------- 十字鎬打牆與樹 ----------
if (want('harvest')) {
  await ev(() => { const s = window.__sw, c = s.ctx; c.cam.update = c.cam.constructor.prototype.update.bind(c.cam); s.giveMats(0); c.player.inventory.selected = 0; });
  const t = await ev(() => { // 找一面蜂蜜鎮外牆板塊
    const w = window.__sw.ctx.world, p = w.clusters.hw.panels.list.find((q) => q.panelKind === 'wall' && !q.dead && q.spec.cy < 6);
    return { x: p.spec.cx, y: p.spec.cy, z: p.spec.cz, yaw: p.spec.yaw, i: w.clusters.hw.panels.list.indexOf(p), ids: p.colIds.slice() };
  });
  await ev(([x, y, z]) => { const s = window.__sw, c = s.ctx; const dx = x - c.player.pos.x; }, [t.x, t.y, t.z]);
  // 站在板塊 1.6 m 外，朝它揮鎬（從外面：沿房屋外法線方向）
  const hit = await ev((t) => {
    const s = window.__sw, c = s.ctx, p = c.world.clusters.hw.panels.list[t.i], pl = c.player;
    const wood0 = pl.inventory.mats.wood, st0 = pl.inventory.mats.stone;
    // 嘗試四個方位，找一個射線能第一個打到這個板塊的站位
    for (const [ox, oz] of [[0, -1.8], [0, 1.8], [1.8, 0], [-1.8, 0]]) {
      const x = t.x + ox, z = t.z + oz; s.teleport(x, z);
      const yaw = Math.atan2(-(t.x - x), -(t.z - z)); s.look(yaw, 0);
      const o = { x, y: pl.pos.y + 1.4, z }, d = { x: -Math.sin(yaw), y: (t.y - o.y) / 1.8, z: -Math.cos(yaw) }; const l = Math.hypot(d.x, d.y, d.z);
      const THREE = c.THREE, r = c.physics.raycast(new THREE.Vector3(o.x, o.y, o.z), new THREE.Vector3(d.x / l, d.y / l, d.z / l), 4, {});
      if (r && r.owner === p) { s.look(yaw, Math.atan2(d.y, Math.hypot(d.x, d.z))); return { found: true, wood0, st0 }; }
    }
    return { found: false };
  }, t);
  console.log('wall hit-pos', JSON.stringify(hit));
  if (hit.found) {
    await ev(() => { const s = window.__sw; s.press({ fire: true }); s.fastForward(3.1); });
    await wait(60); await page.screenshot({ path: resolve(out, 'wall-hit.png') });
    await ev(() => { const s = window.__sw; s.fastForward(2.4); s.press(null); });
    const res = await ev((t) => { const c = window.__sw.ctx, p = c.world.clusters.hw.panels.list[t.i]; return { dead: p.dead, hp: p.hp, wood: c.player.inventory.mats.wood, stone: c.player.inventory.mats.stone, has: t.ids.some((id) => c.physics.cols.has(id)) }; }, t);
    check('十字鎬打掉牆板（collider 移除）', res.dead && !res.has, JSON.stringify(res));
    check('採集到材料', res.wood > hit.wood0 || res.stone > hit.st0, JSON.stringify(res));
    await wait(500); await page.screenshot({ path: resolve(out, 'wall-broken.png') });
  } else check('找到可打牆板站位', false);
  // 樹
  const tr = await ev(() => { const w = window.__sw.ctx.world, c = window.__sw.ctx, p = c.player.pos; let best = null, bd = 1e9; for (const r of w.treeRefs) { if (r.dead) continue; const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < bd && d > 4) { bd = d; best = r; } } return { i: w.treeRefs.indexOf(best), x: best.x, z: best.z, y: best.y }; });
  const tres = await ev((t) => {
    const s = window.__sw, c = s.ctx, r = c.world.treeRefs[t.i], pl = c.player;
    const x = t.x + 1.6, z = t.z; s.teleport(x, z); const yaw = Math.atan2(-(t.x - x), -(t.z - z)); s.look(yaw, 0.35); pl.inventory.selected = 0;
    const w0 = pl.inventory.mats.wood; s.press({ fire: true }); s.fastForward(5); s.press(null); s.fastForward(1);
    return { dead: r.dead, hp: r.hp, wood: pl.inventory.mats.wood - w0, ids: r.colIds.length };
  }, tr);
  check('十字鎬砍倒樹', tres.dead && tres.ids === 0, JSON.stringify(tres));
  check('砍樹獲得木材', tres.wood > 0, tres.wood);
}
// ---------- 畫質級距、風暴色調、閃電、reset ----------
if (want('quality')) {
  await ev(() => { const c = window.__sw.ctx; c.cam.update = c.cam.constructor.prototype.update.bind(c.cam); window.__sw.teleport(0, 12); window.__sw.look(0.6, 0.05); });
  for (const q of ['low', 'medium', 'high', 'epic']) {
    await ev((q) => window.__sw.setQuality(q), q); await wait(2200);
    const s = await ev(() => window.__sw.stats());
    console.log('quality', q, JSON.stringify({ fps: s.fps, dc: s.drawCalls, tri: s.triangles }));
    await page.screenshot({ path: resolve(out, `q-${q}.png`) });
  }
  await ev(() => window.__sw.setQuality('high')); await wait(500);
  await ev(() => { window.__sw.ctx.render.stormTint = 1; }); await wait(1500); await page.screenshot({ path: resolve(out, 'storm-tint.png') });
  await ev(() => { const r = window.__sw.ctx.render; r.stormTint = 0; r.flash(0xdfe8ff, 0.9); }); await wait(60); await page.screenshot({ path: resolve(out, 'flash.png') });
  await wait(1200);
}
if (want('climb')) {
  const st = await ev(() => window.__sw.ctx.world.landmarks.crateStairs[0]);
  const c = Math.cos(st.yaw), sn = Math.sin(st.yaw), lz = 0.9 * (st.n - 1) + 1.6, sx = st.x + sn * lz, sz = st.z + c * lz;
  await put(sx, (await hAt(sx, sz)) + 0.05, sz, st.yaw);
  const top = await ev(() => { const s = window.__sw; s.press({ moveZ: 1 }); let m = 0; for (let i = 0; i < 24; i++) { s.fastForward(0.1); m = Math.max(m, s.state().pos[1]); } s.press(null); return m; });
  check('貨櫃箱子階梯爬得上貨櫃頂', top - st.y > 2.4, `top=${top.toFixed(2)} base=${st.y}`);
}
if (want('autoq')) {
  const r = await ev(() => { const s = window.__sw, c = s.ctx; c.noAutoQuality = false; c.quality = 'high'; c.render.setQuality('high'); let n = 0; for (let i = 0; i < 400 && c.quality === 'high'; i++, n++) c.render.update(0.05); const q1 = c.quality; for (let i = 0; i < 400 && c.quality === q1; i++) c.render.update(0.05); const q2 = c.quality; c.noAutoQuality = true; c.render.setQuality('high'); return { q1, q2, n }; });
  check('fps < 45 連續 3 秒自動降級', r.q1 === 'medium' && r.q2 === 'low', JSON.stringify(r));
}
if (want('destroyall')) {
  const r = await ev(() => {
    const s = window.__sw, c = s.ctx, w = c.world; let n = 0; const kinds = {};
    for (const k in w.clusters) for (const p of w.clusters[k].panels.list) { p.takeDamage(999, { weapon: 'pickaxe' }); n++; kinds[p.type] = (kinds[p.type] || 0) + 1; }
    for (const r of w.nature.refs) { r.takeDamage(9999, { weapon: 'pickaxe' }); n++; kinds[r.kind] = (kinds[r.kind] || 0) + 1; }
    s.fastForward(1.5);
    const left = [...c.physics.cols.values()].filter((q) => q.owner && (q.owner.kind === 'panel' || q.owner.type)).length;
    w.reset(); s.fastForward(0.2);
    const back = [...c.physics.cols.values()].filter((q) => q.owner && (q.owner.kind === 'panel' || q.owner.type)).length;
    return { n, kinds, left, back };
  });
  check('全部板塊／樹／岩石／蘑菇／車打爆後 collider 清空，reset 後復原', r.left === 0 && r.back > 3000, JSON.stringify(r));
  await wait(300);
}
if (want('reset')) {
  const r = await ev(() => {
    const s = window.__sw, c = s.ctx, w = c.world, p = w.clusters.hw.panels.list[5], tr = w.treeRefs[3], rk = w.rockRefs[2];
    w.clusters.hw.panels.destroy(p); tr.takeDamage(999, {}); rk.takeDamage(999, {}); s.fastForward(0.1);
    const before = { panel: p.colIds.every((id) => !c.physics.cols.has(id)), tree: tr.colIds.length === 0, rock: rk.colIds.length === 0 };
    w.reset();
    const after = { panel: p.colIds.length > 0 && p.colIds.every((id) => c.physics.cols.has(id)), tree: tr.colIds.length > 0 && tr.colIds.every((id) => c.physics.cols.has(id)), rock: rk.colIds.length > 0 && rk.colIds.every((id) => c.physics.cols.has(id)), hp: p.hp === p.maxHp };
    return { before, after };
  });
  check('destroy 移除 collider、reset() 復原', Object.values(r.before).every(Boolean) && Object.values(r.after).every(Boolean), JSON.stringify(r));
}
// ---------- 效能（蜂蜜鎮中心，high）----------
if (want('perf')) {
  await ev(() => { const c = window.__sw.ctx; c.cam.update = c.cam.constructor.prototype.update.bind(c.cam); window.__sw.teleport(0, 12); window.__sw.look(0.6, 0); });
  await wait(2500);
  const s = await ev(() => window.__sw.stats());
  console.log('perf-hw', JSON.stringify(s));
  check('fps ≥ 60 (hw, high)', s.fps >= 60, s.fps); check('draw calls ≤ 350', s.drawCalls <= 350, s.drawCalls);
  await page.screenshot({ path: resolve(out, 'perf-hw.png') });
}
check('無 uncaught exception', log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
check('無 console.error', log.errors.length === 0, log.errors.slice(0, 3));
check('無外部請求', log.external.length === 0, log.external.slice(0, 3));
await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(JSON.stringify({ failed, gpu: log.gpu }));
process.exit(failed ? 1 : 0);
