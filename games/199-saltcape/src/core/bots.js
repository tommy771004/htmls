// AI 玩家：挑落點跳傘、搜刮、往安全區移動、看見敵人就交戰。輸出與真人相同的按鍵輸入。
import { mulberry32 } from './rng.js';
import { lineClear, terrainAt } from './physics.js';
import { MODE, planePos, eyeHeight } from './player.js';
import { WEAPONS, BITS, decodeLoot, AMMO, PLATE_INV_MAX, magOf } from './rules.js';
import { stormRemaining } from './storm.js';

const NAMES = ['阿杰', 'Kestrel', '小鹿', 'Moray', '鐵蛋', 'Juniper', '阿芳', 'Osprey', '黑糖', 'Vesper', '老K', 'Talon', '米粒', 'Cinder', '阿翔', 'Harrow',
  '海膽', 'Quill', '豆花', 'Rook', '阿龍', 'Sable', '芭樂', 'Wren', '肉圓', 'Flint', '小傑', 'Marlin', '鹹酥', 'Ember', '阿宏', 'Basalt',
  '石頭', 'Lark', '珍奶', 'Gannet', '阿明', 'Pike', '布丁', 'Thorn', '花枝', 'Sorrel', '大頭', 'Kite', '烏魚', 'Ash', '阿美', 'Dune',
  '仙草', 'Grebe', '阿財', 'Slate', '虱目', 'Heron', '小強', 'Cobalt', '蚵仔', 'Plover', '阿土', 'Sumac'];
export function botName(i) { return NAMES[i % NAMES.length] + (i >= NAMES.length ? String(Math.floor(i / NAMES.length) + 1) : ''); }

export function initBot(p, m) {
  const r = mulberry32((m.seed ^ (p.id * 2654435761)) >>> 0);
  // 落點：偏好命名地點，也有人跳郊外
  const towns = m.W.towns;
  let tx, tz;
  // 落點直接挑一棟建築（大城鎮建築多，自然比較熱門），門口前方落地
  const b = m.W.buildings[Math.floor(r() * m.W.buildings.length)];
  const d0 = b.doors[0];
  if (d0 && r() < 0.85) { tx = d0[0] + d0[2] * 3; tz = d0[1] + d0[3] * 3; }
  else { const t = towns[Math.floor(r() * towns.length)]; const a = r() * 6.283, d = r() * t.r; tx = t.x + Math.cos(a) * d; tz = t.z + Math.sin(a) * d; }
  p.ai = {
    r, skill: 0.35 + r() * 0.6, react: 0.45 + r() * 0.55, drop: { x: tx, z: tz },
    state: 'drop', goal: null, path: [], think: 0, target: -1, seenT: 0, engageT: 0, burst: 0, strafe: 1, strafeT: 0,
    lootId: 0, lootT: 0, stuckT: 0, stuckCheck: 0, stuckN: 0, route: null, lastPos: [p.x, p.z], side: 0, sideT: 0, hurtBy: -1, hurtT: -99, wander: null, yawS: 0, pitchS: 0, crouchT: 0, tap: 0,
  };
}

const effRange = (w) => ({ p9: 45, smg: 55, ar: 150, sg: 22, dmr: 230, sr: 320 })[w] || 50;

function yawTo(dx, dz) { return Math.atan2(-dx, -dz); }

function inBuilding(W, x, z) {
  for (const b of W.buildings) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b;
  return null;
}

// 若目標在建築內，先走到門外、再穿過門
function planPath(p, W, gx, gz) {
  const b = inBuilding(W, gx, gz), mine = inBuilding(W, p.x, p.z);
  const path = [];
  if (mine && mine !== b && mine.doors.length) {
    const d = nearestDoor(mine, p.x, p.z);
    path.push([d[0] - d[2] * 1.2, d[1] - d[3] * 1.2], [d[0] + d[2] * 1.6, d[1] + d[3] * 1.6]);
  }
  if (b && b !== mine && b.doors.length) {
    const d = nearestDoor(b, p.x, p.z);
    path.push([d[0] + d[2] * 1.8, d[1] + d[3] * 1.8], [d[0] - d[2] * 1.4, d[1] - d[3] * 1.4]);
  }
  path.push([gx, gz]);
  return path;
}
function nearestDoor(b, x, z) {
  let best = b.doors[0], bd = 1e9;
  for (const d of b.doors) { const dd = (d[0] - x) ** 2 + (d[1] - z) ** 2; if (dd < bd) { bd = dd; best = d; } }
  return best;
}

function needs(p) {
  const s0 = p.slots[0], s1 = p.slots[1];
  const hasPrimary = (s0 && s0[0] !== 'p9') || (s1 && s1[0] !== 'p9');
  return { weapon: !s1 || !hasPrimary, plates: p.pinv < 3, vest: p.vest < 3 };
}

function wantLoot(p, it) {
  const d = decodeLoot(it.code), n = needs(p);
  if (d.kind === 'w') {
    const empty = p.slots.some((s) => !s);
    if (d.w === 'p9') return empty && !p.slots.some((s) => s) ? 3 : 0;
    const score = (s) => (s ? (s[0] === 'p9' ? 0 : 2 + s[1]) : -1);
    const worst = Math.min(score(p.slots[0]), score(p.slots[1]));
    if (empty) return 3 + d.r;
    return 2 + d.r > worst + 0.5 ? (n.weapon ? 3 + d.r : 1.5) : 0;
  }
  if (d.kind === 'a') return p.slots.some((s) => s && WEAPONS[s[0]].ammo === d.a) && p.ammo[d.a] < AMMO[d.a].cap * 0.5 ? 2 : 0;
  if (d.kind === 'p') return p.pinv < PLATE_INV_MAX ? 2 : 0;
  if (d.kind === 'v') return d.lv > p.vest ? 3 : 0;
  return 0;
}

export function botThink(p, m) {
  const A = p.ai, W = m.W, r = A.r, t = m.time;
  const inp = { b: 0, yaw: p.yaw, pitch: p.pitch, u: 0, vt: m.tick };
  if (p.mode === MODE.PLANE) {
    const pp = planePos(m.plane, t);
    const dx = A.drop.x - pp.x, dz = A.drop.z - pp.z;
    // 運輸機航線上離落點最近時跳
    const along = dx * pp.dx + dz * pp.dz;
    if ((along < 40 && pp.u > 0.08) || pp.u > 0.92) inp.b |= BITS.JUMP;
    return inp;
  }
  if (p.mode === MODE.FALL || p.mode === MODE.CHUTE) {
    const dx = A.drop.x - p.x, dz = A.drop.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
    inp.yaw = yawTo(dx, dz);
    if (d > 40) inp.b |= BITS.FWD;
    if (p.mode === MODE.FALL && d < 250 && p.y - terrainAt(W, p.x, p.z) < 260 && r() < 0.05) inp.b |= BITS.JUMP;
    return inp;
  }
  // ---- 地面 ----
  const eye = p.y + eyeHeight(p);
  // 目標搜尋
  if (t >= A.think) {
    A.think = t + 0.25 + r() * 0.15;
    const s = p.slots[p.cur];
    let range = Math.max(...p.slots.map((x) => (x ? (x[0] === 'p9' ? 26 : effRange(x[0])) : 20))) * (0.7 + A.skill * 0.5);
    // 剛落地先搜刮，除非貼臉或被打
    if (t - p.dropT < 45 && t - A.hurtT > 3) range = Math.min(range, 16);
    let best = null, bd = 1e9;
    for (const o of m.players) {
      if (o === p || o.mode === MODE.DEAD || o.mode === MODE.SPECT || o.mode === MODE.PLANE) continue;
      const dx = o.x - p.x, dz = o.z - p.z, d2 = dx * dx + dz * dz;
      const lim = o.id === A.hurtBy && t - A.hurtT < 3 ? range * 1.6 : range;
      if (d2 > lim * lim || d2 >= bd) continue;
      // 視野：前方 140°，被打時全向
      const fy = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), dd = Math.sqrt(d2) || 1;
      if ((dx * fy + dz * fz) / dd < -0.35 && !(o.id === A.hurtBy && t - A.hurtT < 3) && dd > 12) continue;
      if (!lineClear(W, p.x, eye, p.z, o.x, o.y + (o.mode === MODE.GROUND ? 1.3 : 0.8), o.z)) continue;
      best = o; bd = d2;
    }
    if (best) {
      if (A.target !== best.id) { A.target = best.id; A.seenT = t; A.engageT = t; }
      A.lastSeen = t; A.tx = best.x; A.tz = best.z;
    } else if (A.target >= 0 && t - (A.lastSeen || 0) > 2.5) A.target = -1;
    void s;
  }
  const T = A.target >= 0 ? m.byId.get(A.target) : null;
  const engaged = T && T.mode !== MODE.DEAD && t - (A.lastSeen || 0) < 0.6;
  // 依距離換槍
  if (engaged) {
    const d = Math.hypot(T.x - p.x, T.z - p.z);
    let bestSlot = p.cur, bestScore = -1;
    p.slots.forEach((s, i) => {
      if (!s) return;
      const er = effRange(s[0]);
      const score = (s[2] > 0 || p.ammo[WEAPONS[s[0]].ammo] > 0 ? 1 : 0) * (d < er ? 2 + s[1] * 0.3 + (s[0] === 'p9' ? -1 : 0) : 1 - d / (er * 4));
      if (score > bestScore) { bestScore = score; bestSlot = i; }
    });
    if (bestSlot !== p.cur && p.rt <= 0) inp.b |= bestSlot === 0 ? BITS.SLOT1 : BITS.SLOT2;
  }
  let moveTo = null;
  const st = m.storm, safe = st.next || st.cur;
  const dSafe = Math.hypot(p.x - safe.x, p.z - safe.z);
  const stormUrgent = Math.hypot(p.x - st.cur.x, p.z - st.cur.z) > st.cur.r - 15 || (dSafe > safe.r * 0.85 && stormRemaining(st, t) < 40 + dSafe / 5);
  if (engaged) {
    const s = p.slots[p.cur];
    const dx = T.x - p.x, dz = T.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
    const ty = T.y + (T.mode === MODE.GROUND ? (T.cr ? 0.85 : 1.25) : 0.8);
    // 瞄準誤差：交戰越久越準
    const eng = t - A.engageT;
    const err = (0.11 - Math.min(0.08, eng * 0.03 * A.skill)) * (1.25 - A.skill * 0.6) * (1 + (p.spr ? 1 : 0));
    A.wob = (A.wob || 0) + 0.21;
    const lead = 0.12;
    const aimYaw = yawTo(dx + T.vx * lead, dz + T.vz * lead) + Math.sin(A.wob * 1.3) * err;
    const aimPitch = Math.atan2(ty - eye, d) + Math.cos(A.wob) * err * 0.7;
    // 轉身速度有限
    const turn = (5 + A.skill * 7) / 30;
    let dy = aimYaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    inp.yaw = p.yaw + Math.max(-turn, Math.min(turn, dy));
    inp.pitch = p.pitch + Math.max(-turn, Math.min(turn, aimPitch - p.pitch));
    const onTarget = Math.abs(dy) < 0.15;
    if (s && d > 14 && WEAPONS[s[0]].zoom > 1.3) inp.b |= BITS.ADS;
    else if (s && d > 22) inp.b |= BITS.ADS;
    if (t - A.seenT > A.react && onTarget && s && s[2] > 0) {
      const W2 = WEAPONS[s[0]];
      if (W2.auto) {
        if (A.burst <= 0) A.burst = t + (d > 60 ? 0.35 : 0.8) + r() * 0.4;
        if (t < A.burst) inp.b |= BITS.FIRE; else if (t > A.burst + 0.15 + r() * 0.35) A.burst = 0;
      } else {
        A.tap = (A.tap + 1) % Math.max(2, Math.round(30 * 60 / W2.rpm * (1.15 + (1 - A.skill) * 0.8)));
        if (A.tap === 0) inp.b |= BITS.FIRE;
      }
    }
    if (s && s[2] === 0) inp.b |= BITS.RELOAD;
    // 橫移與蹲
    if (t > A.strafeT) { A.strafe = r() < 0.5 ? -1 : 1; A.strafeT = t + 0.5 + r() * 0.9; A.crouchT = r() < 0.25 * A.skill ? t + 0.8 : 0; }
    inp.b |= A.strafe > 0 ? BITS.RIGHT : BITS.LEFT;
    if (d > effRange(s ? s[0] : 'p9') * 0.8) inp.b |= BITS.FWD;
    else if (d < 6 && s && s[0] !== 'sg') inp.b |= BITS.BACK;
    if (t < A.crouchT) inp.b |= BITS.CROUCH;
    if (stormUrgent) moveTo = [safe.x, safe.z];
  } else {
    // 換彈、上甲
    const s = p.slots[p.cur];
    if (s && s[2] < magOf(s[0], s[1]) * 0.5 && p.ammo[WEAPONS[s[0]].ammo] > 0) inp.b |= BITS.RELOAD;
    if (p.ar < p.vest * 50 && p.pinv > 0 && t - p.lastHit > 1.5) inp.b |= BITS.PLATE;
    if (A.target >= 0 && t - (A.lastSeen || 0) < 6) moveTo = [A.tx, A.tz];
    if (stormUrgent) { moveTo = [safe.x + (r() - 0.5) * 4, safe.z + (r() - 0.5) * 4]; A.lootId = 0; }
    if (!moveTo && t > A.lootT) {
      A.lootT = t + 0.7 + r() * 0.5;
      let best = null, bs = 0;
      for (const it of m.nearLoot(p.x, p.z, 42)) {
        if (it.y > p.y + 1.4 || it.y < p.y - 1.4) continue;
        const w = wantLoot(p, it);
        if (w <= 0) continue;
        const d = Math.hypot(it.x - p.x, it.z - p.z), sc = w / (4 + d);
        if (sc > bs) { bs = sc; best = it; }
      }
      if (best && best.id !== A.lootId) { A.lootId = best.id; A.path = planPath(p, W, best.x, best.z); A.lootSince = t; }
      if (!best) A.lootId = 0;
    }
    if (!moveTo && A.lootId) {
      const it = m.loot.get(A.lootId);
      if (!it || t - A.lootSince > 20) A.lootId = 0;
      else {
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d < 2.2) {
          const dk = decodeLoot(it.code);
          const score = (s) => (s ? (s[0] === 'p9' ? 0 : 2 + s[1]) : -1);
          const worst = score(p.slots[0]) <= score(p.slots[1]) ? 0 : 1;
          if (dk.kind === 'w' && p.slots[0] && p.slots[1] && p.cur !== worst) inp.b |= worst === 0 ? BITS.SLOT1 : BITS.SLOT2;
          else { inp.b |= BITS.USE; inp.u = it.id; }
        }
        moveTo = A.path.length ? A.path[0] : [it.x, it.z];
        if (A.path.length && Math.hypot(A.path[0][0] - p.x, A.path[0][1] - p.z) < 1.2) A.path.shift();
      }
    }
    if (!moveTo) {
      if (!A.wander || Math.hypot(A.wander[0] - p.x, A.wander[1] - p.z) < 4 || t > A.wanderT) {
        const a = r() * 6.283, d = r() * safe.r * 0.7;
        A.wander = [safe.x + Math.cos(a) * d, safe.z + Math.sin(a) * d];
        // 往建築走比較合理
        let bb = null, bd = 1e9;
        for (const b of W.buildings) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, dd = (cx - A.wander[0]) ** 2 + (cz - A.wander[1]) ** 2; if (dd < bd) { bd = dd; bb = b; } }
        if (bb && bd < 200 * 200 && bb.doors.length) { const d0 = bb.doors[0]; A.wander = [d0[0] + d0[2] * 2, d0[1] + d0[3] * 2]; }
        A.wanderT = t + 25 + r() * 20;
      }
      moveTo = A.wander;
    }
    if (moveTo && !A.lootId) moveTo = routeTo(p, A, W, moveTo[0], moveTo[1]);
    if (moveTo) {
      inp.yaw = turnToward(p.yaw, yawTo(moveTo[0] - p.x, moveTo[1] - p.z), 0.18);
      inp.pitch = p.pitch * 0.9;
    }
  }
  if (moveTo && !engaged) {
    const d = Math.hypot(moveTo[0] - p.x, moveTo[1] - p.z);
    if (d > 0.8) { inp.b |= BITS.FWD; if (d > 25 && !A.lootId) inp.b |= BITS.SPRINT; }
  } else if (moveTo && engaged) {
    // 交戰中仍要逃毒：往安全區方向加上前後鍵
    const want = yawTo(moveTo[0] - p.x, moveTo[1] - p.z);
    let dd = want - inp.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    inp.b &= ~(BITS.FWD | BITS.BACK);
    if (Math.abs(dd) < 1.2) inp.b |= BITS.FWD; else if (Math.abs(dd) > 1.9) inp.b |= BITS.BACK;
  }
  // 卡住：側移並跳
  if (inp.b & (BITS.FWD | BITS.BACK)) {
    if (t > A.stuckCheck) {
      const moved = Math.hypot(p.x - A.lastPos[0], p.z - A.lastPos[1]);
      A.lastPos = [p.x, p.z];
      A.stuckCheck = t + 0.8;
      if (moved < 0.6) { A.side = r() < 0.5 ? -1 : 1; A.sideT = t + 0.7 + r() * 0.6; A.route = null; if (A.lootId && r() < 0.4) A.lootId = 0, A.lootT = t + 2; if (++A.stuckN > 4) { A.wander = null; A.stuckN = 0; } } else A.stuckN = 0;
    }
    if (t < A.sideT) { inp.b |= A.side > 0 ? BITS.RIGHT : BITS.LEFT; if (r() < 0.08) inp.b |= BITS.JUMP; }
  } else A.stuckCheck = t + 0.8;
  return inp;
}

// 一般移動目標：若人在建築內而目標在外，先走到門內、門外再前往（路線依目標快取）
function routeTo(p, A, W, gx, gz) {
  const R = A.route;
  if (!R || Math.hypot(R.gx - gx, R.gz - gz) > 12) A.route = { gx, gz, pts: planPath(p, W, gx, gz) };
  const pts = A.route.pts;
  while (pts.length > 1 && Math.hypot(pts[0][0] - p.x, pts[0][1] - p.z) < 1.1) pts.shift();
  return pts[0] || [gx, gz];
}

function turnToward(cur, want, max) {
  let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
  return cur + Math.max(-max, Math.min(max, d));
}
