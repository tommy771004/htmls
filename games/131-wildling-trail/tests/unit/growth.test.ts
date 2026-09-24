import { describe, expect, it } from 'vitest';
import { growthFlow, type GrowthStep } from '../../src/core/growth';
import { createMonster, expForLevel, gainExp, maxHp } from '../../src/core/monster';
import { PARTY_MAX, storeNewMonster } from '../../src/core/party';
import { makeApp, readAll, settle } from '../helpers/driver';

function run(gen: Generator<GrowthStep, void, number | undefined>, answer: (s: GrowthStep) => number | undefined = () => undefined): GrowthStep[] {
  const steps: GrowthStep[] = [];
  let next = gen.next();
  while (!next.done) {
    steps.push(next.value);
    next = gen.next(next.value.kind === 'learn' ? answer(next.value) : undefined);
  }
  return steps;
}

describe('經驗值、升級、學招與進化', () => {
  it('升級會提高能力並依比例補 HP', () => {
    const mon = createMonster('wickling', 5, 'a');
    const oldMax = maxHp(mon);
    mon.hp = oldMax - 4;
    gainExp(mon, expForLevel(7) - mon.exp);
    expect(mon.level).toBe(7);
    expect(maxHp(mon)).toBeGreaterThan(oldMax);
    expect(mon.hp).toBe(maxHp(mon) - 4);
  });

  it('只有參戰者分到經驗值；升級時學會新招式', () => {
    const a = createMonster('wickling', 6, 'a');
    const b = createMonster('bubblet', 6, 'b');
    const steps = run(growthFlow([a, b], new Map([['a', expForLevel(7) - a.exp]])));
    expect(a.level).toBe(7);
    expect(b.level).toBe(6);
    expect(a.moves.map((m) => m.id)).toContain('scorch');
    expect(steps.map((s) => s.text).join('\n')).toContain('燭尾學會了灼息');
  });

  it('招式欄滿時可以選擇替換或放棄學習', () => {
    const a = createMonster('wickling', 12, 'a');
    expect(a.moves).toHaveLength(4);
    const before = a.moves.map((m) => m.id);
    run(growthFlow([a], new Map([['a', expForLevel(13) - a.exp]])), () => -1);
    expect(a.level).toBe(13);
    expect(a.moves.map((m) => m.id)).toEqual(before);

    const b = createMonster('wickling', 12, 'b');
    const steps = run(growthFlow([b], new Map([['b', expForLevel(13) - b.exp]])), () => 1);
    expect(b.moves[1].id).toBe('blaze');
    expect(steps.some((s) => s.kind === 'learn')).toBe(true);
  });

  it('兩階段進化：芽蟲 → 繭葉 → 翠翅蛾，一次跳兩級也會連續進化', () => {
    const s = createMonster('sprigling', 5, 's');
    run(growthFlow([s], new Map([['s', expForLevel(6) - s.exp]])));
    expect(s.species).toBe('leafcoon');
    expect(s.nickname).toBe('繭葉');
    const t = createMonster('sprigling', 5, 't');
    run(growthFlow([t], new Map([['t', expForLevel(9) - t.exp]])));
    expect(t.species).toBe('verdmoth');
    expect(t.moves.map((m) => m.id)).toContain('gale');
  });

  it('倒下的怪獸不會得到經驗值，也不會進化', () => {
    const s = createMonster('sprigling', 5, 's');
    s.hp = 0;
    run(growthFlow([s], new Map([['s', 9999]])));
    expect(s.level).toBe(5);
    expect(s.species).toBe('sprigling');
  });
});

describe('隊伍滿員與收納', () => {
  it('第七隻送進收納箱，不覆蓋、不遺失、不重複', () => {
    const roster = { party: [] as ReturnType<typeof createMonster>[], box: [] as ReturnType<typeof createMonster>[] };
    for (let i = 0; i < PARTY_MAX; i++) expect(storeNewMonster(roster, createMonster('sprigling', 3, `m${i}`))).toBe('party');
    const seventh = createMonster('cinderow', 3, 'm7');
    expect(storeNewMonster(roster, seventh)).toBe('box');
    expect(storeNewMonster(roster, seventh)).toBeNull();
    expect(roster.party).toHaveLength(6);
    expect(roster.box).toEqual([seventh]);
  });

  it('實際捕捉時隊伍已滿，會送到收納箱並登錄圖鑑', () => {
    const { app } = makeApp(3, undefined, { encounterRateOverride: 1 });
    app.press('confirm');
    settle(app);
    readAll(app);
    app.p.flags.gotStarter = true;
    for (let i = 0; i < 6; i++) app.p.party.push(createMonster('mossum', 10, app.newUid()));
    app.giveItem('cage', 20);
    app.p.player = { map: 'route', x: 4, y: 3, facing: 'right' };
    app.press('right');
    settle(app);
    const session = app.battle!;
    let guard = 0;
    while (app.battle && session.phase !== 'done') {
      if (++guard > 500) throw new Error('卡住');
      if (session.phase === 'events' || session.phase === 'result') app.press('confirm');
      else if (session.phase === 'command') session.act({ kind: 'item', item: 'cage' });
      else app.press('cancel');
    }
    settle(app);
    readAll(app);
    expect(app.p.party).toHaveLength(6);
    expect(app.p.box).toHaveLength(1);
    const uids = [...app.p.party, ...app.p.box].map((m) => m.uid);
    expect(new Set(uids).size).toBe(uids.length);
    expect(app.p.dex.caught).toContain(app.p.box[0].species);
  });
});
