// ═══ 第四階段：武裝 NPC 小隊（赤蠍幫、鐵幕保全傭兵、搶劫隊友）、幫派追殺、資產防守、傭兵小隊 ═══
// 一個共用的「戰鬥員」池（fighters，最多 14 人）：team 是 gang（敵方）、merc（傭兵）、crew（搶劫時跟著你的另外兩位主角）。
// 敵方打玩家和友軍，友軍打敵方；通緝中傭兵和隊友也會對警察開火（他們打倒的警察不算你的罪，69-police.js 的 copHit 第五個參數）。
// 車上的人（state 'car'）不畫出來，只從車窗開火；車炸了人就跟著倒下。
//   幫派追殺：搶運鈔車後第一次撿錢袋、或搶劫前置偷到鑽機廂型車時，兩台赤蠍幫的車從看不到的路口追來，近了下車圍攻。
//            全部解決、或離他們 280 m 以上超過 20 秒就結束；不會改變通緝星級。
//   資產防守：擁有 LAZARUS、AFTERGLOW、CHROME WORKS 或島上辦公室時，開場 6 分鐘後起每 6–9 分鐘（真實時間，沒被通緝、在戶外）
//            一處被赤蠍幫盯上：180 秒內趕到，打退兩波人。守住給獎金；資產被打爛就搶走保險箱、停業 10 分鐘（motors.props.pause）。
//   傭兵小隊：手機打給鐵幕保全（$3,000），一台皮卡載四名傭兵過來跟著你 3 分鐘；你上車他們也上車跟車。
// 排在 69-safehouse 之後、69-stunt 之前：W、copHit、spawnSpot、fieldTo、roadNext、npcShoot、heist、crew 都已經宣告。

const FIGHT_N = LOW ? 10 : 14;
const fighters = crowd(FIGHT_N);
scene.add(fighters.mesh);
const SQ = { f: [], cars: [], merc: null, def: null, chase: null, hc: null, defT: 360, objSmall: '', ally: [] };
for (let k = 0; k < FIGHT_N; k++) { SQ.f.push({ k, on: false }); fighters.place(k, 0, -60, 0, 0); }
const GANG_NAME = '赤蠍幫', GANG_COL = '#ff4a3a', ALLY_COL = '#7fe08a';
// hp、對 NPC 的命中率、每發傷害；對玩家的命中率另外乘上距離與速度（npcShoot）
const TEAM = { gang: { hp: 90, acc: .26, dmg: 8 }, merc: { hp: 240, acc: .46, dmg: 13 }, crew: { hp: 600, acc: .5, dmg: 16 } };
const GUN_CD = { pistol: [.6, .7, 1], smg: [.08, 1.1, 4], rifle: [.11, 1.1, 3], shotgun: [1.3, .5, 1] };   // [連發間隔, 停頓 + 隨機, 一輪幾發]
function fLook(f) {
  const k = f.k, r = rng(400 + k * 7);
  if (f.team === 'crew') return fighters.look(k, { r: rng(31 + f.ci), ...CREW[f.ci].look });
  if (f.team === 'merc') return fighters.look(k, { r, female: false, top: lin(0x3a3e34), bot: lin(0x262822), skin: SKINS[(k + 2) % SKINS.length], hair: HAIRS[k % 3], coat: 1, skirt: 0, longHair: 0, hat: 1, glowI: 0, shoe: SHOES[2], scale: 1.04 });
  fighters.look(k, { r, female: false, top: lin(k % 3 ? 0x5a1418 : 0x2a1012), bot: lin(0x17181c), skin: SKINS[k % SKINS.length], hair: HAIRS[(k + 1) % 3], coat: k % 2, skirt: 0, longHair: 0, hat: k % 2, glow: lin(0xff3a2a), glowI: 1.2, shoe: SHOES[k % 2], scale: .98 + (k % 3) * .03 });
}
function fSpawn(team, x, z, yaw, o = {}) {
  const f = SQ.f.find(q => !q.on);
  if (!f) return null;
  const r = collideCircle(x, z, .32, false);
  Object.assign(f, { on: true, team, x: r.x, z: r.z, yaw, hp: TEAM[team].hp, gun: o.gun || 'pistol', shotT: .6 + Math.random(), burst: 0, ph: Math.random() * 9, state: o.state || 'act', downT: 0, stunT: 0, car: o.car || null, ci: o.ci ?? -1, slot: o.slot ?? 0, tgt: null, tgtT: 0, goal: o.goal || null });
  fLook(f);
  return f;
}
function fFree(f) { f.on = false; f.car = null; fighters.place(f.k, 0, -60, 0, 0); fighters.people[f.k].gunH = null; }
const fAlly = f => f.team !== 'gang';
const fUp = f => f.on && f.state === 'act';
// 被打中：敵方倒下會掉彈藥；隊友不會倒（生命鎖在 50），傭兵會
function fHit(f, dmg, fx, fz, mine) {
  if (!f.on || f.state === 'down' || f.state === 'car') return false;
  if (fAlly(f) && mine) dmg *= .25;
  f.hp -= dmg;
  if (f.team === 'crew') { f.hp = Math.max(50, f.hp); return false; }
  if (f.hp > 0) { if (mine) f.tgtT = 0; return false; }
  fDown(f, fx, fz);
  if (f.team === 'gang' && Math.random() < .5) dropPickup(f.x, f.z, f.gun);
  return true;
}
function fDown(f, fx = 0, fz = 1) {
  f.state = 'down'; f.downT = 20; f.car = null; f.yaw = Math.atan2(-fx, -fz) || f.yaw;
  fighters.anim(f.k, ANIM.die, -uTimeNow(), 1);
}
function fighterBlast(x, y, z, r, dmg, mine) {
  for (const f of SQ.f) if (fUp(f)) { const d = Math.hypot(f.x - x, f.z - z); if (d < r) fHit(f, dmg * clamp(1 - d / r, .3, 1) * (fAlly(f) ? .4 : 1), (f.x - x) / (d || 1), (f.z - z) / (d || 1), mine); }
}
function fighterMelee(x, z, fx, fz, reach, dmg) {
  for (const f of SQ.f) {
    if (!fUp(f) || fAlly(f)) continue;
    const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz);
    if (d < reach && dx * fx + dz * fz > d * .5) { fHit(f, dmg, fx, fz, true); return true; }
  }
  return false;
}
// 射線打得到敵方（友軍讓子彈穿過去，免得誤傷）
rayHooks.push((R, hit) => { for (const f of SQ.f) if (fUp(f) && !fAlly(f)) hit(rayCyl(R, f.x, f.z, .34, .1, 1.95), 'fighter', f); });
// 69-police.js 的 copStep 問這裡：警察附近有沒有比玩家更近、看得到的友軍
function squadAlly(x, z, dMax) {
  let best = null, bd = dMax;
  for (const f of SQ.f) if (fUp(f) && fAlly(f)) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd && losClear(x, z, f.x, f.z)) { bd = d; best = f; } }
  return best;
}

// ─── 找目標、開槍 ───
function pickTarget(f) {
  let best = null, bd = f.team === 'gang' ? 70 : 55;
  const tryT = (kind, ref, x, z) => { const d = Math.hypot(x - f.x, z - f.z); if (d < bd && losClear(f.x, f.z, x, z)) { bd = d; best = { kind, ref }; } };
  if (f.team === 'gang') {
    if (!life.dead && player.where === 'out') tryT('player', null, pX(), pZ());
    for (const o of SQ.f) if (fUp(o) && fAlly(o)) tryT('f', o, o.x, o.z);
  } else {
    for (const o of SQ.f) if (o.on && !fAlly(o)) { if (o.state === 'act') tryT('f', o, o.x, o.z); else if (o.state === 'car' && o.car && !o.car.v.dead) tryT('veh', o.car.v, o.car.v.x, o.car.v.z); }
    if (W.stars) for (const c of W.cops) if (c.on && c.state !== 'down') tryT('cop', c, c.x, c.z);
  }
  return best;
}
const _tp = { x: 0, y: 0, z: 0 };
function tgtPos(t) {
  if (!t) return null;
  if (t.kind === 'player') { if (life.dead || player.where !== 'out') return null; const inV = player.mode === 'drive'; _tp.x = pX(); _tp.z = pZ(); _tp.y = inV ? player.veh.y + 1 : player.y + 1.2; return _tp; }
  if (t.kind === 'f') { if (!fUp(t.ref)) return null; _tp.x = t.ref.x; _tp.z = t.ref.z; _tp.y = 1.2; return _tp; }
  if (t.kind === 'cop') { const c = t.ref; if (!c.on || c.state === 'down') return null; _tp.x = c.x; _tp.z = c.z; _tp.y = 1.2; return _tp; }
  if (t.kind === 'veh') { const v = t.ref; if (v.dead) return null; _tp.x = v.x; _tp.z = v.z; _tp.y = v.y + 1; return _tp; }
  return null;
}
// 從 (ox, oy, oz) 朝目標開一槍：team 決定命中率與傷害；打玩家走 npcShoot（69-combat.js），其他目標走 npcShootAt
function fireAt(t, ox, oy, oz, team, gunF = 1) {
  const S = TEAM[team], P = tgtPos(t);
  if (!P) return;
  if (t.kind === 'player') { npcShoot(ox, oy, oz, team === 'gang' ? S.acc + .06 : S.acc, S.dmg, gunF, team); return; }
  const tx = P.x, ty = P.y, tz = P.z, d = Math.hypot(tx - ox, tz - oz);
  npcShootAt(ox, oy, oz, tx, ty, tz, S.acc * clamp(1.1 - d / 70, .2, 1), gunF, () => {
    const fx = (tx - ox) / (d || 1), fz = (tz - oz) / (d || 1);
    if (t.kind === 'f') { blood(tx, ty, tz); fHit(t.ref, S.dmg, fx, fz, false); }
    else if (t.kind === 'cop') { blood(tx, ty, tz); copHit(t.ref, S.dmg, fx, fz, false); }
    else if (t.kind === 'veh') { sparks(tx, ty, tz, 4, 2); damageVeh(t.ref, S.dmg * VEH_K * .5, false); }
  });
}
function fShoot(f, dt) {
  if ((f.shotT -= dt) > 0) return;
  const cd = GUN_CD[f.gun] || GUN_CD.pistol, g = npcGunOf(fighters.people[f.k]);
  fireAt(f.tgt, g ? g.x : f.x, g ? g.y : 1.4, g ? g.z : f.z, f.team, ARMS[f.gun].f);
  f.burst = (f.burst + 1) % cd[2];
  f.shotT = f.burst ? cd[0] : cd[1] + Math.random() * .6;
}

// ─── 每個戰鬥員每幀 ───
function fGround(f) { return groundH(f.x, f.z) > 0 ? .15 : 0; }
function fStep(f, dt) {
  const p = fighters.people[f.k];
  if (f.state === 'car') { if (f.car) { f.x = f.car.v.x; f.z = f.car.v.z; } fighters.place(f.k, 0, -60, 0, 0); return; }
  if (f.state === 'down') {
    f.downT -= dt; fighters.place(f.k, f.x, fGround(f), f.z, f.yaw);
    if (f.downT <= 0 || Math.hypot(f.x - pX(), f.z - pZ()) > 200) fFree(f);
    return;
  }
  if ((f.tgtT -= dt) <= 0) { f.tgtT = .4 + Math.random() * .3; f.tgt = pickTarget(f); }
  let P = tgtPos(f.tgt);
  if (!P) f.tgt = null;
  // 目標點：有目標就保持射距；敵方沒目標時去 goal（資產或玩家）；友軍跟在玩家身後（沒在跟車時）
  let gx, gz, want, run = true;
  if (f.board) { gx = f.board.v.x; gz = f.board.v.z; want = .5; P = null; }
  else if (P) { gx = P.x; gz = P.z; want = f.gun === 'shotgun' ? 7 : f.gun === 'rifle' ? 18 : 12; }
  else if (!fAlly(f)) { const g = f.goal || { x: pX(), z: pZ() }; gx = g.x; gz = g.z; want = f.goal ? 3 : 10; }
  else {
    const a = player.yaw + Math.PI + (f.slot - 1.5) * .55, r = 3.6 + (f.slot % 2) * 1.6;
    gx = pX() + Math.sin(a) * r; gz = pZ() + Math.cos(a) * r; want = .8;
    run = Math.hypot(gx - f.x, gz - f.z) > 5;
  }
  const dx = gx - f.x, dz = gz - f.z, d = Math.hypot(dx, dz) || 1;
  let sp = 0;
  if (d > want + (P ? 1.5 : .3)) sp = run ? (P ? 4.2 : 4.8) : 1.8;
  else if (P && d < want - 4) sp = -1.5;
  const lx = P ? P.x - f.x : dx, lz = P ? P.z - f.z : dz;
  if (sp > 0 || P) f.yaw += wrapA(Math.atan2(sp > 0 && !P ? dx : lx, sp > 0 && !P ? dz : lz) - f.yaw) * (1 - Math.exp(-9 * dt));
  if (sp) {
    const s = sp > 0 ? 1 : -1, m = Math.abs(sp) * dt;
    let nx = f.x + dx / d * m * s, nz = f.z + dz / d * m * s;
    for (const o of SQ.f) if (o !== f && fUp(o)) { const ex = nx - o.x, ez = nz - o.z, e = Math.hypot(ex, ez); if (e < .8 && e > 1e-3) { nx += ex / e * (.8 - e) * .5; nz += ez / e * (.8 - e) * .5; } }
    const r = collideCircle(nx, nz, .32, false); f.x = r.x; f.z = r.z;
  }
  if (f.board && Math.hypot(f.board.v.x - f.x, f.board.v.z - f.z) < f.board.v.w / 2 + 1.4) { f.state = 'car'; f.car = f.board; f.board = null; return; }
  p.aimK = P ? (sp ? .85 : 1) : .25; p.aimP = P ? Math.atan2(P.y - 1.45, Math.max(Math.hypot(P.x - f.x, P.z - f.z), 1)) * .9 : -.2;
  fighters.anim(f.k, sp ? ANIM.aimRun : ANIM.aimIdle, f.ph += dt * (sp ? 1 : 0), 1);
  fighters.place(f.k, f.x, fGround(f), f.z, f.yaw);
  if (P && !life.dead && Math.hypot(P.x - f.x, P.z - f.z) < 60) fShoot(f, dt);
}
// 69-combat.js 的 combatLate：手上的槍
function squadGuns() {
  for (const f of SQ.f) if (fUp(f)) npcGunPut(fighters.people[f.k], f.gun);
}

// ─── 車：幫派座車與傭兵皮卡（沿路網追玩家，近了直接開過去） ───
function squadCar(team, type, x, z, yaw, sp) {
  const v = buildVeh(type, x, z, yaw, sp, Math.random(), team === 'gang' ? (Math.random() < .5 ? 4 : 2) : 4, team);
  v.name = team === 'gang' ? `${GANG_NAME}座車` : '鐵幕保全皮卡';
  v.y = groundH(v.x, v.z); v.ai = true;
  if (team === 'gang') { v.vmax = 37; v.eng = 11.5; v.hp = 1500; } else { v.vmax = 36; v.eng = 11; v.hp = 2600; v.mass = 2800; }
  poseVehicle(v);
  const c = { v, team, field: null, goal: -1, rT: 0, stuck: 0, rev: 0, shotT: 1.5, riders: [] };
  SQ.cars.push(c);
  return c;
}
function carRiders(c, n, guns) {
  for (let s = 0; s < n; s++) { const f = fSpawn(c.team, c.v.x, c.v.z, c.v.yaw, { state: 'car', car: c, gun: guns[s % guns.length], slot: s }); if (f) c.riders.push(f); }
}
function dropCar(c) {
  const i = SQ.cars.indexOf(c); if (i >= 0) SQ.cars.splice(i, 1);
  const v = c.v;
  v.ai = false;
  if (player.veh === v) { jacked.push(v); return; }
  const k = vehicles.indexOf(v); if (k >= 0) vehicles.splice(k, 1);
  scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
// 車上的人全部下車，排在車子兩側
function unload(c) {
  const v = c.v, lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let s = 0;
  for (const f of SQ.f) if (f.on && f.state === 'car' && f.car === c) {
    const side = s % 2 ? 1 : -1, back = s < 2 ? .6 : -.9;
    const r = collideCircle(v.x + lx * side * (v.w / 2 + .7) + fx * back, v.z + lz * side * (v.w / 2 + .7) + fz * back, .32, false);
    f.x = r.x; f.z = r.z; f.yaw = v.yaw; f.state = 'act'; f.car = null; f.tgtT = 0; f.shotT = .8 + Math.random(); s++;
  }
  if (s) sfx.doorCar(true);
  return s;
}
const ridersIn = c => SQ.f.filter(f => f.on && f.state === 'car' && f.car === c).length;
function squadDrive(c, tx, tz, stopD, dt) {
  const v = c.v;
  if (v.dead) return;
  const d = Math.hypot(tx - v.x, tz - v.z);
  let ax = tx, az = tz;
  if (d > 30 || !losClear(v.x, v.z, tx, tz)) {
    // 和警車一樣：到目標路口的距離場（目標換路口或每秒重算），往「距離＋掉頭懲罰」最小的相鄰路口開
    const gp = rnProject(tx, tz), goal = gp.e.id;
    if ((c.rT -= dt) <= 0 || c.goal !== goal || !c.field) { c.rT = 1; c.goal = goal; c.field = fieldTo(gp); }
    [ax, az] = roadNext(v, c.field, gp, tx, tz);
    if (Math.hypot(ax - gp.x, az - gp.z) < 1 && Math.hypot(gp.x - v.x, gp.z - v.z) < 8) { ax = tx; az = tz; }   // 到了目標路邊：直接開過去
  }
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), vF = v.vx * fx + v.vz * fz;
  const fwd = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
  const da = wrapA(Math.atan2(ax - v.x, az - v.z) - v.yaw), ad = Math.abs(da), stop = stopD > 0 && d < stopD + Math.max(0, fwd) ** 2 / 26;   // 加上煞得住的距離
  let steer = clamp(da * 2.4, -1, 1), thr = stop ? 0 : 1, brk = stop ? 1 : 0;
  const want = stop ? 0 : ad > 1.1 ? 7 : ad > .45 ? 13 : Math.min(v.vmax, 8 + d * .5);
  if (vF > want + 1.5) { thr = 0; brk = clamp((vF - want) / 7, .35, 1); }
  if (c.rev > 0) { c.rev -= dt; thr = 0; brk = 1; steer = -(Math.sign(da) || 1); }
  else if (thr > .3 && Math.abs(vF) < 1.2) { c.stuck += dt; if (c.stuck > 1.4) { c.rev = 1.1; c.stuck = 0; } }
  else c.stuck = 0;
  driveVehicle(v, { thr, brk, steer, hb: false }, dt);
  v.lights = 1;
}
// 車窗開火：從朝目標那一側的車窗
function windowShot(c, t, team) {
  const v = c.v, P = tgtPos(t);
  if (!P) return;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
  const side = (P.x - v.x) * rx + (P.z - v.z) * rz >= 0 ? 1 : -1, hw = (v.w || 1.8) / 2 + .25;
  fireAt(t, v.x + rx * side * hw + fx * .2, v.y + 1.15, v.z + rz * side * hw + fz * .2, team, .9);
}

// ─── 幫派追殺 ───
const GANG_TYPES = ['e34', 'evo190', 'carter'];
function gangChase(why, n = 2) {
  if (SQ.chase || player.where !== 'out') return false;
  const ch = SQ.chase = { why, cars: [], t: 0, farT: 0 };
  for (let i = 0; i < n; i++) {
    const sp = spawnSpot(90, 170);
    if (!sp) break;
    const back = i * 10, c = squadCar('gang', GANG_TYPES[i % 3], sp.x - Math.sin(sp.yaw) * back, sp.z - Math.cos(sp.yaw) * back, sp.yaw, 10);
    carRiders(c, 3, ['smg', 'pistol', 'pistol']);
    c.chase = true; ch.cars.push(c);
  }
  if (!ch.cars.length) { SQ.chase = null; return false; }
  toast(why === 'van' ? `${GANG_NAME}也想要那台鑽機：兩台車追上來了` : `${GANG_NAME}看到你拿了錢：兩台車追上來了（小地圖紅點）`);
  wakeArms();
  return true;
}
function chaseStep(dt) {
  const ch = SQ.chase;
  if (!ch) return;
  ch.t += dt;
  const px = pX(), pz = pZ();
  let near = 999, alive = 0;
  for (const c of ch.cars) {
    if (!SQ.cars.includes(c)) continue;
    const v = c.v, d = Math.hypot(v.x - px, v.z - pz), inC = ridersIn(c);
    if (inC && !v.dead) near = Math.min(near, d);
    if (v.dead || !inC || player.veh === v) continue;
    // 玩家走路：停在 10 m 外放人；玩家開車：貼上去從車窗開槍，慢下來或停住就下車
    const walk = player.mode === 'walk';
    squadDrive(c, px + (walk ? 0 : player.veh.vx * .4), pz + (walk ? 0 : player.veh.vz * .4), walk ? 10 : 0, dt);
    const sp = Math.hypot(v.vx, v.vz), los = d < 40 && losClear(v.x, v.z, px, pz);
    if (los && !life.dead && (c.shotT -= dt) <= 0) { c.shotT = .45 + Math.random() * .5; windowShot(c, { kind: 'player' }, 'gang'); }
    if (sp < 2.5 && (walk ? d < 18 : d < 9 && Math.hypot(player.veh.vx, player.veh.vz) < 3)) unload(c);
  }
  for (const f of SQ.f) if (f.on && f.team === 'gang' && (f.state === 'act' || f.state === 'car')) { alive++; if (f.state === 'act') near = Math.min(near, Math.hypot(f.x - px, f.z - pz)); }
  if (!alive) { toast(`${GANG_NAME}的人解決了`); chaseEnd(); return; }
  ch.farT = near > 280 ? ch.farT + dt : 0;
  if (ch.farT > 20) { toast(`甩掉${GANG_NAME}了`); chaseEnd(true); }
}
function chaseEnd(drop) {
  const ch = SQ.chase; if (!ch) return;
  for (const f of SQ.f) if (f.on && f.team === 'gang' && !f.goal && (drop || f.state === 'car')) fFree(f);
  for (const c of ch.cars) if (SQ.cars.includes(c) && (drop || c.v.dead || !ridersIn(c))) c.chase = false;
  SQ.chase = null;
}

// ─── 資產防守 ───
const DEF_BIZ = ['lazarus', 'afterglow', 'chrome', 'office'];
function defSpot(id) {
  // 世界座標（門口的邏輯位置換算過去）
  if (id === 'lazarus') return { ...WP(CLUB_X, CLUB_Z + 2.5), name: 'LAZARUS 夜店' };
  if (id === 'afterglow') return { ...WP(BAR_X - 4.6, BAR_Z + 2.5), name: 'AFTERGLOW 酒吧' };
  if (id === 'chrome') return { ...WP(GAR_X, GAR_Z + SW + 3), name: 'CHROME WORKS' };
  const d = APT.office.door, s = aptFace('office');
  return { ...WP(d.x, d.z + 2.5 * s), name: '灰鷗島辦公室' };
}
const defReward = id => 6000 + ESTATES.find(e => e.id === id).rate * 4;
function defStart(id) {
  if (SQ.def || !estOwned(id)) return false;
  const s = defSpot(id);
  SQ.def = { id, ...s, st: 'go', t: 180, hp: 100, wave: 0, waveT: 0 };
  heistObjLabel(`資產防守 <i>· ${s.name}</i>`);
  toast(`${GANG_NAME}盯上了${s.name}：180 秒內趕過去`);
  sfx.busted(); gps.t = 0;
  return true;
}
// 從資產外 32–40 m、看不到資產的方向冒出一波人
function defWave(n) {
  const D = SQ.def;
  D.wave++;
  for (let i = 0; i < n; i++) {
    let x = D.x, z = D.z;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * 6.283, r = 32 + Math.random() * 8;
      x = D.x + Math.sin(a) * r; z = D.z + Math.cos(a) * r;
      const [lx, lz] = toL(x, z);
      if (!blocks.some(b => lx > b.x0 && lx < b.x1 && lz > b.z0 && lz < b.z1)) break;
    }
    const f = fSpawn('gang', x, z, Math.atan2(D.x - x, D.z - z), { gun: i % 3 === 0 ? 'smg' : i % 4 === 1 ? 'shotgun' : 'pistol', goal: { x: D.x, z: D.z } });
    if (f) f.def = true;
  }
  toast(D.wave === 1 ? `第一波：${GANG_NAME}在砸${D.name}` : `第二波：${GANG_NAME}的援兵到了`);
}
function defStep(dt) {
  const D = SQ.def;
  if (!D) {
    if (!started || life.dead || W.stars || player.where !== 'out' || heist.st !== 'off' && heist.st !== 'plan' || SQ.chase || crew.sw) return;
    if ((SQ.defT -= slowmo.raw) > 0) return;
    const own = DEF_BIZ.filter(id => estOwned(id) && !(motors.props.pause && motors.props.pause[id] > Date.now()));
    SQ.defT = 360 + Math.random() * 180;
    if (own.length) defStart(own[Math.floor(Math.random() * own.length)]);
    return;
  }
  const d = player.where === 'out' ? Math.hypot(pX() - D.x, pZ() - D.z) : 999;
  if (D.st === 'go') {
    D.t -= slowmo.raw;
    if (d < 60) { D.st = 'fight'; defWave(4); }
    else if (D.t <= 0) return defLose('來不及趕到');
  } else if (D.st === 'fight') {
    let up = 0, at = 0;
    for (const f of SQ.f) if (f.def && fUp(f)) { up++; if (Math.hypot(f.x - D.x, f.z - D.z) < 6) at++; }
    D.hp = Math.max(0, D.hp - at * 1.6 * dt);
    if (D.hp <= 0) return defLose('被砸爛了');
    if (!up) {
      if (D.wave < 2) { D.waveT += dt; if (D.waveT > 4) { D.waveT = 0; defWave(5); } }
      else defWin();
    }
  }
}
function defWin() {
  const D = SQ.def, n = Math.round(defReward(D.id) * (.5 + D.hp / 200) / 100) * 100;
  defEnd();
  earn(n, `守住${D.name}`);
  sfx.ability(true);
}
function defLose(why) {
  const D = SQ.def, P = motors.props, lost = Math.floor(P.safe[D.id] || 0);
  P.safe[D.id] = 0; (P.pause ||= {})[D.id] = Date.now() + 10 * 60000; saveMotors();
  defEnd();
  toast(`${D.name}${why}：保險箱 ${money(lost)} 被搶走，停業 10 分鐘`);
}
function defEnd() {
  for (const f of SQ.f) if (f.on && f.def) { if (f.state === 'down') f.def = false; else fFree(f); }
  SQ.def = null; heistObjLabel(null);
  gps.t = 0;
}
// 任務框上方的小標：防守期間換掉，結束時換回主線
function heistObjLabel(html) {
  const sm = $('obj').querySelector('small');
  if (html) { if (!SQ.objSmall) SQ.objSmall = sm.innerHTML; sm.innerHTML = html; }
  else if (SQ.objSmall) { sm.innerHTML = SQ.objSmall; SQ.objSmall = ''; setText('objText', QUEST[quest.n].text); }
  const o = $('obj'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
}
function defMark() { const D = SQ.def; return D ? { name: D.name, x: D.x, y: 2.2, z: D.z, where: 'out' } : null; }
// 69-heist.js 的 heistHud 之後：沿用搶劫的計時條樣式
function defHud() {
  const D = SQ.def;
  if (!D || heist.st !== 'off' && heist.st !== 'plan') return;
  const o = $('obj'), sub = $('objSub');
  o.classList.add('heist');
  const go = D.st === 'go', left = SQ.f.filter(f => f.def && fUp(f)).length;
  setText('objText', go ? `趕到${D.name}` : `守住${D.name}`);
  sub.classList.add('bar');
  sub.style.setProperty('--v', (go ? 100 * D.t / 180 : D.hp).toFixed(1) + '%');
  sub.classList.toggle('low', go ? D.t < 40 : D.hp < 30);
  setText('objNum', go ? `剩 ${Math.ceil(D.t)} 秒` : `資產 ${Math.ceil(D.hp)}% · 第 ${D.wave}/2 波 · 剩 ${left} 人`);
}

// ─── 傭兵小隊（手機：鐵幕保全） ───
const MERC_FEE = 3000, MERC_T = 180;
function mercCall() {
  if (SQ.merc) return phoneMsg('鐵幕保全：小隊已經在你那邊了。');
  if (player.where !== 'out') return phoneMsg('鐵幕保全：到戶外再叫我們。');
  if (phone.cd.merc > 0) return phoneMsg(`鐵幕保全：下一組人 ${secs(phone.cd.merc)} 後才能出動。`);
  const sp = spawnSpot(60, 130);
  if (!sp) return phoneMsg('鐵幕保全：附近沒有路可以過去。');
  if (!pay(MERC_FEE)) return;
  const c = squadCar('merc', 'conquer', sp.x, sp.z, sp.yaw, 10);
  carRiders(c, 4, ['rifle', 'rifle', 'smg', 'shotgun']);
  SQ.merc = { c, st: 'come', t: MERC_T };
  wakeArms(); sfx.pickup();
  phoneMsg('鐵幕保全：四個人已經上車，三分鐘合約。'); toast('鐵幕保全的皮卡過來了（小地圖綠點）');
}
function mercStep(dt) {
  const M = SQ.merc;
  if (!M) return;
  const c = M.c, v = c.v, px = pX(), pz = pZ(), d = Math.hypot(v.x - px, v.z - pz);
  const men = SQ.f.filter(f => f.on && f.team === 'merc' && f.state !== 'down');
  if (!men.length || v.dead && !men.some(f => f.state === 'act')) { toast(men.length ? '傭兵的車毀了' : '傭兵小隊全倒了'); return mercEnd(); }
  if (M.st !== 'leave') M.t -= slowmo.raw;
  if (M.st !== 'leave' && M.t <= 0) { M.st = 'leave'; M.t = 40; toast('鐵幕保全：合約時間到，我們撤了'); for (const f of men) f.board = f.state === 'act' && !v.dead ? c : null; }
  const inC = ridersIn(c), drv = !v.dead && player.veh !== v && inC > 0 && inC === men.length;
  if (M.st === 'come') {
    if (drv) squadDrive(c, px, pz, 12, dt);
    if (Math.hypot(v.vx, v.vz) < 2 && d < 20 || v.dead || player.veh === v) { unload(c); M.st = 'on'; }
  } else if (M.st === 'on') {
    // 玩家開車走了：上皮卡跟車；玩家下車、皮卡在附近：下車
    const away = player.mode === 'drive' && (Math.hypot(player.veh.vx, player.veh.vz) > 4 || d > 25) && player.veh !== v;
    for (const f of men) if (f.state === 'act') f.board = away && !v.dead ? c : null;
    if (drv) {
      squadDrive(c, px, pz, player.mode === 'walk' ? 10 : 9, dt);
      if (player.mode === 'walk' && d < 18 && Math.hypot(v.vx, v.vz) < 2) unload(c);
      // 跟車時車上的人也從車窗開火
      if ((c.shotT -= dt) <= 0) { c.shotT = .5 + Math.random() * .4; const t = pickTarget({ team: 'merc', x: v.x, z: v.z }); if (t) windowShot(c, t, 'merc'); }
    }
  } else {
    if (drv) { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); squadDrive(c, v.x + fx * 80, v.z + fz * 80, 0, dt); }
    if ((M.t -= slowmo.raw) <= 0 || d > 160 && !men.some(f => f.state === 'act' && Math.hypot(f.x - px, f.z - pz) < 100)) mercEnd();
  }
  men.forEach((f, i) => { f.slot = i; });
}
function mercEnd() {
  const M = SQ.merc; if (!M) return;
  for (const f of SQ.f) if (f.on && f.team === 'merc') { if (f.state === 'down') continue; fFree(f); }
  M.c.chase = false; M.c.done = true;
  SQ.merc = null; phone.cd.merc = 240;
}

// ─── 搶劫隊友（69-heist.js 的 heistStage 呼叫）：逃出銀行時 Jax 與 Kael 跟著 Vance；上逃亡車後另外兩人從車窗開火 ───
function squadHeist(s) {
  for (const f of SQ.f) if (f.on && f.team === 'crew') fFree(f);
  SQ.hc = null;
  if (s === 'escape') {
    [2, 1].forEach((ci, j) => {
      crew.st[ci].where = 'heist';
      const at = bankAt(1.5 + j * 1.2, 2.4);
      fSpawn('crew', at.x, at.z, at.yaw, { ci, gun: ci === 2 ? 'rifle' : 'smg', slot: j + 1 });
    });
  } else if (s === 'drive') {
    for (let i = 0; i < 3; i++) if (i !== crew.cur) crew.st[i].where = 'heist';
    SQ.hc = { shotT: 1.5 };
  } else {
    // 結束（成功、失敗）：另外兩人回到現身的位置（成功就在倉庫門口，失敗回家）
    const pass = s === 'off';
    for (let i = 0; i < 3; i++) {
      const st = crew.st[i];
      if (i === crew.cur || st.where !== 'heist') continue;
      st.where = 'out';
      if (pass) { const [lx, lz] = toL(SAFE.x, SAFE.z); Object.assign(st, spotW({ x: lx + (i - 1) * 2.4, z: lz + 3, yaw: Math.PI })); }
      else { st.x = CREW[i].home.x; st.z = CREW[i].home.z; st.yaw = CREW[i].home.yaw; }
    }
  }
}
// 開車逃亡時：車上另外兩人每 0.6–1 秒朝最近的警車或警員開一槍
function heistCarStep(dt) {
  const H = SQ.hc, v = player.veh;
  if (!H || heist.st !== 'drive' || player.mode !== 'drive' || !v || v.dead || life.dead) return;
  if ((H.shotT -= dt) > 0) return;
  H.shotT = .6 + Math.random() * .4;
  let best = null, bd = 45;
  for (const u of W.units) if (!u.v.dead && u.state !== 'leave') { const d = Math.hypot(u.v.x - v.x, u.v.z - v.z); if (d < bd && losClear(v.x, v.z, u.v.x, u.v.z)) { bd = d; best = { kind: 'veh', ref: u.v }; } }
  for (const c of W.cops) if (c.on && c.state !== 'down') { const d = Math.hypot(c.x - v.x, c.z - v.z); if (d < bd && losClear(v.x, v.z, c.x, c.z)) { bd = d; best = { kind: 'cop', ref: c }; } }
  if (best) windowShot({ v }, best, 'crew');
}

// ─── 每幀（68-gta.js 的 gtaUpdate，在 heistUpdate 之後） ───
function squadUpdate(dt) {
  const out = player.where === 'out';
  defStep(dt);
  if (out) { chaseStep(dt); mercStep(dt); heistCarStep(dt); }
  // 車：炸了就把車上的人放倒在旁邊；被玩家開走就變成一般搶來的車；沒事做的車遠了收掉
  for (const c of [...SQ.cars]) {
    const v = c.v;
    if (v.dead) { v.ai = false; for (const f of SQ.f) if (f.on && f.state === 'car' && f.car === c) { f.x = v.x + (Math.random() - .5) * 3; f.z = v.z + (Math.random() - .5) * 3; fDown(f); } }
    if (player.veh === v) { unload(c); dropCar(c); continue; }
    const idle = !c.chase && !(SQ.merc && SQ.merc.c === c);
    v.ai = !v.dead && !idle && ridersIn(c) > 0;   // 有人開才由這裡推進，否則交給 69-combat.js 的 coast 滑行停下
    if (idle && Math.hypot(v.x - pX(), v.z - pZ()) > 150 || Math.hypot(v.x - pX(), v.z - pZ()) > 420) { for (const f of SQ.f) if (f.on && f.car === c) fFree(f); dropCar(c); }
  }
  if (out) for (const f of SQ.f) if (f.on) fStep(f, dt);
  // 搶劫隊友：只在戶外跟著；人進了室內就先藏起來
  if (!out) for (const f of SQ.f) if (f.on) fighters.place(f.k, 0, -60, 0, 0);
  defHud();
}
// 測試與 HUD 之外，任何時候都可以一次清掉（測試 API、讀檔）
function squadClear() {
  if (SQ.def) defEnd();
  SQ.chase = null;
  if (SQ.merc) mercEnd();
  for (const f of SQ.f) if (f.on && f.team !== 'crew') fFree(f);
  for (const c of [...SQ.cars]) dropCar(c);
}

// ─── 小地圖與大地圖：敵方紅點、友軍綠點、被盯上的資產 ───
function squadMini(ctx, P2, zoom) {
  for (const c of SQ.cars) if (!c.v.dead && c.v !== player.veh) { const [x, y] = P2(c.v.x, c.v.z), s = 9 / zoom * 1.4; ctx.fillStyle = c.team === 'gang' ? GANG_COL : ALLY_COL; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
  for (const f of SQ.f) if (fUp(f)) { const [x, y] = P2(f.x, f.z); ctx.fillStyle = fAlly(f) ? ALLY_COL : GANG_COL; ctx.beginPath(); ctx.arc(x, y, 3 / zoom * 1.4, 0, 7); ctx.fill(); }
  const D = SQ.def;
  if (D && Math.sin(uTimeNow() * 5) > -.3) { const [x, y] = P2(D.x, D.z); ctx.strokeStyle = GANG_COL; ctx.lineWidth = 3 / zoom; ctx.beginPath(); ctx.arc(x, y, 14 / zoom * 1.4, 0, 7); ctx.stroke(); }
}
function squadBig(c, X, Z, s) {
  const D = SQ.def;
  if (D) { c.strokeStyle = GANG_COL; c.lineWidth = 3 / s; c.beginPath(); c.arc(X(D.x), Z(D.z), 14 / s, 0, 7); c.stroke(); }
  for (const q of SQ.cars) if (!q.v.dead) { c.fillStyle = q.team === 'gang' ? GANG_COL : ALLY_COL; c.fillRect(X(q.v.x) - 5 / s, Z(q.v.z) - 5 / s, 10 / s, 10 / s); }
}

// 測試 API（window.__nc.gta.squad）
const squadApi = {
  SQ, fighters, chase: why => gangChase(why || 'truck'), merc: () => { phone.cd.merc = 0; motors.cash = Math.max(motors.cash, MERC_FEE); mercCall(); return !!SQ.merc; },
  defend: id => defStart(id), clear: squadClear, spawn: (team, x, z, gun) => !!fSpawn(team, x, z, 0, { gun }),
  count: team => SQ.f.filter(f => f.on && (!team || f.team === team) && f.state !== 'down').length,
  win: () => SQ.def && defWin(), lose: () => SQ.def && defLose('測試'),
};
