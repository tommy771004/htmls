import { describe, expect, it } from 'vitest';
import { STEP_GUARD } from '../../src/app/constants';
import { createMonster } from '../../src/core/monster';
import { autoBattle, makeApp, readAll, settle } from '../helpers/driver';

/** 站在風草道高草叢 (4,3) 旁邊，遭遇率強制 100%。 */
function inGrass() {
  const { app, storage } = makeApp(99, undefined, { encounterRateOverride: 1 });
  app.press('confirm');
  settle(app);
  readAll(app);
  app.p.flags.gotStarter = true;
  app.p.party.push(createMonster('wickling', 20, app.newUid()));
  app.p.player = { map: 'route', x: 4, y: 3, facing: 'down' };
  return { app, storage };
}

describe('野生遭遇', () => {
  it('原地不動、轉身、撞牆都不會遭遇', () => {
    const { app } = inGrass();
    // (4,3) 在高草叢，北邊 (4,2) 也是高草叢；先把自己圍在牆邊測撞牆
    app.p.player = { map: 'route', x: 3, y: 3, facing: 'left' };
    app.press('left'); // (2,3) 是草地 → 會走；換成撞樹
    app.p.player = { map: 'route', x: 1, y: 3, facing: 'left' };
    for (let i = 0; i < 20; i++) app.press('left'); // (0,3) 是樹
    expect(app.mode).toBe('explore');
    expect(app.battle).toBeNull();
    expect(app.transition).toBeNull();
  });

  it('對話與選單中的按鍵不會移動，也不會遭遇', () => {
    const { app } = inGrass();
    app.press('menu');
    expect(app.mode).toBe('menu');
    const pos = { ...app.p.player };
    for (const b of ['up', 'down', 'left', 'right'] as const) app.press(b);
    expect(app.p.player.x).toBe(pos.x);
    expect(app.p.player.y).toBe(pos.y);
    expect(app.transition).toBeNull();
  });

  it('只有成功走進草叢格子才會遭遇', () => {
    const { app } = inGrass();
    app.p.player = { map: 'route', x: 2, y: 3, facing: 'right' }; // 草地
    app.press('right'); // 走進 (3,3) 高草叢
    expect(app.mode).toBe('transition');
    settle(app);
    expect(app.battle?.core.kind).toBe('wild');
  });

  it('走在非草叢的路上不會遭遇', () => {
    const { app } = inGrass();
    app.p.player = { map: 'route', x: 7, y: 5, facing: 'down' }; // 泥土路
    for (let i = 0; i < 4; i++) app.press('down');
    expect(app.battle).toBeNull();
    expect(app.transition).toBeNull();
  });

  it('戰鬥結束後有短暫的步數保護', () => {
    const { app } = inGrass();
    app.press('right'); // (5,3)
    settle(app);
    expect(app.battle).not.toBeNull();
    autoBattle(app);
    readAll(app);
    expect(app.stepGuard).toBe(STEP_GUARD);
    for (let i = 0; i < STEP_GUARD; i++) {
      app.press(i % 2 === 0 ? 'left' : 'right');
      expect(app.transition, `第 ${i + 1} 步`).toBeNull();
    }
    app.press('left');
    expect(app.mode).toBe('transition');
  });
});
