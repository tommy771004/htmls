// ═══ 第三部曲之五：搶劫同夥的雇用與養成（駭客、車手、槍手，各有老手與菜鳥） ═══
// 計畫板選完潛行或強攻後再挑三個人；Zero 原本固定的一成抽成換成三個人各自的分紅。
//   駭客：破譯時間（69-heist2.js 的 HACK_T）、鑽機時間（69-heist.js 的 40 秒）、人質威懾條掉多快（菜鳥讓警報提早響）
//   車手：逃亡車的極速與耐久
//   槍手：逃出銀行時多一名傭兵掩護（69-squads.js 的 merc）；菜鳥倒下會掉一成贓款
// 菜鳥活著完成一次搶劫就升一級（最多 3 級，每級往老手的能力靠近四分之一），分紅不變；等級寫進存檔的 gear.hire。

const HIRE = {
  hacker: { n: '駭客', list: [
    { id: 'zero', n: 'Zero', vet: 1, cut: .12, hack: 1.4, drill: .75, intim: .8, d: '破譯 28 秒、鑽機 30 秒、人質比較安分' },
    { id: 'pixel', n: 'Pixel', cut: .05, hack: .75, drill: 1.25, intim: 1.3, d: '破譯 15 秒、鑽機 50 秒、威懾掉得快（警報容易響）' },
  ] },
  driver: { n: '車手', list: [
    { id: 'nova', n: 'Nova', vet: 1, cut: .1, vmax: 1.12, hp: 1.35, d: '逃亡車極速 +12%、耐久 +35%' },
    { id: 'dash', n: 'Dash', cut: .04, vmax: .9, hp: .75, d: '逃亡車慢一截、比較不耐打' },
  ] },
  gunman: { n: '槍手', list: [
    { id: 'rook', n: 'Rook', vet: 1, cut: .12, ghp: 520, gun: 'rifle', d: '一起衝出正門掩護，很耐打' },
    { id: 'lu', n: 'Lu', cut: .05, ghp: 160, gun: 'smg', drop: .1, d: '會跟上，但倒下就掉一成贓款' },
  ] },
};
const HIRE_ROLES = ['hacker', 'driver', 'gunman'];
const hireLv = id => Math.min(3, motors.gear.hire[id] || 0);
// 某個角色的某項能力：菜鳥每升一級往老手靠近 1/4
function hireVal(role, k, def = 1) {
  if (heist.storyK && heist.storyK[k] != null) return heist.storyK[k];   // 主線 4-5：娜迪亞開鎖快
  const L = HIRE[role].list, P = heist.hire && L.find(o => o.id === heist.hire[role]);
  if (!P) return def;
  if (P.vet || P[k] == null) return P[k] ?? def;
  const V = L.find(o => o.vet);
  return lerp(P[k], V[k] ?? P[k], hireLv(P.id) / 4);
}
const hireK = k => hireVal(k === 'vmax' || k === 'hp' ? 'driver' : 'hacker', k);
// 計畫板：選完潛行或強攻後依序挑三個人，最後才付籌備費
function hireStart(how) {
  const pick = {};
  const ask = i => {
    if (i >= HIRE_ROLES.length) { closeDialog(); heist.hire = pick; planGo(how); return; }
    const role = HIRE_ROLES[i], R = HIRE[role];
    dialog(`挑${R.n}（${i + 1}／3）`, R.list.map(o => `${o.n}${o.vet ? '（老手）' : `（菜鳥 Lv ${hireLv(o.id)}）`}：分紅 ${Math.round(o.cut * 100)}% · ${o.d}`).join('\n'),
      [...R.list.map(o => ({ t: `${o.n} · ${Math.round(o.cut * 100)}%`, fn: () => { pick[role] = o.id; ask(i + 1); } })), { t: '再想想', fn: closeDialog }]);
  };
  ask(0);
}
const hireOf = role => heist.hire && HIRE[role].list.find(o => o.id === heist.hire[role]);
// 結算：三個人的分紅（沒挑過的舊流程照 Zero 一成）
function hireCuts(net) {
  if (heist.storyCuts) return heist.storyCuts.map(([n, c]) => [`${n} 分紅（${Math.round(c * 100)}%）`, Math.round(net * c)]);   // 主線 4-5：固定的隊員
  if (!heist.hire) return [['駭客 Zero 分紅（10%）', Math.round(net * ZERO_CUT)]];
  return HIRE_ROLES.map(r => { const P = hireOf(r); return [`${HIRE[r].n} ${P.n} 分紅（${Math.round(P.cut * 100)}%）`, Math.round(net * P.cut)]; });
}
// 逃亡車：車手決定
function hireCar(v) {
  if (!v || !heist.hire) return;
  v.vmax *= hireK('vmax'); v.hp = v.hpMax = Math.round(v.hp * hireK('hp')); v.hpLock = 1;
}
// 槍手：逃出銀行時多一名傭兵；上車後他自己走（不跟車）
const hire3 = { st: '', f: null, fell: false };
function heist3Update() {
  if (heist.st === hire3.st) return;
  const was = hire3.st; hire3.st = heist.st;
  const P = hireOf('gunman');
  if (heist.st === 'escape' && P) {
    const at = bankAt(-.5, 3.2), f = fSpawn('merc', at.x, at.z, at.yaw, { gun: P.gun });
    if (f) {
      f.hp = hireVal('gunman', 'ghp', 200); f.hire = P.id; hire3.f = f; hire3.fell = false;
      f.onDown = () => { hire3.fell = true; if (P.drop && heist.take) { const n = Math.round(heist.take * P.drop); heist.loss += n; toast(`${P.n} 倒下了，掉了一袋 ${money(n)}`); } else toast(`${P.n} 倒下了`); };
      wakeArms();
    }
  }
  if (heist.st !== 'escape' && hire3.f) { if (hire3.f.on && hire3.f.hire && hire3.f.state !== 'down') fFree(hire3.f); hire3.f = null; }
  if (was && heist.st === 'off' && heist.hire && heist.passed) hirePass();
  if (heist.st === 'off' || heist.st === 'go') heist.passed = false;
}
// 成功：活下來的菜鳥升一級
function hirePass() {
  const up = [];
  for (const r of HIRE_ROLES) {
    const P = hireOf(r);
    if (!P || P.vet || hireLv(P.id) >= 3 || r === 'gunman' && hire3.fell) continue;
    motors.gear.hire[P.id] = hireLv(P.id) + 1; up.push(`${P.n} 升到 Lv ${hireLv(P.id)}`);
  }
  if (up.length) { saveMotors(); newsAdd('地下圈子', `${up.join('、')}：下次雇用時能力更好，分紅不變。`); }
}
gtaApi.v3.hire = { HIRE, hire3, hireVal, hireK, hireCuts, start: hireStart, set: o => { heist.hire = o; } };
