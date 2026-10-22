// ═══ 第二階段：通緝與警方（熱度與星級、目擊報案、視線錐、最後已知位置、警車調度與路網追捕、下車警員、
//     直升機探照燈、路障與釘刺帶、SWAT 裝甲車、坦克），數值照 neon_nightcity_gta_v_2.md ═══
const HEAT_STAR = [30, 100, 300, 700, 1500];   // 熱度門檻 → 1–5 星
const EVADE = [15, 30, 45, 65, 90];            // 脫離視線多久消星（秒）
const UNITS = [2, 4, 6, 8, 10];                // 每個星級最多幾台警車
const SPAWN_IV = [12, 9, 7, 5, 4];             // 派車間隔（秒）
const CONE_R = 85, CONE_COS = Math.cos(55 * Math.PI / 180), DISGUISE_R = 18, NEAR_R = 10;
const HELI_R = 140, SPOT_R = 35;
const CRIME = { jack: 35, assault: 25, shots: 45, aim: 45, kill: 60, blast: 60, ramcop: 100, resist: 100, killcop: 180, explode: 320, heli: 600 };
const FLOOR = { killcop: 2, explode: 3, heli: 4 };
const W = { heat: 0, stars: 0, seen: false, evade: 0, lkp: null, lastVeh: null, disg: false, units: [], cops: [], heli: null, blocks: [], pickups: [], reports: [], spawnT: 0, shotsT: -9, visT: 0, fieldT: 0, field: null, goal: -1, bustT: 0, blockT: 8, tankT: 0 };
const COP_N = LOW ? 8 : 12;
const SPOT_COL = lin(0xdfe8ff);

// ─── 報案與熱度 ───
function crime(kind, x = player.x, z = player.z) {
  if (player.where !== 'out' || life.dead) return;
  const t = uTimeNow(), n = CRIME[kind];
  if (!n) return;
  if (kind === 'shots') { if (t - W.shotsT < 5) return; W.shotsT = t; }
  // 對警察動手、警察親眼看到、已經在追：直接加熱度；否則要有路人目擊，三秒後報案（槍聲與爆炸六十公尺內都聽得到）
  if (kind === 'ramcop' || kind === 'resist' || kind === 'killcop' || kind === 'heli' || W.stars > 0 && W.seen || copSees(x, z, 0)) { addHeat(n, FLOOR[kind] || 0); return; }
  const loud = kind === 'shots' || kind === 'blast' || kind === 'explode';
  let wit = false;
  for (let k = 0; k < PED_N && !wit; k++) { const p = peds.people[k]; if (!(pedState[k].down > 0) && Math.hypot(p.x - x, p.z - z) < (loud ? 60 : 30)) wit = true; }
  if (!wit) wit = traffic.some(c => Math.hypot(c.x - x, c.z - z) < 25);
  if (wit && !(phone.ghostT > 0)) W.reports.push({ t: t + 3, n, floor: FLOOR[kind] || 0 });
}
function addHeat(n, floor = 0) {
  W.heat += n;
  if (floor) W.heat = Math.max(W.heat, HEAT_STAR[floor - 1]);
  const s = Math.min(5, Math.max(W.stars, floor, HEAT_STAR.filter(h => W.heat >= h).length));
  if (s > W.stars) {
    const first = !W.stars;
    W.stars = s; W.seen = true; W.evade = 0; W.lkp = { x: pX(), z: pZ() }; W.lastVeh = player.veh;
    W.spawnT = first ? 1.5 : Math.min(W.spawnT, 2);
    if (s >= 3) W.blockT = Math.min(W.blockT, 6);
    toast(first ? `有人報警了 · 通緝 ${s} 星` : `通緝 ${s} 星`);
    wakeArms();
  }
}
function wantedClear(why) {
  const had = W.stars > 0;
  W.heat = 0; W.stars = 0; W.seen = false; W.evade = 0; W.lkp = null; W.reports.length = 0; W.bustT = 0;
  for (const u of W.units) u.state = 'leave';
  if (W.heli) W.heli.leave = true;
  if (why === 'evaded' && had) toast('甩掉警察了');
  if (why === 'reset') { for (const u of [...W.units]) dropUnit(u); for (const c of W.cops) freeCop(c); if (W.heli) dropHeli(); for (const b of [...W.blocks]) dropBlock(b); }
}
const pX = () => (player.mode === 'drive' ? player.veh.x : player.x), pZ = () => (player.mode === 'drive' ? player.veh.z : player.z);

// ─── 視線：錐形 85 m、半角 55°，10 m 內一定看到；換了車又沒被盯著時只認得 18 m 內 ───
function coneSees(ox, oz, yaw, x, z, r) {
  const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz);
  if (d < NEAR_R) return true;
  if (d > r) return false;
  if ((dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d < CONE_COS) return false;
  return losClear(ox, oz, x, z);
}
function copSees(x, z, r = CONE_R) {
  r ||= CONE_R;
  for (const c of W.cops) if (c.on && c.state !== 'down' && !(c.stunT > 0) && coneSees(c.x, c.z, c.yaw, x, z, r)) return true;
  for (const u of W.units) if (u.crew > 0 && !u.v.dead && u.state !== 'leave' && coneSees(u.v.x, u.v.z, u.v.yaw, x, z, r)) return true;
  return false;
}
function sees() {
  if (player.where !== 'out') return false;
  W.disg = !W.seen && player.veh !== W.lastVeh;
  const x = pX(), z = pZ();
  if (copSees(x, z, W.disg ? DISGUISE_R : CONE_R)) return true;
  const h = W.heli;
  if (h && !h.fall && !h.leave && Math.hypot(h.x - x, h.z - z) < HELI_R && Math.hypot(h.sx - x, h.sz - z) < h.spotR) return true;
  return false;
}

// ─── 路網：交叉口是節點，每 0.5 秒算一次到目標的最短距離場，警車往距離小的方向開 ───
const NODE = (i, j) => i * (NZ + 1) + j;
function fieldTo(gi, gj) {
  const n = (NX + 1) * (NZ + 1), D = new Float32Array(n).fill(1e9), done = new Uint8Array(n);
  D[NODE(gi, gj)] = 0;
  for (let it = 0; it < n; it++) {
    let b = -1; for (let k = 0; k < n; k++) if (!done[k] && (b < 0 || D[k] < D[b])) b = k;
    if (b < 0 || D[b] >= 1e9) break;
    done[b] = 1;
    const i = Math.floor(b / (NZ + 1)), j = b % (NZ + 1);
    for (let d = 0; d < 4; d++) if (hasEdge(i, j, d)) { const m = NODE(i + DIRS[d][0], j + DIRS[d][1]); D[m] = Math.min(D[m], D[b] + (d % 2 ? P : Q)); }
  }
  return D;
}
const nearI = x => clamp(Math.round((x - X0) / P), 0, NX), nearJ = z => clamp(Math.round((z - Z0) / Q), 0, NZ);
// 車子現在可以開往的節點：在路口就是相鄰的路口，在路段上就是兩端
function nextNodes(x, z) {
  const i = nearI(x), j = nearJ(z), out = [];
  if (Math.hypot(x - avX(i), z - stZ(j)) < HR + 3) { for (let d = 0; d < 4; d++) if (hasEdge(i, j, d)) out.push([i + DIRS[d][0], j + DIRS[d][1]]); return out; }
  if (Math.abs(x - avX(i)) < HR + 3) { const jf = (z - Z0) / Q; return [[i, clamp(Math.floor(jf), 0, NZ)], [i, clamp(Math.ceil(jf), 0, NZ)]]; }
  if (Math.abs(z - stZ(j)) < HR + 3) { const f = (x - X0) / P; return [[clamp(Math.floor(f), 0, NX), j], [clamp(Math.ceil(f), 0, NX), j]]; }
  return [[i, j]];
}
function routeTarget(u, tx, tz) {
  const v = u.v, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let best = null, bs = 1e9;
  for (const [i, j] of nextNodes(v.x, v.z)) {
    const nx = avX(i), nz = stZ(j), d = Math.hypot(nx - v.x, nz - v.z);
    const s = d + W.field[NODE(i, j)] + ((nx - v.x) * fx + (nz - v.z) * fz < 0 && d > 12 ? 45 : 0);
    if (s < bs) { bs = s; best = [nx, nz]; }
  }
  return best || [tx, tz];
}

// ─── 模型：traffic.glb 的直升機、坦克砲塔、路障、釘刺帶（以檔案開啟也有，因為整包內嵌） ───
function partMesh(id, n = 1, own = false) {
  const t = TRAFFIC_GEO[id];
  let geo;
  if (t) geo = t.geo.clone();
  else { const k = new Kit(); k.box(0, .4, 0, 2, .8, id === 'spike' ? .3 : 4, 0x333333, 2); geo = k.build(); }
  geo.setAttribute('aIns', new T.InstancedBufferAttribute(new Float32Array(n * 4), 4));
  let mat = MAT.uberI;
  if (own) { mat = mkUber({ inst: true }); mat.fragmentShader = MAT.uberI.fragmentShader; }
  const m = new T.InstancedMesh(geo, mat, n);
  m.count = 0; m.frustumCulled = false;
  scene.add(m);
  return m;
}
const piv = id => (TRAFFIC_GEO[id] && TRAFFIC_GEO[id].piv) || [0, 0, 0];
const _pm4 = new T.Matrix4(), _pq4 = new T.Quaternion(), _pp = V3(), _pe4 = new T.Euler(), _one = V3(1, 1, 1);

// ─── 警員（步行）：海軍藍制服，SWAT 一身黑 ───
const copsCrowd = crowd(COP_N);
scene.add(copsCrowd.mesh);
for (let k = 0; k < COP_N; k++) { W.cops.push({ k, on: false }); copsCrowd.look(k, { female: false, top: lin(0x1d2840), bot: lin(0x151a26), skin: SKINS[k % SKINS.length], hair: HAIRS[k % 3], coat: 1, skirt: 0, longHair: 0, hat: 1, glowI: 0, shoe: SHOES[0], scale: 1.02 }); copsCrowd.place(k, 0, -60, 0, 0); }
function spawnCop(u, side, swat) {
  const c = W.cops.find(o => !o.on);
  if (!c) return null;
  const v = u.v, lx = Math.cos(v.yaw) * side, lz = -Math.sin(v.yaw) * side;
  const r = collideCircle(v.x + lx * (v.w / 2 + .7), v.z + lz * (v.w / 2 + .7), .32, false);
  Object.assign(c, { on: true, unit: u, x: r.x, z: r.z, yaw: v.yaw, state: 'act', hp: swat ? 160 : 100, swat, gun: swat ? 'rifle' : W.stars >= 3 && Math.random() < .4 ? 'shotgun' : 'pistol', shotT: .8 + Math.random(), burst: 0, ph: Math.random() * 9, downT: 0 });
  copsCrowd.look(c.k, { female: false, top: lin(swat ? 0x121315 : 0x1d2840), bot: lin(swat ? 0x101113 : 0x151a26), skin: SKINS[c.k % SKINS.length], hair: HAIRS[c.k % 3], coat: 1, skirt: 0, longHair: 0, hat: 1, glowI: 0, shoe: SHOES[0], scale: 1.02 });
  return c;
}
function freeCop(c) { c.on = false; c.unit = null; c.stunT = 0; copsCrowd.place(c.k, 0, -60, 0, 0); copsCrowd.people[c.k].gunH = null; }
function copHit(c, dmg, fx, fz, mine) {
  if (!c.on || c.state === 'down') return;
  c.hp -= dmg;
  if (mine) crime(c.hp <= 0 ? 'killcop' : 'resist', c.x, c.z);
  if (c.hp > 0) return;
  c.state = 'down'; c.downT = 18; c.yaw = Math.atan2(-fx, -fz) || c.yaw;
  copsCrowd.anim(c.k, ANIM.die, -uTimeNow(), 1);
  if (c.unit) c.unit.lost = (c.unit.lost || 0) + 1;
  dropPickup(c.x, c.z, c.gun);
  return true;
}
function stunCop(c, t) { if (!c.on || c.state === 'down') return; c.stunT = t; c.stunPh = -uTimeNow(); sparks(c.x, 1.1, c.z, 6, 2); }
function copBlast(x, y, z, r, dmg, mine) {
  for (const c of W.cops) if (c.on && c.state !== 'down') { const d = Math.hypot(c.x - x, c.z - z); if (d < r) copHit(c, dmg * clamp(1 - d / r, .3, 1), (c.x - x) / (d || 1), (c.z - z) / (d || 1), mine); }
}
function copMelee(x, z, fx, fz, reach, dmg) {
  for (const c of W.cops) {
    if (!c.on || c.state === 'down') continue;
    const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
    if (d < reach && dx * fx + dz * fz > d * .5) { copHit(c, dmg, fx, fz, true); return true; }
  }
  return false;
}
// 射線可以打到警員與直升機（68-gta.js 的 castRay）
rayHooks.push((R, hit) => {
  for (const c of W.cops) if (c.on && c.state !== 'down') hit(rayCyl(R, c.x, c.z, .34, .1, 1.95), 'cop', c);
  const h = W.heli;
  if (h && !h.dead) { const t = rayCyl({ ...R }, h.x, h.z, 2.6, h.y - .4, h.y + 3); hit(t, 'heli', h); }
});
// 倒下的警員掉落的彈藥
function dropPickup(x, z, kind) {
  if (W.pickups.length >= 8) dropPick(W.pickups[0]);
  const h = wModel(kind);
  W.pickups.push({ x, z, kind, amt: kind === 'shotgun' ? 8 : kind === 'rifle' ? 30 : 16, t: 0, h });
}
function dropPick(p) { W.pickups.splice(W.pickups.indexOf(p), 1); scene.remove(p.h); wModels.splice(wModels.indexOf(p.h), 1); }
function copStep(c, dt) {
  const p = copsCrowd.people[c.k], t = uTimeNow();
  if (c.stunT > 0) {   // 電擊槍：倒地抽搐，時間到了起身繼續
    c.stunT -= dt;
    copsCrowd.anim(c.k, ANIM.die, c.stunPh, 1);
    copsCrowd.place(c.k, c.x, groundH(c.x, c.z) > 0 ? .15 : 0, c.z, c.yaw);
    return;
  }
  if (c.state === 'down') {
    c.downT -= dt;
    copsCrowd.place(c.k, c.x, groundH(c.x, c.z) > 0 ? .15 : 0, c.z, c.yaw);
    if (c.downT <= 0) freeCop(c);
    return;
  }
  const u = c.unit, carOk = u && !u.v.dead && W.units.includes(u);
  const tx = pX(), tz = pZ(), dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz) || 1;
  // 回到車上：通緝解除、或玩家開車跑遠了
  if (carOk && (W.stars === 0 || u.state === 'leave' || player.mode === 'drive' && Math.hypot(player.veh.vx, player.veh.vz) > 6 && d > 22)) c.state = 'board';
  if (c.state === 'board') {
    if (!carOk) { c.state = 'act'; if (!W.stars) { freeCop(c); return; } }
    else {
      const bx = u.v.x - c.x, bz = u.v.z - c.z, bd = Math.hypot(bx, bz);
      if (bd < u.v.w / 2 + 1) { freeCop(c); u.crew++; return; }
      c.yaw = Math.atan2(bx, bz);
      const r = collideCircle(c.x + bx / bd * 4.4 * dt, c.z + bz / bd * 4.4 * dt, .32, true); c.x = r.x; c.z = r.z;
      copsCrowd.anim(c.k, ANIM.run, c.ph += dt, 1.1);
      copsCrowd.place(c.k, c.x, groundH(c.x, c.z) > 0 ? .15 : 0, c.z, c.yaw);
      return;
    }
  }
  if (!W.stars) { freeCop(c); return; }
  const los = d < 60 && losClear(c.x, c.z, tx, tz);
  const shoot = W.stars >= 2 && los && !life.dead;
  const want = shoot ? (c.gun === 'shotgun' ? 7 : c.swat ? 12 : 14) : 1.3;
  let sp = 0;
  const target = W.seen || d < 15 ? [tx, tz] : W.lkp ? [W.lkp.x, W.lkp.z] : [tx, tz];
  const gx = target[0] - c.x, gz = target[1] - c.z, gd = Math.hypot(gx, gz) || 1;
  if (gd > want + (shoot ? 1.5 : .3) || !los && gd > 2) sp = shoot || gd > 6 ? 4.3 : 2.2;
  else if (shoot && gd < want - 4) sp = -1.6;
  c.yaw += wrapA(Math.atan2(sp > 0 && !los ? gx : dx, sp > 0 && !los ? gz : dz) - c.yaw) * (1 - Math.exp(-9 * dt));
  if (sp) {
    const mx = sp > 0 ? gx / gd : dx / d, mz = sp > 0 ? gz / gd : dz / d;
    let nx = c.x + mx * Math.abs(sp) * dt * (sp > 0 ? 1 : -1), nz = c.z + mz * Math.abs(sp) * dt * (sp > 0 ? 1 : -1);
    for (const o of W.cops) if (o !== c && o.on && o.state !== 'down') { const ex = nx - o.x, ez = nz - o.z, e = Math.hypot(ex, ez); if (e < .8 && e > 1e-3) { nx += ex / e * (.8 - e) * .5; nz += ez / e * (.8 - e) * .5; } }
    const r = collideCircle(nx, nz, .32, false); c.x = r.x; c.z = r.z;
  }
  const armed = W.stars >= 2 || d < 12;
  p.aimK = sp ? .85 : 1; p.aimP = Math.atan2((player.mode === 'drive' ? .9 : 1.2) - 1.45, Math.max(d, 1)) * .9;
  copsCrowd.anim(c.k, sp ? (armed ? ANIM.aimRun : ANIM.run) : armed ? ANIM.aimIdle : ANIM.idle, c.ph += dt * (sp ? 1 : 0), 1);
  copsCrowd.place(c.k, c.x, groundH(c.x, c.z) > 0 ? .15 : 0, c.z, c.yaw);
  if (shoot) {
    c.shotT -= dt;
    if (c.shotT <= 0) {
      const g = npcGunOf(p), ox = g ? g.x : c.x, oy = g ? g.y : 1.4, oz = g ? g.z : c.z;
      if (c.gun === 'rifle') { npcShoot(ox, oy, oz, .32, 9, 1.3, 'cop'); c.burst = (c.burst + 1) % 3; c.shotT = c.burst ? .11 : 1.1 + Math.random() * .6; }
      else if (c.gun === 'shotgun') { npcShoot(ox, oy, oz, d < 15 ? .55 : .1, 14, 2, 'cop'); c.shotT = 1.3 + Math.random() * .6; }
      else { npcShoot(ox, oy, oz, .3 + W.stars * .03, 8, 1, 'cop'); c.shotT = .55 + Math.random() * .7; }
    }
  }
}
function policeGuns() {
  for (const c of W.cops) if (c.on && c.state !== 'down' && c.state !== 'board') npcGunPut(copsCrowd.people[c.k], c.gun);
}

// ─── 警車：從玩家看不到的路口開進來，沿路網追到最後已知位置，近了直接衝撞或停車放人 ───
function spawnSpot(minD, maxD) {
  const px = pX(), pz = pZ();
  camera.getWorldDirection(_pp);
  const c = [];
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const x = avX(i), z = stZ(j), d = Math.hypot(x - px, z - pz);
    if (d < minD || d > maxD) continue;
    const front = ((x - camera.position.x) * _pp.x + (z - camera.position.z) * _pp.z) / d;
    c.push({ i, j, x, z, s: front + Math.random() * .6 });
  }
  if (!c.length) return null;
  c.sort((a, b) => a.s - b.s);
  const n = c[0];
  let bd = 0, bs = -9;
  for (let d = 0; d < 4; d++) if (hasEdge(n.i, n.j, d)) { const s = DIRS[d][0] * (px - n.x) + DIRS[d][1] * (pz - n.z); if (s > bs) { bs = s; bd = d; } }
  return { x: n.x + DIRS[bd][0] * (HR + 4) + rightOf(bd)[0] * LANE, z: n.z + DIRS[bd][1] * (HR + 4) + rightOf(bd)[1] * LANE, yaw: Math.atan2(DIRS[bd][0], DIRS[bd][1]) };
}
function spawnUnit(kind, at) {
  const sp = at || spawnSpot(85, 170);
  if (!sp) return null;
  const type = kind === 'swat' ? 'md84' : kind === 'tank' ? 'tank' : COPS[Math.floor(Math.random() * COPS.length)];
  const v = buildVeh(type, sp.x, sp.z, sp.yaw, at ? 0 : 12, Math.random(), 0, 'unit');
  v.police = true; v.lights = 1; v.y = groundH(v.x, v.z);
  if (kind === 'tank') { v.mass = 12000; v.hp = 6000; v.vmax = 15; v.eng = 6; v.grip = 9; v.h = 2.4; }
  else if (kind === 'swat') { v.vmax = 34; v.eng = 9; }
  else { v.vmax = 38 + W.stars * 1.5; v.eng = 11.5; }
  const u = { v, kind: kind || 'car', state: at ? 'block' : 'chase', crew: kind === 'swat' ? 4 : kind === 'tank' ? 0 : 2, drive: !at, stuck: 0, rev: 0, revS: 1, search: null, searchT: 0, out: false, t: 0, gunT: 4 };
  v.unit = u;
  if (kind === 'tank') {
    u.turret = partMesh('tank_turret', 1, true); u.turret.count = 1; u.ty = v.yaw;   // 燒毀時砲塔跟著變黑（tankStep 同步 uM）
  }
  W.units.push(u);
  poseVehicle(v);
  return u;
}
function dropUnit(u) {
  const i = W.units.indexOf(u); if (i >= 0) W.units.splice(i, 1);
  const v = u.v;
  if (player.veh === v) { v.unit = null; jacked.push(v); return; }
  const k = vehicles.indexOf(v); if (k >= 0) vehicles.splice(k, 1);
  scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  if (u.turret) { scene.remove(u.turret); u.turret.geometry.dispose(); }
  for (const c of W.cops) if (c.unit === u) c.unit = null;
}
function unitHit(v, byP) { if (byP && v.unit) crime('resist', v.x, v.z); }
function unitDead(v) { const u = v.unit; if (!u) return; u.drive = false; if (u.crew > 0) { const n = u.crew; u.crew = 0; for (let s = 0; s < n; s++) { const c = spawnCop(u, s % 2 ? 1 : -1, u.kind === 'swat'); if (c && Math.random() < .5) copHit(c, 999, 0, 1, false); } } }
function crewOut(u) {
  if (u.crew <= 0 || u.v.dead) return;
  const n = u.crew;
  for (let s = 0; s < n; s++) { if (!spawnCop(u, s % 2 ? 1 : -1, u.kind === 'swat')) break; u.crew--; }
  sfx.doorCar(true);
}
function driveUnit(u, dt) {
  const v = u.v;
  u.t += dt;
  if (v.dead || !u.drive) return;
  const sp = Math.hypot(v.vx, v.vz), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), vF = v.vx * fx + v.vz * fz;
  const px = pX(), pz = pZ(), dP = Math.hypot(px - v.x, pz - v.z);
  let tx, tz, stop = false;
  if (u.state === 'leave') { tx = v.x + fx * 60; tz = v.z + fz * 60; }
  else {
    if (W.seen || dP < 20) { tx = px; tz = pz; u.search = null; }
    else if (W.lkp) {
      // 到了最後已知位置就在附近繞：每 6 秒換一個搜尋點
      if (Math.hypot(W.lkp.x - v.x, W.lkp.z - v.z) < 20 || u.search) {
        u.searchT -= dt;
        if (!u.search || u.searchT <= 0 || Math.hypot(u.search[0] - v.x, u.search[1] - v.z) < 10) { u.searchT = 6; const n = [nearI(W.lkp.x + (Math.random() - .5) * 150), nearJ(W.lkp.z + (Math.random() - .5) * 130)]; u.search = [avX(n[0]), stZ(n[1])]; }
        [tx, tz] = u.search;
      } else { tx = W.lkp.x; tz = W.lkp.z; }
    } else { tx = px; tz = pz; }
    const dT = Math.hypot(tx - v.x, tz - v.z);
    // 衝撞：兩星以上看到玩家開車，就瞄準玩家前方一點直接撞
    if (W.stars >= 2 && W.seen && player.mode === 'drive' && dT < 30 && u.kind !== 'tank') { tx = px + player.veh.vx * .5; tz = pz + player.veh.vz * .5; }
    else if (dT > 28 || !losClear(v.x, v.z, tx, tz)) [tx, tz] = routeTarget(u, tx, tz);
    // 玩家走路：停在附近讓警員下車；坦克停在 25 m 外開砲
    const stopD = 9 + Math.max(0, vF) ** 2 / 26;   // 煞得住的距離
    if (u.kind === 'tank' ? dP < 25 && W.seen : player.mode === 'walk' && dP < stopD && W.seen) stop = true;
    if (player.mode === 'drive' && dP < stopD + 2 && Math.hypot(player.veh.vx, player.veh.vz) < 2 && W.seen && u.kind !== 'tank') stop = true;
  }
  const da = wrapA(Math.atan2(tx - v.x, tz - v.z) - v.yaw), ad = Math.abs(da);
  let steer = clamp(da * 2.4, -1, 1), thr = 1, brk = 0;
  const want = stop ? 0 : ad > 1.1 ? 8 : ad > .45 ? 15 : v.vmax;
  if (vF > want + 1.5) { thr = 0; brk = clamp((vF - want) / 7, .35, 1); }
  else thr = stop ? 0 : ad > 1.8 ? .5 : 1;
  if (u.rev > 0) { u.rev -= dt; thr = 0; brk = 1; steer = -u.revS; }
  else if (thr > .3 && Math.abs(vF) < 1.2) { u.stuck += dt; if (u.stuck > 1.3) { u.rev = 1.2; u.revS = Math.sign(da) || 1; u.stuck = 0; } }
  else u.stuck = 0;
  driveVehicle(v, { thr, brk, steer, hb: false }, dt);
  v.lights = 1;
  if (stop && sp < 2.5 && u.crew > 0) crewOut(u);
}
// 坦克：砲塔轉向玩家，每 5 秒一發
const _tq = new T.Quaternion();
function tankStep(u, dt) {
  const v = u.v, t = u.turret;
  if (!t) return;
  const pv = piv('tank_turret'), c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  const want = Math.atan2(pX() - v.x, pZ() - v.z);
  if (!v.dead) u.ty += clamp(wrapA(want - u.ty), -.9 * dt, .9 * dt);
  _pp.set(v.x + pv[0] * c + pv[2] * s, v.y + pv[1], v.z - pv[0] * s + pv[2] * c);
  _pm4.compose(_pp, _tq.setFromEuler(_pe4.set(0, u.ty, 0)), _one);
  t.setMatrixAt(0, _pm4); t.instanceMatrix.needsUpdate = true;
  t.material.uniforms.uM.value.set(0, 0, 1, v.burn || 0);
  if (v.dead || !W.seen || u.state === 'leave') return;
  u.gunT -= dt;
  if (u.gunT <= 0 && Math.abs(wrapA(want - u.ty)) < .08 && Math.hypot(pX() - v.x, pZ() - v.z) < 120) {
    u.gunT = 5;
    const mx = _pp.x + Math.sin(u.ty) * 4.6, mz = _pp.z + Math.cos(u.ty) * 4.6, my = _pp.y + .55;
    const ty = player.mode === 'drive' ? player.veh.y + .8 : player.y + 1, d = Math.hypot(pX() - mx, pZ() - mz);
    const ex = (Math.random() - .5) * d * .06, ez = (Math.random() - .5) * d * .06;
    _pp.set(pX() + ex - mx, ty - my, pZ() + ez - mz).normalize();
    launch('shell', mx, my, mz, _pp.x * 70, _pp.y * 70, _pp.z * 70, 'cop', v);
    muzzleFx(mx, my, mz, 3); sfx.gun(1, 2.6); sfx.launch();
    camState.shake = Math.max(camState.shake, clamp(1 - d / 80, 0, .6));
  }
}

// ─── 直升機（3 星起）：在目標上空盤旋，探照燈掃地；4 星起有狙擊手 ───
// 探照燈照在地上的光圈：放射漸層（中心亮、外緣一圈淡淡的邊界）
const POOL_G = new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const POOL_M = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(225,232,255,.16)'); g.addColorStop(.25, 'rgba(210,220,250,.09)'); g.addColorStop(.8, 'rgba(180,195,240,.015)'); g.addColorStop(.94, 'rgba(200,210,250,.045)'); g.addColorStop(1, 'rgba(200,210,250,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({ map: t, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
})();
function spawnHeli() {
  const a = Math.random() * 6.28, px = pX(), pz = pZ();
  const g = new T.Group();
  const body = partMesh('heli', 1, true), rotor = partMesh('heli_rotor', 1, true), tail = partMesh('heli_tail', 1, true);
  for (const m of [body, rotor, tail]) { scene.remove(m); g.add(m); m.count = 1; }
  rotor.material = tail.material = body.material;
  scene.add(g);
  const beamG = new T.ConeGeometry(1, 1, 28, 1, true); beamG.translate(0, -.5, 0);
  const beam = new T.Mesh(beamG, new T.MeshBasicMaterial({ color: 0x8c96a8, transparent: true, opacity: .085, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  beam.layers.set(LY.NOREFL); beam.renderOrder = 6; scene.add(beam);
  const pool = new T.Mesh(POOL_G, POOL_M); pool.layers.set(LY.NOREFL); pool.renderOrder = 3; scene.add(pool);
  W.heli = { g, body, rotor, tail, beam, pool, x: px + Math.cos(a) * 160, z: pz + Math.sin(a) * 160, y: 70, vx: 0, vz: 0, yaw: 0, hp: 1500, ang: a, sx: px, sz: pz, spotR: SPOT_R, rot: 0, snipeT: 3, fall: null, dead: false, leave: false };
}
function dropHeli() {
  const h = W.heli; if (!h) return;
  scene.remove(h.g); scene.remove(h.beam); scene.remove(h.pool);
  for (const m of [h.body, h.rotor, h.tail]) m.geometry.dispose();
  h.body.material.dispose(); h.beam.geometry.dispose(); h.beam.material.dispose();
  W.heli = null;
}
function heliHit(dmg, mine) {
  const h = W.heli; if (!h || h.fall) return;
  h.hp -= dmg;
  if (mine) crime('resist', h.x, h.z);
  if (h.hp <= 0) { h.fall = { vy: 0, spin: 2.5 + Math.random() * 2 }; h.mine = mine; sparks(h.x, h.y + 1, h.z, 20, 6); fxLights.push({ x: h.x, y: h.y, z: h.z, col: COL.boom, r: 30, i: 6, life: 0, max: .5 }); }
}
function heliBlast(x, y, z, r, dmg, mine) {
  const h = W.heli; if (!h) return;
  const d = Math.hypot(h.x - x, h.y + 1 - y, h.z - z);
  if (d < r + 2) heliHit(dmg * clamp(1 - d / (r + 2), .3, 1), mine);
}
// 鄰近建築的高度（直升機至少飛在屋頂上 14 m）
const HG = 16, HGX = X0 - 80, HGZ = Z0 - 80, HGN = Math.ceil((NX * P + 160) / HG), HGM = Math.ceil((NZ * Q + 160) / HG);
const hGrid = new Float32Array(HGN * HGM);
for (const L of lots) {
  if (!(L.h > 0)) continue;
  for (let i = Math.max(0, Math.floor((L.x0 - HGX) / HG)); i <= Math.min(HGN - 1, Math.floor((L.x1 - HGX) / HG)); i++)
    for (let j = Math.max(0, Math.floor((L.z0 - HGZ) / HG)); j <= Math.min(HGM - 1, Math.floor((L.z1 - HGZ) / HG)); j++) hGrid[i * HGM + j] = Math.max(hGrid[i * HGM + j], L.h);
}
function roofAt(x, z, r = 2) {
  const ci = Math.floor((x - HGX) / HG), cj = Math.floor((z - HGZ) / HG);
  let m = 0;
  for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) if (i >= 0 && j >= 0 && i < HGN && j < HGM) m = Math.max(m, hGrid[i * HGM + j]);
  return m;
}
const _hb2 = V3(), _hy = V3(0, -1, 0);
function heliStep(dt) {
  const h = W.heli; if (!h) return;
  const px = pX(), pz = pZ();
  h.rot += dt * (h.fall ? 20 : 34);
  if (h.fall) {
    h.fall.vy -= 9.8 * dt; h.y += h.fall.vy * dt; h.yaw += h.fall.spin * dt;
    h.x += h.vx * dt; h.z += h.vz * dt;
    if (Math.random() < dt * 30) emit('dark', h.x, h.y + 1, h.z, { vy: 1.5, max: 2.5, s0: .8, s1: 3, a: .8, c: [.05, .045, .04] });
    if (Math.random() < dt * 20) emit('fire', h.x, h.y + 1, h.z, { vy: 1, max: .5, s0: .8, s1: .3 });
    if (h.y <= Math.max(groundH(h.x, h.z), roofAt(h.x, h.z, 0))) {
      blast(h.x, h.y, h.z, 10, 520, h.mine ? 'player' : null, null);
      if (h.mine) crime('heli', h.x, h.z);
      dropHeli(); return;
    }
  } else if (!h.pin) {   // pin：測試時固定位置截圖
    // 盤旋：繞著目標（看到玩家就是玩家，否則是最後已知位置）半徑 55 m 轉圈，探照燈斜斜照下來
    const tgt = h.leave ? null : W.seen ? [px, pz] : W.lkp ? [W.lkp.x, W.lkp.z] : [px, pz];
    let gx, gz;
    if (tgt) { h.ang += dt * .16; gx = tgt[0] + Math.cos(h.ang) * 55; gz = tgt[1] + Math.sin(h.ang) * 55; }
    else { gx = h.x + (h.x - px) * 2; gz = h.z + (h.z - pz) * 2; }
    const dx = gx - h.x, dz = gz - h.z, d = Math.hypot(dx, dz) || 1, vmax = 24;
    h.vx = damp(h.vx, dx / d * Math.min(vmax, d * .8), 1.2, dt); h.vz = damp(h.vz, dz / d * Math.min(vmax, d * .8), 1.2, dt);
    h.x += h.vx * dt; h.z += h.vz * dt;
    const alt = Math.max(40, roofAt(h.x, h.z, 1) + 12) + (h.leave ? 30 : 0);
    h.y = damp(h.y, alt, .8, dt);
    const look = tgt ? Math.atan2(tgt[0] - h.x, tgt[1] - h.z) : Math.atan2(h.vx, h.vz);
    h.yaw += wrapA(look - h.yaw) * (1 - Math.exp(-1.5 * dt));
    // 探照燈：看到玩家就鎖住，否則在最後已知位置附近掃
    h.spotR = SPOT_R * (W.stars >= 5 ? 1.5 : 1);
    let sx, sz;
    if (W.seen && Math.hypot(px - h.x, pz - h.z) < HELI_R) { sx = px; sz = pz; }
    else if (tgt) { const u = uTimeNow() * .5; sx = tgt[0] + Math.cos(u) * 22; sz = tgt[1] + Math.sin(u * 1.3) * 22; }
    else { sx = h.x; sz = h.z + 20; }
    const sd = Math.hypot(sx - h.sx, sz - h.sz), ms = 9 * dt;
    if (sd > ms) { sx = h.sx + (sx - h.sx) / sd * ms; sz = h.sz + (sz - h.sz) / sd * ms; }
    h.sx = sx; h.sz = sz;
    // 狙擊手
    if (W.stars >= 4 && W.seen && !h.leave && !life.dead) {
      h.snipeT -= dt;
      if (h.snipeT <= 0) { h.snipeT = 2.5 + Math.random(); npcShoot(h.x, h.y - .5, h.z, .3, 20, 2.6, 'cop'); }
    }
    if (h.leave && Math.hypot(h.x - px, h.z - pz) > 220) { dropHeli(); return; }
  }
  // 擺模型：機身、主旋翼（piv 是旋翼中心）、尾旋翼
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw), tilt = clamp((h.vx * s + h.vz * c) * .012, -.18, .18);
  h.g.position.set(h.x, h.y, h.z); h.g.rotation.set(tilt, h.yaw, 0, 'YXZ');
  const set = (m, p, e) => { m.setMatrixAt(0, _pm4.compose(_pp.set(p[0], p[1], p[2]), _pq4.setFromEuler(e), _one)); m.instanceMatrix.needsUpdate = true; };
  set(h.body, [0, 0, 0], _pe4.set(0, 0, 0));
  set(h.rotor, piv('heli_rotor'), _pe4.set(0, h.rot, 0));
  set(h.tail, piv('heli_tail'), _pe4.set(h.rot * 1.6, 0, 0));
  h.body.material.uniforms.uM.value.set(1, 0, 1, h.fall ? .6 : 0);
  // 光束：從機腹到地面
  const by = h.y - .6;
  _hb2.set(h.sx - h.x, groundH(h.sx, h.sz) - by, h.sz - h.z);
  const L = _hb2.length(); _hb2.divideScalar(L);
  h.beam.visible = !h.fall && !h.leave;
  h.beam.position.set(h.x, by, h.z); h.beam.quaternion.setFromUnitVectors(_hy, _hb2); h.beam.scale.set(h.spotR * .3, L, h.spotR * .3);
  // 地上的光圈：半徑就是偵測範圍（35 m，5 星 ×1.5），中間最亮
  h.pool.visible = h.beam.visible; h.pool.position.set(h.sx, groundH(h.sx, h.sz) + .06, h.sz); h.pool.scale.setScalar(h.spotR);
}

// ─── 路障（3 星起）：玩家開車時在前方路口擺兩台警車、拒馬與釘刺帶 ───
const RB_N = 6;
const rbMesh = { barricade: partMesh('barricade', RB_N * 4), spike: partMesh('spike', RB_N * 2) };
function placeRoadblock() {
  if (W.blocks.length >= 2 || player.mode !== 'drive') return null;
  const v = player.veh, sp = Math.hypot(v.vx, v.vz);
  const hx = sp > 3 ? v.vx / sp : Math.sin(v.yaw), hz = sp > 3 ? v.vz / sp : Math.cos(v.yaw);
  const alongX = Math.abs(hx) > Math.abs(hz);   // 玩家沿著哪個方向的路開
  let best = null, bs = -1;
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const x = avX(i), z = stZ(j), dx = x - v.x, dz = z - v.z, d = Math.hypot(dx, dz);
    if (d < 70 || d > 150) continue;
    if (alongX ? Math.abs(dz) > HR : Math.abs(dx) > HR) continue;
    const f = (dx * hx + dz * hz) / d;
    if (f > .9 && f > bs && !W.blocks.some(b => b.i === i && b.j === j)) { bs = f; best = { i, j, x, z }; }
  }
  if (!best) return null;
  // 來車方向（玩家那邊）的路段上：釘刺帶在路口前 16 m，警車橫在 7 m，拒馬在兩側
  const ix = alongX ? -Math.sign(hx) : 0, iz = alongX ? 0 : -Math.sign(hz), yawAcross = alongX ? 0 : Math.PI / 2;
  const b = { i: best.i, j: best.j, x: best.x, z: best.z, units: [], spikes: [], bars: [], circ: [], t: 0 };
  const lat = (k, s) => [best.x + ix * k + (alongX ? 0 : s), best.z + iz * k + (alongX ? s : 0)];
  for (const s of [-3.1, 3.1]) { const [x, z] = lat(HR + 16, s); b.spikes.push({ x, z, yaw: yawAcross }); }
  for (const s of [-3.4, 3.4]) {
    const [x, z] = lat(HR + 7, s);
    const u = spawnUnit(null, { x, z, yaw: yawAcross + (s > 0 ? .25 : -.25) + (Math.random() < .5 ? Math.PI : 0) });
    if (u) { u.block = b; b.units.push(u); }
  }
  for (const s of [-7.2, 7.2]) {
    const [x, z] = lat(HR + 9, s);
    b.bars.push({ x, z, yaw: yawAcross });
    for (const o of [-1, 0, 1]) { const q = { x: x + (alongX ? 0 : o * .95), z: z + (alongX ? o * .95 : 0), r: .45, rb: 1 }; circles.push(q); b.circ.push(q); }
  }
  W.blocks.push(b);
  drawBlocks();
  return b;
}
function dropBlock(b) {
  W.blocks.splice(W.blocks.indexOf(b), 1);
  for (const q of b.circ) { const i = circles.indexOf(q); if (i >= 0) circles.splice(i, 1); }
  colDirty();
  for (const u of b.units) if (W.units.includes(u)) u.state = 'leave', u.drive = true;
  drawBlocks();
}
function drawBlocks() {
  let nb = 0, ns = 0;
  for (const b of W.blocks) {
    for (const o of b.bars) { rbMesh.barricade.setMatrixAt(nb++, _pm4.compose(_pp.set(o.x, groundH(o.x, o.z), o.z), _pq4.setFromEuler(_pe4.set(0, o.yaw, 0)), _one)); }
    for (const o of b.spikes) { rbMesh.spike.setMatrixAt(ns++, _pm4.compose(_pp.set(o.x, .02, o.z), _pq4.setFromEuler(_pe4.set(0, o.yaw, 0)), _one)); }
  }
  rbMesh.barricade.count = nb; rbMesh.spike.count = ns;
  rbMesh.barricade.instanceMatrix.needsUpdate = rbMesh.spike.instanceMatrix.needsUpdate = true;
}
// 釘刺帶：輪胎全破，極速 ×(1 − 0.15·N)、抓地 ×0.45（V 叫車會送修好的來）
function spikeCheck(v) {
  if (!v || v.flatBase || v.dead) return;
  for (const b of W.blocks) for (const s of b.spikes) {
    const dx = v.x - s.x, dz = v.z - s.z, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    if (Math.abs(lx) < 3.1 + v.w / 2 && Math.abs(lz) < 1 + v.len / 2) {
      const n = v.isCar ? 4 : 2;
      v.flatBase = { vmax: v.vmax, grip: v.grip }; v.flat = n;
      v.vmax *= 1 - .15 * n; v.grip *= .45;
      sfx.impact(7); sparks(v.x, .3, v.z, 16, 5);
      if (v === player.veh) toast('輪胎被釘刺帶扎破了');
      return;
    }
  }
}

// ─── 每幀 ───
let sirenNear = 999;
function policeUpdate(dt) {
  const t = uTimeNow();
  for (let i = W.reports.length - 1; i >= 0; i--) if (W.reports[i].t <= t) { const r = W.reports.splice(i, 1)[0]; addHeat(r.n, r.floor); }
  // 開走警車：那台就不算出勤了
  if (player.veh && player.veh.unit) { const u = player.veh.unit; dropUnit(u); player.veh.unit = null; crime('jack', player.veh.x, player.veh.z); }
  if (W.stars > 0 && !life.dead) {
    W.visT -= dt;
    if (W.visT <= 0) { W.visT = .15; W.seen = sees(); }
    if (W.seen) { W.lkp = { x: pX(), z: pZ() }; W.evade = 0; W.lastVeh = player.veh; }
    else { W.evade += dt; if (W.evade > EVADE[W.stars - 1]) wantedClear('evaded'); }
  }
  const s = W.stars;
  if (s > 0 && !life.dead) {
    // 路網距離場
    W.fieldT -= dt;
    const tg = W.seen || !W.lkp ? [pX(), pZ()] : [W.lkp.x, W.lkp.z], goal = NODE(nearI(tg[0]), nearJ(tg[1]));
    if (W.fieldT <= 0 || goal !== W.goal || !W.field) { W.fieldT = .5; W.goal = goal; W.field = fieldTo(nearI(tg[0]), nearJ(tg[1])); }
    // 派車
    W.spawnT -= dt;
    const active = W.units.filter(u => u.state === 'chase' && !u.v.dead).length;
    if (W.spawnT <= 0 && active < Math.round(UNITS[s - 1] * (LOW ? .6 : 1)) && player.where === 'out') {
      W.spawnT = SPAWN_IV[s - 1];
      const swat = s >= 4 && Math.random() < .35, tank = s >= 5 && !W.units.some(u => u.kind === 'tank') && W.tankT <= 0;
      if (tank) W.tankT = 40;
      spawnUnit(tank ? 'tank' : swat ? 'swat' : null);
    }
    W.tankT -= dt;
    if (s >= 3 && !W.heli && player.where === 'out') spawnHeli();
    if (s >= 3 && player.mode === 'drive') { W.blockT -= dt; if (W.blockT <= 0) { W.blockT = 22; placeRoadblock(); } }
    // 被捕：1–2 星時警員貼身（徒手、沒拿槍瞄準）1 秒，或車停著有警員在駕駛座旁 1.5 秒
    let bust = false;
    if (s <= 2) for (const c of W.cops) {
      if (!c.on || c.state !== 'act' || c.stunT > 0) continue;   // 被電擊倒地的不算
      const d = Math.hypot(c.x - pX(), c.z - pZ());
      if (player.mode === 'walk' ? d < 2.2 && !gta.aiming : d < 3.4 && Math.hypot(player.veh.vx, player.veh.vz) < 1.5) { bust = true; break; }
    }
    W.bustT = bust ? W.bustT + dt : Math.max(0, W.bustT - dt * 2);
    if (W.bustT > (player.mode === 'walk' ? 1 : 1.5)) die('busted');
  }
  if (W.heli && (s < 3 || life.dead) && !W.heli.leave) W.heli.leave = true;
  // 警車
  const px = pX(), pz = pZ();
  sirenNear = 999;
  for (const u of [...W.units]) {
    if (u.kind === 'tank') tankStep(u, dt);
    if (u.state === 'block') {
      if (u.crew > 0 && W.stars > 0 && Math.hypot(u.v.x - px, u.v.z - pz) < 45) crewOut(u);
      if (!W.stars) { u.state = 'leave'; u.drive = true; }
    } else driveUnit(u, dt);
    const d = Math.hypot(u.v.x - px, u.v.z - pz);
    if (!u.v.dead && u.state !== 'leave') sirenNear = Math.min(sirenNear, d);
    const crewBack = !W.cops.some(c => c.on && c.unit === u && c.state !== 'down');
    if (d > 260 || u.state === 'leave' && d > 90 && crewBack || u.v.dead && d > 120) dropUnit(u);
  }
  for (const c of W.cops) if (c.on) copStep(c, dt);
  heliStep(dt);
  // 路障：遠離或過了一分鐘、通緝解除就收掉；釘刺帶
  for (const b of [...W.blocks]) { b.t += dt; if (!W.stars || b.t > 70 || Math.hypot(b.x - px, b.z - pz) > 230) dropBlock(b); }
  if (W.blocks.length) { if (player.mode === 'drive') spikeCheck(player.veh); for (const u of W.units) if (u.drive) spikeCheck(u.v); }
  // 撿彈藥
  for (const p of [...W.pickups]) {
    p.t += dt;
    if (p.t > 60) { dropPick(p); continue; }
    _pm4.compose(_pp.set(p.x, .35 + .08 * Math.sin(p.t * 3), p.z), _pq4.setFromEuler(_pe4.set(0, p.t * 1.8, 0)), _one);
    p.h.matrix.copy(_pm4); p.h.matrixWorldNeedsUpdate = true; p.h.visible = true;
    if (player.mode === 'walk' && !life.dead && Math.hypot(player.x - p.x, player.z - p.z) < 1.3) {
      arm.ammo[p.kind].res += p.amt; sfx.pickup(); toast(`撿到 ${ARMS[p.kind].name}彈藥 +${p.amt}`); dropPick(p);
    }
  }
  const h = W.heli;
  sfx.loops(sirenNear < 999, sirenNear, !!h && !h.fall, h ? Math.hypot(h.x - camera.position.x, h.y - camera.position.y, h.z - camera.position.z) : 999);
  wantedHud();
}

// ─── HUD：星級（自己畫的鈍角星），躲起來時閃；小地圖上的警力與視線錐 ───
const STAR_D = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.7 : 10.6; d += `${i ? 'L' : 'M'}${(12 + Math.cos(a) * r).toFixed(2)} ${(12.4 + Math.sin(a) * r).toFixed(2)}`; }
  return d + 'Z';
})();
$('wanted').innerHTML = Array.from({ length: 5 }, () => `<svg viewBox="0 0 24 23" aria-hidden="true"><path d="${STAR_D}"/></svg>`).join('');
$('wanted').setAttribute('aria-label', '通緝星級');
function wantedHud() {
  const key = `${W.stars}|${W.seen ? 1 : 0}`;
  if (hudCache.wanted === key) return;
  hudCache.wanted = key;
  const el = $('wanted');
  el.classList.toggle('on', W.stars > 0);
  el.classList.toggle('cool', W.stars > 0 && !W.seen);
  [...el.children].forEach((s, i) => s.classList.toggle('lit', i < W.stars));
  el.setAttribute('aria-label', `通緝 ${W.stars} 星`);
}
function policeMini(ctx, P2, zoom) {
  if (!W.stars && !W.units.length && !W.heli) return;
  const blink = Math.sin(uTimeNow() * 10) > 0, r = (W.disg ? DISGUISE_R : CONE_R) * MAP_S;
  // 視線錐
  ctx.fillStyle = 'rgba(120,150,255,.13)';
  const cone = (x, z, yaw) => { const [a, b] = P2(x, z); const ang = Math.atan2(Math.cos(yaw), Math.sin(yaw)); ctx.beginPath(); ctx.moveTo(a, b); ctx.arc(a, b, r, ang - .96, ang + .96); ctx.closePath(); ctx.fill(); };
  if (W.stars) {
    for (const c of W.cops) if (c.on && c.state === 'act') cone(c.x, c.z, c.yaw);
    for (const u of W.units) if (u.crew > 0 && !u.v.dead && u.state !== 'leave') cone(u.v.x, u.v.z, u.v.yaw);
  }
  for (const u of W.units) {
    if (u.v.dead) continue;
    const [x, y] = P2(u.v.x, u.v.z);
    ctx.fillStyle = blink ? '#ff3a48' : '#3a6cff'; ctx.fillRect(x - 4 / zoom * 1.4, y - 4 / zoom * 1.4, 8 / zoom * 1.4, 8 / zoom * 1.4);
  }
  ctx.fillStyle = '#7fa0ff';
  for (const c of W.cops) if (c.on && c.state !== 'down') { const [x, y] = P2(c.x, c.z); ctx.beginPath(); ctx.arc(x, y, 2.6 / zoom * 1.4, 0, 7); ctx.fill(); }
  const h = W.heli;
  if (h && !h.fall) {
    const [x, y] = P2(h.x, h.z), [sx, sy] = P2(h.sx, h.sz);
    ctx.strokeStyle = 'rgba(230,236,255,.5)'; ctx.lineWidth = 1.5 / zoom; ctx.beginPath(); ctx.arc(sx, sy, h.spotR * MAP_S, 0, 7); ctx.stroke();
    ctx.fillStyle = blink ? '#ff3a48' : '#f2ede2'; ctx.beginPath(); ctx.arc(x, y, 5 / zoom * 1.4, 0, 7); ctx.fill();
  }
  // 最後已知位置：沒被看到時畫一個虛線圈
  if (W.stars && !W.seen && W.lkp) {
    const [x, y] = P2(W.lkp.x, W.lkp.z);
    ctx.setLineDash([4 / zoom, 4 / zoom]); ctx.strokeStyle = 'rgba(255,174,87,.9)'; ctx.lineWidth = 2 / zoom;
    ctx.beginPath(); ctx.arc(x, y, 12 / zoom * 1.4, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
}
// 燈：最近兩台警車的紅藍閃燈、直升機的探照燈（聚光燈照地）
function policeLights(t) {
  const out = [], cx = camera.position.x, cz = camera.position.z;
  const near = W.units.filter(u => !u.v.dead && u.state !== 'leave').map(u => ({ u, d: (u.v.x - cx) ** 2 + (u.v.z - cz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, 2);
  for (const { u } of near) out.push({ x: u.v.x, y: u.v.y + 1.9, z: u.v.z, col: Math.sin(t * 13 + u.t) > 0 ? POL_R : POL_B, r: 16, i: 2.6 });
  const h = W.heli;
  if (h && !h.fall && !h.leave) {
    const by = h.y - .6, dx = h.sx - h.x, dy = groundH(h.sx, h.sz) - by, dz = h.sz - h.z, L = Math.hypot(dx, dy, dz);
    if (Math.sin(t * 7) > .6) out.push({ x: h.x, y: h.y + .2, z: h.z, col: POL_R, r: 9, i: 3 });   // 機腹的紅色閃燈
    // 衰減是 8/(2+d²)：強度跟著距離平方放大，地面中心才照得亮
    out.push({ x: h.x, y: by, z: h.z, col: SPOT_COL, r: L * 1.6 + 20, i: L * L * .012, dir: [dx / L, dy / L, dz / L], cos: Math.cos(Math.atan(h.spotR * .45 / L)) - .1 });
  }
  return out;
}

// 測試 API（window.__nc.gta.wanted）
const wantedApi = {
  W, crime, addHeat, clear: wantedClear, sees,
  set(s) { if (s <= 0) return wantedClear('reset'); W.heat = HEAT_STAR[s - 1]; W.stars = 0; addHeat(0, s); W.spawnT = 0; },
  unit: spawnUnit, heli: spawnHeli, roadblock: placeRoadblock, cops: copsCrowd,
};
