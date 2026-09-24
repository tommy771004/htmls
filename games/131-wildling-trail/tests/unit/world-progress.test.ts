import { describe, expect, it } from 'vitest';
import { purchase, purchaseCheck } from '../../src/core/inventory';
import { createMonster, maxHp } from '../../src/core/monster';
import { WHITEOUT_POS } from '../../src/data/maps';
import { getMove } from '../../src/data/moves';
import type { MonsterInstance } from '../../src/core/types';
import { makeApp, press, readAll, settle, talkTo } from '../helpers/driver';

/** 威力最高且必中率 100 的招式欄位。 */
function strongSlot(mon: MonsterInstance): number {
  let best = 0;
  mon.moves.forEach((m, i) => {
    const d = getMove(m.id);
    const cur = getMove(mon.moves[best].id);
    if (d.accuracy === 100 && (d.power > cur.power || cur.accuracy !== 100)) best = i;
  });
  return best;
}

function started(seed = 11) {
  const made = makeApp(seed);
  made.app.press('confirm');
  settle(made.app);
  readAll(made.app);
  return made;
}

describe('商店', () => {
  it('餘額不足時交易不成立，錢與背包都不變', () => {
    const wallet = { bag: { cage: 1 }, money: 50 };
    const r = purchase(wallet, 'fineCage', 1);
    expect(r.ok).toBe(false);
    expect(wallet).toEqual({ bag: { cage: 1 }, money: 50 });
    expect(purchaseCheck(wallet, 'cage', 0).ok).toBe(false);
    expect(purchase(wallet, 'cage', 1)).toEqual({ ok: true, spent: 40 });
    expect(wallet).toEqual({ bag: { cage: 2 }, money: 10 });
  });

  it('透過介面購買：選數量、確認後才扣款；錢不夠會說明原因', () => {
    const { app } = started();
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 5, app.newUid()));
    app.p.money = 90;
    talkTo(app, 'shopkeeper', () => undefined);
    readAll(app);
    expect(app.topPanel?.kind).toBe('shop');
    app.press('down'); // 精晶籠 100
    app.press('confirm');
    expect(app.topPanel?.kind).toBe('qty');
    app.press('confirm');
    const lines = readAll(app, (o) => o.indexOf('購買'));
    expect(lines.join('')).toContain('還差 10 銅貝');
    expect(app.p.money).toBe(90);
    expect(app.p.bag.fineCage ?? 0).toBe(0);
    // 改買 2 個晶籠
    app.press('cancel');
    app.press('up');
    app.press('confirm');
    app.press('up');
    app.press('confirm');
    readAll(app, (o) => o.indexOf('購買'));
    expect(app.p.money).toBe(10);
    expect(app.p.bag.cage).toBe(2);
  });
});

describe('一次性獎勵', () => {
  it('地上的道具只能撿一次（讀檔後也一樣）', () => {
    const { app, storage } = started();
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 5, app.newUid()));
    app.p.player = { map: 'route', x: 12, y: 5, facing: 'right' }; // routeBerry 在 (13,5)
    app.press('confirm');
    readAll(app);
    expect(app.p.bag.berry).toBe(2);
    app.press('confirm');
    expect(app.mode).toBe('explore');
    expect(app.p.bag.berry).toBe(2);
    const { app: again } = makeApp(1, storage);
    again.press('confirm');
    settle(again);
    again.p.player = { map: 'route', x: 12, y: 5, facing: 'right' };
    again.press('confirm');
    expect(again.mode).toBe('explore');
    expect(again.p.bag.berry).toBe(2);
  });

  it('訓練家的獎金與旗標只在第一次勝利時給', () => {
    const { app } = started();
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 30, app.newUid()));
    app.p.player = { map: 'forest', x: 9, y: 3, facing: 'right' };
    const money = app.p.money;
    app.press('confirm');
    readAll(app, (o) => o.indexOf('開始對戰'));
    settle(app);
    expect(app.battle?.core.kind).toBe('trainer');
    while (app.battle && app.battle.phase !== 'done') {
      const b = app.battle;
      if (b.phase === 'command') b.act({ kind: 'move', slot: strongSlot(b.core.playerMon) });
      else app.press('confirm');
    }
    settle(app);
    readAll(app);
    expect(app.p.flags.hasPermit).toBe(true);
    expect(app.p.money).toBe(money + 300);
    app.press('confirm');
    readAll(app);
    expect(app.battle).toBeNull();
    expect(app.p.money).toBe(money + 300);
    expect(app.p.defeated.filter((d) => d === 'ranger')).toHaveLength(1);
  });
});

describe('全隊倒下', () => {
  it('結束戰鬥、回到村子治療點、隊伍回滿，可以繼續操作', () => {
    const { app } = started();
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('sprigling', 2, app.newUid()));
    app.p.money = 500;
    app.p.player = { map: 'forest', x: 9, y: 3, facing: 'right' };
    app.press('confirm');
    readAll(app, (o) => o.indexOf('開始對戰'));
    settle(app);
    let guard = 0;
    while (app.battle && app.battle.phase !== 'done') {
      if (++guard > 500) throw new Error('卡住');
      const b = app.battle;
      if (b.phase === 'command') b.act({ kind: 'move', slot: 0 });
      else app.press('confirm');
    }
    expect(app.transition?.kind).toBe('whiteout');
    settle(app);
    const lines = readAll(app);
    expect(lines.join('')).toContain('芽口村');
    expect(app.mode).toBe('explore');
    expect(app.p.player).toEqual(WHITEOUT_POS);
    expect(app.p.party[0].hp).toBe(maxHp(app.p.party[0]));
    expect(app.p.money).toBe(450);
    expect(app.p.flags.hasPermit).toBeFalsy();
    // 可以立刻再走動
    app.press('down');
    expect(app.p.player.y).toBe(WHITEOUT_POS.y + 1);
  });

  it('戰鬥中重新整理會回到戰前快照', () => {
    const { app, storage } = started();
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 8, app.newUid()));
    app.giveItem('cage', 3);
    app.p.player = { map: 'forest', x: 9, y: 3, facing: 'right' };
    app.press('confirm');
    readAll(app, (o) => o.indexOf('開始對戰'));
    settle(app);
    const b = app.battle!;
    while (b.phase === 'events') app.press('confirm');
    b.act({ kind: 'move', slot: 0 });
    // 此時「重新整理」
    const { app: reloaded } = makeApp(1, storage);
    reloaded.press('confirm');
    settle(reloaded);
    expect(reloaded.p.party[0].hp).toBe(maxHp(reloaded.p.party[0]));
    expect(reloaded.p.party[0].moves[0].pp).toBe(app.p.party[0].moves[0].pp);
    expect(reloaded.p.player).toEqual({ map: 'forest', x: 9, y: 3, facing: 'right' });
    expect(reloaded.p.defeated).toEqual([]);
  });
});

describe('快速連按', () => {
  it('對 NPC 連按確認只會開一段對話，最後關閉時不會重新開始', () => {
    const { app } = started();
    let talks = 0;
    app.onEffect((e) => e.kind === 'sfx' && e.id === 'talk' && talks++);
    // 禾老師：兩行對話後打開選夥伴面板
    for (let i = 0; i < 3; i++) app.press('confirm');
    expect(talks).toBe(1);
    expect(app.topPanel?.kind).toBe('starter');
  });

  it('轉場中連按不會重複觸發遭遇或換地圖', () => {
    const { app } = makeApp(5, undefined, { encounterRateOverride: 1 });
    app.press('confirm');
    settle(app);
    readAll(app);
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 20, app.newUid()));
    app.p.player = { map: 'route', x: 4, y: 3, facing: 'right' };
    let encounters = 0;
    app.onEffect((e) => e.kind === 'sfx' && e.id === 'encounter' && encounters++);
    app.press('right');
    press(app, 'right', 'right', 'confirm', 'confirm', 'left', 'menu');
    expect(encounters).toBe(1);
    expect(app.p.player.x).toBe(5);
    settle(app);
    expect(app.battle).not.toBeNull();
  });

  it('購買確認只扣一次款；確認後的訊息要再按一次才會回到商店', () => {
    const { app } = started();
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 5, app.newUid()));
    app.p.money = 1000;
    talkTo(app, 'shopkeeper', () => undefined);
    readAll(app);
    app.press('confirm'); // 晶籠 → 數量
    app.press('confirm'); // 數量 1 → 詢問
    app.press('confirm'); // 購買
    expect(app.p.money).toBe(960);
    app.press('confirm'); // 關閉「謝謝惠顧」
    expect(app.p.money).toBe(960);
    expect(app.topPanel?.kind).toBe('shop');
  });

  it('戰鬥結算的最後一步連按，只會提交一次', () => {
    const { app } = makeApp(8, undefined, { encounterRateOverride: 1 });
    app.press('confirm');
    settle(app);
    readAll(app);
    app.p.flags.gotStarter = true;
    app.p.party.push(createMonster('wickling', 30, app.newUid()));
    app.p.player = { map: 'route', x: 4, y: 3, facing: 'right' };
    app.press('right');
    settle(app);
    const b = app.battle!;
    while (b.phase === 'events') app.press('confirm');
    b.act({ kind: 'move', slot: strongSlot(b.core.playerMon) });
    const money = app.p.money;
    for (let i = 0; i < 30; i++) app.press('confirm');
    expect(app.transition?.kind).toBe('battleOut');
    settle(app);
    expect(app.p.money - money).toBe(b.core.enemy[0].level * 8);
  });
});
