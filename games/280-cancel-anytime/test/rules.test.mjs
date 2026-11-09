// 規則引擎測試：node --test test/
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';
import { HEROES, LEVELS, PROPS } from '../src/data.js';

// ── 小工具 ────────────────────────────────────────────
const H = (s, k) => R.unitById(s, k);
const E = (s, k) => s.units.find(u => u.key === k);
const fxOf = (s, t) => s.fx.filter(f => f.t === t);

// 把棋盤整平、拿掉道具與地表，所有單位停到邊上（英雄在南邊，敵人在北邊）
function arena(lv = 0, seed = 7, diff = 'story') {
  const s = R.createState(lv, null, seed, diff);
  for (const row of s.grid) for (const t of row) { t.h = 0; t.surf = null; t.lava = false; t.void = false; }
  s.props.length = 0;
  let hi = 0, ei = 0;
  for (const u of s.units) {
    if (u.side === 'hero') { u.x = hi++; u.z = 11; } else { u.x = 11 - ei++; u.z = 0; }
  }
  return s;
}
function put(u, x, z, f) { u.x = x; u.z = z; if (f) u.f = f; return u; }
function addProp(s, type, x, z, o = {}) {
  const P = PROPS[type];
  const p = { id: 'pt' + s.nextId++, type, x, z, w: o.w || 1, d: o.d || 1, hp: P.hp || 0, maxHp: P.hp || 0, alive: true };
  s.props.push(p);
  return p;
}
// 讓接下來的 d() 依序擲出指定點數：seq 元素為數字（d20 結果）或 [面數, 數字|判斷式]
function forceRolls(s, seq) {
  for (let k = 1; k < 2e7; k++) {
    const t = { seed: k };
    let ok = true;
    for (const q of seq) {
      const [n, want] = typeof q === 'number' ? [20, q] : q;
      const r = R.d(t, n);
      if (typeof want === 'function' ? !want(r) : r !== want) { ok = false; break; }
    }
    if (ok) { s.seed = k; return; }
  }
  throw new Error('找不到符合的種子');
}
function turnOf(s, u) {
  if (!s.order.length) R.rollInitiative(s);
  s.turn = s.order.indexOf(u.id);
  return u;
}

// ── 骰子 ──────────────────────────────────────────────
describe('骰子', () => {
  test('parseDice / avgDice', () => {
    assert.deepEqual(R.parseDice('2d6+4'), { n: 2, x: 6, b: 4 });
    assert.deepEqual(R.parseDice('4d6'), { n: 4, x: 6, b: 0 });
    assert.deepEqual(R.parseDice('1d4-1'), { n: 1, x: 4, b: -1 });
    assert.deepEqual(R.parseDice('7'), { n: 0, x: 0, b: 7 });
    assert.equal(R.avgDice('2d6+4'), 11);
    assert.equal(R.avgDice('4d8'), 18);
  });
  test('暴擊只把骰子數量翻倍，加值不翻倍', () => {
    const s = { seed: 99 };
    assert.equal(R.rollDice(s, '1d1+3'), 4);
    assert.equal(R.rollDice(s, '1d1+3', true), 5);
    let maxN = 0, maxC = 0, minC = 99;
    for (let i = 0; i < 3000; i++) {
      const n = R.rollDice(s, '2d6+4'); assert.ok(n >= 6 && n <= 16);
      const c = R.rollDice(s, '2d6+4', true); assert.ok(c >= 8 && c <= 28);
      maxN = Math.max(maxN, n); maxC = Math.max(maxC, c); minC = Math.min(minC, c);
    }
    assert.equal(maxN, 16); assert.ok(maxC > 16); assert.equal(minC, 8);
  });
  test('同一個種子結果可重現', () => {
    const a = { seed: 42 }, b = { seed: 42 };
    for (let i = 0; i < 50; i++) assert.equal(R.d(a, 20), R.d(b, 20));
  });
});

// ── 攻擊流程 ──────────────────────────────────────────
describe('攻擊判定', () => {
  test('高地 +2 只給遠程與範圍；近戰沒有', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 2, 5), e = put(E(s, 'chihuahua'), 5, 5, [-1, 0]);
    R.tile(s, 2, 5).h = 1;
    assert.equal(R.attackMods(s, c, e, 'ranged', 5).bonus, 7);
    assert.ok(R.attackMods(s, c, e, 'ranged', 5).tags.some(t => t.includes('HIGH GROUND')));
    assert.equal(R.attackMods(s, c, e, 'aoe', 5).bonus, 7);
    assert.equal(R.attackMods(s, c, e, 'melee', 5).bonus, 5);
  });
  test('由低打高 −2 只在距離 > 2 格時', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 2, 5), e = put(E(s, 'chihuahua'), 5, 5, [-1, 0]);
    for (const [x, z] of [[5, 5], [4, 5], [4, 6], [3, 5]]) R.tile(s, x, z).h = 1;
    assert.equal(R.attackMods(s, c, e, 'ranged', 5).bonus, 3); // 距離 3
    put(e, 4, 5);
    assert.equal(R.attackMods(s, c, e, 'ranged', 5).bonus, 5); // 距離剛好 2：不罰
    put(e, 4, 6);
    assert.equal(R.attackMods(s, c, e, 'ranged', 5).bonus, 3); // 距離 2.24
    put(e, 3, 5);
    assert.equal(R.attackMods(s, c, e, 'ranged', 5).bonus, 5); // 相鄰
  });
  test('背刺：V·F < −0.25 才算，+3 命中並追加 1d6+2', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 4, 5), e = put(E(s, 'raccoon'), 5, 5, [-1, 0]);
    assert.equal(R.attackMods(s, c, e, 'melee', 6).backstab, false); // 面對面
    e.f = [0, 1];
    assert.equal(R.attackMods(s, c, e, 'melee', 6).backstab, false); // 側面 dot 0
    e.f = [1, 1];
    assert.equal(R.attackMods(s, c, e, 'melee', 6).backstab, true); // dot −0.71
    e.f = [1, 0];
    const m = R.attackMods(s, c, e, 'melee', 6);
    assert.equal(m.backstab, true); assert.equal(m.bonus, 9);
    assert.equal(R.attackMods(s, c, e, 'aoe', 6).backstab, false); // 範圍法術不背刺
    // 傷害骰 0d6：只剩背刺骰
    e.ac = 5;
    const hp0 = e.hp;
    const r = R.resolveSingle(s, c, e, { hit: 6, dice: '0d6', kind: 'melee', name: 't', d20: 10 });
    assert.ok(r.hit && r.backstab);
    assert.ok(hp0 - e.hp >= 3 && hp0 - e.hp <= 8, `背刺傷害 ${hp0 - e.hp}`);
    e.f = [-1, 0];
    const hp1 = e.hp;
    R.resolveSingle(s, c, e, { hit: 6, dice: '0d6', kind: 'melee', name: 't', d20: 10 });
    assert.equal(e.hp, hp1);
  });
  test('VPN 潛行：自身 AC +2、下一擊必背刺，出手後解除', () => {
    const s = arena();
    const g = put(H(s, 'doge'), 4, 5, [1, 0]), e = put(E(s, 'raccoon'), 5, 5, [-1, 0]);
    R.useSkill(s, 'doge', 'bonus');
    assert.ok(g.st.stealth);
    assert.equal(R.attackMods(s, e, g, 'melee', 4).ac, g.ac + 2);
    assert.equal(R.attackMods(s, g, e, 'melee', 7).backstab, true);
    R.useSkill(s, 'doge', 'melee', 5, 5, { d20: 15 });
    assert.ok(!g.st.stealth);
  });
  test('掩體 +2 AC：只對非相鄰攻擊、掩體要在攻擊方向上', () => {
    const s = arena();
    const c = put(H(s, 'dale'), 1, 5), e = put(E(s, 'raccoon'), 5, 5, [-1, 0]);
    addProp(s, 'kiosk', 4, 5);
    const m = R.attackMods(s, c, e, 'ranged', 7);
    assert.equal(m.ac, e.ac + 2); assert.ok(m.cover);
    assert.equal(R.attackMods(s, c, e, 'aoe', 7).ac, e.ac);
    put(c, 4, 6); // 相鄰
    assert.equal(R.attackMods(s, c, e, 'melee', 5).ac, e.ac);
    put(c, 5, 1); // 從北邊打，掩體在西邊
    assert.equal(R.attackMods(s, c, e, 'ranged', 7).ac, e.ac);
  });
  test('nat20 必中且暴擊、nat1 必失', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 4, 5), e = put(E(s, 'burger'), 5, 5, [-1, 0]);
    e.ac = 99;
    const hp0 = e.hp;
    const a = R.resolveSingle(s, c, e, { hit: 0, dice: '1d1+3', kind: 'melee', name: 't', d20: 20 });
    assert.ok(a.hit && a.crit);
    assert.equal(hp0 - e.hp, 5);
    e.ac = -50;
    const b = R.resolveSingle(s, c, e, { hit: 0, dice: '1d1+3', kind: 'melee', name: 't', d20: 1 });
    assert.ok(!b.hit && s.fx.some(f => f.t === 'roll' && f.fumble));
    assert.equal(R.hitChance(100, 5), 0.95);
    assert.equal(R.hitChance(-100, 30), 0.05);
  });
  test('鑄鐵平底鍋：查德不會被暴擊', () => {
    const s = arena(7);
    const c = put(H(s, 'chad'), 4, 5), e = put(E(s, 'frat'), 5, 5);
    assert.equal(c.ac, 20); assert.ok(c.critImmune);
    const r = R.resolveSingle(s, e, c, { hit: 0, dice: '1d1', kind: 'melee', name: 't', d20: 20 });
    assert.ok(r.hit && !r.crit);
  });
});

// ── 尋路 ──────────────────────────────────────────────
describe('尋路', () => {
  test('一般移動只能跨 |Δh| ≤ 1', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 2, 2);
    for (let z = 0; z < 12; z++) R.tile(s, 4, z).h = 2;
    let r = R.reachable(s, c, 5);
    assert.ok(![...r.values()].some(n => n.x >= 4));
    R.tile(s, 3, 2).h = 1;
    r = R.reachable(s, c, 5);
    assert.ok(r.has('4,2'));
  });
  test('飛行單位無視高低差', () => {
    const s = arena(6);
    const b = put(E(s, 'batA'), 2, 2);
    for (let z = 0; z < 12; z++) R.tile(s, 4, z).h = 3;
    assert.ok(R.reachable(s, b, 5).has('5,2'));
  });
  test('不能切角', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 2, 2);
    addProp(s, 'kiosk', 3, 2);
    assert.ok(!R.reachable(s, c, 1).has('3,3'));
    assert.equal(R.reachable(s, c, 2).get('3,3').cost, 2);
    assert.ok(R.reachable(s, c, 1).has('1,3')); // 另一邊沒擋
  });
  test('泥巴路每格耗 2，洞洞鞋與飛行無視', () => {
    const s = arena(4); // 第 5 關之後老戴有洞洞鞋
    const c = put(H(s, 'chad'), 2, 2), dl = put(H(s, 'dale'), 2, 4);
    R.tile(s, 3, 2).surf = { type: 'mud', turns: 0 };
    R.tile(s, 3, 4).surf = { type: 'mud', turns: 0 };
    assert.equal(R.reachable(s, c, 5).get('3,2').cost, 2);
    assert.ok(dl.slipImmune);
    assert.equal(R.reachable(s, dl, 5).get('3,4').cost, 1);
  });
  test('敵人擋路；隊友可穿過但不能停', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 2, 2);
    for (let x = 1; x <= 9; x++) { addProp(s, 'kiosk', x, 1); addProp(s, 'kiosk', x, 3); }
    const e = put(E(s, 'raccoon'), 4, 2);
    let r = R.reachable(s, c, 5);
    assert.ok(!r.has('5,2') && !r.has('4,2'));
    put(e, 11, 0);
    const k = put(H(s, 'karen'), 4, 2);
    r = R.reachable(s, c, 5);
    assert.ok(r.has('5,2'));
    assert.ok(!r.has('4,2'));
    c.moveLeft = 5;
    assert.equal(R.moveTo(s, 'chad', 4, 2), false);
    assert.equal(R.moveTo(s, 'chad', 6, 2), true);
    assert.deepEqual([c.x, c.z], [6, 2]);
    assert.deepEqual([k.x, k.z], [4, 2]);
  });
});

// ── 借機攻擊 ──────────────────────────────────────────
describe('借機攻擊', () => {
  test('離開近戰範圍會觸發，消耗對方反應', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 5, 5), e = put(E(s, 'chihuahua'), 6, 5);
    c.moveLeft = 5;
    R.moveTo(s, 'chad', 2, 5);
    assert.ok(s.fx.some(f => f.t === 'attack' && f.id === e.id && f.tid === 'chad'));
    assert.equal(e.reaction, false);
  });
  test('在近戰範圍內移動不觸發', () => {
    const s = arena();
    put(H(s, 'chad'), 5, 5); const e = put(E(s, 'chihuahua'), 6, 5);
    H(s, 'chad').moveLeft = 5;
    R.moveTo(s, 'chad', 5, 6);
    assert.ok(!fxOf(s, 'attack').length);
    assert.equal(e.reaction, true);
  });
  test('多吉移動不觸發', () => {
    const s = arena();
    const g = put(H(s, 'doge'), 5, 5), e = put(E(s, 'chihuahua'), 6, 5);
    g.moveLeft = 6;
    R.moveTo(s, 'doge', 1, 5);
    assert.ok(!fxOf(s, 'attack').length);
    assert.equal(e.reaction, true);
  });
  test('瞬移與被推開都不觸發', () => {
    const s = arena();
    put(H(s, 'dale'), 5, 5); const e = put(E(s, 'chihuahua'), 6, 5);
    R.useSkill(s, 'dale', 'bonus', 2, 5);
    assert.equal(e.reaction, true);
    assert.ok(!s.fx.some(f => f.t === 'attack' && f.id === e.id));
    // 凱倫旁邊的浣熊被查德推走：凱倫不會借機
    const s2 = arena();
    const k = put(H(s2, 'karen'), 5, 4), r = put(E(s2, 'raccoon'), 5, 5);
    put(H(s2, 'chad'), 4, 5);
    r.shoveDef = -100;
    R.useSkill(s2, 'chad', 'shove', 5, 5);
    assert.equal(r.x, 8);
    assert.equal(k.reaction, true);
  });
  test('心悸麻痺不能借機（即使是在自己回合開始時被電到）', () => {
    const s = arena();
    const e = put(E(s, 'chihuahua'), 6, 5), c = put(H(s, 'chad'), 5, 5);
    R.tile(s, 6, 5).surf = { type: 'shock', turns: 3 };
    turnOf(s, e);
    R.beginTurn(s);
    assert.ok(e.st.palpit);
    s.turn = s.order.indexOf(e.id);
    R.endTurn(s);
    assert.ok(e.st.palpit, '心悸要撐到英雄回合');
    c.moveLeft = 5;
    s.fx.length = 0;
    R.moveTo(s, 'chad', 2, 5);
    assert.ok(!s.fx.some(f => f.t === 'attack' && f.id === e.id));
  });
});

// ── 推撞 ──────────────────────────────────────────────
describe('推撞', () => {
  test('查德推撞 +4、推 3 格；其他人推 2 格', () => {
    const s = arena();
    const c = H(s, 'chad');
    assert.equal(c.athletics, HEROES.chad.athletics + 4);
    assert.equal(H(s, 'karen').athletics, HEROES.karen.athletics);
    put(c, 2, 5); const e = put(E(s, 'chihuahua'), 3, 5); e.shoveDef = -100;
    R.useSkill(s, 'chad', 'shove', 3, 5);
    assert.deepEqual([e.x, e.z], [6, 5]);
    assert.equal(c.bonus, false);
    put(H(s, 'karen'), 2, 7); const r = put(E(s, 'raccoon'), 3, 7); r.shoveDef = -100;
    R.useSkill(s, 'karen', 'shove', 3, 7);
    assert.deepEqual([r.x, r.z], [5, 7]);
  });
  test('推撞失敗不會移動', () => {
    const s = arena();
    put(H(s, 'chad'), 2, 5); const e = put(E(s, 'chihuahua'), 3, 5); e.shoveDef = 100;
    R.useSkill(s, 'chad', 'shove', 3, 5);
    assert.deepEqual([e.x, e.z], [3, 5]);
  });
  test('推下高台：Δh × 1d6 墜落傷害並倒地，推到落差就停', () => {
    const s = arena();
    for (const x of [1, 2, 3]) R.tile(s, x, 5).h = 2;
    put(H(s, 'chad'), 2, 5); const e = put(E(s, 'burger'), 3, 5); e.shoveDef = -100;
    const hp0 = e.hp;
    R.useSkill(s, 'chad', 'shove', 3, 5);
    assert.deepEqual([e.x, e.z], [4, 5]);
    assert.ok(hp0 - e.hp >= 2 && hp0 - e.hp <= 12);
    assert.ok(e.st.prone);
    assert.equal(fxOf(s, 'push')[0].fall, 2);
  });
  test('推進烤肉醬池：TOUCHDOWN、3d6，然後爬到空地', () => {
    const s = R.createState(6, null, 3, 'story');
    const lava = s.grid.flat().find(t => t.lava && R.standable(s, t.x - 1, t.z) && R.standable(s, t.x - 2, t.z));
    const cw = put(E(s, 'cowboy'), lava.x - 1, lava.z), c = put(H(s, 'chad'), lava.x - 2, lava.z);
    cw.shoveDef = -100;
    const hp0 = cw.hp;
    R.useSkill(s, 'chad', 'shove', cw.x, cw.z);
    assert.ok(s.fx.some(f => f.t === 'float' && f.text.includes('TOUCHDOWN')));
    assert.ok(hp0 - cw.hp >= 3 && hp0 - cw.hp <= 18);
    assert.ok(!R.tile(s, cw.x, cw.z).lava);
    assert.ok(c);
  });
  test('飛行單位被推過醬池不會 TOUCHDOWN', () => {
    const s = R.createState(6, null, 3, 'story');
    const lava = s.grid.flat().find(t => t.lava && R.standable(s, t.x - 1, t.z) && R.standable(s, t.x - 2, t.z));
    const b = put(E(s, 'batA'), lava.x - 1, lava.z); put(H(s, 'chad'), lava.x - 2, lava.z);
    b.shoveDef = -100;
    const hp0 = b.hp;
    R.useSkill(s, 'chad', 'shove', b.x, b.z);
    assert.ok(!s.fx.some(f => f.t === 'float' && f.text.includes('TOUCHDOWN')));
    assert.equal(b.hp, hp0);
  });
  test('撞牆：留在原地並受 1d4', () => {
    const s = arena();
    put(H(s, 'chad'), 2, 5); const e = put(E(s, 'burger'), 3, 5); e.shoveDef = -100;
    addProp(s, 'kiosk', 4, 5);
    const hp0 = e.hp;
    R.useSkill(s, 'chad', 'shove', 3, 5);
    assert.deepEqual([e.x, e.z], [3, 5]);
    assert.ok(hp0 - e.hp >= 1 && hp0 - e.hp <= 4);
  });
  test('predictPush 預測墜落', () => {
    const s = arena();
    R.tile(s, 3, 5).h = 3; R.tile(s, 2, 5).h = 3;
    const c = put(H(s, 'chad'), 2, 5), e = put(E(s, 'burger'), 3, 5);
    const P = R.predictPush(s, c, e, 3);
    assert.equal(P.fall, 3); assert.deepEqual([P.x, P.z], [4, 5]);
  });
});

// ── 地表連鎖 ──────────────────────────────────────────
describe('地表連鎖', () => {
  test('快樂水 + 曼陀珠：半徑 2 格內所有人（含我方）受傷並倒地，積水清空', () => {
    const s = arena(2);
    R.tile(s, 5, 5).surf = { type: 'soda', turns: 0 };
    R.tile(s, 5, 6).surf = { type: 'soda', turns: 0 };
    const dl = put(H(s, 'dale'), 5, 2), c = put(H(s, 'chad'), 4, 5);
    const sk = put(E(s, 'skater'), 6, 6), zk = put(E(s, 'zack'), 5, 9);
    const hp = { c: c.hp, sk: sk.hp, zk: zk.hp };
    const r = R.useSkill(s, 'dale', 'mentos', 5, 5);
    assert.ok(r.ok, r.why);
    assert.ok(c.hp < hp.c && sk.hp < hp.sk);
    assert.ok(c.st.prone && sk.st.prone);
    assert.equal(zk.hp, hp.zk);
    assert.equal(R.tile(s, 5, 5).surf, null);
    assert.equal(R.tile(s, 5, 6).surf, null);
    assert.equal(s.mentos, 1);
    assert.ok(dl);
  });
  test('沒有快樂水只是普通曼陀珠', () => {
    const s = arena(2);
    put(H(s, 'dale'), 5, 2); const sk = put(E(s, 'skater'), 5, 5);
    R.useSkill(s, 'dale', 'mentos', 5, 5);
    assert.ok(!sk.st.prone);
  });
  test('炸雞油 + 火：整片相連的油變 3 回合火海', () => {
    const s = arena();
    for (const [x, z] of [[6, 5], [7, 5], [7, 6], [10, 10]]) R.tile(s, x, z).surf = { type: 'grease', turns: 0 };
    put(H(s, 'dale'), 2, 5);
    const r = R.useSkill(s, 'dale', 'ranged', 6, 5);
    assert.ok(r.ok, r.why);
    for (const [x, z] of [[6, 5], [7, 5], [7, 6]]) assert.deepEqual(R.tile(s, x, z).surf, { type: 'fire', turns: 3 });
    assert.equal(R.tile(s, 10, 10).surf.type, 'grease');
    R.rollInitiative(s);
    const roundsUntil = n => { while (s.round < n) R.endTurn(s); };
    roundsUntil(3);
    assert.equal(R.tile(s, 6, 5).surf.type, 'fire');
    roundsUntil(4);
    assert.equal(R.tile(s, 6, 5).surf, null);
  });
  test('站在火海開始回合受 2d4', () => {
    const s = arena();
    const e = put(E(s, 'burger'), 6, 5);
    R.tile(s, 6, 5).surf = { type: 'fire', turns: 3 };
    turnOf(s, e);
    const hp0 = e.hp;
    R.beginTurn(s);
    assert.ok(hp0 - e.hp >= 2 && hp0 - e.hp <= 8);
  });
  test('能量飲 + 電：高壓電網，敵人受電擊與心悸，我方不受傷且移動 +2', () => {
    const s = arena(1);
    for (const [x, z] of [[3, 3], [4, 3], [3, 4]]) R.tile(s, x, z).surf = { type: 'energy', turns: 0 };
    const a = put(E(s, 'auntie'), 3, 3), k = put(H(s, 'karen'), 4, 3);
    const hpA = a.hp, hpK = k.hp;
    R.elementArea(s, 3, 3, 0.5, 'lightning');
    for (const [x, z] of [[3, 3], [4, 3], [3, 4]]) assert.equal(R.tile(s, x, z).surf.type, 'shock');
    assert.ok(hpA - a.hp >= 1 && hpA - a.hp <= 8);
    assert.ok(a.st.palpit);
    assert.equal(k.hp, hpK);
    turnOf(s, k);
    R.beginTurn(s);
    assert.equal(k.moveLeft, k.move + 2);
  });
  test('保羅的電擊槍也會把能量飲通電', () => {
    const s = arena(1);
    R.tile(s, 4, 3).surf = { type: 'energy', turns: 0 };
    const p = put(E(s, 'paul'), 8, 3), k = put(H(s, 'karen'), 4, 3);
    turnOf(s, p); R.beginTurn(s);
    for (let i = 0; i < 20 && R.tile(s, 4, 3).surf.type === 'energy'; i++) { p.action = true; R.aiTurn(s, p); }
    assert.equal(R.tile(s, 4, 3).surf.type, 'shock');
    assert.ok(k);
  });
  test('起司/黏液 + 電子菸：毒雲，裡面 AC −2、遠程 −4', () => {
    const s = arena(5);
    R.tile(s, 5, 5).surf = { type: 'slime', turns: 0 };
    R.tile(s, 5, 6).surf = { type: 'cheese', turns: 0 };
    const g = put(H(s, 'doge'), 2, 5), gt = put(E(s, 'gator'), 5, 5);
    const r = R.useSkill(s, 'doge', 'aoe', 5, 5);
    assert.ok(r.ok, r.why);
    assert.equal(R.tile(s, 5, 5).surf.type, 'toxic');
    assert.equal(R.tile(s, 5, 6).surf.type, 'toxic');
    assert.equal(R.attackMods(s, g, gt, 'melee', 7).ac, gt.ac - 2);
    const sx = put(E(s, 'sax'), 5, 6);
    assert.equal(R.attackMods(s, sx, g, 'ranged', 6).bonus, 6 - 4);
    assert.equal(R.attackMods(s, sx, g, 'melee', 6).bonus, 6);
  });
  test('流動廁所被打爆：藍色泥漿＋周圍反胃（攻擊 −2）', () => {
    const s = arena();
    const p = addProp(s, 'potty', 5, 5);
    assert.equal(p.hp, 15);
    const e = put(E(s, 'raccoon'), 6, 5), c = put(H(s, 'chad'), 4, 4);
    R.breakProp(s, p, 14, null);
    assert.ok(p.alive);
    R.breakProp(s, p, 1, null);
    assert.ok(!p.alive);
    assert.equal(R.tile(s, 5, 5).surf.type, 'sludge');
    assert.equal(R.tile(s, 6, 6).surf.type, 'sludge');
    assert.ok(e.st.nausea && c.st.nausea);
    assert.equal(R.attackMods(s, e, c, 'melee', 4).bonus, 2);
  });
  test('炸藥連鎖：瓦斯桶引爆旁邊的炸藥箱', () => {
    const s = arena(3);
    const g = addProp(s, 'gascan', 5, 5), cr = addProp(s, 'crate', 6, 5);
    const e = put(E(s, 'mechanic'), 5, 6);
    const hp0 = e.hp;
    R.breakProp(s, g, 1, null);
    assert.ok(!g.alive && !cr.alive);
    assert.ok(e.hp < hp0);
    assert.equal(fxOf(s, 'boom').length >= 2, true);
    assert.equal(R.tile(s, 5, 6).surf.type, 'fire');
  });
});

// ── 死亡豁免 ──────────────────────────────────────────
describe('死亡豁免', () => {
  function downed(lv = 0) {
    const s = arena(lv);
    const k = put(H(s, 'karen'), 5, 5);
    R.damage(s, k, 999, '鈍擊', null);
    assert.ok(k.downed && k.hp === 0);
    assert.equal(s.over, null);
    turnOf(s, k);
    return { s, k };
  }
  test('≥ 10 成功、< 10 失敗、nat1 算兩次失敗', () => {
    let { s, k } = downed();
    forceRolls(s, [10]); assert.equal(R.beginTurn(s).skip, true); assert.equal(k.saves.s, 1);
    forceRolls(s, [9]); R.beginTurn(s); assert.equal(k.saves.f, 1);
    ({ s, k } = downed());
    forceRolls(s, [1]); R.beginTurn(s); assert.equal(k.saves.f, 2);
  });
  test('三次成功：自己爬起來 1 HP', () => {
    const { s, k } = downed();
    k.saves.s = 2;
    forceRolls(s, [15]);
    R.beginTurn(s);
    assert.equal(k.downed, false); assert.equal(k.hp, 1);
  });
  test('nat20 立刻爬起來並可行動', () => {
    const { s, k } = downed();
    forceRolls(s, [20]);
    assert.equal(R.beginTurn(s).skip, false);
    assert.equal(k.hp, 1);
  });
  test('三次失敗：救護車載走並留下 $50,000 帳單', () => {
    const { s, k } = downed();
    k.saves.f = 2;
    forceRolls(s, [3]);
    R.beginTurn(s);
    assert.ok(k.gone); assert.equal(s.party.bills, 50000);
    assert.ok(fxOf(s, 'gone').length);
  });
  test('倒地時受傷 = 一次失敗，暴擊 = 兩次', () => {
    const { s, k } = downed();
    R.damage(s, k, 5, '鈍擊', null);
    assert.equal(k.saves.f, 1); assert.equal(k.hp, 0);
    R.damage(s, k, 5, '鈍擊', null, { crit: true });
    assert.ok(k.gone);
    assert.equal(s.party.bills, 50000);
  });
  test('隊友「扶我起來」救起倒地者', () => {
    const { s, k } = downed();
    const c = put(H(s, 'chad'), 4, 5);
    const r = R.useSkill(s, 'chad', 'help', 5, 5);
    assert.ok(r.ok, r.why);
    assert.equal(k.downed, false);
    assert.equal(k.hp, Math.ceil(k.maxHp / 2));
    assert.equal(c.action, false);
  });
  test('凱倫直銷精油群體芳療拉起倒地隊友', () => {
    const s = arena();
    const d = put(H(s, 'dale'), 5, 5);
    R.damage(s, d, 999, '火焰', null);
    const k = put(H(s, 'karen'), 2, 5);
    const r = R.useSkill(s, 'karen', 'bonus', 5, 5);
    assert.ok(r.ok, r.why);
    assert.equal(d.downed, false); assert.ok(d.hp >= 7);
    assert.equal(k.slots, k.maxSlots - 1);
  });
  test('全員倒地 = 失敗', () => {
    const s = arena();
    for (const k of ['chad', 'karen', 'dale']) R.damage(s, H(s, k), 999, 'x', null);
    assert.equal(s.over, null);
    R.damage(s, H(s, 'doge'), 999, 'x', null);
    assert.equal(s.over, 'lose');
    assert.ok(fxOf(s, 'over').some(f => f.result === 'lose'));
  });
});

// ── 5G 晶片 ───────────────────────────────────────────
describe('5G 晶片', () => {
  test('退貨反射盾：致命傷害每關反彈一次', () => {
    const s = arena();
    s.party.chips.chad = 'refund';
    const c = put(H(s, 'chad'), 4, 5), e = put(E(s, 'burger'), 5, 5);
    c.hp = 10;
    R.damage(s, c, 5, '鈍擊', e);
    assert.equal(c.hp, 5); // 非致命不觸發
    const hpE = e.hp;
    R.damage(s, c, 12, '鈍擊', e);
    assert.equal(c.hp, 5); assert.equal(hpE - e.hp, 12);
    assert.ok(s.powerUsed.chad);
    R.damage(s, c, 12, '鈍擊', e);
    assert.ok(c.downed);
    assert.equal(R.canUse(s, c, 'power').ok, false);
  });
  test('無人機空投：4d8 並關進紙箱跳過回合；每關一次', () => {
    const s = arena();
    s.party.chips.dale = 'drone';
    put(H(s, 'dale'), 2, 5); const e = put(E(s, 'burger'), 8, 5);
    const hp0 = e.hp;
    const r = R.useSkill(s, 'dale', 'power', 8, 5);
    assert.ok(r.ok, r.why);
    assert.ok(hp0 - e.hp >= 4 && hp0 - e.hp <= 32);
    assert.ok(e.st.boxed);
    assert.equal(H(s, 'dale').action, true); // 不耗動作
    assert.equal(R.canUse(s, H(s, 'dale'), 'power').ok, false);
    turnOf(s, e);
    assert.deepEqual(R.beginTurn(s), { skip: true, reason: 'boxed' });
  });
  test('演算法洗腦：非首領敵人倒戈 2 回合', () => {
    const s = arena();
    s.party.chips.doge = 'gaslight';
    const g = put(H(s, 'doge'), 2, 5), b = put(E(s, 'burger'), 6, 5), e = put(E(s, 'raccoon'), 6, 6);
    assert.equal(R.validTarget(s, g, 'power', 6, 5).ok, false);
    assert.ok(R.useSkill(s, 'doge', 'power', 6, 6).ok);
    assert.ok(e.st.intern);
    assert.equal(R.isFoe(g, e), false);
    assert.equal(R.isFoe(b, e), true);
    R.rollInitiative(s);
    for (let i = 0; i < 2; i++) { s.turn = s.order.indexOf(e.id); R.endTurn(s); }
    assert.ok(!e.st.intern);
    assert.equal(R.isFoe(g, e), true);
  });
  test('蜥蜴人防曬乳的免費空投：裝退貨盾的查德也能用', () => {
    const s = R.createState(9, null, 5, 'story');
    assert.equal(s.party.chips.chad, 'refund');
    assert.equal(s.party.droneCharges, 1);
    const c = H(s, 'chad');
    assert.ok(R.canUse(s, c, 'power').ok);
    const e = E(s, 'dragon');
    put(e, c.x + 3, c.z);
    assert.ok(R.useSkill(s, 'chad', 'power', e.x, e.z).ok);
    assert.equal(s.party.droneCharges, 0);
    assert.ok(e.st.boxed);
    assert.ok(!s.powerUsed.chad); // 退貨盾仍保留
  });
});

// ── 戰前嘴砲 ──────────────────────────────────────────
describe('戰前嘴砲（10 關）', () => {
  const ok = (lv, seed = 11) => {
    const s = R.createState(lv, null, seed, 'story');
    const C = s.L.check;
    R.applyCheck(s, true, C.hero === 'all' ? 'chad' : C.hero);
    return s;
  };
  test('L1 漢堡魔神 −10 HP、AC −2', () => {
    const s = ok(0), b = E(s, 'burger');
    assert.equal(b.hp, b.maxHp - 10); assert.ok(b.st.shaken);
    assert.equal(R.attackMods(s, H(s, 'chad'), b, 'melee', 6).ac, b.ac - 2);
  });
  test('L1 凱倫威嚇有優勢', () => {
    const s = R.createState(0, null, 3, 'story');
    const r = R.rollCheck(s, 'karen');
    assert.ok(r.adv && r.d20b !== null && r.used === Math.max(r.d20, r.d20b));
    assert.equal(r.success, r.total >= 10 || r.used === 20);
    assert.equal(R.rollCheck(s, 'chad').adv, false);
  });
  test('L2 黃牛背對 2 回合', () => {
    const s = ok(1), r = E(s, 'reseller');
    assert.equal(r.st.distracted, 2); assert.deepEqual(r.f, [1, 0]);
    assert.equal(R.attackMods(s, H(s, 'doge'), r, 'ranged', 7).backstab, true);
  });
  test('L3 全員腎上腺素：移動 +2、命中 +2', () => {
    const s = ok(2);
    const c = H(s, 'chad');
    assert.ok(R.heroes(s).every(h => h.st.psyched));
    turnOf(s, c); R.beginTurn(s);
    assert.equal(c.moveLeft, c.move + 2);
  });
  test('L4 巴霸首回合跳過，站在炸藥箱旁', () => {
    const s = ok(3), b = E(s, 'bubba');
    const crate = s.props.find(p => p.type === 'crate');
    assert.ok(R.dist(b.x, b.z, crate.x, crate.z) <= 1.5);
    turnOf(s, b);
    assert.equal(R.beginTurn(s).skip, true);
  });
  test('L5 女祭司開局 2 回合無法行動', () => {
    const s = ok(4);
    assert.equal(E(s, 'priestess').st.distracted, 2);
  });
  test('L6 全體敵人命中 −2', () => {
    const s = ok(5);
    assert.ok(R.enemies(s).every(e => e.st.pineapple));
    const e = E(s, 'gator');
    assert.equal(R.attackMods(s, e, H(s, 'chad'), 'melee', e.hit).bonus, e.hit - 2);
  });
  test('L7 機甲 AC 18 → 15', () => {
    const s0 = R.createState(6, null, 1, 'story');
    assert.equal(E(s0, 'mecha').ac, 18);
    assert.equal(E(ok(6), 'mecha').ac, 15);
  });
  test('L8 神廚阿姨每回合擋一次遠程', () => {
    const s = ok(7);
    R.rollInitiative(s);
    const c = H(s, 'karen'), ch = E(s, 'chairman');
    const hp0 = c.hp;
    R.enemyAttack(s, ch, c);
    assert.equal(c.hp, hp0); assert.ok(s.flags.chefUsed);
    assert.ok(s.fx.some(f => f.t === 'float' && f.text.includes('神廚')));
  });
  test('L9 執行長當機 1 回合、伺服器塔自爆', () => {
    const s = ok(8);
    assert.ok(E(s, 'lizard').st.stunned);
    assert.ok(!s.props.find(p => p.type === 'server').alive);
  });
  test('L10 全員 HP 上限 +15、法術位全滿、首擊必暴', () => {
    const s0 = R.createState(9, null, 1, 'story');
    const base = Object.fromEntries(R.heroes(s0).map(h => [h.id, h.maxHp]));
    const s = ok(9);
    for (const h of R.heroes(s)) { assert.equal(h.maxHp, base[h.id] + 15); assert.equal(h.slots, h.maxSlots); assert.ok(h.st.freedom); }
    const c = H(s, 'chad'), e = E(s, 'dragon');
    put(e, c.x + 1, c.z);
    const r = R.resolveSingle(s, c, e, { hit: 6, dice: '2d6+4', kind: 'melee', name: 't', d20: 2 });
    assert.ok(r.hit && r.crit);
    assert.ok(!c.st.freedom);
  });
  test('失敗：負責的人 CRINGE；L10 全員 CRINGE', () => {
    const s = R.createState(0, null, 1, 'story');
    R.applyCheck(s, false, 'karen');
    assert.ok(H(s, 'karen').st.cringe && !H(s, 'chad').st.cringe);
    const s2 = R.createState(9, null, 1, 'story');
    R.applyCheck(s2, false, 'chad');
    assert.ok(R.heroes(s2).every(h => h.st.cringe));
  });
});

// ── 首領機制 ──────────────────────────────────────────
describe('首領機制', () => {
  test('蜥蜴人 50% 血量以下變身第二階段', () => {
    const s = R.createState(8, null, 1, 'story');
    const z = E(s, 'lizard');
    R.damage(s, z, z.maxHp - Math.floor(z.maxHp / 2), 'x', null);
    assert.ok(z.transformed && z.atk.sweep);
    assert.equal(z.hp, Math.floor(z.maxHp / 2) + 12);
    assert.ok(fxOf(s, 'phase2').length);
  });
  test('一擊超殺也要先變身，第二次才倒', () => {
    const s = R.createState(8, null, 1, 'story');
    const z = E(s, 'lizard');
    R.damage(s, z, 999, 'x', null);
    assert.ok(!z.dead && z.transformed); assert.equal(z.hp, 12);
    R.damage(s, z, 999, 'x', null);
    assert.ok(z.dead);
  });
  test('第二階段橫掃所有相鄰英雄', () => {
    const s = arena(8);
    const z = put(E(s, 'lizard'), 5, 5);
    R.damage(s, z, 999, 'x', null);
    put(H(s, 'chad'), 4, 5); put(H(s, 'karen'), 6, 5);
    R.enemyAttack(s, z, H(s, 'chad'));
    assert.equal(fxOf(s, 'roll').filter(f => f.who === z.id).length, 2);
  });
  test('L7 肉錘開關：中央格首領 −25 並暈眩，2 回合冷卻', () => {
    const s = R.createState(6, null, 1, 'story');
    R.rollInitiative(s);
    const m = put(E(s, 'mecha'), 5, 5), c = H(s, 'chad');
    const v = s.props.find(p => p.type === 'valve');
    put(c, v.x - 1, v.z);
    const hp0 = m.hp;
    assert.ok(R.useSkill(s, 'chad', 'valve').ok);
    assert.equal(hp0 - m.hp, 25); assert.ok(m.st.stunned);
    c.action = true;
    assert.equal(R.canUse(s, c, 'valve').ok, false);
    s.round += 2;
    assert.equal(R.canUse(s, c, 'valve').ok, true);
    put(c, 0, 0);
    assert.equal(R.canUse(s, c, 'valve').ok, false);
  });
  test('L10 強制取消訂閱：要站 3 層王座緊鄰主腦；>50% 扣 20，≤50% 斬首並破關', () => {
    const s = R.createState(9, null, 1, 'story');
    const br = E(s, 'brain'), c = H(s, 'chad');
    assert.equal(R.canUse(s, c, 'cancel').ok, false);
    put(c, 9, 5);
    assert.equal(R.hAt(s, 9, 5), 3);
    assert.ok(R.canUse(s, c, 'cancel').ok);
    R.useSkill(s, 'chad', 'cancel');
    assert.equal(br.hp, br.maxHp - 20);
    assert.equal(s.over, null);
    br.hp = Math.floor(br.maxHp / 2); c.action = true;
    R.useSkill(s, 'chad', 'cancel');
    assert.ok(br.dead);
    assert.equal(s.over, 'win', '主腦歸零即破關');
    assert.ok(R.enemies(s).length > 0);
  });
  test('L10 假關閉按鈕：主腦每回合投射，英雄踩到被傳送並受 3d8', () => {
    const s = R.createState(9, null, 1, 'story');
    R.rollInitiative(s);
    R.aiTurn(s, E(s, 'brain'));
    const traps = s.grid.flat().filter(t => t.surf && t.surf.type === 'trap').length;
    assert.ok(traps >= 1 && traps <= 6, `traps ${traps}`);
    const a = arena(9);
    const c = put(H(a, 'chad'), 1, 1);
    R.tile(a, 2, 1).surf = { type: 'trap', turns: 0 };
    c.moveLeft = 3;
    const hp0 = c.hp;
    R.moveTo(a, 'chad', 3, 1);
    assert.deepEqual([c.x, c.z], [6, 5]);
    assert.ok(hp0 - c.hp >= 3 && hp0 - c.hp <= 24);
    assert.equal(R.tile(a, 2, 1).surf, null);
    // 敵人踩到沒事
    const e = put(E(a, 'dragon'), 1, 3);
    R.tile(a, 2, 3).surf = { type: 'trap', turns: 0 };
    e.moveLeft = 3;
    R.moveTo(a, e.id, 3, 3);
    assert.deepEqual([e.x, e.z], [3, 3]);
  });
});

// ── 休息、先攻、回合 ───────────────────────────────────
describe('休息與回合流程', () => {
  test('得來速短休每關一次，全隊回 50%', () => {
    const s = arena(1); // 有折價券：+10
    for (const h of R.heroes(s)) h.hp = 1;
    const c = H(s, 'chad');
    assert.ok(R.useSkill(s, 'chad', 'rest').ok);
    for (const h of R.heroes(s)) assert.equal(h.hp, Math.min(h.maxHp, 1 + Math.ceil(h.maxHp / 2) + 10));
    assert.equal(c.action, false);
    const k = H(s, 'karen');
    assert.equal(R.canUse(s, k, 'rest').ok, false);
    R.rollInitiative(s);
    assert.equal(R.canUse(s, k, 'rest').ok, false);
  });
  test('先攻 = d20 + DEX，由高到低', () => {
    const s = R.createState(2, null, 77, 'standard');
    R.rollInitiative(s);
    assert.equal(s.order.length, s.units.length);
    for (let i = 1; i < s.order.length; i++) assert.ok(R.unitById(s, s.order[i - 1]).init >= R.unitById(s, s.order[i]).init);
    for (const u of s.units) assert.ok(u.init - (u.dex || 0) >= 1 && u.init - (u.dex || 0) <= 20);
    assert.equal(R.current(s).id, s.order[0]);
    assert.equal(s.round, 1);
  });
  test('endTurn 跳過死亡與被載走的單位，繞一圈進下一輪', () => {
    const s = R.createState(0, null, 5, 'standard');
    R.rollInitiative(s);
    R.unitById(s, s.order[1]).dead = true;
    R.unitById(s, s.order[2]).gone = true;
    s.turn = 0;
    R.endTurn(s);
    assert.equal(s.turn, 3);
    s.turn = s.order.length - 1;
    R.endTurn(s);
    assert.equal(s.round, 2); assert.equal(s.turn, 0);
    assert.ok(fxOf(s, 'round').some(f => f.n === 2));
  });
  test('全滅敵人 = 勝利', () => {
    const s = R.createState(0, null, 5, 'story');
    for (const e of R.enemies(s)) R.damage(s, e, 999, 'x', null);
    assert.equal(s.over, 'win');
    assert.ok(fxOf(s, 'over').some(f => f.result === 'win'));
  });
});

// ── 敵方 AI ───────────────────────────────────────────
describe('敵方 AI', () => {
  for (const diff of ['story', 'hard']) {
    test(`10 關英雄全程發呆（${diff}）：AI 從不丟東西、不走進醬池、每回合都會結束`, () => {
      for (let lv = 0; lv < LEVELS.length; lv++) {
        for (const seed of [1, 2, 3]) {
          const s = R.createState(lv, null, seed, diff);
          R.rollInitiative(s);
          let guard = 0, yeets = 0;
          while (!s.over && s.round <= 25 && guard++ < 3000) {
            const u = R.current(s);
            const b = R.beginTurn(s);
            if (!b.skip && !s.over && u.side === 'enemy') {
              R.aiTurn(s, u);
              if (R.alive(u) && !u.fly) assert.ok(!R.tile(s, u.x, u.z).lava, `L${lv + 1} ${u.key} 站進醬池`);
            }
            yeets += fxOf(s, 'yeet').length;
            R.endTurn(s);
            s.fx.length = 0;
          }
          assert.ok(guard < 3000, `L${lv + 1} 回合卡住`);
          assert.equal(yeets, 0);
          // 發呆的英雄遲早被打倒（第 10 關之外大多會輸）
          if (lv < 9) assert.ok(s.over === 'lose' || s.round > 25);
        }
      }
    });
  }
  test('目標評分公式', () => {
    const ai = { x: 0, z: 0 };
    const h = { x: 3, z: 4, hp: 10, maxHp: 40, ac: 15 };
    assert.equal(R.targetScore(ai, h), 45 * 0.75 - 4 * 5 - 0.8 * 15);
  });
  test('近戰 AI 會繞到背後', () => {
    const s = arena();
    const c = put(H(s, 'chad'), 5, 5, [1, 0]);
    const e = put(E(s, 'chihuahua'), 8, 3);
    turnOf(s, e); R.beginTurn(s);
    R.aiTurn(s, e);
    assert.ok(R.udist(e, c) <= 1.5);
    assert.ok(R.isBehind(e, { ...c, f: [1, 0] }), `落點 ${e.x},${e.z}`);
  });
  test('遠程 AI 偏好高地', () => {
    const s = arena();
    put(H(s, 'chad'), 2, 5);
    const e = put(E(s, 'tinfoil'), 8, 5);
    R.tile(s, 8, 8).h = 1; R.tile(s, 8, 9).h = 1; R.tile(s, 7, 8).h = 1; R.tile(s, 7, 9).h = 1;
    R.tile(s, 8, 2).h = 1; R.tile(s, 7, 2).h = 1; R.tile(s, 8, 1).h = 1;
    turnOf(s, e); R.beginTurn(s);
    R.aiTurn(s, e);
    assert.equal(R.hAt(s, e.x, e.z), 1);
  });
});
