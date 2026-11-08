// Bot：導航跟隨、視線偵測、聽覺與懷疑點、反應延遲、瞄準誤差、路線分流、投擲物、回合目標。
// tick 內不配置物件：候選節點表都在 initBots 先算好。
import { G, WEAPONS, RULES } from './state.js';
import { LAYOUT } from '../map/layout.js';
import { nav, nearest, tagged } from '../map/nav.js';
import { step } from './mover.js';
import { fire, clear, startReload, tickWeapon, world, giveWeapon, maxSpeed, LAND_T, equip } from './weapons.js';
import { smoked, throwNade } from './grenades.js';

let siteNodes = { A: [], B: [] }, holdDef = [], holdAtk = [], chokes = [], atkNode = 0, defNode = 0;
let viaPool = [], postPool = { A: [], B: [] }, isHoldAtk = null;
let dropX = NaN, dropZ = NaN, dropNode = -1;
export const plan = { site: 'A', alert: -1, alertT: 0, rot: 0 };
const SC = {};   // 炸點中心 { A: [x, z], B: [x, z] }

// 聽覺距離與頭部瞄點（站姿／蹲姿，量自士兵骨架的頭部膠囊中心）
// 交火反應倍率 [裝藥前攻, 裝藥前守, 裝藥後攻, 裝藥後守]：裝藥前守方架著槍反應快。裝藥後改成攻 1.15／守 .8、攻 1.25／守 .7 都沒有讓攻方勝率可靠下降（2026-11-08，各 8 場 78%、64%），維持 1
export const REACT_K = [1.2, 0.55, 1, 1];
const HEAR_SHOT = 45, HEAR_STEP = 16, HEAD_S = 1.64, HEAD_C = 1.15, QUIET = 3.3;

export function initBots() {
  siteNodes = { A: tagged('site-A'), B: tagged('site-B') };
  holdDef = tagged('hold-def'); holdAtk = tagged('hold-atk'); chokes = tagged('choke');
  for (const k of ['A', 'B']) { const s = LAYOUT.sites[k]; SC[k] = [(s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2]; }
  const sp = LAYOUT.spawns.atk[0], sd = LAYOUT.spawns.def[0];
  atkNode = nearest(sp.x, sp.y, sp.z); defNode = nearest(sd.x, sd.y, sd.z);
  const onSite = new Set([...siteNodes.A, ...siteNodes.B]);
  // 攻方繞路點：卡口與攻方架點，不含炸點本身
  viaPool = [...new Set([...chokes, ...holdAtk])].filter(n => !onSite.has(n));
  isHoldAtk = new Uint8Array(nav.n); for (const n of holdAtk) isHoldAtk[n] = 1;
  // 裝藥後攻方守的位置：炸點節點加附近的守方架點（原本守方用來看攻方的角度，反過來看守方回防）
  for (const k of ['A', 'B']) postPool[k] = [...new Set([...siteNodes[k], ...holdDef])].filter(n => Math.hypot(nav.x[n] - SC[k][0], nav.z[n] - SC[k][1]) < 22);
}
export function makeBrain(skill) {
  return {
    skill, node: 0, goal: 0, target: null, seenT: 0, react: 0, scanT: Math.random() * 0.2, blind: 0, stuckT: 0, lastX: 0, lastZ: 0, wait: 0, role: 0, plantT: 0, lookYaw: 0, lookOn: false, strafe: 0, strafeT: 0,
    post: false, defApp: 0, defT: 0,
    sx: 0, sy: 0, sz: 0, sT: 0, sKind: 0, chase: false, tmp: -1,   // 懷疑點：1 被打、2 聽到、3 最後看到的位置；tmp 是追過去的暫時目標節點
    via: -1, viaT: -1,                                               // 攻方繞路點與在那裡停多久（-1 未到）
    head: false, duck: false, cool: false,                                        // 這次交火瞄頭、蹲著打
    nadeCD: 1 + Math.random() * 2, busy: 0, tyaw: 0, tpitch: 0, away: 0, ax: 0, az: 0,   // 投擲冷卻、出手停頓、隊友閃光轉頭
  };
}
const R = (a) => a[Math.random() * a.length | 0];

export function roundPlan() { plan.site = Math.random() < 0.5 ? 'A' : 'B'; plan.alert = -1; plan.alertT = 0; plan.rot = Math.random() * 8 | 0; }
export function assignGoal(a, i) {
  const b = a.bot; b.node = nearest(a.x, a.y, a.z); b.target = null; b.wait = 0; b.role = i; b.lookOn = false;
  b.sT = 0; b.sKind = 0; b.chase = false; b.tmp = -1; b.via = -1; b.viaT = -1; b.busy = 0; b.away = 0; b.blind = 0; b.nadeCD = 1 + Math.random() * 2;
  if (a.team === 0) {
    b.goal = R(siteNodes[plan.site]);
    // 路線分流：經過卡口或攻方架點、總長不超過直走 1.35 倍的路線，同一條路只留一個，依角色分給不同人；第 0 個選項是直走
    const n = nav.n, s = b.node, g = b.goal, direct = nav.dist[s * n + g], opts = [-1], seen = new Set([route(s, -1, g)]);
    for (const v of viaPool) {
      if (v === s) continue; const dv = nav.dist[v * n + g];
      if (dv <= 6 || dv > 1e8 || nav.dist[s * n + v] + dv > direct * 1.35 + 4) continue;
      const k = route(s, v, g); if (!seen.has(k)) { seen.add(k); opts.push(v); }
    }
    b.via = opts[(i + plan.rot) % opts.length];
  } else {
    const near = i % 2 ? 'A' : 'B', pool = holdDef.filter(n => Math.hypot(nav.x[n] - SC[near][0], nav.z[n] - SC[near][1]) < 30);
    b.goal = pool.length ? R(pool) : R(siteNodes[near]);
  }
}
/** s 經 v（-1 不經過）到 g 的節點序列，當路線的鍵。回合開始時用，可以配置。 */
function route(s, v, g) {
  const out = [], n = nav.n;
  for (const [from, to] of v >= 0 ? [[s, v], [v, g]] : [[s, g]]) { let q = from; for (let k = 0; k < 80 && q >= 0 && q !== to; k++) { out.push(q); q = nav.next[q * n + to]; } }
  return out.join(',');
}
export function botBuy(a) {
  const m = () => a.money, buy = (id) => { a.money -= WEAPONS[id].price; giveWeapon(a, id); };
  const have = WEAPONS[a.primary]?.price ?? 0;   // 活下來的 bot 留著手上的槍，只往上換，不往下換
  const vest = () => { if (a.armor < 100 && m() >= 650) { a.armor = 100; a.money -= 650; } };
  const full = () => { if ((a.armor < 100 || !a.helmet) && m() >= 1000) { a.armor = 100; a.helmet = true; a.money -= 1000; } else vest(); };
  // 錢夠就主力步槍為主，少數人換別的；錢不夠時從買得起的衝鋒、霰彈、輕狙裡抽，買完還要留得起防彈衣
  const roll = Math.random(), main = roll < 0.75 ? (a.team === 0 ? 'ks' : 'ar5') : roll < 0.84 ? 't4' : roll < 0.92 ? 'b90' : 'x10';
  if (m() >= 5700 && roll < 0.1 && have < WEAPONS.n9.price) { buy('n9'); full(); }
  else if (m() >= WEAPONS[main].price + 1000 && have < WEAPONS[main].price) { buy(main); full(); }
  else if (m() >= 2000 && have < 1500) {
    const can = ['v11', 'm7', 'm7', 's6', 's8', 't4', 'x10', 'b90'].filter(id => WEAPONS[id].price + 650 <= m() && WEAPONS[id].price > have);
    if (can.length) buy(R(can));
    vest();
  } else if (have) full();
  else if (m() >= 700 && roll < 0.5 && a.secondary !== 'r50') buy('r50');
  else if (m() >= 300 && roll < 0.7 && a.secondary === 'p9') buy('c7');
  if (a.team === 1 && a.money >= 400 && Math.random() < 0.3) { a.kit = true; a.money -= 400; }
  // 投擲物：長槍和甲都有了才買，最多兩種。攻方煙霧、閃光開路；守方破片丟聽到的位置、閃光回防
  const nade = id => { if (a.money >= WEAPONS[id].price && !a.nades.includes(id) && a.nades.length < 2) { a.money -= WEAPONS[id].price; a.nades.push(id); } };
  if (a.primary && a.armor > 0) {
    if (a.team === 0) { if (Math.random() < 0.65) nade(Math.random() < 0.5 ? 'smoke' : 'flash'); if (Math.random() < 0.35) nade('flash'); }
    else { if (Math.random() < 0.5) nade('frag'); if (Math.random() < 0.35) nade('flash'); }
  }
  if (a.primary) a.cur = a.primary; else a.cur = a.secondary;
}

function angleTo(cur, want, rate) { let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + Math.max(-rate, Math.min(rate, d)); }
/** 從 from 沿導航往 to 走兩步的方向（架槍要看的路口）。 */
function hopYaw(a, from, to) {
  const n1 = nav.next[from * nav.n + to], n2 = n1 >= 0 && n1 !== to ? nav.next[n1 * nav.n + to] : n1, q = n2 >= 0 ? n2 : to;
  return Math.atan2(nav.x[q] - a.x, nav.z[q] - a.z);
}
/** 眼睛看得到 (x,y,z)，而且水平距離在 lo..hi。 */
function see(a, x, y, z, lo, hi) {
  const d = Math.hypot(x - a.x, z - a.z);
  return d >= lo && d <= hi && clear(a.x, a.y + a.eye, a.z, x, y, z);
}
/** 低拋物線仰角：throwNade 初速 15、額外上拋 2.5、重力 15。從低往高試，第一個在水平距離 D 時高度到得了 dh 的角度。 */
function lob(D, dh) {
  for (let p = -0.35; p < 1.25; p += 0.02) { const t = D / (15 * Math.cos(p)), y = (15 * Math.sin(p) + 2.5) * t - 7.5 * t * t; if (y >= dh) return p; }
  return 0.7;
}
function botThrow(a, kind, tx, ty, tz) {
  const b = a.bot, dx = tx - a.x, dz = tz - a.z, D = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), p = lob(D, ty - (a.y + a.eye - 0.1));
  a.vx = a.vz = 0; a.yaw = yaw; a.pitch = Math.min(0.6, p);
  throwNade(a, kind, yaw, p);
  const k = a.nades.indexOf(kind); for (let j = k; j < a.nades.length - 1; j++) a.nades[j] = a.nades[j + 1]; a.nades.length--;
  b.busy = 0.45; b.tyaw = yaw; b.tpitch = a.pitch; b.nadeCD = 2.4;
  // 丟閃光前喊一聲：附近隊友（含自己）轉頭避開
  if (kind === 'flash') for (let i = 0; i < world.agents.length; i++) { const v = world.agents[i]; if (v.bot && v.alive && v.team === a.team && Math.hypot(v.x - tx, v.z - tz) < 26) { v.bot.away = 1.9; v.bot.ax = tx; v.bot.az = tz; } }
}
/** 沒有目標時看要不要丟投擲物，丟了回傳 true。 */
function tryNade(a, c) {
  const b = a.bot, n = nav.n, ns = a.nades;
  b.nadeCD = 0.8;
  // 聽到或剛跟丟的敵人：破片丟過去
  if (ns.indexOf('frag') >= 0 && b.sT > 0 && b.sKind >= 2 && see(a, b.sx, b.sy + 1, b.sz, 8, 24)) { botThrow(a, 'frag', b.sx, b.sy + 0.3, b.sz); return true; }
  // 守方回防：閃光丟到裝藥上空
  if (a.team === 1 && c && ns.indexOf('flash') >= 0 && see(a, c.x, c.y + 1.4, c.z, 9, 24)) { botThrow(a, 'flash', c.x, c.y + 1.6, c.z); return true; }
  if (a.team !== 0 || c || nav.dist[b.node * n + b.goal] > 32) return false;
  // 攻方進點：煙霧封守方回防的路（從炸點往守方出生點的前幾個節點），閃光丟進路線前方看得到的最遠點
  if (ns.indexOf('smoke') >= 0) {
    let q = b.goal;
    for (let k = 0; k < 4; k++) { const nx = nav.next[q * n + defNode]; if (nx < 0 || nx === q) break; q = nx; if (see(a, nav.x[q], nav.y[q] + 1, nav.z[q], 8, 24)) { botThrow(a, 'smoke', nav.x[q], nav.y[q] + 0.2, nav.z[q]); return true; } }
  }
  if (ns.indexOf('flash') >= 0) {
    let q = b.node, best = -1;
    for (let k = 0; k < 10 && q >= 0; k++) {
      const d = Math.hypot(nav.x[q] - a.x, nav.z[q] - a.z); if (d > 24) break;
      if (d >= 7 && clear(a.x, a.y + a.eye, a.z, nav.x[q], nav.y[q] + 1.2, nav.z[q])) best = q;
      if (q === b.goal) break; q = nav.next[q * n + b.goal];
    }
    if (best >= 0) { botThrow(a, 'flash', nav.x[best], nav.y[best] + 1.4, nav.z[best]); return true; }
  }
  return false;
}
/** 掉在地上的裝藥由離得最近的攻方 Bot 去撿。 */
function fetcher() {
  const d = G.drop; let best = null, bd = 1e9;
  for (let i = 0; i < G.agents.length; i++) { const a = G.agents[i]; if (!a.bot || !a.alive || a.team !== 0 || a === d.by) continue; const q = Math.hypot(a.x - d.x, a.z - d.z); if (q < bd) { bd = q; best = a; } }
  return best;
}

export function tickBot(a, dt, cam) {
  const b = a.bot, ag = world.agents, n = nav.n;
  tickWeapon(a, dt);
  if (b.blind > 0) b.blind -= dt;
  if (b.sT > 0) b.sT -= dt;
  if (b.away > 0) b.away -= dt;
  if (b.nadeCD > 0) b.nadeCD -= dt;
  a.px = a.x; a.py = a.y; a.pz = a.z;
  if (G.phase === 'buy') { step(a, 0, 0, 0, false, dt); return; }

  // 偵測：每 0.15 s 一次。看得到的最近敵人當目標；看不到但聽得到（開槍、跑步）的記成懷疑點
  b.scanT -= dt;
  if (b.scanT <= 0) {
    b.scanT = 0.15;
    let best = null, bd = 1e9, heard = null, hd = 1e9;
    const sight = Math.min(75, (WEAPONS[a.cur]?.range ?? 75) * 1.1);   // 射程外的目標不理會，繼續走路線，不要站著空打
    const ex = a.x, ey = a.y + a.eye, ez = a.z, fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
    for (let i = 0; i < ag.length; i++) {
      const v = ag[i]; if (!v.alive || v.team === a.team) continue;
      const dx = v.x - ex, dz = v.z - ez, d = Math.hypot(dx, dz);
      if (d < hd && (v.burstT > 0 ? d < HEAR_SHOT : d < HEAR_STEP && v.ground && !v.crouch && v.vx * v.vx + v.vz * v.vz > 12.96)) { heard = v; hd = d; }
      if (d > sight || d >= bd) continue;
      if (b.blind > 0.5) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.25 && d > 5) continue;
      if (smoked(ex, ey, ez, v.x, v.y + 1.3, v.z)) continue;
      if (clear(ex, ey, ez, v.x, v.y + 1.3, v.z)) { best = v; bd = d; }
    }
    // 跟丟：記下最後看到的位置，血夠就追過去，不夠就架著那個角度
    if (!best && b.target && b.target.alive) {
      const v = b.target; b.sx = v.x; b.sy = v.y; b.sz = v.z; b.sT = 4; b.sKind = 3;
      b.chase = a.hp > 40 && !a.hasCharge && (a.team === 0 || !!G.charge || Math.random() < 0.5); b.tmp = -1;
    }
    // 裝藥前守方架著槍反應快、攻方邊走邊找反應慢，靠這個把攻守勝率拉平；反應與散布的數字由 tools/balance.mjs 實測決定，見 dist/balance.md
    if (best !== b.target) {
      if (best && !b.target) {
        b.react = (0.32 + (1 - b.skill) * 0.4 + Math.random() * 0.14) * REACT_K[(G.charge ? 2 : 0) + a.team];
        // 每次交火擲一次：技術越好越常瞄頭、自動武器遠距離蹲著打
        b.head = Math.random() < 0.1 + b.skill * 0.4;
        b.duck = !!WEAPONS[a.cur]?.auto && Math.random() < 0.1 + b.skill * 0.35;
      }
      b.target = best;
    }
    if (best) { best.seen = 1.2; plan.alert = nearest(best.x, best.y, best.z); plan.alertT = 8; b.sT = 0; b.tmp = -1; b.chase = false; }
    else if (heard && (b.sKind !== 1 || b.sT < 1.5) && (b.sKind !== 3 || b.sT < 2)) {
      // 聽聲辨位有誤差：越遠越不準，最多 2 m
      const e = Math.min(2, hd * 0.06);
      b.sx = heard.x + (Math.random() - 0.5) * 2 * e; b.sy = heard.y; b.sz = heard.z + (Math.random() - 0.5) * 2 * e; b.sT = 2.5; b.sKind = 2; b.chase = false; b.tmp = -1;
    }
  }

  let wx = 0, wz = 0, speed = maxSpeed(a) * (a.slowT > 0 ? 0.5 : 1), crouch = false, jump = false;
  const t = b.target && b.target.alive ? b.target : null;
  if (t) {
    const ex = a.x, ey = a.y + a.eye, ez = a.z, dx = t.x - ex, dz = t.z - ez, d = Math.hypot(dx, dz);
    const aimH = b.head && d < 30 ? (t.crouch ? HEAD_C : HEAD_S) : (t.crouch ? 0.95 : 1.35), wantY = Math.atan2(dx, dz), wantP = Math.atan2(t.y + aimH - ey, d);
    const rate = (1.4 + b.skill * 2.8) * dt * 2.2;
    a.yaw = angleTo(a.yaw, wantY, rate); a.pitch = angleTo(a.pitch, wantP, rate);
    if (b.react > 0) b.react -= dt;
    const err = Math.abs(Math.atan2(Math.sin(wantY - a.yaw), Math.cos(wantY - a.yaw))) + Math.abs(wantP - a.pitch);
    const w = WEAPONS[a.cur];
    if (b.react <= 0 && err < 0.09 + 0.6 / Math.max(d, 4) * 0.2) {
      const miss = (1 - b.skill) * 0.045 + 0.01;
      // 連發到上限就停，等彈道索引退回第一發附近再開（後座改成逐發回退後，不加這段會一直接著高索引掃）
      if (a.burst >= 3 + (b.skill * 6 | 0)) b.cool = true; else if (a.burst < 1.5) b.cool = false;
      if ((a.ammo[a.cur] | 0) > 0) { if (d <= (w?.range ?? 0) && !b.cool && Math.random() < (w?.auto ? 1 : 0.2)) fire(a, a.yaw + (Math.random() - 0.5) * miss, a.pitch + (Math.random() - 0.5) * miss, cam); }
      else if (d < 9 && a.cur !== a.secondary && (a.ammo[a.secondary] | 0) > 0) equip(a, a.secondary);   // 貼臉打空：拔手槍比換彈快，主武器等沒目標再補
      else if (a.reloadT <= 0 && !startReload(a) && a.cur !== a.secondary) equip(a, a.secondary);   // 換彈中的 reloadT 也會讓 startReload 回傳 false，要先排除，否則每次都換手槍，備彈永遠用不到
    }
    b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = 0.4 + Math.random() * 0.5; b.strafe = Math.random() < 0.5 ? -1 : 1; }
    if (a.hp < 35 && d > 4) {
      // 殘血：邊打邊往後退、帶一點橫移，退出視線就斷開交火（跟丟後血不夠不會追）
      const k = 1 / (d || 1); wx = -dx * k + Math.cos(a.yaw) * b.strafe * 0.5; wz = -dz * k - Math.sin(a.yaw) * b.strafe * 0.5; speed *= 0.8;
    } else if (b.duck && d > 12 && b.react <= 0 && w?.auto) crouch = true;   // 遠距離蹲下掃射：蹲姿散布 ×0.6，頭也變低
    else { wx = Math.cos(a.yaw) * b.strafe * 0.35; wz = -Math.sin(a.yaw) * b.strafe * 0.35; speed *= 0.5; }
  } else {
    if (a.primary && a.cur !== a.primary && (a.ammo[a.primary] | 0) + (a.rsv[a.primary] | 0) > 0) equip(a, a.primary);   // 打完架切回主武器
    if ((a.ammo[a.cur] | 0) < 8) startReload(a);
    const c = G.charge;
    // 目標：裝藥安裝後守方去拆、攻方守在炸點附近的架點
    if (c) { if (a.team === 1) { const s = siteNodes[c.site]; if (!s.includes(b.goal)) b.goal = R(s); } else if (!b.post) { b.post = true; b.via = -1; b.wait = 0; b.goal = R(postPool[c.site].length ? postPool[c.site] : siteNodes[c.site]); } }
    else if (a.team === 1 && plan.alertT > 0) {
      // 聽到接觸就回防：離接觸點近的炸點，四人中三人移動，留一人看另一側
      const al = plan.alert, dA = Math.hypot(nav.x[al] - SC.A[0], nav.z[al] - SC.A[1]), dB = Math.hypot(nav.x[al] - SC.B[0], nav.z[al] - SC.B[1]), near = dA < dB ? 'A' : 'B';
      if (Math.min(dA, dB) < 34 && b.role % 4 !== 3 && !siteNodes[near].includes(b.goal)) b.goal = R(siteNodes[near]);
    }
    // 這一步要走去哪：撿裝藥 > 追最後看到的位置 > 繞路點 > 目標
    const drop = G.drop, fetch = a.team === 0 && drop.on && !c && fetcher() === a;
    if (fetch && (drop.x !== dropX || drop.z !== dropZ)) { dropX = drop.x; dropZ = drop.z; dropNode = nearest(drop.x, drop.y, drop.z); }
    if (b.chase && b.sT > 0 && b.sKind === 3 && b.tmp < 0) b.tmp = nearest(b.sx, b.sy, b.sz);
    if (b.tmp >= 0 && (b.sT <= 0 || !b.chase)) b.tmp = -1;
    const goal = fetch ? dropNode : b.tmp >= 0 ? b.tmp : b.via >= 0 ? b.via : b.goal;
    const gx = nav.x[b.node], gz = nav.z[b.node], dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz);
    let hold = false;
    if (d < 1.1) {
      if (b.node !== goal) b.node = nav.next[b.node * n + goal];
      else if (goal === b.tmp) { b.tmp = -1; b.chase = false; }   // 追到了沒人：留在原地看懷疑點直到時間到
      else if (goal === b.via && !fetch) {
        // 繞路點：攻方架點停一下看炸點方向，卡口直接通過
        if (b.viaT < 0) { b.viaT = isHoldAtk[b.via] ? 1.6 + Math.random() * 2.4 : 0; b.lookYaw = hopYaw(a, b.via, b.goal); }
        b.viaT -= dt; if (b.viaT <= 0) { b.via = -1; b.viaT = -1; } else hold = true;
      } else if (goal === b.goal) b.wait += dt;
    }
    if (b.node >= 0 && d >= 0.4 && !hold) {
      const k = 1 / (d || 1); wx = dx * k; wz = dz * k;
      a.yaw = angleTo(a.yaw, Math.atan2(dx, dz), 5 * dt); a.pitch = angleTo(a.pitch, 0, 3 * dt);
    }
    if (fetch && Math.hypot(drop.x - a.x, drop.z - a.z) < 3) { const dx2 = drop.x - a.x, dz2 = drop.z - a.z, q = 1 / (Math.hypot(dx2, dz2) || 1); wx = dx2 * q; wz = dz2 * q; }
    // 到位後看向對方會來的路（沿導航往對方出生點走兩步的方向），左右慢慢掃。守方裝藥前看攻方，攻方裝藥後看守方回防
    const atGoal = b.node === b.goal && b.wait > 0 && goal === b.goal && ((a.team === 1 && !c) || (a.team === 0 && c && b.post));
    if (atGoal) {
      if (!b.lookOn) { b.lookOn = true; b.lookYaw = hopYaw(a, b.goal, a.team === 1 ? atkNode : defNode); }
      a.yaw = angleTo(a.yaw, b.lookYaw + Math.sin(b.wait * 0.8 + b.role) * 0.55, 3 * dt); a.pitch = angleTo(a.pitch, 0, 3 * dt);
    } else {
      b.lookOn = false;
      if (hold) { a.yaw = angleTo(a.yaw, b.lookYaw + Math.sin(b.viaT * 1.1 + b.role) * 0.4, 3 * dt); a.pitch = angleTo(a.pitch, 0, 3 * dt); }
    }
    // 懷疑點：轉過去看（掃描只看正前方，轉過去下一次掃描就看得到），聽到或跟丟時放慢成靜步
    if (b.sT > 0) {
      const sdx = b.sx - a.x, sdz = b.sz - a.z, sd = Math.hypot(sdx, sdz);
      if (sd > 0.8) { a.yaw = angleTo(a.yaw, Math.atan2(sdx, sdz), (b.sKind === 1 ? 7 : 5) * dt); a.pitch = angleTo(a.pitch, Math.atan2(b.sy + 1.35 - a.y - a.eye, sd), 3 * dt); }
      if (b.sKind >= 2 && !fetch) speed = Math.min(speed, QUIET);
    }
    // 隊友丟閃光：背對爆點
    if (b.away > 0 && b.away < 1.85) a.yaw = angleTo(a.yaw, Math.atan2(a.x - b.ax, a.z - b.az), 9 * dt);
    // 卡住就換路，順便跳一下（矮台階、窗台）
    b.stuckT += dt;
    if (b.stuckT > 1) { const m = Math.hypot(a.x - b.lastX, a.z - b.lastZ); b.stuckT = 0; b.lastX = a.x; b.lastZ = a.z; if (m < 0.4 && (wx !== 0 || wz !== 0)) { b.node = nearest(a.x, a.y, a.z); wx += (Math.random() - 0.5) * 1.4; wz += (Math.random() - 0.5) * 1.4; jump = Math.random() < 0.5; } }
    if (a.team === 0 && a.hasCharge && !G.charge && (a.onSite)) { wx = 0; wz = 0; crouch = true; }
    if (a.team === 1 && G.charge && Math.hypot(G.charge.x - a.x, G.charge.z - a.z) < 1.4) {
      // 轉向裝藥、走到手搆得到的距離再跪下；被擋住就在原地拆，不要卡死
      const dx2 = G.charge.x - a.x, dz2 = G.charge.z - a.z, q = Math.hypot(dx2, dz2) || 1;
      a.yaw = angleTo(a.yaw, Math.atan2(dx2, dz2), 12 * dt);
      b.defApp += dt;
      const sg = q > 0.46 ? 1 : q < 0.28 ? -1 : 0;
      if (sg && b.defApp < 1.6) { wx = sg * dx2 / q; wz = sg * dz2 / q; speed = 1.6; } else { wx = 0; wz = 0; crouch = true; }
    } else if (a.team === 1 && G.charge && Math.hypot(G.charge.x - a.x, G.charge.z - a.z) < 14) { b.defApp = 0; const dx2 = G.charge.x - a.x, dz2 = G.charge.z - a.z, q = 1 / Math.hypot(dx2, dz2); wx = dx2 * q; wz = dz2 * q; }
    // 投擲物：出手後停一下，身體保持投擲方向
    if (b.busy > 0) { b.busy -= dt; wx = wz = 0; a.yaw = b.tyaw; a.pitch = b.tpitch; }
    else if (b.nadeCD <= 0 && a.nades.length && !a.hasCharge && !crouch) tryNade(a, c);
  }
  a.crouch = crouch; a.h = crouch ? 1.25 : 1.8; a.eye = crouch ? 1.15 : 1.7;
  for (let i = 0; i < ag.length; i++) { // 不互相穿過
    const v = ag[i]; if (v === a || !v.alive) continue;
    const dx = a.x - v.x, dz = a.z - v.z, q = dx * dx + dz * dz;
    if (q < 0.5 && q > 1e-4 && Math.abs(a.y - v.y) < 1.5) { const k = (0.71 - Math.sqrt(q)) / Math.sqrt(q); a.x += dx * k * 0.5; a.z += dz * k * 0.5; }
  }
  const wasG = a.ground;
  step(a, wx, wz, crouch ? 0 : speed, jump, dt);
  if (!a.ground) a.airT = (a.airT || 0) + dt; else if (!wasG) { if (a.airT > 0.2) a.landT = LAND_T; a.airT = 0; }
}
