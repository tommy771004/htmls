import { describe, expect, it } from 'vitest';
import { isSafeLanding } from '../../src/core/content';
import { isWalkable, resolveMove, interactTarget } from '../../src/core/world';
import { getMap, MAP_LIST } from '../../src/data/maps';
import { makeApp, readAll, settle } from '../helpers/driver';

describe('地圖碰撞', () => {
  const village = getMap('village');
  it('牆、樹、水、NPC 與地圖外都不能走', () => {
    expect(isWalkable(village, {}, 0, 0)).toBe(false); // 樹
    expect(isWalkable(village, {}, 2, 4)).toBe(false); // 牆
    expect(isWalkable(village, {}, 1, 10)).toBe(false); // 水
    expect(isWalkable(village, {}, 10, 7)).toBe(false); // 禾老師
    expect(isWalkable(village, {}, -1, 5)).toBe(false);
    expect(isWalkable(village, {}, 99, 5)).toBe(false);
    expect(isWalkable(village, {}, 10, 8)).toBe(true);
  });

  it('撞牆時位置不變，只改變朝向', () => {
    const { app } = makeApp();
    app.press('confirm');
    settle(app);
    readAll(app);
    const before = { ...app.p.player };
    app.press('up'); // 前方是禾老師
    expect(app.p.player.x).toBe(before.x);
    expect(app.p.player.y).toBe(before.y);
    app.press('left');
    expect(app.p.player.facing).toBe('left');
    expect(app.p.player.x).toBe(before.x - 1);
  });

  it('互動要面向對象且在旁邊；隔著櫃台可以和店員說話', () => {
    expect(interactTarget(village, {}, 10, 8, 'up')?.def.id).toBe('tutor');
    expect(interactTarget(village, {}, 10, 8, 'down')).toBeNull();
    expect(interactTarget(village, {}, 10, 9, 'up')).toBeNull(); // 距離兩格
    expect(interactTarget(village, {}, 15, 10, 'up')?.def.id).toBe('shopkeeper');
  });
});

describe('安全傳送', () => {
  it('每個出入口的落點都可站立、不是傳送點、沒有人', () => {
    for (const map of MAP_LIST) {
      for (const warp of map.warps) {
        expect(isSafeLanding(getMap(warp.to), warp.dest.x, warp.dest.y), `${map.id}(${warp.x},${warp.y})`).toBe(true);
      }
    }
  });

  it('走進出口只切換一次，落地後往回走一步又能回到原地圖', () => {
    const { app } = makeApp();
    app.press('confirm');
    settle(app);
    readAll(app);
    app.p.flags.gotStarter = true;
    app.p.player = { map: 'village', x: 9, y: 1, facing: 'up' };
    app.press('up');
    expect(app.mode).toBe('transition');
    // 轉場中的輸入全部忽略
    app.press('up');
    app.press('confirm');
    app.endTransition();
    app.endTransition();
    expect(app.p.player).toEqual({ map: 'route', x: 9, y: 21, facing: 'up' });
    expect(app.mode).toBe('explore');
    app.press('down');
    settle(app);
    expect(app.p.player.map).toBe('village');
    expect(app.p.player.y).toBe(1);
  });

  it('條件未達成時出口會擋住並說明原因，不會切換地圖', () => {
    const route = getMap('route');
    const r = resolveMove(route, { firstCatch: true }, 7, 1, 'up');
    expect(r.kind).toBe('gate');
    if (r.kind === 'gate') expect(r.rule.flag).toBe('healedAfterCatch');
    expect(resolveMove(route, { firstCatch: true, healedAfterCatch: true }, 7, 1, 'up').kind).toBe('step');
  });
});
