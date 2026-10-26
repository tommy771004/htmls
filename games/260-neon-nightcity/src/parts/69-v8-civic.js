// ═══ 第八部曲：城市勤務（HANDOFF 補完）：消防派遣與水砲、救護派遣、拖吊車 ═══
// 車都是 traffic.glb 的模型（30-vehicles.js 的 TYPES）：消防水箱車 firetruck（FixedShark554）、消防指揮車 fire_chief 與拖吊車 tow（DanielZhabotinsky）。
// · 消防：玩家 FIRE_R 內有火（油線、起火的車、燒著的殘骸）燒了 FIRE_WAIT 秒，消防水箱車加一台指揮車從看不到的路口開過來（routeTo 照路網走），
//   停在火場 FIRE_STOP 內用車頂水砲噴，水柱落點 SPRAY_R 內的火熄掉；附近沒火了再找下一處，都沒有就開走。
//   搶來自己開（F 上車）：按住開火鍵往準星方向噴水，可以滅火、沖倒路人、讓警察倒地（算拒捕）。
// · 救護：路人倒地 AMB_WAIT 秒後救護車開過來，等它到之前傷者不會自己爬起來；到了停 AMB_TREAT 秒，把旁邊倒地的人都扶起來再開走。
// · 拖吊車：拖吊場裡停著一台（69-v5-civic.js 的 facParked）。開著它倒車到別台車前面或後面 TOW_REACH 內按 E 掛上，再按 E 放下；
//   拖進拖吊場放下（自己的座駕以外）拿 TOW_PAY。被拖的車前輪離地、照拖桿點跟著轉（不算碰撞，和拖吊車之間也不互推）。
// 每幀入口 v8Update（99-main.js 在 v5Update 之後）；警笛距離併進 69-police.js 的 sirenNear；測試 API 在 __nc.gta.v8。
const TRUCK_K = .35;   // 派遣的水砲滅火比玩家慢（一灘燒著的油約 1.5 秒），看得到噴水的過程
const FIRE_R = 220, FIRE_WAIT = 5, FIRE_STOP = 15, FIRE_HOLD = 12, SPRAY_R = 3.2, SPRAY_MAX = 28, SPRAY_K = 2;
const AMB_R = 150, AMB_WAIT = 6, AMB_TREAT = 5, AMB_REACH = 20;
const CIV_DROP = 260, CIV_COOL = 25;
const TOW_REACH = 3.4, TOW_PAY = 350;
const WATER_C = [1.5, 1.7, 1.9];   // 粒子在夜裡會乘上環境光，要亮一點才看得到
const CIV = { fire: null, amb: null, fireT: 0, ambT: 0, cool: { fire: 0, amb: 0 }, tow: null, sprayT: 0, hissT: 0, on: !/[?&]civ=0\b/.test(location.search),   // ?civ=0：不派消防車與救護車（驗收腳本比對用）
  done: { fire: 0, amb: 0, tow: 0 } };

// ─── 火源：燒著的油、起火的車（耐久在 STAGE.fire 以下還沒爆）、爆炸後還在燒的殘骸 ───
function fireSpots(x, z, r) {
  const out = [], r2 = r * r;
  for (const f of fuel) if (f.fire > 0 && (f.x - x) ** 2 + (f.z - z) ** 2 < r2) out.push({ x: f.x, z: f.z, f });
  for (const v of vehicles) {
    if ((v.x - x) ** 2 + (v.z - z) ** 2 > r2 || v.boat || v.fly) continue;
    if (v.dead ? v.burnT < 18 : v.hp < hpLockOf(v) * STAGE.fire) out.push({ x: v.x, z: v.z, v });
  }
  return out;
}
// 落點 (x, z) 半徑 r 內的火熄掉一些（k 是這一幀的量）；回傳還有沒有火
function douse(x, z, r, k, mine) {
  let lit = false;
  for (const f of fuel) {
    if (!(f.fire > 0) || (f.x - x) ** 2 + (f.z - z) ** 2 > r * r) continue;
    f.fire -= k * SPRAY_K;
    if (f.fire <= 0) { f.fire = 0; f.burn = 1; f.t = FUEL_LIFE; emit('smoke', f.x, f.y + .2, f.z, { vy: 1.5, max: 1.6, s0: .3, s1: 1.2, a: .45, c: [.75, .75, .78] }); } else lit = true;
  }
  for (const v of vehicles) {
    if ((v.x - x) ** 2 + (v.z - z) ** 2 > (r + v.len / 2) ** 2) continue;
    if (v.dead) { if (v.burnT < 18) { v.burnT += k * 6; if (v.burnT >= 18) v.burnT = 30; else lit = true; } }
    else if (v.hp < hpLockOf(v) * STAGE.fire) { v.douse = (v.douse || 0) + k; if (v.douse > .8) { v.hp = hpLockOf(v) * STAGE.fire * 1.04; v.douse = 0; } else lit = true; }
  }
  // 水柱沖到的人：路人倒地、警察滑倒（玩家噴的才算罪）
  for (let i = 0; i < PED_N; i++) {
    const p = peds.people[i], ps = pedState[i];
    if (!ps || ps.down > 0 || (p.x - x) ** 2 + (p.z - z) ** 2 > (r * .6) ** 2) continue;
    knockPed(i, p.x - x, p.z - z);
    if (mine) crime('assault', p.x, p.z);
  }
  for (const c of W.cops) if (c.on && c.state !== 'down' && !(c.stunT > 0) && (c.x - x) ** 2 + (c.z - z) ** 2 < (r * .6) ** 2) { stunCop(c, 2.4); if (mine) crime('resist', c.x, c.z); }
  return lit;
}
// 水柱：從噴嘴拋到落點的水珠（拋物線），落點濺起水花
function sprayFx(ox, oy, oz, tx, ty, tz, dt) {
  const d = Math.hypot(tx - ox, tz - oz), T0 = clamp(d / 19, .35, 1.6), g = 9.8;
  const vx = (tx - ox) / T0, vz = (tz - oz) / T0, vy = (ty - oy + .5 * g * T0 * T0) / T0;
  const n = Math.min(10, Math.ceil(dt * 400));
  for (let i = 0; i < n; i++) {
    const j = () => (Math.random() - .5) * .9;
    const e = Math.random() * .08;   // 從噴嘴往前錯開一點，水柱連成一條
    emit('spray', ox + vx * e, oy + vy * e, oz + vz * e, { vx: vx + j(), vy: vy + j() - g * e, vz: vz + j(), max: T0 * 1.05 - e, s0: .2, s1: .7, grav: g, drag: .02, a: .85, c: WATER_C });
  }
  if (Math.random() < dt * 14) emit('smoke', tx + (Math.random() - .5) * 1.5, ty + .2, tz + (Math.random() - .5) * 1.5, { vy: 1.6, max: .9, s0: .3, s1: 1.1, grav: 2, a: .35, c: WATER_C });
}
const nozzle = (v, o) => { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); return o.set(v.x + fx * v.len * .18, (v.y || 0) + 3.75, v.z + fz * v.len * .18); };
const _nz = V3();
// 水聲：80-audio.js 的 hiss 是 0.45 秒的單發音，每 0.3 秒補一次，越遠越小（70 m 外不放）
function waterSnd(dt, d) { if ((CIV.hissT -= dt) > 0 || d > 70) return; CIV.hissT = .3; sfx.hiss(.9 * (1 - d / 70)); }

// ─── 派遣車：從看不到的路口出發，照路網開到目標；被玩家開走就變成一般搶來的車 ───
function civSpawn(type, sp, back) {
  const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw);
  const v = buildVeh(type, sp.x - fx * back, sp.z - fz * back, sp.yaw, 10, Math.random(), 0, 'civic');
  v.y = spawnY(v.x, v.z); v.ai = true; v.lights = 1; v.siren = 1; v.hpLock = 1;
  if (type === 'firetruck') fireKit(v);
  poseVehicle(v);
  return { v, route: null, k: 1, state: 'drive', stuck: 0, rev: 0, spd: 1.1, t: 0 };
}
// 目標點在人行道或路外（傷者、燒著的車）：路線停在最近的路面點（routeTo 最後一點是目標本身，拿掉），不開上人行道撞人
function civGo(tk, x, z) {
  const R = routeTo(tk.v.x, tk.v.z, x, z);
  if (R.length > 2) R.pop();
  const [gx, gz] = R[R.length - 1];
  tk.route = R; tk.k = 1; tk.state = 'drive'; tk.gx = gx; tk.gz = gz; tk.t = 0; tk.best = null; tk.chk = 8; }
function civLeave(tk) {
  const n = fleeNode(tk.v.x, tk.v.z, 200, 420);
  civGo(tk, n[0], n[1]); tk.state = 'leave'; tk.v.siren = 0;
}
function civDrop(tk) {
  const v = tk.v, i = vehicles.indexOf(v);
  if (player.veh === v) return;
  if (i >= 0) vehicles.splice(i, 1);
  scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
// 這一幀的駕駛：照路線開，到了 stopR 內（或路線走完、開了兩分鐘還沒到）就踩煞車停住；回傳是否到了
function civDrive(tk, dt, stopR) {
  const v = tk.v;
  tk.t += dt;
  if (player.veh === v) { tk.state = 'taken'; return false; }
  if (v.dead) { tk.state = 'dead'; return false; }
  const left = Math.hypot(tk.gx - v.x, tk.gz - v.z);
  if (tk.state === 'park' || left < stopR || tk.k >= tk.route.length - 1 && left < stopR + 8 || tk.k >= tk.route.length || tk.t > 120) {
    driveVehicle(v, { thr: 0, brk: 1, steer: 0, hb: false }, dt);
    return true;
  }
  // 8 秒沒前進 3 m（卡在路口或車陣裡）：玩家 50 m 外、而且不在畫面前方時，直接挪到路線的下一點
  if ((tk.chk = (tk.chk ?? 8) - dt) <= 0) {
    if (tk.best != null && tk.best - left < 3 && tk.k < tk.route.length && civHidden(v)) {
      const [ax, az] = tk.route[tk.k], [bx, bz] = tk.route[Math.min(tk.k + 1, tk.route.length - 1)];
      v.x = ax; v.z = az; v.yaw = Math.atan2(bx - ax, bz - az) || v.yaw; v.vx = v.vz = 0; v.y = spawnY(ax, az); tk.k++;
    }
    tk.best = Math.hypot(tk.gx - v.x, tk.gz - v.z); tk.chk = 8;
  }
  // 69-events.js：靠右開、卡住倒車。它走完路線會自己挑一個隨機目的地（truckRoute），這裡換回原本的路線、停在終點
  const R = tk.route;
  truckDrive(tk, dt);
  if (tk.route !== R) { tk.route = R; tk.k = R.length; }
  return false;
}
const civHidden = v => { const dx = v.x - camera.position.x, dz = v.z - camera.position.z, d = Math.hypot(dx, dz); camera.getWorldDirection(_nz); return d > 50 && (dx * _nz.x + dz * _nz.z) / d < .3; };
// 車頂的紅藍警示燈（離玩家 140 m 內才放光源）
function civBeacon(v, t) {
  if (!v.siren || Math.hypot(v.x - pX(), v.z - pZ()) > 140 || fxLights.length >= 24) return;
  const ph = Math.floor(t * 6) % 2, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), s = ph ? 1 : -1, w = (v.w || 2) * .35;
  fxLights.push({ x: v.x + fx * v.len * .3 + fz * w * s, y: (v.y || 0) + (v.water ? 3.4 : 1.8), z: v.z + fz * v.len * .3 - fx * w * s, col: ph ? lin(0xff2a2a) : lin(0x2a5cff), r: 9, i: 2.2, life: 0, max: .08 });
}
// 69-police.js 的 policeUpdate 併進警笛距離
function civSirenD(x, z) {
  let d = 999;
  for (const tk of [CIV.fire && CIV.fire.truck, CIV.fire && CIV.fire.chief, CIV.amb && CIV.amb.tk]) if (tk && tk.v.siren && !tk.v.dead && tk.state !== 'taken') d = Math.min(d, Math.hypot(tk.v.x - x, tk.v.z - z));
  return d;
}
// 被玩家開走或燒掉的派遣車：放進 jacked（68-gta.js 會把遠的舊車收掉），不再歸這裡管
function civRelease(tk) { const v = tk.v; v.ai = false; v.siren = 0; if (!jacked.includes(v)) jacked.push(v); }

// ─── 消防 ───
function fireStepCiv(dt, t) {
  const px = pX(), pz = pZ(), F = CIV.fire;
  if (!F) {
    CIV.cool.fire -= dt;
    const s = player.where === 'out' && CIV.cool.fire <= 0 ? fireSpots(px, pz, FIRE_R) : [];
    CIV.fireT = s.length ? CIV.fireT + dt : 0;
    if (CIV.fireT < FIRE_WAIT) return;
    const sp = spawnSpot(90, 190);
    if (!sp) return;
    const f = s[0], truck = civSpawn('firetruck', sp, 0), chief = civSpawn('fire_chief', sp, 13);
    civGo(truck, f.x, f.z); civGo(chief, f.x, f.z);
    CIV.fire = { truck, chief, x: f.x, z: f.z, idle: 0 };
    CIV.fireT = 0;
    if (Math.hypot(sp.x - px, sp.z - pz) < 250) toast('消防車出動了');
    return;
  }
  for (const k of ['truck', 'chief']) {
    const tk = F[k];
    if (!tk) continue;
    if (tk.state === 'taken' || tk.state === 'dead') { civRelease(tk); F[k] = null; continue; }
    const d = Math.hypot(tk.v.x - px, tk.v.z - pz);
    if (d > (tk.state === 'leave' ? CIV_DROP : 420)) { civDrop(tk); F[k] = null; continue; }
    if (tk.state === 'leave') { if (civDrive(tk, dt, 14)) { civDrop(tk); F[k] = null; } continue; }
    const at = civDrive(tk, dt, k === 'truck' ? FIRE_STOP - 4 : FIRE_STOP + 4);
    civBeacon(tk.v, t);
    if (at && tk.state === 'drive') { tk.state = 'park'; tk.v.lights = 1; }
  }
  const tk = F.truck;
  // 消防車到之前，火場 FIRE_HOLD 內燒著的殘骸不會自己熄（殘骸 18 秒就燒完，不然車到了只剩煙）；油火照原本的 7 秒燒完
  if (tk && tk.state === 'drive' && tk.t < 90) {
    for (const v of vehicles) if (v.dead && v.burnT < 18 && (v.x - F.x) ** 2 + (v.z - F.z) ** 2 < FIRE_HOLD * FIRE_HOLD) v.burnT = Math.min(v.burnT, 12);
  }
  if (tk && tk.state === 'park') {
    const v = tk.v, o = nozzle(v, _nz), s = fireSpots(v.x, v.z, FIRE_STOP + 12);
    if (s.length) {
      F.idle = 0;
      s.sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z));
      const f = s[0], ty = groundH(f.x, f.z) + (f.v ? 1 : .1);
      sprayFx(o.x, o.y, o.z, f.x, ty, f.z, dt);
      douse(f.x, f.z, SPRAY_R, dt * TRUCK_K, false);
      waterSnd(dt, Math.hypot(v.x - px, v.z - pz));
    } else if ((F.idle += dt) > 3) {
      const nx = fireSpots(v.x, v.z, 140);
      if (nx.length) { civGo(tk, nx[0].x, nx[0].z); if (F.chief) civGo(F.chief, nx[0].x, nx[0].z); F.idle = 0; }
      else { civLeave(tk); if (F.chief) civLeave(F.chief); CIV.done.fire++; }
    }
  }
  if (!F.truck && !F.chief) { CIV.fire = null; CIV.cool.fire = CIV_COOL; }
}
// 消防水箱車：水砲、比一般貨車耐撞也重；9 m 長的車照真的軸距轉不過十字路口，轉向放寬
function fireKit(v) { v.water = 1; v.hp = v.hpMax = 3200; v.mass = 9000; v.wb = v.len * .4; v.stK = 1.3; }
// 玩家開消防水箱車：按住開火鍵，水柱打到準星指的地面（最遠 SPRAY_MAX）
function playerSpray(dt) {
  const v = player.veh;
  if (v && v.type === 'firetruck' && !v.water) fireKit(v);   // 醫院門口停的那台被開走（68-gta 的 detachCar）也一樣
  if (!v || !v.water || player.where !== 'out' || !arm.trig || dlg.open || life.dead) { CIV.sprayT = 0; return; }
  // 從車頂噴嘴沿準星方向打到地面：相機壓得越低噴得越近（4 m 到 SPRAY_MAX）
  const o = nozzle(v, _nz), R = aimRay(), hl = Math.hypot(R.dx, R.dz) || 1;
  const hd = clamp(R.dy < -.01 ? (o.y - groundH(o.x, o.z)) / -R.dy * hl : SPRAY_MAX, 4, SPRAY_MAX);
  const tx = o.x + R.dx / hl * hd, tz = o.z + R.dz / hl * hd;
  const ty = groundH(tx, tz) + .1;
  sprayFx(o.x, o.y, o.z, tx, ty, tz, dt);
  douse(tx, tz, SPRAY_R, dt, true);
  CIV.sprayT += dt;
  waterSnd(dt, 0);
}

// ─── 救護 ───
function downPed(x, z, r) {
  let best = -1, bd = r * r;
  for (let i = 0; i < PED_N; i++) {
    const ps = pedState[i], p = peds.people[i];
    if (!ps || !(ps.down > 0) || ps.stun || ps.out) continue;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// 擔架：救護車停好處置時擺在傷者旁邊（靠救護車那一側），開走就收起來；以 http(s) 開啟換成 amb_str 組的模型，否則是方塊替身
const AMB_STR = { g: null };
function ambStretcher(on, x, z, yaw) {
  let S = AMB_STR.g;
  if (!S) {
    if (!on) return;
    S = AMB_STR.g = new T.Group(); scene.add(S);
    const k = new Kit(); k.box(0, .85, 0, .6, .12, 1.9, 0xd8dadc, 10).box(0, .4, 0, .5, .05, 1.6, 0x9a9ea2, 15);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(sx * .24, .42, sz * .7, .04, .8, .04, 0x9a9ea2, 15);
    const fb = new T.Mesh(k.build(), MAT.uber); S.add(fb);
    if (GLB_ON) loadProps('amb_str').then(it => { if (it && it.amb_str) { fb.removeFromParent(); fb.geometry.dispose(); S.add(propObject(it.amb_str, 0, 0, 0, 0)); } }).catch(e => console.warn('amb_str', e));
  }
  S.visible = !!on;
  if (on) { S.position.set(x, groundH(x, z), z); S.rotation.y = yaw; }
}
function ambStep(dt, t) {
  const px = pX(), pz = pZ(), A = CIV.amb;
  if (!A || A.tk.state !== 'park') ambStretcher(false);
  if (!A) {
    CIV.cool.amb -= dt;
    const k = player.where === 'out' && CIV.cool.amb <= 0 ? downPed(px, pz, AMB_R) : -1;
    CIV.ambT = k >= 0 ? CIV.ambT + dt : 0;
    if (CIV.ambT < AMB_WAIT || k < 0) return;
    const sp = spawnSpot(90, 180);
    if (!sp) return;
    const p = peds.people[k], tk = civSpawn('ambulance', sp, 0);
    civGo(tk, p.x, p.z);
    CIV.amb = { tk, k, treat: 0 };
    CIV.ambT = 0;
    return;
  }
  const tk = A.tk, v = tk.v;
  if (tk.state === 'taken' || tk.state === 'dead') { civRelease(tk); CIV.amb = null; CIV.cool.amb = CIV_COOL; return; }
  const d = Math.hypot(v.x - px, v.z - pz);
  civBeacon(v, t);
  if (d > (tk.state === 'leave' ? CIV_DROP : 420)) { civDrop(tk); CIV.amb = null; CIV.cool.amb = CIV_COOL; return; }
  if (tk.state === 'leave') { if (civDrive(tk, dt, 14)) { civDrop(tk); CIV.amb = null; CIV.cool.amb = CIV_COOL; } return; }
  const ps = pedState[A.k];
  if (ps && ps.down > 0 && !ps.out) ps.down = Math.max(ps.down, 1.5);   // 救護車到之前傷者躺著等
  else if (tk.state === 'drive') { const k = downPed(v.x, v.z, 120); if (k >= 0) { A.k = k; civGo(tk, peds.people[k].x, peds.people[k].z); } else { civLeave(tk); return; } }
  const at = civDrive(tk, dt, 7);
  if (at && tk.state === 'drive') tk.state = 'park';
  if (tk.state === 'park') {   // 擔架推到傷者身邊（離傷者 1.1 m、長邊和救護車到傷者的方向垂直）
    const p = peds.people[A.k], dx = v.x - p.x, dz = v.z - p.z, l = Math.hypot(dx, dz) || 1;
    ambStretcher(true, p.x + dx / l * 1.1, p.z + dz / l * 1.1, Math.atan2(dx, dz) + Math.PI / 2);
  }
  if (tk.state === 'park' && (A.treat += dt) > AMB_TREAT) {
    let n = 0;
    for (let i = 0; i < PED_N; i++) { const q = pedState[i], pp = peds.people[i]; if (q && q.down > 0 && (i === A.k || !q.stun && Math.hypot(pp.x - v.x, pp.z - v.z) < AMB_REACH)) { q.down = .01; n++; } }
    if (n && d < 60) toast(`救護員把 ${n} 位傷者扶起來了`);
    CIV.done.amb += n;
    civLeave(tk);
  }
}

// ─── 拖吊車 ───
const isTow = v => !!v && v.type === 'tow' && !v.dead;
const hitch = (v, o = V3()) => { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); return o.set(v.x - fx * (v.len / 2 + .35), 0, v.z - fz * (v.len / 2 + .35)); };
const _civH = V3();
// 拖桿點 TOW_REACH 內、最近的一台車（車流與路邊車先拆成載具才掛得上）：回傳 { c（車流物件）或 v，end：1 車頭 −1 車尾 }
function towTarget(T) {
  const h = hitch(T, _civH);
  let best = null, bd = TOW_REACH;
  const test = (o, isVeh) => {
    // 載具只掛自己的座駕與 jacked 裡的車（搶來、拆出來的車流車）：任務車（運鈔車、搶劫廂型車）、警車、AI 正在開的車、已經被拖著的車都不掛
    if (o === T || isVeh && (o.dead || o.boat || o.fly || !o.isCar || o.ai || o.unit || o.towBy || !(o === kestrel || jacked.includes(o)))) return;
    const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), L = (o.len || 4.6) / 2;
    for (const e of [1, -1]) { const d = Math.hypot(o.x + fx * L * e - h.x, o.z + fz * L * e - h.z); if (d < bd) { bd = d; best = { o, isVeh, end: e }; } }
  };
  for (const v of vehicles) test(v, true);
  for (const c of [...traffic, ...parked]) if ((c.x - h.x) ** 2 + (c.z - h.z) ** 2 < 100 && !(c.v > 1)) test(c, false);
  return best;
}
function towHook() {
  const T = player.veh, b = towTarget(T);
  if (!b) return;
  const v = b.isVeh ? b.o : detachCar(b.o);
  if (!v) return;
  v.ai = true; v.towBy = T; v.vx = v.vz = 0;
  CIV.tow = { T, v, end: b.end, from: inYard(v.x, v.z) };   // from：在拖吊場裡掛上的（被扣的車）放下不給獎金
  sfx.door(); toast(`掛上 ${v.name} · 再按 E 放下${v === kestrel ? '' : '（拖進拖吊場放下有獎金）'}`);
}
function towDrop() {
  const H = CIV.tow; if (!H) return;
  const v = H.v; v.ai = false; v.towBy = null; v.pitch = 0; v.vx = H.T.vx * .5; v.vz = H.T.vz * .5;
  CIV.tow = null; sfx.door();
  if (v !== kestrel && jacked.includes(v) && !H.from && inYard(v.x, v.z)) {
    earn(TOW_PAY, `拖吊 ${v.name}`); CIV.done.tow++;
    const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
    const j = jacked.indexOf(v); if (j >= 0) jacked.splice(j, 1);
    scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    toast(`${v.name} 拖進拖吊場 · 拿到 ${money(TOW_PAY)}`);
  } else toast(`放下 ${v.name}`);
}
// 被拖的車：拖桿點在車頭（或車尾），車身朝拖桿點轉、前輪離地
function towStep() {
  const H = CIV.tow; if (!H) return;
  const T = H.T, v = H.v;
  if (T.dead || v.dead || !vehicles.includes(v) || !vehicles.includes(T)) { if (vehicles.includes(v)) { v.ai = false; v.towBy = null; } CIV.tow = null; return; }
  const h = hitch(T, _civH), L = v.len / 2 + .15;
  let dx = h.x - v.x, dz = h.z - v.z;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  v.x = h.x - dx * L; v.z = h.z - dz * L;
  v.yaw = H.end > 0 ? Math.atan2(dx, dz) : Math.atan2(-dx, -dz);
  v.vx = T.vx; v.vz = T.vz; v.y = (T.y || 0) + .12;
  v.pitch = -.09 * H.end;
  v.spin += Math.hypot(T.vx, T.vz) * (1 / 60) / (v.wr || .34);
}
ctxHooks.push((p) => {
  if (p.mode !== 'drive' || !isTow(p.veh) || Math.hypot(p.veh.vx, p.veh.vz) > 3) return null;
  if (CIV.tow && CIV.tow.T === p.veh) return { key: 'E', text: `放下 <i>· ${CIV.tow.v.name}</i>`, fn: towDrop };
  const b = towTarget(p.veh);
  return b ? { key: 'E', text: `掛上 <i>· ${b.isVeh ? b.o.name : TYPE_NAME[b.o.type] || '車'}</i>`, fn: towHook } : null;
});

function v8Update(dt) {
  const t = uTimeNow();
  if (CIV.on && (player.where === 'out' || CIV.fire || CIV.amb)) { fireStepCiv(dt, t); ambStep(dt, t); }
  playerSpray(dt);
  towStep();
}
gtaApi.v8 = {
  CIV, fireSpots, douse, towTarget, hook: towHook, drop: towDrop,
  // 驗收：在 (x, z) 點一攤火（油）、讓第 k 個路人倒地、把派遣的冷卻與等待歸零
  fire(x, z) { for (let i = 0; i < 6; i++) fuelDrop(x + (i % 3) * .8, z + Math.floor(i / 3) * .8, 'test'); return chemIgnite(x, z, 3); },
  wreck(x, z, yaw = 0) { const v = gtaApi.kin.spawn('compact', x, z, yaw); explode(v); return v; },   // 一台爆炸後燒著的殘骸
  knock(k) { knockPed(k, 1, 0); },
  spawn: (type, x, z, yaw) => gtaApi.kin.spawn(type, x, z, yaw),
  enter(v) { if (player.mode === 'drive') exitVehicle(); enterVehicle(v); camState.yaw = v.yaw; camState.snap = true; },
  gh: (x, z) => groundH(x, z), inCity: (x, z) => inCity(x, z), poly: () => CITY_POLY,
  ped(k) { const p = peds.people[k], ps = pedState[k]; return { x: p.x, z: p.z, down: ps.down || 0, out: !!ps.out, stun: !!ps.stun }; },
  nearPed(x, z) { let b = -1, bd = 1e9; for (let i = 0; i < PED_N; i++) { const p = peds.people[i], ps = pedState[i]; if (!ps || ps.out || ps.down > 0) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = i; } } return b; },
  rush() { CIV.cool.fire = CIV.cool.amb = 0; CIV.fireT = FIRE_WAIT; CIV.ambT = AMB_WAIT; },
};
