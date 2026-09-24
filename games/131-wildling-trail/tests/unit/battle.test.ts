import { describe, expect, it } from 'vitest';
import { Battle, calcDamage, runChance, type BattleInit } from '../../src/core/battle';
import { captureChance, CAPTURE_MAX, CAPTURE_MIN } from '../../src/core/capture';
import { createMonster, maxHp } from '../../src/core/monster';
import { createRng, scriptedRng } from '../../src/core/rng';
import type { MonsterInstance } from '../../src/core/types';
import { getMove } from '../../src/data/moves';

function battle(over: Partial<BattleInit> & { player?: MonsterInstance[]; enemy?: MonsterInstance[] } = {}): Battle {
  const b = new Battle({
    kind: 'wild',
    playerParty: over.player ?? [createMonster('wickling', 10, 'p1'), createMonster('bubblet', 10, 'p2')],
    enemyParty: over.enemy ?? [createMonster('sprigling', 5, 'e1')],
    bag: { cage: 3, berry: 2 },
    rng: createRng(1),
    ai: 'wild',
    canStoreCatch: true,
    ...over,
  });
  b.start();
  return b;
}

describe('四種戰鬥行動的合法性', () => {
  it('招式：不存在或次數用完的欄位不能用；拚命只在全部用完時合法', () => {
    const b = battle();
    expect(b.validate({ kind: 'move', slot: 0 })).toBeNull();
    expect(b.validate({ kind: 'move', slot: 9 })).not.toBeNull();
    b.playerMon.moves[0].pp = 0;
    expect(b.validate({ kind: 'move', slot: 0 })).toContain('用完');
    expect(b.validate({ kind: 'struggle' })).not.toBeNull();
    for (const m of b.playerMon.moves) m.pp = 0;
    expect(b.validate({ kind: 'struggle' })).toBeNull();
  });

  it('道具：沒有的道具、滿血回復、訓練家戰捕捉都不合法', () => {
    const b = battle();
    expect(b.validate({ kind: 'item', item: 'bigBerry', target: 0 })).not.toBeNull();
    expect(b.validate({ kind: 'item', item: 'berry', target: 0 })).toContain('滿');
    expect(b.validate({ kind: 'item', item: 'cage' })).toBeNull();
    const t = battle({ kind: 'trainer', trainerName: '測試', ai: 'smart' });
    expect(t.validate({ kind: 'item', item: 'cage' })).toContain('不能捕捉');
    const full = battle({ canStoreCatch: false });
    expect(full.validate({ kind: 'item', item: 'cage' })).not.toBeNull();
  });

  it('交換：不能換到場上這隻或已倒下的怪獸', () => {
    const b = battle();
    expect(b.validate({ kind: 'switch', to: 0 })).toContain('已經在場上');
    expect(b.validate({ kind: 'switch', to: 1 })).toBeNull();
    b.player[1].hp = 0;
    expect(b.validate({ kind: 'switch', to: 1 })).toContain('沒有力氣');
    expect(b.validate({ kind: 'switch', to: 5 })).not.toBeNull();
  });

  it('逃跑：野生戰可以，訓練家戰不行', () => {
    expect(battle().validate({ kind: 'run' })).toBeNull();
    expect(battle({ kind: 'trainer', trainerName: '測試', ai: 'smart' }).validate({ kind: 'run' })).toContain('不能');
  });

  it('不合法的行動會被拒絕，不消耗回合', () => {
    const b = battle({ kind: 'trainer', trainerName: '測試', ai: 'smart' });
    expect(() => b.resolveTurn({ kind: 'run' })).toThrow();
    expect(b.turn).toBe(0);
  });

  it('交換會消耗回合，敵人照常行動', () => {
    const b = battle();
    const events = b.resolveTurn({ kind: 'switch', to: 1 });
    expect(b.pActive).toBe(1);
    expect(events.some((e) => e.text.includes('野生的芽蟲使用了'))).toBe(true);
  });
});

describe('回合順序與結束判定', () => {
  it('先手擊倒對手後，對手不再攻擊', () => {
    const b = battle({ player: [createMonster('wickling', 30, 'p1')], enemy: [createMonster('sprigling', 2, 'e1')] });
    const hpBefore = b.playerMon.hp;
    const events = b.resolveTurn({ kind: 'move', slot: b.playerMon.moves.findIndex((m) => getMove(m.id).power > 0) });
    expect(b.outcome).toBe('win');
    expect(b.playerMon.hp).toBe(hpBefore);
    expect(events.some((e) => e.text.startsWith('野生的芽蟲使用了'))).toBe(false);
  });

  it('優先度高的招式先出手，即使速度較慢', () => {
    const slow = createMonster('bubblet', 10, 'p1'); // 會疾流（+1）
    const fast = createMonster('verdmoth', 10, 'e1'); // 速度較快、沒有先制招式
    const b = battle({ player: [slow], enemy: [fast] });
    const jet = slow.moves.findIndex((m) => m.id === 'jet');
    const events = b.resolveTurn({ kind: 'move', slot: jet });
    const first = events.find((e) => e.text.includes('使用了'))!;
    expect(first.text).toContain('泡鰭使用了疾流');
  });

  it('HP 與招式次數不會低於零或超過上限', () => {
    const b = battle({ player: [createMonster('wickling', 30, 'p1')], enemy: [createMonster('mistsnail', 3, 'e1')] });
    b.resolveTurn({ kind: 'move', slot: b.playerMon.moves.findIndex((m) => m.id === 'leech') });
    expect(b.enemyMon.hp).toBe(0);
    for (const m of b.playerMon.moves) expect(m.pp).toBeGreaterThanOrEqual(0);
    const h = battle();
    h.playerMon.hp = maxHp(h.playerMon) - 3;
    h.resolveTurn({ kind: 'item', item: 'berry', target: 0 });
    expect(h.playerMon.hp).toBeLessThanOrEqual(maxHp(h.playerMon));
  });

  it('傷害至少 1，且屬性相剋會影響傷害', () => {
    const rng = scriptedRng([], 0.5);
    const a = createMonster('wickling', 10, 'a');
    const moss = createMonster('mossum', 10, 'b');
    const tide = createMonster('bubblet', 10, 'c');
    const spark = getMove('spark');
    expect(calcDamage(a, moss, spark, 0, 0, rng)).toBeGreaterThan(calcDamage(a, tide, spark, 0, 0, rng));
    expect(calcDamage(createMonster('sprigling', 1, 'x'), createMonster('leafcoon', 30, 'y'), getMove('vine'), -4, 4, rng)).toBeGreaterThanOrEqual(1);
  });

  it('逃跑機率有上下限', () => {
    expect(runChance(1, 999, 0)).toBe(0.2);
    expect(runChance(999, 1, 0)).toBe(1);
  });
});

describe('招式耗盡', () => {
  it('我方全部用完仍可用「拚命」繼續打，並承受反作用', () => {
    const b = battle({ player: [createMonster('wickling', 12, 'p1')], enemy: [createMonster('leafcoon', 12, 'e1')] });
    for (const m of b.playerMon.moves) m.pp = 0;
    const before = b.playerMon.hp;
    const enemyBefore = b.enemyMon.hp;
    b.resolveTurn({ kind: 'struggle' });
    expect(b.enemyMon.hp).toBeLessThan(enemyBefore);
    expect(b.playerMon.hp).toBeLessThan(before);
  });

  it('敵方招式用完時自動使用拚命，不會卡住', () => {
    const b = battle({ player: [createMonster('mossum', 20, 'p1')], enemy: [createMonster('mistsnail', 10, 'e1')] });
    for (const m of b.enemyMon.moves) m.pp = 0;
    const events = b.resolveTurn({ kind: 'move', slot: 0 });
    expect(events.some((e) => e.text.includes('沒有可以用的招式'))).toBe(true);
  });
});

describe('捕捉', () => {
  it('成功：消耗一個晶籠並立即結束，對手不再行動', () => {
    const b = battle({ rng: scriptedRng([0.0, 0.0, 0.0, 0.0], 0) });
    const events = b.resolveTurn({ kind: 'item', item: 'cage' });
    expect(b.bag.cage).toBe(2);
    expect(b.outcome).toBe('caught');
    expect(b.caught?.species).toBe('sprigling');
    expect(events.some((e) => e.text.includes('使用了'))).toBe(false);
  });

  it('失敗：同樣消耗一個晶籠，戰鬥繼續、對手照常行動', () => {
    const b = battle({ rng: scriptedRng([0.99, 0.99, 0.99, 0.99, 0.5, 0.5, 0.5], 0.5) });
    b.resolveTurn({ kind: 'item', item: 'cage' });
    expect(b.bag.cage).toBe(2);
    expect(b.outcome).toBeNull();
  });

  it('捕捉機率受 HP、道具與狀態影響，並有上下限', () => {
    const mon = createMonster('verdmoth', 20, 'x');
    const full = captureChance(mon, 1);
    mon.hp = 1;
    const low = captureChance(mon, 1);
    expect(low).toBeGreaterThan(full);
    expect(captureChance(mon, 1.6)).toBeGreaterThan(low);
    mon.status = 'sleep';
    expect(captureChance(mon, 1.6)).toBeGreaterThanOrEqual(captureChance({ ...mon, status: 'none' }, 1.6));
    expect(captureChance(mon, 100)).toBe(CAPTURE_MAX);
    const hard = createMonster('verdmoth', 30, 'y');
    expect(captureChance(hard, 0.01)).toBe(CAPTURE_MIN);
  });
});

describe('狀態與換怪', () => {
  it('倒下後必須強制換怪，換怪不消耗回合', () => {
    const b = battle({
      player: [createMonster('sprigling', 2, 'p1'), createMonster('mossum', 15, 'p2')],
      enemy: [createMonster('cinderow', 15, 'e1')],
      ai: 'smart',
    });
    b.resolveTurn({ kind: 'move', slot: 0 });
    expect(b.player[0].hp).toBe(0);
    expect(b.needsPlayerSwitch).toBe(true);
    expect(b.validate({ kind: 'move', slot: 0 })).not.toBeNull();
    const turn = b.turn;
    const events = b.forceSwitch(1);
    expect(b.turn).toBe(turn);
    expect(events.some((e) => e.text.includes('使用了'))).toBe(false);
    expect(() => b.forceSwitch(0)).toThrow();
  });
});
