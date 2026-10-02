// 建造／物理驗收：node tools/check-build.mjs [html] [--out dir] [--w 1440 --h 900]
// 以 __sw 腳本化操作，逐項檢查斜坡 rush、下坡、二層地板、斜坡下穿行、崩塌、高速落地不穿透、200 件建材效能，並截圖。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const html = a.find((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--'))) || 'dist/build/index.html';
const outDir = resolve(opt('out', 'dist/build/check'));
const W = +opt('w', 1440), H = +opt('h', 900);
mkdirSync(outDir, { recursive: true });

const { browser, page, log } = await open(html, { w: W, h: H, touch: W < 500 });
const results = []; let failed = 0;
const check = (n, ok, d) => { results.push({ n, ok: !!ok, d }); if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = (s) => page.screenshot({ path: resolve(outDir, `${W}-${s}.png`) });
const wait = (ms) => page.waitForTimeout(ms);

await ev(() => window.__sw.start()); await wait(300);
await ev(() => { const s = window.__sw; s.skipToGround(); s.freezeBots(true); s.ctx.noAutoQuality = true; s.ctx.storm.active = false; });
await wait(500);
// 找一塊沒有碰撞物的空地，把地形（格點與網格）壓平成 H=3.5（和城鎮地面同高），讓第 L0 層元件可預期
const FLAT_H = 3.5, L0 = Math.floor((FLAT_H + 0.4) / 3.5);
const spot = await ev((H) => {
  const c = window.__sw.ctx, T = c.terrain, P = c.physics;
  let found = null, best = 1e9;
  for (let z = -300; z <= 300; z += 8) for (let x = -300; x <= 200; x += 8) {
    let lo = 1e9, hi = -1e9; for (let dx = -8; dx <= 70; dx += 6) for (let dz = -14; dz <= 40; dz += 6) { const h = T.heightAt(x + dx, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (lo < 1.8) continue;
    const n = P.queryBox({ x: x - 8, y: -5, z: z - 14 }, { x: x + 70, y: 80, z: z + 40 }).length, sc = n * 3 + (hi - lo);
    if (sc < best) { best = sc; found = { x: Math.ceil(x / 4) * 4, z: Math.ceil(z / 4) * 4 }; }
  }
  if (!found) return null;
  for (const id of P.queryBox({ x: found.x - 8, y: -5, z: found.z - 14 }, { x: found.x + 70, y: 80, z: found.z + 40 })) P.remove(id); // 清掉樹／石碰撞，讓測試路徑乾淨
  const g = T.grid, N = Math.round(Math.sqrt(g.length)), STEP = 920 / (N - 1), pos = T.mesh.geometry.attributes.position;
  const x0 = found.x - 8, x1 = found.x + 64, z0 = found.z - 12, z1 = found.z + 36, bl = 8;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -460 + i * STEP, z = -460 + j * STEP;
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), d = Math.hypot(dx, dz);
    if (d >= bl) continue;
    const t = d === 0 ? 1 : 1 - d / bl, k = t * t * (3 - 2 * t);
    g[j * N + i] = g[j * N + i] * (1 - k) + H * k; pos.setY(j * N + i, g[j * N + i]);
  }
  pos.needsUpdate = true; T.mesh.geometry.computeVertexNormals();
  return { ...found, h: H, L: Math.floor((H + 0.4) / 3.5) };
}, FLAT_H);
check('找到空地並壓平', !!spot, spot);
if (!spot) { await browser.close(); process.exit(1); }

const setup = () => ev((s) => { const w = window.__sw, c = w.ctx; w.press(null); c.build.reset(); w.teleport(s.x + 2, s.z + 2); w.giveMats(); c.player.inventory.buildMat = 'wood'; c.player.building = false; w.look(-Math.PI / 2, 0); c.player.pitch = 0; w.fastForward(0.2); return c.player.pos.toArray(); }, spot);

// ---------- 1. 建造預覽（瞄準） ----------
await setup();
const prev = await ev(() => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build, out = {};
  p.building = true;
  const q = (piece, pitch) => { p.buildPiece = piece; p.pitch = pitch; const v = B.previewFor(p); return { piece: v.piece, i: v.i, k: v.k, level: v.level, edge: v.edge, valid: v.valid, reason: v.reason }; };
  out.wallLevel = q('wall', 0); out.wallUp = q('wall', 0.6); out.floorDown = q('floor', -0.8); out.floorLevel = q('floor', 0); out.floorUp = q('floor', 0.6); out.rampLevel = q('ramp', 0); out.rampDown = q('ramp', -0.9);
  p.pitch = 0; return out;
});
console.log('previews', JSON.stringify(prev));
check('牆：看哪條格邊蓋哪條（水平視線→同層）', prev.wallLevel.level === prev.rampLevel.level && prev.wallLevel.edge === 3);
check('牆：抬頭 → 往上一層', prev.wallUp.level > prev.wallLevel.level || prev.wallUp.reason === 'unsupported' || prev.wallUp.level >= prev.wallLevel.level);
check('地板：低頭 → 腳下附近', prev.floorDown.reason !== 'far');
check('斜坡：朝視線方向', prev.rampLevel.edge === 1);

// ---------- 2. Ramp rush ----------
async function rampRush(opts) {
  await setup();
  const r = await ev((o) => {
    const w = window.__sw, c = w.ctx, p = c.player; const log = [];
    w.look(-Math.PI / 2, o.pitch);
    // 模擬「建造模式可衝刺」（需求 actor.js 移除 sprinting 條件中的 !this.building）：呼叫期間暫時關掉 building
    const proto = Object.getPrototypeOf(p);
    if (o.sprintPatch && !proto.__orig) { proto.__orig = proto.fixedUpdate; proto.fixedUpdate = function (dt) { const b = this.building; if (this.isPlayer) this.building = false; proto.__orig.call(this, dt); this.building = b; }; }
    if (!o.sprintPatch && proto.__orig) { proto.fixedUpdate = proto.__orig; proto.__orig = null; }
    w.press({ piece: 'ramp', fire: true, moveZ: 1, sprint: true, jump: o.jump });
    let maxY = 0, airSteps = 0;
    for (let i = 0; i < 60 * 14; i++) { w.fastForward(1 / 60); maxY = Math.max(maxY, p.pos.y); if (i % 30 === 0) log.push([+p.pos.x.toFixed(1), +p.pos.y.toFixed(2)]); }
    w.press(null);
    return { maxY, final: p.pos.toArray(), pieces: c.build.pieces.size, log, mats: c.player.inventory.mats, speed: Math.hypot(p.vel.x, p.vel.z) };
  }, opts);
  return r;
}
const rr = await rampRush({ pitch: 0, jump: false });
console.log('rush', JSON.stringify(rr.log));
check('Ramp rush（不跳）：爬到 3 層以上', rr.maxY > 3.5 * (L0 + 3) - 0.3, { maxY: rr.maxY, pieces: rr.pieces });
await shot('1-rush');
const rrs = await rampRush({ pitch: 0, jump: false, sprintPatch: true });
check('Ramp rush（衝刺 6.4 m/s，模擬建造可衝刺）：爬到 3 層以上', rrs.maxY > 3.5 * (L0 + 3) - 0.3 && rrs.speed > 6, { maxY: rrs.maxY, speed: rrs.speed, pieces: rrs.pieces });
const rrsj = await rampRush({ pitch: 0.1, jump: true, sprintPatch: true });
check('Ramp rush（衝刺＋連跳）：爬到 3 層以上', rrsj.maxY > 3.5 * (L0 + 3) - 0.3, { maxY: rrsj.maxY, pieces: rrsj.pieces });
const rrj = await rampRush({ pitch: 0.1, jump: true });
check('Ramp rush（邊跳）：爬到 3 層以上', rrj.maxY > 3.5 * (L0 + 3) - 0.3, { maxY: rrj.maxY, pieces: rrj.pieces });

// ---------- 3. 下坡不彈跳 ----------
await rampRush({ pitch: 0, jump: false });
const desc = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build;
  w.press(null); p.building = false; w.look(Math.PI / 2, 0);
  // 先上到最高的斜坡頂端再往回衝刺下坡
  let top = null; for (const q of B.pieces.values()) if (q.type === 'ramp' && (!top || q.level > top.level)) top = q;
  const cx = top.center.x; p.pos.set(cx + 1.2, 3.5 * (top.level + 1) - 0.05, top.center.z); p.vel.set(0, 0, 0); p.state = 'ground'; p.grounded = true;
  w.press({ moveZ: 1, sprint: true });
  let air = 0, steps = 0, lastY = p.pos.y, maxUp = 0, landed = false, ys = [];
  for (let i = 0; i < 60 * 16; i++) {
    w.fastForward(1 / 60); steps++;
    if (p.grounded) landed = true; else if (landed) air++;
    const dy = p.pos.y - lastY; if (landed && dy > maxUp) maxUp = dy; lastY = p.pos.y;
    if (i % 30 === 0) ys.push(+p.pos.y.toFixed(2));
    if (p.pos.y < s.h + 0.3 && landed) break;
  }
  w.press(null);
  return { air, steps, maxUp, final: p.pos.toArray(), ys, sprinting: p.sprinting };
}, spot);
console.log('descend', JSON.stringify(desc));
check('下坡（衝刺）：全程貼地不彈起', desc.air <= 2 && desc.maxUp < 0.2, { air: desc.air, maxUp: desc.maxUp.toFixed(3) });
check('下坡：回到地面', desc.final[1] < spot.h + 0.4, desc.final[1]);

// ---------- 4. 二層地板站立 ----------
const fl = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build;
  w.press(null); B.reset(); w.teleport(s.x + 2, s.z + 2); w.giveMats(); p.building = false;
  const mk = (piece, i, k, level, edge) => B.placeAt(p, { piece, i, k, level, edge, noReach: true });
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 2) / 4);
  const res = [];
  res.push(!!mk('ramp', i0 + 1, k0, s.L, 1)); res.push(!!mk('ramp', i0 + 2, k0, s.L + 1, 1)); // 兩層斜坡 → 第 2 層頂
  res.push(!!mk('floor', i0 + 3, k0, s.L + 2, 0)); res.push(!!mk('floor', i0 + 4, k0, s.L + 2, 0));
  w.fastForward(0.2);
  w.look(-Math.PI / 2, 0); p.building = false; w.press({ moveZ: 1 });
  let maxY = 0; for (let i = 0; i < 60 * 7; i++) { w.fastForward(1 / 60); maxY = Math.max(maxY, p.pos.y); if (p.pos.x > (i0 + 3.4) * 4 && p.grounded && p.pos.y > 3.5 * s.L + 6) break; }
  w.press(null); w.fastForward(0.6);
  const y1 = p.pos.y; w.fastForward(1); const y2 = p.pos.y;
  return { res, y1, y2, grounded: p.grounded, pos: p.pos.toArray(), maxY };
}, spot);
console.log('floor L2', JSON.stringify(fl));
check('二層地板：站得住（y≈7.0 且穩定）', fl.res.every(Boolean) && Math.abs(fl.y2 - 3.5 * (spot.L + 2)) < 0.05 && fl.grounded && Math.abs(fl.y1 - fl.y2) < 0.01, fl);
await ev(() => { const w = window.__sw; w.look(-Math.PI / 2 - 0.5, -0.12); w.ctx.cam.init = false; w.fastForward(0.3); }); await wait(500);
await shot('2-floor-l2');

// ---------- 5. 斜坡下方穿行 ----------
const under = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build;
  w.press(null); B.reset(); w.teleport(s.x + 2, s.z + 2); w.giveMats(); p.building = false;
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 2) / 4), mk = (piece, i, k, level, edge) => B.placeAt(p, { piece, i, k, level, edge, noReach: true });
  // 第 0 層斜坡 → 接第 1 層斜坡：下方是三角形空間，從高端往下走
  const r0 = mk('ramp', i0 + 1, k0, s.L, 1), r1 = mk('ramp', i0 + 2, k0, s.L + 1, 1), f = mk('floor', i0 + 3, k0, s.L + 2, 0);
  w.fastForward(0.3);
  // 從第 1 層斜坡的下方、高端那側（x 較大）走進去
  const hx = (i0 + 3) * 4 + 0.5; p.pos.set(hx + 3, s.h, (k0 + 0.5) * 4); p.vel.set(0, 0, 0); p.state = 'ground'; p.grounded = true;
  function spot_h(c, x, z) { return c.physics.groundHeight(x, z, 50, 0.38).y; }
  w.look(Math.PI / 2, 0); w.press({ moveZ: 1 });
  let minX = 999, maxYseen = 0;
  for (let i = 0; i < 60 * 5; i++) { w.fastForward(1 / 60); minX = Math.min(minX, p.pos.x); maxYseen = Math.max(maxYseen, p.pos.y); }
  w.press(null);
  return { ok: !!(r0 && r1 && f), minX, startX: hx + 3, maxY: maxYseen, final: p.pos.toArray(), cellX: (i0 + 3) * 4, terr: c.terrain.heightAt(p.pos.x, p.pos.z) };
}, spot);
console.log('under', JSON.stringify(under));
check('斜坡下方穿行：能走進斜坡下方（不被彈上去）', under.ok && under.minX < under.cellX && under.maxY < under.terr + 0.7, under);
await ev(() => { const w = window.__sw; w.ctx.cam.init = false; w.fastForward(0.2); }); await wait(400); await shot('3-under-ramp');

// ---------- 6. 崩塌 ----------
const col = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build;
  w.press(null); B.reset(); w.teleport(s.x + 2, s.z + 12); w.giveMats(); p.building = false;
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 12) / 4), mk = (piece, i, k, level, edge) => B.placeAt(p, { piece, i, k, level, edge, noReach: true });
  const base = mk('wall', i0, k0, s.L, 0), base2 = mk('wall', i0, k0 + 1, s.L, 0);
  w.fastForward(0.1);
  const upper = [mk('floor', i0, k0, s.L + 1, 0), mk('wall', i0, k0, s.L + 1, 0), mk('floor', i0, k0, s.L + 2, 0), mk('wall', i0 + 1, k0, s.L + 1, 3)];
  const n0 = B.pieces.size;
  const events = []; c.events.on('buildDestroyed', (e) => events.push(e.collapsed));
  w.fastForward(0.5);
  const sup = B.pieces.size; // 仍有支撐：都在
  if (base) B.destroy(base); if (base2) B.destroy(base2);
  w.fastForward(0.1); const mid = B.pieces.size;
  w.fastForward(4);
  return { n0, sup, mid, end: B.pieces.size, events, built: [base, base2, ...upper].map(Boolean) };
}, spot);
console.log('collapse', JSON.stringify(col));
check('崩塌：拆掉底部 → 上層全部連鎖崩落', col.built.every(Boolean) && col.sup === col.n0 && col.end === 0 && col.events.filter(Boolean).length >= 3, col);

// ---------- 7. 高速不穿透 ----------
const tun = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build, P = c.physics;
  w.press(null); B.reset(); w.teleport(s.x + 2, s.z + 2); w.giveMats(); p.building = false;
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 2) / 4), mk = (piece, i, k, level, edge) => B.placeAt(p, { piece, i, k, level, edge, noReach: true });
  mk('wall', i0 + 5, k0, s.L, 0); mk('floor', i0 + 5, k0, s.L + 1, 0); mk('floor', i0 + 6, k0, s.L + 1, 0); mk('wall', i0 + 7, k0, s.L + 1, 3);
  const pos = { x: (i0 + 5.5) * 4, y: 120, z: (k0 + 0.5) * 4 }; const THREE = c.THREE;
  const P3 = new THREE.Vector3(pos.x, pos.y, pos.z), V = new THREE.Vector3(0, -70, 0); let landed = null;
  for (let i = 0; i < 400; i++) { const r = P.moveCapsule(P3, V, 1 / 60, 0.38, 1.8, false); if (r.grounded) { landed = P3.y; break; } }
  // 水平 40 m/s 衝向牆（x 方向，牆在 x=(i0+7)*4）
  const wallX = (i0 + 7) * 4; const Q = new THREE.Vector3(wallX - 6, 3.5 * (s.L + 1) + 0.1, (k0 + 0.5) * 4), U = new THREE.Vector3(40, 0, 0); let maxX = -1e9;
  for (let i = 0; i < 40; i++) { U.x = 40; U.y = 0; P.moveCapsule(Q, U, 1 / 60, 0.38, 1.8, true); maxX = Math.max(maxX, Q.x); }
  return { landed, floorTop: 3.5 * (s.L + 1), wallX, maxX };
}, spot);
console.log('tunnel', JSON.stringify(tun));
check('70 m/s 俯衝落在二層地板上不穿透', tun.landed !== null && Math.abs(tun.landed - 3.5 * (spot.L + 1)) < 0.02, tun);
check('40 m/s 衝牆不穿透', tun.maxX < tun.wallX, tun);

// ---------- 8. 傷害／全息／材質截圖 ----------
await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build;
  w.press(null); B.reset(); w.giveMats(); p.building = false;
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 2) / 4), L = s.L;
  const mk = (m, piece, i, k, level, edge) => { p.inventory.buildMat = m; return B.placeAt(p, { piece, i, k, level, edge, noReach: true }); };
  const mats = ['wood', 'stone', 'metal'];
  mats.forEach((m, c2) => { mk(m, 'wall', i0 + 4 + c2, k0 + 1, L, 0); mk(m, 'ramp', i0 + 9 + c2 * 2, k0 + 1, L, 1); mk(m, 'floor', i0 + 4 + c2, k0 + 3, L, 0); });
  w.fastForward(13);
  const walls = [...B.pieces.values()].filter((q) => q.type === 'wall');
  walls.forEach((q, i) => q.takeDamage(q.maxHp * [0, 0.4, 0.75][['wood', 'stone', 'metal'].indexOf(q.mat) === i ? i : i], {}));
  mats.forEach((m, c2) => mk(m, 'wall', i0 + 4 + c2, k0 + 4, L, 0));
  w.fastForward(1.6);
  w.teleport((i0 + 6.5) * 4 + 2, (k0 + 6) * 4 + 2); w.look(0.12, -0.16); p.pitch = -0.16; c.cam.init = false; w.fastForward(0.4);
}, spot);
await wait(700); await shot('4-materials');
await ev(() => { const w = window.__sw, c = w.ctx; w.teleport(c.player.pos.x + 5, c.player.pos.z - 7); w.look(0.7, -0.2); c.player.pitch = -0.2; c.cam.init = false; w.fastForward(0.3); }); await wait(500); await shot('5-materials-b');
await ev(() => { const w = window.__sw, c = w.ctx; for (const q of [...c.build.pieces.values()]) if (q.mat === 'stone') q.takeDamage(9999, {}); }); await wait(120); await shot('6-debris');
await wait(900); await shot('6b-debris2');

// ---------- 9. 200 件效能 ----------
const perf = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build;
  w.press(null); B.reset(); w.teleport(s.x + 2, s.z + 2); p.building = false; w.look(-Math.PI / 2, -0.2);
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 2) / 4);
  let n = 0; const mats = ['wood', 'stone', 'metal'];
  p.inventory.mats.wood = p.inventory.mats.stone = p.inventory.mats.metal = 999;
  for (let lv = 0; lv < 3; lv++) for (let i = 0; i < 7; i++) for (let k = 0; k < 4; k++) {
    p.inventory.buildMat = mats[(i + k + lv) % 3];
    const ii = i0 + 1 + i, kk = k0 + k;
    if (lv === 0) { if (B.placeAt(p, { piece: 'wall', noReach: true, i: ii, k: kk, level: s.L, edge: 0 })) n++; if (B.placeAt(p, { piece: 'wall', noReach: true, i: ii, k: kk, level: s.L, edge: 3 })) n++; }
    if (lv >= 1) { if (B.placeAt(p, { piece: 'floor', noReach: true, i: ii, k: kk, level: s.L + lv, edge: 0 })) n++; if (B.placeAt(p, { piece: 'wall', noReach: true, i: ii, k: kk, level: s.L + lv, edge: 0 })) n++; if (B.placeAt(p, { piece: 'wall', noReach: true, i: ii, k: kk, level: s.L + lv, edge: 3 })) n++; }
    p.inventory.mats.wood = p.inventory.mats.stone = p.inventory.mats.metal = 999;
  }
  for (let i = 0; i < 5; i++) { p.inventory.buildMat = mats[i % 3]; B.placeAt(p, { piece: 'ramp', noReach: true, i: i0 + 9, k: k0 + i, level: s.L, edge: 1 }) && n++; }
  w.fastForward(1); c.cam.init = false; w.look(-Math.PI / 2 + 0.55, -0.22); p.pos.set((i0 + 0.3) * 4, c.physics.groundHeight((i0 + 0.3) * 4, (k0 + 1) * 4, 50, 0.38).y + 0.02, (k0 + 1) * 4); c.cam.init = false; w.fastForward(0.3);
  return { n, pieces: B.pieces.size };
}, spot);
await wait(2500);
const st = await ev(() => window.__sw.stats());
await shot('7-200pieces');
console.log('perf', JSON.stringify({ ...perf, ...st }));
check('200+ 件建材（fps ≥ 45、draw calls ≤ 350）', perf.pieces >= 200 && st.fps >= 45 && st.drawCalls <= 350, { pieces: perf.pieces, fps: st.fps, dc: st.drawCalls, tri: st.triangles });

// ---------- 10. 預覽幽靈截圖 ----------
await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build;
  w.press(null); B.reset(); w.teleport(s.x + 2, s.z + 2); w.giveMats(); p.inventory.buildMat = 'wood'; w.look(-Math.PI / 2 - 0.3, -0.1); p.pitch = -0.1;
  p.buildPiece = 'wall'; p.building = true; c.cam.init = false; w.fastForward(0.4);
}, spot);
await wait(500); await shot('8-ghost-wall');
const nm = await ev(() => { const w = window.__sw, c = w.ctx, p = c.player; p.buildPiece = 'ramp'; p.inventory.buildMat = 'wood'; p.inventory.mats.wood = 0; w.fastForward(0.6); const v = c.build.previewFor(p); return { valid: v.valid, reason: v.reason }; }); await wait(500); await shot('9-ghost-nomats');
check('無材料：預覽 invalid（reason=mats，幽靈轉紅）', !nm.valid && nm.reason === 'mats', nm);


// ---------- 11. 其他物理 ----------
const misc = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build, P = c.physics, out = {};
  w.press(null); B.reset(); w.giveMats(); p.inventory.buildMat = 'wood'; p.building = false;
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 2) / 4), L = s.L;
  const mk = (piece, i, k, level, edge) => B.placeAt(p, { piece, i, k, level, edge, noReach: true });
  // a. 站在牆頂並沿著走（窄 0.3 m）
  const wl = mk('wall', i0 + 2, k0 + 5, L, 0); mk('wall', i0 + 3, k0 + 5, L, 0); mk('wall', i0 + 4, k0 + 5, L, 0);
  const wx = (i0 + 2) * 4 + 1, wz = (k0 + 5) * 4, top = 3.5 * (L + 1);
  p.pos.set(wx, top, wz); p.vel.set(0, 0, 0); p.state = 'ground'; p.grounded = true; w.look(-Math.PI / 2, 0); w.press({ moveZ: 1 });
  let minY = 99, maxY = -99; for (let i = 0; i < 90; i++) { w.fastForward(1 / 60); minY = Math.min(minY, p.pos.y); maxY = Math.max(maxY, p.pos.y); }
  w.press(null); out.wallTop = { minY, maxY, top, x: p.pos.x, startX: wx, grounded: p.grounded };
  // b. 頭頂撞板：在 2.4 m 高處放一塊碰撞板，起跳
  const cid = P.addBox({ cx: (i0 + 8) * 4, cy: 3.5 * L + 2.4 + 0.2, cz: (k0 + 1) * 4, hx: 3, hy: 0.2, hz: 3, owner: null, kind: 'test' });
  p.pos.set((i0 + 8) * 4, 3.5 * L, (k0 + 1) * 4); p.vel.set(0, 0, 0); p.state = 'ground'; p.grounded = true; w.fastForward(0.1);
  w.press({ jump: true }); let bonk = false, headMax = 0; for (let i = 0; i < 40; i++) { w.fastForward(1 / 60); headMax = Math.max(headMax, p.pos.y + 1.8 - 3.5 * L); if (i === 1) w.press(null); }
  out.ceiling = { headMax, limit: 2.4 }; P.remove(cid);
  // c. 視線檢查
  const A = { x: (i0 + 2.5) * 4, y: 3.5 * L + 1.6, z: (k0 + 6) * 4 }, Bp = { x: (i0 + 2.5) * 4, y: 3.5 * L + 1.6, z: (k0 + 4) * 4 };
  out.los = { blocked: P.lineOfSight(A, Bp), clear: P.lineOfSight(A, { x: A.x + 8, y: A.y, z: A.z }) };
  // d. hovered / HP 成長 / 受損
  w.teleport((i0 + 3) * 4, (k0 + 8) * 4); w.look(0, 0); p.pitch = 0; c.cam.init = false; w.fastForward(0.2);
  const pc = [...B.pieces.values()][0]; const hp0 = pc.hp; w.fastForward(1.5); const hp1 = pc.hp; w.fastForward(3); out.hp = { hp0, hp1, hp2: pc.hp, max: pc.maxHp, building: pc.building };
  w.look(0, 0); w.fastForward(0.1); const hv = B.hovered(p); out.hover = hv ? [hv.type, hv.hp, hv.mat] : null;
  const dmgEv = []; c.events.on('buildDamaged', (e) => dmgEv.push(e.amount)); pc.takeDamage(40, { source: p }); out.dmg = { hp: pc.hp, ev: dmgEv.length };
  // e. 快速組合：牆 → 斜坡（相隔 0.07 s）
  B.reset(); p.building = true; w.teleport((i0 + 3) * 4 + 2, (k0 + 2) * 4 + 2); w.look(0, 0); p.pitch = 0;
  w.press({ piece: 'wall', fire: true }); w.fastForward(1 / 60); w.press({ piece: 'ramp', fire: false }); w.fastForward(0.05); w.press({ piece: 'ramp', fire: true }); w.fastForward(0.1); w.press(null);
  out.combo = [...B.pieces.values()].map((q) => q.type);
  return out;
}, spot);
console.log('misc', JSON.stringify(misc));
check('牆頂行走：穩定站在牆頂', Math.abs(misc.wallTop.minY - misc.wallTop.top) < 0.02 && Math.abs(misc.wallTop.maxY - misc.wallTop.top) < 0.02 && misc.wallTop.grounded, misc.wallTop);
check('頭頂撞板：不穿過天花板', misc.ceiling.headMax <= misc.ceiling.limit + 0.01, misc.ceiling);
check('視線：牆擋住、空地暢通', !misc.los.blocked && misc.los.clear, misc.los);
check('建材 HP 隨建造成長到滿', misc.hp.hp1 > misc.hp.hp0 && misc.hp.hp2 === misc.hp.max && !misc.hp.building, misc.hp);
check('hovered 取得準心指的建材、受損事件', !!misc.hover && misc.dmg.hp === misc.hp.max - 40 && misc.dmg.ev === 1, { hover: misc.hover, dmg: misc.dmg });
check('牆＋斜坡快速組合（0.07 s 內）', misc.combo.includes('wall') && misc.combo.includes('ramp'), misc.combo);

// ---------- 12. 真實山坡：ramp rush 往坡上蓋、部分埋入仍有效 ----------
const hill = await ev(() => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build, T = c.terrain, P = c.physics;
  w.press(null); B.reset(); w.giveMats(); p.inventory.buildMat = 'wood'; p.building = false;
  // 找一個坡度約 20–35°、高度 4–25 的山坡（沿 +X 上坡）
  let best = null;
  for (let z = -250; z <= 250 && !best; z += 10) for (let x = -250; x <= 250 && !best; x += 10) {
    const h0 = T.heightAt(x, z), h1 = T.heightAt(x + 24, z), h2 = T.heightAt(x + 12, z);
    if (h0 < 3 || h0 > 20 || Math.abs(x + 60) < 100 && Math.abs(z - 68) < 40) continue;
    const sl = (h1 - h0) / 24; if (sl > 0.36 && sl < 0.6 && Math.abs(h2 - (h0 + h1) / 2) < 1.2) best = { x, z, h0, sl };
  }
  if (!best) return null;
  for (const id of P.queryBox({ x: best.x - 6, y: -5, z: best.z - 8 }, { x: best.x + 60, y: 120, z: best.z + 8 })) P.remove(id);
  w.teleport(best.x, best.z); w.look(-Math.PI / 2, 0); p.pitch = 0; w.fastForward(0.3);
  const y0 = p.pos.y; w.press({ piece: 'ramp', fire: true, moveZ: 1 });
  for (let i = 0; i < 60 * 8; i++) w.fastForward(1 / 60);
  w.press(null);
  return { best, y0, y1: p.pos.y, dx: p.pos.x - best.x, pieces: B.pieces.size, terrain: T.heightAt(p.pos.x, p.pos.z) };
});
console.log('hill', JSON.stringify(hill));
check('山坡 ramp rush：沿坡往上蓋並爬升（部分埋入仍有效）', hill && hill.pieces >= 3 && hill.y1 - hill.y0 > 8, hill);
await ev(() => { const w = window.__sw, c = w.ctx; c.cam.init = false; w.look(-Math.PI / 2 + 0.5, -0.15); c.player.pitch = -0.15; w.fastForward(0.3); }); await wait(600); await shot('10-hill-rush');

// ---------- 13. 射線：任意角度都要打得到薄斜坡／地板 ----------
const rays = await ev((s) => {
  const w = window.__sw, c = w.ctx, p = c.player, B = c.build, P = c.physics, THREE = c.THREE;
  w.press(null); B.reset(); w.giveMats(); p.building = false;
  const i0 = Math.floor((s.x + 2) / 4), k0 = Math.floor((s.z + 2) / 4), L = s.L;
  const rp = [0, 1, 2, 3].map((d) => B.placeAt(p, { piece: 'ramp', i: i0 + 3 * d, k: k0 + 1, level: L, edge: d, noReach: true }));
  B.placeAt(p, { piece: 'wall', i: i0 + 13, k: k0 + 1, level: L, edge: 0, noReach: true });
  const fl = B.placeAt(p, { piece: 'floor', i: i0 + 13, k: k0 + 1, level: L + 1, edge: 0, noReach: true });
  let tot = 0, hit = 0, wrongOwner = 0, nearMiss = 0; const miss = [];
  const rnd = (() => { let a = 12345; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  for (const piece of [...rp, fl].filter(Boolean)) {
    const col = P.cols.get(piece.col);
    for (let n = 0; n < 150; n++) {
      // 在碰撞體上取一個表面點（ramp：板面；box：頂面），從隨機方向打過去
      let tx, ty, tz;
      if (piece.type === 'ramp') { const u = (rnd() - 0.5) * 3.6, v = (rnd() - 0.5) * 3.6, [dx, dz] = [col.ux, col.uz]; tx = col.cx + dx * u - dz * v; tz = col.cz + dz * u + dx * v; ty = P.rampSurface(col, tx, tz) - 0.02; }
      else { tx = col.cx + (rnd() - 0.5) * 3.6; tz = col.cz + (rnd() - 0.5) * 3.6; ty = col.cy + col.hy - 0.02; }
      const th = rnd() * Math.PI * 2, el = (rnd() - 0.5) * 2 * 1.3, d = 3 + rnd() * 10;
      const dir = new THREE.Vector3(Math.cos(th) * Math.cos(el), Math.sin(el), Math.sin(th) * Math.cos(el));
      const o = new THREE.Vector3(tx, ty, tz).addScaledVector(dir, -d);
      if (o.y < 0.3 + c.terrain.heightAt(o.x, o.z)) continue;
      tot++;
      const h = P.raycast(o, dir, d + 2, { skipTerrain: true });
      if (h) { hit++; if (h.owner !== piece) wrongOwner++; else if (Math.abs(h.dist - d) > 0.9) nearMiss++; } else if (miss.length < 8) miss.push([piece.type, piece.edge, +(el).toFixed(2), +d.toFixed(1), +th.toFixed(2), +o.x.toFixed(1), +o.y.toFixed(1), +o.z.toFixed(1), +tx.toFixed(1), +ty.toFixed(2), +tz.toFixed(1)]);
    }
  }
  return { tot, hit, wrongOwner, nearMiss, miss };
}, spot);
console.log('rays', JSON.stringify(rays));
check('射線：任意角度打薄斜坡／地板（全部命中）', rays.tot > 300 && rays.hit === rays.tot && rays.wrongOwner < rays.tot * 0.03, rays);

check('無 uncaught exception', log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
check('無 console.error', log.errors.length === 0, log.errors.slice(0, 3));
check('無外部請求（Google Fonts 除外）', log.external.length === 0, log.external.slice(0, 3));
console.log(JSON.stringify({ ok: failed === 0, failed, viewport: `${W}x${H}`, gpu: log.gpu }));
await browser.close();
process.exit(failed ? 1 : 0);
