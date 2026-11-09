// 絕命免運費 · 規則引擎（純邏輯，無 DOM / Three）。
// 所有狀態變化立即套用到 state，並把演出事件推進 state.fx，由畫面層依序播放。
import { GRID, HEROES, HERO_ORDER, ENEMIES, PROPS, LEVELS, LOOT, POWERS, COMMON, bbqMap, TIP_START, TIP_MAX, MENTOS_PER_LEVEL, DEFAULT_CHIPS } from './data.js';

// ── 亂數 ──────────────────────────────────────────────
export function rng(s) {
  // mulberry32
  let t = (s.seed += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const d = (s, n) => 1 + Math.floor(rng(s) * n);
export function parseDice(str) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(str);
  return m ? { n: +m[1], x: +m[2], b: +(m[3] || 0) } : { n: 0, x: 0, b: +str || 0 };
}
export function rollDice(s, str, crit) {
  const p = parseDice(str);
  let t = p.b;
  const n = crit ? p.n * 2 : p.n;
  for (let i = 0; i < n; i++) t += d(s, p.x);
  return Math.max(0, t);
}
export function avgDice(str) { const p = parseDice(str); return p.n * (p.x + 1) / 2 + p.b; }

// ── 狀態建立 ──────────────────────────────────────────
export function newParty() {
  return { tips: TIP_START, loot: [], chips: {}, cleared: 0, bills: 0, droneCharges: 0 };
}
// 直接跳到第 n 關時，補齊前面關卡的戰利品與晶片
export function partyForLevel(idx) {
  const p = newParty();
  let chip = 0;
  for (let i = 0; i < idx; i++) {
    const L = LEVELS[i];
    for (const k of L.loot) if (!p.loot.includes(k)) p.loot.push(k);
    if (L.chip) { const [h, pw] = DEFAULT_CHIPS[chip++]; p.chips[h] = pw; }
    p.tips = Math.min(TIP_MAX, p.tips + 1);
  }
  if (p.loot.includes('sunscreen')) p.droneCharges = 1;
  p.cleared = idx;
  return p;
}

const has = (s, k) => s.party.loot.includes(k);

// 難度：story = 企劃書原始數值；standard / hard 放大敵人血量與命中
export const DIFFS = {
  story:    { name: '企劃原始數值', hp: 1, hit: 0, dmg: 0, text: '完全照企劃書的數字，輕鬆看完 10 關的劇情。' },
  standard: { name: '標準', hp: 1.8, hit: 2, dmg: 2, text: '敵人血量 ×1.8、命中 +2、傷害 +2。要用到高地、背刺和地表連鎖。' },
  hard:     { name: '硬派', hp: 2.4, hit: 3, dmg: 4, text: '敵人血量 ×2.4、命中 +3、傷害 +4。每個附贈動作都要算。' },
};
export function createState(levelIdx, party, seed = 12345, diff = 'standard') {
  const L = LEVELS[levelIdx];
  const rows = L.h === 'bbq' ? bbqMap() : L.h;
  const s = {
    lv: levelIdx, L, seed: seed >>> 0, party: party || partyForLevel(levelIdx),
    grid: [], units: [], props: [], fx: [], round: 0, turn: 0, order: [],
    mentos: MENTOS_PER_LEVEL, flags: {}, over: null, powerUsed: {}, shortRestUsed: false, nextId: 1, diff,
  };
  for (let z = 0; z < GRID; z++) {
    const row = [];
    for (let x = 0; x < GRID; x++) {
      const c = rows[z][x];
      row.push({ x, z, h: c === 'L' || c === '#' ? 0 : +c, lava: c === 'L', void: c === '#', surf: c === 'L' ? { type: 'lava', turns: 0 } : null });
    }
    s.grid.push(row);
  }
  for (const [type, x, z, o] of L.props) addProp(s, type, x, z, o);
  for (const [type, x0, z0, x1 = x0, z1 = z0] of L.surf)
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const t = tile(s, x, z);
      if (t && !t.lava && !t.void && !blockingProp(s, x, z)) t.surf = { type, turns: 0 };
    }
  for (const k of HERO_ORDER) addHero(s, k, ...L.heroes[k]);
  for (const [k, x, z] of L.enemies) addEnemy(s, k, x, z);
  // 初始朝向：英雄朝東、敵人朝西
  for (const u of s.units) u.f = u.side === 'hero' ? [1, 0] : [-1, 0];
  if (has(s, 'sunscreen') && !s.party.droneCharges) s.party.droneCharges = 1;
  return s;
}

function addProp(s, type, x, z, o = {}) {
  const P = PROPS[type];
  const p = { id: 'p' + s.nextId++, type, x, z, w: o.w || 1, d: o.d || 1, hp: P.hp || 0, maxHp: P.hp || 0, alive: true };
  s.props.push(p);
  return p;
}

function addHero(s, k, x, z) {
  const H = HEROES[k];
  const u = {
    id: k, key: k, side: 'hero', name: H.name, icon: '', x, z, f: [1, 0],
    hp: H.hp, maxHp: H.hp, ac: H.ac, dex: H.dex, move: H.move, maxSlots: H.slots, slots: H.slots,
    athletics: H.athletics + (k === 'chad' ? 4 : 0), str: H.str, shoveDef: Math.max(H.str, H.dex),
    st: {}, saves: { s: 0, f: 0 }, downed: false, gone: false, dead: false,
    action: true, bonus: true, reaction: true, moveLeft: 0, noOA: !!H.noOA, range: {},
  };
  // 戰利品
  if (k === 'karen' && has(s, 'segway')) u.move += 1;
  if (k === 'karen' && has(s, 'ruler')) u.range.ranged = 2;
  if (k === 'karen' && has(s, 'tumbler')) { u.ac += 2; u.fireResist = true; }
  if (k === 'dale' && has(s, 'crocs')) { u.move += 1; u.dex += 1; u.slipImmune = true; }
  if (k === 'chad' && has(s, 'skillet')) { u.ac = 20; u.critImmune = true; }
  if (has(s, 'icecream')) { u.maxSlots += 1; u.slots += 1; }
  u.baseAc = u.ac;
  s.units.push(u);
  return u;
}

const bump = (dice, n) => { if (!n) return dice; const p = parseDice(dice); return `${p.n}d${p.x}+${p.b + n}`; };
function addEnemy(s, k, x, z) {
  const D = ENEMIES[k];
  const F = DIFFS[s.diff] || DIFFS.standard;
  const hp = Math.round(D.hp * F.hp);
  const u = Object.assign({}, D, {
    id: k + '_' + s.nextId++, key: k, side: 'enemy', x, z, f: [-1, 0], hp, maxHp: hp, baseAc: D.ac, hit: D.hit + F.hit,
    st: {}, dead: false, downed: false, gone: false, action: true, bonus: true, reaction: true, moveLeft: 0,
    athletics: D.shoveDef, atk: Object.assign({}, D.atk, { dice: bump(D.atk.dice, F.dmg) }), aoe: D.aoe ? Object.assign({}, D.aoe, { dice: bump(D.aoe.dice, F.dmg) }) : null,
  });
  s.units.push(u);
  return u;
}

// ── 查詢 ──────────────────────────────────────────────
export const tile = (s, x, z) => (x >= 0 && z >= 0 && x < GRID && z < GRID ? s.grid[z][x] : null);
export const inBounds = (x, z) => x >= 0 && z >= 0 && x < GRID && z < GRID;
export function propAt(s, x, z) {
  for (const p of s.props) if (p.alive && x >= p.x && x < p.x + p.w && z >= p.z && z < p.z + p.d) {
    if (PROPS[p.type].hang) continue;
    return p;
  }
  return null;
}
export function hangAt(s, x, z) {
  return s.props.find(p => p.alive && PROPS[p.type].hang && x >= p.x && x < p.x + p.w && z >= p.z && z < p.z + p.d) || null;
}
export function blockingProp(s, x, z) { const p = propAt(s, x, z); return p && PROPS[p.type].block ? p : null; }
export const alive = u => !u.dead && !u.gone;
export const standing = u => alive(u) && !u.downed;
export function unitAt(s, x, z) { return s.units.find(u => alive(u) && u.x === x && u.z === z) || null; }
export const unitById = (s, id) => s.units.find(u => u.id === id);
export const heroes = s => s.units.filter(u => u.side === 'hero');
export const enemies = s => s.units.filter(u => u.side === 'enemy' && alive(u));
export function isFoe(a, b) {
  if (!alive(b) || a === b) return false;
  const sa = a.side === 'enemy' && a.st.intern ? 'hero' : a.side;
  const sb = b.side === 'enemy' && b.st.intern ? 'hero' : b.side;
  return sa !== sb;
}
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const udist = (a, b) => dist(a.x, a.z, b.x, b.z);
export function hAt(s, x, z) { const t = tile(s, x, z); return t ? t.h : 0; }
export function effH(s, u) { return Math.min(3, hAt(s, u.x, u.z) + (u.fly ? 1 : 0)); }
export function standable(s, x, z, ignore) {
  const t = tile(s, x, z);
  if (!t || t.void || t.lava) return false;
  if (blockingProp(s, x, z)) return false;
  const o = unitAt(s, x, z);
  return !o || o === ignore;
}

// ── 視線與掩體 ────────────────────────────────────────
export function los(s, ax, az, ah, bx, bz, bh) {
  const n = Math.ceil(dist(ax, az, bx, bz) * 4);
  const y0 = ah + 1.4, y1 = bh + 1.0;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = Math.round(ax + (bx - ax) * t), z = Math.round(az + (bz - az) * t);
    if ((x === ax && z === az) || (x === bx && z === bz)) continue;
    const T = tile(s, x, z);
    if (!T) continue;
    let top = T.h;
    const p = propAt(s, x, z);
    if (p && PROPS[p.type].tall) top += 2.6;
    if (top > y0 + (y1 - y0) * t) return false;
  }
  return true;
}
export function losUnits(s, a, b) { return los(s, a.x, a.z, effH(s, a), b.x, b.z, effH(s, b)); }
export function coverFor(s, att, def) {
  if (udist(att, def) <= 1.5) return null;
  const vx = att.x - def.x, vz = att.z - def.z, vl = Math.hypot(vx, vz);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue;
    const p = propAt(s, def.x + dx, def.z + dz);
    if (!p || !PROPS[p.type].cover) continue;
    const dot = (dx * vx + dz * vz) / (Math.hypot(dx, dz) * vl);
    if (dot >= 0.6) return p;
  }
  return null;
}
export function isBehind(att, tgt) {
  const vx = att.x - tgt.x, vz = att.z - tgt.z, vl = Math.hypot(vx, vz) || 1;
  const fl = Math.hypot(tgt.f[0], tgt.f[1]) || 1;
  return (vx * tgt.f[0] + vz * tgt.f[1]) / (vl * fl) < -0.25;
}
function face(s, u, x, z) {
  const dx = Math.sign(x - u.x), dz = Math.sign(z - u.z);
  if (dx || dz) { u.f = [dx, dz]; s.fx.push({ t: 'face', id: u.id }); }
}

// ── 移動與尋路 ────────────────────────────────────────
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export function stepCost(s, u, x, z) {
  const t = tile(s, x, z);
  if (t.surf && t.surf.type === 'mud' && !u.fly && !u.slipImmune) return 2;
  return 1;
}
function passable(s, u, fx, fz, x, z) {
  const t = tile(s, x, z);
  if (!t || t.void) return false;
  if (t.lava && !u.fly) return false;
  if (blockingProp(s, x, z)) return false;
  if (!u.fly && Math.abs(t.h - hAt(s, fx, fz)) > 1) return false;
  const o = unitAt(s, x, z);
  if (o && o !== u && isFoe(u, o) && !o.downed) return false;
  return true;
}
// 回傳 Map(key -> {x,z,cost,prev})，只含可停留的格子
export function reachable(s, u, budget = u.moveLeft) {
  const key = (x, z) => x + ',' + z;
  const dist0 = new Map([[key(u.x, u.z), { x: u.x, z: u.z, cost: 0, prev: null }]]);
  const open = [dist0.get(key(u.x, u.z))];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    for (const [dx, dz] of DIRS) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (!passable(s, u, cur.x, cur.z, nx, nz)) continue;
      if (dx && dz && (!passable(s, u, cur.x, cur.z, cur.x + dx, cur.z) || !passable(s, u, cur.x, cur.z, cur.x, cur.z + dz))) continue;
      const c = cur.cost + stepCost(s, u, nx, nz);
      if (c > budget) continue;
      const k = key(nx, nz), old = dist0.get(k);
      if (old && old.cost <= c) continue;
      const n = { x: nx, z: nz, cost: c, prev: cur };
      dist0.set(k, n);
      open.push(n);
    }
  }
  for (const [k, n] of dist0) { const o = unitAt(s, n.x, n.z); if (o && o !== u) dist0.delete(k); }
  return dist0;
}
export function pathTo(node) { const p = []; for (let n = node; n; n = n.prev) p.unshift([n.x, n.z]); return p; }

export function moveTo(s, id, x, z) {
  const u = unitById(s, id);
  const r = reachable(s, u);
  const n = r.get(x + ',' + z);
  if (!n || (x === u.x && z === u.z)) return false;
  walk(s, u, pathTo(n), n.cost);
  return true;
}

function walk(s, u, path, cost) {
  const done = [[u.x, u.z]];
  const hitTypes = new Set();
  for (let i = 1; i < path.length; i++) {
    const [nx, nz] = path[i];
    // 借機攻擊：離開敵人近戰範圍
    if (!u.noOA) {
      for (const o of s.units) {
        if (!isFoe(u, o) || !canReact(o)) continue;
        if (udist(o, u) <= 1.5 && dist(o.x, o.z, nx, nz) > 1.5 && Math.abs(effH(s, o) - effH(s, u)) <= 1) {
          s.fx.push({ t: 'move', id: u.id, path: done.slice() });
          done.length = 0; done.push([u.x, u.z]);
          opportunity(s, o, u);
          if (!standing(u)) { u.moveLeft = 0; return; }
        }
      }
    }
    u.moveLeft -= stepCost(s, u, nx, nz);
    face(s, u, nx, nz);
    u.x = nx; u.z = nz;
    done.push([nx, nz]);
    const stop = enterTile(s, u, hitTypes, done);
    if (stop) { u.moveLeft = Math.max(0, u.moveLeft); return; }
  }
  s.fx.push({ t: 'move', id: u.id, path: done });
  u.moveLeft = Math.max(0, u.moveLeft);
}

const canReact = o => standing(o) && o.reaction && !o.st.palpit && !o.st.subpoena && !o.st.stunned && !o.st.boxed && !o.st.distracted;

function opportunity(s, o, u) {
  o.reaction = false;
  const atk = o.side === 'hero' ? HEROES[o.key].skills.melee : (o.atk.range <= 1.5 ? o.atk : null);
  if (!atk) return;
  s.fx.push({ t: 'float', x: o.x, z: o.z, text: '⚖️ 居所防衛法・借機攻擊', cls: 'oa' });
  s.fx.push({ t: 'log', text: `${o.name} 對 ${u.name} 發動借機攻擊！`, cls: 'warn' });
  face(s, o, u.x, u.z);
  resolveSingle(s, o, u, { hit: o.side === 'hero' ? atk.hit : o.hit, dice: atk.dice, kind: 'melee', name: atk.name, type: atk.type || '鈍擊', src: atk });
}

// 進入格子時的地表效果；回傳 true 表示要停下
function enterTile(s, u, hitTypes, done) {
  const t = tile(s, u.x, u.z);
  if (!t.surf || u.fly) return false;
  const ty = t.surf.type;
  if (ty === 'trap' && u.side === 'hero') {
    t.surf = null;
    s.fx.push({ t: 'move', id: u.id, path: done.slice() }); done.length = 0;
    s.fx.push({ t: 'surf', cells: [[u.x, u.z, null]] });
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: '❎ 假的關閉按鈕！', cls: 'bad' });
    const front = [[6, 5], [6, 6], [5, 5], [5, 6], [6, 4], [6, 7]].find(([x, z]) => standable(s, x, z, u));
    if (front) { u.x = front[0]; u.z = front[1]; s.fx.push({ t: 'tele', id: u.id, x: u.x, z: u.z }); }
    s.fx.push({ t: 'log', text: `${u.name} 踩到彈出式假關閉按鈕，被傳送到主腦正前方承受廣告轟炸！`, cls: 'bad' });
    damage(s, u, rollDice(s, '3d8'), '心靈', null);
    return true;
  }
  if (hitTypes.has(ty)) return false;
  hitTypes.add(ty);
  if (ty === 'grease' && !u.slipImmune) {
    const r = d(s, 20) + (u.dex || 0);
    if (r < 12) {
      s.fx.push({ t: 'move', id: u.id, path: done.slice() }); done.length = 0;
      s.fx.push({ t: 'float', x: u.x, z: u.z, text: `🍟 劈腿滑倒！(${r} < 12)`, cls: 'bad' });
      setStatus(s, u, 'prone', 1);
      return true;
    }
  } else if (ty === 'fire') {
    s.fx.push({ t: 'move', id: u.id, path: done.slice() }); done.length = 0; done.push([u.x, u.z]);
    damage(s, u, rollDice(s, '2d4'), '火焰', null);
  } else if (ty === 'cheese' || ty === 'slime') {
    s.fx.push({ t: 'move', id: u.id, path: done.slice() }); done.length = 0; done.push([u.x, u.z]);
    damage(s, u, rollDice(s, '1d6'), '酸蝕', null);
  } else if (ty === 'sludge') {
    setStatus(s, u, 'nausea', 1);
  } else if (ty === 'shock' && isEnemySide(u)) {
    s.fx.push({ t: 'move', id: u.id, path: done.slice() }); done.length = 0; done.push([u.x, u.z]);
    damage(s, u, rollDice(s, '1d8'), '電擊', null);
    setStatus(s, u, 'palpit', current(s) === u ? 2 : 1); // 自己回合中套上的要撐到下一輪英雄回合
  }
  return !standing(u);
}
const isEnemySide = u => u.side === 'enemy' && !u.st.intern;

// ── 狀態 ──────────────────────────────────────────────
export function setStatus(s, u, k, n) {
  if (!alive(u)) return;
  const had = !!u.st[k];
  u.st[k] = Math.max(u.st[k] || 0, n);
  if (!had) s.fx.push({ t: 'status', id: u.id, st: k, on: true });
}
export function clearStatus(s, u, k) {
  if (u.st[k]) { delete u.st[k]; s.fx.push({ t: 'status', id: u.id, st: k, on: false }); }
}

// ── 命中計算 ──────────────────────────────────────────
// kind: melee | ranged | aoe
export function attackMods(s, att, tgt, kind, baseHit) {
  const parts = [['命中', baseHit]];
  let bonus = baseHit;
  const add = (l, v) => { if (v) { parts.push([l, v]); bonus += v; } };
  const tags = [];
  if (kind !== 'melee') {
    const ha = effH(s, att), hd = effH(s, tgt);
    if (ha > hd) { add('高地', 2); tags.push('⛰️ HIGH GROUND! (+2)'); }
    else if (ha < hd && udist(att, tgt) > 2) { add('仰攻', -2); tags.push('📉 SKILL ISSUE (−2)'); }
  }
  let backstab = false;
  if (kind !== 'aoe' && (isBehind(att, tgt) || att.st.stealth || tgt.st.distracted)) { backstab = true; add('背刺', 3); tags.push('⚡ 惡作劇背刺 (+3)'); }
  if (att.st.psyched) add('腎上腺素', 2);
  if (att.st.cringe) add('尷尬癌', -2);
  if (att.st.canceled) add('被出征', -3);
  if (att.st.nausea) add('反胃', -2);
  if (att.st.pineapple) add('鳳梨恐懼', -2);
  if (kind !== 'melee' && inSurf(s, att, 'toxic')) add('毒雲盲目', -4);
  if (kind !== 'melee' && att.side === 'hero' && has(s, 'spatula')) add('金鏟子', 1);
  if (kind === 'melee' && tgt.st.prone) add('目標倒地', 2);
  let ac = tgt.ac;
  const acParts = [['AC', tgt.ac]];
  const addAc = (l, v) => { if (v) { acParts.push([l, v]); ac += v; } };
  const cov = kind === 'aoe' ? null : coverFor(s, att, tgt);
  if (cov) { addAc('掩體', 2); tags.push('🛒 量販店掩護 (+2 AC)'); }
  if (tgt.st.stealth) addAc('潛行', 2);
  if (tgt.st.shaken) addAc('心態崩潰', -2);
  if (inSurf(s, tgt, 'toxic')) addAc('腐蝕', -2);
  return { bonus, parts, ac, acParts, backstab, tags, cover: cov };
}
export const inSurf = (s, u, ty) => { const t = tile(s, u.x, u.z); return !!(t && t.surf && t.surf.type === ty); };
export function hitChance(bonus, ac) {
  let n = 0;
  for (let r = 2; r <= 19; r++) if (r + bonus >= ac) n++;
  return (n + 1) / 20; // nat20 必中，nat1 必失
}

// 單體攻擊結算。o: {hit, dice, kind, name, type, src, d20?, extraDice?}
export function resolveSingle(s, att, tgt, o) {
  const m = attackMods(s, att, tgt, o.kind, o.hit);
  const r = o.d20 || d(s, 20);
  let crit = r === 20, fumble = r === 1;
  if (att.st.freedom) { crit = true; fumble = false; clearStatus(s, att, 'freedom'); }
  const total = r + m.bonus;
  let hit = !fumble && (crit || total >= m.ac);
  if (tgt.critImmune && crit) crit = false;
  if (o.kind !== 'aoe') s.fx.push({ t: 'attack', id: att.id, tid: tgt.id, kind: o.kind, name: o.name, icon: o.icon || '' });
  s.fx.push({ t: 'roll', who: att.id, label: o.name, d20: r, parts: m.parts, total, ac: m.ac, acParts: m.acParts, hit, crit, fumble, tags: m.tags });
  for (const tg of m.tags) if (!tg.startsWith('🛒') || hit === false) s.fx.push({ t: 'float', x: att.x, z: att.z, text: tg, cls: 'tag' });
  if (fumble) {
    s.fx.push({ t: 'float', x: att.x, z: att.z, text: '🤡 EMOTIONAL DAMAGE! (大失敗)', cls: 'fumble' });
    s.fx.push({ t: 'sfx', name: 'fumble' });
  }
  if (att.st.stealth && o.kind !== 'aoe') clearStatus(s, att, 'stealth');
  if (!hit) {
    if (!fumble) s.fx.push({ t: 'float', x: tgt.x, z: tgt.z, text: '閃過', cls: 'miss' });
    s.fx.push({ t: 'log', text: `${att.name} 的「${o.name}」擲出 ${r}+${m.bonus}=${total} 對 AC ${m.ac}，失手。`, cls: 'miss' });
    return { hit: false, r, total, m };
  }
  if (crit) {
    s.fx.push({ t: 'float', x: tgt.x, z: tgt.z, text: '🦅 FREEDOM CRIT! 200% STONKS!', cls: 'crit' });
    s.fx.push({ t: 'shake', power: 1 });
    s.fx.push({ t: 'sfx', name: 'crit' });
  }
  let dmg = rollDice(s, o.dice, crit);
  if (o.extraDice) dmg += rollDice(s, o.extraDice, crit);
  if (m.backstab) { dmg += rollDice(s, '1d6+2', crit); s.fx.push({ t: 'float', x: att.x, z: att.z, text: '"Relax bro, it\'s just a prank!"', cls: 'quote' }); }
  if (o.kind === 'melee' && att.st.veins) dmg += 2;
  s.fx.push({ t: 'log', text: `${att.name} 的「${o.name}」擲出 ${r}+${m.bonus}=${total} 對 AC ${m.ac}，${crit ? '暴擊' : '命中'}！造成 ${dmg} 點${o.type && o.type !== '傷害' ? o.type : ''}傷害。`, cls: crit ? 'crit' : 'hit' });
  damage(s, tgt, dmg, o.type, att, { crit });
  if (tgt.st && tgt.st.canceled && alive(tgt)) {
    const ex = d(s, 4);
    damage(s, tgt, ex, '心靈', null, { quiet: true });
  }
  return { hit: true, r, total, m, dmg, crit, backstab: m.backstab };
}

// ── 傷害、倒地、死亡 ───────────────────────────────────
export function damage(s, u, amt, type, src, o = {}) {
  if (!alive(u) || amt <= 0) return 0;
  if (u.fireResist && type && type.includes('火')) amt = Math.ceil(amt / 2);
  // 退貨反射盾
  if (u.side === 'hero' && !u.downed && amt >= u.hp && s.party.chips[u.key] === 'refund' && !s.powerUsed[u.key] && src && alive(src) && src !== u) {
    s.powerUsed[u.key] = true;
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: '🧾 "Item did not match description!"', cls: 'crit' });
    s.fx.push({ t: 'log', text: `${u.name} 掏出退貨發票，把 ${amt} 點傷害原封不動退回給 ${src.name}！`, cls: 'good' });
    s.fx.push({ t: 'sfx', name: 'refund' });
    damage(s, src, amt, type, null);
    return 0;
  }
  if (u.downed) {
    u.saves.f += o.crit ? 2 : 1;
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: `💀 死亡豁免失敗 ${u.saves.f}/3`, cls: 'bad' });
    if (u.saves.f >= 3) ambulance(s, u);
    return 0;
  }
  u.hp -= amt;
  s.fx.push({ t: 'dmg', id: u.id, amt, crit: !!o.crit, type });
  if (u.st.concentrate) clearStatus(s, u, 'concentrate');
  if (u.hp <= 0) {
    u.hp = 0;
    if (u.side === 'hero') {
      u.downed = true; u.saves = { s: 0, f: 0 };
      for (const k of Object.keys(u.st)) delete u.st[k];
      s.fx.push({ t: 'down', id: u.id });
      s.fx.push({ t: 'sfx', name: 'siren' });
      s.fx.push({ t: 'float', x: u.x, z: u.z, text: '🚑 沒買醫保！Wee-Woo', cls: 'bad' });
      s.fx.push({ t: 'log', text: `${u.name} 倒地了，而且沒買醫療保險！每回合要擲死亡豁免。`, cls: 'bad' });
    } else if (u.phase2 && !u.transformed) {
      transform(s, u); // 一擊超過一半血也要先變身
    } else {
      u.dead = true;
      s.fx.push({ t: 'die', id: u.id });
      s.fx.push({ t: 'log', text: `${u.name} 被擊倒了！`, cls: 'good' });
      s.fx.push({ t: 'sfx', name: 'ko' });
    }
  } else if (u.phase2 && !u.transformed && u.hp <= u.maxHp / 2) {
    transform(s, u);
  }
  checkOver(s);
  return amt;
}

function transform(s, u) {
  u.transformed = true;
  u.hp = Math.min(u.maxHp, u.hp + 12);
  u.atk = Object.assign({}, u.atk, { name: '元宇宙機甲尾巴橫掃', dice: '3d8+9', sweep: true });
  u.move += 1;
  s.fx.push({ t: 'phase2', id: u.id });
  s.fx.push({ t: 'float', x: u.x, z: u.z, text: '🦎 第二階段：一口乾掉整罐烤肉醬！', cls: 'crit' });
  s.fx.push({ t: 'log', text: `${u.name} 喝下整罐烤肉醬，化身巨型元宇宙機甲蜥蜴！（回復 12 HP，攻擊會橫掃所有相鄰英雄）`, cls: 'bad' });
  s.fx.push({ t: 'shake', power: 2 });
}

function ambulance(s, u) {
  u.gone = true; u.downed = false;
  s.party.bills += 50000;
  s.fx.push({ t: 'gone', id: u.id });
  s.fx.push({ t: 'sfx', name: 'siren' });
  s.fx.push({ t: 'log', text: `救護車衝進戰場把 ${u.name} 載走了，留下一張 $50,000 USD 的破產帳單。本關退場。`, cls: 'bad' });
  checkOver(s);
}

export function heal(s, u, amt) {
  if (!alive(u)) return 0;
  if (has(s, 'bulkcard')) amt += 4;
  const wasDown = u.downed;
  if (u.downed) { u.downed = false; u.hp = 0; u.saves = { s: 0, f: 0 }; s.fx.push({ t: 'revive', id: u.id }); }
  const before = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + amt);
  s.fx.push({ t: 'heal', id: u.id, amt: u.hp - before });
  if (wasDown) s.fx.push({ t: 'log', text: `${u.name} 免付救護車帳單，爬起來繼續戰鬥！`, cls: 'good' });
  return u.hp - before;
}

function checkOver(s) {
  if (s.over) return;
  if (!enemies(s).length || s.units.some(u => u.final && u.dead)) { s.over = 'win'; s.fx.push({ t: 'over', result: 'win' }); }
  else if (!heroes(s).some(standing)) { s.over = 'lose'; s.fx.push({ t: 'over', result: 'lose' }); }
}

// ── 地表連鎖 ──────────────────────────────────────────
function setSurf(s, cells, type, turns) {
  const out = [];
  for (const [x, z] of cells) {
    const t = tile(s, x, z);
    if (!t || t.void || t.lava) continue;
    t.surf = type ? { type, turns } : null;
    out.push([x, z, type]);
  }
  if (out.length) s.fx.push({ t: 'surf', cells: out });
}
function flood(s, x, z, types) {
  const seen = new Set(), out = [], q = [[x, z]];
  while (q.length) {
    const [cx, cz] = q.pop();
    const k = cx + ',' + cz;
    if (seen.has(k)) continue;
    seen.add(k);
    const t = tile(s, cx, cz);
    if (!t || !t.surf || !types.includes(t.surf.type)) continue;
    out.push([cx, cz]);
    for (const [dx, dz] of DIRS.slice(0, 4)) q.push([cx + dx, cz + dz]);
  }
  return out;
}
const cellsIn = (x, z, r) => {
  const out = [];
  const R = Math.ceil(r);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) if (inBounds(x + dx, z + dz) && Math.hypot(dx, dz) <= r + 0.01) out.push([x + dx, z + dz]);
  return out;
};
export { cellsIn };

// 元素命中某區域：fire / vape / lightning / soda
export function elementArea(s, x, z, r, el) {
  const cells = cellsIn(x, z, r);
  if (el === 'fire') {
    const done = new Set();
    for (const [cx, cz] of cells) {
      const t = tile(s, cx, cz);
      if (t && t.surf && t.surf.type === 'grease' && !done.has(cx + ',' + cz)) {
        const f = flood(s, cx, cz, ['grease']);
        f.forEach(([a, b]) => done.add(a + ',' + b));
        setSurf(s, f, 'fire', 3);
        s.fx.push({ t: 'float', x: cx, z: cz, text: '🔥 膽固醇地獄火海！', cls: 'react' });
        s.fx.push({ t: 'log', text: '炸雞廢油被點燃，變成持續 3 回合的膽固醇地獄火海（還有炸雞香味）。', cls: 'react' });
        s.fx.push({ t: 'sfx', name: 'ignite' });
      }
    }
    for (const [cx, cz] of cells) { const p = propAt(s, cx, cz); if (p && PROPS[p.type].explode) explode(s, p); }
  } else if (el === 'vape') {
    const done = new Set();
    for (const [cx, cz] of cells) {
      const t = tile(s, cx, cz);
      if (t && t.surf && (t.surf.type === 'cheese' || t.surf.type === 'slime') && !done.has(cx + ',' + cz)) {
        const f = flood(s, cx, cz, ['cheese', 'slime']);
        f.forEach(([a, b]) => done.add(a + ',' + b));
        setSurf(s, f, 'toxic', 3);
        s.fx.push({ t: 'float', x: cx, z: cz, text: '☣️ 生化毒氣沼澤！', cls: 'react' });
        s.fx.push({ t: 'log', text: '電子菸毒霧碰上酸池，融合成不透明的橘綠色毒雲：裡面的單位 AC −2、遠程 −4。', cls: 'react' });
        s.fx.push({ t: 'sfx', name: 'toxic' });
      }
    }
  } else if (el === 'lightning') {
    const done = new Set();
    for (const [cx, cz] of cells) {
      const t = tile(s, cx, cz);
      if (t && t.surf && t.surf.type === 'energy' && !done.has(cx + ',' + cz)) electrify(s, cx, cz, done);
    }
  } else if (el === 'soda') {
    setSurf(s, cells.filter(([a, b]) => { const t = tile(s, a, b); return t && !t.surf && !blockingProp(s, a, b); }), 'soda', 0);
  } else if (el === 'water') {
    // 快樂水熄火
    const f = cells.filter(([a, b]) => { const t = tile(s, a, b); return t && t.surf && t.surf.type === 'fire'; });
    setSurf(s, f, null, 0);
  }
}
function electrify(s, x, z, done = new Set()) {
  const f = flood(s, x, z, ['energy']);
  f.forEach(([a, b]) => done.add(a + ',' + b));
  setSurf(s, f, 'shock', 3);
  s.fx.push({ t: 'float', x, z, text: '⚡ 200% 咖啡因高壓電網！', cls: 'react' });
  s.fx.push({ t: 'log', text: '能量飲通電，變成咖啡因高壓電網：敵人站上去會被電，我方反而移動 +2。', cls: 'react' });
  s.fx.push({ t: 'sfx', name: 'zap' });
  for (const [a, b] of f) {
    const u = unitAt(s, a, b);
    if (u && isEnemySide(u) && !u.fly) { damage(s, u, rollDice(s, '1d8'), '電擊', null); setStatus(s, u, 'palpit', 1); }
  }
}

export function explode(s, p) {
  if (!p.alive) return;
  p.alive = false;
  const big = p.type === 'crate';
  s.fx.push({ t: 'prop', pid: p.id, gone: true });
  s.fx.push({ t: 'boom', x: p.x, z: p.z, r: 1.5, kind: big ? 'reveal' : 'fire' });
  s.fx.push({ t: 'shake', power: big ? 2 : 1 });
  s.fx.push({ t: 'sfx', name: 'boom' });
  if (big) s.fx.push({ t: 'float', x: p.x, z: p.z, text: "💥 IT'S A GIRL!!", cls: 'crit' });
  s.fx.push({ t: 'log', text: `${PROPS[p.type].name}爆炸了！`, cls: 'react' });
  const dice = big ? '4d8' : '3d6';
  for (const [x, z] of cellsIn(p.x, p.z, 1.5)) {
    const u = unitAt(s, x, z);
    if (u) damage(s, u, rollDice(s, dice), '爆炸火焰', null);
  }
  elementArea(s, p.x, p.z, 1.5, 'fire');
  setSurf(s, cellsIn(p.x, p.z, 1).filter(([x, z]) => !blockingProp(s, x, z)), 'fire', 2);
}

export function breakProp(s, p, dmg, src) {
  if (!p.alive) return;
  const P = PROPS[p.type];
  if (P.explode) { p.hp -= dmg; if (p.hp <= 0 || dmg > 0) return explode(s, p); }
  p.hp -= dmg;
  s.fx.push({ t: 'prop', pid: p.id, hp: Math.max(0, p.hp) });
  if (p.hp > 0) return;
  p.alive = false;
  s.fx.push({ t: 'prop', pid: p.id, gone: true });
  if (p.type === 'potty') {
    s.fx.push({ t: 'boom', x: p.x, z: p.z, r: 1.5, kind: 'sludge' });
    s.fx.push({ t: 'float', x: p.x, z: p.z, text: '🚽 生化惡臭泥漿大爆發！', cls: 'react' });
    s.fx.push({ t: 'log', text: '流動廁所被打爆，炸出藍色生化惡臭泥漿，周圍的人都噁心反胃（攻擊 −2）。', cls: 'react' });
    s.fx.push({ t: 'sfx', name: 'splat' });
    const cells = cellsIn(p.x, p.z, 1.5);
    setSurf(s, cells.filter(([x, z]) => !blockingProp(s, x, z)), 'sludge', 3);
    for (const [x, z] of cells) { const u = unitAt(s, x, z); if (u) setStatus(s, u, 'nausea', 2); }
  } else if (p.type === 'chandelier') {
    s.fx.push({ t: 'boom', x: p.x + 0.5, z: p.z + 0.5, r: 1.2, kind: 'drop' });
    s.fx.push({ t: 'shake', power: 2 });
    s.fx.push({ t: 'sfx', name: 'crash' });
    s.fx.push({ t: 'log', text: '巨型促銷吊燈的繩索斷了，整座吊燈砸了下來！', cls: 'react' });
    for (let z = p.z; z < p.z + p.d; z++) for (let x = p.x; x < p.x + p.w; x++) {
      const u = unitAt(s, x, z);
      if (u) { damage(s, u, rollDice(s, '3d8'), '鈍擊', null); setStatus(s, u, 'prone', 1); }
    }
  } else if (p.type === 'toyball') {
    s.fx.push({ t: 'boom', x: p.x + 0.5, z: p.z + 1, r: 2, kind: 'oil' });
    s.fx.push({ t: 'shake', power: 2 });
    s.fx.push({ t: 'sfx', name: 'boom' });
    s.fx.push({ t: 'float', x: p.x, z: p.z + 1, text: '🔥 整座祭壇化為反式脂肪火海！', cls: 'react' });
    s.fx.push({ t: 'log', text: '兒童餐玩具球砸碎在祭壇上，熱油四濺變成火海！', cls: 'react' });
    const cells = [];
    for (let z = p.z - 1; z < p.z + p.d + 1; z++) for (let x = p.x - 1; x < p.x + p.w + 1; x++) if (inBounds(x, z) && !blockingProp(s, x, z)) cells.push([x, z]);
    setSurf(s, cells, 'fire', 3);
    for (const [x, z] of cells) { const u = unitAt(s, x, z); if (u) damage(s, u, rollDice(s, '2d6'), '火焰', null); }
  } else if (p.type === 'server') {
    s.fx.push({ t: 'boom', x: p.x, z: p.z, r: 1, kind: 'zap' });
    s.fx.push({ t: 'sfx', name: 'boom' });
    s.fx.push({ t: 'log', text: '不死專利伺服器塔過載自爆，執行長再也不能從雲端回血了！', cls: 'good' });
    for (const [x, z] of cellsIn(p.x, p.z, 1.5)) { const u = unitAt(s, x, z); if (u) damage(s, u, rollDice(s, '2d8'), '電擊', null); }
  } else if (p.type === 'cable') {
    s.fx.push({ t: 'boom', x: p.x, z: p.z, r: 1, kind: 'zap' });
    const t = s.grid.flat().find(t => t.surf && t.surf.type === 'energy');
    if (t) electrify(s, t.x, t.z);
  } else {
    s.fx.push({ t: 'log', text: `${P.name}被打爛了。`, cls: '' });
  }
}

// ── 推撞與擊退 ────────────────────────────────────────
// 回傳 {path, fall, ok}
export function predictPush(s, src, u, n) {
  let dx = Math.sign(u.x - src.x), dz = Math.sign(u.z - src.z);
  if (!dx && !dz) dx = 1;
  let x = u.x, z = u.z, fall = 0, lava = false, bump = false;
  const path = [[x, z]];
  for (let i = 0; i < n; i++) {
    const nx = x + dx, nz = z + dz;
    const t = tile(s, nx, nz);
    if (!t || t.void || blockingProp(s, nx, nz) || unitAt(s, nx, nz)) { bump = !!(t && !t.void); break; }
    const h0 = hAt(s, x, z);
    if (t.h > h0) { bump = true; break; }
    x = nx; z = nz; path.push([x, z]);
    if (t.lava && !u.fly) { lava = true; break; }
    if (t.h < h0 && !u.fly) { fall += h0 - t.h; break; }
  }
  const T = tile(s, x, z);
  const hazard = lava || !!(T.surf && (T.surf.type === 'fire' || T.surf.type === 'shock' || T.surf.type === 'cheese' || T.surf.type === 'slime'));
  return { path, fall, lava, bump, hazard, x, z };
}
export function push(s, src, u, n) {
  if (!alive(u)) return;
  const P = predictPush(s, src, u, n);
  if (P.path.length > 1) {
    u.x = P.x; u.z = P.z;
    s.fx.push({ t: 'push', id: u.id, path: P.path, fall: P.fall });
  }
  if (P.bump && P.path.length <= n) damage(s, u, d(s, 4), '撞擊', null);
  if (P.fall > 0) {
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: `🦴 骨折墜落 ${P.fall} 層！`, cls: 'bad' });
    damage(s, u, rollDice(s, P.fall + 'd6'), '墜落', null);
    setStatus(s, u, 'prone', 1);
  }
  if (P.lava) {
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: '🏈 TOUCHDOWN!', cls: 'crit' });
    s.fx.push({ t: 'log', text: `${u.name} 被推進沸騰的烤肉醬池！TOUCHDOWN!`, cls: 'react' });
    damage(s, u, rollDice(s, '3d6'), '火焰', null);
    if (alive(u)) {
      // 爬出醬池到最近空地
      let best = null, bd = 99;
      for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) if (standable(s, x, z, u)) { const dd = dist(x, z, u.x, u.z); if (dd < bd) { bd = dd; best = [x, z]; } }
      if (best) { u.x = best[0]; u.z = best[1]; s.fx.push({ t: 'tele', id: u.id, x: u.x, z: u.z }); }
    }
  } else if (P.hazard && P.path.length > 1) {
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: '🏈 TOUCHDOWN!', cls: 'crit' });
    enterTile(s, u, new Set(), []);
  } else if (P.path.length > 1) {
    enterTile(s, u, new Set(), []);
  }
}

// ── 回合流程 ──────────────────────────────────────────
export function rollInitiative(s) {
  const list = s.units.filter(alive).map(u => ({ u, r: d(s, 20) + (u.dex || 0) }));
  list.sort((a, b) => b.r - a.r || (b.u.dex || 0) - (a.u.dex || 0));
  for (const { u, r } of list) u.init = r;
  s.order = list.map(o => o.u.id);
  s.turn = 0; s.round = 1;
  s.fx.push({ t: 'round', n: 1 });
  s.fx.push({ t: 'log', text: '先攻：' + list.map(o => `${o.u.name} ${o.r}`).join('、'), cls: '' });
}
export const current = s => unitById(s, s.order[s.turn]);

// 回傳 {skip, reason}
export function beginTurn(s) {
  const u = current(s);
  s.fx.push({ t: 'turn', id: u.id });
  u.action = true; u.bonus = true; u.reaction = true;
  u.moveLeft = u.move + (u.st.psyched ? 2 : 0) - (u.st.sugar ? 2 : 0);
  if (u.side === 'hero' && inSurf(s, u, 'shock')) { u.moveLeft += 2; s.fx.push({ t: 'float', x: u.x, z: u.z, text: '⚡ 咖啡因加速 +2 格', cls: 'good' }); }
  if (u.downed) return deathSave(s, u);
  // 地表回合開始效果
  const t = tile(s, u.x, u.z);
  if (t.surf && !u.fly) {
    const ty = t.surf.type;
    if (ty === 'fire') damage(s, u, rollDice(s, '2d4'), '火焰', null);
    else if (ty === 'cheese' || ty === 'slime') damage(s, u, rollDice(s, '1d6'), '酸蝕', null);
    else if (ty === 'shock' && isEnemySide(u)) { damage(s, u, rollDice(s, '1d8'), '電擊', null); setStatus(s, u, 'palpit', 2); }
    if (!standing(u)) return { skip: true, reason: 'down' };
  }
  // 伺服器塔替執行長回血
  if (u.key === 'lizard') {
    const sv = s.props.find(p => p.type === 'server' && p.alive);
    if (sv && u.hp < u.maxHp) { const a = Math.min(8, u.maxHp - u.hp); u.hp += a; s.fx.push({ t: 'heal', id: u.id, amt: a }); s.fx.push({ t: 'log', text: '不死專利伺服器塔替執行長從雲端回復 8 HP。', cls: 'warn' }); }
  }
  for (const k of ['stunned', 'boxed', 'distracted']) if (u.st[k]) {
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: `${k === 'boxed' ? '📦 被關在紙箱裡' : k === 'distracted' ? '🙈 分心中' : '💫 暈眩'}，跳過回合`, cls: 'miss' });
    return { skip: true, reason: k };
  }
  if (u.st.prone) { clearStatus(s, u, 'prone'); u.moveLeft = Math.floor(u.moveLeft / 2); s.fx.push({ t: 'float', x: u.x, z: u.z, text: '起身（耗一半移動）', cls: 'miss' }); }
  // 傳票：被拖向律師
  if (u.st.subpoena && u.side === 'hero') {
    const law = s.units.find(e => e.key === 'lawyer' && alive(e));
    if (law) {
      const r = reachable(s, u, 2);
      let best = null, bd = udist(u, law);
      for (const n of r.values()) { const dd = dist(n.x, n.z, law.x, law.z); if (dd < bd) { bd = dd; best = n; } }
      if (best && (best.x !== u.x || best.z !== u.z)) { s.fx.push({ t: 'float', x: u.x, z: u.z, text: '⚖️ 被傳票拖向律師', cls: 'bad' }); const sv = u.moveLeft; u.moveLeft = 2; walk(s, u, pathTo(best), best.cost); u.moveLeft = Math.max(0, sv - 2); }
    }
    u.bonus = false; u.reaction = false;
  }
  return { skip: false };
}

function deathSave(s, u) {
  const r = d(s, 20);
  s.fx.push({ t: 'roll', who: u.id, label: '死亡豁免', d20: r, parts: [], total: r, ac: 10, hit: r >= 10, crit: r === 20, fumble: r === 1, tags: [] });
  if (r === 20) {
    u.downed = false; u.hp = 1; u.saves = { s: 0, f: 0 };
    s.fx.push({ t: 'revive', id: u.id });
    s.fx.push({ t: 'float', x: u.x, z: u.z, text: '💪 不想付醫藥費的意志力！', cls: 'good' });
    return { skip: false };
  }
  if (r >= 10) u.saves.s++; else u.saves.f += r === 1 ? 2 : 1;
  s.fx.push({ t: 'float', x: u.x, z: u.z, text: `死亡豁免 ${r}：成功 ${u.saves.s}/3・失敗 ${Math.min(3, u.saves.f)}/3`, cls: r >= 10 ? 'good' : 'bad' });
  if (u.saves.f >= 3) { ambulance(s, u); return { skip: true, reason: 'gone' }; }
  if (u.saves.s >= 3) {
    u.downed = false; u.hp = 1; u.saves = { s: 0, f: 0 };
    s.fx.push({ t: 'revive', id: u.id });
    s.fx.push({ t: 'log', text: `${u.name} 憑著不想付醫藥費的強大意志力，自己爬起來了（1 HP）！`, cls: 'good' });
  }
  return { skip: true, reason: 'downed' };
}

export function endTurn(s) {
  const u = current(s);
  if (u) for (const k of Object.keys(u.st)) {
    if (k === 'stealth' || k === 'freedom') continue;
    if (k === 'prone') continue;
    u.st[k]--;
    if (u.st[k] <= 0) { delete u.st[k]; s.fx.push({ t: 'status', id: u.id, st: k, on: false }); }
  }
  if (s.over) return;
  for (let i = 0; i < s.order.length + 1; i++) {
    s.turn++;
    if (s.turn >= s.order.length) { s.turn = 0; endRound(s); }
    const n = current(s);
    if (n && alive(n)) break;
  }
}

function endRound(s) {
  s.round++;
  s.flags.chefUsed = false;
  const cells = [];
  for (const row of s.grid) for (const t of row) if (t.surf && t.surf.turns > 0) {
    t.surf.turns--;
    if (t.surf.turns <= 0) { t.surf = null; cells.push([t.x, t.z, null]); }
  }
  if (cells.length) s.fx.push({ t: 'surf', cells });
  s.fx.push({ t: 'round', n: s.round });
}

// ── 技能可用性與目標 ───────────────────────────────────
export function skillDef(u, sk) {
  if (u.side !== 'hero') return null;
  return HEROES[u.key].skills[sk] || COMMON[sk] || null;
}
export function skillRange(u, sk) {
  const S = skillDef(u, sk);
  if (!S) return 0;
  let r = S.range || 0;
  if (u.range && u.range[sk]) r += u.range[sk];
  if (sk === 'yeet' && u.key === 'chad') r = 6;
  return r;
}

export function canUse(s, u, sk) {
  if (!standing(u)) return { ok: false, why: '倒地中' };
  const S = skillDef(u, sk);
  if (sk === 'power') {
    const pw = s.party.chips[u.key];
    if (!pw && !s.party.droneCharges) return { ok: false, why: '還沒裝 5G 晶片' };
    if (pw === 'refund' && !s.party.droneCharges) return { ok: false, why: '退貨反射盾會在致命攻擊時自動觸發' };
    if (pw && s.powerUsed[u.key] && !s.party.droneCharges) return { ok: false, why: '本關已用過' };
    return { ok: true };
  }
  if (sk === 'rest') {
    if (s.shortRestUsed) return { ok: false, why: '本關已用過' };
    if (!u.action) return { ok: false, why: '沒有主要動作' };
    return { ok: true };
  }
  if (!S) return { ok: false, why: '' };
  if (S.cost === 'action' && !u.action) return { ok: false, why: '主要動作已用完' };
  if (S.cost === 'bonus' && !u.bonus) return { ok: false, why: '附贈動作已用完' };
  if (S.slot && u.slots < S.slot) return { ok: false, why: '法術位不足' };
  if (sk === 'mentos' && s.mentos <= 0) return { ok: false, why: '曼陀珠用完了' };
  if (sk === 'help' && !s.units.some(o => o.side === 'hero' && o.downed && alive(o) && udist(o, u) <= 1.5)) return { ok: false, why: '旁邊沒有倒地的隊友' };
  if (sk === 'yeet' && !yeetItem(s, u)) return { ok: false, why: '旁邊沒有可以丟的東西' };
  if (sk === 'valve') {
    if (!s.props.some(p => p.type === 'valve' && dist(p.x, p.z, u.x, u.z) <= 1.5)) return { ok: false, why: '要站在開關閥旁邊' };
    if (s.flags.valveRound && s.round - s.flags.valveRound < 2) return { ok: false, why: '肉錘冷卻中（每 2 回合一次）' };
  }
  if (sk === 'cancel') {
    const br = s.units.find(e => e.key === 'brain' && alive(e));
    if (!br) return { ok: false, why: '' };
    if (hAt(s, u.x, u.z) < 3 || udist(u, br) > 1.5) return { ok: false, why: '要站上 3 層王座並緊鄰主腦' };
  }
  return { ok: true };
}

// 可以丟的東西（自動挑選）
export function yeetItem(s, u) {
  const near = [];
  for (const p of s.props) {
    if (!p.alive || !PROPS[p.type].throw) continue;
    if (dist(p.x, p.z, u.x, u.z) > 1.5) continue;
    if (PROPS[p.type].heavy && u.key !== 'chad') continue;
    near.push({ kind: PROPS[p.type].throw, prop: p, name: PROPS[p.type].name });
  }
  if (u.key === 'chad') for (const e of s.units) if (e.small && isFoe(u, e) && alive(e) && udist(e, u) <= 1.5) near.push({ kind: 'enemy', unit: e, name: e.name });
  const pri = { chair: 0, gascan: 1, vending: 2, enemy: 3 };
  near.sort((a, b) => pri[a.kind] - pri[b.kind]);
  return near[0] || null;
}

// 目標類型：unit（敵/友）、tile、self
export function targetMode(u, sk) {
  const S = skillDef(u, sk);
  if (!S) return sk === 'power' ? 'unit' : 'none';
  switch (S.kind) {
    case 'melee': case 'ranged': case 'yeet': case 'shove': return 'unit';
    case 'aoe': case 'mentos': case 'teleport': return 'tile';
    case 'heal': return 'tile';
    case 'help': return 'ally';
    case 'selfheal': case 'stealth': case 'valve': case 'cancel': return 'self';
  }
  return 'none';
}

// 判斷某個目標是否合法；回傳 {ok, why}
export function validTarget(s, u, sk, x, z, opts = {}) {
  const S = skillDef(u, sk);
  const tu = unitAt(s, x, z);
  const r = skillRange(u, sk);
  const dd = dist(u.x, u.z, x, z);
  if (sk === 'power') {
    if (!tu || !isFoe(u, tu)) return { ok: false, why: '選一名敵人' };
    const pw = s.party.chips[u.key] && !s.powerUsed[u.key] && s.party.chips[u.key] !== 'refund' ? s.party.chips[u.key] : 'drone';
    if (pw === 'gaslight' && tu.boss) return { ok: false, why: '首領不吃洗腦' };
    if (dd > POWERS[pw].range) return { ok: false, why: '超出射程' };
    return { ok: true };
  }
  if (!S) return { ok: false };
  if (S.kind === 'melee') {
    const mp = opts.pid ? s.props.find(q => q.id === opts.pid && q.alive) : !tu ? propAt(s, x, z) : null;
    if (mp && mp.maxHp > 0 && !PROPS[mp.type].hang) {
      if (dist(u.x, u.z, mp.x, mp.z) > 1.5) return { ok: false, why: '要相鄰才打得到' };
      return { ok: true, prop: mp };
    }
    if (!tu || !isFoe(u, tu)) return { ok: false, why: '選一名相鄰敵人' };
    if (dd > r) return { ok: false, why: '太遠了' };
    if (Math.abs(effH(s, u) - effH(s, tu)) > 1 && !tu.big) return { ok: false, why: '高低差太大，打不到' };
    return { ok: true };
  }
  if (S.kind === 'ranged') {
    const p = opts.pid ? s.props.find(q => q.id === opts.pid && q.alive) : !tu ? propAt(s, x, z) || hangAt(s, x, z) : null;
    if (p && p.maxHp > 0) {
      if (dd > r) return { ok: false, why: '超出射程' };
      return { ok: true, prop: p };
    }
    if (!tu && S.tile) { if (dd > r) return { ok: false, why: '超出射程' }; return { ok: true }; }
    if (!tu || !isFoe(u, tu)) return { ok: false, why: '選一名敵人或可破壞物件' };
    if (dd > r) return { ok: false, why: '超出射程' };
    if (!losUnits(s, u, tu)) return { ok: false, why: '視線被擋住' };
    return { ok: true };
  }
  if (S.kind === 'yeet') {
    if (!tu || !isFoe(u, tu)) return { ok: false, why: '選一名敵人' };
    const it = yeetItem(s, u);
    if (it && it.unit === tu) return { ok: false, why: '不能把它丟向自己' };
    if (dd > r) return { ok: false, why: '超出射程' };
    if (!losUnits(s, u, tu)) return { ok: false, why: '視線被擋住' };
    return { ok: true };
  }
  if (S.kind === 'shove') {
    if (!tu || tu === u) return { ok: false, why: '選一名相鄰單位' };
    if (dd > 1.5) return { ok: false, why: '要相鄰' };
    if (Math.abs(effH(s, u) - effH(s, tu)) > 1) return { ok: false, why: '高低差太大' };
    if (tu.key === 'brain') return { ok: false, why: '推不動漂浮的主腦' };
    return { ok: true };
  }
  if (S.kind === 'aoe' || S.kind === 'mentos' || S.kind === 'heal') {
    const t = tile(s, x, z);
    if (!t || t.void) return { ok: false };
    if (dd > r) return { ok: false, why: '超出射程' };
    if (S.leap && !(standable(s, x, z, u) || unitAt(s, x, z))) return { ok: false, why: '落點不能站' };
    if (S.kind !== 'heal' && !S.leap && !los(s, u.x, u.z, effH(s, u), x, z, t.h)) return { ok: false, why: '視線被擋住' };
    return { ok: true };
  }
  if (S.kind === 'teleport') {
    if (!standable(s, x, z, u) || (x === u.x && z === u.z)) return { ok: false, why: '要選空地' };
    if (dd > r) return { ok: false, why: '超出射程' };
    return { ok: true };
  }
  if (S.kind === 'help') {
    if (!tu || tu.side !== 'hero' || !tu.downed) return { ok: false, why: '選相鄰倒地的隊友' };
    if (dd > 1.5) return { ok: false, why: '要相鄰' };
    return { ok: true };
  }
  return { ok: true };
}

function spend(s, u, S) {
  if (S.cost === 'action') u.action = false;
  if (S.cost === 'bonus') u.bonus = false;
  if (S.slot) u.slots -= S.slot;
}

// ── 使用技能 ──────────────────────────────────────────
// opts.d20 可指定擲骰結果（小費重擲用）
export function useSkill(s, id, sk, x, z, opts = {}) {
  const u = unitById(s, id);
  const c = canUse(s, u, sk);
  if (!c.ok) return { ok: false, why: c.why };
  if (sk === 'rest') return shortRest(s, u);
  const S = skillDef(u, sk);
  const mode = targetMode(u, sk);
  if (mode === 'self') { x = u.x; z = u.z; }
  const v = mode === 'self' ? { ok: true } : validTarget(s, u, sk, x, z, opts);
  if (!v.ok) return { ok: false, why: v.why };
  if (sk === 'power') return usePower(s, u, x, z);
  const tu = opts.pid ? null : unitAt(s, x, z);
  if (!(x === u.x && z === u.z)) face(s, u, x, z);
  spend(s, u, S);
  if (u.st.psyched && S.cost === 'action') { /* 保留到回合結束 */ }

  switch (S.kind) {
    case 'melee': {
      if (!tu && v.prop) {
        s.fx.push({ t: 'attack', id: u.id, tid: null, at: [x, z], kind: 'melee', name: S.name, icon: S.icon });
        s.fx.push({ t: 'log', text: `${u.name} 用「${S.name}」重擊${PROPS[v.prop.type].name}。`, cls: '' });
        breakProp(s, v.prop, rollDice(s, S.dice), u);
        return { ok: true };
      }
      const extra = u.key === 'chad' && has(s, 'wwechair') ? '1d6' : null;
      const res = resolveSingle(s, u, tu, { hit: S.hit, dice: S.dice, kind: 'melee', name: S.name, icon: S.icon, type: S.type, d20: opts.d20, extraDice: extra });
      if (res.hit && res.backstab && S.drain) { heal(s, u, S.drain); s.fx.push({ t: 'float', x: u.x, z: u.z, text: `🩸 吸走退休金 +${S.drain}`, cls: 'good' }); }
      if (res.hit && res.backstab && u.key === 'doge' && has(s, 'ledger') && alive(tu) && rng(s) < 0.5) {
        tu.ac -= 2; u.ac += 2;
        s.fx.push({ t: 'float', x: tu.x, z: tu.z, text: '💾 護甲被轉進離岸帳戶 (AC −2)', cls: 'good' });
      }
      if (res.crit && u.key === 'chad' && has(s, 'wwechair')) s.fx.push({ t: 'float', x: tu.x, z: tu.z, text: '🔔 DING DING DING!', cls: 'crit' });
      return { ok: true, res };
    }
    case 'ranged': {
      if (!tu) {
        const p = v.prop;
        s.fx.push({ t: 'attack', id: u.id, tid: null, at: [x, z], kind: 'ranged', name: S.name, icon: S.icon });
        if (p) { s.fx.push({ t: 'log', text: `${u.name} 用「${S.name}」打向${PROPS[p.type].name}。`, cls: '' }); breakProp(s, p, rollDice(s, S.dice), u); }
        if (S.fire) elementArea(s, x, z, 0.5, 'fire');
        return { ok: true };
      }
      const res = resolveSingle(s, u, tu, { hit: S.hit, dice: S.dice, kind: 'ranged', name: S.name, icon: S.icon, type: S.type, d20: opts.d20 });
      if (res.hit && S.status) setStatus(s, tu, S.status[0], S.status[1]);
      if (res.hit && S.proneHigh && effH(s, u) > effH(s, tu) && rng(s) < S.proneHigh) { setStatus(s, tu, 'prone', 1); s.fx.push({ t: 'float', x: tu.x, z: tu.z, text: '🔔 被壺鈴砸倒！', cls: 'react' }); }
      if (S.fire) elementArea(s, tu.x, tu.z, 0.5, 'fire');
      return { ok: true, res };
    }
    case 'aoe': return doAoe(s, u, S, x, z);
    case 'heal': {
      s.fx.push({ t: 'attack', id: u.id, tid: null, at: [x, z], kind: 'heal', name: S.name, icon: S.icon });
      s.fx.push({ t: 'boom', x, z, r: S.radius, kind: 'heal' });
      for (const o of s.units) if (o.side === 'hero' && alive(o) && dist(o.x, o.z, x, z) <= S.radius + 0.01) heal(s, o, rollDice(s, S.dice));
      s.fx.push({ t: 'log', text: `${u.name} 噴灑直銷精油，薄荷薰衣草味瀰漫全場。`, cls: 'good' });
      s.fx.push({ t: 'sfx', name: 'heal' });
      return { ok: true };
    }
    case 'selfheal': {
      s.fx.push({ t: 'attack', id: u.id, tid: null, kind: 'self', name: S.name, icon: S.icon });
      heal(s, u, rollDice(s, S.dice));
      setStatus(s, u, 'veins', 2);
      s.fx.push({ t: 'sfx', name: 'heal' });
      return { ok: true };
    }
    case 'stealth': {
      s.fx.push({ t: 'attack', id: u.id, tid: null, kind: 'self', name: S.name, icon: S.icon });
      setStatus(s, u, 'stealth', 9);
      if (has(s, 'metrocard')) heal(s, u, 5);
      s.fx.push({ t: 'sfx', name: 'stealth' });
      return { ok: true };
    }
    case 'teleport': {
      u.x = x; u.z = z;
      s.fx.push({ t: 'tele', id: u.id, x, z, mist: true });
      s.fx.push({ t: 'sfx', name: 'tele' });
      if (has(s, 'metrocard')) heal(s, u, 5);
      enterTile(s, u, new Set(), []);
      return { ok: true };
    }
    case 'shove': return doShove(s, u, tu);
    case 'help': {
      s.fx.push({ t: 'attack', id: u.id, tid: tu.id, kind: 'help', name: S.name, icon: S.icon });
      s.fx.push({ t: 'float', x: u.x, z: u.z, text: '"Bro, don\'t call the ambulance!"', cls: 'quote' });
      heal(s, tu, Math.ceil(tu.maxHp / 2) - (has(s, 'bulkcard') ? 4 : 0));
      return { ok: true };
    }
    case 'yeet': return doYeet(s, u, tu, opts);
    case 'mentos': return doMentos(s, u, x, z);
    case 'valve': return doValve(s, u);
    case 'cancel': return doCancel(s, u);
  }
  return { ok: true };
}

function doAoe(s, u, S, x, z) {
  s.fx.push({ t: 'attack', id: u.id, tid: null, at: [x, z], kind: 'aoe', name: S.name, icon: S.icon, leap: !!S.leap });
  if (S.leap) {
    // 跳到落點（若有人就落在旁邊最近的空地）
    let lx = x, lz = z;
    if (!standable(s, x, z, u)) {
      let best = null, bd = 9;
      for (const [cx, cz] of cellsIn(x, z, 1.5)) if (standable(s, cx, cz, u)) { const dd = dist(cx, cz, u.x, u.z); if (dd < bd) { bd = dd; best = [cx, cz]; } }
      if (best) { lx = best[0]; lz = best[1]; } else { lx = u.x; lz = u.z; }
    }
    u.x = lx; u.z = lz;
    s.fx.push({ t: 'tele', id: u.id, x: lx, z: lz, leap: true });
    s.fx.push({ t: 'float', x: lx, z: lz, text: '"LIGHTWEIGHT BABY!"', cls: 'quote' });
  }
  s.fx.push({ t: 'boom', x, z, r: S.radius, kind: S.fire ? (u.key === 'dale' ? 'reveal' : 'fire') : S.vape ? 'vape' : 'slam' });
  s.fx.push({ t: 'sfx', name: S.fire ? 'boom' : S.vape ? 'vape' : 'slam' });
  s.fx.push({ t: 'shake', power: 1 });
  if (u.key === 'dale') s.fx.push({ t: 'float', x, z, text: "🎆 IT'S A BOY!", cls: 'crit' });
  if (u.key === 'karen') s.fx.push({ t: 'float', x, z, text: '★☆☆☆☆ 服務態度極差！', cls: 'crit' });
  const victims = s.units.filter(o => isFoe(u, o) && !o.downed && dist(o.x, o.z, x, z) <= S.radius + 0.01);
  for (const o of victims) {
    const res = resolveSingle(s, u, o, { hit: S.hit, dice: S.dice, kind: 'aoe', name: S.name, icon: S.icon, type: S.type });
    if (res.hit && S.knock && alive(o)) push(s, { x, z }, o, S.knock);
  }
  if (!victims.length) s.fx.push({ t: 'log', text: `${u.name} 的「${S.name}」沒有波及任何敵人。`, cls: 'miss' });
  // 範圍內可破壞物
  for (const [cx, cz] of cellsIn(x, z, S.radius)) {
    const p = propAt(s, cx, cz);
    if (p && p.alive && p.maxHp > 0 && !PROPS[p.type].explode) breakProp(s, p, rollDice(s, S.dice), u);
  }
  if (S.fire) elementArea(s, x, z, S.radius, 'fire');
  if (S.vape) elementArea(s, x, z, S.radius, 'vape');
  return { ok: true };
}

export function shoveOdds(s, u, tu) {
  // P(d20+a >= d20+b) 的近似（含平手算成功）
  const a = u.athletics, b = tu.shoveDef;
  let win = 0;
  for (let i = 1; i <= 20; i++) for (let j = 1; j <= 20; j++) if (i + a >= j + b) win++;
  return win / 400;
}
function doShove(s, u, tu) {
  const a = d(s, 20), b = d(s, 20);
  const ok = a + u.athletics >= b + tu.shoveDef;
  s.fx.push({ t: 'attack', id: u.id, tid: tu.id, kind: 'shove', name: COMMON.shove.name, icon: '🏈' });
  s.fx.push({ t: 'roll', who: u.id, label: '擒抱推撞', d20: a, parts: [['運動', u.athletics]], total: a + u.athletics, ac: b + tu.shoveDef, acParts: [['對抗 d20', b], ['體能', tu.shoveDef]], hit: ok, crit: false, fumble: false, tags: [] });
  if (!ok) { s.fx.push({ t: 'float', x: tu.x, z: tu.z, text: '紋風不動', cls: 'miss' }); s.fx.push({ t: 'log', text: `${u.name} 推撞 ${tu.name} 失敗。`, cls: 'miss' }); return { ok: true, res: { hit: false } }; }
  s.fx.push({ t: 'sfx', name: 'tackle' });
  s.fx.push({ t: 'log', text: `${u.name} 一記美式足球擒抱把 ${tu.name} 推飛！`, cls: 'hit' });
  push(s, u, tu, u.key === 'chad' ? 3 : 2);
  return { ok: true, res: { hit: true } };
}

function doYeet(s, u, tu, opts) {
  const it = yeetItem(s, u);
  const dmgDice = { chair: '1d10+3', vending: '2d10+' + u.str, enemy: '2d6+' + u.str, gascan: '1d6' }[it.kind];
  const extra = u.key === 'chad' && has(s, 'wwechair') ? '1d6' : null;
  s.fx.push({ t: 'yeet', id: u.id, what: it.kind, pid: it.prop ? it.prop.id : null, uid: it.unit ? it.unit.id : null, to: [tu.x, tu.z] });
  s.fx.push({ t: 'float', x: u.x, z: u.z, text: it.kind === 'enemy' ? '"Beat a MF with another MF!"' : '🪑 YEET!', cls: 'quote' });
  if (it.prop) {
    if (it.kind === 'gascan') { it.prop.x = tu.x; it.prop.z = tu.z; explode(s, it.prop); return { ok: true }; }
    if (it.kind === 'vending') { it.prop.alive = false; s.fx.push({ t: 'prop', pid: it.prop.id, gone: true }); }
  }
  const res = resolveSingle(s, u, tu, { hit: u.str, dice: dmgDice, kind: 'ranged', name: `丟${it.name}`, icon: '🪑', type: '鈍擊', d20: opts.d20, extraDice: extra });
  if (it.kind === 'chair') { it.prop.x = tu.x; it.prop.z = tu.z; s.fx.push({ t: 'prop', pid: it.prop.id, moved: [tu.x, tu.z] }); }
  if (it.kind === 'enemy') {
    const e = it.unit;
    let spot = null;
    for (const [cx, cz] of cellsIn(tu.x, tu.z, 1.5)) if (standable(s, cx, cz, e)) { spot = [cx, cz]; break; }
    if (spot) { e.x = spot[0]; e.z = spot[1]; s.fx.push({ t: 'tele', id: e.id, x: e.x, z: e.z, thrown: true }); }
    damage(s, e, rollDice(s, '2d6'), '鈍擊', null);
    setStatus(s, e, 'prone', 1);
  }
  return { ok: true, res };
}

function doMentos(s, u, x, z) {
  s.mentos--;
  s.fx.push({ t: 'attack', id: u.id, tid: null, at: [x, z], kind: 'throw', name: COMMON.mentos.name, icon: '🍬' });
  const soda = cellsIn(x, z, 1).find(([a, b]) => { const t = tile(s, a, b); return t.surf && t.surf.type === 'soda'; });
  if (!soda) {
    s.fx.push({ t: 'float', x, z, text: '……只是一顆普通的曼陀珠', cls: 'miss' });
    const tu = unitAt(s, x, z);
    if (tu) damage(s, tu, d(s, 4), '鈍擊', u);
    return { ok: true };
  }
  const [gx, gz] = soda;
  s.fx.push({ t: 'boom', x: gx, z: gz, r: 2, kind: 'geyser' });
  s.fx.push({ t: 'shake', power: 2 });
  s.fx.push({ t: 'sfx', name: 'geyser' });
  s.fx.push({ t: 'float', x: gx, z: gz, text: '🌋 可樂間歇泉大噴發！', cls: 'react' });
  s.fx.push({ t: 'log', text: '曼陀珠掉進快樂水，半徑 2 格炸出白色泡沫噴泉，把所有人沖上天！', cls: 'react' });
  for (const o of s.units) if (alive(o) && !o.downed && dist(o.x, o.z, gx, gz) <= 2.01) {
    damage(s, o, rollDice(s, '3d6'), '力場', null);
    setStatus(s, o, 'prone', 1);
  }
  const f = flood(s, gx, gz, ['soda']);
  setSurf(s, f, null, 0);
  elementArea(s, gx, gz, 2, 'water');
  return { ok: true };
}

function doValve(s, u) {
  s.flags.valveRound = s.round;
  u.action = false;
  s.fx.push({ t: 'attack', id: u.id, tid: null, kind: 'self', name: COMMON.valve.name, icon: '🔨' });
  s.fx.push({ t: 'boom', x: 5.5, z: 5.5, r: 1.4, kind: 'hammer' });
  s.fx.push({ t: 'shake', power: 3 });
  s.fx.push({ t: 'sfx', name: 'hammer' });
  let any = false;
  for (const [x, z] of s.L.center || []) {
    const o = unitAt(s, x, z);
    if (!o) continue;
    any = true;
    if (o.boss) {
      s.fx.push({ t: 'float', x, z, text: '🔨 巨型肉錘從天而降！−25', cls: 'crit' });
      s.fx.push({ t: 'log', text: `巨型德州肉錘正中 ${o.name}！`, cls: 'good' });
      damage(s, o, 25, '鈍擊', null);
      setStatus(s, o, 'stunned', 1);
    } else {
      damage(s, o, rollDice(s, '3d8'), '鈍擊', null);
      setStatus(s, o, 'prone', 1);
    }
  }
  if (!any) s.fx.push({ t: 'log', text: '肉錘砸在空蕩蕩的競技台中央，濺起一片烤肉醬。', cls: 'miss' });
  return { ok: true };
}

function doCancel(s, u) {
  const br = s.units.find(e => e.key === 'brain' && alive(e));
  u.action = false;
  s.fx.push({ t: 'attack', id: u.id, tid: br.id, kind: 'cancel', name: COMMON.cancel.name, icon: '❌' });
  if (br.hp <= br.maxHp / 2) {
    s.fx.push({ t: 'float', x: br.x, z: br.z, text: '✅ 您已成功取消自動續訂', cls: 'crit' });
    s.fx.push({ t: 'log', text: `${u.name} 找到藏在 48 層子選單後面的按鈕：強制取消訂閱並刪除帳號！`, cls: 'crit' });
    damage(s, br, br.hp, '取消訂閱', null);
  } else {
    s.fx.push({ t: 'float', x: br.x, z: br.z, text: '「取消前請先填寫 12 頁問卷」−20', cls: 'react' });
    s.fx.push({ t: 'log', text: '主腦還太健康，取消流程卡在挽留問卷，但仍造成 20 點傷害。血量壓到 50% 以下就能直接斬首！', cls: 'warn' });
    damage(s, br, 20, '取消訂閱', null);
  }
  return { ok: true };
}

function usePower(s, u, x, z) {
  const tu = unitAt(s, x, z);
  let pw = s.party.chips[u.key];
  if (!pw || s.powerUsed[u.key] || pw === 'refund') { pw = 'drone'; s.party.droneCharges--; }
  else s.powerUsed[u.key] = true;
  face(s, u, x, z);
  if (pw === 'drone') {
    s.fx.push({ t: 'attack', id: u.id, tid: tu.id, kind: 'power', name: POWERS.drone.name, icon: '📦' });
    s.fx.push({ t: 'boom', x, z, r: 0.8, kind: 'drone' });
    s.fx.push({ t: 'shake', power: 2 });
    s.fx.push({ t: 'sfx', name: 'drone' });
    s.fx.push({ t: 'float', x, z, text: '📦 尊榮當日配，使命必達！', cls: 'crit' });
    damage(s, tu, rollDice(s, POWERS.drone.dice), '鈍擊', u);
    setStatus(s, tu, 'boxed', 1);
  } else if (pw === 'gaslight') {
    s.fx.push({ t: 'attack', id: u.id, tid: tu.id, kind: 'power', name: POWERS.gaslight.name, icon: '🧠' });
    s.fx.push({ t: 'float', x, z, text: '🪪 實習生試用期', cls: 'react' });
    s.fx.push({ t: 'log', text: `${tu.name} 被演算法洗腦，開始無薪替你們打工 2 回合。`, cls: 'good' });
    s.fx.push({ t: 'sfx', name: 'gaslight' });
    setStatus(s, tu, 'intern', 2);
  }
  return { ok: true };
}

export function shortRest(s, u) {
  s.shortRestUsed = true;
  u.action = false;
  u.bonus = true;
  const extra = has(s, 'coupon') ? 10 : 0;
  s.fx.push({ t: 'sfx', name: 'eat' });
  s.fx.push({ t: 'log', text: `全隊原地啃起漢堡配快樂水：得來速短休，回復 50% 生命${extra ? '（折價券 +10）' : ''}。`, cls: 'good' });
  for (const o of heroes(s)) if (standing(o)) {
    const amt = Math.ceil(o.maxHp / 2) + extra;
    const before = o.hp; o.hp = Math.min(o.maxHp, o.hp + amt);
    s.fx.push({ t: 'heal', id: o.id, amt: o.hp - before });
  }
  return { ok: true };
}

// ── 戰前嘴砲檢定 ──────────────────────────────────────
export function checkBonus(s, heroKey) {
  const C = s.L.check;
  if (C.hero === 'all') return { bonus: 7, adv: true };
  const b = HEROES[heroKey].talk[C.skill] || 0;
  const adv = heroKey === 'karen' && C.skill === 'intimidate';
  return { bonus: b, adv };
}
export function rollCheck(s, heroKey) {
  const C = s.L.check;
  const { bonus, adv } = checkBonus(s, heroKey);
  const a = d(s, 20), b = adv ? d(s, 20) : null;
  const r = adv ? Math.max(a, b) : a;
  return { d20: a, d20b: b, used: r, bonus, total: r + bonus, dc: C.dc, success: r + bonus >= C.dc || r === 20, adv };
}
export function applyCheck(s, success, heroKey) {
  const C = s.L.check;
  if (!success) {
    const list = C.hero === 'all' ? heroes(s) : [unitById(s, heroKey)];
    for (const u of list) setStatus(s, u, 'cringe', 1);
    s.fx.push({ t: 'log', text: '尬聊破局，直接開打。失敗的人頭上掛著 🤡 CRINGE 一整回合。', cls: 'bad' });
    return;
  }
  s.fx.push({ t: 'log', text: C.win, cls: 'good' });
  const E = k => s.units.find(u => u.key === k && alive(u));
  switch (C.effect) {
    case 'burger': { const b = E('burger'); b.hp -= 10; setStatus(s, b, 'shaken', 2); break; }
    case 'reseller': { const r = E('reseller'); r.f = [1, 0]; setStatus(s, r, 'distracted', 2); break; }
    case 'psyched': for (const u of heroes(s)) setStatus(s, u, 'psyched', 1); break;
    case 'bubba': setStatus(s, E('bubba'), 'distracted', 1); break;
    case 'priestess': setStatus(s, E('priestess'), 'distracted', 2); break;
    case 'pineapple': for (const u of enemies(s)) setStatus(s, u, 'pineapple', 1); break;
    case 'mecha': { const m = E('mecha'); m.ac = 15; m.baseAc = 15; break; }
    case 'chef': s.flags.chef = true; break;
    case 'lizard': {
      setStatus(s, E('lizard'), 'stunned', 1);
      const sv = s.props.find(p => p.type === 'server' && p.alive);
      if (sv) breakProp(s, sv, 99, null);
      break;
    }
    case 'freedom':
      for (const u of heroes(s)) { u.maxHp += 15; u.hp += 15; u.slots = u.maxSlots; setStatus(s, u, 'freedom', 9); }
      break;
  }
}

// ── 敵方 AI ───────────────────────────────────────────
export function targetScore(ai, h) {
  return 45 * ((h.maxHp - h.hp) / h.maxHp) - 4 * udist(ai, h) - 0.8 * h.ac;
}
function foesOf(s, u) {
  let f = s.units.filter(o => isFoe(u, o) && !o.downed);
  return f;
}
function hazardAt(s, x, z, u) {
  const t = tile(s, x, z);
  if (!t.surf || u.fly) return false;
  return ['fire', 'cheese', 'slime', 'toxic', 'sludge', 'grease'].includes(t.surf.type) || (t.surf.type === 'shock' && isEnemySide(u));
}
function nearCover(s, x, z) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const p = propAt(s, x + dx, z + dz); if ((dx || dz) && p && PROPS[p.type].cover) return true; }
  return false;
}

export function aiTurn(s, u) {
  if (!standing(u) || s.over) return;
  if (u.ai === 'brain') return brainTurn(s, u);
  const foes = foesOf(s, u);
  if (!foes.length) return;
  const ranged = u.ai === 'ranged' || u.ai === 'caster';
  const reach = reachable(s, u);
  // 以「站在這格」評分
  const ghost = { x: u.x, z: u.z, f: u.f, fly: u.fly };
  let best = null, bestU = -1e9;
  for (const n of reach.values()) {
    ghost.x = n.x; ghost.z = n.z;
    let util = -n.cost * 0.4;
    if (hazardAt(s, n.x, n.z, u)) util -= 35;
    let tBest = -1e9;
    for (const h of foes) {
      const dd = dist(n.x, n.z, h.x, h.z);
      let v = targetScore(ghost, h) * 0.6;
      if (!ranged) {
        if (dd <= 1.5 && (Math.abs(hAt(s, n.x, n.z) + (u.fly ? 1 : 0) - effH(s, h)) <= 1 || h.big)) {
          v += 40;
          if (isBehind(ghost, h)) v += 22;
        } else v -= dd * 4;
      } else {
        const rr = (u.aoe ? Math.max(u.atk.range, u.aoe.range) : u.atk.range);
        const okLos = los(s, n.x, n.z, hAt(s, n.x, n.z) + (u.fly ? 1 : 0), h.x, h.z, effH(s, h));
        if (dd >= 2.5 && dd <= rr && okLos) v += 35;
        else if (dd <= rr && okLos) v += 15;
        else v -= Math.max(0, dd - rr) * 5 + (okLos ? 0 : 10);
        if (dd < 2) v -= 20;
      }
      tBest = Math.max(tBest, v);
    }
    util += tBest;
    if (ranged) {
      util += hAt(s, n.x, n.z) * 18;
      if (nearCover(s, n.x, n.z)) util += 16;
    }
    if (util > bestU) { bestU = util; best = n; }
  }
  if (best && (best.x !== u.x || best.z !== u.z)) walk(s, u, pathTo(best), best.cost);
  if (!standing(u) || s.over) return;
  // 治療者
  if (u.healer && u.action) {
    const hurt = s.units.filter(o => !isFoe(u, o) && alive(o) && o !== u && o.hp < o.maxHp * 0.5 && udist(o, u) <= 7).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      u.action = false;
      s.fx.push({ t: 'attack', id: u.id, tid: hurt.id, kind: 'heal', name: '高果糖漿群體回血', icon: '🥤' });
      s.fx.push({ t: 'log', text: `${u.name} 替 ${hurt.name} 灌下一大杯高果糖漿。`, cls: 'warn' });
      const amt = rollDice(s, u.healer); const b = hurt.hp; hurt.hp = Math.min(hurt.maxHp, hurt.hp + amt);
      s.fx.push({ t: 'heal', id: hurt.id, amt: hurt.hp - b });
      return;
    }
  }
  // 攻擊
  const inReach = foesOf(s, u).map(h => ({ h, sc: targetScore(u, h) })).sort((a, b) => b.sc - a.sc);
  if (u.aoe && u.action) {
    // 找命中最多英雄的落點
    let bt = null, bc = 0;
    for (const { h } of inReach) {
      if (udist(u, h) > u.aoe.range || !losUnits(s, u, h)) continue;
      const c = foesOf(s, u).filter(o => udist(o, h) <= u.aoe.radius + 0.01).length;
      if (c > bc) { bc = c; bt = h; }
    }
    if (bt && (bc >= 2 || rng(s) < 0.55)) { enemyAoe(s, u, bt.x, bt.z); u.action = false; }
  }
  if (u.action) {
    for (const { h } of inReach) {
      if (!canEnemyHit(s, u, h)) continue;
      u.action = false;
      enemyAttack(s, u, h);
      break;
    }
  }
  // 附贈：把高台邊緣的英雄推下去
  if (!s.over && u.bonus && !ranged && standing(u)) {
    for (const h of foesOf(s, u)) {
      if (udist(u, h) > 1.5 || Math.abs(effH(s, u) - effH(s, h)) > 1 || h.fly) continue;
      const P = predictPush(s, u, h, 2);
      if (P.fall > 0 || P.lava || P.hazard) {
        u.bonus = false;
        const a = d(s, 20), b = d(s, 20);
        const ok = a + u.athletics >= b + h.shoveDef;
        s.fx.push({ t: 'attack', id: u.id, tid: h.id, kind: 'shove', name: '惡意推撞', icon: '🏈' });
        s.fx.push({ t: 'roll', who: u.id, label: '敵方推撞', d20: a, parts: [['運動', u.athletics]], total: a + u.athletics, ac: b + h.shoveDef, acParts: [['對抗 d20', b], ['體能', h.shoveDef]], hit: ok, crit: false, fumble: false, tags: [] });
        if (ok) { s.fx.push({ t: 'log', text: `${u.name} 想把 ${h.name} 推下去！`, cls: 'bad' }); push(s, u, h, 2); }
        else s.fx.push({ t: 'float', x: h.x, z: h.z, text: '站穩了！', cls: 'good' });
        break;
      }
    }
  }
  // 面向最近的英雄
  const near = foesOf(s, u).sort((a, b) => udist(u, a) - udist(u, b))[0];
  if (near && standing(u)) face(s, u, near.x, near.z);
}

function canEnemyHit(s, u, h) {
  const r = u.atk.range;
  if (udist(u, h) > r + 0.01) return false;
  if (r <= 1.5) return Math.abs(effH(s, u) - effH(s, h)) <= 1 || u.big || h.big;
  return losUnits(s, u, h);
}

export function enemyAttack(s, u, h) {
  const A = u.atk;
  face(s, u, h.x, h.z);
  const kind = A.range <= 1.5 ? 'melee' : 'ranged';
  // 神廚擋遠程
  if (kind === 'ranged' && s.flags.chef && !s.flags.chefUsed && h.side === 'hero') {
    s.flags.chefUsed = true;
    s.fx.push({ t: 'attack', id: u.id, tid: h.id, kind, name: A.name, icon: u.icon });
    s.fx.push({ t: 'float', x: h.x, z: h.z, text: '🍳 神廚阿姨用鍋鏟擋下了！', cls: 'good' });
    s.fx.push({ t: 'log', text: `鐵板神廚阿姨一鏟子擋掉 ${u.name} 的「${A.name}」。`, cls: 'good' });
    s.fx.push({ t: 'sfx', name: 'clang' });
    return;
  }
  // 徒手接椅子
  if (A.chair && h.side === 'hero' && canReact(h)) {
    const r = d(s, 20) + h.dex;
    if (r >= 15) {
      h.reaction = false;
      s.fx.push({ t: 'attack', id: u.id, tid: h.id, kind, name: A.name, icon: '🪑' });
      s.fx.push({ t: 'float', x: h.x, z: h.z, text: `🪑 徒手接住椅子！(${r})`, cls: 'crit' });
      s.fx.push({ t: 'log', text: `${h.name} 在半空中徒手接住飛來的摺疊椅！（椅子掉在腳邊，可以拿來 YEET）`, cls: 'good' });
      const p = addProp(s, 'chair', h.x, h.z);
      s.fx.push({ t: 'prop', pid: p.id, added: true });
      return;
    }
  }
  const targets = A.sweep ? foesOf(s, u).filter(o => udist(o, u) <= 1.5) : [h];
  for (const t of targets) {
    const res = resolveSingle(s, u, t, { hit: u.hit, dice: A.dice, kind, name: A.name, icon: u.icon, type: A.fire ? '火焰' : '傷害' });
    if (!res.hit || !alive(t)) continue;
    if (A.canceled) setStatus(s, t, 'canceled', 1);
    if (A.nausea) setStatus(s, t, 'nausea', 1);
    if (A.subpoena) setStatus(s, t, 'subpoena', 1);
    if (A.fire) elementArea(s, t.x, t.z, 0.5, 'fire');
    if (A.push && !t.downed) {
      if (A.legendary) s.fx.push({ t: 'float', x: u.x, z: u.z, text: '👑 傳奇動作：一錘轟飛！', cls: 'crit' });
      push(s, u, t, A.push);
    }
  }
}

function enemyAoe(s, u, x, z) {
  const A = u.aoe;
  face(s, u, x, z);
  s.fx.push({ t: 'attack', id: u.id, tid: null, at: [x, z], kind: 'aoe', name: A.name, icon: u.icon });
  s.fx.push({ t: 'boom', x, z, r: A.radius, kind: A.lightning ? 'zap' : A.fire ? 'fire' : A.soda ? 'soda' : A.sugar ? 'sugar' : 'psy' });
  s.fx.push({ t: 'sfx', name: A.lightning ? 'zap' : 'boom' });
  for (const o of foesOf(s, u)) {
    if (dist(o.x, o.z, x, z) > A.radius + 0.01) continue;
    const res = resolveSingle(s, u, o, { hit: u.hit, dice: A.dice, kind: 'aoe', name: A.name, icon: u.icon, type: A.lightning ? '電擊' : A.fire ? '火焰' : '傷害' });
    if (res.hit && A.sugar && alive(o)) setStatus(s, o, 'sugar', 1);
  }
  if (A.fire) elementArea(s, x, z, A.radius, 'fire');
  if (A.lightning) elementArea(s, x, z, A.radius, 'lightning');
  if (A.soda) elementArea(s, x, z, A.radius, 'soda');
}

function brainTurn(s, u) {
  // 生成假關閉按鈕陷阱
  const traps = s.grid.flat().filter(t => t.surf && t.surf.type === 'trap').length;
  const hs = foesOf(s, u);
  let made = 0;
  for (let tries = 0; tries < 40 && made < 2 && traps + made < 6; tries++) {
    const h = hs[Math.floor(rng(s) * hs.length)];
    if (!h) break;
    const x = h.x + Math.floor(rng(s) * 5) - 2, z = h.z + Math.floor(rng(s) * 5) - 2;
    const t = tile(s, x, z);
    if (!t || t.void || t.lava || t.surf || unitAt(s, x, z) || blockingProp(s, x, z) || (x === h.x && z === h.z)) continue;
    t.surf = { type: 'trap', turns: 0 };
    s.fx.push({ t: 'surf', cells: [[x, z, 'trap']] });
    made++;
  }
  if (made) s.fx.push({ t: 'log', text: `主腦在地面投射了 ${made} 個彈出式假關閉按鈕 [X]，別踩！`, cls: 'warn' });
  const tg = hs.filter(h => udist(u, h) <= u.atk.range).sort((a, b) => targetScore(u, b) - targetScore(u, a))[0];
  if (tg) enemyAttack(s, u, tg);
}

// ── 預覽（游標懸停偵測卡）──────────────────────────────
export function preview(s, u, sk, x, z, opts = {}) {
  const S = skillDef(u, sk);
  const tu = unitAt(s, x, z);
  const out = { tags: [], lines: [] };
  if (!S && sk !== 'power') return out;
  const v = validTarget(s, u, sk, x, z, opts);
  out.ok = v.ok; out.why = v.why;
  if (tu && isFoe(u, tu) && S && (S.kind === 'melee' || S.kind === 'ranged' || S.kind === 'yeet')) {
    const m = attackMods(s, u, tu, S.kind === 'melee' ? 'melee' : 'ranged', S.kind === 'yeet' ? u.str : S.hit);
    out.chance = hitChance(m.bonus, m.ac);
    out.tags.push(...m.tags);
    out.lines.push(`命中 +${m.bonus} 對 AC ${m.ac}`);
    if (S.dice) out.lines.push(`傷害 ${S.dice}${m.backstab ? ' + 1d6+2 偷襲' : ''}`);
  }
  if (tu && S && S.kind === 'shove' && v.ok) {
    const P = predictPush(s, u, tu, u.key === 'chad' ? 3 : 2);
    out.chance = shoveOdds(s, u, tu);
    if (P.fall) out.tags.push(`🏈 可推落高台（${P.fall} 層 ${P.fall}d6 墜落傷害）`);
    if (P.lava) out.tags.push('🏈 可推進烤肉醬池 TOUCHDOWN!');
    else if (P.hazard) out.tags.push('🏈 可推進危險地表');
    out.push = P.path;
  }
  if (S && (S.kind === 'aoe' || S.kind === 'mentos' || S.kind === 'heal')) {
    const r = S.kind === 'mentos' ? 2 : S.radius;
    out.radius = r;
    if (S.kind === 'aoe') out.hits = s.units.filter(o => isFoe(u, o) && !o.downed && dist(o.x, o.z, x, z) <= S.radius + 0.01).map(o => o.id);
    if (S.kind === 'mentos') {
      const soda = cellsIn(x, z, 1).some(([a, b]) => { const t = tile(s, a, b); return t && t.surf && t.surf.type === 'soda'; });
      out.tags.push(soda ? '🌋 會引爆快樂水曼陀珠反應！（我方也會被沖飛）' : '附近沒有快樂水，只是普通曼陀珠');
    }
    if (S.fire && cellsIn(x, z, S.radius).some(([a, b]) => { const t = tile(s, a, b); return t && t.surf && t.surf.type === 'grease'; })) out.tags.push('🔥 會點燃炸雞油');
    if (S.vape && cellsIn(x, z, S.radius).some(([a, b]) => { const t = tile(s, a, b); return t && t.surf && (t.surf.type === 'cheese' || t.surf.type === 'slime'); })) out.tags.push('☣️ 會產生生化毒雲');
  }
  return out;
}

export { has as hasLoot };
