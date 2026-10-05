// 符文與裝備被動（《英雄聯盟》的基石符文、咒刃、暴擊、主動道具、野怪增益）。規則面，不碰 DOM。
// units.damage() 透過 G.traits.onHeroHit 呼叫這裡，避免 units ↔ traits 互相 import。
import { TEAR_MAX, JUNGLE_BUFF } from './config.js';
import { damage, heal, recalcStats, interrupt } from './units.js';

const sfx = (G, name, at, o) => G.sfx && G.sfx(name, at, o);
const fx = (G) => G.fx;
const isBasic = (o) => o.type === 'L' || o.type === 'M' || o.type === 'H';
export const baseAd = (h) => h.def.stats.ad + h.def.stats.adLv * (h.level - 1);
const bonusAd = (h) => Math.max(0, h.ad - baseAd(h));

// 同一名目標的命中紀錄：間隔 0.25 秒以上才算「不同的一次」（多段技能不會一口氣疊滿）
function countHits(G, h, dst, win) {
  const rs = h.rs, last = rs.hits[rs.hits.length - 1];
  if (!last || last.id !== dst.id || G.time - last.t >= 0.25) rs.hits.push({ id: dst.id, t: G.time });
  rs.hits = rs.hits.filter((x) => G.time - x.t < win && x.id === dst.id);
  return rs.hits.length;
}

// 英雄對英雄造成傷害後（普攻或技能）
export function onHeroHit(G, h, dst, a, opts) {
  const rs = h.rs, skill = opts.type === 'skill' || opts.type === 'super';
  if (!skill && !isBasic(opts)) return;
  switch (h.rune) {
    case 'conqueror': {
      rs.stacks = Math.min(8, (G.time - rs.t < 5 ? rs.stacks : 0) + (skill ? 2 : 1)); rs.t = G.time;
      if (rs.stacks >= 8) heal(G, h, a * 0.08);
      break;
    }
    case 'electrocute': {
      if (G.time < rs.cd) break;
      if (countHits(G, h, dst, 3) >= 3) {
        rs.cd = G.time + 20; rs.hits = [];
        G.later(0.05, () => {
          if (!dst.alive) return;
          damage(G, h, dst, 30 + 12 * h.level + 0.3 * bonusAd(h) + 0.25 * h.ap, { type: 'skill', rune: true, noKi: true });
          fx(G).lightning({ x: dst.x + 0.5, y: 9, z: dst.z - 0.5 }, { x: dst.x, y: 1 + dst.y, z: dst.z }, '#ff5a8a');
          sfx(G, 'thunder', dst, { vol: 0.55, pitch: 1.3 });
          G.emit('runeProc', { h, id: 'electrocute', dst });
        });
      }
      break;
    }
    case 'phase': {
      if (G.time < rs.cd) break;
      if (countHits(G, h, dst, 4) >= 3) {
        rs.cd = G.time + 14; rs.hits = [];
        h.st.haste = Math.max(h.st.haste || 0, 3); h.st.hasteMs = Math.max(h.st.hasteMs || 0, 0.35); h.st.hasteAs = h.st.hasteAs || 0;
        fx(G).ring(h.x, h.z, '#9fe6ff', 2.2, 0.4);
        G.emit('runeProc', { h, id: 'phase' });
      }
      break;
    }
    case 'comet': {
      if (!skill || G.time < rs.cd) break;
      rs.cd = G.time + 16;
      const x = dst.x, z = dst.z;
      fx(G).comet(x, z, '#b98bff', 0.8);
      G.later(0.8, () => {
        let hit = false;
        for (const u of G.heroes) if (u.alive && u.team !== h.team && Math.hypot(u.x - x, u.z - z) < 1.8 + u.radius) { damage(G, h, u, 30 + 10 * h.level + 0.35 * h.ap + 0.2 * bonusAd(h), { type: 'skill', rune: true, noKi: true }); hit = true; }
        fx(G).explode(x, z, '#b98bff', 1.8);
        sfx(G, 'explode', { x, z }, { vol: 0.4, pitch: 1.4 });
        if (hit) G.emit('runeProc', { h, id: 'comet' });
      });
      break;
    }
    case 'tempo': {
      if (!isBasic(opts)) break;
      rs.stacks = Math.min(6, (G.time - rs.t < 6 ? rs.stacks : 0) + 1); rs.t = G.time;
      break;
    }
  }
}

// 普攻間隔倍率（連打節奏）
export function asMul(G, h) {
  return h.rune === 'tempo' && G.time - h.rs.t < 6 ? 1 - 0.07 * h.rs.stacks : 1;
}

// 普攻命中前：暴擊、咒刃、不死之身、赤色氣焰。回傳最後的傷害
export function beforeAuto(G, h, t, dmg, opts) {
  if (h.crit > 0 && Math.random() < h.crit) { dmg *= h.critMul; opts.crit = true; }
  if (h.psv.blade && h.bladeT > G.time && G.time >= h.bladeCd) {
    dmg += baseAd(h) * h.psv.blade; h.bladeT = 0; h.bladeCd = G.time + 1.5; opts.blade = true;
    fx(G).ring(t.x, t.z, h.psv.blade >= 2 ? '#ffd34a' : '#bfe8ff', 1.8, 0.3);
    G.emit('spellblade', { h, t });
  }
  if (h.rune === 'grasp' && h.rs.charge >= 4 && t.kind === 'hero') {
    const k = h.def.melee ? 1 : 0.5;
    dmg += h.maxHp * 0.04 * k; heal(G, h, h.maxHp * 0.02 * k);
    h.graspHp += 6 * k; recalcStats(h); h.rs.charge = 0;
    fx(G).ring(h.x, h.z, '#7bd36a', 2, 0.4);
    G.emit('runeProc', { h, id: 'grasp' });
  }
  if (h.red > 0 && (t.kind === 'hero' || t.kind === 'minion' || t.kind === 'monster')) {
    const R = JUNGLE_BUFF.red;
    t.st.burn = R.burnT; t.st.burnDps = (R.burn + R.burnLv * h.level) / R.burnT; t.st.burnSrc = h;
    if (t.kind !== 'monster' || !t.boss) { t.st.slow = Math.max(t.st.slow, 1.5); t.st.slowAmt = Math.max(t.st.slowAmt, R.slow); }
  }
  return dmg;
}

// 施放技能後：咒刃上膛、積蓄層數
export function onCast(G, h) {
  if (h.psv.blade && G.time >= h.bladeCd) h.bladeT = G.time + 10;
  if (h.psv.tear && h.res === 'mana' && h.tear < TEAR_MAX) { h.tear = Math.min(TEAR_MAX, h.tear + h.psv.tear); recalcStats(h); }
}

// 每步：不死之身在交戰中累積
export function tick(G, h, dt) {
  if (h.rune !== 'grasp') return;
  const fighting = G.time - h.lastAttackHeroT < 4 || (h.lastHitBy && h.lastHitBy.kind === 'hero' && G.time - h.lastHitT < 4);
  if (fighting) h.rs.charge = Math.min(4, h.rs.charge + dt); else h.rs.charge = 0;
}

// 主動道具：i 是身上第幾個主動道具（0、1）
export function activeReady(G, h, i) { const a = h.acts && h.acts[i]; return !!a && h.alive && G.time >= (h.actCd[a.id] || 0); }
export function useActive(G, h, i) {
  if (!activeReady(G, h, i)) return false;
  const a = h.acts[i];
  if (a.id === 'stasis') {
    if (h.y > 0.05) return false;
    interrupt(G, h); h.goal = null; h.target = null; h.recall = 0; h.charging = false;
    h.st.invuln = a.dur; h.st.stun = Math.max(h.st.stun, a.dur); h.stasis = G.time + a.dur;
    fx(G).shieldFx(h, '#ffd34a', a.dur); fx(G).ring(h.x, h.z, '#ffd34a', 2.4, 0.5);
    sfx(G, 'freeze', h, { vol: 0.5, pitch: 1.3 });
    G.emit('stasis', { h, dur: a.dur, kind: 'hourglass' });
  } else if (a.id === 'cleanse') {
    if (h.stasis > G.time) return false;
    const st = h.st; st.stun = 0; st.frozen = 0; st.slow = 0; st.slowAmt = 0;
    st.haste = Math.max(st.haste || 0, a.dur); st.hasteMs = Math.max(st.hasteMs || 0, 0.4); st.hasteAs = st.hasteAs || 0;
    fx(G).ring(h.x, h.z, '#e8f4ff', 2.2, 0.4); fx(G).hitSpark(h.x, 1.2, h.z, '#e8f4ff', 1.4, 'light');
    sfx(G, 'vanish', h, { vol: 0.5 });
    G.emit('cleanse', h);
  }
  h.actCd[a.id] = G.time + a.cd;
  return true;
}

// AI：被控或殘血時用主動道具
export function aiActives(G, h, foeNear) {
  if (!h.acts || !h.acts.length) return;
  h.acts.forEach((a, i) => {
    if (!activeReady(G, h, i)) return;
    if (a.id === 'cleanse' && (h.st.stun > 0.6 || h.st.frozen > 0.6) && foeNear && !(h.stasis > G.time)) useActive(G, h, i);
    if (a.id === 'stasis' && h.hp / h.maxHp < 0.2 && foeNear) useActive(G, h, i);
  });
}

export const traits = { onHeroHit, tick };
