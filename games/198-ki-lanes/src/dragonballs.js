// 龍珠獵人（規則面，不碰 DOM；畫面與 Node 模擬共用）。
// 全隊補兵與擊倒大猿累積龍珠，先集滿七顆的隊伍召喚神龍降臨神龍坑；神龍是兩隊都能打的超級王，
// 打倒的隊伍得到願望（全隊強化 90 秒並讓陣亡的隊友立刻復活），之後龍珠散落、兩隊重新收集。
import { DRAGON } from './config.js';
import { addUnit, damage, dist, face, targetable, respawnHero, recalcStats } from './units.js';

const ELEMENTS = Object.keys(DRAGON.elements);
// 下一輪的屬性：隨機但不連續重複；有隊伍拿到龍魂後改為究極神龍
function nextElement(G, prev) {
  if (G.dball && G.dball.soulTeam >= 0) return 'elder';
  const pool = ELEMENTS.filter((e) => e !== prev);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function setupDragonBalls(G) {
  G.dball = { balls: [0, 0], cs: [0, 0], phase: 'collect', owner: -1, summonAt: 0, round: 0, drakes: [[], []], soulTeam: -1 };
  G.dball.element = nextElement(G, null);
  G.shenron = null;
  G.on('death', ({ u, src }) => {
    if (u.kind !== 'minion' || !src || src.kind !== 'hero') return;
    const D = G.dball; D.cs[src.team]++;
    if (D.cs[src.team] >= DRAGON.perCs) { D.cs[src.team] -= DRAGON.perCs; gain(G, src.team, 1, 'cs'); }
  });
  G.on('monsterDeath', ({ u, team }) => {
    if (u.mkind === 'ape' && team >= 0) gain(G, team, DRAGON.apeBalls, 'ape');
    if (u.mkind === 'shenron') grantWish(G, team);
  });
}

function gain(G, team, n, why) {
  const D = G.dball;
  if (D.phase !== 'collect') return;
  const before = D.balls[team];
  D.balls[team] = Math.min(DRAGON.max, before + n);
  if (D.balls[team] > before) G.emit('dragonBall', { team, n: D.balls[team] - before, total: D.balls[team], why });
  if (D.balls[team] >= DRAGON.max) {
    D.phase = 'summon'; D.owner = team; D.summonAt = G.time + DRAGON.summonDelay;
    for (const h of G.heroes) if (h.team === team) h.omen = DRAGON.omen.dur;
    G.emit('dragonSummon', { team, at: D.summonAt });
  }
}

function spawnShenron(G) {
  const S = DRAGON.shenron, k = (1 + G.time / 900) * (G.dball.element === 'elder' ? 1.35 : 1), p = DRAGON.pit;
  const u = {
    id: 190000 + G.dball.round, kind: 'monster', mkind: 'shenron', team: 2, camp: null, boss: false, big: true,
    x: p.x, z: p.z, home: { x: p.x, z: p.z }, y: 0, vy: 0, radius: S.radius, hp: S.hp * k, maxHp: S.hp * k, alive: true, facing: Math.PI * 0.25,
    st: { stun: 0, slow: 0, slowAmt: 0, frozen: 0, shield: 0, shieldT: 0, spark: 0, mark: 0, invuln: 0 },
    kx: 0, kz: 0, atkCd: 2, anim: { name: 'rise', t: 0 }, lastHitBy: null, lastHitT: -99, deadT: 0, flash: 0,
    dmg: S.dmg * k, range: S.range, as: S.cd, ms: 0, xp: S.xp, gold: S.gold, armor: S.armor, target: null, state: 'fight', windup: 0, immovable: true,
  };
  G.shenron = u; addUnit(G, u);
  G.dball.phase = 'shenron';
  G.emit('shenronSpawn', u);
}

function grantWish(G, team) {
  const D = G.dball, el = D.element;
  if (team >= 0) {
    for (const h of G.heroes) if (h.team === team) { if (!h.alive) { respawnHero(G, h); h.respawn = 0; } h.wish = DRAGON.wish.dur; h.hp = h.maxHp; }
    if (el === 'elder') { for (const h of G.heroes) if (h.team === team) h.elder = DRAGON.elderDur; }
    else {
      // 屬性祝福（永久）：疊在全隊英雄身上；第 3 層得到龍魂
      D.drakes[team].push(el);
      const soul = D.soulTeam < 0 && D.drakes[team].length >= DRAGON.soulAt ? el : null;
      if (soul) D.soulTeam = team;
      for (const h of G.heroes) if (h.team === team) { h.drk = h.drk || {}; h.drk[el] = (h.drk[el] || 0) + 1; if (soul) h.soul = soul; recalcStats(h); }
      if (soul) G.emit('dragonSoul', { team, el: soul });
    }
  }
  G.emit('dragonWish', { team, el });
  D.balls = [0, 0]; D.cs = [0, 0]; D.phase = 'collect'; D.owner = -1; D.round++;
  D.element = nextElement(G, el);
  G.emit('dragonElement', { el: D.element });
}

export function updateDragonBalls(G, dt) {
  const D = G.dball;
  for (const h of G.heroes) { if (h.omen > 0) h.omen -= dt; if (h.wish > 0) h.wish -= dt; if (h.elder > 0) h.elder -= dt; }
  if (D.phase === 'summon' && G.time >= D.summonAt) spawnShenron(G);
  const s = G.shenron;
  if (!s) return;
  if (!s.alive) {
    s.deadT += dt;
    if (s.deadT > 3) { const j = G.units.indexOf(s); if (j >= 0) G.units.splice(j, 1); G.emit('despawn', s); G.shenron = null; }
    return;
  }
  s.anim.t += dt; s.atkCd -= dt; if (s.flash > 0) s.flash -= dt;
  if (s.anim.name === 'rise' && s.anim.t < 2.2) return;
  if (s.anim.name !== 'atk' || s.anim.t > 1.1) s.anim.name = 'idle';
  // 鎖定射程內最近的英雄（沒有就打小兵），用雷擊轟炸目標腳下
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (!u.alive || u.team > 1 || (u.kind !== 'hero' && u.kind !== 'minion') || !targetable(G, u)) continue;
    const d = dist(u, s) - u.radius - s.radius + (u.kind === 'hero' ? 0 : 6);
    if (d < s.range && d < bd) { bd = d; best = u; }
  }
  if (!best || s.atkCd > 0) return;
  s.atkCd = s.as; face(s, best.x, best.z); s.anim.name = 'atk'; s.anim.t = 0;
  const S = DRAGON.shenron, x = best.x, z = best.z;
  G.emit('shenronBolt', { s, x, z, r: S.bolt, delay: S.telegraph });
  G.later(S.telegraph, () => {
    if (!s.alive) return;
    for (const u of G.units) if (u.alive && u.team <= 1 && (u.kind === 'hero' || u.kind === 'minion') && Math.hypot(u.x - x, u.z - z) < S.bolt + u.radius) damage(G, s, u, s.dmg * (u.kind === 'minion' ? 0.6 : 1), { type: 'H', air: 0.4 });
    G.emit('shenronStrike', { s, x, z, r: S.bolt });
  });
}

// 測試用：直接給某隊龍珠
export function giveBalls(G, team, n) { gain(G, team, n, 'debug'); }

// 給 AI 與 HUD：目前場上值得爭奪的神龍
export function shenronAlive(G) { return G.shenron && G.shenron.alive && G.shenron.anim.name !== 'rise' ? G.shenron : null; }
