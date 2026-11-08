// 射擊：散布、30 發固定彈道、牆面 raycast、11 部位膠囊命中、護甲穿透。
import { G, WEAPONS } from './state.js';
import { TMP_VEC3_A, TMP_VEC3_B } from '../core/tmp.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { HB_N, hbGroup, refreshCapsules, gunMuzzle } from './soldiers.js';
import { impact, blood, sparks, addTracer, muzzle } from '../fx/particles.js';
import { play as sfx } from '../audio/sfx.js';
import { NEW_GUNS } from './guns/index.js';
import { RELOAD_CUE, AFTER_SHOT, SHELL_LAST } from '../audio/cues.js';

const MZ = new Vector3();
const REC_N = 100;   // 彈道表長度：最長的彈匣是 N9 的 100 發
// 固定彈道：原創的「上爬後向右、再向左」曲線，單位弧度。第 i 發是相對第 0 發的累積偏移。30 發以後高度與擺幅不再增加，只繼續左右掃
function pattern(climb, sway, phase) {
  const t = new Float32Array(REC_N * 2); let p = 0, y = 0;
  for (let i = 1; i < REC_N; i++) {
    p += climb * (i < 10 ? 1 : i < 30 ? 0.14 : 0); const u = i - 8;
    y = i < 8 ? sway * 0.25 * Math.sin(i * 0.9 + phase) : sway * Math.sin(u * 0.33 + phase) * (1 + Math.min(u, 21) * 0.03);
    t[i * 2] = p; t[i * 2 + 1] = y;
  }
  return t;
}
const REC = { ar5: pattern(0.0165, 0.042, 0), ks: pattern(0.0195, 0.055, 2.4), smg: pattern(0.011, 0.03, 1.1) };
for (const g of NEW_GUNS) if (g.recoil) REC[g.rec] = pattern(...g.recoil);

export const world = { ctx: null, agents: null, onKill: null, net: null };   // net：連線時 src/net/sync.js 掛上的掛鉤（主機廣播、客戶端回報），單機是 null
const from = TMP_VEC3_A, to = TMP_VEC3_B;

export function resetWeaponState(a) { a.fireT = 0; a.reloadT = 0; a.afterT = 0; a.burst = 0; a.burstT = 0; a.recT = 0; a.landT = 0; a.inaccuracy = 0; }
export const LAND_T = 0.32;   // 落地後散布回復時間
/** 目前的散布半徑（弧度）：武器基礎、蹲姿、移動、空中、落地。fire() 與動態準星共用同一個數字。
 *  移動是連續曲線：最高速 30% 以下不加（急停、蹲走），之後依 t^1.5 長到跑步時的舊值（0.012 + 速度 × 0.012），靜步約是跑步的五分之一。 */
export function spreadOf(a) {
  const w = WEAPONS[a.cur]; if (!w || w.nade || !(w.range > 3)) return 0;
  let s = w.spread * (a.crouch ? 0.6 : 1);
  // 開鏡要穩一下才準：scopeT 0→1（loop.js 依 SCOPE_IN 累加），散布從腰射值平滑收到開鏡值。bot 不切開鏡狀態，買了狙擊槍就當開鏡打
  if (w.scope && !a.bot) { if (!a.scoped) s = w.hipSpread; else { const t = Math.min(1, a.scopeT ?? 1), k = t * t * (3 - 2 * t); s = w.hipSpread + (s - w.hipSpread) * k; } }
  const v = Math.hypot(a.vx, a.vz);
  if (!a.ground) s += 0.092 + v * 0.012;
  else {
    const mx = maxSpeed(a), t = Math.max(0, Math.min(1, (v - mx * 0.3) / (mx * 0.7)));
    if (t > 0) s += (0.012 + v * 0.012) * t * Math.sqrt(t);
    if (a.landT > 0) s += 0.035 * a.landT / LAND_T;
  }
  return s;
}
/** 停火多久後彈道索引開始往回退（比射擊間隔多 0.05 s，連射時不會退），之後每秒退幾發。 */
const recDelay = w => 60 / w.rpm + 0.05, REC_RATE = 25;
export function giveWeapon(a, id) {
  const w = WEAPONS[id]; if (!w) return;
  if (w.slot === 1) a.primary = id; else if (w.slot === 2) a.secondary = id;
  a.ammo[id] = w.mag; a.rsv[id] = w.rsv;
}
/** 拔槍時間：拔出前不能開火、開鏡、投擲（切槍時寫進 fireT）。第一人稱舉槍動畫也用它。 */
export function drawTime(w) {
  if (!w) return 0.35;
  return w.draw ?? (w.slot === 3 ? 0.3 : w.slot === 2 ? (w.dmg > 45 ? 0.55 : 0.45) : w.nade || w.id === 'charge' ? 0.4 : w.scope ? 0.9 : w.id === 'n9' ? 1 : w.pellets ? 0.65 : 0.6);
}
/** Bot 換手上的武器：換彈中斷、等拔槍時間。 */
export function equip(a, id) { if (!id || a.cur === id) return; a.cur = id; a.reloadT = 0; a.fireT = Math.max(a.fireT, drawTime(WEAPONS[id])); }
/** 閉鎖式槍機：彈匣沒打空就換彈，膛內還留一發（30+1）。開放式槍機的機槍與單發裝填的霰彈槍沒有。 */
const chamber = w => !w.shell && w.id !== 'n9' && w.mag > 0;
const BOLT_CUE = { bolt_r: 1, bolt_s: 1, slide_p: 1, cycle_a: 1, cycle_b: 1 };   // 戰術換彈不用拉機柄、放滑套
export const TAC_K = 0.85;   // 戰術換彈時間 = 空倉換彈 × 0.85
export function maxSpeed(a) { const w = WEAPONS[a.cur]; return 5.4 * (w?.speedK ?? 1); }

/** 射線對膠囊：回傳 t（公尺），未中 -1。 */
// 玩家沒有世界裡的士兵（第一人稱不畫自己），用四段膠囊當命中範圍：頭、胸、腹、腿，索引就是傷害分區
const BODY = new Float32Array(4 * 7);
const LAST = { x: 0, y: 0, z: 0, v: 0 };   // 最後一顆彈丸的落點（連線廣播用）
function bodyCaps(v) {
  const x = v.x, y = v.y, z = v.z, e = v.eye;
  const seg = (k, y0, y1, r) => { const o = k * 7; BODY[o] = x; BODY[o + 1] = y + y0; BODY[o + 2] = z; BODY[o + 3] = x; BODY[o + 4] = y + y1; BODY[o + 5] = z; BODY[o + 6] = r; };
  seg(0, e - 0.03, e + 0.1, 0.105); seg(1, e - 0.5, e - 0.17, 0.21); seg(2, e - 0.72, e - 0.52, 0.18); seg(3, 0.08, e - 0.76, 0.17);
}

function rayCapsule(ox, oy, oz, dx, dy, dz, c, o, maxT) {
  const ax = c[o], ay = c[o + 1], az = c[o + 2], bx = c[o + 3], by = c[o + 4], bz = c[o + 5], r = c[o + 6];
  const abx = bx - ax, aby = by - ay, abz = bz - az, aox = ox - ax, aoy = oy - ay, aoz = oz - az;
  const baba = abx * abx + aby * aby + abz * abz, bard = abx * dx + aby * dy + abz * dz, baoa = abx * aox + aby * aoy + abz * aoz, rdoa = dx * aox + dy * aoy + dz * aoz, oaoa = aox * aox + aoy * aoy + aoz * aoz;
  const A = baba - bard * bard, B = baba * rdoa - baoa * bard, C = baba * oaoa - baoa * baoa - r * r * baba;
  if (A > 1e-7) {
    const h = B * B - A * C; if (h < 0) { /* 可能中端球 */ }
    else { const t = (-B - Math.sqrt(h)) / A, y = baoa + t * bard; if (y > 0 && y < baba) return t >= 0 && t <= maxT ? t : -1; }
  }
  for (let e = 0; e < 2; e++) {
    const cx = e ? bx : ax, cy = e ? by : ay, cz = e ? bz : az, lx = ox - cx, ly = oy - cy, lz = oz - cz;
    const b = lx * dx + ly * dy + lz * dz, cc = lx * lx + ly * ly + lz * lz - r * r, h = b * b - cc;
    if (h > 0) { const t = -b - Math.sqrt(h); if (t >= 0 && t <= maxT) return t; }
  }
  return -1;
}

/** 視線：回傳 true 表示 a 點看得到 b 點（中間沒有牆）。 */
export function clear(ax, ay, az, bx, by, bz) {
  from.copyFromFloats(ax, ay, az); to.copyFromFloats(bx, by, bz);
  return !world.ctx.ray(from, to).hasHit;
}

function shootOne(a, w, ox, oy, oz, dx, dy, dz, tracer, cam) {
  const range = w.range;
  from.copyFromFloats(ox, oy, oz); to.copyFromFloats(ox + dx * range, oy + dy * range, oz + dz * range);
  const hit = world.ctx.ray(from, to);
  let wall = range, nx = 0, ny = 1, nz = 0, mat = 0;
  if (hit.hasHit) { wall = hit.hitDistance; nx = hit.hitNormalWorld.x; ny = hit.hitNormalWorld.y; nz = hit.hitNormalWorld.z; mat = world.ctx.surf?.[hit.triangleIndex] ?? 0; }
  let best = wall, victim = null, part = 0;
  const ag = world.agents;
  for (let i = 0; i < ag.length; i++) {
    const v = ag[i]; if (v === a || !v.alive || v.team === a.team) continue;
    const ex = v.x - ox, ez = v.z - oz, along = ex * dx + ez * dz, px = ex - dx * along, pz = ez - dz * along;
    if (px * px + pz * pz > 2.2 || along > best + 1) continue;  // 粗篩
    const s = v.soldier;
    if (s) {
      refreshCapsules(s);
      for (let k = 0; k < HB_N; k++) { const t = rayCapsule(ox, oy, oz, dx, dy, dz, s.caps, k * 7, best); if (t >= 0) { best = t; victim = v; part = k; } }
    } else {
      bodyCaps(v);
      for (let k = 0; k < 4; k++) { const t = rayCapsule(ox, oy, oz, dx, dy, dz, BODY, k * 7, best); if (t >= 0) { best = t; victim = v; part = -1 - k; } }
    }
  }
  const hx = ox + dx * best, hy = oy + dy * best, hz = oz + dz * best;
  LAST.x = hx; LAST.y = hy; LAST.z = hz; LAST.v = victim ? 1 : 0;
  // 連線的客戶端：傷害由主機算，這裡只回報打中誰、哪個部位，畫面先噴血、亮命中標記
  if (victim && world.net?.client) { if (a === G.me) { world.net.hit(a, victim, part < 0 ? -1 - part : hbGroup(part), w, hx, hy, hz); G.hitMark = 1; } blood(hx, hy, hz); }
  else if (victim) { if (damage(a, victim, w, part < 0 ? -1 - part : hbGroup(part), hx, hy, hz)) sparks(hx, hy, hz, dx, dy, dz); else blood(hx, hy, hz); }
  else if (hit.hasHit) impact(hx, hy, hz, nx, ny, nz, mat);
  if (tracer) addTracer(ox + dx * 1.2, oy + dy * 1.2 - 0.06, oz + dz * 1.2, hx, hy, hz, cam.x, cam.y, cam.z);
  return victim;
}

/** group：0 頭 1 胸臂 2 腹 3 腿。回傳 true 表示打在頭盔上（火花代替血霧）。 */
export function damage(a, v, w, group, x, y, z) {
  let dmg = group === 0 ? w.head : group === 2 ? w.dmg * 1.25 : group === 3 ? w.dmg * 0.75 : w.dmg;
  const protectedByArmor = v.armor > 0 && (group === 1 || group === 2 || (group === 0 && v.helmet));
  if (protectedByArmor) { const blocked = dmg * (1 - w.pen); v.armor = Math.max(0, v.armor - blocked * 0.5); dmg -= blocked; }
  if (group === 3) v.slowT = 0.6;
  // 爆頭：有頭盔是金屬鏗聲，沒有是短促的悶響。射手是玩家時不衰減，在耳邊響；其他人照位置
  const helm = group === 0 && protectedByArmor;
  if (group === 0 && v.alive) { if (a === G.me) sfx(helm ? 'helmet' : 'head'); else sfx(helm ? 'helmet' : 'head', x, y, z); }
  hurt(v, dmg, a, w.id, group === 0, x, z);
  if (a === G.me) G.hitMark = group === 0 ? 2 : 1;
  return helm;
}

export function hurt(v, dmg, a, weaponId, head, x, z) {
  if (!v.alive) return;
  if (a && a.team !== v.team) a.rd += Math.min(v.hp, dmg);
  v.hp = Math.max(0, v.hp - dmg);
  v.slowT = Math.max(v.slowT, 0.35); v.hitT = 0.33;
  if (v === G.me) {
    G.dmgDir = Math.atan2((x ?? v.x) - v.x, (z ?? v.z) - v.z) - v.yaw; G.dmgT = 1; sfx('hit', v.x, v.y, v.z);
    G.punch = Math.min(0.04, G.punch + Math.min(0.025, dmg * 0.0008) * (v.armor > 0 ? 0.55 : 1));   // 中彈視角上抬，有甲較小；loop.js 衰減，鏡頭和子彈都加
  }
  // Bot 被打：記下打的人在哪，沒有目標時會轉過去找（bots.js 的 suspect）
  else if (v.bot && a && a.team !== v.team) { const b = v.bot; b.sx = a.x; b.sy = a.y; b.sz = a.z; b.sT = 3; b.sKind = 1; }
  world.net?.hurt(v, dmg, a, x, z);
  if (v.hp <= 0) world.onKill?.(a, v, weaponId, head);
}

/** a 開一槍。dirYaw/dirPitch 是準星方向（已含後座）。回傳是否發射。 */
export function fire(a, yaw, pitch, cam) {
  const w = WEAPONS[a.cur];
  if (!w || w.nade || w.id === 'charge') return false;
  if (a.fireT > 0) return false;
  if (a.reloadT > 0) { if (w.shell && (a.ammo[a.cur] | 0) > 0) a.reloadT = 0; else return false; }   // 單發裝填可以用開火中斷
  if (w.mag > 0 && (a.ammo[a.cur] | 0) <= 0) { a.fireT = 0.3; if (a === G.me) sfx(w.slot === 2 ? 'empty_p' : 'empty_r', a.x, a.y, a.z); return false; }
  // 射速：64 Hz tick 會把間隔進位到整數 tick（700 rpm 變 640），上一 tick 內到期的餘數帶到下一發
  a.fireT = (a.fireT > -1 / 64 ? a.fireT : 0) + 60 / w.rpm;
  if (w.mag > 0) a.ammo[a.cur]--;
  const spread = spreadOf(a);
  const n = w.pellets ?? 1, ox = a.x, oy = a.y + a.eye, oz = a.z;
  const rec = REC[w.rec], b = Math.min(a.burst | 0, REC_N - 1);
  const rp = rec ? rec[b * 2] : 0, ry = rec ? rec[b * 2 + 1] : 0;
  let hitAny = false;
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(Math.random()) * spread, th = Math.random() * 6.283;
    const y = yaw + ry + Math.cos(th) * r, p = pitch + rp + Math.sin(th) * r, cp = Math.cos(p);
    const dx = Math.sin(y) * cp, dy = Math.sin(p), dz = Math.cos(y) * cp;
    if (w.range < 3) { const v = melee(a, w, ox, oy, oz, dx, dy, dz); hitAny = hitAny || !!v; continue; }
    hitAny = !!shootOne(a, w, ox, oy, oz, dx, dy, dz, i === 0, cam) || hitAny;
  }
  a.shots++; if (hitAny) a.hits++;   // 命中率統計（tools/balance.mjs）：一次扣扳機算一發，霰彈任一顆打中就算
  a.burst = (a.burst | 0) + 1; a.burstT = 0.32; a.recT = 0;
  if (w.range > 3) {
    const sy = Math.sin(yaw), cy = Math.cos(yaw), cp = Math.cos(pitch);
    if (a !== G.me) {
      if (a.soldier && gunMuzzle(a.soldier, a.cur, MZ)) muzzle(MZ.x, MZ.y, MZ.z, sy * cp, Math.sin(pitch), cy * cp, 0.8);
      else muzzle(ox + sy * cp * 0.75 + cy * 0.15, oy - 0.12 + Math.sin(pitch) * 0.75, oz + cy * cp * 0.75 - sy * 0.15, sy * cp, Math.sin(pitch), cy * cp, 0.8);
    }
    sfx('shot_' + w.id, a.x, a.y + 1.4, a.z);
    const af = AFTER_SHOT[w.id]; if (af) { a.afterT = af[0]; a.afterId = w.id; }
  } else sfx('knife', a.x, a.y, a.z);
  world.net?.shot(a, w.id, LAST.x, LAST.y, LAST.z, LAST.v);   // 連線：主機廣播、客戶端回報給主機
  return true;
}

/** 連線：別人開的槍只演出來（槍口火光、彈道、彈著、聲音），傷害由主機算好另外送。h 是第一顆彈丸的落點，hitAgent 表示打在人身上。 */
const SFX_A = new Vector3(), SFX_B = new Vector3();
export function shotFx(a, wid, hx, hy, hz, hitAgent, cam) {
  const w = WEAPONS[wid]; if (!w) return;
  a.burstT = 0.32; a.shots++;
  if (w.range < 3) { sfx('knife', a.x, a.y, a.z); if (hitAgent) blood(hx, hy, hz); return; }
  let ox = a.x, oy = a.y + a.eye, oz = a.z;
  const dx0 = hx - ox, dy0 = hy - oy, dz0 = hz - oz, L = Math.hypot(dx0, dy0, dz0) || 1, dx = dx0 / L, dy = dy0 / L, dz = dz0 / L;
  if (a.soldier && gunMuzzle(a.soldier, wid, MZ)) { muzzle(MZ.x, MZ.y, MZ.z, dx, dy, dz, 0.8); ox = MZ.x; oy = MZ.y; oz = MZ.z; }
  else muzzle(ox + dx * 0.75, oy - 0.12 + dy * 0.75, oz + dz * 0.75, dx, dy, dz, 0.8);
  if (hitAgent) blood(hx, hy, hz);
  else {   // 彈著點的法線與材質：沿彈道往前多掃 0.3 m
    SFX_A.set(a.x, a.y + a.eye, a.z); SFX_B.set(hx + dx * 0.3, hy + dy * 0.3, hz + dz * 0.3);
    const h = world.ctx.ray(SFX_A, SFX_B);
    if (h.hasHit) impact(h.hitPointWorld.x, h.hitPointWorld.y, h.hitPointWorld.z, h.hitNormalWorld.x, h.hitNormalWorld.y, h.hitNormalWorld.z, world.ctx.surf?.[h.triangleIndex] ?? 0);
  }
  if (cam) addTracer(ox + dx * 0.4, oy + dy * 0.4, oz + dz * 0.4, hx, hy, hz, cam.x, cam.y, cam.z);
  sfx('shot_' + wid, a.x, a.y + 1.4, a.z);
}

function melee(a, w, ox, oy, oz, dx, dy, dz) { return shootOne(a, w, ox, oy, oz, dx, dy, dz, false, null); }

export function startReload(a) {
  const w = WEAPONS[a.cur];
  const n = a.ammo[a.cur] | 0, ch = !!w && chamber(w);
  if (!w || !w.mag || a.reloadT > 0 || n >= w.mag + (ch && n > 0 ? 1 : 0) || (a.rsv[a.cur] | 0) <= 0) return false;
  // 空倉換彈要拉機柄（時間照原表），沒打空是戰術換彈：快一點、少拉一次機柄，裝完膛內多一發
  a.reloadTac = ch && n > 0;
  a.reloadT = a.reloadDur = w.shell ?? w.reload * (a.reloadTac ? TAC_K : 1); a.cueI = 0; if (a === G.me && w.shell) sfx('shell', a.x, a.y, a.z);
  return true;
}

export function tickWeapon(a, dt) {
  if (a.fireT > 0) a.fireT -= dt;
  if (a.burstT > 0) a.burstT -= dt;   // burstT 只代表「0.32 s 內開過槍」（Bot 聽覺、第三人稱持槍姿勢）
  if (a.landT > 0) a.landT -= dt;
  // 後座回復：停火一下後彈道索引逐發往回退，不是過了 0.32 s 一口氣歸零。點放間隔夠長就回到第一發，短點放會慢慢累積
  if (a.burst > 0) { a.recT += dt; const w = WEAPONS[a.cur]; if (!w?.rpm || a.recT > recDelay(w)) a.burst = Math.max(0, a.burst - REC_RATE * dt); }
  if (a.afterT > 0) {   // 栓動與泵動：換了槍就不響
    a.afterT -= dt;
    if (a.afterT <= 0 && a.afterId === a.cur) { const af = AFTER_SHOT[a.cur]; sfx(af[1], a.x, a.y + 1.2, a.z, af[2]); }
  }
  if (a.reloadT > 0) {
    a.reloadT -= dt;
    if (a === G.me) {   // 換彈分段依進度觸發，換槍中斷時 reloadT 歸零就不再響
      const w = WEAPONS[a.cur], cue = w && !w.shell && RELOAD_CUE[w.id];
      if (cue) { const u = 1 - a.reloadT / a.reloadDur; while (a.cueI < cue.length && u >= cue[a.cueI][0]) { const c = cue[a.cueI++]; if (!(a.reloadTac && BOLT_CUE[c[1]])) sfx(c[1], a.x, a.y, a.z, c[2]); } }
    }
    if (a.reloadT <= 0) {
      const w = WEAPONS[a.cur], need = w.mag + (a.reloadTac ? 1 : 0) - a.ammo[a.cur], got = w.shell ? 1 : Math.min(need, a.rsv[a.cur]); a.ammo[a.cur] += got; a.rsv[a.cur] -= got;
      if (w.shell && need > 1 && a.rsv[a.cur] > 0) { a.reloadT = w.shell; if (a === G.me) sfx('shell', a.x, a.y, a.z); }
      else if (w.shell && a === G.me && SHELL_LAST[w.id]) sfx(SHELL_LAST[w.id][0], a.x, a.y, a.z, SHELL_LAST[w.id][1]);
    }
  }
  if (a.slowT > 0) a.slowT -= dt;
}

export function recoilOf(a) { const w = WEAPONS[a.cur], rec = w && REC[w.rec]; if (!rec || a.burst <= 0) return 0; return Math.min(a.burst - 1, REC_N - 1); }
export const RECOIL_LAST = REC_N - 1;
export function recoilTable(a) { const w = WEAPONS[a.cur]; return w ? REC[w.rec] : null; }
