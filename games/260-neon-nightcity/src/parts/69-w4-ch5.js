// ═══ 主線第五章「帳本」（plans/260-story.md）：5-1 解密、5-2 舊上司、5-3 貨機、5-4 塔吊、5-5 鐵鏽、5-6 北嶺 ═══
// 5-3 跳機：借 21-air.js 的客機（AIR_P），任務中把 P.st 設成 'story'（airUpdate 的狀態鏈不認得，只照 P.x／y／z 擺位置與地面碰撞圓），
// 每幀在這裡推它沿跑道往西滑跑；開車貼著後貨艙門、速度對上就跳過去。之後黑場、字卡，羅莎從貨艙跳出來（69-v3-crash.js 的自由落體與開傘）。
// 收尾時還在 'story' 就交回 'roll'（照原本的流程起飛、換下一架）。
// 5-4 吊掛：69-gunship.js 的武裝直升機＋這裡的單擺纜繩與貨櫃（位置積分、繩長約束、去掉往外的相對速度）；
// 霓峰塔（69-v5-tower.js 的 FAC.crane 框架大樓）西面 49 m 的樓板上放一間工地辦公室，吊著的貨櫃夠快撞進去就碎掉，證物箱掉到樓下。
// 5-5 用 69-turf.js 的地盤（打完琥珀工業區收進自己的地盤）、5-6 在 69-v7-bunker.js 的地堡門口。
// 排在 69-w3-ch4.js 之後、70-render.js 之前：post、camState、keys 只能在函式裡用。

// ─── 地點 ───
const ST_VANCE = () => taleCorner(5, 3, 1, -1);   // 中城：范斯約的路口
const ST_BUNKER = () => BUNK.on ? { ...bunkerPadW() } : ST_PARK();   // 北嶺地堡的防爆門前
// 機場（SEA_FR 座標）：跑道東端，貨機從這裡往西滑跑
const ST_RWY = () => { if (!AIR_L) return ST_DOCKS(); const R = AIR_L.rwy, [x, z] = airW(R.x1 - 70, R.z - 34); return { x, z, yaw: AIR_YAW }; };
const ST_DROP = (dx = 0, dz = 0) => { if (!AIR_L) { const p = ST_DOCKS(); return { x: p.x + dx, z: p.z + dz, yaw: 0 }; } const R = AIR_L.rwy, [x, z] = airW((R.x0 + R.x1) / 2 + dx, R.z - 45 + dz); return { x, z, yaw: 0 }; };   // 跑道與滑行道之間的草地

// ─── 5-3 貨機 ───
const PL_V = 36;   // 滑跑速度上限（m/s，約 130 km/h）：追得上，但要開快車
// 後貨艙門：機身中心往後 9 m、左側 5 m（車停在這一點旁邊）
function planeDoor() {
  const P = AIR_P, [X, Z] = airW(P.x, P.z), y = P.yaw + AIR_YAW, fx = Math.sin(y), fz = Math.cos(y);
  return { x: X - fx * 9 - fz * 5, z: Z - fz * 9 + fx * 5, vx: fx * P.v, vz: fz * P.v };
}
function planeStory(on) {
  const P = AIR_P;
  if (!AIR_L) return;
  if (on) { Object.assign(P, { st: 'story', x: AIR_L.rwy.x1 - 95, z: AIR_L.rwy.z, y: 0, v: 0, yaw: -Math.PI / 2, pitch: 0, roll: 0, t: 0 }); }
  else if (P.st === 'story') { P.st = 'roll'; }
}
storyCleanups.push(a => { if (a.planeOn) { a.planeOn = 0; planeStory(false); } });
storyTicks.push((a, dt) => {
  const P = AIR_P;
  if (!a.planeOn || P.st !== 'story') return;
  if ((a.planeT += dt) > 4) P.v = Math.min(PL_V, P.v + 1.6 * dt);   // 數四秒才開始滑
  P.x -= P.v * dt;
});
// 追上貨機：開著車貼在貨艙門旁、速度差 8 m/s 以內撐 0.7 秒就跳過去；貨機滑到跑道西段就起飛
STEP.plane = {
  start: (a, s, c) => {
    c.hold = 0; c.ok = !AIR_L;
    if (!a.car) planeCar(a);   // 從檢查點重來：前面放車的步驟被跳過了
    if (player.veh !== a.car) { if (player.mode === 'drive') exitVehicle(); enterVehicle(a.car); }
    if (AIR_L) { a.planeOn = 1; a.planeT = 0; planeStory(true); }
  },
  step: (a, s, c, dt) => {
    if (c.ok) return true;
    const P = AIR_P, v = player.veh;
    if (P.st !== 'story') { storyFail(a, '貨機不見了'); return false; }
    if (P.x < AIR_L.rwy.x0 + 520) { P.st = 'roll'; storyFail(a, '貨機起飛了'); return false; }
    const d = planeDoor();
    if (v && player.mode === 'drive' && P.v > 12 && Math.hypot(d.x - v.x, d.z - v.z) < 4.5 && Math.hypot(v.vx - d.vx, v.vz - d.vz) < 8) c.hold += dt;
    else c.hold = Math.max(0, c.hold - dt);
    if (c.hold > .7) { c.ok = true; P.st = 'roll'; a.planeOn = 0; sfx.impact(12, 'body'); toast('羅莎跳進了貨艙'); }
    return c.ok;
  },
  hud: (a, s, c) => {
    const v = player.veh, d = AIR_L ? planeDoor() : null;
    if (!d) return { text: s.text, bar: -1 };
    const dd = v ? Math.hypot(d.x - v.x, d.z - v.z) : Math.hypot(d.x - pX(), d.z - pZ()), dv = v ? Math.round(Math.hypot(v.vx, v.vz) * 3.6 - AIR_P.v * 3.6) : 0;
    return { text: a.planeT < 4 ? `${s.text} · 貨機要滑出去了` : s.text, bar: c.hold / .7 * 100, num: `${Math.round(dd)} m · ${dv >= 0 ? '+' : ''}${dv} km/h` };
  },
  mark: () => { if (!AIR_L) return null; const d = planeDoor(); return { name: '後貨艙門', x: d.x, y: 2.5, z: d.z, where: 'out' }; },
  skip: (a, s, c) => { c.ok = true; if (AIR_P.st === 'story') AIR_P.st = 'roll'; a.planeOn = 0; },
};
// 任務車：機場沒有車流的路網，直接擺在跑道東端旁
function planeCar(a) {
  const p = ST_RWY(), v = buildVeh(TYPES.senna ? 'senna' : 'tiara', p.x, p.z, p.yaw - Math.PI / 2, 0, Math.random(), 2, 'story');
  v.y = spawnY(v.x, v.z); v.name = '借來的超跑'; v.storyOwn = 1; v.vmax = Math.max(v.vmax, 64); v.eng = Math.max(v.eng, 16); poseVehicle(v);
  a.car = v; a.carHp0 = v.hp;
}
// 從貨艙跳出來：在跑道南側上空自由落體（F／空白鍵開傘），落地才完成
STEP.sky = {
  start: (a, s, c) => {
    c.t = 0;
    const p = ST_DROP();
    if (player.mode === 'drive') exitVehicle();
    player.x = p.x; player.z = p.z; player.y = groundH(p.x, p.z) + (s.h || 380); player.yaw = camState.yaw = Math.PI; camState.snap = true;
    player.air3 = { kind: 'fall', vx: 0, vy: -1, vz: 0, t: 0 }; player.down = 0;
    sfx.swoosh(false);
  },
  step: (a, s, c, dt) => (c.t += dt) > 1 && !player.air3,
  hud: (a, s) => { const A = player.air3; return { text: A && A.kind === 'fall' ? `${s.text} · F 或空白鍵開傘` : s.text, bar: -1, num: A ? `${Math.round(player.y - groundH(pX(), pZ()))} m` : '' }; },
  skip: () => { player.air3 = null; chute.visible = false; player.y = groundH(pX(), pZ()); player.down = 0; },
};

// ─── 5-4 塔吊：吊著貨櫃撞穿霓峰塔的工地辦公室 ───
const SL_LEN = 12;   // 纜繩長（m）
let slingKit = null;
function slingMesh() {
  if (!slingKit) {
    const k = new Kit(), BLU = 0x2b5f7e;
    k.box(0, 0, 0, 2.44, 2.6, 6.1, BLU, 2);
    for (let i = -5; i <= 5; i++) k.box(0, 0, i * .55, 2.5, 2.5, .08, 0x24506a, 2);   // 側面的波浪板
    k.box(0, 1.33, 0, 2.3, .06, 6, 0x20485e, 2).box(0, 0, 3.07, 2.3, 2.4, .05, 0x1f4357, 2);
    slingKit = k.build();
  }
  const m = new T.Mesh(slingKit, MAT.uber); scene.add(m);
  const r = new T.Mesh(new Kit().box(0, 0, 0, .07, .07, 1, 0x3a3c40, 2).build(), MAT.uber); r.visible = false; scene.add(r);
  return { m, r };
}
// 霓峰塔西面的工地辦公室（樓板 49 m 上的貨櫃屋）
function towerSite() {
  const F = CR.on && CR.F;
  if (!F) { const p = ST_MID(); return { x: p.x, y: 30, z: p.z, gx: p.x + 6, gz: p.z }; }
  const Tw = F.tower, cz = (Tw.z0 + Tw.z1) / 2, [x, z] = toW(Tw.x0 + 2.6, cz);
  // 證物箱掉在大樓西面外、推不動的空地上（工地圍籬裡面的話再往西找）
  let gx = x, gz = z;
  for (let d = 6; d < 40; d += 2) { [gx, gz] = toW(Tw.x0 - d, cz); colY = 0; const q = collideCircle(gx, gz, .6, false); if (Math.hypot(q.x - gx, q.z - gz) < .05 && waterDepth(gx, gz) <= 0) break; }
  return { x, y: 49, z, gx, gz };
}
function siteMesh(p) {
  const k = new Kit(), ORG = 0xd8762a;
  k.box(0, 1.3, 0, 2.5, 2.6, 6, ORG, 2).box(0, 2.66, 0, 2.6, .12, 6.1, 0x8a4a1c, 2);
  for (const sx of [-1, 1]) k.box(sx * 1.27, 1.6, 0, .05, 1, 3.6, 0xffd9a0, 16);   // 兩面的窗：入夜亮著燈（霍爾的人在裡面輪班）
  for (const sz of [-1, 1]) k.box(0, 2.85, sz * 2.7, .3, .26, .3, 0xffa818, 9);   // 屋頂兩角的黃色警示燈
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(p.x, p.y, p.z); m.rotation.y = frameYaw(p.x, p.z); scene.add(m);
  return m;
}
// 世界座標一點的街區方向（工地辦公室的長邊順著大樓的西牆）
function frameYaw(x, z) { const [lx, lz] = toL(x, z), [ax, az] = toW(lx, lz + 1); return Math.atan2(ax - x, az - z); }
function slingDrop(a) {
  const S = a.sling; if (!S) return;
  scene.remove(S.m); scene.remove(S.r); S.r.geometry.dispose();
  a.sling = null;
}
storyCleanups.push(a => {
  slingDrop(a);
  if (a.site) { scene.remove(a.site.m); a.site.m.geometry.dispose(); a.site = null; }
  if (a.heli) { if (player.veh !== a.heli) dropGunship(a.heli); a.heli = null; }
});
// 單擺：貨櫃受重力、空氣阻力，離吊鉤超過繩長就拉回繩長上、去掉往外的相對速度；掛著時直升機多一點負重往下沉
function slingStep(a, dt) {
  const S = a.sling, h = a.heli; if (!S) return;
  const g = groundH(S.x, S.z) + 1.3;
  if (S.on && h) {
    S.vy -= 9.8 * dt; const k = Math.exp(-.25 * dt); S.vx *= k; S.vz *= k; S.vy *= k;
    S.x += S.vx * dt; S.y += S.vy * dt; S.z += S.vz * dt;
    const hx = h.x, hy = h.y - 1.2, hz = h.z, dx = S.x - hx, dy = S.y - hy, dz = S.z - hz, d = Math.hypot(dx, dy, dz) || 1;
    if (d > SL_LEN) {
      const nx = dx / d, ny = dy / d, nz = dz / d;
      S.x = hx + nx * SL_LEN; S.y = hy + ny * SL_LEN; S.z = hz + nz * SL_LEN;
      const rv = (S.vx - h.vx) * nx + (S.vy - (h.vy || 0)) * ny + (S.vz - h.vz) * nz;
      if (rv > 0) { S.vx -= nx * rv; S.vy -= ny * rv; S.vz -= nz * rv; }
    }
    if (h.y - groundH(h.x, h.z) > 3) h.vy -= 1.2 * dt;   // 吊著貨櫃：負重往下沉一點（flyHeli 會把 vy 拉回想要的值）
    S.r.visible = true;
    const mx = (hx + S.x) / 2, my = (hy + S.y + 1.3) / 2, mz = (hz + S.z) / 2;
    S.r.position.set(mx, my, mz); S.r.lookAt(hx, hy, hz); S.r.scale.set(1, 1, Math.hypot(hx - S.x, hy - S.y - 1.3, hz - S.z));
    S.yaw += wrapA(h.yaw - S.yaw) * (1 - Math.exp(-1.5 * dt));
  } else { S.vy -= 9.8 * dt; S.y += S.vy * dt; S.vx *= .98; S.vz *= .98; S.x += S.vx * dt; S.z += S.vz * dt; S.r.visible = false; }
  if (S.y < g) { S.y = g; S.vy = Math.max(0, S.vy); S.vx *= .8; S.vz *= .8; }
  S.m.position.set(S.x, S.y, S.z); S.m.rotation.set(0, S.yaw, 0);
}
storyTicks.push((a, dt) => slingStep(a, dt));
// 掛上貨櫃：直升機在貨櫃正上方 7 m 內、離貨櫃頂 4–18 m、幾乎停住
STEP.sling = {
  start: (a, s, c) => {
    if (!a.heli) { const p = HELIPAD; a.heli = buildGunship(p.x, p.z, p.yaw); a.car = null; }
    if (!a.sling) { const p = HELIPAD, k = waterDepth(p.x + Math.sin(p.yaw) * 28, p.z + Math.cos(p.yaw) * 28) > 0 ? -28 : 28, x = p.x + Math.sin(p.yaw) * k, z = p.z + Math.cos(p.yaw) * k;   // 河濱停機坪：貨櫃擺在不是水的那一邊
      a.sling = { ...slingMesh(), x, y: groundH(x, z) + 1.3, z, vx: 0, vy: 0, vz: 0, yaw: p.yaw, on: false }; }
    a.sling.on = false;
  },
  step: (a, s, c) => {
    const S = a.sling, h = a.heli;
    if (!h || h.dead) { storyFail(a, '直升機毀了'); return false; }
    if (player.veh !== h) return false;
    const up = h.y - S.y, sp = Math.hypot(h.vx, h.vz);
    if (Math.hypot(h.x - S.x, h.z - S.z) < 7 && up > 4 && up < 18 && sp < 6) { S.on = true; sfx.click(); toast('掛上貨櫃了 · 飛到霓峰塔，讓貨櫃甩進西面的工地辦公室'); }
    return S.on;
  },
  hud: (a, s) => { const S = a.sling, h = a.heli; if (player.veh !== h) return { text: '坐上武裝直升機（F）', bar: -1 }; return { text: s.text, bar: -1, num: `高 ${Math.round(h.y - S.y)} m · 距離 ${Math.round(Math.hypot(h.x - S.x, h.z - S.z))} m` }; },
  mark: (a) => { const S = a.sling, h = a.heli; return player.veh !== h ? { name: h.name, x: h.x, y: h.y + 3, z: h.z, where: 'out' } : { name: '貨櫃', x: S.x, y: S.y + 2, z: S.z, where: 'out' }; },
  skip: (a) => { const S = a.sling, h = a.heli; if (player.veh !== h) enterVehicle(h); h.x = S.x; h.z = S.z; h.y = S.y + 12; S.on = true; },
};
// 撞穿：吊著的貨櫃以 5 m/s 以上撞到工地辦公室 5.5 m 內
STEP.smash = {
  start: (a, s, c) => { const p = towerSite(); if (!a.site) a.site = { ...p, m: siteMesh(p) }; c.ok = false; },
  step: (a, s, c) => {
    const S = a.sling, h = a.heli, P = a.site;
    if (c.ok) return true;
    if (!h || h.dead) { storyFail(a, '直升機毀了'); return false; }
    if (!S || !S.on) { storyFail(a, '貨櫃掉了'); return false; }
    const d = Math.hypot(S.x - P.x, S.y - (P.y + 1.3), S.z - P.z), rel = Math.hypot(S.vx, S.vy, S.vz);
    if (d < 5.5 && rel > 5) c.ok = true;
    if (c.ok) siteBreak(a);
    return c.ok;
  },
  hud: (a, s) => { const S = a.sling, P = a.site; return { text: s.text, bar: -1, num: S && P ? `${Math.round(Math.hypot(S.x - P.x, S.y - P.y, S.z - P.z))} m · 貨櫃 ${Math.round(Math.hypot(S.vx, S.vy, S.vz) * 3.6)} km/h` : '' }; },
  mark: (a) => a.site ? { name: '工地辦公室', x: a.site.x, y: a.site.y + 3, z: a.site.z, where: 'out' } : null,
  skip: (a, s, c) => { c.ok = true; siteBreak(a); },
};
function siteBreak(a) {
  const P = a.site; if (!P || P.broken) return;
  P.broken = true; P.m.visible = false;
  fireball(P.x, P.y + 1.3, P.z, 1); sfx.boom(Math.hypot(P.x - pX(), P.z - pZ())); camState.shake = 1.2;
  if (a.sling) a.sling.on = false;   // 纜繩斷了，貨櫃掉下去
  toast('工地辦公室碎了 · 證物箱掉到樓下');
}

// 降落、下機（走路才撿得到證物箱）
STEP.land = {
  step: () => player.mode === 'walk' && player.where === 'out' && !player.air3,
  hud: (a, s) => ({ text: s.text, bar: -1, num: player.veh ? `離地 ${Math.round(player.veh.y - groundH(player.veh.x, player.veh.z))} m` : '' }),
  mark: (a) => { const p = towerSite(); return { name: '證物箱', x: p.gx, y: 1.5, z: p.gz, where: 'out' }; },
  skip: () => { const v = player.veh; if (v) { v.y = groundH(v.x, v.z); v.vy = 0; exitVehicle(); } },
};

// ─── 5-5 炸掉鐵鏽騎士的貨車 ───
STEP.wreck = {
  start: (a, s, c) => {
    const P = s.at();
    a.wrecks = a.wrecks || [];
    for (let i = 0; i < s.n; i++) {
      let sp = null;
      for (const r of [18, 30, 42, 56]) { const t = i / s.n * Math.PI * 2 + r * .01, q = rnLaneSpot(P.x + Math.sin(t) * r, P.z + Math.cos(t) * r, 6); if (!a.wrecks.some(v => Math.hypot(v.x - q.x, v.z - q.z) < 9)) { sp = q; break; } }   // 三台別疊在同一個車道點
      if (!sp) continue;
      const v = buildVeh('lct', sp.x, sp.z, sp.yaw, 0, Math.random(), 2, 'story');
      v.y = spawnY(v.x, v.z); v.name = '鐵鏽騎士的貨車'; v.storyOwn = 1; poseVehicle(v); a.wrecks.push(v);
    }
  },
  step: (a) => a.wrecks.every(v => v.dead),
  hud: (a, s) => ({ text: s.text, bar: -1, num: `${a.wrecks.filter(v => !v.dead).length} 台` }),
  mark: (a, s) => { const v = a.wrecks.find(q => !q.dead); return v ? { name: '貨車', x: v.x, y: 3, z: v.z, where: 'out' } : null; },
  skip: (a) => { for (const v of a.wrecks) explode(v); },
};
storyCleanups.push(a => { if (a.wrecks) { for (const v of a.wrecks) if (player.veh !== v) dropVeh(v); a.wrecks = null; } });

// ─── 任務表 ───
storyAdd([
  { id: '5-1', ch: 5, title: '解密', who: ROSA, star: 0, sw: [ROSA, DANE], at: homeDoor, giver: 'otis', giverAt: () => nearL(homeDoor(), 1.6, .8, -Math.PI / 2),
    desc: '奧帝斯把貨櫃場那本帳解開了。', sms: '奧帝斯：帳解開了。你們最好坐著聽。',
    steps: [
      { type: 'fn', fn: a => palOn(a, DANE) },
      { type: 'say', with: 'otis', lines: [L('otis', '天際置業、鐵庫保全、霓鑽賭場、第九分局。四本帳，同一個會計。'), L('dane', '鐵庫保全那台「只載收據」的運鈔車。'), L('otis', '收據就是這個。每一筆都有霍爾副局長的簽名。')] },
      { type: 'card', k: '帳本', t: '同一個會計', lines: [['otis', '天際置業先讓銀行收回房子，再用賭場洗過的錢低價買回來。'], ['otis', '第九分局負責把住戶請走；鐵庫保全把現金運出城。'], ['rosa', '……我媽的法拍通知也在裡面。'], ['otis', '灰石國宅整條街都在。簽字的人叫維多莉亞·史塔林。']] },
      { type: 'say', with: 'otis', lines: [L('rosa', '霍利斯就是為了這本帳死的。'), L('otis', '還有朵蒂。'), L('dane', '那我們就讓它值得。')] },
    ] },
  { id: '5-2', ch: 5, title: '舊上司', who: DANE, star: 0, at: ST_VANCE, giver: 'vance', giverAt: () => nearL(ST_VANCE(), 1.8, .6, -Math.PI / 2),
    desc: '中城的路口。有個退休的人說他認識你們手上那本帳。', sms: '范斯：我退休了，所以這通電話不存在。中城，明早。',
    first: () => { S.cast.vance = 1; toast('現在可以切換成范斯了（Q）'); },
    steps: [
      { type: 'say', with: 'vance', lines: [L('vance', '默瑟中士。軍事法庭那年我坐在旁聽席最後一排。'), L('dane', '范斯。我以為你退休了。'), L('vance', '我也以為。那些電話一直打來。'), L('vance', '聯邦要那本帳。交出來，你們兩個的案子一筆勾銷。'), L('dane', '那史塔林呢？'), L('vance', '……一次只能抓一條魚。')] },
    ] },
  { id: '5-3', ch: 5, title: '貨機', who: ROSA, star: 5, at: ST_RWY, giver: 'otis', giverAt: () => nearL(ST_RWY(), 2, .6, -Math.PI / 2),
    desc: '史塔林要用貨機把現金運出城。灰鷺角機場，跑道東端。', sms: '奧帝斯：塔台頻道說，一架貨機今晚要從灰鷺角起飛，載的不是貨。',
    bonus: [{ t: '3 分鐘內完成', ok: a => a.t < 180 }, { t: '生命沒掉超過 30', ok: a => a.hurt <= 30 }],
    first: () => { S.flags.hangar = 1; },
    steps: [
      { type: 'say', with: 'otis', lines: [L('otis', '貨機從東端滑出去，速度到兩百四就離地。'), L('rosa', '我只要它慢一點的時候。'), L('otis', '後貨艙門會開著散熱。貼著它開，然後……'), L('rosa', '然後跳。')] },
      { type: 'fn', fn: a => planeCar(a) },
      { type: 'car', text: '上車' },
      { type: 'plane', text: '追上滑跑的貨機，貼著後貨艙門', ck: true },
      { type: 'fade', to: () => ST_DROP(0, 30) },
      { type: 'card', k: '貨艙', t: '一千兩百呎', lines: [['rosa', '兩個押貨的。一個在睡覺，一個不該醒。'], ['rosa', '三個棧板，每個都綁著降落傘。'], ['rosa', '機場的燈越來越小。']] },
      { type: 'sky', text: '跳出貨艙，開傘落在跑道旁', h: 380 },
      { type: 'collect', text: '撿回降落的現金棧板', item: '現金棧板', spots: () => [ST_DROP(-30, -12), ST_DROP(40, 8), ST_DROP(5, -24)] },
      { type: 'fn', fn: () => { addHeat(99, 3); toast('機場警察封鎖了堤道 · 3 星'); } },
      { type: 'lose', text: '甩掉機場警察' },
    ] },
  { id: '5-4', ch: 5, title: '塔吊', who: DANE, star: 5, at: () => ({ ...HELIPAD }), giver: 'kael', giverAt: () => nearL(HELIPAD, 6, .6, -Math.PI / 2),
    desc: '證物箱鎖在霓峰塔工地的辦公室裡。凱爾借到一架武裝直升機。', sms: '凱爾：直升機在河濱停機坪。我不問你要拿它做什麼。',
    bonus: [{ t: '6 分鐘內完成', ok: a => a.t < 360 }, { t: '直升機沒什麼損傷（70% 以上）', ok: a => !a.heli || a.heli.hp >= a.heli.hpMax * .7 }],
    first: () => { S.flags.heli = 1; },
    steps: [
      { type: 'say', with: 'kael', lines: [L('kael', '證物箱在霓峰塔四十九米那層的工地辦公室。霍爾的人輪班看著。'), L('dane', '電梯呢？'), L('kael', '電梯有警衛。窗戶沒有。'), L('kael', '旁邊那個貨櫃，吊起來，甩進去。')] },
      { type: 'sling', text: '開直升機吊起貨櫃', ck: true },
      { type: 'smash', text: '讓貨櫃甩進霓峰塔西面的工地辦公室' },
      { type: 'land', text: '找地方降落、下直升機' },
      { type: 'collect', text: '撿回證物箱', item: '證物箱', spots: () => { const p = towerSite(); return [{ x: p.gx, z: p.gz }]; } },
      { type: 'fn', fn: () => { addHeat(99, 3); toast('第九分局的直升機起飛了 · 3 星'); } },
      { type: 'lose', text: '甩掉警察' },
    ] },
  { id: '5-5', ch: 5, title: '鐵鏽', who: ROSA, star: 4, sw: [ROSA, DANE], at: () => stOpen(), giver: 'jax', giverAt: () => nearL(stOpen(), 2.2, .6, -Math.PI / 2),
    desc: '帳本上的運貨線走琥珀工業區，鐵鏽騎士的倉庫。', sms: '賈克斯：帳上那些貨車我認得。琥珀，鐵鏽騎士的倉庫，帶上炸藥。',
    bonus: [{ t: '爆頭 4 次', ok: a => a.heads >= 4 }, { t: '生命沒掉超過 60', ok: a => a.hurt <= 60 }],
    first: () => { const T = TURFS.find(t => t.id === 'amber'); if (T && !turfOwned(T)) { motors.side.turf.push(T.id); saveMotors(); } toast('琥珀工業區成了你們的地盤'); },
    steps: [
      { type: 'say', with: 'jax', lines: [L('jax', '三台貨車，每週二出城。車斗裡是史塔林的現金。'), L('rosa', '我們拿走？'), L('jax', '我們燒掉。斷了這條線，她就得自己出面。')] },
      { type: 'fn', fn: a => { palOn(a, DANE); toast('鐵鏽騎士的倉庫'); } },
      { type: 'fight', text: '打倒倉庫外的鐵鏽騎士', at: () => stOpen(), n: 5, guns: ['smg', 'shotgun', 'pistol', 'smg', 'rifle'], r: 14, cast: 'biker' },
      { type: 'wreck', text: '炸掉三台運貨的貨車', at: () => stOpen(), n: 3 },
      { type: 'fight', text: '擋住趕回來的鐵鏽騎士', at: () => stOpen(), n: 6, guns: ['rifle', 'smg', 'shotgun', 'smg', 'rifle', 'pistol'], r: 22, hot: true, cast: 'biker', hp: 120 },
      { type: 'say', with: 'jax', lines: [L('jax', '線斷了。'), L('dane', '接下來是霍爾。'), L('jax', '那你們需要比手槍大一點的東西。北嶺，我的地堡。')] },
    ] },
  { id: '5-6', ch: 5, title: '北嶺', who: DANE, star: 4, at: ST_BUNKER, giver: 'jax', giverAt: () => nearL(ST_BUNKER(), 2.2, .6, -Math.PI / 2),
    desc: '賈克斯的地堡在北嶺山腳下。拿重武器，然後活著出來。', sms: '賈克斯：北嶺地堡。我把門打開了。',
    bonus: [{ t: '4 分鐘內完成', ok: a => a.t < 240 }, { t: '生命沒掉超過 60', ok: a => a.hurt <= 60 }],
    first: () => { S.cast.jax = 1; const b = motors.v7 && motors.v7.bunker; if (b && b.mk) b.mk.rifle = 1; saveMotors(); toast('現在可以切換成賈克斯了；地堡送你一把突擊步槍 Mk II'); },
    steps: [
      { type: 'say', with: 'jax', lines: [L('jax', 'RPG、榴彈、穿甲彈。霍爾的人穿防彈衣。'), L('dane', '你從哪弄來的？'), L('jax', '霓虹堡的後門。別問。')] },
      { type: 'fn', fn: () => { for (const id of ['rpg', 'rifle', 'grenade']) { const A = ARMS[id], q = arm.ammo[id]; if (!A || !q) continue; if (A.gun) { q.mag = A.mag; q.res = A.res * 2; } else if (A.throw) q.mag = A.n; } equip('rpg', true); toast('拿到 RPG 與兩倍彈藥'); } },
      { type: 'fight', text: '打退埋伏的霍爾手下', at: ST_BUNKER, n: 6, guns: ['rifle', 'rifle', 'smg', 'shotgun', 'rifle', 'smg'], r: 26, hot: true, esc: true, hp: 140 },
      { type: 'say', with: 'jax', lines: [L('jax', '他們知道地堡的位置。'), L('dane', '他們什麼都知道。'), L('jax', '那就換我們讓他們知道一件事。')] },
    ] },
]);
// 測試 API（window.__nc.story.ch5）
storyApi.ch5 = { planeDoor, towerSite, SL_LEN };
