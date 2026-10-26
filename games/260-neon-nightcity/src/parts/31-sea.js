// ═══ 水上的其他船：灰鷺河的渡輪、錨灣港的拖船、追捕的水警艇（props/sea.glb，CC BY 4.0：Snowsoup 的 Hailuoto car ferry、
// Potater_King 的 40ft Tugboat、gogiart 的 Police III；以檔案開啟或下載前是程式建模的替身） ═══
// 渡輪：鷺岸渡口（10-city.js 的 FERRY）⇄ 舊碼頭第一座木棧的南側，照時刻表來回。雙頭渡輪，回程倒著開；只照時間擺位置、不走物理。
// 拖船：錨灣港的貨櫃船（21-coast.js 的 shipPose）拖離碼頭與轉向時拴在船的外海那一側，開出去以後回到港池西側待命，船回來時反過來；
// 換位置時原地轉向（港口拖船是全迴轉推進器）。兩艘的船身是矩形：玩家的船（driveBoat 的 seaHullHit）與游泳的人碰到會被推開。
// 水警艇：玩家在水上（開船或游泳）而且有通緝時，從看不到的水面開過來追（driveBoat，和玩家的船同一套物理），2 星以上船上的警察開槍；
// 算進 69-police.js 的 sees()（附近有警艇就不會消星）與警笛距離。警艇放進 vehicles：打得爛（燒完沉掉）、上得去（搶下來就是一般的船）。
// 測試 API 在 __nc.boat.sea。

BOAT_TYPES.polboat = { name: '水警艇 Harbor Patrol', len: 14, w: 5.6, vmax: 23, eng: 7, turn: .8, hull: 0xf2f2f2, stripe: 0x1a2a6a, deck: 0x2a2c30, bimini: 0 };
const SEA = { it: null, hulls: [], t: 0 };
// 模型底面到水線（props.mjs 把底面中心放在原點）
const SEA_DRAFT = { ferry: 4.1, tug: 2.2, polboat: .75 };

// ─── 渡輪 ───
const FERRY_DOCK = PIERS[1];   // 舊碼頭第一座木棧（北側已經停著灣仔）
const FERRY_A = spotW({ x: FERRY[0].x1 + 26, z: (FERRY[0].z0 + FERRY[0].z1) / 2, yaw: Math.PI / 2 });   // 船尾頂著渡口的盡頭
const FERRY_B = spotW({ x: FERRY_DOCK.x0 + 6, z: FERRY_DOCK.z1 + 7.3, yaw: Math.PI / 2 });           // 靠在木棧南側的外半段（再往裡船頭會頂到岸邊的淺水）
const FERRY_T = { wait: 45, go: 95 };
const FERRY_C = 2 * (FERRY_T.wait + FERRY_T.go);
// 兩端的切線都沿船身方向的三次 Hermite（世界座標）
function ferryAt(u) {
  const A = FERRY_A, B = FERRY_B, k = Math.hypot(B.x - A.x, B.z - A.z) * .85;
  const ax = Math.sin(A.yaw) * k, az = Math.cos(A.yaw) * k, bx = Math.sin(B.yaw) * k, bz = Math.cos(B.yaw) * k;
  const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  return { x: h00 * A.x + h10 * ax + h01 * B.x + h11 * bx, z: h00 * A.z + h10 * az + h01 * B.z + h11 * bz,
    yaw: Math.atan2(d00 * A.x + d10 * ax + d01 * B.x + d11 * bx, d00 * A.z + d10 * az + d01 * B.z + d11 * bz) };
}
// 一輪：渡口等 → 開到舊碼頭 → 等 → 倒著開回來。回傳位置、朝向與沿船身的速度（倒著開是負的）
function ferryPose(T) {
  const S = FERRY_T, ss = u => u * u * (3 - 2 * u);
  let t = ((T % FERRY_C) + FERRY_C) % FERRY_C, u, dir = 1;
  if (t < S.wait) u = 0;
  else if ((t -= S.wait) < S.go) u = ss(t / S.go);
  else if ((t -= S.go) < S.wait) u = 1;
  else { t -= S.wait; u = 1 - ss(t / S.go); dir = -1; }
  const p = ferryAt(u), q = ferryAt(clamp(u + .002, 0, 1)), r = ferryAt(clamp(u - .002, 0, 1));
  const moving = u > 0 && u < 1;
  return { ...p, state: u === 0 ? 'west' : u === 1 ? 'east' : 'cross', sp: moving ? dir * Math.hypot(q.x - r.x, q.z - r.z) / .004 * (6 * (t / S.go) * (1 - t / S.go)) / S.go : 0 };
}

// ─── 拖船 ───
// 港池西側的待命點（離貨櫃船轉向的圓 140 m 以上），拴船的位置在船身外海那一側、往船艏 60 m（船的局部座標，船艏是 +x）
const TUG_STBY = { dx: -170, dz: 60, yaw: Math.PI };
const TUG_ATT = { ax: 60, az: 33 }, TUG_MOVE = 40;
function shipLocal(sp, ax, az) { const c = Math.cos(sp.yaw), s = Math.sin(sp.yaw); return { x: sp.x + ax * c + az * s, z: sp.z - ax * s + az * c, yaw: sp.yaw }; }
function tugPose(T) {
  const H = harbor, ss = u => u * u * (3 - 2 * u), S = SHIP_T;
  if (!H.home) return null;
  const stby = { x: H.home.x + TUG_STBY.dx, z: H.home.z + TUG_STBY.dz, yaw: TUG_STBY.yaw };
  const att = t => shipLocal(shipPose(t), TUG_ATT.ax, TUG_ATT.az);
  const move = (a, b, u) => { const k = ss(clamp(u, 0, 1)); return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), yaw: a.yaw + wrapA(b.yaw - a.yaw) * k, mv: k > 0 && k < 1 }; };
  const L = S.push + S.turn + S.sail, c0 = Math.floor(T / SHIP_C) * SHIP_C;
  let t = T - c0;
  if (t < S.dock) {   // 靠港：前 40 秒從船邊回待命點，最後 40 秒回到船邊
    if (t < TUG_MOVE) return move(att(c0), stby, t / TUG_MOVE);
    if (t > S.dock - TUG_MOVE) return move(stby, att(c0), (t - S.dock + TUG_MOVE) / TUG_MOVE);
    return stby;
  }
  t -= S.dock;
  if (t < S.push + S.turn) return att(T);                                                     // 拖離碼頭、轉向
  if (t < S.push + S.turn + TUG_MOVE) return move(att(c0 + S.dock + S.push + S.turn), stby, (t - S.push - S.turn) / TUG_MOVE);
  const back = t - L - S.away;   // 回程（shipPose 的回程是同一條路倒著走）
  if (back > S.sail - TUG_MOVE && back < S.sail) return move(stby, att(T + (S.sail - back)), (back - S.sail + TUG_MOVE) / TUG_MOVE);
  if (back >= S.sail) return att(T);
  return stby;
}

// ─── 替身（以檔案開啟、模型還沒下載）───
function ferryKit() {
  const k = new Kit(), Y = 0xe8c030;
  k.box(0, -.4, 0, 11.4, 3, 50, 0x2a2c30, 2).box(0, 1.6, 0, 11.6, 1.2, 50, Y, 0).box(0, 1.25, 0, 10.6, .1, 49, 0x6a6c70, 2);
  for (const s of [-1, 1]) k.box(s * 5.3, 4.2, 0, .9, 4, 30, Y, 0).box(s * 5.3, 4.6, 0, .95, .5, 28, 0x9ab4c8, 1);
  k.box(0, 8.8, 0, 8, 2.6, 7, 0xf0e8d0, 10).box(0, 9.1, 3.52, 7.6, 1, .05, 0x9ab4c8, 1).box(0, 9.1, -3.52, 7.6, 1, .05, 0x9ab4c8, 1).cyl(0, 13, 0, .12, .12, 6, 6, 0xc8ccd4, 3);
  return k;
}
function tugKit() {
  const k = new Kit();
  k.box(0, -.6, 0, 6.4, 2.6, 21, 0x7a2a1e, 2).box(0, 1.2, 0, 6.5, 1.2, 21.5, 0x2a2c30, 0).box(0, 3.2, 1.5, 4.4, 2.8, 7, 0xe8e4dc, 10)
    .box(0, 5.2, 2.6, 3.4, 1.4, 3, 0xe8e4dc, 10).box(0, 5.3, 4.12, 3, .7, .05, 0x9ab4c8, 1).cyl(0, 7.4, 1, .3, .35, 2.4, 10, 0x1a1a1a, 2);
  for (const z of [-9, 9]) k.cyl(0, 1.2, z, .9, .9, .5, 12, 0x15171a, 6, Math.PI / 2, Math.PI / 2, 0);
  return k;
}
// 船上的航行燈：照 31-boats.js 的 boatLamps（量模型頂點擺舷燈、桅燈與船頭燈）
function seaShip(kind, len, w) {
  const g = new T.Group(), mat = mkUber({ double: true }); scene.add(g);
  const fb = new T.Mesh((kind === 'ferry' ? ferryKit() : tugKit()).build(), mat); g.add(fb);
  return { kind, g, fb, mat, len, w, x: 0, z: 0, yaw: 0, y: SEA_Y, wakeT: 0, sp: 0 };
}
const FERRY_V = seaShip('ferry', 50, 11.5), TUG_V = seaShip('tug', 22, 6.5);

// ─── 水警艇 ───
const PB = { list: [], taken: [], spawnT: 4, landT: 0, made: 0 };   // ai: true（pbMake）：由這裡推進，69-combat.js 的「沒人開的車滑行」跳過
const PB_MAX = [0, 1, 1, 2, 2, 3];
function pbKit() {
  const k = boatKit('polboat');   // 31-boats.js 的程式建模船殼＋駕駛台
  k.box(0, 2.1, .2, 3.2, 1.6, 4.2, 0xf2f2f2, 0).box(0, 2.3, 2.32, 3, .8, .05, 0x9ab4c8, 1).box(0, 2.95, .2, 3.3, .1, 4.4, 0x1a2a6a, 0);
  return k;
}
function pbMake(x, z, yaw) {
  const T0 = BOAT_TYPES.polboat, mat = mkUber({ double: true }), g = new T.Group(), body = new T.Group(); g.add(body); scene.add(g);
  const fb = new T.Mesh(pbKit().build(), mat); body.add(fb);
  // 警示燈條：紅藍兩組輪流亮（模型的燈條在船頂 4.3 m、船心往後 0.6 m）
  const top = SEA.it ? 4.34 - SEA_DRAFT.polboat + .14 : 3.15, lz = SEA.it ? -.58 : .2, lb = [];
  for (const [col, s] of [[0xff2030, 1], [0x2050ff, -1]]) { const m = new T.Mesh(new Kit().box(s * .55, top, lz, .8, .14, .28, col, 11).build(), mat); body.add(m); lb.push(m); }
  if (SEA.it && SEA.it.polboat) { fb.visible = false; body.add(propObject(SEA.it.polboat, 0, -SEA_DRAFT.polboat, 0)); }
  const v = { kind: 'boat', boat: true, isCar: false, pol: 1, type: 'polboat', g, body, mat, wheels: [], x, z, y: SEA_Y, yaw, vx: 0, vz: 0, yr: 0, steer: 0, spin: 0, roll: 0, pitch: 0, lean: 0,
    len: T0.len, w: T0.w, h: 2.6, rad: T0.w / 2, off: T0.len * .26, vmax: T0.vmax, eng: T0.eng, grip: 0, wb: T0.len * .6, wr: 1, name: T0.name, rpm: 0, gear: 1, slip: 0, lights: 1,
    seat: [0, .4], hp: 1400, mass: 6000, ai: true, ph: Math.random() * 6, sink: 0, wakeT: 0, fb, lb, shotT: 1.5, stuck: 0 };
  v.home = { x, z, yaw };
  vehicles.push(v); PB.list.push(v); PB.made++;
  return v;
}
function pbDrop(v) {
  const i = PB.list.indexOf(v); if (i >= 0) PB.list.splice(i, 1);
  if (player.veh === v || !vehicles.includes(v)) return;
  vehicles.splice(vehicles.indexOf(v), 1); scene.remove(v.g);
  for (const m of [v.fb, ...v.lb]) m.geometry.dispose(); v.mat.dispose();   // 模型的幾何與貼圖所有警艇共用，不收
}
// 這裡的水夠深、開得過去：船身前後兩端與中間都不擱淺，也不在陸地上
const pbWet = (x, z, yaw, L = 16) => !boatFloor(x, z) && !boatFloor(x + Math.sin(yaw) * L * .5, z + Math.cos(yaw) * L * .5) && !boatFloor(x - Math.sin(yaw) * L * .5, z - Math.cos(yaw) * L * .5);
function pbWant() {
  if (!W.stars || player.where !== 'out' || life.dead) return 0;
  const wet = player.swim || player.mode === 'drive' && player.veh && player.veh.boat && !player.veh.pol;
  return wet ? PB_MAX[W.stars] : 0;
}
// 出生點：玩家 170–240 m 外、鏡頭背後或很遠、水夠深；船頭朝玩家
function pbSpot() {
  const px = pX(), pz = pZ(); camera.getWorldDirection(_v3a);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 170 + Math.random() * 70, x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
    const yaw = Math.atan2(px - x, pz - z);
    if (!pbWet(x, z, yaw, 20)) continue;
    if (i < 30 && (Math.sin(a) * _v3a.x + Math.cos(a) * _v3a.z) > .3 && r < 220) continue;   // 先找鏡頭看不到的方向
    return { x, z, yaw };
  }
  return null;
}
const _v3a = new T.Vector3();
function pbStep(v, dt) {
  const px = pX(), pz = pZ(), dx = px - v.x, dz = pz - v.z, d = Math.hypot(dx, dz) || 1;
  const want = pbWant(), leave = !want || PB.list.indexOf(v) >= want;
  // 目標：離開時往反方向；30 m 內繞著玩家打轉（目標偏到側面 18 m），不一直撞
  let tx = px, tz = pz;
  if (leave) { tx = v.x - dx / d * 100; tz = v.z - dz / d * 100; }
  else {
    const pv = player.mode === 'drive' ? player.veh : null;
    if (pv) { tx += pv.vx * Math.min(d / 20, 2.5); tz += pv.vz * Math.min(d / 20, 2.5); }
    if (d < 34) { const s = (PB.list.indexOf(v) % 2 ? -1 : 1); tx += dz / d * 18 * s; tz -= dx / d * 18 * s; }
  }
  let hd = Math.atan2(tx - v.x, tz - v.z);
  // 前方太淺或有東西（防波堤的礁石、碼頭）就換一個偏角（左右輪流試）：沿航向量三個距離、每點左右各 3 m（船寬）；選到的偏角留 2.5 秒，不會每幀左右換
  const look = 18 + Math.hypot(v.vx, v.vz) * 1.2;
  const clear = a => {
    const fx = Math.sin(a), fz = Math.cos(a);
    colY = v.y;
    let ok = true;
    for (const k of [.35, .7, 1]) {
      const x = v.x + fx * look * k, z = v.z + fz * look * k, c = collideCircle(x, z, 3.2, false);
      if (boatFloor(x, z) || boatFloor(x + fz * 3, z - fx * 3) || boatFloor(x - fz * 3, z + fx * 3) || Math.abs(c.x - x) + Math.abs(c.z - z) > .01) { ok = false; break; }
    }
    colY = 0;
    return ok;
  };
  v.detT = Math.max(0, (v.detT || 0) - dt);
  const offs = v.detT > 0 ? [v.det, 0, .45, -.45, .9, -.9, 1.4, -1.4, 2, -2, 2.8] : [0, .45, -.45, .9, -.9, 1.4, -1.4, 2, -2, 2.8];
  for (const o of offs) if (clear(hd + o)) { if (o && v.detT <= 0) { v.det = o; v.detT = 2.5; } hd += o; break; }
  const err = wrapA(hd - v.yaw), sp = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
  // 卡住（擱淺或頂著岸）就倒車 2 秒，之後往另一邊繞 4 秒
  v.stuck = Math.abs(sp) < 1 && !leave && d > 20 ? v.stuck + dt : 0;
  if (v.stuck > 2.5) { v.backT = 2; v.stuck = 0; v.det = (v.det > 0 ? -1.4 : 1.4); v.detT = 6; }
  const back = (v.backT = Math.max(0, (v.backT || 0) - dt)) > 0;
  const thr = back ? 0 : leave || d > 40 ? 1 : clamp((d - 10) / 30, .35, 1) * (Math.abs(err) > 1.4 ? .5 : 1);
  driveBoat(v, { thr, brk: back ? 1 : 0, steer: clamp(err * 2.2, -1, 1) * (back ? -1 : 1), hb: Math.abs(err) > 1.3 && sp > 8 }, dt);
  // 2 星以上：船上的警察開槍（站在船頭甲板）
  if (!leave && W.stars >= 2 && d < 75 && !life.dead) {
    v.shotT -= dt;
    if (v.shotT <= 0) { npcShoot(v.x + Math.sin(v.yaw) * 3, v.y + 2.6, v.z + Math.cos(v.yaw) * 3, .24 + W.stars * .03, 8, 1, 'cop'); v.shotT = .6 + Math.random() * .7; }
  }
  return leave;
}
// 69-police.js 的 sees()：開闊水面上 150 m 內有警艇就一直看得到
function seaCopSees(x, z) { for (const v of PB.list) if (!v.dead && player.veh !== v && Math.hypot(v.x - x, v.z - z) < 150) return true; return false; }
function seaSirenD(x, z) { let m = 999; for (const v of PB.list) if (!v.dead && player.veh !== v) m = Math.min(m, Math.hypot(v.x - x, v.z - z)); return m; }

// ─── 船身矩形（cx, cz：中心；yaw：船頭方向；hl／hb：半長、半寬）：把圓（x, z, r）推出去，回傳推出的方向 ───
function hullPush(H, x, z, r) {
  const c = Math.cos(H.yaw), s = Math.sin(H.yaw), dx = x - H.x, dz = z - H.z;
  let lx = dx * c - dz * s, lz = dx * s + dz * c;   // lz 沿船長、lx 橫向
  const hx = H.hb + r, hz = H.hl + r;
  if (Math.abs(lx) > hx || Math.abs(lz) > hz) return null;
  if (hx - Math.abs(lx) < hz - Math.abs(lz)) lx = Math.sign(lx) * hx; else lz = Math.sign(lz) * hz;
  return { x: lx * c + lz * s + H.x, z: -lx * s + lz * c + H.z };
}
// 31-boats.js 的 driveBoat 每一步呼叫：撞上渡輪或拖船，船被推開、撞的那一下的速度當成撞擊
function seaHullHit(v) {
  let imp = 0;
  for (const H of SEA.hulls) {
    const q = hullPush(H, v.x, v.z, v.rad); if (!q) continue;
    const px = q.x - v.x, pz = q.z - v.z, d = Math.hypot(px, pz) || 1;
    v.x = q.x; v.z = q.z;
    const vn = (v.vx * px + v.vz * pz) / d;
    if (vn < 0) { v.vx -= vn * px / d * 1.3; v.vz -= vn * pz / d * 1.3; imp = Math.max(imp, -vn); }
  }
  return imp;
}

// ─── 擺船：位置、隨浪起伏、尾跡、燈 ───
function seaPlace(S, p, dt) {
  const t = uTimeNow(), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  S.x = p.x; S.z = p.z; S.yaw = p.yaw;
  const L2 = S.len * .4, hb = seaWave(S.x + fx * L2, S.z + fz * L2, t), hs = seaWave(S.x - fx * L2, S.z - fz * L2, t);
  const hl = seaWave(S.x - fz * S.w * .4, S.z + fx * S.w * .4, t), hr = seaWave(S.x + fz * S.w * .4, S.z - fx * S.w * .4, t);
  const k = S.kind === 'ferry' ? .25 : .5;   // 大船晃得少
  S.g.position.set(S.x, SEA_Y + (hb + hs) / 2 * k, S.z);
  S.g.rotation.set(0, 0, 0); S.g.rotateY(S.yaw); S.g.rotateX(Math.atan2(hs - hb, S.len * .8) * k); S.g.rotateZ(Math.atan2(hr - hl, S.w * .8) * k);
  const far = Math.hypot(S.x - camera.position.x, S.z - camera.position.z);
  S.g.visible = far < 1800;
  // 尾跡：倒著開的時候船尾在另一頭（31-boats.js 的 boatWake 用 yaw 找船尾）
  if (S.sp && far < 260) { const w = { x: S.x, z: S.z, yaw: S.sp < 0 ? S.yaw + Math.PI : S.yaw, len: S.len, w: S.w, wakeT: S.wakeT }; boatWake(w, Math.abs(S.sp), dt); S.wakeT = w.wakeT; }
}
function seaUpdate(dt) {
  SEA.t += dt;
  SEA.hulls.length = 0;
  // 渡輪（時間跟著遊戲時鐘之外自己走；SEA.ft 可以在測試裡跳）
  SEA.ft = (SEA.ft ?? 30) + dt;
  const fp = ferryPose(SEA.ft); FERRY_V.sp = fp.sp; FERRY_V.state = fp.state;
  seaPlace(FERRY_V, fp, dt);
  SEA.hulls.push({ x: FERRY_V.x, z: FERRY_V.z, yaw: FERRY_V.yaw, hl: 25, hb: 5.8 });
  // 拖船：跟著貨櫃船的時間（harbor.st）
  const tp = tugPose(harbor.st);
  if (tp) {
    const [x, z] = toW(tp.x, tp.z, harbor.zn), yaw = yawW(harbor.zn, tp.yaw, tp.x, tp.z);
    const sp = harbor.st - (TUG_V.lt ?? harbor.st) > 0 && dt > 0 ? Math.hypot(x - TUG_V.x, z - TUG_V.z) / dt : 0;
    TUG_V.lt = harbor.st;
    TUG_V.sp = sp > .4 && sp < 30 ? sp : 0;
    seaPlace(TUG_V, { x, z, yaw }, dt);
    SEA.hulls.push({ x, z, yaw, hl: 11, hb: 3.3 });
  }
  // 游泳的人碰到船身：推開
  if (player.swim) for (const H of SEA.hulls) { const q = hullPush(H, player.x, player.z, .4); if (q) { player.x = q.x; player.z = q.z; } }
  // 水警艇：補船、追、離開、燒完沉掉
  const want = pbWant();
  PB.spawnT -= dt;
  if (want > PB.list.filter(v => !v.dead && player.veh !== v).length && PB.spawnT <= 0) {
    PB.spawnT = 8;
    const s = pbSpot(); if (s) pbMake(s.x, s.z, s.yaw);
  }
  for (const v of [...PB.list]) {
    if (player.veh === v) { PB.list.splice(PB.list.indexOf(v), 1); v.lb[0].visible = v.lb[1].visible = false; PB.taken.push(v); continue; }   // 搶下來了：之後是一般的船（下面的 taken）
    const d = Math.hypot(v.x - pX(), v.z - pZ());
    let leave = false;
    if (v.dead) { v.sink = Math.min(5, v.sink + dt * .12); driveBoat(v, IDLE_INP, dt); }
    else leave = pbStep(v, dt);
    const on = !v.dead && !leave && Math.floor(SEA.t * 6 + v.ph) % 2;
    v.lb[0].visible = !v.dead && !leave && !!on; v.lb[1].visible = !v.dead && !leave && !on;
    if (leave && d > 230 || v.dead && v.sink > 4 && d > 120 || d > 700) pbDrop(v);
  }
  // 搶來的警艇：沒人開的時候照樣漂、起伏（ai 一直是 true，69-combat.js 的滑行不會再推一次）；玩家離開 400 m 就收掉
  for (const v of [...PB.taken]) {
    if (player.veh === v) continue;
    if (v.dead) v.sink = Math.min(5, v.sink + dt * .12);
    driveBoat(v, IDLE_INP, dt);
    if (Math.hypot(v.x - pX(), v.z - pZ()) > 400) { PB.taken.splice(PB.taken.indexOf(v), 1); pbDrop(v); }
  }
}

// ─── 模型 ───
if (GLB_ON) loadProps('sea').then(it => {
  if (!it) return;
  SEA.it = it;
  for (const [S, id] of [[FERRY_V, 'ferry'], [TUG_V, 'tug']]) {
    const m = it[id]; if (!m) continue;
    const o = propObject(m, 0, -SEA_DRAFT[id], 0);
    S.fb.visible = false; S.g.add(o);
    S.g.add(new T.Mesh(boatLamps({ len: S.len, w: S.w }, o).build(), S.mat));
  }
  // 已經在追的警艇也換掉
  for (const v of PB.list) if (!v.glb && it.polboat) { v.fb.visible = false; v.body.add(propObject(it.polboat, 0, -SEA_DRAFT.polboat, 0)); v.glb = 1; }
}).catch(e => console.warn('sea', e));

boatApi.sea = {
  FERRY_A, FERRY_B, PB, SEA,
  ferry: () => ({ x: FERRY_V.x, z: FERRY_V.z, yaw: FERRY_V.yaw, state: FERRY_V.state, sp: FERRY_V.sp, glb: !FERRY_V.fb.visible }),
  tug: () => ({ x: TUG_V.x, z: TUG_V.z, yaw: TUG_V.yaw, sp: TUG_V.sp, glb: !TUG_V.fb.visible }),
  ferryAt: T => { SEA.ft = T; return ferryPose(T).state; },
  // 渡輪航線與拖船各時刻的位置有沒有擱淺（驗收用：取樣航線上的點，船頭、船尾、兩舷都要夠深）
  route: (n = 40) => { const bad = []; for (let i = 0; i <= n; i++) { const p = ferryAt(i / n); if (!pbWet(p.x, p.z, p.yaw, 44)) bad.push(i / n); } return bad; },
  tugRoute: (n = 120) => { const bad = []; for (let i = 0; i <= n; i++) { const T = i / n * SHIP_C, p = tugPose(T); if (!p) continue; const [x, z] = toW(p.x, p.z, harbor.zn); if (!pbWet(x, z, yawW(harbor.zn, p.yaw, p.x, p.z), 18)) bad.push(+T.toFixed(0)); } return bad; },
  cops: () => PB.list.map(v => ({ x: +v.x.toFixed(1), z: +v.z.toFixed(1), d: +Math.hypot(v.x - pX(), v.z - pZ()).toFixed(1), dead: !!v.dead, hp: v.hp })),
  spawn: () => { const s = pbSpot(); return s ? (pbMake(s.x, s.z, s.yaw), PB.list.length) : 0; },
};
