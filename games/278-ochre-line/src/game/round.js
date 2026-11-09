// 回合規則與經濟。
import { G, RULES, WEAPONS, GEAR, TEAM_NAME, NAMES, makeAgent, OPT, BOT_SKILL } from './state.js';
import { floorAt } from './mover.js';
import { LAYOUT } from '../map/layout.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { giveWeapon, resetWeaponState, world, drawTime } from './weapons.js';
import { assign, pool, park, play, chargePos } from './soldiers.js';
import { makeBrain, assignGoal, botBuy, roundPlan } from './bots.js';
import { clearNades } from './grenades.js';
import { teleport, you } from './player.js';
import { play as sfx } from '../audio/sfx.js';
import { selectWeapon, stopAnims, hideViewmodel } from './viewmodel.js';

const RAY_A = new Vector3(), RAY_B = new Vector3();
const feedPool = []; for (let i = 0; i < 6; i++) feedPool.push({ killer: '', kteam: 0, victim: '', vteam: 0, weapon: '', wid: '', head: false, mine: false, t: 0 });
const logPool = []; for (let i = 0; i < 7; i++) logPool.push({ text: '', gold: false, t: 0 });
export function note(text, gold) { const e = logPool.pop() ?? G.log.shift(); e.text = text; e.gold = gold; e.t = 8; G.log.push(e); }

export function setupMatch(side) {
  G.agents.length = 0; G.history.length = 0; G.round = 1; G.score[0] = G.score[1] = 0; G.lossStreak[0] = G.lossStreak[1] = 0; G.winner = -1; while (G.feed.length) feedPool.push(G.feed.pop()); while (G.log.length) logPool.push(G.log.pop()); G.mvp = null;
  const my = side === 'atk' ? 0 : 1;
  const me = makeAgent(0, my, NAMES[0], false); G.me = me; G.agents.push(me);
  for (let i = 1; i < 10; i++) { const team = i < 5 ? my : 1 - my, a = makeAgent(i, team, NAMES[i], true); const [lo, hi] = BOT_SKILL[OPT.diff] ?? BOT_SKILL[1]; a.bot = makeBrain(lo + Math.random() * (hi - lo)); G.agents.push(a); }
  world.agents = G.agents;
  startRound();
}

/** 連線對戰的 Bot 名字，依席位固定（每台機器一樣）。 */
export const BOT_NAMES = ['石原', '阿瑞', '柯恩', '杜拉', '卡蘿', '萊拉', '維克', '塔瑪', '賽爾', '諾亞'];
/**
 * 連線對戰：依伺服器的名單建 10 個 agent，每台機器順序相同，G.me 是自己的席位。
 * 主機：沒人的席位是 Bot、其他真人是 remote（位置由網路寫入）。客戶端：自己以外全是 puppet（照主機的快照擺）。
 */
export function setupRoster(roster, mySlot, client) {
  G.agents.length = 0; G.history.length = 0; G.round = 1; G.score[0] = G.score[1] = 0; G.lossStreak[0] = G.lossStreak[1] = 0; G.winner = -1; while (G.feed.length) feedPool.push(G.feed.pop()); while (G.log.length) logPool.push(G.log.pop()); G.mvp = null;
  const [lo, hi] = BOT_SKILL[OPT.diff] ?? BOT_SKILL[1];
  for (let i = 0; i < roster.length; i++) {
    const r = roster[i], human = r.pid > 0, a = makeAgent(i, r.team, human ? r.name : BOT_NAMES[i], !human);
    if (i === mySlot) G.me = a;
    else if (client) a.puppet = true;
    else if (human) a.remote = r.pid;
    else a.bot = makeBrain(lo + Math.random() * (hi - lo));
    G.agents.push(a);
  }
  world.agents = G.agents;
  if (client) { G.phase = 'buy'; G.time = RULES.buyTime; bindSoldiers(); for (const a of G.agents) if (a.soldier) play(a.soldier, 'idle_rifle'); }
  else startRound();
}
/** 主機：斷線太久的真人席位交給 Bot（名字換成 Bot 的）；真人回來或新加入時反過來。 */
export function slotToBot(a) {
  const [lo, hi] = BOT_SKILL[OPT.diff] ?? BOT_SKILL[1];
  a.remote = 0; a.name = BOT_NAMES[a.i]; a.bot = makeBrain(lo + Math.random() * (hi - lo)); assignGoal(a, a.i % 5);
}
export function slotToHuman(a, pid, name) { a.bot = null; a.remote = pid; a.name = name; a.netTask = ''; }

/** 離開比賽回主選單：清掉比賽狀態，士兵全部停放。 */
export function leaveMatch() {
  clearNades(); G.charge = null; G.drop.on = false; chargePos.on = false; G.plantP = G.defuseP = 0; G.canBuy = G.buyOpen = G.scoped = G.scoreOpen = G.paused = false; G.flash = 0; G.banner = ''; G.bannerT = 0; G.winner = -1;
  G.me = null; G.agents.length = 0; G.phase = 'menu';
  for (const t of ['atk', 'def']) for (const s of pool[t]) park(s);
}

export function bindSoldiers() {
  for (const t of ['atk', 'def']) for (const s of pool[t]) park(s);
  const used = [0, 0];
  for (const a of G.agents) {
    a.soldier = null;
    if (a === G.me) { used[a.team]++; continue; }
    const s = pool[a.team === 0 ? 'atk' : 'def'][used[a.team]++]; assign(s, a);
  }
}

export function startRound() {
  G.mvp = null; G.killer = null; G.specIdx = -1; for (const a of G.agents) a.rk = a.rd = a.obj = a.dGiven = a.nGiven = a.dTaken = a.nTaken = 0;
  clearNades(); G.charge = null; G.drop.on = false; chargePos.on = false; G.plantP = 0; G.defuseP = 0; G.canBuy = true; G.phase = 'buy'; G.time = RULES.buyTime; G.flash = 0; G.scoped = false;
  roundPlan();
  bindSoldiers();
  const idx = [0, 0], spawns = LAYOUT.spawns, carriers = G.agents.filter(a => a.team === 0);
  const carrier = carriers[Math.random() * carriers.length | 0];
  let botI = 0;
  for (const a of G.agents) {
    const sp = (a.team === 0 ? spawns.atk : spawns.def)[idx[a.team]++ % 5];
    a.x = a.px = a.rx = sp.x; a.y = a.py = a.ry = sp.y; a.z = a.pz = a.rz = sp.z; a.vx = a.vy = a.vz = 0; a.yaw = sp.yaw * Math.PI / 180; a.pitch = 0; a.hitT = 0;
    a.ground = true; a.crouch = false; a.h = 1.8; a.onSite = false; a.seen = 0; a.dying = false;
    const was = a.alive; a.alive = true; a.hp = 100;
    if (!was) { a.primary = null; a.secondary = 'p9'; a.armor = 0; a.helmet = false; a.kit = false; a.nades = []; }
    if (a.team === 0) { a.kit = false; }
    a.hasCharge = a === carrier;
    giveWeapon(a, a.secondary); if (a.primary) giveWeapon(a, a.primary);
    resetWeaponState(a); a.cur = a.primary ?? a.secondary;
    if (a.bot) { botBuy(a); assignGoal(a, botI++); a.bot.post = false; }
    if (a.soldier) { a.soldier.ryaw = a.yaw; play(a.soldier, 'idle_rifle'); }   // 身體朝向直接對齊出生點，不從上一回合的方向轉過來
  }
  const m = G.me; teleport(m.x, m.y, m.z, m.yaw); selectWeapon(m.cur); stopAnims(); G.banner = `第 ${G.round} 回合 · ${TEAM_NAME[m.team]}${m.team === 0 ? '（攻方）' : '（守方）'}`; G.bannerT = 2.4;
  world.net?.round();
}

/** 連線的客戶端：主機開了新回合。隊伍、位置、裝備已由 sync.js 照快照寫進 agent，這裡做本機的重置（士兵、第一人稱、子彈）。 */
export function startRoundClient() {
  G.mvp = null; G.killer = null; G.specIdx = -1; clearNades(); G.plantP = G.defuseP = 0; G.flash = 0; G.scoped = false; G.punch = 0; G.buyOpen = false;
  for (const a of G.agents) { a.rk = a.rd = a.obj = a.dGiven = a.nGiven = a.dTaken = a.nTaken = 0; a.dying = false; a.seen = 0; resetWeaponState(a); a.netTask = ''; }
  bindSoldiers();
  for (const a of G.agents) if (a.soldier) play(a.soldier, 'idle_rifle');
  const m = G.me; giveWeapon(m, m.secondary); if (m.primary) giveWeapon(m, m.primary); m.cur = m.primary ?? m.secondary;
  teleport(m.x, m.y, m.z, m.yaw); selectWeapon(m.cur); stopAnims();
  G.banner = `第 ${G.round} 回合 · ${TEAM_NAME[m.team]}${m.team === 0 ? '（攻方）' : '（守方）'}`; G.bannerT = 2.4;
}

function pay(team, amount) { for (const a of G.agents) if (a.team === team) a.money = Math.min(RULES.maxMoney, a.money + amount); }

export function endRound(winner, why) {
  if (G.phase === 'post' || G.phase === 'over') return;
  G.score[winner]++; G.lossStreak[winner] = 0;
  const lose = 1 - winner, ls = G.lossStreak[lose]++;
  const loseBonus = Math.min(RULES.loseMax, RULES.loseBase + RULES.loseStep * ls);
  pay(winner, RULES.winMoney); pay(lose, loseBonus);
  note(G.me.team === winner ? `+$${RULES.winMoney} 回合勝利` : `+$${loseBonus} 回合落敗`, true);
  let best = null, top = -1;
  for (const a of G.agents) if (a.team === winner) { const s = a.rk * 100 + a.rd + a.obj * 150; if (s > top) { top = s; best = a; } }
  if (best) G.mvp = { name: best.name, kills: best.rk, dmg: Math.round(best.rd), team: winner, obj: best.obj };
  G.banner = `${TEAM_NAME[winner]}勝 · ${why}`; G.bannerT = RULES.postTime; G.phase = 'post'; G.time = RULES.postTime; G.canBuy = false; G.buyOpen = false;
  G.history.push({ round: G.round, winner, why, myTeam: G.me.team });
  sfx(winner === G.me.team ? 'win' : 'lose', G.me.x, G.me.y, G.me.z);
  if (G.score[winner] >= RULES.winTarget) { G.winner = winner; }
  world.net?.end(winner, why, loseBonus);
}
/** 連線的客戶端：主機判了回合勝負。比分、金錢、階段跟著快照來，這裡補本機的提示與聲音。 */
export function endRoundClient(winner, why, loseBonus, mvp) {
  note(G.me.team === winner ? `+$${RULES.winMoney} 回合勝利` : `+$${loseBonus} 回合落敗`, true);
  G.mvp = mvp; G.banner = `${TEAM_NAME[winner]}勝 · ${why}`; G.bannerT = RULES.postTime; G.buyOpen = false;
  G.history.push({ round: G.round, winner, why, myTeam: G.me.team });
  sfx(winner === G.me.team ? 'win' : 'lose', G.me.x, G.me.y, G.me.z);
}

export function nextRound() {
  if (G.winner >= 0) { G.phase = 'over'; G.bannerT = 0; return; }
  G.round++;
  if (G.round === RULES.half + 1) { // 換邊：比分隨隊伍走，經濟重置
    for (const a of G.agents) { a.team = 1 - a.team; a.money = RULES.startMoney; a.primary = null; a.secondary = 'p9'; a.armor = 0; a.helmet = false; a.nades = []; a.kit = false; }
    const s = G.score[0]; G.score[0] = G.score[1]; G.score[1] = s; G.lossStreak[0] = G.lossStreak[1] = 0;
  }
  startRound();
}

export function onKill(k, v, weapon, head) {
  killFx(k, v, weapon, head);
  world.net?.kill(k, v, weapon, head);
  if (v.hasCharge && !G.charge) dropCharge(v, 0);   // 掉在屍體腳邊，攻方要自己去撿
  checkElim();
}
/** 陣亡的畫面與記錄：擊殺列、倒地動畫、聲音、擊殺獎金。連線的客戶端收到主機的擊殺事件時也走這裡。 */
export function killFx(k, v, weapon, head) {
  if (v.dying) return;
  v.alive = false; v.dying = true; v.deaths++; v.reloadT = 0; v.afterT = 0;
  if (v === G.me) { G.scoped = false; G.killer = k && k !== v ? k : null; G.killWid = weapon; G.killHead = !!head; G.specIdx = -1; G.killDist = k ? Math.hypot(k.x - v.x, k.y - v.y, k.z - v.z) : 0; hideViewmodel(); }
  if (k && k !== v && k.team !== v.team) { k.kills++; k.rk++; const bonus = WEAPONS[weapon]?.bonus ?? (WEAPONS[weapon]?.slot === 3 ? 1500 : weapon === 'l40' ? 100 : weapon === 'v11' ? 600 : weapon === 's8' ? 900 : 300); k.money = Math.min(RULES.maxMoney, k.money + bonus); if (k === G.me) note(`+$${bonus} 擊殺 ${v.name}（${WEAPONS[weapon]?.name ?? weapon}）`, true); }
  const e = feedPool.pop() ?? G.feed.shift();
  e.killer = k?.name ?? ''; e.kteam = k?.team ?? 0; e.victim = v.name; e.vteam = v.team; e.weapon = WEAPONS[weapon]?.name ?? weapon; e.wid = WEAPONS[weapon] ? weapon : ''; e.head = head; e.mine = k === G.me || v === G.me; e.t = 6;
  G.feed.push(e);
  if (v.soldier) play(v.soldier, Math.random() < 0.5 ? 'death_a' : 'death_b', true);
  sfx('death', v.x, v.y, v.z);
}

function alive(t) { let n = 0; for (const a of G.agents) if (a.team === t && a.alive) n++; return n; }
export function checkElim() {
  if (G.phase !== 'live' && G.phase !== 'planted') return;
  if (alive(0) === 0 && !G.charge) endRound(1, '攻方全滅');
  else if (alive(1) === 0) endRound(0, '守方全滅');
}

/** 裝藥擺在手前方（身前 .34、左 .03，對應 build-soldier.py 的 DEVICE），不是腳下。 */
export function showCharge(a) {
  const f = Math.sin(a.yaw), g = Math.cos(a.yaw), x = a.x + f * 0.34, z = a.z + g * 0.34;
  RAY_A.set(a.x, a.y + 0.25, a.z); RAY_B.set(x + f * 0.1, a.y + 0.25, z + g * 0.1);   // 貼牆放的時候退回腳邊，不要嵌進牆裡
  const hit = world.ctx?.ray(RAY_A, RAY_B).hasHit;
  chargePos.on = true; chargePos.x = hit ? a.x : x; chargePos.y = a.y + 0.02; chargePos.z = hit ? a.z : z;
}
/** 把裝藥丟到地上：ahead 是往前丟多遠（陣亡 0、按 G 1.1 m），撞牆就退回腳邊。 */
export function dropCharge(a, ahead) {
  const f = Math.sin(a.yaw), g = Math.cos(a.yaw);
  let x = a.x + f * ahead, z = a.z + g * ahead;
  if (ahead > 0) { RAY_A.set(a.x, a.y + 0.4, a.z); RAY_B.set(x + f * 0.3, a.y + 0.4, z + g * 0.3); if (world.ctx?.ray(RAY_A, RAY_B).hasHit) { x = a.x; z = a.z; } }
  const fy = floorAt(x, z, a.y + 0.5), y = fy > -Infinity ? fy : a.y;
  a.hasCharge = false; if (a.cur === 'charge') a.cur = a.primary ?? a.secondary;
  const d = G.drop; d.on = true; d.x = x; d.y = y; d.z = z; d.by = ahead > 0 ? a : null;
  chargePos.on = true; chargePos.x = x; chargePos.y = y + 0.02; chargePos.z = z;
  if (a === G.me) note('丟下裝藥', false);
}
/** 每個 tick：攻方活著的人走到掉落的裝藥旁就撿起來。 */
export function pickCharge() {
  const d = G.drop; if (!d.on || G.charge) return;
  for (let i = 0; i < G.agents.length; i++) {
    const a = G.agents[i]; if (!a.alive || a.team !== 0) continue;
    const q = Math.hypot(a.x - d.x, a.z - d.z);
    if (a === d.by) { if (q > 2) d.by = null; continue; }
    if (q > 1.2 || Math.abs(a.y - d.y) > 1.5) continue;
    d.on = false; d.by = null; a.hasCharge = true; chargePos.on = false;
    sfx('pickup', a.x, a.y, a.z); if (a === G.me) { note('撿起裝藥', false); G.banner = '你拿到裝藥了'; G.bannerT = 1.6; }
    world.net?.pick(a);
    return;
  }
}
export function plantDone(a, site) {
  showCharge(a);
  G.charge = { x: chargePos.x, y: a.y, z: chargePos.z, site, t: RULES.chargeTime }; a.hasCharge = false; G.phase = 'planted'; G.time = RULES.chargeTime;
  a.money = Math.min(RULES.maxMoney, a.money + 300); a.obj++; if (a === G.me) note('+$300 安裝裝藥', true); G.banner = `破門裝藥已安裝於炸點 ${site}`; G.bannerT = 2.6;
  sfx('plant', a.x, a.y, a.z);
  world.net?.plant(a, site);
}
export function defuseDone(a) { a.money = Math.min(RULES.maxMoney, a.money + 300); a.obj++; if (a === G.me) note('+$300 拆除裝藥', true); endRound(1, '裝藥已拆除'); }

/**
 * 購買。m 預設是玩家；連線時主機替遠端玩家買（m 是那個人），客戶端收到主機確認後用 granted 套用（主機已扣錢，不再檢查）。
 */
export function buy(id, m = G.me, granted = false) {
  if (!granted && (!G.canBuy || !m.alive)) return false;
  const w = WEAPONS[id], g = GEAR[id], price = w?.price ?? g?.price;
  if (price === undefined || (!granted && m.money < price)) return false;
  const me = m === G.me;
  if (w) {
    if (w.nade) { if (m.nades.length >= 3 || m.nades.includes(id)) return false; m.nades.push(id); }
    else { giveWeapon(m, id); m.cur = id; m.reloadT = 0; m.afterT = 0; m.fireT = drawTime(w); if (me) { G.scoped = false; selectWeapon(id, m.fireT); stopAnims(); } }   // 換彈與開鏡都屬於上一把
  } else if (id === 'armor') { if (!granted && m.armor >= 100) return false; m.armor = 100; }
  else if (id === 'helmet') { if (!granted && m.armor >= 100 && m.helmet) return false; m.armor = 100; m.helmet = true; }
  else if (id === 'kit') { if (!granted && (m.team === 0 || m.kit)) return false; m.kit = true; }
  if (!granted) m.money -= price;
  if (me) { sfx('buy', m.x, m.y, m.z); note(`購入 ${w?.name ?? g.name}　-$${price}`, false); }
  if (!granted) world.net?.bought(m, id);
  return true;
}
