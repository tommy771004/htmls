// 收線張力條狀態機（不碰 DOM／three）。step(dt, hold) 每幀推進，hold = 是否按住收線。
// 進度 0～100（歸 0 脫鉤、滿 100 拉上船）、張力 0～100（滿 100 超過斷線時間就斷線；≥ 80 是紅區）。
// 魚的階段：calm 平靜、struggle 暴衝、wave 魚王的大波、jump 躍水、dive 深淵下潛（強制退線）、lock 鑽石縫（張力鎖死）、
// feint 假平靜（畫面顯示平靜但其實還在暴衝）。
import { reelParams } from './fishdb.js';
import { TIERS } from './quality.js';

export const RED = 80;
const R_CALM = 9, D_CALM = 26, D_STRUG = 15, BASE_T = 10;

export function createReel(fish, { perfect = false, potentialTier = 0, rodMult = 1, lineBonus = 0, rng = Math.random } = {}) {
  const p = reelParams(fish);
  const k = 1 + TIERS[potentialTier].struggle;            // 銀星 +15%、金星 +30%、王冠 +45%
  const rand = (a) => a[0] + (a[1] - a[0]) * rng();
  const s = {
    fish, p, k, t: 0, progress: 30 + (perfect ? 12 : 0), tension: p.startT, phase: 'calm', show: 'calm', phaseT: 0,
    overT: 0, brk: p.brk + lineBonus, maxTension: p.startT, redEntries: p.startT >= RED ? 1 : 0, inRed: p.startT >= RED,
    result: null, events: [], count: 0, jumpI: 0, waveI: 0, nearDone: false, mult: 1,
  };
  const calmLen = () => {
    let d = p.special === 'erratic' ? 0.5 + rng() * 3 : rand(p.calm);
    d /= 1 + TIERS[potentialTier].struggle;                 // 品質越高暴衝越頻繁
    if (p.special === 'ramp') d *= 1 - 0.5 * Math.min(1, s.progress / 80);
    return Math.max(0.35, d);
  };
  const strugLen = () => (p.special === 'erratic' ? 0.4 + rng() * 2.8 : rand(p.strug)) * Math.sqrt(k);
  const enter = (phase, dur, ev) => { s.phase = phase; s.phaseT = dur; s.mult = 1; s.show = phase === 'feint' ? 'calm' : phase; if (ev) s.events.push(ev); };

  function struggle() {
    s.count++;
    let sp = p.special;
    if (sp === 'all') sp = ['jump', 'dive', 'lock', 'burst'][(s.count - 1) % 4];
    if (s.count === 1 && p.first) return enter('struggle', p.first, 'run');
    if (sp === 'lock' && (p.special === 'all' || s.count % 2 === 1)) return enter('lock', 1.5, 'lock');
    if (sp === 'dive' && (p.special === 'all' || s.count % 2 === 1)) return enter('dive', 1.8, 'dive');
    if (sp === 'jump') { s.tension = Math.min(100, s.tension + 18 * k); return enter('jump', 1.0, 'jump'); }
    if (sp === 'burst') { s.tension = Math.max(s.tension, 70); enter('struggle', strugLen(), 'burst'); return; }
    enter('struggle', strugLen(), 'struggle');
  }
  function next() {
    if (s.phase === 'calm') return struggle();
    if (s.phase === 'struggle' && p.special === 'feint') return enter('feint', 0.8, null);
    if (s.phase === 'struggle' && p.special === 'rebound') s.tension = Math.min(100, s.tension + 12);
    enter('calm', calmLen(), 'calm');
  }
  enter('calm', p.first ? 0.3 : calmLen(), null);

  s.step = (dt, hold) => {
    s.events = [];
    if (s.result) return s;
    s.t += dt;
    // 進度門檻觸發的特技（躍水、魚王大波、近船暴衝）
    if (s.jumpI < p.jumps.length && s.progress >= p.jumps[s.jumpI] * 100 && s.phase !== 'jump') {
      s.jumpI++; s.tension = Math.min(100, s.tension + 22 * k); enter('jump', 1.1, 'jump');
    } else if (p.waves && s.waveI < p.waves && s.progress >= ((s.waveI + 1) / (p.waves + 1)) * 100 && s.phase !== 'wave') {
      s.waveI++; enter('wave', 2.6, 'wave');
    } else if (p.special === 'near' && !s.nearDone && s.progress >= 75) {
      s.nearDone = true; enter('struggle', 1.8, 'surge'); s.mult = 1.3;
    }
    s.phaseT -= dt;
    if (s.phaseT <= 0) next();

    const ph = s.phase;
    let reel = p.reel * rodMult;
    if (p.special === 'anchor' && s.progress < 30) reel *= 0.45;
    if (p.special === 'current') reel *= 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(s.t * 1.25));
    const smooth = p.special === 'smooth' ? 1.5 : 1;
    let dT = 0, dP = 0;
    if (ph === 'lock') {
      // 鑽進石縫：張力與進度都鎖住，按什麼都沒用
    } else if (ph === 'calm') {
      if (hold) { dP = reel; dT = R_CALM * smooth; } else { dP = -p.slip; dT = -D_CALM * smooth; }
    } else {
      let rise = R_CALM * p.tens * k * s.mult * smooth, pull = p.slipS * 0.55 * k;
      if (p.special === 'rush') pull *= 1.6;
      if (ph === 'wave') { rise *= 1.3; pull *= 1.5; }
      if (ph === 'jump') { rise *= 1.4; pull *= 0.5; }
      if (ph === 'dive') { rise *= 1.3; }
      if (hold) { dP = reel * 0.25; dT = rise; } else { dP = -pull; dT = -D_STRUG * smooth; }
      if (ph === 'dive') dP = Math.min(dP, 0) - 5;
    }
    if (p.special === 'wave' && ph !== 'lock') dT += Math.sin(s.t * 2.4) * 11;
    s.progress = Math.min(100, s.progress + dP * dt);
    s.tension = Math.max(hold || ph === 'lock' ? 0 : BASE_T * 0.6, Math.min(100, s.tension + dT * dt));
    if (!hold && ph !== 'lock' && s.tension < BASE_T) s.tension = Math.min(BASE_T, s.tension + 4 * dt);

    if (s.tension >= RED && !s.inRed) { s.inRed = true; s.redEntries++; s.events.push('red'); }
    else if (s.tension < RED - 4) s.inRed = false;
    s.maxTension = Math.max(s.maxTension, s.tension);
    if (s.tension >= 100) { s.overT += dt; if (s.overT >= s.brk) { s.result = 'snap'; s.events.push('snap'); } }
    else s.overT = Math.max(0, s.overT - dt * 2);
    if (!s.result && s.progress <= 0) { s.progress = 0; s.result = 'escape'; s.events.push('escape'); }
    if (!s.result && s.progress >= 100) { s.result = 'caught'; s.events.push('caught'); }
    return s;
  };
  return s;
}
