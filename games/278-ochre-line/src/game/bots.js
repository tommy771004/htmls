// Bot：導航跟隨、視線偵測、反應延遲、瞄準誤差、回合目標。
import { G, WEAPONS, RULES } from './state.js';
import { LAYOUT } from '../map/layout.js';
import { nav, nearest, tagged } from '../map/nav.js';
import { step } from './mover.js';
import { fire, clear, startReload, tickWeapon, world, giveWeapon, maxSpeed } from './weapons.js';
import { smoked } from './grenades.js';

let siteNodes = { A: [], B: [] }, holdDef = [], holdAtk = [], chokes = [], atkNode = 0;
export const plan = { site: 'A', alert: -1, alertT: 0 };

export function initBots() {
  siteNodes = { A: tagged('site-A'), B: tagged('site-B') };
  holdDef = tagged('hold-def'); holdAtk = tagged('hold-atk'); chokes = tagged('choke');
  const sp = LAYOUT.spawns.atk[0]; atkNode = nearest(sp.x, sp.y, sp.z);
}
export function makeBrain(skill) {
  return { skill, node: 0, goal: 0, target: null, seenT: 0, react: 0, scanT: Math.random() * 0.2, blind: 0, stuckT: 0, lastX: 0, lastZ: 0, wait: 0, role: 0, plantT: 0, lookYaw: 0, strafe: 0, strafeT: 0 };
}
const R = (a) => a[Math.random() * a.length | 0];

export function roundPlan() { plan.site = Math.random() < 0.5 ? 'A' : 'B'; plan.alert = -1; }
export function assignGoal(a, i) {
  const b = a.bot; b.node = nearest(a.x, a.y, a.z); b.target = null; b.wait = 0; b.role = i; b.lookOn = false;
  if (a.team === 0) b.goal = R(siteNodes[plan.site]);
  else {
    const near = i % 2 ? 'A' : 'B', pool = holdDef.filter(n => Math.hypot(nav.x[n] - (near === 'A' ? 44 : -46), nav.z[n] - (near === 'A' ? 26 : 20)) < 30);
    b.goal = pool.length ? R(pool) : R(siteNodes[near]);
  }
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
  if (a.primary) a.cur = a.primary; else a.cur = a.secondary;
}

function angleTo(cur, want, rate) { let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + Math.max(-rate, Math.min(rate, d)); }

export function tickBot(a, dt, cam) {
  const b = a.bot, ag = world.agents;
  tickWeapon(a, dt);
  if (b.blind > 0) b.blind -= dt;
  a.px = a.x; a.py = a.y; a.pz = a.z;
  if (G.phase === 'buy') { step(a, 0, 0, 0, false, dt); return; }

  // 偵測：每 0.15 s 一次
  b.scanT -= dt;
  if (b.scanT <= 0) {
    b.scanT = 0.15;
    let best = null, bd = 1e9;
    const sight = Math.min(75, (WEAPONS[a.cur]?.range ?? 75) * 1.1);   // 射程外的目標不理會，繼續走路線，不要站著空打
    const ex = a.x, ey = a.y + a.eye, ez = a.z, fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
    for (let i = 0; i < ag.length; i++) {
      const v = ag[i]; if (!v.alive || v.team === a.team) continue;
      const dx = v.x - ex, dz = v.z - ez, d = Math.hypot(dx, dz); if (d > sight || d >= bd) continue;
      if (b.blind > 0.5) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.25 && d > 5) continue;
      if (smoked(ex, ey, ez, v.x, v.y + 1.3, v.z)) continue;
      if (clear(ex, ey, ez, v.x, v.y + 1.3, v.z)) { best = v; bd = d; }
    }
    // 裝藥前守方架著槍反應快、攻方邊走邊找反應慢，靠這個把攻守勝率拉平；反應與散布的數字由 tools/balance.mjs 實測決定，見 dist/balance.md
    if (best !== b.target) { if (best && !b.target) b.react = (0.32 + (1 - b.skill) * 0.4 + Math.random() * 0.14) * (G.charge ? 1 : a.team === 1 ? 0.55 : 1.2); b.target = best; }
    if (best) { best.seen = 1.2; plan.alert = nearest(best.x, best.y, best.z); plan.alertT = 8; }
  }

  let wx = 0, wz = 0, speed = maxSpeed(a) * (a.slowT > 0 ? 0.5 : 1), crouch = false;
  const t = b.target && b.target.alive ? b.target : null;
  if (t) {
    const ex = a.x, ey = a.y + a.eye, ez = a.z, dx = t.x - ex, dz = t.z - ez, d = Math.hypot(dx, dz);
    const aimH = t.crouch ? 0.95 : 1.35, wantY = Math.atan2(dx, dz), wantP = Math.atan2(t.y + aimH - ey, d);
    const rate = (1.4 + b.skill * 2.8) * dt * 2.2;
    a.yaw = angleTo(a.yaw, wantY, rate); a.pitch = angleTo(a.pitch, wantP, rate);
    if (b.react > 0) b.react -= dt;
    const err = Math.abs(Math.atan2(Math.sin(wantY - a.yaw), Math.cos(wantY - a.yaw))) + Math.abs(wantP - a.pitch);
    const w = WEAPONS[a.cur];
    if (b.react <= 0 && err < 0.09 + 0.6 / Math.max(d, 4) * 0.2) {
      const miss = (1 - b.skill) * 0.045 + 0.01;
      if ((a.ammo[a.cur] | 0) > 0) { if (d <= (w?.range ?? 0) && a.burst < 3 + (b.skill * 6 | 0) && Math.random() < (w?.auto ? 1 : 0.2)) fire(a, a.yaw + (Math.random() - 0.5) * miss, a.pitch + (Math.random() - 0.5) * miss, cam); }
      else if (d < 9 && a.cur !== a.secondary && (a.ammo[a.secondary] | 0) > 0) { a.cur = a.secondary; a.reloadT = 0; }   // 貼臉打空：拔手槍比換彈快，主武器等沒目標再補
      else if (a.reloadT <= 0 && !startReload(a) && a.cur !== a.secondary) a.cur = a.secondary;   // 換彈中的 reloadT 也會讓 startReload 回傳 false，要先排除，否則每次都換手槍，備彈永遠用不到
    }
    b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = 0.4 + Math.random() * 0.5; b.strafe = Math.random() < 0.5 ? -1 : 1; }
    if (b.burstCool === undefined) b.burstCool = 0;
    wx = Math.cos(a.yaw) * b.strafe * 0.35; wz = -Math.sin(a.yaw) * b.strafe * 0.35; speed *= 0.5;
  } else {
    if (a.primary && a.cur !== a.primary && (a.ammo[a.primary] | 0) + (a.rsv[a.primary] | 0) > 0) { a.cur = a.primary; a.reloadT = 0; }   // 打完架切回主武器
    if ((a.ammo[a.cur] | 0) < 8) startReload(a);
    const c = G.charge;
    // 目標：裝藥安裝後守方去拆、攻方守點
    if (c) { if (a.team === 1) { const s = siteNodes[c.site]; if (!s.includes(b.goal)) b.goal = R(s); } else if (!b.post) { b.post = true; b.goal = R(siteNodes[c.site]); } }
    else if (a.team === 1 && plan.alertT > 0) {
      // 聽到接觸就回防：離接觸點近的炸點，四人中三人移動，留一人看另一側
      const al = plan.alert, dA = Math.hypot(nav.x[al] - 44, nav.z[al] - 26), dB = Math.hypot(nav.x[al] + 46, nav.z[al] - 20), near = dA < dB ? 'A' : 'B';
      if (Math.min(dA, dB) < 34 && b.role % 4 !== 3 && !siteNodes[near].includes(b.goal)) b.goal = R(siteNodes[near]);
    }
    const gx = nav.x[b.node], gz = nav.z[b.node], dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz);
    if (d < 1.1) {
      if (b.node !== b.goal) b.node = nav.next[b.node * nav.n + b.goal];
      else b.wait += dt;
    }
    if (b.node >= 0 && d >= 0.4) {
      const k = 1 / (d || 1); wx = dx * k; wz = dz * k;
      a.yaw = angleTo(a.yaw, Math.atan2(dx, dz), 5 * dt); a.pitch = angleTo(a.pitch, 0, 3 * dt);
    }
    // 守方到位後看向攻方會來的路（沿導航往攻方出生點走兩步的方向），左右慢慢掃。不然會一直面向走來的方向，攻方從背後進場，反應快也沒用
    if (a.team === 1 && !c && b.node === b.goal && b.wait > 0) {
      if (!b.lookOn) { b.lookOn = true; const n1 = nav.next[b.goal * nav.n + atkNode], n2 = n1 >= 0 && n1 !== atkNode ? nav.next[n1 * nav.n + atkNode] : n1, n = n2 >= 0 ? n2 : atkNode; b.lookYaw = Math.atan2(nav.x[n] - a.x, nav.z[n] - a.z); }
      a.yaw = angleTo(a.yaw, b.lookYaw + Math.sin(b.wait * 0.8 + b.role) * 0.55, 3 * dt); a.pitch = angleTo(a.pitch, 0, 3 * dt);
    } else b.lookOn = false;
    // 卡住就換路
    b.stuckT += dt;
    if (b.stuckT > 1) { const m = Math.hypot(a.x - b.lastX, a.z - b.lastZ); b.stuckT = 0; b.lastX = a.x; b.lastZ = a.z; if (m < 0.4 && wx !== 0) { b.node = nearest(a.x, a.y, a.z); wx += (Math.random() - 0.5) * 1.4; wz += (Math.random() - 0.5) * 1.4; } }
    if (a.team === 0 && a.hasCharge && !G.charge && (a.onSite)) { wx = 0; wz = 0; crouch = true; }
    if (a.team === 1 && G.charge && Math.hypot(G.charge.x - a.x, G.charge.z - a.z) < 1.4) {
      // 轉向裝藥、走到手搆得到的距離再跪下；被擋住就在原地拆，不要卡死
      const dx2 = G.charge.x - a.x, dz2 = G.charge.z - a.z, q = Math.hypot(dx2, dz2) || 1;
      a.yaw = angleTo(a.yaw, Math.atan2(dx2, dz2), 12 * dt);
      b.defApp = (b.defApp || 0) + dt;
      const sg = q > 0.46 ? 1 : q < 0.28 ? -1 : 0;
      if (sg && b.defApp < 1.6) { wx = sg * dx2 / q; wz = sg * dz2 / q; speed = 1.6; } else { wx = 0; wz = 0; crouch = true; }
    } else if (a.team === 1 && G.charge && Math.hypot(G.charge.x - a.x, G.charge.z - a.z) < 14) { b.defApp = 0; const dx2 = G.charge.x - a.x, dz2 = G.charge.z - a.z, q = 1 / Math.hypot(dx2, dz2); wx = dx2 * q; wz = dz2 * q; }
  }
  a.crouch = crouch; a.h = crouch ? 1.25 : 1.8;
  for (let i = 0; i < ag.length; i++) { // 不互相穿過
    const v = ag[i]; if (v === a || !v.alive) continue;
    const dx = a.x - v.x, dz = a.z - v.z, q = dx * dx + dz * dz;
    if (q < 0.5 && q > 1e-4 && Math.abs(a.y - v.y) < 1.5) { const k = (0.71 - Math.sqrt(q)) / Math.sqrt(q); a.x += dx * k * 0.5; a.z += dz * k * 0.5; }
  }
  step(a, wx, wz, crouch ? 0 : speed, false, dt);
}
