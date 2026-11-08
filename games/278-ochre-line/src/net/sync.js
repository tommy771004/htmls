// 連線對戰的遊戲同步。開房者的瀏覽器是主機：照單機的規則跑整場（Bot、回合、經濟、傷害），每 2 tick（32 Hz）廣播一次快照，
// 這段時間裡發生的事件（開槍、擊殺、中彈、回合結束、安裝、購買、投擲）跟著快照一起送，順序不會亂。
// 其他人是客戶端：自己的移動、開槍、命中判定在本機算（不等網路），回報給主機；主機算傷害，其他人照快照擺（延遲 100 ms 內插）。
// 房間與連線在 client.js；協定見 NET.md。JSON 編解碼會配置記憶體，只在連線時發生，單機的零配置不受影響。
import { G, WEAPONS, GEAR } from '../game/state.js';
import { NET, send, onNet } from './client.js';
import { world, damage, shotFx } from '../game/weapons.js';
import { throwNadeAt } from '../game/grenades.js';
import { setupRoster, startRoundClient, endRoundClient, killFx, buy, plantDone, defuseDone, dropCharge, showCharge, slotToBot, slotToHuman, note } from '../game/round.js';
import { chargePos, play as anim } from '../game/soldiers.js';
import { selectWeapon } from '../game/viewmodel.js';
import { play as sfx } from '../audio/sfx.js';
import { LAYOUT } from '../map/layout.js';

export const SYNC = {
  role: '',          // '' 單機 | host | client
  n: 0,              // 第幾場（伺服器給），丟掉上一場殘留的訊息
  rs: 0,             // 回合序號：主機每開一個回合加一，客戶端看到變了就重置
  slot: -1, k: 0, needMe: false, overSent: false,
  out: [],           // 客戶端：要送給主機的事件
  ev: [],            // 主機：要跟下一張快照一起送的事件
  inbox: [],         // 收到的訊息，在 tick 裡處理（不在 WebSocket 回呼裡改遊戲狀態）
  cam: null,         // 鏡頭位置（畫別人的彈道用）
  onBegin: null, onEnd: null,   // main.js 掛上：進場、結束回房間
};
const PH = ['buy', 'live', 'planted', 'post', 'over'];
const DELAY = 100, SEND_EVERY = 2;
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;

// ── 位置內插緩衝：每人最近 6 筆（時間、x y z yaw pitch vx vy vz） ──
const NB = 6, NS = 8;
function nbOf(a) { return a.nb ?? (a.nb = { t: new Float64Array(NB), s: new Float64Array(NB * NS), n: 0, i: 0 }); }
function pushNb(a, t, s) {
  const b = nbOf(a), k = b.i, o = k * NS; b.t[k] = t;
  for (let j = 0; j < NS; j++) b.s[o + j] = s[j];
  b.i = (k + 1) % NB; if (b.n < NB) b.n++;
}
const resetNb = a => { if (a.nb) a.nb.n = 0; };
function applyNb(a, rt) {
  const b = a.nb; if (!b || !b.n) return;
  let lo = -1, hi = -1;
  for (let c = 0; c < b.n; c++) { const k = (b.i - 1 - c + NB * 2) % NB; if (b.t[k] > rt) hi = k; else { lo = k; break; } }
  const S = b.s; a.px = a.x; a.py = a.y; a.pz = a.z;
  if (lo < 0 || hi < 0) {   // 只有比目標時間新（剛開始）或舊（封包晚到）的：停在最接近的那筆
    const o = (lo < 0 ? hi : lo) * NS;
    a.x = S[o]; a.y = S[o + 1]; a.z = S[o + 2]; a.yaw = S[o + 3]; a.pitch = S[o + 4]; a.vx = S[o + 5]; a.vy = S[o + 6]; a.vz = S[o + 7];
    return;
  }
  const f = (rt - b.t[lo]) / Math.max(1, b.t[hi] - b.t[lo]), p = lo * NS, q = hi * NS, L = (j) => S[p + j] + (S[q + j] - S[p + j]) * f;
  a.x = L(0); a.y = L(1); a.z = L(2); a.pitch = L(4); a.vx = L(5); a.vy = L(6); a.vz = L(7);
  const dy = Math.atan2(Math.sin(S[q + 3] - S[p + 3]), Math.cos(S[q + 3] - S[p + 3])); a.yaw = S[p + 3] + dy * f;
}
function placeNow(a, s) { a.x = a.px = a.rx = s[0]; a.y = a.py = a.ry = s[1]; a.z = a.pz = a.rz = s[2]; a.yaw = s[3]; a.pitch = s[4]; a.vx = a.vy = a.vz = 0; resetNb(a); }

// ── 掛在 weapons／round／grenades 上的掛鉤（world.net） ──
const HOST = {
  client: false,
  shot(a, wid, x, y, z, v) { SYNC.ev.push(['f', a.i, wid, r2(x), r2(y), r2(z), v]); },
  hit() {},
  hurt(v, dmg, a, x, z) { SYNC.ev.push(['h', v.i, a ? a.i : -1, r2(dmg), r2(x ?? v.x), r2(z ?? v.z)]); },
  kill(k, v, w, head) { SYNC.ev.push(['k', k ? k.i : -1, v.i, w, head ? 1 : 0]); },
  end(w, why, lb) { SYNC.ev.push(['e', w, why, lb, G.mvp]); },
  plant(a, site) { SYNC.ev.push(['p', a.i, site]); },
  pick(a) { SYNC.ev.push(['c', a.i]); },
  bought(a, id) { if (a.remote) SYNC.ev.push(['b', a.i, id]); },
  nade(a, kind, x, y, z, vx, vy, vz) { SYNC.ev.push(['n', a.i, kind, r3(x), r3(y), r3(z), r3(vx), r3(vy), r3(vz)]); },
  round() { SYNC.rs++; for (const a of G.agents) if (a.remote) resetNb(a); },
};
const CLIENT = {
  client: true,
  shot(a, wid, x, y, z, v) { if (a === G.me) SYNC.out.push(['f', wid, r2(x), r2(y), r2(z), v]); },
  hit(a, v, group, w, x, y, z) { SYNC.out.push(['x', v.i, group, w.id, r2(x), r2(y), r2(z)]); },
  nade(a, kind, x, y, z, vx, vy, vz) { if (a === G.me) SYNC.out.push(['n', kind, r3(x), r3(y), r3(z), r3(vx), r3(vy), r3(vz)]); },
  hurt() {}, kill() {}, end() {}, plant() {}, pick() {}, bought() {}, round() {},
};
/** 客戶端要主機做的事：['p', 炸點] 安裝完成、['d'] 拆除完成、['g'] 丟裝藥、['b', id] 購買。 */
export const netAct = e => { SYNC.out.push(e); };

// ── 開賽與收場 ──
export function beginMatch(roster, n) {
  const slot = roster.findIndex(r => r.pid === NET.id); if (slot < 0) return false;
  SYNC.role = NET.isHost ? 'host' : 'client'; SYNC.n = n; SYNC.slot = slot; SYNC.rs = 0; SYNC.k = 0; SYNC.needMe = true; SYNC.overSent = false;
  SYNC.out.length = SYNC.ev.length = SYNC.inbox.length = 0;
  world.net = SYNC.role === 'host' ? HOST : CLIENT;
  setupRoster(roster, slot, SYNC.role === 'client');
  SYNC.onBegin?.();
  return true;
}
export function endMatch() { SYNC.role = ''; SYNC.n = 0; world.net = null; SYNC.out.length = SYNC.ev.length = SYNC.inbox.length = 0; }

const mine = () => NET.roster?.some(r => r.pid === NET.id);
onNet('start', m => { if (!SYNC.role) beginMatch(m.roster, m.n); });
// 比賽中才加入（或斷線太久被 Bot 接手後重新選邊）：名單上有自己的席位就進場
onNet('lobby', () => { if (NET.phase === 'match' && !SYNC.role && mine()) beginMatch(NET.roster, NET.n); });
onNet('welcome', m => {
  if (SYNC.role && (m.phase !== 'match' || m.n !== SYNC.n)) { SYNC.onEnd?.('gone'); return; }   // 斷線期間比賽已經結束
  if (SYNC.role === 'client') SYNC.needMe = false;   // 換線接回：自己的位置以本機為準
  if (m.phase === 'match' && !SYNC.role && mine()) beginMatch(m.roster, m.n);
});
onNet('ended', m => { if (SYNC.role && m.why !== 'over') SYNC.onEnd?.(m.why); });
for (const t of ['notfound', 'replaced', 'idle']) onNet(t, () => { if (SYNC.role) SYNC.onEnd?.(t); });
onNet('s', m => { if (SYNC.role === 'client' && m.n === SYNC.n) { m.at = performance.now(); SYNC.inbox.push(m); } });
onNet('st', m => { if (SYNC.role === 'host' && m.n === SYNC.n) { m.at = performance.now(); SYNC.inbox.push(m); } });
for (const t of ['claim', 'gone', 'bot']) onNet(t, m => { if (SYNC.role === 'host') SYNC.inbox.push(m); });

// ── 主機 ──
const inSite = (site, a) => { const S = LAYOUT.sites[site]; return !!S && a.x >= S.x0 && a.x <= S.x1 && a.z >= S.z0 && a.z <= S.z1 && Math.abs(a.y - S.y) < 3; };
const owns = (a, id) => id === 'knife' || id === a.primary || id === a.secondary || a.nades.includes(id) || (id === 'charge' && a.hasCharge);
function hostMsg(m) {
  if (m.t === 'claim') { const a = G.agents[m.slot]; if (a && a !== G.me) { slotToHuman(a, m.pid, m.name); resetNb(a); } return; }
  if (m.t === 'bot') { const a = G.agents[m.slot]; if (a?.remote) slotToBot(a); return; }
  const a = G.agents.find(x => x.remote === (m.from ?? m.pid)); if (!a) return;
  if (m.t === 'gone') { a.vx = a.vz = 0; a.netTask = ''; a.aim = false; resetNb(a); return; }
  if (m.t !== 'st' || m.r !== SYNC.rs || !Array.isArray(m.s) || m.s.length < 10) return;   // 上一回合的位置與事件作廢
  const s = m.s, f = s[8] | 0;
  if (a.alive) { pushNb(a, m.at, s); a.crouch = !!(f & 1); a.ground = !!(f & 2); a.eye = a.crouch ? 1.15 : 1.7; a.netTask = f & 4 ? 'plant' : f & 8 ? 'defuse' : ''; a.aim = !!(f & 16); if (typeof s[9] === 'string' && owns(a, s[9])) a.cur = s[9]; }
  for (const e of Array.isArray(m.e) ? m.e : []) {
    if (!Array.isArray(e) || !a.alive) continue;
    switch (e[0]) {
      case 'f': if (WEAPONS[e[1]] && owns(a, e[1])) { shotFx(a, e[1], +e[2], +e[3], +e[4], e[5] ? 1 : 0, SYNC.cam); SYNC.ev.push(['f', a.i, e[1], e[2], e[3], e[4], e[5] ? 1 : 0]); } break;
      case 'x': {   // 客戶端回報命中：射手與目標都活著、武器是自己的、距離在射程內才算
        const v = G.agents[e[1] | 0], w = WEAPONS[e[3]];
        if (v && v.alive && v.team !== a.team && w && owns(a, e[3]) && Math.hypot(v.x - a.x, v.z - a.z) < (w.range || 2) + 4 && [0, 1, 2, 3].includes(e[2])) damage(a, v, w, e[2], +e[4], +e[5], +e[6]);
        break;
      }
      case 'n': { const i = a.nades.indexOf(e[1]); if (i >= 0 && e.slice(2, 8).every(Number.isFinite)) { a.nades.splice(i, 1); throwNadeAt(a, e[1], e[2], e[3], e[4], e[5], e[6], e[7]); } break; }
      case 'b': buy(e[1], a); break;
      case 'p': if (a.hasCharge && G.phase === 'live' && !G.charge && inSite(e[1], a)) plantDone(a, e[1]); break;
      case 'd': { const c = G.charge; if (c && a.team === 1 && G.phase === 'planted' && Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z) < 2.4) defuseDone(a); break; }
      case 'g': if (a.hasCharge && !G.charge && G.phase !== 'buy') dropCharge(a, 1.1); break;
    }
  }
}
function encAgent(a) {
  const me = a === G.me, b = a.bot;
  const aim = me ? a.burstT > 0 : b ? !!b.target?.alive : a.aim || a.burstT > 0;
  const plant = me ? G.plantP > 0 : b ? b.plantT > 0 : a.netTask === 'plant', defuse = me ? G.defuseP > 0 : b ? b.defT > 0 : a.netTask === 'defuse';
  const f = (a.alive ? 1 : 0) | (a.crouch ? 2 : 0) | (a.ground ? 4 : 0) | (a.hasCharge ? 8 : 0) | (a.kit ? 16 : 0) | (a.helmet ? 32 : 0) | (aim ? 64 : 0) | (plant ? 128 : 0) | (defuse ? 256 : 0);
  return [r3(a.x), r3(a.y), r3(a.z), r3(a.yaw), r3(a.pitch), r2(a.vx), r2(a.vy), r2(a.vz), f, Math.ceil(a.hp), a.armor | 0, a.money, a.cur, a.primary || '', a.secondary || '', a.nades.join(','), a.kills, a.deaths, a.team, a.name];
}
function globals() {
  const c = G.charge, d = G.drop;
  return [PH.indexOf(G.phase), r2(G.time), G.round, G.score[0], G.score[1], SYNC.rs, G.canBuy ? 1 : 0, G.winner, c ? [r3(c.x), r3(c.y), r3(c.z), c.site, r2(c.t)] : 0, d.on ? [r3(d.x), r3(d.y), r3(d.z)] : 0];
}

// ── 客戶端 ──
function clientEv(e) {
  const me = G.me, A = G.agents;
  switch (e[0]) {
    case 'f': if (e[1] !== SYNC.slot && A[e[1]]) shotFx(A[e[1]], e[2], e[3], e[4], e[5], e[6], SYNC.cam); break;
    case 'k': if (A[e[2]]) killFx(e[1] >= 0 ? A[e[1]] : null, A[e[2]], e[3], !!e[4]); break;
    case 'h': {
      const v = A[e[1]]; if (!v) break; v.hitT = 0.33;
      const sh = A[e[2]]; if (sh === me && v !== me) { v.dGiven += e[3]; v.nGiven++; } else if (v === me && sh && sh !== me) { sh.dTaken += e[3]; sh.nTaken++; }
      if (v === me) { G.dmgDir = Math.atan2(e[4] - v.x, e[5] - v.z) - v.yaw; G.dmgT = 1; sfx('hit', v.x, v.y, v.z); G.punch = Math.min(0.04, G.punch + Math.min(0.025, e[3] * 0.0008) * (v.armor > 0 ? 0.55 : 1)); }
      break;
    }
    case 'e': endRoundClient(e[1], e[2], e[3], e[4]); break;
    case 'p': { const a = A[e[1]]; G.banner = `破門裝藥已安裝於炸點 ${e[2]}`; G.bannerT = 2.6; if (a) sfx('plant', a.x, a.y, a.z); if (a === me) note('+$300 安裝裝藥', true); break; }
    case 'c': { const a = A[e[1]]; if (a) sfx('pickup', a.x, a.y, a.z); if (a === me) { note('撿起裝藥', false); G.banner = '你拿到裝藥了'; G.bannerT = 1.6; } break; }
    case 'b': if (e[1] === SYNC.slot) buy(e[2], me, true); break;
    case 'n': if (e[1] !== SYNC.slot && A[e[1]]) throwNadeAt(A[e[1]], e[2], e[3], e[4], e[5], e[6], e[7], e[8]); break;
  }
}
const eqOf = (a, s) => { a.primary = s[13] || null; a.secondary = s[14] || 'p9'; a.nades = s[15] ? s[15].split(',') : []; };
function clientSnap(m) {
  for (const e of m.e || []) clientEv(e);
  const g = m.g, me = G.me, fresh = g[5] !== SYNC.rs, init = SYNC.needMe;
  G.phase = PH[g[0]] ?? G.phase; G.time = g[1]; G.round = g[2]; G.score[0] = g[3]; G.score[1] = g[4]; G.canBuy = !!g[6]; G.winner = g[7];
  if (!G.canBuy) G.buyOpen = false;
  if (g[8]) { const c = G.charge ?? (G.charge = { x: 0, y: 0, z: 0, site: '', t: 0 }); c.x = g[8][0]; c.y = g[8][1]; c.z = g[8][2]; c.site = g[8][3]; c.t = g[8][4]; } else G.charge = null;
  const d = G.drop; d.on = !!g[9]; if (g[9]) { d.x = g[9][0]; d.y = g[9][1]; d.z = g[9][2]; }
  for (let i = 0; i < G.agents.length && i < m.a.length; i++) {
    const a = G.agents[i], s = m.a[i], f = s[8];
    a.team = s[18]; a.name = s[19]; a.hp = s[9]; a.armor = s[10]; a.money = s[11]; a.kills = s[16]; a.deaths = s[17];
    a.hasCharge = !!(f & 8); a.kit = !!(f & 16); a.helmet = !!(f & 32);
    if (a === me) { if (fresh || init) { placeNow(a, s); eqOf(a, s); } }
    else {
      if (fresh || init) placeNow(a, s);
      pushNb(a, m.at, s); a.crouch = !!(f & 2); a.ground = !!(f & 4); a.eye = a.crouch ? 1.15 : 1.7; a.aim = !!(f & 64); a.netTask = f & 128 ? 'plant' : f & 256 ? 'defuse' : '';
      a.cur = s[12]; eqOf(a, s);
    }
    // 沒有擊殺事件的死亡（裝藥引爆）：補倒地
    const alive = !!(f & 1);
    if (!alive && a.alive && !fresh && !a.dying && a.soldier) { a.dying = true; anim(a.soldier, 'death_a', true); }
    a.alive = alive;
  }
  if (fresh || init) { SYNC.rs = g[5]; SYNC.needMe = false; startRoundClient(); }
  if (me.cur === 'charge' && !me.hasCharge) { me.cur = me.primary ?? me.secondary; if (me.alive) selectWeapon(me.cur); }
  // 地上的裝藥：已安裝、掉在地上、或有人正在安裝
  const c = G.charge;
  if (c) { chargePos.on = true; chargePos.x = c.x; chargePos.y = c.y + 0.02; chargePos.z = c.z; }
  else if (d.on) { chargePos.on = true; chargePos.x = d.x; chargePos.y = d.y + 0.02; chargePos.z = d.z; }
  else { const p = G.agents.find(a => a.alive && a.netTask === 'plant' && a !== me) ?? (G.plantP > 0 ? me : null); if (p) showCharge(p); else chargePos.on = false; }
}

// ── 每個 tick：loop.js 在最前面呼叫 netPre、最後呼叫 netPost ──
export function netPre(dt, cam) {
  SYNC.cam = cam.position;
  const host = SYNC.role === 'host';
  for (let i = 0; i < SYNC.inbox.length; i++) { const m = SYNC.inbox[i]; if (host) hostMsg(m); else clientSnap(m); }
  SYNC.inbox.length = 0;
  const rt = performance.now() - DELAY;
  for (const a of G.agents) {
    if (!(host ? a.remote : a.puppet)) continue;
    if (a.alive) applyNb(a, rt); else { a.px = a.x; a.py = a.y; a.pz = a.z; }
    if (a.burstT > 0) a.burstT -= dt;
  }
  // 連線狀態蓋在中央訊息上
  if (NET.status === 'retry') { G.banner = '連線中斷，重新連線中'; G.bannerT = 0.4; }
  else if (!host && NET.hostWait > performance.now()) { G.banner = `主機斷線，等待重新連線（${Math.ceil((NET.hostWait - performance.now()) / 1000)} 秒）`; G.bannerT = 0.4; }
}
export function netPost() {
  if (++SYNC.k % SEND_EVERY) return;
  if (SYNC.role === 'host') {
    if (send({ t: 's', n: SYNC.n, g: globals(), a: G.agents.map(encAgent), e: SYNC.ev })) SYNC.ev = [];
    else if (SYNC.ev.length > 400) SYNC.ev.length = 0;
    if (G.phase === 'over' && !SYNC.overSent) { SYNC.overSent = true; send({ t: 'over' }); }
    return;
  }
  const m = G.me, f = (m.crouch ? 1 : 0) | (m.ground ? 2 : 0) | (G.plantP > 0 ? 4 : 0) | (G.defuseP > 0 ? 8 : 0) | (m.burstT > 0 || G.scoped ? 16 : 0);
  if (send({ t: 'st', n: SYNC.n, r: SYNC.rs, s: [r3(m.x), r3(m.y), r3(m.z), r3(m.yaw), r3(m.pitch), r2(m.vx), r2(m.vy), r2(m.vz), f, m.cur], e: SYNC.out })) SYNC.out = [];
  else if (SYNC.out.length > 400) SYNC.out.length = 0;
}
/** 客戶端的購買：送給主機，主機扣錢後回 'b' 事件才真的拿到。先在本機檢查錢夠不夠，給購買頁即時回饋。 */
export function netBuy(id) {
  const m = G.me, price = WEAPONS[id]?.price ?? GEAR[id]?.price;
  if (!G.canBuy || !m.alive || price === undefined || m.money < price) return false;
  netAct(['b', id]); return true;
}
