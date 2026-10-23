// ═══ 第五部曲之一：公共設施（neon_nightcity_gta_v3.md「城市建築設施藍圖」一之 1）═══
// 10-city.js 的 FAC 街區：中城的聖瑪格麗特醫院（急診樓、主樓屋頂的醫療直升機、員工電梯、醫療包）、舊碼頭的第九分局（屋頂的警用直升機、
// 北牆的逃生鐵梯）與西半邊圍起來的拖吊場（被擊斃、被捕或通緝中棄車，座駕會被拖進來：守衛亭付 $250 開門，或翻過 2.2 m 的鐵絲網、撞破柵門開走 → 2 星）。
// 共用的部分：外牆鐵梯 V5_LADS（E 吸附、W／S 爬、Shift 加速、往下按 Shift 滑下去）、走得上去的屋頂（20-walk.js 的 WALKS，邊緣擋住、空白鍵跳下去）。
// 座標：設施的幾何與碰撞盒在生成時是邏輯座標（cityAdd、colliders 由 cityWorld() 換算），執行時的位置一律用 facW() 換成世界座標。

const V5 = { lad: null, imp: { slot: null, paid: 0, gateT: 0, broken: 0, aband: null, init: false }, band: 0, medkits: [], helis: [], lastVeh: null, roofs: [] };
const IMP_FEE = 250, FENCE_H = 2.2, LAD_R = .8, LAD_SP = 1.6, LAD_FAST = 3.4, LAD_SLIDE = 8, BAND_T = 300, AMB_HP = 25, MEDKIT_HP = 50, MEDKIT_RE = 90;
// 醫藥費：總現金的 5%，最多 $5,000（69-combat.js 的 die／respawn 呼叫）
const hospFee = () => Math.min(5000, Math.round(motors.cash * .05));
const facZn = F => F.L[0].zn;
const facW = (F, x, z) => toW(F.ax + x, F.az + z, facZn(F));   // 設施座標（相對街區西北角）→ 世界
const facY = (F, yaw) => yawW(facZn(F), yaw);

// ─── 招牌：畫在 canvas 上的燈箱 ───
function v5Sign(lines, w, h, o = {}) {
  const cv = document.createElement('canvas'), R = Math.min(1024 / w, 512 / h);
  cv.width = Math.round(w * R); cv.height = Math.round(h * R);
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = o.bg || '#101418'; c.fillRect(0, 0, W, H);
  if (o.edge) { c.strokeStyle = o.edge; c.lineWidth = H * .06; c.strokeRect(H * .05, H * .05, W - H * .1, H - H * .1); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach(([t, sz, col, y]) => { c.font = `700 ${H * sz}px "Avenir Next Condensed","DIN Condensed","Arial Narrow","PingFang TC",system-ui,sans-serif`; c.fillStyle = col; c.fillText(t, W * (o.cx || .5), H * y); });
  if (o.cross) { const s = H * .62, x = W * o.cross, y = H / 2; c.fillStyle = o.crossCol || '#ff3040'; c.fillRect(x - s * .17, y - s / 2, s * .34, s); c.fillRect(x - s / 2, y - s * .17, s, s * .34); }
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tx, toneMapped: false, color: o.dim || 0xc8c8c8 }));
}
// 招牌擺在設施座標 (x, y, z)，面向 ry（邏輯座標的 yaw：0 朝 +z、π/2 朝 +x）
function v5Put(F, m, x, y, z, ry) { m.position.set(F.ax + x, y, F.az + z); m.rotation.y = ry; cityAdd(m, facZn(F)); return m; }
const v5Light = (F, x, y, z, col, r, i) => outLights.push({ x: F.ax + x, y, z: F.az + z, col: lin(col), r, i });
const v5Box = (F, x0, x1, z0, z1, o = {}) => { const b = { x0: F.ax + x0, x1: F.ax + x1, z0: F.az + z0, z1: F.az + z1, zn: facZn(F), ...o }; colliders.push(b); return b; };

// ─── 外牆鐵梯：{ F, x, z（牆面上的點，設施座標）, nx, nz（朝外）, y0, y1, top: [x, z]（屋頂上下梯的點）} ───
const V5_LADS = [];
function v5Ladder(F, x, z, nx, nz, y1, top, k) {
  const L = { F, x, z, nx, nz, y0: 0, y1, top, name: F === FAC.pd ? '逃生梯' : '鐵梯' };
  V5_LADS.push(L);
  // 兩根側桿、每 0.3 m 一根橫檔、2.4 m 以上加護籠（設施座標：沿牆的方向是 (−nz, nx)）
  const ax = F.ax + x + nx * .2, az = F.az + z + nz * .2, tx = -nz, tz = nx, ry = Math.atan2(nx, nz);
  for (const s of [-1, 1]) k.box(ax + tx * s * .26, (y1 + 1.1) / 2, az + tz * s * .26, .05, y1 + 1.1, .05, 0x2a2c2e, 15, 0, ry);
  for (let y = .3; y < y1 + .9; y += .3) k.box(ax, y, az, .52, .035, .035, 0x3a3c3e, 15, 0, ry);
  for (let y = 2.4; y < y1 + 1; y += 1.2) {
    for (const s of [-1, 1]) k.box(ax + tx * s * .38 + nx * .32, y, az + tz * s * .38 + nz * .32, .03, .03, .66, 0x2a2c2e, 15, 0, ry);
    k.box(ax + nx * .66, y, az + nz * .66, .8, .03, .03, 0x2a2c2e, 15, 0, ry);
  }
  return L;
}
// 爬梯子的姿勢：動畫庫沒有，在待機上覆寫四肢（40-people.js 的 OVR），相位跟著爬的距離走
ANIM.climb = 37; ACLIP[ANIM.climb] = { c: 'Idle_Loop' };
OVR[ANIM.climb] = (p, t) => {
  const s = Math.sin(t * Math.PI), a = .35 * s;
  aim(p, 'upperarm_l', .22, .85 + a * .3, .38); aim(p, 'upperarm_r', -.22, .85 - a * .3, .38);
  aim(p, 'lowerarm_l', .05, .9 + a, .25); aim(p, 'lowerarm_r', -.05, .9 - a, .25);
  aim(p, 'thigh_l', .06, -.75 + a, .55 + a * .6); aim(p, 'thigh_r', -.06, -.75 - a, .55 - a * .6);
  aim(p, 'calf_l', 0, -1, -.25); aim(p, 'calf_r', 0, -1, -.25);
};
const ladFoot = L => facW(L.F, L.x + L.nx * .45, L.z + L.nz * .45);
const ladTop = L => facW(L.F, L.top[0], L.top[1]);
function ladStart(L, fromTop) {
  if (player.mode !== 'walk' || player.down > 0) return;
  player.crouch = false; player.dance = 0; gta.aiming = false; arm.trig = false;
  V5.lad = { L, y: fromTop ? L.y1 - .2 : .15, ph: 0 };
  player.v = 0; sfx.step && sfx.click();
  toast('W／S 爬上爬下 · 按住 Shift 加速，往下按 Shift 直接滑下去');
}
function ladPlace() {
  const A = V5.lad, L = A.L, [x, z] = facW(L.F, L.x + L.nx * .42, L.z + L.nz * .42);
  player.x = x; player.z = z; player.y = A.y; player.yaw = facY(L.F, Math.atan2(-L.nx, -L.nz));
  me.anim(0, ANIM.climb, A.ph, 0); me.anim2(0, 0, 0); me.place(0, player.x, player.y, player.z, player.yaw); me.flush();
}
// 40-people.js 的 updatePlayerWalk 在爬梯子時交給這裡（翻鐵絲網也是）
function ladStep(inp, dt) {
  const A = V5.lad;
  if (A.fence) return fenceStep(A, dt);
  const L = A.L, up = inp.mz > .2, dn = inp.mz < -.2;
  const sp = up ? (inp.run ? LAD_FAST : LAD_SP) : dn ? -(inp.run ? LAD_SLIDE : LAD_SP) : 0;
  A.y += sp * dt; A.ph += Math.abs(sp) * dt * (A.slide ? 0 : 1.6);
  A.slide = dn && inp.run;
  if (A.y >= L.y1 - .1 && up) {   // 爬到頂：站上屋頂
    const [x, z] = ladTop(L); V5.lad = null;
    player.x = x; player.z = z; player.y = L.y1; player.v = 0; player.anim = -1;
    return;
  }
  if (A.y <= 0) {   // 到底
    const [x, z] = ladFoot(L); V5.lad = null;
    player.x = x; player.z = z; player.y = groundH(x, z); player.v = 0; player.anim = -1;
    if (A.slide) { sfx.impact(4); dust(x, player.y + .1, z, 4); }
    return;
  }
  A.y = Math.min(A.y, L.y1 - .1);
  ladPlace();
}

// ─── 走得上去的屋頂：設施地塊的屋頂（o.roof），邊緣 0.4 m 擋住，空白鍵從邊上跳下去 ───
function v5Roof(F, L, extra) {
  const R = { F, L, h: L.h, bb: [L.x0, L.x1, L.z0, L.z1], solid: extra || [] };
  V5.roofs.push(R);
  WALKS.push({ zn: L.zn, bb: [L.x0 - 1.5, L.x1 + 1.5, L.z0 - 1.5, L.z1 + 1.5], y(x, z, y0, cam) {
    if (y0 < R.h - 2.5) return undefined;
    const e = Math.min(x - L.x0, L.x1 - x, z - L.z0, L.z1 - z);
    if (e < .45) return cam ? R.h : null;
    if (!cam) for (const b of R.solid) if (x > b[0] && x < b[1] && z > b[2] && z < b[3]) return null;   // 樓梯間、空調箱
    return R.h;
  } });
  return R;
}
const roofOf = (X, Z, y) => V5.roofs.find(R => { const [x, z] = toL(X, Z, R.L.zn); return Math.abs(y - R.h) < .6 && x > R.L.x0 - .5 && x < R.L.x1 + .5 && z > R.L.z0 - .5 && z < R.L.z1 + .5; });
function roofJump() {
  if (player.mode !== 'walk' || player.where !== 'out' || player.air3 || V5.lad) return false;
  const R = roofOf(player.x, player.z, player.y);
  if (!R) return false;
  const [x, z] = toL(player.x, player.z, R.L.zn), L = R.L;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), [lx, lz] = toL(player.x + fx * 1.2, player.z + fz * 1.2, L.zn);
  if (Math.min(x - L.x0, L.x1 - x, z - L.z0, L.z1 - z) > 1.2 || (lx > L.x0 && lx < L.x1 && lz > L.z0 && lz < L.z1)) return false;
  player.x += fx * 1.1; player.z += fz * 1.1; player.y = R.h + .3;
  player.air3 = { kind: 'fall', vx: fx * 3.5, vy: 2.6, vz: fz * 3.5, t: 0 };
  sfx.swoosh(false); toast('跳下去了 · 按 F 或空白鍵開傘');
  return true;
}

// ─── 屋頂停機坪：地上畫 H 與黃圈、邊燈；停一架可以開的直升機（69-gunship.js 的 buildGunship，kind 'police'／'med'）───
function v5Pad(F, x, z, y, k) {
  const X = F.ax + x, Z = F.az + z;
  k.cyl(X, y + .03, Z, 6.2, 6.2, .06, 36, 0x3a3d40, 2);
  k.cyl(X, y + .065, Z, 5.4, 5.4, .01, 36, 0xffd23a, 11).cyl(X, y + .07, Z, 5, 5, .01, 36, 0x3a3d40, 2);
  k.box(X - 1.5, y + .075, Z, .6, .01, 4, 0xffffff, 2).box(X + 1.5, y + .075, Z, .6, .01, 4, 0xffffff, 2).box(X, y + .075, Z, 2.4, .01, .6, 0xffffff, 2);
  for (let a = 0; a < 12; a++) k.cyl(X + Math.cos(a / 12 * 6.283) * 6, y + .1, Z + Math.sin(a / 12 * 6.283) * 6, .09, .11, .14, 8, a % 2 ? 0x30ff70 : 0xfff0a0, 8);
}
function v5HeliSpawn(H) {
  const [x, z] = facW(H.F, H.x, H.z);
  const v = buildGunship(x, z, facY(H.F, H.yaw), { kind: H.kind });
  v.y = H.y; v.pad = H; H.v = v; H.gone = 0;
  return v;
}

// ═══ 聖瑪格麗特醫院 ═══
if (FAC.hosp) {
  const F = FAC.hosp, [E, Tw] = F.L, k = new Kit();
  // 急診入口：人行道上的雨遮與兩根柱子、自動門的燈框
  k.box(F.ax + 10.4, 3.75, F.az + 31, 4.6, .28, 12, 0xd8dcdc, 10).box(F.ax + 10.4, 3.6, F.az + 31, 4.5, .04, 11.8, 0xfff4e0, 11);
  for (const z of [25.6, 36.4]) k.cyl(F.ax + 8.6, 1.8, F.az + z, .14, .14, 3.6, 10, 0xb8bcbe, 3);
  k.box(F.ax + 12.45, 1.4, F.az + 31, .08, 2.8, 3.4, 0x9ad8ff, 1).box(F.ax + 12.42, 2.9, F.az + 31, .1, .16, 3.8, 0xffffff, 11);
  // 主樓北牆的員工電梯門、屋頂的電梯機房
  k.box(F.ax + 50, 1.25, F.az + 12.42, 1.6, 2.5, .08, 0x8a9096, 3).box(F.ax + 50, 2.75, F.az + 12.4, 2, .3, .1, 0x30a0ff, 11);
  const hy = Tw.h;
  k.box(F.ax + 50, hy + 1.5, F.az + 14.6, 4, 3, 3.2, 0xc8ccce, 2).box(F.ax + 50, hy + 1.1, F.az + 16.22, 1.4, 2.2, .06, 0x6a7078, 3);
  k.box(F.ax + 36, hy + .8, F.az + 44, 5, 1.6, 3, 0x9aa0a4, 15);   // 空調箱
  v5Pad(F, 44, 31, hy, k);
  // 醫療包：急診入口左邊牆角，綠色十字的箱子（下面 V5.medkits）
  cityAdd(new T.Mesh(k.build(), MAT.uber), facZn(F));
  v5Put(F, v5Sign([['急診 EMERGENCY', .62, '#ffffff', .52]], 6.4, 1.2, { bg: '#c81e2c', dim: 0xffffff }), 12.38, 5.4, 31, -Math.PI / 2);
  v5Put(F, v5Sign([['聖瑪格麗特醫院', .4, '#1c3a5c', .38], ['ST. MARGARET HOSPITAL', .22, '#2c5a8c', .76]], 11, 2.6, { bg: '#f2f4f4', cross: .08, dim: 0xe8e8e8 }), 27.9, hy - 4.2, 31, -Math.PI / 2);
  v5Put(F, v5Sign([['', .1, '#fff', .5]], 2.6, 2.6, { bg: '#f4f4f4', cross: .5 }), 30, hy - 2.2, 12.38, Math.PI);
  v5Put(F, v5Sign([['員工電梯 · 屋頂停機坪', .42, '#ffffff', .5]], 2.6, .5, { bg: '#1c3a5c' }), 50, 3.25, 12.35, Math.PI);
  v5Light(F, 10.4, 3.4, 27, 0xfff0d8, 9, 1.1); v5Light(F, 10.4, 3.4, 35, 0xfff0d8, 9, 1.1); v5Light(F, 11.6, 5.4, 31, 0xff4050, 8, .9);
  v5Light(F, 44, hy + 2, 31, 0xd0ffe0, 14, .8);
  V5.medkits.push({ F, x: 12.1, z: 24.4, t: 0, m: null });
  V5.helis.push({ F, kind: 'med', x: 44, z: 31, y: hy + .1, yaw: -Math.PI / 2, v: null, gone: 0 });
  F.elev = { down: [50, 11.4], up: [50, 17.1], roof: [50, 18.2], street: [50, 10.6] };
  v5Roof(F, Tw, [[F.ax + 47.8, F.ax + 52.2, F.az + 12.8, F.az + 16.4], [F.ax + 33.3, F.ax + 38.7, F.az + 42.3, F.az + 45.7]]);
  v5Box(F, 47.9, 52.1, 12.9, 16.3, { ly: hy - .5 });
}

// ═══ 第九分局與拖吊場 ═══
if (FAC.pd) {
  const F = FAC.pd, [B] = F.L, Y = F.yard, k = new Kit(), hy = B.h, x0 = Y.x0 - F.ax, x1 = Y.x1 - F.ax, z0 = Y.z0 - F.az, z1 = Y.z1 - F.az;
  // 大門：藍色燈箱與兩盞藍色球燈
  for (const z of [28.6, 33.4]) { k.cyl(F.ax + 59.9, 2.6, F.az + z, .05, .05, .5, 6, 0x222222, 15, 0, 0, Math.PI / 2).cyl(F.ax + 60.2, 2.6, F.az + z, .2, .2, .36, 12, 0x3a7cff, 8); }
  // 拖吊場：深色柏油、停車格線、鐵絲網（柱子、上下橫管、網面）與頂上的刺絲
  k.box((Y.x0 + Y.x1) / 2, .165, (Y.z0 + Y.z1) / 2, Y.x1 - Y.x0, .04, Y.z1 - Y.z0, 0x2c2e31, 2);   // 人行道板高 0.15，柏油鋪在上面
  for (let x = x0 + 3; x < x1 - 2; x += 3.2) for (const z of [z0 + 22, z1 - 2.6]) k.box(F.ax + x, .19, F.az + z, .1, .01, 5, 0xd8d4c4, 2);
  const gate = { x0: 6, x1: 14 }, booth = { x0: 14.5, x1: 16.9, z0: z0 + .2, z1: z0 + 2.6 };
  F.gate = gate; F.booth = booth;
  const segs = [[x0, z0, x0 + gate.x0, z0], [x0 + gate.x1, z0, x0 + booth.x0, z0], [x0 + booth.x1, z0, x1, z0], [x0, z0, x0, z1], [x0, z1, x1, z1], [x1 + .1, z0, x1 + .1, z1]];
  F.fence = [];
  const net = new Kit();
  for (const [ax, az, bx, bz] of segs) {
    const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = Math.atan2(ux, uz) - Math.PI / 2, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    for (let s = 0; s <= L + .01; s += Math.max(1, L / Math.ceil(L / 2.6))) k.cyl(F.ax + ax + ux * s, (FENCE_H + .35) / 2, F.az + az + uz * s, .04, .04, FENCE_H + .35, 6, 0x6a6e72, 15);
    for (const y of [.12, FENCE_H]) k.box(F.ax + mx, y, F.az + mz, L, .04, .04, 0x7a7e82, 15, 0, ry);
    for (let s = .3; s < L; s += .4) k.box(F.ax + ax + ux * s, FENCE_H + .28, F.az + az + uz * s, .3, .02, .02, 0x8a8e92, 15, s * 7, ry);   // 刺絲
    net.box(F.ax + mx, FENCE_H / 2 + .06, F.az + mz, L, FENCE_H - .1, .01, 0xffffff, 2, 0, ry);
    F.fence.push({ a: [ax, az], b: [bx, bz], col: v5Box(F, Math.min(ax, bx) - .08, Math.max(ax, bx) + .08, Math.min(az, bz) - .08, Math.max(az, bz) + .08, { hy: FENCE_H + .1 }) });
  }
  // 網面：菱形網目的透明貼圖
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  { const c = cv.getContext('2d'); c.strokeStyle = '#c8ccd0'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 32); c.lineTo(32, 0); c.lineTo(64, 32); c.lineTo(32, 64); c.closePath(); c.stroke(); }
  const ntx = new T.CanvasTexture(cv); ntx.wrapS = ntx.wrapT = T.RepeatWrapping; ntx.repeat.set(1, 1);
  const ng = net.build(), uv = ng.attributes.uv;
  if (uv) { const p = ng.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / .14, p.getY(i) / .14); }
  cityAdd(new T.Mesh(ng, new T.MeshBasicMaterial({ map: ntx, alphaTest: .5, side: T.DoubleSide, color: 0x6a6e72 })), facZn(F));
  // 柵門（滑門）：付了錢往西滑開，撞破就倒在地上
  const gk = new Kit(), gw = gate.x1 - gate.x0;
  gk.box(0, FENCE_H / 2, 0, gw, FENCE_H, .05, 0x7a7e82, 15).box(0, .14, 0, gw, .08, .08, 0xd8c040, 15).box(0, FENCE_H - .05, 0, gw, .08, .08, 0xd8c040, 15);
  for (let s = -gw / 2; s <= gw / 2 + .01; s += gw / 4) gk.box(s, FENCE_H / 2, 0, .06, FENCE_H, .06, 0xd8c040, 15);
  const gm = new T.Mesh(gk.build(), MAT.uber); gm.position.set(F.ax + x0 + (gate.x0 + gate.x1) / 2, 0, F.az + z0); cityAdd(gm, facZn(F));
  F.gateM = gm; F.gateP = gm.position.clone();
  F.gateCol = v5Box(F, x0 + gate.x0, x0 + gate.x1, z0 - .1, z0 + .1, { hy: FENCE_H + .1 });
  // 守衛亭：窗戶朝北對著人行道
  k.box(F.ax + x0 + (booth.x0 + booth.x1) / 2, 1.3, F.az + (booth.z0 + booth.z1) / 2, booth.x1 - booth.x0, 2.6, booth.z1 - booth.z0, 0xd8d4c8, 2);
  k.box(F.ax + x0 + (booth.x0 + booth.x1) / 2, 2.72, F.az + (booth.z0 + booth.z1) / 2, booth.x1 - booth.x0 + .3, .14, booth.z1 - booth.z0 + .3, 0x2a3a5c, 2);
  k.box(F.ax + x0 + (booth.x0 + booth.x1) / 2, 1.6, F.az + booth.z0 - .02, 1.8, .9, .04, 0x9ad8ff, 1).box(F.ax + x0 + (booth.x0 + booth.x1) / 2, 1.08, F.az + booth.z0 - .18, 1.9, .06, .34, 0x8a8a86, 2);
  v5Box(F, x0 + booth.x0, x0 + booth.x1, booth.z0, booth.z1);
  // 投光燈兩支
  for (const [x, z] of [[x0 + 1, z0 + 1], [x0 + 1, z1 - 1]]) { k.cyl(F.ax + x, 3.5, F.az + z, .07, .09, 7, 8, 0x3a3c3e, 15).box(F.ax + x + .4, 7, F.az + z, .5, .3, .4, 0xfff4d8, 11); v5Light(F, x + 2, 6.4, z + (z < 30 ? 2 : -2), 0xfff0d0, 22, 1.2); }
  // 北牆逃生梯（地面到屋頂）、屋頂停機坪
  F.lad = v5Ladder(F, 56, 12.5, 0, -1, hy, [56, 14.4], k);
  v5Pad(F, 48.5, 33, hy, k);
  cityAdd(new T.Mesh(k.build(), MAT.uber), facZn(F));
  v5Put(F, v5Sign([['NCPD', .5, '#ffffff', .4], ['霓虹市警 第九分局', .26, '#cfe0ff', .8]], 6.2, 1.6, { bg: '#13306a', edge: '#6aa0ff', dim: 0xffffff }), 59.62, 5.4, 31, Math.PI / 2);
  v5Put(F, v5Sign([['拖吊場 IMPOUND', .42, '#1a1a1a', .36], [`贖車 ${money(IMP_FEE)} · 守衛亭`, .3, '#3a3a3a', .76]], 3.4, 1, { bg: '#f0c830' }), x0 + (gate.x0 + gate.x1) / 2, FENCE_H + .9, z0 - .08, Math.PI);
  v5Light(F, 60.4, 2.8, 31, 0x6a9cff, 8, 1); v5Light(F, x0 + 15.7, 2.4, z0 - 1, 0xfff0d0, 6, .8);
  V5.helis.push({ F, kind: 'police', x: 48.5, z: 33, y: hy + .1, yaw: Math.PI / 2, v: null, gone: 0 });
  v5Roof(F, B);
  V5.imp.slot = { x: x0 + 10, z: z0 + 20, yaw: Math.PI };
}
// 拖吊場裡停著幾台被扣的車（30-vehicles.js 的路邊停車，生成時呼叫；邏輯座標，不抽 rT）
function facParked() {
  const F = FAC.pd; if (!F) return [];
  const T0 = ['e34', 'negotiator', 'compact', 'urban', 'fh_taxi', 'milano'], out = [];
  [[3.5, 0], [6.7, 1], [16.3, 3], [19.5, 5]].forEach(([x, n], i) => out.push({ type: T0[n], x: F.yard.x0 + x, z: F.yard.z1 - 2.6, yaw: Math.PI, pal: (i * 3) % PAL.length }));
  out.push({ type: T0[4], x: F.yard.x0 + 19.6, z: F.yard.z0 + 22, yaw: Math.PI, pal: 0 });
  return out;
}

// ─── 拖吊場：扣車、贖車、翻牆、撞門 ───
function impSlotW() { const F = FAC.pd, s = V5.imp.slot; return spotW({ x: F.ax + s.x, z: F.az + s.z, yaw: s.yaw }); }
const inYard = (X, Z) => { const F = FAC.pd; if (!F) return false; const [x, z] = toL(X, Z, facZn(F)); return x > F.yard.x0 && x < F.yard.x1 + .2 && z > F.yard.z0 && z < F.yard.z1; };
function impound(why) {
  if (!FAC.pd || motors.test || motors.stowed) return;
  const v = kestrel;
  if (player.veh === v) exitVehicle();
  wreckFix(v); v.air = null; v.vy = 0; placeCarAt(impSlotW());   // placeCarAt 會 rollClear
  motors.v5.imp = 1; V5.imp.paid = 0; V5.imp.aband = null; saveMotors();
  if (why) toast(`${v.name} 被拖到${PD.name}的拖吊場 · 付 ${money(IMP_FEE)} 贖回`);
}
function impPay() {
  if (!motors.v5.imp) { toast('拖吊場沒有你的車'); return; }
  if (motors.cash < IMP_FEE) { toast(`現金不夠 ${money(IMP_FEE)}（也可以翻牆把車偷出來）`); return; }
  motors.cash -= IMP_FEE; saveMotors(); sfx.click();
  V5.imp.paid = 1; gateOpen(60);
  toast(`付了 ${money(IMP_FEE)} 罰金，柵門開了：把 ${kestrel.name} 開出來`);
}
function gateOpen(t) { const I = V5.imp; if (I.broken) return; I.gateT = t; const F = FAC.pd, i = colliders.indexOf(F.gateCol); if (i >= 0) { colliders.splice(i, 1); colDirty(); } sfx.door(); }
function gateClose() { const F = FAC.pd, I = V5.imp; I.gateT = 0; if (!colliders.includes(F.gateCol)) { colliders.push(F.gateCol); colDirty(); } }
function gateBreak() {
  const F = FAC.pd, I = V5.imp; I.broken = 90; I.gateT = 0;
  const i = colliders.indexOf(F.gateCol); if (i >= 0) { colliders.splice(i, 1); colDirty(); }
  F.gateM.rotation.x = -1.45; F.gateM.position.y = .06; sfx.glassBreak(); sfx.impact(12); camState.shake = .6;
  if (!I.paid && motors.v5.imp) { addHeat(0, 2); toast('撞破拖吊場的柵門 · 通緝 2 星'); }
}
// 69-combat.js 的 die() 一開始呼叫（還在車上就先記下來）：開著自己的車、或車就在附近 150 m 內，車會被拖走
function v5Die(kind) {
  const v = kestrel;
  V5.dieImp = !motors.stowed && !motors.test && (player.veh === v || Math.hypot(v.x - pX(), v.z - pZ()) < 150) && !inYard(v.x, v.z);
}
// respawn() 最後呼叫：醫院出來帶著繃帶；車拖進拖吊場
function v5Respawn(kind) {
  if (kind !== 'busted') V5.band = BAND_T;
  if (V5.dieImp) { V5.dieImp = false; impound(true); }
}
// 翻鐵絲網：面向網子 0.8 m 內按空白鍵，1.6 秒翻到另一邊
function fenceNear() {
  const F = FAC.pd; if (!F || player.mode !== 'walk' || player.where !== 'out' || player.y > 1) return null;
  const [x, z] = toL(player.x, player.z, facZn(F)), fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), [dx, dz] = dirL(facZn(F), fx, fz);
  for (const s of [...F.fence, { a: [F.gate.x0 + F.yard.x0 - F.ax, F.yard.z0 - F.az], b: [F.gate.x1 + F.yard.x0 - F.ax, F.yard.z0 - F.az], gate: 1 }]) {
    if (s.gate && (V5.imp.gateT > 0 || V5.imp.broken)) continue;
    const ax = F.ax + s.a[0], az = F.az + s.a[1], bx = F.ax + s.b[0], bz = F.az + s.b[1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    const t = (x - ax) * ux + (z - az) * uz; if (t < .4 || t > L - .4) continue;
    const nx = -uz, nz = ux, d = (x - ax) * nx + (z - az) * nz;
    if (Math.abs(d) > LAD_R + .1 || Math.abs(d) < .05) continue;
    if ((dx * nx + dz * nz) * -Math.sign(d) < .5) continue;   // 要面向網子
    return { x, z, nx: -Math.sign(d) * nx, nz: -Math.sign(d) * nz, zn: facZn(F) };
  }
  return null;
}
function fenceStart(f) {
  V5.lad = { fence: f, t: 0, x0: f.x, z0: f.z, ph: 0 };
  player.crouch = false; gta.aiming = false; arm.trig = false; sfx.rope && sfx.rope();
}
function fenceStep(A, dt) {
  const f = A.fence; A.t += dt; A.ph += dt * 2.4;
  const u = clamp(A.t / 1.6, 0, 1), up = Math.sin(Math.min(1, u * 1.4) * Math.PI / 2), across = clamp((u - .45) / .35, 0, 1);
  const d = .45 + .85 * across, [X, Z] = toW(A.x0 + f.nx * (d - .45 + .05), A.z0 + f.nz * (d - .45 + .05), f.zn);
  player.x = X; player.z = Z; player.y = groundH(X, Z) + (FENCE_H + .1) * (u < .8 ? up : 1 - (u - .8) / .2);
  player.yaw = yawW(f.zn, Math.atan2(f.nx, f.nz));
  me.anim(0, ANIM.climb, A.ph, 0); me.anim2(0, 0, 0); me.place(0, player.x, player.y, player.z, player.yaw); me.flush();
  if (u >= 1) { V5.lad = null; player.y = groundH(X, Z); player.anim = -1; sfx.step && sfx.impact(3); }
}

// ─── 互動提示 ───
ctxHooks.unshift(p => {
  if (p.where !== 'out' || V5.lad) return null;
  if (p.mode === 'walk') {
    for (const L of V5_LADS) {
      const [fx, fz] = ladFoot(L), [tx, tz] = ladTop(L);
      if (Math.abs(p.y) < 1.2 && Math.hypot(p.x - fx, p.z - fz) < LAD_R) return { key: 'E', text: `爬${L.name}`, fn: () => ladStart(L, false) };
      if (Math.abs(p.y - L.y1) < .8 && Math.hypot(p.x - tx, p.z - tz) < 1.2) return { key: 'E', text: `爬下${L.name}`, fn: () => ladStart(L, true) };
    }
    const H = FAC.hosp;
    if (H) {
      const [dx, dz] = facW(H, ...H.elev.down), [ux, uz] = facW(H, ...H.elev.up), hy = H.L[1].h;
      if (p.y < 2 && Math.hypot(p.x - dx, p.z - dz) < 1.6) return { key: 'E', text: '搭員工電梯上屋頂', fn: () => transition(() => { const [x, z] = facW(H, ...H.elev.roof); player.x = x; player.z = z; player.y = hy; player.yaw = facY(H, 0); camState.yaw = player.yaw; camState.snap = true; }) };
      if (Math.abs(p.y - hy) < .8 && Math.hypot(p.x - ux, p.z - uz) < 1.6) return { key: 'E', text: '搭電梯下樓', fn: () => transition(() => { const [x, z] = facW(H, ...H.elev.street); player.x = x; player.z = z; player.y = groundH(x, z); player.yaw = facY(H, Math.PI); camState.yaw = player.yaw; camState.snap = true; }) };
    }
    const P = FAC.pd;
    if (P) {
      const b = P.booth, [bx, bz] = facW(P, P.yard.x0 - P.ax + (b.x0 + b.x1) / 2, P.yard.z0 - P.az - 1.2);
      if (Math.hypot(p.x - bx, p.z - bz) < 2) return motors.v5.imp ? { key: 'E', text: `付罰金贖車 <i>· ${money(IMP_FEE)}</i>`, fn: impPay } : { key: 'E', text: '拖吊場守衛亭 <i>· 沒有你的車</i>', fn: () => toast('守衛：「你的車不在這裡。」') };
    }
    const f = fenceNear(); if (f) return { key: 'Space', text: '翻過鐵絲網', fn: () => fenceStart(f) };
  }
  return null;
});
// 按鍵（69-combat.js 的 gtaKey 最前面問這裡）
function v5Key(code) {
  if (V5.lad) return code === 'Space' || code === 'KeyE' || code === 'KeyF';
  if (code === 'Space' && player.mode === 'walk' && !player.air3) {
    const f = fenceNear(); if (f) { fenceStart(f); return true; }
    if (roofJump()) return true;
  }
  return false;
}

// ─── 每幀（99-main.js 在 v3Update 之後呼叫）───
function v5Update(dt) {
  const I = V5.imp;
  if (!I.init && cityIsWorld) {   // 讀檔時車還在拖吊場：擺回去
    I.init = true;
    if (motors.v5.imp && FAC.pd && !motors.stowed) placeCarAt(impSlotW());
    for (const H of V5.helis) v5HeliSpawn(H);
    for (const M of V5.medkits) {
      const k = new Kit(); k.box(0, .2, 0, .5, .4, .32, 0xf2f2f2, 2).box(0, .2, -.165, .3, .09, .01, 0x20c050, 11).box(0, .2, -.165, .09, .3, .01, 0x20c050, 11).box(0, .43, 0, .14, .06, .3, 0x404040, 2);
      M.m = new T.Mesh(k.build(), MAT.uber); const [x, z] = facW(M.F, M.x, M.z); M.m.position.set(x, groundH(x, z), z); M.m.rotation.y = facY(M.F, Math.PI / 2); scene.add(M.m);
    }
  }
  if (FAC.pd) {
    if (I.gateT > 0 && (I.gateT -= dt) <= 0) { const v = player.veh; if (!(v && inYard(v.x, v.z) && Math.hypot(v.vx, v.vz) > .5)) gateClose(); else I.gateT = 2; }
    const F = FAC.pd, gp = F.gateP, open = I.gateT > 0 ? 1 : 0;
    if (!I.broken) { F.gateM.position.x = damp(F.gateM.position.x, gp.x - open * (F.gate.x1 - F.gate.x0 - .4), 3, dt); }
    else if ((I.broken -= dt) <= 0) { I.broken = 0; F.gateM.rotation.x = 0; F.gateM.position.copy(gp); gateClose(); }
    // 開著車撞上關著的柵門
    const v = player.veh;
    if (v && v.isCar && !I.broken && I.gateT <= 0) {
      const [x, z] = toL(v.x + Math.sin(v.yaw) * v.len * .45, v.z + Math.cos(v.yaw) * v.len * .45, facZn(F)), gx0 = F.yard.x0 + F.gate.x0, gx1 = F.yard.x0 + F.gate.x1;
      if (x > gx0 - .5 && x < gx1 + .5 && Math.abs(z - F.yard.z0) < 1.4 && Math.hypot(v.vx, v.vz) > 2.5) gateBreak();
    }
    // 車開出拖吊場就算領回
    if (motors.v5.imp && !inYard(kestrel.x, kestrel.z)) { motors.v5.imp = 0; I.paid = 0; saveMotors(); if (player.veh === kestrel) toast(`${kestrel.name} 領回來了`); }
    // 通緝中棄車：下車時記下來，甩掉警察時人離車 150 m 以上就拖走
    if (player.veh === kestrel) I.aband = null;
    else if (V5.lastVeh === kestrel && W.stars > 0 && !motors.v5.imp) I.aband = { t: 0 };
    if (I.aband && W.stars === 0 && !life.dead) { if (Math.hypot(kestrel.x - pX(), kestrel.z - pZ()) > 150) impound(true); else I.aband = null; }
  }
  // 救護車：坐進駕駛座補 25 點生命（每台一次）
  const v = player.mode === 'drive' ? player.veh : null;
  if (v && v !== V5.lastVeh && v.type === 'ambulance' && !v.medKit) { v.medKit = 1; const n = Math.min(AMB_HP, life.max - life.hp); if (n > 0) { life.hp += n; toast(`救護車上的急救包 · 生命 +${Math.round(n)}`); sfx.pickup(); } }
  // 屋頂直升機：開走或打掉之後，人離開停機坪 150 m 以上再補一架
  for (const H of V5.helis) {
    const hv = H.v, [px, pz] = facW(H.F, H.x, H.z);
    if (hv && player.veh === hv && !hv.took) { hv.took = 1; if (H.kind === 'police') addHeat(CRIME.jack, 2); }
    const off = !hv || !vehicles.includes(hv) || hv.dead || Math.hypot(hv.x - px, hv.z - pz) > 40;
    if (off && player.veh !== hv && Math.hypot(pX() - px, pZ() - pz) > 150) { if ((H.gone += dt) > 30) { if (hv && vehicles.includes(hv) && player.veh !== hv) dropGunship(hv); v5HeliSpawn(H); } }
    else H.gone = 0;
  }
  // 醫療包
  for (const M of V5.medkits) {
    if (!M.m) continue;
    if (M.t > 0) { M.t -= dt; M.m.visible = M.t <= 0; continue; }
    if (player.mode === 'walk' && Math.hypot(player.x - M.m.position.x, player.z - M.m.position.z) < 1.1 && life.hp < life.max) {
      const n = Math.min(MEDKIT_HP, life.max - life.hp); life.hp += n; M.t = MEDKIT_RE; M.m.visible = false; sfx.pickup(); toast(`醫療包 · 生命 +${Math.round(n)}`);
    }
  }
  if (V5.band > 0) V5.band -= dt;
  v5Bandage();
  V5.lastVeh = player.mode === 'drive' ? player.veh : null;
}
// 繃帶：出院後 5 分鐘，額頭一圈、左前臂一段
const BAND = (() => {
  const k = new Kit(); k.cyl(0, 0, 0, .118, .118, .055, 16, 0xf4f0e8, 2);
  const kb = new Kit(); kb.cyl(0, 0, 0, .052, .052, .16, 10, 0xf4f0e8, 2);
  const a = new T.Mesh(k.build(), MAT.uber), b = new T.Mesh(kb.build(), MAT.uber);
  a.visible = b.visible = false; scene.add(a, b); return { a, b };
})();
const _bh = V3(), _bn = V3(), _be = V3(), _bw = V3();
function v5Bandage() {
  const on = V5.band > 0 && player.mode === 'walk' && !life.dead && me.people[0] && me.people[0].bones;
  BAND.a.visible = BAND.b.visible = !!on;
  if (!on) return;
  const p = me.people[0];
  p.h.updateMatrixWorld(true); _hm.multiplyMatrices(p.h.matrixWorld, p.sm.matrix);
  boneW(p, 'Head', _bh); boneW(p, 'neck_01', _bn);
  _be.subVectors(_bh, _bn).normalize();
  BAND.a.position.copy(_bh).addScaledVector(_be, .085); BAND.a.quaternion.setFromUnitVectors(UP, _be);
  boneW(p, 'lowerarm_l', _be); boneW(p, 'hand_l', _bw);
  BAND.b.position.lerpVectors(_be, _bw, .55); BAND.b.quaternion.setFromUnitVectors(UP, _bw.sub(_be).normalize());
}
// 測試 API（window.__nc.gta.v5）：w(id, x, z) 設施座標 → 世界、lad(i, top) 直接吸上鐵梯
gtaApi.v5 = { V5, FAC, LADS: V5_LADS, w: (id, x, z) => facW(FAC[id], x, z), yaw: (id, a) => facY(FAC[id], a), lad: (i, top) => ladStart(V5_LADS[i], !!top), impound, pay: impPay, gateBreak, fenceNear, roofJump, hospFee, inYard };
