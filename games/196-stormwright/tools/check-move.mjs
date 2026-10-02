// track move 驗證：node tools/check-move.mjs <html> [--out dir]
// 以 __sw 腳本量測：加速曲線、衝刺速度、跳躍高度、翻越 1.2 m 箱子、樓梯平順度、鏡頭不鑽牆、ADS 過渡、跳傘→滑翔→落地；並截圖各鏡頭構圖。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--out');
const oi = a.indexOf('--out');
const outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/move/check');
mkdirSync(outDir, { recursive: true });
let failed = 0;
const report = {};
const check = (n, ok, d) => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d === undefined ? '' : JSON.stringify(d)}`); };

// 在頁面內的輔助：找一塊平坦地、在其上擺碰撞盒與視覺網格
const SETUP = () => {
  const sw = window.__sw, c = sw.ctx, T = c.terrain;
  window.__flat = (size = 16) => {
    let best = null;
    for (let x = -300; x <= 300; x += 7) for (let z = -300; z <= 300; z += 7) {
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) { const h = T.heightAt(x + (i - 2) * size / 4, z + (k - 2) * size / 4); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (lo > 0.8 && hi - lo < 0.25 && (!best || hi - lo < best.d) && !c.physics.overlapsCapsule(x, lo, z, size * 0.6, 8)) best = { x, z, y: (lo + hi) / 2, d: hi - lo };
    }
    return best;
  };
  window.__box = (cx, cy, cz, hx, hy, hz, color = 0xff8844) => {
    const id = c.physics.addBox({ cx, cy, cz, hx, hy, hz, kind: 'box' });
    const m = new c.THREE.Mesh(new c.THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), new c.THREE.MeshStandardMaterial({ color }));
    m.position.set(cx, cy, cz); m.castShadow = m.receiveShadow = true; c.scene.add(m);
    (window.__tmp = window.__tmp || []).push({ id, m }); return id;
  };
  window.__clean = () => { for (const t of window.__tmp || []) { c.physics.remove(t.id); c.scene.remove(t.m); } window.__tmp = []; };
  window.__place = (x, z, yaw = 0) => { sw.teleport(x, z); sw.look(yaw, 0); c.player.vel.set(0, 0, 0); c.cam.init = false; };
};

const { browser, page, log } = await open(html, { w: 1440, h: 900 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = (n) => page.screenshot({ path: resolve(outDir, n + '.png') });
const wait = (ms) => page.waitForTimeout(ms);

await ev(SETUP);
await ev(() => window.__sw.start());
await wait(1200);
// ---- 飛艇鏡頭截圖 ----
await shot('bus');
const busCam = await ev(() => { const c = window.__sw.ctx; return { state: c.player.state, camY: c.camera.position.y, fov: c.camera.fov }; });
report.bus = busCam;

await ev(() => { const sw = window.__sw; sw.skipToGround(); sw.freezeBots(true); sw.give('ar', 3); sw.give('sniper', 3); sw.give('pump', 2); sw.give('ar', 3); });
const flat = await ev(() => window.__flat());
console.log('flat spot', flat);
const F = flat;

// ---- 加速曲線 / 衝刺速度 ----
const acc = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, p = c.player; window.__clean(); window.__place(F.x, F.z, 0); sw.fastForward(0.5);
  const out = []; sw.press({ moveZ: 1 });
  for (let i = 0; i < 40; i++) { sw.fastForward(1 / 60); out.push(+Math.hypot(p.vel.x, p.vel.z).toFixed(2)); }
  const sprintSpeed = out[out.length - 1], sprinting = p.sprinting;
  sw.press(null); const dec = []; for (let i = 0; i < 20; i++) { sw.fastForward(1 / 60); dec.push(+Math.hypot(p.vel.x, p.vel.z).toFixed(2)); }
  // 走路（auto sprint 關）
  c.settings.autoSprint = false; sw.press({ moveZ: 1 }); sw.fastForward(1); const walk = Math.hypot(p.vel.x, p.vel.z); sw.press({ moveZ: 1, sprint: true }); sw.fastForward(0.5); const sp = Math.hypot(p.vel.x, p.vel.z);
  sw.press({ moveZ: 1, crouch: true }); sw.fastForward(1); const cr = Math.hypot(p.vel.x, p.vel.z); sw.press(null); c.settings.autoSprint = true; sw.fastForward(1);
  return { out, dec, sprintSpeed, sprinting, walk, sp, cr, t90: out.findIndex((v) => v >= 0.9 * 6.4) / 60 };
}, F);
report.accel = { t90: acc.t90, sprint: acc.sprintSpeed, walk: acc.walk, crouch: acc.cr };
check('加速到衝刺速度的 90% < 0.25 s', acc.t90 > 0 && acc.t90 < 0.25, acc.t90);
check('衝刺 6.4 m/s', Math.abs(acc.sprintSpeed - 6.4) < 0.1 && Math.abs(acc.sp - 6.4) < 0.1, [acc.sprintSpeed, acc.sp]);
check('走 4.6 / 蹲 2.6 m/s', Math.abs(acc.walk - 4.6) < 0.1 && Math.abs(acc.cr - 2.6) < 0.1, [acc.walk, acc.cr]);
check('放開後 0.2 s 內停下', acc.dec[12] < 0.5, acc.dec.slice(0, 14));

// ---- 跳躍高度、土狼時間、跳躍緩衝 ----
const jump = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, p = c.player; window.__clean(); window.__place(F.x, F.z, 0); sw.fastForward(0.4);
  const y0 = p.pos.y; let mx = 0; sw.press({ jump: true }); sw.fastForward(1 / 60); sw.press(null);
  for (let i = 0; i < 70; i++) { sw.fastForward(1 / 60); mx = Math.max(mx, p.pos.y - y0); }
  const landed = p.grounded;
  // 緩衝：落地前 0.08 s 按跳 → 落地後立刻再跳
  sw.press({ jump: true }); sw.fastForward(1 / 60); sw.press(null); let g = false; for (let i = 0; i < 25 && !g; i++) { sw.fastForward(1 / 60); }
  p.pos.y += 1.0; p.vel.y = -4; p.grounded = false; p.state = 'air';
  let n = 0; while (!p.grounded && n++ < 60) { if (p.pos.y - F.y < 0.6) { sw.press({ jump: true }); } sw.fastForward(1 / 60); sw.press(null); }
  sw.fastForward(1 / 20); const buf = !p.grounded || p.vel.y > 0 || p.pos.y - y0 > 0.05;
  // 土狼：走離一個箱子邊緣後 0.08 s 仍可跳
  sw.fastForward(1);
  const bid = window.__box(F.x, F.y + 0.5, F.z - 2.0, 1.5, 0.5, 1.0); // 頂高 +1.0 太高，改低一點
  window.__clean(); window.__box(F.x, F.y + 0.2, F.z - 2.0, 1.5, 0.2, 1.0);
  window.__place(F.x, F.z - 2.0, 0); p.pos.y = F.y + 0.4; p.grounded = true; sw.fastForward(0.2);
  sw.press({ moveZ: 1 }); let k = 0; while (p.grounded && k++ < 120) sw.fastForward(1 / 60);
  const offY = p.pos.y; sw.fastForward(1 / 30); sw.press({ moveZ: 1, jump: true }); sw.fastForward(1 / 60); sw.press({ moveZ: 1 });
  const vy = p.vel.y; sw.press(null); window.__clean();
  return { height: mx, landed, buf, coyoteVy: vy };
}, F);
report.jump = jump;
check('跳躍高度 ≈ 1.18 m', Math.abs(jump.height - 1.18) < 0.12, jump.height);
check('跳躍緩衝（落地前按跳）', jump.buf);
check('土狼時間（離邊後 33 ms 仍能跳）', jump.coyoteVy > 3, jump.coyoteVy);

// ---- 翻越 1.2 m 箱子 ----
const mantle = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, p = c.player; window.__clean();
  window.__box(F.x, F.y + 0.6, F.z - 2.0, 1.5, 0.6, 1.2); // 前方 1.5 m 處的 1.2 m 高箱子（面向 -Z）
  window.__place(F.x, F.z, 0); sw.fastForward(0.3);
  const trace = []; let mantled = false; c.events.on('mantle', () => (mantled = true));
  sw.press({ moveZ: 1 }); sw.fastForward(0.15); sw.press({ moveZ: 1, jump: true }); sw.fastForward(1 / 60); sw.press({ moveZ: 1 });
  for (let i = 0; i < 90; i++) { sw.fastForward(1 / 60); trace.push(+p.pos.y.toFixed(2)); if (mantled && p.grounded && !p.mantling) { sw.press(null); } }
  sw.press(null);
  const maxStep = trace.reduce((m, v, i) => (i ? Math.max(m, Math.abs(v - trace[i - 1])) : 0), 0);
  return { mantled, y: p.pos.y - F.y, grounded: p.grounded, z: p.pos.z - F.z, maxStep, trace: trace.filter((_, i) => i % 6 === 0) };
}, F);
report.mantle = mantle;
check('翻越 1.2 m 箱子', mantle.mantled && Math.abs(mantle.y - 1.2) < 0.08 && mantle.grounded, mantle);
check('翻越平滑（每步 y 變化 < 0.12 m）', mantle.maxStep < 0.12, mantle.maxStep);
await ev((F) => { const sw = window.__sw; window.__clean(); window.__box(F.x, F.y + 0.6, F.z - 5.0, 1.5, 0.6, 0.5); window.__place(F.x + 0.8, F.z - 1.5, 0.35); window.__sw.ctx.cam.init = false; }, F);
await wait(600); await shot('ground');
await ev(() => window.__clean());

// ---- 樓梯（0.3 m 階高 × 8，階深 0.6 m）：y 與視覺 / 鏡頭每步變化 ----
const stairs = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, p = c.player; window.__clean();
  for (let i = 0; i < 10; i++) window.__box(F.x, F.y + 0.15 * (i + 1) * 2 / 2, F.z - 2 - i * 0.6, 1.0, 0.15 * (i + 1), 0.3, 0x88aacc);
  window.__place(F.x, F.z + 1, 0); sw.fastForward(0.3);
  const posY = [], visY = [], camY = []; const v = new c.THREE.Vector3();
  sw.press({ moveZ: 1 });
  for (let i = 0; i < 60; i++) { sw.fastForward(1 / 60); p.visPos(v); posY.push(p.pos.y); visY.push(v.y); camY.push(c.camera.position.y); }
  sw.press(null);
  const md = (arr) => arr.reduce((m, x, i) => (i ? Math.max(m, Math.abs(x - arr[i - 1])) : 0), 0);
  return { rise: p.pos.y - F.y, maxPos: md(posY), maxVis: md(visY), maxCam: md(camY) };
}, F);
report.stairs = stairs;
check('走上階梯', stairs.rise > 1.5, stairs.rise);
check('階梯：視覺高度每步跳動 < 物理跳動的 55%', stairs.maxVis < stairs.maxPos * 0.55 + 0.01, stairs);
check('階梯：鏡頭每步垂直位移 < 0.12 m', stairs.maxCam < 0.12, stairs.maxCam);
await ev((F) => { window.__place(F.x + 0.3, F.z + 2.5, 0.12); window.__sw.press({ moveZ: 1 }); }, F);
await wait(700); await shot('stairs'); await ev(() => { window.__sw.press(null); window.__clean(); });

// ---- 鏡頭不鑽牆：四面牆的狹小空間、貼牆、轉一圈 ----
const camWall = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, p = c.player; window.__clean();
  const h = 1.5, d = 1.2;
  window.__box(F.x - d - 0.2, F.y + h, F.z, 0.2, h, 2.5); window.__box(F.x + d + 0.2, F.y + h, F.z, 0.2, h, 2.5);
  window.__box(F.x, F.y + h, F.z + 2.2, 2.5, h, 0.2); window.__box(F.x, F.y + h, F.z - 2.2, 2.5, h, 0.2);
  window.__box(F.x + 5, F.y + 1.2, F.z + 8, 3, 1.2, 0.3); // 單面牆（背對）
  window.__place(F.x, F.z, 0); sw.fastForward(0.5);
  let bad = 0, n = 0, minUse = 9; const P = c.physics, cam = c.camera;
  for (const pitch of [-0.5, -0.15, 0.3, 0.9]) for (let k = 0; k < 16; k++) {
    sw.look(k / 16 * Math.PI * 2, pitch); c.cam.init = false; sw.fastForward(0.25);
    n++;
    const x = cam.position.x, y = cam.position.y, z = cam.position.z;
    // 鏡頭球心不得在實體內（用 0.12 m 球近似）
    if (P.overlapsCapsule(x, y - 0.12, z, 0.12, 0.24)) bad++;
    // 樞軸到鏡頭的線段不得穿牆
    const o = c.cam.pivot, dir = new c.THREE.Vector3(x - o.x, y - o.y, z - o.z), L = dir.length(); dir.divideScalar(L || 1);
    const hit = P.raycast(o, dir, L - 0.05, { skipTerrain: true }); if (hit) bad++;
    minUse = Math.min(minUse, L);
  }
  // 貼單面牆（牆在背後 0.5 m）
  window.__place(F.x + 5, F.z + 7.0, 0); sw.fastForward(0.2); let b2 = 0;
  for (let k = 0; k < 12; k++) { sw.look(k / 12 * Math.PI * 2, -0.1); c.cam.init = false; sw.fastForward(0.2); const x = cam.position.x, y = cam.position.y, z = cam.position.z; if (P.overlapsCapsule(x, y - 0.12, z, 0.12, 0.24)) { b2++; (window.__dbg = window.__dbg || []).push({ k, x: x - F.x, y: y - F.y, z: z - F.z, use: c.cam.clear, pv: [c.cam.pivot.x - F.x, c.cam.pivot.y - F.y, c.cam.pivot.z - F.z] }); } }
  sw.look(0, -0.1); c.cam.init = false; sw.fastForward(0.4);
  return { bad, n, b2, minUse, dbg: window.__dbg };
}, F);
report.camWall = camWall;
check('鏡頭不鑽進幾何（密閉小房間 64 取樣＋貼牆 12 取樣）', camWall.bad === 0 && camWall.b2 === 0, camWall);
await ev((F) => { window.__place(F.x, F.z, 0.4); window.__sw.look(0.4, -0.15); window.__sw.ctx.cam.init = false; }, F);
await wait(500); await shot('cam-closet');
await ev(() => window.__clean());

// ---- ADS 過渡（≈ 0.15 s）、狙擊鏡 ----
const ads = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, p = c.player; window.__clean(); window.__place(F.x, F.z, 0); sw.fastForward(0.6);
  p.inventory.selected = p.inventory.slots.findIndex((x) => x && x.defId === 'ar') + 1; // ar
  const f0 = c.camera.fov, series = []; sw.press({ ads: true });
  for (let i = 0; i < 16; i++) { sw.fastForward(1 / 60); series.push(+c.camera.fov.toFixed(1)); }
  const f1 = c.camera.fov; const t90 = series.findIndex((v) => (f0 - v) >= 0.9 * (f0 - f1)) / 60;
  const sh = c.cam.shoulder; sw.press(null); sw.fastForward(0.6);
  return { f0, f1, t90, series, back: c.camera.fov };
}, F);
report.ads = ads;
check('ADS 縮放到 ~50 FOV（約 0.15 s）', Math.abs(ads.f1 - 50) < 2 && ads.t90 <= 0.2, ads);
check('放開 ADS 回到預設 FOV', Math.abs(ads.back - ads.f0) < 1.5, [ads.f0, ads.back]);
await ev((F) => { const sw = window.__sw, c = sw.ctx; window.__place(F.x, F.z, 0.3); c.player.inventory.selected = c.player.inventory.slots.findIndex((x) => x && x.defId === 'ar') + 1; sw.press({ ads: true }); }, F);
await wait(500); await shot('ads');
await ev((F) => { const sw = window.__sw, c = sw.ctx; const i = c.player.inventory.slots.findIndex((s) => s && s.defId === 'sniper'); c.player.inventory.selected = i + 1; sw.press({ ads: true }); }, F);
await wait(600); await shot('sniper-scope');
const scope = await ev(() => { const c = window.__sw.ctx; return { fov: c.camera.fov, hidden: c.player.view.root ? !c.player.view.root.visible : null, scoped: c.cam.scoped }; });
report.scope = scope;
check('狙擊鏡 FOV 20 並隱藏角色模型', Math.abs(scope.fov - 20) < 1.5 && scope.hidden === true, scope);
await ev(() => { const sw = window.__sw; sw.press(null); });
await wait(400);
const showAgain = await ev(() => !!window.__sw.ctx.player.view.root.visible);
check('離開狙擊鏡後角色模型回來', showAgain);

// ---- 衝刺、蹲下構圖 ----
await ev((F) => { const sw = window.__sw, c = sw.ctx; window.__place(F.x - 3, F.z + 6, 0.5); c.player.inventory.selected = 2; sw.press({ moveZ: 1 }); }, F);
await wait(900); await shot('sprint'); const sprintFov = await ev(() => window.__sw.ctx.camera.fov);
await ev(() => window.__sw.press({ crouch: true }));
await wait(700); await shot('crouch');
const crouch = await ev(() => { const c = window.__sw.ctx; return { crouching: c.player.crouching, pivotY: c.cam.pivot.y - c.player.pos.y }; });
check('衝刺 FOV 比站立大 ~5', sprintFov > 75 + 3, sprintFov);
check('蹲下鏡頭降低', crouch.crouching && crouch.pivotY < 1.6, crouch);
await ev(() => window.__sw.press(null));

// ---- 後座力與震動 ----
const rec = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, pc = c.playerCtl; window.__place(F.x, F.z, 0); sw.look(0, 0); sw.fastForward(0.5);
  const p0 = pc.pitch; c.cam.addRecoil(0.05, 0.01); const p1 = pc.pitch; sw.fastForward(0.05); const mid = pc.pitch; sw.fastForward(1); const p2 = pc.pitch;
  c.cam.shake(0.6, 0.4); const q0 = c.camera.position.clone(); let mv = 0; for (let i = 0; i < 12; i++) { sw.fastForward(1 / 60); mv = Math.max(mv, c.camera.position.distanceTo(q0)); }
  return { kick: p1 - p0, after: p2 - p0, recovered: (p1 - p2) / (p1 - p0), shakeMove: mv };
}, F);
report.recoil = rec;
check('後座力：上抬後部分回復（40–90%）', rec.kick > 0.04 && rec.recovered > 0.4 && rec.recovered < 0.9, rec);
check('shake 有位移', rec.shakeMove > 0.005, rec.shakeMove);

// ---- 斜坡鏈（建材）平順度 ----
const ramps = await ev((F) => {
  const sw = window.__sw, c = sw.ctx, p = c.player; window.__clean();
  for (let i = 0; i < 4; i++) c.physics.addRamp({ cx: Math.round(F.x / 4) * 4 + 2, cz: Math.round(F.z / 4) * 4 - 2 - i * 4, y0: F.y + i * 3.5, size: 4, rise: 3.5, dir: 0 });
  window.__place(Math.round(F.x / 4) * 4 + 2, Math.round(F.z / 4) * 4 + 3, 0); sw.fastForward(0.3);
  const camY = []; sw.press({ moveZ: 1 }); for (let i = 0; i < 100; i++) { sw.fastForward(1 / 60); camY.push(c.camera.position.y); } sw.press(null);
  return { rise: p.pos.y - F.y, maxCam: camY.reduce((m, x, i) => (i ? Math.max(m, Math.abs(x - camY[i - 1])) : 0), 0) };
}, F);
report.ramps = ramps;
check('斜坡鏈：爬升並且鏡頭每步位移 < 0.16 m', ramps.rise > 5 && ramps.maxCam < 0.16, ramps);
await ev(() => { for (const id of [...window.__sw.ctx.physics.cols.keys()].slice(-4)) window.__sw.ctx.physics.remove(id); });

// ---- 跳傘 → 滑翔 → 落地（無摔傷）----
const sky = await ev(() => {
  const sw = window.__sw, c = sw.ctx, p = c.player; sw.freezeBots(true);
  p.health = 100; p.shield = 0; p.pos.set(40, 260, 60); p.vel.set(0, 0, 0); p.state = 'skydive'; p.grounded = false; c.cam.init = false; sw.look(0.6, -0.4);
  return { alt: p.altitude() };
});
await wait(500); await shot('skydive');
const sk1 = await ev(() => { const p = window.__sw.ctx.player; return { state: p.state, vy: p.vel.y, bank: p.bank, fov: window.__sw.ctx.camera.fov }; });
await ev(() => { const sw = window.__sw; sw.press({ moveX: 1 }); });
await ev(() => window.__sw.fastForward(1));
const sk2 = await ev(() => { const p = window.__sw.ctx.player; return { state: p.state, bank: p.bank }; });
await ev(() => { window.__sw.press(null); window.__sw.look(0.6, -0.1); const p = window.__sw.ctx.player; p.pos.y = window.__sw.ctx.terrain.heightAt(p.pos.x, p.pos.z) + 75; });
await ev(() => window.__sw.fastForward(1));
const sk3 = await ev(() => { const p = window.__sw.ctx.player; return { state: p.state, alt: p.altitude(), opened: p.glideOpened }; });
await wait(500); await shot('glide');
const sk4 = await ev(() => { const sw = window.__sw, c = sw.ctx, p = c.player; sw.press({ moveX: -1 }); sw.fastForward(0.8); const bank = p.bank; sw.press(null); let n = 0; while (p.state !== 'ground' && n++ < 60) sw.fastForward(0.5); return { state: p.state, health: p.health, bank, t: n }; });
report.sky = { sk1, sk2, sk3, sk4 };
check('自由落體 vy ~ -55 並有傾斜', sk1.state === 'skydive' && sk1.vy < -30 && Math.abs(sk2.bank) > 0.1, [sk1, sk2]);
check('離地 < 45 m 自動開滑翔翼', sk3.state === 'glide' && sk3.opened, sk3);
check('滑翔轉向帶動傾斜、落地無摔傷', sk4.state === 'ground' && sk4.health === 100 && Math.abs(sk4.bank) > 0.15, sk4);
const reOpen = await ev(() => { const c = window.__sw.ctx, p = c.player; p.pos.y += 40; p.vel.set(0, -30, 0); p.grounded = false; p.state = 'air'; c.player.intent.deploy = true; window.__sw.press({ jump: true }); window.__sw.fastForward(0.2); window.__sw.press(null); return p.state; });
check('落地後不可再開滑翔翼（空中 state 不變成 glide）', reOpen !== 'glide' && reOpen !== 'skydive', reOpen);

// ---- 觀戰 / 勝利環繞 API ----
const spec = await ev(() => {
  const sw = window.__sw, c = sw.ctx; sw.skipToGround(); sw.freezeBots(true);
  const bot = c.actors.find((x) => !x.isPlayer && x.alive); const f1 = !!(c.cam.follow && c.cam.orbit && c.cam.addRecoil && c.cam.shake && c.cam.cycleSpectate);
  c.player.takeDamage(999, { ignoreShield: true }); sw.fastForward(0.5);
  c.cam.follow(bot); sw.fastForward(1); const dist1 = Math.hypot(c.camera.position.x - bot.pos.x, c.camera.position.z - bot.pos.z);
  const nxt = c.cam.cycleSpectate(1); sw.fastForward(0.3);
  return { f1, dist1, cycled: !!nxt && nxt !== bot, focus: c.cam.focusActor() === nxt };
});
report.spectate = spec;
check('follow / cycleSpectate / orbit / addRecoil / shake 皆可呼叫，觀戰鏡頭在目標附近', spec.f1 && spec.dist1 < 7 && spec.cycled && spec.focus, spec);
await wait(300); await shot('spectate');
await ev(() => { const sw = window.__sw; sw.start(); sw.skipToGround(); sw.freezeBots(false); });

// ---- 手把（以假裝置驗證映射）----
const pad = await ev(() => {
  const inp = window.__sw.ctx.input;
  const mk = (pressed, axes) => [{ connected: true, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) }];
  navigator.getGamepads = () => mk([0, 7, 6], [0, -1, 0.8, 0.2]);
  const s1 = { ...inp.poll() };
  navigator.getGamepads = () => mk([7, 6], [0, 0, 0, 0]);
  const s2 = { ...inp.poll() };
  navigator.getGamepads = () => mk([5, 12], [0, 0, 0, 0]);
  const s3 = { ...inp.poll() };
  navigator.getGamepads = () => [];
  const dev = inp.device;
  return { s1: { z: s1.moveZ, jump: s1.jump, fire: s1.fire, ads: s1.ads, lx: s1.lookX }, s2jump: s2.jump, s3: { wheel: s3.wheel, piece: s3.piece }, dev };
});
report.pad = pad;
check('手把：左搖桿前進、A 跳、RT 開火、LT 瞄準、右搖桿轉視角、RB 換格、十字鍵上＝牆', pad.s1.z > 0.9 && pad.s1.jump && pad.s1.fire && pad.s1.ads && pad.s1.lx > 5 && !pad.s2jump && pad.s3.wheel === 1 && pad.s3.piece === 'wall' && pad.dev === 'pad', pad);

// ---- 效能 ----
const stats = await ev(() => window.__sw.stats());
report.stats = stats;
check('1440x900：draw calls ≤ 350、fps ≥ 55', stats.drawCalls <= 350 && stats.fps >= 55, stats);

check('無 uncaught exception', log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
check('無 console.error', log.errors.length === 0, log.errors.slice(0, 3));
check('無外部請求', log.external.length === 0, log.external.slice(0, 3));
await browser.close();

// ---- 手機：觸控疊層截圖與檢查（375×667 小機型與 390×844）----
for (const [w, h, tag] of [[390, 844, 'touch-390'], [375, 667, 'touch-375'], [844, 390, 'touch-landscape']]) {
  const m = await open(html, { w, h, touch: true });
  const e2 = (fn, arg) => m.page.evaluate(fn, arg);
  await e2(() => window.__sw.start()); await e2(() => { const sw = window.__sw; sw.skipToGround(); sw.freezeBots(true); sw.give('ar', 3); });
  await m.page.waitForTimeout(900); await m.page.screenshot({ path: resolve(outDir, tag + '.png') });
  const info = await e2(() => {
    const out = { overflow: document.documentElement.scrollWidth, small: [] };
    document.querySelectorAll('#touch .tc-btn').forEach((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); if (cs.display !== 'none' && (r.width < 44 || r.height < 44)) out.small.push(b.className + ' ' + r.width); });
    out.offscreen = []; document.querySelectorAll('#touch .tc-btn').forEach((b) => { const r = b.getBoundingClientRect(); if (getComputedStyle(b).display !== 'none' && (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight)) out.offscreen.push(b.className); });
    return out;
  });
  check(`${tag}：無水平溢出、按鈕 ≥ 44 px、都在螢幕內`, info.overflow <= w && info.small.length === 0 && info.offscreen.length === 0, info);
  if (tag === 'touch-390') {
    // 搖桿：在左側按下拖曳 → 往前移動；右側拖曳 → 轉視角；建造模式按鈕出現
    const before = await e2(() => ({ yaw: window.__sw.ctx.playerCtl.yaw, z: window.__sw.ctx.player.pos.z, x: window.__sw.ctx.player.pos.x }));
    const cdp = await m.page.context().newCDPSession(m.page);
    const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await tp('touchStart', [{ x: 90, y: 600, id: 1 }]); await tp('touchMove', [{ x: 90, y: 560, id: 1 }]);
    await tp('touchStart', [{ x: 90, y: 560, id: 1 }, { x: 250, y: 300, id: 2 }]);
    for (let i = 1; i <= 8; i++) await tp('touchMove', [{ x: 90, y: 560, id: 1 }, { x: 250 + i * 12, y: 300, id: 2 }]);
    await m.page.waitForTimeout(500);
    await m.page.screenshot({ path: resolve(outDir, 'touch-joystick.png') });
    await tp('touchEnd', []);
    const after = await e2(() => ({ yaw: window.__sw.ctx.playerCtl.yaw, z: window.__sw.ctx.player.pos.z, x: window.__sw.ctx.player.pos.x }));
    check('觸控：浮動搖桿移動＋右側拖曳轉視角', Math.hypot(after.x - before.x, after.z - before.z) > 1.5 && Math.abs(after.yaw - before.yaw) > 0.2, { before, after });
    await e2(() => { window.__sw.ctx.player.building = true; });
    await m.page.waitForTimeout(400); await m.page.screenshot({ path: resolve(outDir, 'touch-build.png') });
    const vis = await e2(() => [...document.querySelectorAll('#touch .tc-p')].every((b) => getComputedStyle(b).display !== 'none'));
    check('觸控：建造模式顯示牆／板／坡按鈕', vis);
  }
  check(`${tag}：無 uncaught / console.error`, m.log.pageerrors.length === 0 && m.log.errors.length === 0, [m.log.pageerrors, m.log.errors]);
  await m.browser.close();
}

console.log(JSON.stringify({ ok: failed === 0, failed, report }, null, 1));
process.exit(failed ? 1 : 0);
