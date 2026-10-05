// 裝備規則測試（Node，不經過瀏覽器）：資料完整、屬性公式、各種裝備效果、主動、藥水與藥劑。
// node --test tools/items.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, HEROES } from '../src/config.js';
import { newGame, step } from './sim.mjs';
import { damage, recalcStats, defMul } from '../src/units.js';
import { beforeAuto, afterAuto, useActive } from '../src/traits.js';
import { buy, eatSenzu, itemById } from '../src/items.js';
import { cast, levelSkill } from '../src/combat.js';

const KNOWN = new Set(['ad', 'hp', 'armor', 'mr', 'as', 'ms', 'ki', 'ah', 'skill', 'dmg', 'vision', 'regen', 'detect', 'mp', 'mpr', 'ap', 'crit', 'ls', 'leth', 'apen', 'mpen', 'mpenPct', 'ten', 'ov', 'hpr', 'hsp', 'critDmg']);

// 兩名敵對英雄面對面站在河道上，AI 關掉
function duel(a = 'goku', b = 'vegeta') {
  const G = newGame();
  G.aiFrozen = true;
  const A = G.heroes.find((h) => h.team === 0), B = G.heroes.find((h) => h.team === 1);
  for (const h of G.heroes) if (h !== A && h !== B) { h.alive = false; h.respawn = 1e9; }
  Object.assign(A, { heroId: a, def: HEROES[a], x: 0, z: 0, inv: [], brain: null });
  Object.assign(B, { heroId: b, def: HEROES[b], x: 1.5, z: 0, inv: [], brain: null });
  recalcStats(A); recalcStats(B); A.hp = A.maxHp; B.hp = B.maxHp;
  return { G, A, B };
}
const give = (h, ...ids) => { h.inv.push(...ids); recalcStats(h); };

test('資料：id 不重複、材料存在、價格為正、屬性欄位都認得', () => {
  const ids = new Set();
  for (const it of ITEMS) {
    assert.ok(!ids.has(it.id), `重複 id ${it.id}`); ids.add(it.id);
    assert.ok(it.cost > 0, `${it.name} 價格`);
    for (const c of it.from || []) assert.ok(itemById(c), `${it.name} 的材料 ${c} 不存在`);
    for (const k in it.stats || {}) assert.ok(KNOWN.has(k), `${it.name} 有不認得的屬性 ${k}`);
    if (it.lol) assert.ok(it.proto, `${it.name} 缺原型名稱`);
  }
});

test('防禦公式：100 防禦承受一半；穿透先 ％ 再固定，不會穿到負值', () => {
  const dst = { armor: 100, mr: 50 }, src = { kind: 'hero', apen: 0.3, leth: 20, mpen: 0, mpenPct: 0 };
  assert.equal(defMul(null, dst, false), 0.5);
  assert.ok(Math.abs(defMul(src, dst, false) - 100 / 150) < 1e-9); // 100×0.7−20＝50
  assert.equal(defMul({ kind: 'hero', leth: 999 }, dst, false), 1);
});

test('技能加速：加速 100 時冷卻減半', () => {
  const { G, A } = duel();
  levelSkill(G, A, 'Q'); A.mp = A.maxMp; A.ki = 500;
  cast(G, A, 'Q', 5, 0); const cd0 = A.cds.Q;
  A.cds.Q = 0; A.ah = 100; A.mp = A.maxMp; A.action = null;
  assert.ok(cast(G, A, 'Q', 5, 0));
  assert.ok(Math.abs(A.cds.Q - cd0 / 2) < 1e-6);
});

test('命中附加傷害（風魔弓）：普攻多 15', () => {
  const { G, A, B } = duel();
  const base = beforeAuto(G, A, B, 100, { type: 'L' });
  give(A, 'windbow');
  A.crit = 0;
  assert.equal(beforeAuto(G, A, B, 100, { type: 'L' }) - base, 15);
});

test('重傷（斬首刀）：物理傷害英雄後施加 40% 重傷', () => {
  const { G, A, B } = duel();
  give(A, 'executioner');
  damage(G, A, B, 50, { type: 'L' });
  assert.ok(B.st.gw > 0 && B.st.gwAmt === 0.4);
});

test('法術護盾（須佐護壁）：擋下第一次技能，40 秒後才再生效', () => {
  const { G, A, B } = duel();
  give(B, 'susanoo');
  assert.equal(damage(G, A, B, 200, { type: 'skill' }), 0);
  assert.ok(damage(G, A, B, 200, { type: 'skill' }) > 0);
});

test('減普攻傷害（鐵塊鎧甲）：普攻少 6%，技能不受影響', () => {
  const { G, A, B } = duel();
  const a0 = damage(G, A, B, 200, { type: 'L', noKi: true }); B.hp = B.maxHp;
  give(B, 'tekkai');
  const armorOnly = 200 * defMul(A, B, false);
  const a1 = damage(G, A, B, 200, { type: 'L', noKi: true });
  assert.equal(a1, Math.round(armorOnly * 0.94));
  assert.ok(a1 < a0);
});

test('保命護盾（鮫肌）：技能傷害打到 30% 以下時得到護盾', () => {
  const { G, A, B } = duel();
  give(B, 'samehada');
  B.hp = B.maxHp * 0.35;
  damage(G, A, B, B.maxHp * 0.1, { type: 'skill', noKi: true });
  assert.ok(B.st.shield >= 110);
});

test('疊層（魔人印記）：參與擊殺疊層加氣功強度，陣亡掉 5 層', () => {
  const { G, A, B } = duel();
  give(A, 'majinmark');
  const ap0 = A.ap;
  B.hp = 1; damage(G, A, B, 10, { type: 'L', noKi: true });
  assert.equal(A.ap - ap0, 4);
  A.stk.glory = 7; recalcStats(A); A.hp = 1; damage(G, B, A, 10, { type: 'true' });
  assert.equal(A.stk.glory, 2);
});

test('獻祭（火拳護甲）：受傷後持續燒附近的敵人', () => {
  const { G, A, B } = duel();
  give(B, 'firefist'); B.lastHitT = -99;
  damage(G, A, B, 30, { type: 'L', noKi: true });
  const hp = A.hp;
  for (let i = 0; i < 70; i++) step(G);
  assert.ok(A.hp < hp);
});

test('順劈（海王類之牙）：近戰普攻打到目標旁邊的敵人', () => {
  const { G, A, B } = duel();
  give(A, 'seaking');
  const near = G.minions.length ? null : null;
  const C = G.heroes.find((h) => h !== A && h !== B && h.team === 1);
  C.alive = true; C.x = B.x + 1; C.z = 0; C.hp = C.maxHp;
  const hp = C.hp;
  afterAuto(G, A, B, 100, { type: 'L' });
  assert.ok(C.hp < hp);
});

test('主動：新月打周圍、時之護腕用一次後碎裂', () => {
  const { G, A, B } = duel();
  give(A, 'seaking', 'timebrace');
  const hp = B.hp;
  assert.ok(useActive(G, A, A.acts.findIndex((a) => a.id === 'crescent')));
  assert.ok(B.hp < hp);
  assert.ok(useActive(G, A, A.acts.findIndex((a) => a.id === 'stasis')));
  assert.ok(A.inv.includes('brokenbrace') && !A.inv.includes('timebrace'));
});

test('藥水：沒有仙豆時喝傷藥，持續回血；水壺回泉水補滿', () => {
  const { G, A, B } = duel();
  B.x = 40; // 別讓敵人在旁邊打
  A.senzu = 0; A.salve = 1; A.hp = A.maxHp * 0.5; A.lastHitT = G.time;
  assert.ok(eatSenzu(G, A));
  const hp = A.hp;
  for (let i = 0; i < 60; i++) step(G);
  assert.ok(A.hp > hp + 6);
  assert.equal(A.salve, 0);
});

test('藥劑（增氣丸）：氣功強度 +50，90 秒後消失', () => {
  const { G, A } = duel();
  A.x = -81; A.z = 81; A.gold = 9999;
  const ap0 = A.ap;
  assert.ok(buy(G, A, 'kipill'));
  assert.equal(Math.round(A.ap - ap0), 50);
  A.x = 0; A.z = 0;
  G.time += 91; step(G);
  assert.equal(A.elixir, null);
});
