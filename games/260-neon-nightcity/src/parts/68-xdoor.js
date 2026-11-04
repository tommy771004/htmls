// ─── 車門、坐姿駕駛與車內視角 ───
// 實車的門由 26-glb.js 的 glbDoors 照 cars.json 的 door 切出來（src/doors.mjs），實例的 inst.doors[i] = { s, piv, ax, sg, fly, ang, k, want }：
// s 1 是左門（+x，駕駛座那側）、2 是右門；k 是開的程度 0..1，doorTick 照 want 轉 piv.rotation.y（左門往外開是負角；fly 的蝴蝶門繞斜軸 ax 轉 sg × 角度）。
// 上車 doorEnter：走到門後 → 拉開門 → 坐進駕駛座（這時才 enterVehicle）→ 關門；下車 doorExit 反過來。沒有門的車（機車、替身、
// 還沒切門的車）照舊瞬間上下車。展示廳與車庫的靜態車（carObject）走近車門就自己打開，看得到內裝。
// 排在 68-gta.js 之後（頂層要用 gtaApi）。坐在車裡的駕駛（seatShow，69-combat.js 的 driveByPlace 不在車窗射擊時呼叫）只畫在有門的車：沒有內裝的車看起來會坐在黑盒子裡。
// 車內視角 fpCam：99-main.js 的 C 鍵在開車時多一段（標準 → 遠 → 近 → 車內），座位與眼睛位置照 cars.json 的 door.seat（沒有就用 db 估）。
// 副駕上車：人站在副駕那側（或駕駛座那側被擋住）就開副駕的門、坐進副駕再挪到駕駛座（ph 'slide'）。副駕有乘客時一律走駕駛座那側。
// 開著的門擋人：每扇開過 15% 的門沿門板放 3 個碰撞圓（30-vehicles.js 的 dynMore；過場中那台車、自己正在開的車不放）。
// 乘客 DOOR.pax：{ id, look }，玩家開有門的車時坐在副駕（PAX 這組人，坐姿雙手放腿上）；主線 4-2 的 pick 讓娜迪亞坐上來。
const DOOR = { seq: null, live: new Set(), show: [], showT: 0, quiet: false, stats: { enter: 0, exit: 0, pass: 0 }, pax: null, col: [], open: new Set() };
const DOOR_T = { walk: .32, open: .42, sit: .5, slide: .7, close: .38, out: .5, openS: .7, closeS: .55 };   // 秒；S 是展示廳的慢速
const DOOR_EYE = [.11, -.03];   // 車內視角的鏡頭在頭骨（Head）上 .11 m、後 .03 m（頭縮掉了，鏡頭放高一點、往後一點，方向盤不會貼在眼前，肩膀也在視線下面）（頭骨照當下的姿勢算：開車動畫的晃動、方向盤的前傾都跟著）

const carDoors = v => v && v.isCar && v.inst && v.inst.doors && v.inst.doors.length ? v.inst.doors : null;
function doorSet(d, want, slow, v) { if (v) d.v = v; if (d.want === want) return; d.want = want; d.slow = slow; DOOR.live.add(d); if (want > 0 && !slow) DOOR.open.add(d); }
// 座位（車身座標）：[x, 骨盆高, z]；駕駛在左（+x），door.rhd（右駕的日規車模型，例如 r35）在右
function seatOf(v) {
  const c = CARS[v.carId], s = c && c.door && c.door.seat;
  if (s) return s;
  const db = c && c.db || [.4, 0];
  if (c && c.sw) return [c.sw.c[0], db[0], db[1]];   // 量過方向盤的車：正對方向盤
  return [Math.max(.3, v.w / 2 - .58) * (c && c.door && c.door.rhd ? -1 : 1), db[0], db[1]];
}
const paxOf = st => [-st[0], st[1], st[2]];   // 副駕：駕駛座對車身中線鏡射
// 身體的原點比座位（眼睛的參考點，fpCam 用）往前多少：開車動畫 Driving_Loop 的骨盆在原點後 .32 m、肩膀在 .39 m，
// 量過方向盤的車讓原點落在方向盤中心後 SW_REACH（上身前傾後肩膀離握點約 .5 m，手臂接近伸直、手肘微彎，像 GTA5 的第一人稱；角色的手臂連手掌約 .57 m）
const DRV_BACK = .3, SW_REACH = .1;
function bodyDz(v) { const c = CARS[v.carId], st = seatOf(v); return c && c.sw ? c.sw.c[2] - SW_REACH - st[2] : DRV_BACK; }
const _dm = new T.Matrix4(), _dt = new T.Matrix4(), _dv = V3(), _dq = new T.Quaternion();
// 車身（v.body）在世界裡的矩陣：照 poseVehicle 剛擺好的 v.g 與 v.body
function bodyM(v, out) { v.g.updateMatrix(); v.body.updateMatrix(); return out.multiplyMatrices(v.g.matrix, v.body.matrix); }

// ─── 每幀：轉門 ───
function doorTick(dt) {
  for (const d of DOOR.live) {
    const sp = 1 / (d.want > d.k ? (d.slow ? DOOR_T.openS : DOOR_T.open) : (d.slow ? DOOR_T.closeS : DOOR_T.close));
    const k0 = d.k; d.k = d.want > d.k ? Math.min(d.want, d.k + dt * sp) : Math.max(d.want, d.k - dt * sp);
    const e = d.want >= k0 ? 1 - (1 - d.k) ** 3 : d.k * d.k * (3 - 2 * d.k);   // 開：先快後慢；關：平滑帶進去
    if (d.fly) d.piv.quaternion.setFromAxisAngle(d.ax, d.sg * d.ang * e);   // 蝴蝶門：繞 A 柱的斜軸往上掀
    else d.piv.rotation.y = (d.s === 1 ? -1 : 1) * d.ang * e;
    if (d.k === d.want) { DOOR.live.delete(d); if (!d.want && k0 > 0 && d.loud) { sfx.doorCar(true); d.loud = false; } }
  }
  doorCol(); paxTick();
  // 展示廳與車庫：走到車門旁 2 m 內那扇門打開（展示台的碰撞讓人停在車側 1.7 m 左右；每 0.2 秒看一次）
  if ((DOOR.showT -= dt) > 0) return;
  DOOR.showT = .2;
  const walk = player.mode === 'walk';
  for (let i = DOOR.show.length - 1; i >= 0; i--) {
    const e = DOOR.show[i];
    if (!e.g.parent) { if (++e.gone > 50) DOOR.show.splice(i, 1); continue; }
    e.gone = 0;
    let near = 0;
    if (walk && e.g.visible) {
      _dv.set(player.x, player.y || 0, player.z).applyMatrix4(_dm.copy(e.g.matrixWorld).invert());
      const c = CARS[e.id], hw = c.w / 2, sz = seatOf({ carId: e.id, w: c.w })[2];
      if (Math.abs(_dv.y) < 1.6 && Math.abs(_dv.x) > hw - .3 && Math.abs(_dv.x) < hw + 2 && _dv.z > sz - 1 && _dv.z < sz + 1.5) near = _dv.x > 0 ? 1 : 2;
    }
    for (const d of e.inst.doors) doorSet(d, d.s === near ? 1 : 0, true);
  }
}
// 26-glb.js 的 glbWake：展示用的靜態車建好實例時登錄
function doorShowAdd(g, id, inst) { if (inst.doors && inst.doors.length) DOOR.show.push({ g, id, inst, gone: 0 }); }

// ─── 上車：走到門後、拉開門、坐進去、關門 ───
function doorEnter(v) {
  const ds = carDoors(v);
  if (!ds || DOOR.seq || Math.hypot(v.vx, v.vz) > 1.5 || player.where !== 'out' && !VENUES[player.where]) return enterVehicle(v);
  const st = seatOf(v), drv = Math.sign(st[0]) || 1, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  const here = Math.sign((player.x - v.x) * c - (player.z - v.z) * s) || drv;   // 人站在車身哪一側（車身座標的 x）
  const side = kinDoorSide(v, DOOR.pax ? drv : here), d = ds.find(d => d.s === (side > 0 ? 1 : 2)) || ds[0], sd = d.s === 1 ? 1 : -1;
  DOOR.seq = { kind: 'in', v, d, sd, st, t: 0, x0: player.x, z0: player.z, y0: player.y || 0, lock: true, ph: 'walk', pass: sd !== drv };
  DOOR.stats.enter++; if (sd !== drv) DOOR.stats.pass++;
}
// ─── 下車：拉開門、站出去、關門（idle：長按 F，引擎不熄） ───
function doorExit(idle) {
  const v = player.veh, ds = carDoors(v);
  if (!ds || DOOR.seq || Math.hypot(v.vx, v.vz) > 1.5 || v.air || v.tumble || v.flipped) return exitVehicle(false, idle);
  const side = kinDoorSide(v, Math.sign(seatOf(v)[0]) || 1), d = ds.find(d => d.s === (side > 0 ? 1 : 2)) || ds[0], sd = d.s === 1 ? 1 : -1;   // 先走駕駛座那側的門
  DOOR.seq = { kind: 'out', v, d, sd, st: seatOf(v), t: 0, idle, lock: true, ph: 'open' };
  doorSet(d, 1, false, v); d.loud = true;
  DOOR.stats.exit++;
}
// 門外站的位置（車身座標）：門開著時在門的後面
const standL = q => [q.sd * (q.v.w / 2 + .32), 0, q.st[2] - .12];
// 過場這一刻坐的位置：副駕上車先坐副駕（q.ss），滑過去之後才是駕駛座
const seatNow = q => q.ss || q.st;
function toWorld(v, l, out) { const c = Math.cos(v.yaw), s = Math.sin(v.yaw); out.x = v.x + l[0] * c + l[2] * s; out.z = v.z - l[0] * s + l[2] * c; return out; }
const _sw = { x: 0, z: 0 };
function doorStep(dt) {
  const q = DOOR.seq; if (!q) return;
  const v = q.v;
  q.t += dt;
  // 中斷：車被撞走、車壞了、人被打倒或死了、換了場景
  if (v.dead || life.dead || player.down > 0 || q.kind === 'in' && player.mode !== 'walk' && player.veh !== v || Math.hypot(v.vx, v.vz) > 3) {
    doorSet(q.d, 0); DOOR.seq = null; if (q.kind === 'out' && player.mode === 'drive') { me.mesh.visible = false; } return;
  }
  if (q.kind === 'in') {
    if (q.ph === 'walk') {
      const u = Math.min(1, q.t / DOOR_T.walk), p = toWorld(v, standL(q), _sw);
      player.x = lerp(q.x0, p.x, u); player.z = lerp(q.z0, p.z, u); player.y = lerp(q.y0, v.y || 0, u);
      player.yaw = v.yaw + Math.PI * (q.sd > 0 ? .5 : -.5) + Math.PI;   // 面向車身
      me.anim(0, ANIM.walk, 0, 1); me.anim2(0, 0, 0); me.place(0, player.x, player.y, player.z, player.yaw);
      if (u >= 1) { q.ph = 'open'; q.t = 0; doorSet(q.d, 1, false, v); }
    } else if (q.ph === 'open') {
      const p = toWorld(v, standL(q), _sw); player.x = p.x; player.z = p.z;
      me.anim(0, ANIM.interact, -uTimeNow(), 1); me.anim2(0, 0, 0); me.place(0, player.x, player.y, player.z, player.yaw);
      if (q.t >= DOOR_T.open) { q.ph = 'sit'; q.t = 0; DOOR.quiet = true; enterVehicle(v); DOOR.quiet = false; }
    } else if (q.ph === 'sit') {
      const u = Math.min(1, q.t / DOOR_T.sit);
      if (q.pass) q.ss = paxOf(q.st);
      seatShow(v, 1 - sst(0, 1, u), q);
      if (u >= 1) { q.t = 0; if (q.pass) { q.ph = 'slide'; doorSet(q.d, 0); q.d.loud = true; } else { q.ph = 'close'; q.lock = false; doorSet(q.d, 0); q.d.loud = true; } }
    } else if (q.ph === 'slide') {   // 副駕上車：關上門、挪過中控台坐到駕駛座
      const u = sst(0, 1, Math.min(1, q.t / DOOR_T.slide)), ps = paxOf(q.st);
      q.ss = [lerp(ps[0], q.st[0], u), q.st[1] + Math.sin(u * Math.PI) * .07, q.st[2] - Math.sin(u * Math.PI) * .05];
      seatShow(v, 0, q);
      if (q.t >= DOOR_T.slide) { q.ss = null; q.ph = 'close'; q.t = 0; q.lock = false; }
    } else if (q.ph === 'close') {
      if (q.t >= DOOR_T.close) DOOR.seq = null;
    }
  } else {
    if (q.ph === 'open') {
      v.vx *= .8; v.vz *= .8;
      if (q.t >= DOOR_T.open * .8) {
        q.ph = 'out'; q.t = 0;
        DOOR.quiet = true; exitVehicle(false, q.idle); DOOR.quiet = false;
        if (q.idle) toast('下車 · 引擎沒熄（按住 F 下車）');
        const p = toWorld(v, standL(q), _sw); colY = v.y || 0; const r = collideCircle(p.x, p.z, .32, false); colY = 0;
        q.ex = r.x; q.ez = r.z; player.x = r.x; player.z = r.z; player.yaw = v.yaw + Math.PI * (q.sd > 0 ? .5 : -.5);
      }
    } else if (q.ph === 'out') {
      const u = Math.min(1, q.t / DOOR_T.out);
      player.x = q.ex; player.z = q.ez;
      seatShow(v, sst(0, 1, u), q);
      if (u >= 1) { q.ph = 'close'; q.t = 0; q.lock = false; doorSet(q.d, 0); q.d.loud = true; player.anim = -1; }
    } else if (q.ph === 'close') {
      if (q.t >= DOOR_T.close) DOOR.seq = null;
    }
  }
}
// 坐在駕駛座的人；out 0..1：往車門外移出去的程度（上下車的過場，q 是 DOOR.seq）
function seatShow(v, out = 0, q = null) {
  if (!CARS[v.carId] || !CARS[v.carId].door || !carDoors(v)) { me.mesh.visible = false; me.people[0].wheel = null; return false; }   // 從有方向盤的車跳車、車毀時沒清掉的握點不要帶到這台
  const st = q ? seatNow(q) : seatOf(v), sd = q ? q.sd : 1, so = standL(q || { sd: 1, v, st }), dz = bodyDz(v);
  me.mesh.visible = true; me.people[0].noHead = !!(camState.fp && player.mode === 'drive' && !q);   // 車內視角：頭縮掉（會擋住鏡頭），看得到自己握方向盤的手
  me.anim(0, ANIM.driveBy, 0, 1); me.anim2(0, 0, 0);
  const P = me.people[0]; P.dbDir = null;
  // 雙手握方向盤（40-people.js 的 wheelArms）：上下車、挪位子時放開
  const c = CARS[v.carId];
  if (c.sw && v.inst && v.inst.sw) {
    const W = P.wheel || (P.wheel = { c: [0, 0, 0], n: [0, 0, 0], r: 0, a: 0, k: 0 }), n = v.inst.sw.n;
    W.c[0] = c.sw.c[0] - st[0]; W.c[1] = c.sw.c[1] - (st[1] - DB_HIP); W.c[2] = c.sw.c[2] - (st[2] + dz);
    W.n[0] = n.x; W.n[1] = n.y; W.n[2] = n.z; W.r = c.sw.r; W.a = v.steer * SW_TURN;
    const want = q && (q.ss || out > .02) ? 0 : 1;
    W.k += clamp(want - W.k, -.12, .12);
    if (W.k <= 0 && want === 0 && out > .3) P.wheel = null;
  } else P.wheel = null;
  const x = lerp(st[0], so[0], out), y = lerp(st[1] - DB_HIP, st[1] - DB_HIP + .38, sst(0, .6, out)), z = lerp(st[2] + dz, so[2], out);
  bodyM(v, _dm).multiply(_dt.makeTranslation(x, y, z));
  if (out > 0) _dm.multiply(_dt.makeRotationY(sd * Math.PI / 2 * sst(.2, 1, out)));   // 轉身面向門外
  me.placeM(0, _dm);
  if (player.mode === 'drive') { player.x = v.x; player.z = v.z; }
  return true;
}

// ─── 開著的門擋人：門板上 3 個碰撞圓（鉸鏈座標往車尾 .2 / .5 / .8 m），門關上或車開走就搬到很遠 ───
const DOOR_COL_N = 12, _dc = V3();
for (let i = 0; i < DOOR_COL_N; i++) DOOR.col.push({ x: 1e6, z: 1e6, r: .17 });
dynMore.push(...DOOR.col);
function doorCol() {
  let n = 0;
  const q = DOOR.seq, mine = player.mode === 'drive' ? player.veh : null;
  for (const d of DOOR.open) {
    const v = d.v;
    if (d.k <= 0 && d.want <= 0 || !v || v.dead || !d.piv.parent) { DOOR.open.delete(d); continue; }
    if (d.k < .15 || v === mine || q && q.v === v || v.g && !v.g.parent || n + 3 > DOOR_COL_N) continue;   // 自己坐的車、正在上下車的那台不擋（不然走不進門口）
    d.piv.updateWorldMatrix(true, false);
    // 蝴蝶門掀到頭頂上：只擋門的下緣還在 1.4 m 以下的那幾點
    for (const z of [-.2, -.5, -.8]) {
      const c = DOOR.col[n++];
      if (d.fly) { _dc.set(0, .35 - d.piv.position.y, z).applyMatrix4(d.piv.matrix); if (_dc.y > 1.4) { c.x = c.z = 1e6; continue; } _dc.applyMatrix4(d.piv.parent.matrixWorld); }
      else _dc.set(0, 0, z).applyMatrix4(d.piv.matrixWorld);
      c.x = _dc.x; c.z = _dc.z;
    }
  }
  for (let i = n; i < DOOR_COL_N; i++) { const c = DOOR.col[i]; if (c.x < 1e5) c.x = c.z = 1e6; }
}

// ─── 副駕的乘客（DOOR.pax = { id, look, act }）：玩家開有內裝的實車時坐在副駕，雙手放腿上（40-people.js 的 p.pax） ───
// act：主線的 69-w3-ch4.js STEP.pick 給的那一關；那一關結束、或那個人又被放回地上（a.npc[id]）就下車
const PAX = crowd(1);
scene.add(PAX.mesh); PAX.place(0, 0, -60, 0, 0); PAX.people[0].pax = true;
function paxSet(o) {
  if (o === true) o = { look: { r: rng(4242) } };   // 驗收用：隨便一個路人
  DOOR.pax = o && o.look ? { id: o.id || null, look: o.look, act: o.act || null } : null;
  if (DOOR.pax) PAX.look(0, DOOR.pax.look); else PAX.place(0, 0, -60, 0, 0);
  return !!DOOR.pax;
}
function paxTick() {
  const o = DOOR.pax;
  if (o && o.act && (side.act !== o.act || o.id && o.act.npc && o.act.npc[o.id])) { paxSet(null); return; }
  const v = player.mode === 'drive' ? player.veh : null;
  if (!o || !v || !carDoors(v) || !PEOPLE) { if (PAX.people[0].y > -50) PAX.place(0, 0, -60, 0, 0); return; }
  if (PAX.mesh.parent !== curScene) curScene.add(PAX.mesh);
  const ps = paxOf(seatOf(v));
  bodyM(v, _paxM).multiply(_dt.makeTranslation(ps[0], ps[1] - DB_HIP, ps[2] + bodyDz(v)));
  PAX.anim(0, ANIM.driveBy, 0, 1); PAX.anim2(0, 0, 0);
  PAX.placeM(0, _paxM);
}
const _paxM = new T.Matrix4();

// ─── 車內視角 ───
const _fe = V3(), _ft = V3(), _fu = V3(), _fl = new T.Matrix4();
function fpCam(dt, spd) {
  const v = player.veh;
  if (!v || !v.isCar || v.fly || v.boat) return false;
  const c = CARS[v.carId], st = seatOf(v), cab = c && c.door && carDoors(v);
  // 有內裝的車：駕駛的眼睛；沒有的：引擎蓋上方（看不到黑盒子）
  if (cab) { const P = me.people[0], h = P.bones && P.bones.Head;   // 頭骨（骨架空間）→ 人的座標（sm）→ 車身座標（seatShow 擺的位移）
    if (h && P.sm) { h.getWorldPosition(_fe).applyMatrix4(P.sm.matrix); _fe.y += DOOR_EYE[0]; _fe.z += DOOR_EYE[1]; _fe.x += st[0]; _fe.y += st[1] - DB_HIP; _fe.z += st[2] + bodyDz(v); }
    else _fe.set(st[0], st[1] + .66, st[2] - .02);
  } else _fe.set(0, (c ? c.h : 1.3) * .82, (st[2] || 0) + .55);
  bodyM(v, _dm); _fe.applyMatrix4(_dm);
  // 滑鼠轉頭：左右 ±115°、上下 ±50°，停手 1 秒後轉回正前方
  if (camState.idle > 1) { camState.yaw += wrapA(v.yaw - camState.yaw) * (1 - Math.exp(-4 * dt)); camState.pitch = damp(camState.pitch, .13, 3, dt); }
  const a = clamp(wrapA(camState.yaw - v.yaw), -2, 2), p = clamp(camState.pitch - .1, -.9, .9);
  camState.yaw = v.yaw + a;
  _dq.setFromRotationMatrix(_dm);
  _ft.set(Math.sin(a) * Math.cos(p), -Math.sin(p), Math.cos(a) * Math.cos(p)).applyQuaternion(_dq).add(_fe);
  _fu.set(0, 1, 0).applyQuaternion(_dq);
  if (DOOR.fpV !== v) { fpGlass(null); fpGlass(v); }   // 自己這台車的玻璃不畫：夜裡隔著有色的擋風玻璃幾乎看不到路
  camState.pos.copy(_fe); camera.position.copy(_fe);
  if (camState.shake > 0) { camState.shake = Math.max(0, camState.shake - dt * 2.5); const s = camState.shake * .04 * SET.shake; camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; }
  camera.quaternion.setFromRotationMatrix(_fl.lookAt(camera.position, _ft, _fu));
  U.uFocus.value.set(_ft.x, _ft.y, _ft.z, 0);
  const fov = SET.fov + clamp(spd / 150, 0, 1) * 8 + (nitro.on ? 5 : 0) - gta.aimK * 12;
  camState.fov = damp(camState.fov, fov, 4, dt);
  if (Math.abs(camera.fov - camState.fov) > .01 || camera.near !== .05) { camera.fov = camState.fov; camera.near = .05; camera.updateProjectionMatrix(); }
  if (camState.over) { const o = camState.over; camera.position.set(o[0], o[1], o[2]); camera.lookAt(o[3], o[4], o[5]); }
  return true;
}
// 不在車內視角時把近平面放回去（70-render.js 的相機是 .2）、玻璃畫回來
function fpNear() { me.people[0].noHead = false; if (camera.near !== .2) { camera.near = .2; camera.updateProjectionMatrix(); } if (DOOR.fpV) fpGlass(null); }
// v：藏起這台車的半透明網格（車窗）；null：把上次藏的畫回來
function fpGlass(v) {
  const t = v || DOOR.fpV; DOOR.fpV = v;
  if (t && t.inst) t.inst.body.traverse(o => { if (o.isMesh && o.material.transparent) o.visible = !v; });
}

gtaApi.door = {
  DOOR, DOOR_T, seatOf, carDoors,
  open(v = kestrel, s = 1, k = 1) { const ds = carDoors(v); if (!ds) return false; for (const d of ds) if (!s || d.s === s) doorSet(d, k, false, v); return true; },
  state(v = kestrel) { const ds = carDoors(v); return ds ? ds.map(d => ({ s: d.s, k: +d.k.toFixed(3), want: d.want })) : null; },
  enter: (v = kestrel) => doorEnter(v), exit: idle => doorExit(idle),
  pax: o => paxSet(o), col: () => DOOR.col.filter(c => c.x < 1e5).map(c => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), r: c.r })),
  fp(on = true) { camState.fp = !!on; return camState.fp; },
};
