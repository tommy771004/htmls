// 召喚師技能（《英雄聯盟》）：規則面，不碰 DOM。F 鍵施放，選角時挑一個（h.summ）。
import { SUMMONERS, FOUNTAIN } from './config.js';
import { damage, heal, dist, cancelRecall } from './units.js';
import { collide } from './map.js';
import { buff } from './traits.js';

export const summById = (id) => SUMMONERS.find((s) => s.id === id);
const fx = (G) => G.fx;
const sfx = (G, name, at, o) => G.sfx && G.sfx(name, at, o);
const nearestFoe = (G, h, r) => G.heroes.filter((u) => u.alive && u.team !== h.team && dist(u, h) < r + u.radius).sort((a, b) => dist(a, h) - dist(b, h))[0];

export function summReady(G, h) { return h.alive && h.summ && h.cds.F <= 0 && !(h.stasis > G.time); }

// tx, tz：游標位置。回傳 false 表示沒放出去（不進冷卻）
export function castSummoner(G, h, tx, tz) {
  if (!summReady(G, h)) return false;
  const S = summById(h.summ);
  switch (S.id) {
    case 'flash': {
      if (h.st.stun > 0 && !(h.st.frozen > 0)) return false;
      const d = Math.hypot(tx - h.x, tz - h.z) || 1, r = Math.min(S.range, d);
      const ox = h.x, oz = h.z;
      h.x += ((tx - h.x) / d) * r; h.z += ((tz - h.z) / d) * r; collide(h, h.radius);
      h.facing = Math.atan2(tx - ox, tz - oz);
      fx(G).vanish(ox, oz, '#ffe36a', h); fx(G).vanish(h.x, h.z, '#ffe36a', h, true);
      sfx(G, 'vanish', h, { pitch: 1.3 });
      break;
    }
    case 'ignite': {
      const t = nearestFoe(G, h, S.range); if (!t) return false;
      t.st.burn = Math.max(t.st.burn || 0, S.dur); t.st.burnDps = Math.max(t.st.burnDps || 0, (S.dmg + S.lv * h.level) / S.dur); t.st.burnSrc = h;
      t.st.gw = S.dur; t.st.gwAmt = Math.max(t.st.gwAmt || 0, 0.4);
      fx(G).hitSpark(t.x, 1.2, t.z, '#ff7a3a', 1.2, 'light');
      break;
    }
    case 'heal': {
      const ally = G.heroes.filter((u) => u.alive && u.team === h.team && u !== h && dist(u, h) < S.range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      for (const u of [h, ally]) if (u) { heal(G, u, S.heal + S.lv * h.level); u.st.haste = Math.max(u.st.haste || 0, 1); u.st.hasteMs = Math.max(u.st.hasteMs || 0, 0.3); u.st.hasteAs = u.st.hasteAs || 0; fx(G).levelUp(u, '#7fffb0'); }
      break;
    }
    case 'barrier':
      h.st.shield = (h.st.shield || 0) + S.shield + S.lv * h.level; h.st.shieldT = Math.max(h.st.shieldT, S.dur);
      fx(G).shieldFx(h, '#ffe9a0', S.dur);
      break;
    case 'cleanse':
      h.st.stun = h.st.frozen > 0 || h.vy <= 0 ? 0 : h.st.stun; h.st.frozen = 0; h.st.slow = 0; h.st.slowAmt = 0;
      buff(G, h, 'cleanse', { ten: 0.65 }, 3);
      fx(G).ring(h.x, h.z, '#e8f4ff', 2, 0.35);
      break;
    case 'exhaust': {
      const t = nearestFoe(G, h, S.range); if (!t) return false;
      t.st.slow = Math.max(t.st.slow, S.dur); t.st.slowAmt = Math.max(t.st.slowAmt, S.slow * (1 - (t.slowRes || 0)));
      t.st.weak = S.dur; t.st.weakAmt = S.weak;
      fx(G).mist(t.x, t.z, 1.2, '#6a5a3a', S.dur);
      break;
    }
    case 'ghost':
      h.st.haste = Math.max(h.st.haste || 0, S.dur); h.st.hasteMs = Math.max(h.st.hasteMs || 0, S.ms); h.st.hasteAs = h.st.hasteAs || 0;
      fx(G).ring(h.x, h.z, '#bfe8ff', 1.6, 0.3);
      break;
    case 'teleport': {
      // 目的地：游標附近的我方防禦塔或小兵（10 公尺內最近的）
      const spots = G.units.filter((u) => u.alive && u.team === h.team && (u.kind === 'tower' || u.kind === 'minion'));
      const dest = spots.sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz))[0];
      if (!dest || Math.hypot(dest.x - tx, dest.z - tz) > 10 || h.action) return false;
      cancelRecall(G, h); h.goal = null; h.target = null;
      h.tp = { t: S.channel, x: dest.x + (dest.kind === 'tower' ? 2.5 : 1) * (h.team ? 1 : -1), z: dest.z + (dest.kind === 'tower' ? 2.5 : 1) * (h.team ? -1 : 1), mark: fx(G).target(dest.x, dest.z, 2.2, '#9f7bff', S.channel) };
      G.emit('teleport', { h, state: 'start' });
      break;
    }
    case 'smite': {
      const t = G.units.filter((u) => u.alive && u.team !== h.team && (u.kind === 'monster' || u.kind === 'minion' || u.kind === 'hero') && dist(u, h) < S.range + u.radius).sort((a, b) => (a.kind === 'hero') - (b.kind === 'hero') || dist(a, h) - dist(b, h))[0];
      if (!t) return false;
      damage(G, h, t, t.kind === 'hero' ? 80 : S.dmg + S.lv * h.level, { type: 'true', noKi: true, rune: true });
      fx(G).lightning({ x: t.x + 0.4, y: 10, z: t.z - 0.4 }, { x: t.x, y: 1, z: t.z }, '#ffe08a');
      sfx(G, 'thunder', t, { vol: 0.5, pitch: 1.4 });
      break;
    }
  }
  h.cds.F = S.cd * 100 / (100 + (h.sumAh || 0));
  G.emit('summoner', { h, id: S.id });
  return true;
}

// AI：依情境用召喚師技能
export function aiSummoner(G, h, foe, fd) {
  if (!summReady(G, h)) return;
  const hpR = h.hp / h.maxHp, S = summById(h.summ);
  switch (S.id) {
    case 'flash': if (foe && fd < 5 && hpR < 0.2) { const f = FOUNTAIN[h.team], d = Math.hypot(f[0] - h.x, f[1] - h.z) || 1; castSummoner(G, h, h.x + (f[0] - h.x) / d * 4, h.z + (f[1] - h.z) / d * 4); } break;
    case 'ignite': if (foe && fd < S.range && foe.hp / foe.maxHp < 0.35) castSummoner(G, h, foe.x, foe.z); break;
    case 'heal': if (hpR < 0.25 && foe && fd < 10) castSummoner(G, h, h.x, h.z); break;
    case 'barrier': if (hpR < 0.22 && foe && fd < 8) castSummoner(G, h, h.x, h.z); break;
    case 'cleanse': if ((h.st.stun > 0.8 || h.st.frozen > 0.8) && foe) castSummoner(G, h, h.x, h.z); break;
    case 'exhaust': if (foe && fd < S.range && (hpR < 0.4 || foe.hp / foe.maxHp < 0.4)) castSummoner(G, h, foe.x, foe.z); break;
    case 'ghost': if (foe && fd < 10 && (hpR < 0.3 || foe.hp / foe.maxHp < 0.25)) castSummoner(G, h, h.x, h.z); break;
    case 'smite': {
      const m = G.units.find((u) => u.alive && u.kind === 'monster' && dist(u, h) < S.range + u.radius && u.hp < S.dmg + S.lv * h.level);
      if (m) castSummoner(G, h, m.x, m.z);
      break;
    }
    // 傳送：AI 在泉水補完、自己那一路有我方小兵時，傳回兵線
    case 'teleport': {
      const f = FOUNTAIN[h.team];
      if (Math.hypot(h.x - f[0], h.z - f[1]) < 10 && hpR > 0.9 && G.time > 60) {
        const m = G.minions.filter((u) => u.alive && u.team === h.team && u.lane === h.lane).sort((a, b) => Math.hypot(b.x - f[0], b.z - f[1]) - Math.hypot(a.x - f[0], a.z - f[1]))[0];
        if (m) castSummoner(G, h, m.x, m.z);
      }
      break;
    }
  }
}
