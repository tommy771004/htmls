// ═══ 船：碼頭邊繫著的快艇與小艇（走到旁邊按 F 上船自己開），水上的尾跡、船頭水花與下水的水花 ═══
// 船也放進 vehicles（受傷、爆炸、射線、陰影照車的流程）：isCar = false 讓玩家坐在駕駛座上看得到（99-main.js 的 placeRider），
// boat = true 走這裡的物理（driveBoat），下船走 boatExit（找最近的岸，沒有就下水）。
// 碰撞：岸邊的擋牆本來就蓋在水的那一側（10-city.js），船用 collideCircle 撞它就上不了岸；另外量船頭、船尾的水深，淺於吃水就退回去（沙灘、梯子前的缺口）。
// 船的座標原點在水線、船頭朝 +z；水面起伏只動船，水面本身不變形。

const BOAT_TYPES = {
  wavecut: { name: '浪刃 Wavecut 24', len: 7.2, w: 2.5, vmax: 24, eng: 7.2, turn: .9, hull: 0xe8e6e0, stripe: 0xc8202a, deck: 0x2a2c30, bimini: 0 },
  bayhop: { name: '灣仔 Bayhop 17', len: 5.4, w: 2.1, vmax: 14, eng: 5.2, turn: 1.15, hull: 0x24405e, stripe: 0xe8e2d4, deck: 0x6a5a48, bimini: 0x1e5a5a },
};
const BOAT_DRAFT = .55;   // 船底到水線（淺過這個就擱淺）
// 船殼：沿 z 切 16 段的 V 形斷面（龍骨、舭、舷緣），船頭收窄、龍骨往上翹；甲板在 y = 0.3，船頭一段蓋上前甲板
function hullKit(k, T0) {
  const L = T0.len, B = T0.w, N = 16, sec = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = -L / 2 + t * L;
    const b = B / 2 * Math.max(.03, t < .5 ? 1 : Math.pow(Math.cos((t - .5) / .5 * Math.PI / 2), .75));
    const keel = lerp(-BOAT_DRAFT, .45, Math.pow(clamp((t - .5) / .5, 0, 1), 1.7)), top = .82 + .26 * t * t;
    sec.push({ z, b, keel, chine: lerp(keel, top, .25), band: lerp(keel, top, .72), top });
  }
  const strip = (col, mat, f) => {   // f(s) → 兩個點（右舷），兩舷各一條
    const p = [];
    for (let i = 0; i < N; i++) for (const sx of [1, -1]) {
      const [a0, a1] = f(sec[i]), [b0, b1] = f(sec[i + 1]);
      const q = [[a0[0] * sx, a0[1], sec[i].z], [a1[0] * sx, a1[1], sec[i].z], [b1[0] * sx, b1[1], sec[i + 1].z], [b0[0] * sx, b0[1], sec[i + 1].z]];
      p.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
    k.add(g, col, mat);
  };
  strip(0x5a1a16, 2, s => [[0, s.keel], [s.b * .86, s.chine]]);                    // 船底（防污漆）
  strip(T0.hull, 0, s => [[s.b * .86, s.chine], [s.b * .97, s.band]]);             // 舷側
  strip(T0.stripe, 0, s => [[s.b * .97, s.band], [s.b, s.top]]);                   // 舷側飾帶
  // 船尾板、甲板、前甲板
  const s0 = sec[0], tp = [];
  for (const sx of [1, -1]) tp.push(0, s0.keel, s0.z, s0.b * .86 * sx, s0.chine, s0.z, s0.b * sx, s0.top, s0.z, 0, s0.keel, s0.z, s0.b * sx, s0.top, s0.z, 0, s0.top, s0.z);
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(tp, 3)); tg.computeVertexNormals(); k.add(tg, T0.hull, 0);
  const dk = [], fd = [];
  for (let i = 0; i < N; i++) {
    const a = sec[i], b = sec[i + 1];
    if (b.z < L * .14) dk.push(-a.b * .95, .3, a.z, a.b * .95, .3, a.z, b.b * .95, .3, b.z, -a.b * .95, .3, a.z, b.b * .95, .3, b.z, -b.b * .95, .3, b.z);
    else fd.push(-a.b, a.top, a.z, a.b, a.top, a.z, b.b, b.top, b.z, -a.b, a.top, a.z, b.b, b.top, b.z, -b.b, b.top, b.z);
  }
  for (const [arr, col] of [[dk, T0.deck], [fd, T0.hull]]) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); k.add(g, col, arr === dk ? 2 : 0); }
  return sec;
}
function boatKit(id) {
  const T0 = BOAT_TYPES[id], k = new Kit(), L = T0.len, sz = id === 'wavecut' ? -.5 : -1.1;   // sz：駕駛座的前後位置
  hullKit(k, T0);
  // 駕駛台：台身、擋風玻璃、方向盤、儀表
  const cz = sz + .78;
  k.box(0, .78, cz, .95, .96, .55, T0.hull, 0).box(0, 1.36, cz + .12, .95, .42, .05, 0x9ab4c8, 1, -.5).box(0, 1.17, cz - .16, .5, .2, .05, 0x101418, 2, -.6)
    .cyl(-.18, 1.22, cz - .3, .17, .17, .04, 16, 0x15171a, 2, Math.PI / 2 - .55).box(.22, 1.23, cz - .3, .18, .1, .03, 0x5ad0ff, 11, -.6);
  // 座椅、後座
  k.box(0, .45, sz, .78, .3, .6, 0xd8d2c4, 2).box(0, .64, sz, .72, .1, .55, 0x2a2c30, 2).box(0, .95, sz - .28, .72, .5, .1, 0x2a2c30, 2, .15);
  k.box(0, .5, -L / 2 + .9, T0.w * .8, .4, .7, 0xd8d2c4, 2).box(0, .74, -L / 2 + .9, T0.w * .78, .1, .66, 0x2a2c30, 2);
  // 舷外機
  k.box(0, .95, -L / 2 - .3, .5, .75, .52, 0x18191c, 0).box(0, .95, -L / 2 - .3, .51, .08, .53, T0.stripe, 0).box(0, .2, -L / 2 - .38, .14, 1.2, .2, 0x202226, 15).box(0, -.42, -L / 2 - .38, .28, .12, .3, 0x202226, 15);
  // 船頭欄杆、繫纜柱
  for (const sx of [-1, 1]) {
    k.box(sx * T0.w * .34, 1.15, L * .25, .04, .04, L * .32, 0xc8ccd4, 3, 0, sx * .2);
    for (const t of [.12, .26, .38]) k.box(sx * T0.w * (.44 - t * .55), 1.05, L * t, .04, .25, .04, 0xc8ccd4, 3);
    k.cyl(sx * T0.w * .38, .9, -L / 2 + .35, .06, .07, .18, 8, 0xc8ccd4, 3);
  }
  // 航行燈：左舷紅、右舷綠（船頭朝 +z，左舷是 +x）、船尾桅燈白；船頭探照燈跟大燈
  k.box(T0.w * .42, 1.02, L * .3, .08, .08, .12, 0xff2020, 11).box(-T0.w * .42, 1.02, L * .3, .08, .08, .12, 0x20ff60, 11);
  k.cyl(T0.w * .3, 1.3, -L / 2 + .3, .025, .025, 1, 6, 0xc8ccd4, 3).box(T0.w * .3, 1.82, -L / 2 + .3, .1, .1, .1, 0xfff4e0, 11);
  k.box(0, 1.2, L * .46, .22, .14, .1, 0xfff0d8, 4);
  // 遮陽頂（小艇）
  if (T0.bimini) {
    for (const sx of [-1, 1]) for (const dz of [-.55, .6]) k.box(sx * .55, 1.55, sz + dz, .03, 1.5, .03, 0xc8ccd4, 3);
    k.box(0, 2.3, sz + .02, 1.2, .05, 1.4, T0.bimini, 2);
  }
  return k;
}
// 繫船的位置（邏輯座標）：船心離岸 5.8 m（擋牆 4 m＋半個船寬）
const BOAT_SPOTS = [
  { type: 'wavecut', x: PIERS[0].x1 + 5.8, z: SHORE_Z + 118, yaw: 0, where: '珊瑚灘棧橋' },
  { type: 'bayhop', x: (PIERS[1].x0 + PIERS[1].x1) / 2, z: PIERS[1].z0 - 5.8, yaw: -Math.PI / 2, where: '舊碼頭' },
  { type: 'wavecut', x: BRIDGE_X - 70, z: ISLE.z0 - 5.8, yaw: Math.PI / 2, where: '灰鷗島' },
  { type: 'bayhop', x: 1230, z: QUAY.z1 + 5.8, yaw: Math.PI / 2, where: '錨灣港' },
  // 對岸的渡船碼頭（10-city.js 的 FERRY，只剩西岸一座）：南北兩側各停一艘，開船或游過去之後也有船開回來
  { type: 'bayhop', x: FERRY[0].x1 - 10, z: FERRY[0].z1 + 3.2, yaw: Math.PI / 2, where: FERRY[0].name },
  { type: 'wavecut', x: FERRY[0].x1 - 10, z: FERRY[0].z0 - 3.4, yaw: Math.PI / 2, where: FERRY[0].name },
  // 光格島北端的碼頭（10-city.js 的 TRON_LAND.pier，島在 SEA_FR 座標框）：以 http(s) 開啟才有島可以上去（21-tron.js）
  ...(GLB_ON && TRON_LAND && TRON_LAND.pier ? [{ type: 'wavecut', x: TRON_SITE.x + TRON_LAND.pier.x1 + 2.2, z: TRON_SITE.z + TRON_LAND.pier.z0 + 12, yaw: Math.PI, where: '光格島', zn: TRON_SITE.zn }] : []),
];
const boats = BOAT_SPOTS.map((S, i) => {
  const T0 = BOAT_TYPES[S.type], mat = mkUber({ double: true });
  const g = new T.Group(), body = new T.Group(); g.add(body); scene.add(g);
  body.add(new T.Mesh(boatKit(S.type).build(), mat));
  const home = spotW(S, S.zn);
  const v = { kind: 'boat', boat: true, isCar: false, type: S.type, home, spot: S, g, body, mat, wheels: [], x: home.x, z: home.z, y: SEA_Y, yaw: home.yaw, vx: 0, vz: 0, yr: 0, steer: 0, spin: 0, roll: 0, pitch: 0, lean: 0,
    len: T0.len, w: T0.w, h: 1.4, rad: T0.w / 2, off: T0.len * .26, vmax: T0.vmax, eng: T0.eng, grip: 0, wb: T0.len * .6, wr: 1, name: T0.name, rpm: 0, gear: 1, slip: 0, lights: 0,
    seat: [0, S.type === 'wavecut' ? -.5 : -1.1], hp: 900, mass: 1400, ph: i * 1.7, sink: 0, wakeT: 0 };
  vehicles.push(v);
  return v;
});
// 水面起伏（三道波疊起來；只給船用）
const seaWave = (x, z, t) => .16 * Math.sin(x * .19 + t * 1.05) + .11 * Math.sin(z * .23 - t * .83 + 1.3) + .06 * Math.sin((x + z) * .41 + t * 1.7);
const boatFloor = (x, z) => seaFloor(x, z) > SEA_Y - BOAT_DRAFT - .15;   // 這裡太淺，船過不去
function driveBoat(v, inp, dt) {
  const T0 = BOAT_TYPES[v.type], fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
  let vF = v.vx * fx + v.vz * fz, vR = v.vx * rx + v.vz * rz;
  const dead = v.dead;
  const thr = dead ? 0 : inp.thr, brk = dead ? 0 : inp.brk, steer = dead ? 0 : inp.steer;
  let aF = 0;
  if (thr > 0) aF += v.eng * thr * (1 - (vF / v.vmax) ** 2) * (vF < 5 ? 1.3 : 1);
  if (brk > 0) aF += vF > .5 ? -v.eng * .9 * brk : -v.eng * .45 * brk * (vF > -4.5 ? 1 : 0);   // 倒車最快 4.5 m/s
  aF -= vF * Math.abs(vF) * .011 + vF * .1;   // 水的阻力
  vF += aF * dt;
  if (!thr && !brk && Math.abs(vF) < .05) vF = 0;
  vR *= Math.exp(-(inp.hb ? .5 : 1.9) * dt);   // 船會往外滑（手煞車＝收油門甩尾）
  // 舵：有速度或開著油門（螺旋槳的水流打在舵上）才轉得動；倒車反過來
  const bite = clamp((Math.abs(vF) + thr * 3.5) / 9, 0, 1) * (vF < -.5 ? -1 : 1);
  v.steer = damp(v.steer, steer * .55, 5, dt);
  v.yr = damp(v.yr, steer * T0.turn * bite * (1 - clamp((Math.abs(vF) - 14) / 30, 0, .45)), 2.6, dt);
  v.yaw += v.yr * dt;
  vR += -v.yr * vF * .06 * dt * 4;   // 轉彎時船尾往外甩
  v.slip = Math.abs(vR);
  const nfx = Math.sin(v.yaw), nfz = Math.cos(v.yaw);
  v.vx = nfx * vF - nfz * vR; v.vz = nfz * vF + nfx * vR;
  const px = v.x, pz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  // 外海與對岸：游泳一樣的範圍（對岸只在它的那段 z 擋）
  [v.x, v.z] = farClamp(v.x, v.z); v.x = Math.min(v.x, CITY_X1 + 2600); v.z = clamp(v.z, CITY_Z0 - 600, Math.max(SHORE_Z + 1700, TRON_SITE.z + 450));   // 南界要包住光格島（10-city.js 的 TRON_SITE，十五片版面搬到城東南的外海）
  let imp = vehicleCollide(v, dt);
  imp = Math.max(imp, boatShipHit(v));
  // 船頭、船尾太淺：退回上一個位置
  const sh = (s) => boatFloor(v.x + nfx * v.len * .42 * s, v.z + nfz * v.len * .42 * s);
  if (sh(1) || sh(-1) || boatFloor(v.x, v.z)) {
    imp = Math.max(imp, Math.abs(vF));
    v.x = px; v.z = pz;
    const back = sh(1) ? -1 : 1;
    v.vx = nfx * back * Math.min(1.5, Math.abs(vF) * .3); v.vz = nfz * back * Math.min(1.5, Math.abs(vF) * .3);
    vF = (v.vx * nfx + v.vz * nfz);
  }
  if (imp > 2.5) { boatSpray(v, imp); }
  // 起伏、船頭抬起（滑行）、轉彎側傾
  const t = uTimeNow(), L2 = v.len * .4;
  const hb = seaWave(v.x + nfx * L2, v.z + nfz * L2, t), hs = seaWave(v.x - nfx * L2, v.z - nfz * L2, t);
  const hl = seaWave(v.x - nfz * 1.1, v.z + nfx * 1.1, t), hr = seaWave(v.x + nfz * 1.1, v.z - nfx * 1.1, t);
  const plane = clamp(Math.abs(vF) / 9, 0, 1) * (1 - clamp((Math.abs(vF) - 14) / 20, 0, .5));
  const calm = 1 - plane * .6;
  v.y = damp(v.y, SEA_Y + (hb + hs) / 2 * calm + plane * .12 - (dead ? v.sink : 0), 6, dt);
  v.pitch = damp(v.pitch, Math.atan2(hs - hb, v.len * .8) * calm - plane * .09 + clamp(-aF * .004, -.03, .03), 5, dt);
  v.lean = damp(v.lean, Math.atan2(hr - hl, 2.2) * calm + clamp(v.yr * vF * .012, -.22, .22), 4, dt);
  v.roll = v.lean;
  v.spin += vF * dt;
  v.rpm = clamp(.16 + Math.abs(vF) / v.vmax * .7 + thr * .25, .12, 1); v.gear = vF < -.5 ? 'R' : 1;
  v.brakeOn = 0;
  boatWake(v, vF, dt);
  return { imp, vF, aF };
}
// 貨櫃船：船身當成一個長方形（21-coast.js 的 harbor：進出港時會動）
function boatShipHit(v) {
  const H = harbor, R = H.root;
  if (!R || !R.visible) return 0;
  const yaw = yawW(H.zn, R.rotation.y) - Math.PI / 2, off = H.shipDX || 0;   // 船頭朝船的 +x；模型的中心比 root 偏船頭 shipDX
  const [cx, cz] = toW(R.position.x + off * Math.cos(R.rotation.y), R.position.z - off * Math.sin(R.rotation.y), H.zn);
  const c = Math.cos(yaw), s = Math.sin(yaw), dx = v.x - cx, dz = v.z - cz;
  let lx = dx * c - dz * s, lz = dx * s + dz * c;   // 船的局部：lz 沿船長
  const hx = H.halfB + v.rad, hz = H.halfL + v.rad;
  if (Math.abs(lx) > hx || Math.abs(lz) > hz) return 0;
  const ex = hx - Math.abs(lx), ez = hz - Math.abs(lz);
  if (ex < ez) lx = Math.sign(lx) * hx; else lz = Math.sign(lz) * hz;
  const nx = lx * c + lz * s + cx, nz = -lx * s + lz * c + cz, px = nx - v.x, pz = nz - v.z, d = Math.hypot(px, pz) || 1;
  v.x = nx; v.z = nz;
  const vn = (v.vx * px + v.vz * pz) / d;
  if (vn < 0) { v.vx -= vn * px / d * 1.3; v.vz -= vn * pz / d * 1.3; }
  return Math.abs(vn);
}
// 下船：船邊 9 m 內有岸（梯子、碼頭、棧橋、沙灘）就站上去，沒有就跳進水裡
function boatExit(v) {
  let best = null, bd = 1e9;
  for (let r = 4.5; r <= 9 && !best; r += 1.5) for (let a = 0; a < 16; a++) {
    const th = a / 16 * Math.PI * 2, x = v.x + Math.sin(th) * r, z = v.z + Math.cos(th) * r;
    if (seaFloor(x, z) < -.3 || waterDepth(x, z) > .3 || walkAt(x, z, 0) === null) continue;   // walkAt：光格島的樓與護欄（21-tron.js）
    const q = collideCircle(x, z, .32, false);
    if (Math.hypot(q.x - x, q.z - z) > .6) continue;
    const d = Math.hypot(x - player.x, z - player.z);
    if (d < bd) { bd = d; best = q; }
  }
  const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);
  const x = best ? best.x : v.x + lx * (v.w / 2 + .9), z = best ? best.z : v.z + lz * (v.w / 2 + .9);
  player.x = x; player.z = z; player.yaw = v.yaw; player.mode = 'walk'; player.veh = null; player.v = 0;
  player.y = best ? walkY(x, z, 0, groundH(x, z)) : SEA_Y - SWIM_Y;
  v.lights = 0; v.brakeOn = 0; v.steer = 0;
  me.mesh.visible = true;
  sfx.doorCar(false); sfx.engineOff();
  if (!best) { sfx.splash(1); waterSplash(x, z, 1); }
  camState.snap = false;
}
// 沒人開的船：照樣漂、起伏；燒掉的慢慢沉；漂走、沉掉的在玩家走遠之後回到原本繫的地方
const IDLE_INP = { thr: 0, brk: 0, steer: 0, hb: false };
function boatsUpdate(dt) {
  for (const v of boats) {
    if (v === player.veh) continue;
    if (v.dead) v.sink = Math.min(4, v.sink + dt * .12);
    driveBoat(v, IDLE_INP, dt);
    const far = Math.hypot(v.x - player.x, v.z - player.z) > 180;
    if (far && (v.dead && v.sink > 3 || Math.hypot(v.x - v.home.x, v.z - v.home.z) > 40)) boatReset(v);
  }
}
function boatReset(v) {
  Object.assign(v, { x: v.home.x, z: v.home.z, yaw: v.home.yaw, vx: 0, vz: 0, yr: 0, dead: 0, burn: 0, burnT: 0, hp: 900, sink: 0, y: SEA_Y });
  v.g.visible = true;
}

// ─── 水花與尾跡 ───
// 尾跡：貼在水面上的白沫片（自己一個 InstancedMesh，平放、會擴散變淡）；水花：68-gta.js 的粒子（spray，掉回水面就消失）
const WAKE_N = LOW ? 140 : 320;
const WAKE_VS = /* glsl */`
attribute vec4 iP; attribute vec4 iA;
varying vec2 vUv; varying vec4 vA; varying vec3 vW;
void main(){
  float c = cos(iP.w), s = sin(iP.w);
  vec2 q = mat2(c, s, -s, c) * position.xz * iP.z;
  vec3 w = vec3(iP.x + q.x, ${SEA_Y.toFixed(2)} + .04 + iA.w * .01, iP.y + q.y);
  vW = w; vUv = uv; vA = iA;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const WAKE_FS = /* glsl */`
${GL_LIB}
varying vec2 vUv; varying vec4 vA; varying vec3 vW;
void main(){
  vec2 q = vUv - .5; float d = length(q) * 2.;
  float n = n2(vW.xz * 1.9 + vA.z * 7.) * .6 + n2(vW.xz * 5.3 - vA.z * 3.) * .4;
  float a = vA.y < .5 ? smoothstep(1., .35, d + (n - .5) * .7) * (.35 + .65 * n)                     // 白沫
                      : smoothstep(.16, 0., abs(d - .55 - vA.x * .4) - (n - .5) * .12) * (1. - smoothstep(.95, 1., d));   // 一圈漣漪
  a *= (1. - vA.x) * (1. - vA.x) * min(1., vA.x * 8. + .2);
  vec3 c = vec3(.5, .56, .6) * (uAmbTop * (3. - uDay * 1.5) + .22 + uSunCol * .6);
  gl_FragColor = vec4(applyFog(c, vW), a * .5);
}`;
const wake = (() => {
  const g = new T.InstancedBufferGeometry(), b = new T.PlaneGeometry(1, 1); b.rotateX(-Math.PI / 2);
  g.index = b.index; g.setAttribute('position', b.attributes.position); g.setAttribute('uv', b.attributes.uv);
  const at = { iP: new T.InstancedBufferAttribute(new Float32Array(WAKE_N * 4), 4), iA: new T.InstancedBufferAttribute(new Float32Array(WAKE_N * 4), 4) };
  for (const k in at) { at[k].setUsage(T.DynamicDrawUsage); g.setAttribute(k, at[k]); }
  g.instanceCount = 0;
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: WAKE_VS, fragmentShader: WAKE_FS, transparent: true, depthWrite: false }));
  m.frustumCulled = false; m.renderOrder = 3; m.layers.set(LY.NOREFL); scene.add(m);
  return { m, at, list: [] };
})();
// 一片白沫：(x, z) 位置、(vx, vz) 漂的速度、s0 → s1 大小、max 秒、ring = 1 是一圈漣漪
function wakeAdd(x, z, vx, vz, s0, s1, max, ring = 0, a = 1) {
  const L = wake.list;
  if (L.length >= WAKE_N) L.shift();
  L.push({ x, z, vx, vz, s0, s1, max, t: 0, ring, a, seed: Math.random(), rot: Math.random() * 6.3 });
}
function boatWake(v, vF, dt) {
  const sp = Math.abs(vF);
  if (sp < .8 || Math.hypot(v.x - camera.position.x, v.z - camera.position.z) > 260) return;
  v.wakeT -= dt;
  if (v.wakeT > 0) return;
  v.wakeT = clamp(.9 / sp, .05, .3);
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx, sx = v.x - fx * v.len * .5, sz = v.z - fz * v.len * .5;
  // 船尾的螺旋槳翻起的白沫（中間）與往兩側擴散的 V 字尾浪
  wakeAdd(sx, sz, -fx * sp * .15, -fz * sp * .15, 1.2, 2.6 + sp * .12, 2.5 + sp * .08, 0, clamp(sp / 8, .4, 1));
  for (const s of [-1, 1]) wakeAdd(sx + rx * s * v.w * .45, sz + rz * s * v.w * .45, rx * s * sp * .2, rz * s * sp * .2, .9, 2 + sp * .18, 3.5 + sp * .1, 0, clamp(sp / 12, .25, .8));
  // 船頭兩側的水花
  if (sp > 5 && player.where === 'out') for (const s of [-1, 1]) {
    const bx = v.x + fx * v.len * .3 + rx * s * v.w * .5, bz = v.z + fz * v.len * .3 + rz * s * v.w * .5;
    for (let i = 0; i < (LOW ? 1 : 2); i++) emit('spray', bx, SEA_Y + .3, bz, { vx: rx * s * (1.5 + Math.random() * 2) + v.vx * .6, vy: 1.5 + sp * .12 * Math.random(), vz: rz * s * (1.5 + Math.random() * 2) + v.vz * .6, max: .9, s0: .18, s1: .5 + sp * .03, grav: 9, drag: .8, a: .55, c: [.75, .8, .85], sea: 1 });
  }
}
function boatSpray(v, k) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  waterSplash(v.x + fx * v.len * .4, v.z + fz * v.len * .4, clamp(k / 8, .4, 1.4));
}
// 落水、撞擊：一圈漣漪＋往上噴的水珠（k 是大小）
function waterSplash(x, z, k = 1) {
  wakeAdd(x, z, 0, 0, .6 * k, 3.5 * k, 2.2, 1);
  wakeAdd(x, z, 0, 0, .8 * k, 2.4 * k, 1.6, 0, .8);
  const n = Math.round((LOW ? 8 : 16) * k);
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, s = (.6 + Math.random() * 1.6) * k; emit('spray', x, SEA_Y + .1, z, { vx: Math.cos(a) * s, vy: 2.5 + Math.random() * 3 * k, vz: Math.sin(a) * s, max: 1.1, s0: .14, s1: .4 * k + .1, grav: 9.5, drag: .6, a: .6, c: [.75, .8, .85], sea: 1 }); }
}
// 游泳時划水的小白沫
function swimWake(dt) {
  if (!player.swim || player.v < .3) return;
  if ((swimWake.t = (swimWake.t || 0) - dt) > 0) return;
  swimWake.t = .35;
  wakeAdd(player.x - Math.sin(player.yaw) * .5, player.z - Math.cos(player.yaw) * .5, 0, 0, .5, 1.6, 1.8, 0, .55);
}
function wakeUpdate(dt) {
  swimWake(dt);
  const L = wake.list, at = wake.at;
  let n = 0;
  for (let i = L.length - 1; i >= 0; i--) {
    const w = L[i]; w.t += dt;
    if (w.t >= w.max) { L.splice(i, 1); continue; }
    const k = Math.exp(-.9 * dt); w.vx *= k; w.vz *= k; w.x += w.vx * dt; w.z += w.vz * dt;
  }
  for (const w of L) {
    const u = w.t / w.max;
    at.iP.array.set([w.x, w.z, w.s0 + (w.s1 - w.s0) * Math.sqrt(u), w.rot], n * 4);
    at.iA.array.set([u, w.ring, w.seed, n / WAKE_N], n * 4);
    n++;
  }
  wake.m.geometry.instanceCount = n;
  for (const k in at) at[k].needsUpdate = true;
}

// 測試 API（window.__nc.boat）
const boatApi = {
  boats, BOAT_SPOTS, LADDERS,
  list: () => boats.map(v => ({ type: v.type, where: v.spot.where, x: v.x, z: v.z, y: v.y, dead: !!v.dead, drive: player.veh === v })),
  board: (i = 0) => { const v = boats[i]; if (player.mode === 'drive') exitVehicle(); player.x = v.x; player.z = v.z; player.where = 'out'; enterVehicle(v); camState.snap = true; return v.name; },
  place: (i, x, z, yaw = 0) => { const v = boats[i]; Object.assign(v, { x, z, yaw, vx: 0, vz: 0, yr: 0 }); },
  reset: i => boatReset(boats[i]),
  // 錨灣港（21-coast.js）：貨櫃船這一輪走到第幾秒（0 = 剛靠港；SHIP_T 是各段長度）、集卡
  harbor, SHIP_T, shipAt: T => { harbor.st = T; return shipPose(T).state; },
  trucks: () => harbor.trucks.map(t => ({ s: +t.s.toFixed(1), v: +t.v.toFixed(2), load: t.load, wait: t.wait > 0 })),
  wake: () => wake.list.length,
  // 梯子（世界座標）：底下（水裡）與上面（岸上）
  ladders: () => LADDERS.filter(L => L.ok).map(L => ({ bot: WP(L.x + L.nx * 1.6, L.z + L.nz * 1.6), top: WP(L.x - L.nx * 1.2, L.z - L.nz * 1.2) })),
};
