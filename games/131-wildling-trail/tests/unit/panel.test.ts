import { describe, expect, it } from 'vitest';
import { Panel } from '../../src/app/panel';
import { createMonster } from '../../src/core/monster';
import { makeApp, readAll, settle } from '../helpers/driver';

function grid(n: number): Panel {
  return new Panel({
    kind: 'moves',
    title: '招式',
    columns: 2,
    rows: () => Array.from({ length: n }, (_, i) => ({ label: `招式${i}` })),
    onConfirm: () => undefined,
  });
}

describe('格子面板（戰鬥框的 2×2 招式）', () => {
  it('上下換列、左右在同一列內移動，碰到邊緣停住', () => {
    const p = grid(4);
    expect(p.press('right')).toBe('cursor');
    expect(p.cursor).toBe(1);
    expect(p.press('right')).toBe('none');
    expect(p.press('down')).toBe('cursor');
    expect(p.cursor).toBe(3);
    expect(p.press('down')).toBe('none');
    expect(p.press('left')).toBe('cursor');
    expect(p.cursor).toBe(2);
    expect(p.press('left')).toBe('none');
    expect(p.press('up')).toBe('cursor');
    expect(p.cursor).toBe(0);
    expect(p.press('up')).toBe('none');
  });

  it('只有三招時不會移到空格', () => {
    const p = grid(3);
    p.press('down');
    expect(p.cursor).toBe(2);
    expect(p.press('right')).toBe('none');
    expect(p.cursor).toBe(2);
    p.press('up');
    p.press('right');
    expect(p.press('down')).toBe('none');
    expect(p.cursor).toBe(1);
  });

  it('戰鬥中的招式面板以兩欄排列，並把欄數交給畫面', () => {
    const { app } = makeApp(8, undefined, { encounterRateOverride: 1 });
    app.press('confirm');
    settle(app);
    readAll(app);
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 12, app.newUid()));
    app.p.player = { map: 'route', x: 4, y: 3, facing: 'right' };
    app.press('right');
    settle(app);
    const b = app.battle!;
    while (b.phase === 'events') app.press('confirm');
    app.press('confirm'); // 招式
    const vm = b.vm();
    expect(vm.phase).toBe('panel');
    expect(vm.panel?.kind).toBe('moves');
    expect(vm.panel?.columns).toBe(2);
    app.press('down');
    expect(b.vm().panel?.cursor).toBe(2);
  });
});
