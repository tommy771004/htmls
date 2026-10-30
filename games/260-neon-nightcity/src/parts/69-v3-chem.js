// ═══ 第三部曲之二：環境化學與連鎖反應（汽油桶與油線延燒、油箱漏油、輪框磨地起火、雨天電擊連鎖）與車身弱點（擋風玻璃、左後油箱） ═══
// 排序在 69-v3-crash 之前、69-v3-skills 之後的檔案（gearRows）才會讀到 ARMS.petrol；這裡的頂層只用 69-combat 以前的東西。

// 汽油桶：投擲物格的第四樣，按住開火邊走邊倒（每 0.45 m 一灘、1%），開槍打到油、爆炸、燒著的車都會點燃
ARMS.petrol = { slot: 7, name: '汽油桶', throw: 1, pour: 1, n: 100, grip: [0, 0, 0] };
ARM_IDS.push('petrol');
arm.ammo.petrol = { mag: 100, res: 0 };
kitGeo.petrol = new Kit()
  .box(0, 0, .2, .11, .27, .32, 0x9a1f1a, 2)      // 桶身（+z 朝下：握著提把垂在手下）
  .box(0, -.06, 0, .03, .09, .05, 0x2a2a2a, 2)    // 提把
  .cyl(0, .1, .02, .018, .014, .09, 8, 0x2a2a2a, 2)   // 油嘴
  .build();
const FUEL_MAX = 520, FUEL_LIFE = 300;   // 地上最多 520 灘，5 分鐘後揮發
const FUEL_SPREAD = .09;                 // 火沿油線每 0.09 秒燒到下一灘（約 5 m/s）
const FIRE_T = 7;                        // 每灘燒 7 秒
const RIM_HEAT = 9;                      // 破胎用輪框跑：時速 45 以上累積 9 秒就起火
const fuel = [];                         // { x, z, y, t, fire, burn, src }
const fuelMesh = (() => {
  const m = new T.InstancedMesh(new T.CircleGeometry(.42, 10).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: .62, depthWrite: false }), FUEL_MAX);
  m.count = 0; m.frustumCulled = false; m.renderOrder = 1; scene.add(m); return m;
})();
const _fm = new T.Matrix4(), _fq = new T.Quaternion(), _fs = V3(), _fp = V3();
function fuelDrop(x, z, src) {
  const L = fuel[fuel.length - 1];
  if (L && L.src === src && Math.hypot(L.x - x, L.z - z) < .3) return false;
  if (fuel.length >= FUEL_MAX) { const i = fuel.findIndex(f => !f.fire); fuel.splice(i < 0 ? 0 : i, 1); }
  fuel.push({ x, z, y: groundH(x, z) + .015, t: 0, fire: 0, burn: 0, src, s: .75 + Math.random() * .5 });
  return true;
}
// 點燃半徑 r 內的油（回傳點到幾灘）；mine：玩家點的火（燒到人才算玩家的罪，幫派的爆炸、自己起火的車點的不算）
function chemIgnite(x, z, r, mine = false) {
  let n = 0;
  for (const f of fuel) if (!f.fire && f.burn <= 0 && (f.x - x) ** 2 + (f.z - z) ** 2 < r * r) { f.fire = FIRE_T; f.mine = mine; n++; }
  if (n) sfx.whoosh();
  return n;
}
// 子彈打到地面或牆（69-combat.js 的 hitWith）：附近有油就點著
function chemHit(x, y, z, mine) { if (y < 1.2) chemIgnite(x, z, .7, mine); }

// ─── 倒油：手上是汽油桶、按住開火 ───
const pour = { d: 0, t: 0 };
function pourStep(dt) {
  const a = arm.ammo.petrol;
  if (arm.sel !== 'petrol' || !arm.trig || !canFight() || a.mag <= 0) { pour.t = 0; return; }
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  pour.d += player.v * dt; pour.t += dt;
  const sx = player.x + fx * .55, sz = player.z + fz * .55;
  if (Math.random() < dt * 20) emit('smoke', sx, .55, sz, { vy: -2.5, max: .25, s0: .03, s1: .05, grav: 9, a: .7, c: [.12, .1, .06] });
  if (pour.d > .45 || pour.t > .5) {
    pour.d = 0; pour.t = 0;
    if (fuelDrop(sx, sz, 'p')) { a.mag--; if (a.mag <= 0) { toast('汽油桶空了 · 手機「改槍與裝備」可以再買'); const next = ARM_IDS.find(k => ARMS[k].throw && !ARMS[k].pour && arm.ammo[k].mag > 0); equip(next || 'fist', true); } }
  }
}

// ─── 火：每灘燒 FIRE_T 秒，燒到 FUEL_SPREAD 秒時點著 1 m 內的鄰居；燒到人、車 ───
const burnSt = { hurtT: 0, pedT: new Map(), carT: new WeakMap() };
function fireStep(dt) {
  if (!fuel.length) return;
  let lit = 0;
  for (let i = fuel.length - 1; i >= 0; i--) {
    const f = fuel[i];
    f.t += dt;
    if (f.fire > 0) {
      lit++;
      const was = f.fire; f.fire -= dt; f.burn = 1;
      if (was > FIRE_T - FUEL_SPREAD && f.fire <= FIRE_T - FUEL_SPREAD) for (const g of fuel) if (!g.fire && (g.x - f.x) ** 2 + (g.z - f.z) ** 2 < 1.1) { g.fire = FIRE_T; g.mine = f.mine; }
      if (Math.random() < dt * 14) emit('fire', f.x + (Math.random() - .5) * .5, f.y + .1, f.z + (Math.random() - .5) * .5, { vy: 1.6 + Math.random(), max: .55, s0: .32, s1: .08, drag: 1.2 });
      if (Math.random() < dt * 2.5) emit('smoke', f.x, f.y + .8, f.z, { vy: 1.2, max: 2.4, s0: .3, s1: 1.4, a: .4, c: [.1, .1, .11] });
      if (f.fire <= 0) { fuel.splice(i, 1); lit--; continue; }
    } else if (f.t > FUEL_LIFE) { fuel.splice(i, 1); continue; }
  }
  // 燒著的車（耐久低於 68-gta.js 的 STAGE.fire）點燃旁邊的油
  for (const v of vehicles) if (!v.dead && v.hp < hpLockOf(v) * STAGE.fire) chemIgnite(v.x, v.z, 2.2);
  if (!lit) return;
  if (fxLights.length < 24) { const f = fuel.find(o => o.fire > 0); if (f) fxLights.push({ x: f.x, y: 1, z: f.z, col: COL.muzzle, r: 10, i: 1.4, life: 0, max: .05 }); }
  const near = (x, z, r) => fuel.find(f => f.fire > 0 && (f.x - x) ** 2 + (f.z - z) ** 2 < r * r);   // 回傳燒到的那一灘（f.mine：是不是玩家點的）
  // 玩家：每 0.25 秒燒一次
  burnSt.hurtT -= dt;
  const px = pX(), pz = pZ();
  if (burnSt.hurtT <= 0 && player.where === 'out' && near(px, pz, player.mode === 'drive' ? 0 : .9)) { burnSt.hurtT = .25; hurtPlayer(4.5 * skK.take); }
  // 路人、警察、幫派
  for (let k = 0; k < PED_N; k++) { const p = peds.people[k], ps = pedState[k]; const g = !(ps.down > 0) && near(p.x, p.z, .8); if (g) { knockPed(k, (Math.random() - .5) * 2, (Math.random() - .5) * 2); if (g.mine) crime('assault', p.x, p.z); } }
  for (const c of W.cops) { const g = c.on && c.state !== 'down' && near(c.x, c.z, .8); if (g) copHit(c, 60 * dt * 4, 0, 1, !!g.mine); }
  for (const f of SQ.f) { const g = f.on && !(f.hp <= 0) && near(f.x, f.z, .8); if (g) fHit(f, 60 * dt * 4, 0, 1, !!g.mine); }
  // 車：底下有火燒 1 秒就起火（之後照 68-wreck.js 的起火階段燒到爆）
  const carBurn = (o, isVeh) => {
    const g = near(o.x, o.z, 1.8);
    if (!g) { burnSt.carT.delete(o); return; }
    const t = (burnSt.carT.get(o) || 0) + dt; burnSt.carT.set(o, t);
    if (t < 1) return;
    burnSt.carT.delete(o);
    const mine = !!g.mine;   // 玩家點的火燒爆的車才算玩家的
    if (isVeh) { if (!o.dead && !o.bail) damageVeh(o, Math.max(1, o.hp - hpLockOf(o) * STAGE.fire * .9), mine, true); }
    else { const v = o.det = damageCar(o, hpMaxOf(o) * .95, mine); if (v && !v.bail) damageVeh(v, Math.max(1, v.hp - hpLockOf(v) * STAGE.fire * .9), mine, true); }
  };
  for (const v of vehicles) carBurn(v, true);
  for (const c of [...traffic, ...parked]) if ((c.x - px) ** 2 + (c.z - pz) ** 2 < 160 ** 2) carBurn(c, false);
}
function fuelDraw() {
  let n = 0;
  for (const f of fuel) {
    if (n >= FUEL_MAX) break;
    const fade = f.fire > 0 ? clamp(f.fire / 2, .2, 1) : clamp((FUEL_LIFE - f.t) / 30, 0, 1);
    _fs.set(f.s * fade, 1, f.s * fade); _fp.set(f.x, f.y, f.z);
    fuelMesh.setMatrixAt(n++, _fm.compose(_fp, _fq, _fs));
  }
  instPush(fuelMesh, n);
  fuelMesh.visible = player.where === 'out' && n > 0;
}

// ─── 車身弱點（子彈射線打到車的那一點換到車身局部座標）：+x = 車的左邊、+z = 車頭 ───
const leaks = new Map();   // 漏油的車（車流車或載具）→ { n: 還能漏幾灘, d: 上次漏的位置 }
function localOf(ref, x, y, z) {
  const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw), dx = x - ref.x, dz = z - ref.z;
  const W = ref.w ?? TYPES[ref.type].w, L = ref.len ?? TYPES[ref.type].len;
  return { lx: dx * fz - dz * fx, lz: dx * fx + dz * fz, ly: y - (ref.y || 0), W, L };
}
// 回傳傷害倍率；kind 'car' 是車流與路邊車、'veh' 是載具
function weakHit(ref, kind, x, y, z, mine) {
  if (ref.boat || ref.fly || ref.isCar === false || ref.armored) return 1;
  const { lx, lz, ly, W, L } = localOf(ref, x, y, z);
  // 左後油箱：車身左側、後軸前面一點、離地 0.35–1 m
  if (lx > W / 2 - .45 && lz > -L * .36 && lz < -L * .14 && ly > .35 && ly < 1) {
    sparks(x, y, z, 10, 3);
    const lk = leaks.get(ref);
    if (lk) {   // 第二發：漏出來的油點著，車子起火
      chemIgnite(ref.x, ref.z, 3, mine); fuelDrop(x, z, ref); chemIgnite(x, z, 1, mine);
      if (kind === 'car') { const v = ref.det = damageCar(ref, hpMaxOf(ref) * .95, mine); if (v) damageVeh(v, Math.max(1, v.hp - hpLockOf(v) * STAGE.fire * .9), mine, true); }
      else if (!ref.bail) damageVeh(ref, Math.max(1, ref.hp - hpLockOf(ref) * STAGE.fire * .9), mine, true);
      leaks.delete(ref);
    } else { leaks.set(ref, { n: 45, x: ref.x, z: ref.z, t: 0 }); if (ref === player.veh) toast('油箱被打穿了 · 漏油中'); }
    return 3;
  }
  // 擋風玻璃與前側窗：駕駛中彈，車流車與警車失控滑行
  if (ly > 1 && ly < 1.45 && lz > L * .02 && lz < L * .3 && Math.abs(lx) < W / 2 + .05) {
    glassBurst(x, y, z);
    if (kind === 'car') {
      const v = ref.det = detachCar(ref); v.driverDead = 1;   // 沒人開：69-combat.js 的 coast 讓它滑到停（高速時一路撞過去）
      if (mine) crime('kill', x, z);
    } else if (ref.unit && ref.unit.drive && !ref.driverDead) {
      const u = ref.unit; u.drive = false; ref.driverDead = 1; u.crew = Math.max(0, u.crew - 1);
      if (mine) crime('killcop', x, z);
      setTimeout(() => { if (u.crew > 0 && !ref.dead) crewOut(u); }, 1800);
    }
  }
  return 1;
}
function leakStep(dt) {
  for (const [ref, lk] of leaks) {
    if (ref.dead || lk.n <= 0) { leaks.delete(ref); continue; }
    lk.t += dt;
    const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw), L = ref.len ?? TYPES[ref.type].len, W = ref.w ?? TYPES[ref.type].w;
    const x = ref.x - fx * L * .25 + fz * W * .35, z = ref.z - fz * L * .25 - fx * W * .35;
    if (Math.hypot(x - lk.x, z - lk.z) > .45 || lk.t > .7) { lk.x = x; lk.z = z; lk.t = 0; if (fuelDrop(x, z, ref)) lk.n--; }
    if (Math.random() < dt * 10) emit('smoke', x, .4, z, { vy: -2, max: .2, s0: .02, s1: .04, grav: 9, a: .6, c: [.12, .1, .06] });
  }
}

// ─── 輪框磨地：破胎還開快，輪框噴火花、累積熱度到起火 ───
const _rw = V3();
function rimStep(dt) {
  for (const v of vehicles) {
    if (!v.tires || v.dead || v.boat || v.fly) continue;
    const sp = Math.hypot(v.vx, v.vz), flats = v.tires.filter(t => t.flat);
    if (!flats.length) { v.rimH = 0; continue; }
    if (sp > 12.5) {
      v.rimH = (v.rimH || 0) + dt * sp / 18;
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      for (const t of flats) if (Math.random() < dt * 30) { _rw.set(v.x + fz * t.x + fx * t.z, v.y + .08, v.z - fx * t.x + fz * t.z); sparks(_rw.x, _rw.y, _rw.z, 2, 2.5); }
      if (v.rimH > RIM_HEAT && !v.bail) { damageVeh(v, Math.max(1, v.hp - hpLockOf(v) * STAGE.fire * .9), v === player.veh, true); if (v === player.veh) toast('輪框磨出的火花把車點著了 · 快下車'); }
    } else v.rimH = Math.max(0, (v.rimH || 0) - dt * .6);
  }
}

// ─── 雨天的電擊槍：地上有水時電流傳給 3 m 內的路人與敵人 ───
function chemStun(x, z, t) {
  if (wx.wet < .3 && waterDepth(x, z) <= 0) return;
  for (let k = 0; k < PED_N; k++) { const p = peds.people[k]; if (!(pedState[k].down > 0) && Math.hypot(p.x - x, p.z - z) < 3) { stunPed(k, t, 0, 0); tracer(x, .2, z, p.x, .2, p.z, .6); } }
  for (const f of SQ.f) if (f.on && Math.hypot(f.x - x, f.z - z) < 3) { f.stunT = t; f.stunPh = -uTimeNow(); }
  for (const c of W.cops) if (c.on && c.state !== 'down' && Math.hypot(c.x - x, c.z - z) < 3) stunCop(c, t);
}

function chemUpdate(dt) {
  if (player.where !== 'out') return;
  pourStep(dt); leakStep(dt); rimStep(dt); fireStep(dt);
}
gtaApi.v3 = {};   // 測試 API（window.__nc.gta.v3）：第三部曲各檔各自掛上去
const chemApi = { fuel, leaks, drop: fuelDrop, ignite: chemIgnite, weakHit, localOf, rim: v => v.rimH || 0 };
