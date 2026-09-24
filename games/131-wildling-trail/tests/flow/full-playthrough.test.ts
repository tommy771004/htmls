// 固定種子的完整流程：新遊戲 → 初始夥伴 → 戰鬥 → 捕捉 → 治療 → 森林任務 → 首領 → 通關 → 讀檔驗證。
// 全程只透過按鍵與劇本操作，不直接改寫進度。

import { describe, expect, it } from 'vitest';
import { GameApp } from '../../src/app/game';
import { isFainted, maxHp } from '../../src/core/monster';
import { MemoryStorage } from '../../src/core/save';
import { getMap } from '../../src/data/maps';
import {
  autoBattle,
  goToMap,
  makeApp,
  press,
  readAll,
  settle,
  stats,
  talkTo,
  walkTo,
} from '../helpers/driver';

const SEED = 20260924;

function lead(app: GameApp) {
  return app.p.party[0];
}

function partyWeak(app: GameApp): boolean {
  return app.p.party.every((m) => isFainted(m) || m.hp / maxHp(m) < 0.35);
}

/** 在草叢來回走，直到隊首（初始夥伴）達到等級；體力不支就回村治療。 */
function grind(app: GameApp, mapId: string, level: number, capture: (app: GameApp) => boolean = () => false): void {
  let guard = 0;
  while (lead(app).level < level) {
    if (++guard > 2000) throw new Error(`練等卡住：${app.p.party.map((m) => `${m.nickname}${m.level}`).join(',')}`);
    if (partyWeak(app) || app.p.player.map !== mapId) {
      goToMap(app, 'village', (a) => autoBattle(a, capture));
      talkTo(app, 'healer', (a) => autoBattle(a, capture));
      readAll(app, (opts) => opts.indexOf('好，麻煩了'));
      // 把等級最低的放到隊首，讓牠吃到經驗值
      goToMap(app, mapId, (a) => autoBattle(a, capture));
    }
    const map = getMap(mapId);
    const grass: [number, number][] = [];
    map.rows.forEach((row, y) => [...row].forEach((ch, x) => (ch === ',' || ch === ';') && grass.push([x, y])));
    const [gx, gy] = grass[Math.floor(grass.length / 2)];
    walkTo(app, gx, gy, (a) => autoBattle(a, capture));
    // 左右來回
    for (let i = 0; i < 12 && !partyWeak(app); i++) {
      const before = app.p.player.x;
      app.press(i % 2 === 0 ? 'left' : 'right');
      if (app.p.player.x === before) app.press(i % 2 === 0 ? 'right' : 'left');
      if (app.mode === 'transition') {
        settle(app);
        if (app.battle) autoBattle(app, capture);
        settle(app);
        readAll(app);
      }
    }
  }
}

describe('完整流程（固定種子）', () => {
  it('從新遊戲一路玩到通關，並在讀檔後保持一致', () => {
    const storage = new MemoryStorage();
    const { app } = makeApp(SEED, storage);
    expect(app.mode).toBe('title');

    // 新遊戲 → 操作教學
    app.press('confirm');
    settle(app);
    const tutorial = readAll(app);
    expect(tutorial.join('')).toContain('方向鍵');
    expect(app.mode).toBe('explore');
    expect(app.objective()!.id).toBe('starter');

    // 沒有夥伴時出不了村子
    walkTo(app, 9, 1, () => {
      throw new Error('不該遇到戰鬥');
    });
    app.press('up');
    expect(app.mode).toBe('dialog');
    expect(app.dialog!.vm().text).toContain('禾老師');
    readAll(app);
    expect(app.p.player.map).toBe('village');

    // 選擇初始怪獸 → 取得捕捉道具
    talkTo(app, 'tutor', () => undefined);
    readAll(app);
    expect(app.mode).toBe('menu');
    expect(app.topPanel!.kind).toBe('starter');
    app.press('confirm'); // 燭尾
    readAll(app, (opts) => opts.findIndex((o) => o.startsWith('就決定')));
    expect(app.p.party).toHaveLength(1);
    expect(app.p.party[0].species).toBe('wickling');
    expect(app.p.bag.cage).toBe(5);
    expect(app.p.flags.gotStarter).toBe(true);
    expect(app.objective()!.id).toBe('grass');

    // 探索草地 → 野生遭遇 → 戰鬥與捕捉
    goToMap(app, 'route', (a) => autoBattle(a, () => !a.p.flags.firstCatch));
    grind(app, 'route', 6, (a) => !a.p.flags.firstCatch || a.p.party.length < 3);
    const log = (label: string) => console.info(`${label}：勝 ${stats.wins} 敗 ${stats.losses} 捕捉 ${stats.catches}；${app.p.party.map((m) => `${m.nickname}${m.level}`).join(' ')} 銅貝 ${app.p.money}`);
    log('route L6')
    let guard = 0;
    while (!app.p.flags.firstCatch) {
      if (++guard > 20) throw new Error('一直抓不到');
      grind(app, 'route', lead(app).level + 1, () => true);
    }
    expect(app.p.flags.firstWildBattle).toBe(true);
    expect(app.p.party.length).toBeGreaterThanOrEqual(2);
    expect(app.p.dex.caught.length).toBeGreaterThanOrEqual(2);
    // 練等途中可能已經回村治療過；兩種情況的目標都要正確。
    expect(app.objective()!.id).toBe(app.p.flags.healedAfterCatch ? 'trial' : 'heal');
    if (!app.p.flags.healedAfterCatch) {
      // 還沒治療前森林入口擋住
      const route = getMap('route');
      const forestWarp = route.warps.find((w) => w.to === 'forest')!;
      goToMap(app, 'route', (a) => autoBattle(a));
      walkTo(app, forestWarp.x, forestWarp.y + 1, (a) => autoBattle(a));
      app.press('up');
      expect(app.mode).toBe('dialog');
      readAll(app);
      expect(app.p.player.map).toBe('route');
    }

    // 回村治療及補給
    goToMap(app, 'village', (a) => autoBattle(a));
    talkTo(app, 'healer', (a) => autoBattle(a));
    readAll(app, (opts) => opts.indexOf('好，麻煩了'));
    expect(app.p.flags.healedAfterCatch).toBe(true);
    expect(app.objective()!.id).toBe('trial');
    expect(app.p.party.every((m) => m.hp === maxHp(m))).toBe(true);
    talkTo(app, 'shopkeeper', () => undefined);
    readAll(app);
    expect(app.topPanel!.kind).toBe('shop');
    press(app, 'down', 'down'); // 莓果露
    app.press('confirm');
    press(app, 'up', 'up'); // 3 個
    app.press('confirm');
    readAll(app, (opts) => opts.indexOf('購買'));
    expect(app.p.bag.berry).toBeGreaterThanOrEqual(3);
    app.press('cancel');
    readAll(app);
    expect(app.mode).toBe('explore');

    // 探索森林 → 完成挑戰資格
    grind(app, 'route', 9);
    log('route L9');
    goToMap(app, 'forest', (a) => autoBattle(a));
    grind(app, 'forest', 11);
    log('forest L11');
    goToMap(app, 'forest', (a) => autoBattle(a));
    let tries = 0;
    while (!app.p.flags.hasPermit) {
      if (++tries > 6) throw new Error('打不贏守林人');
      talkTo(app, 'ranger', (a) => autoBattle(a));
      readAll(app, (opts) => opts.indexOf('開始對戰'));
      settle(app);
      if (app.battle) autoBattle(app);
      readAll(app);
      if (!app.p.flags.hasPermit) grind(app, 'forest', lead(app).level + 1);
    }
    log('ranger');
    expect(app.p.defeated).toContain('ranger');
    const moneyAfterRanger = app.p.money;
    // 一次性獎勵不能重複領
    talkTo(app, 'ranger', (a) => autoBattle(a));
    readAll(app);
    expect(app.p.money).toBe(moneyAfterRanger);
    expect(app.objective()!.id).toBe('boss');

    // 擊敗首領 → 通關畫面
    grind(app, 'forest', 13);
    goToMap(app, 'arena', (a) => autoBattle(a));
    tries = 0;
    while (!app.p.flags.bossDefeated) {
      if (++tries > 8) throw new Error('打不贏場主');
      if (app.p.player.map !== 'arena') goToMap(app, 'arena', (a) => autoBattle(a));
      talkTo(app, 'boss', (a) => autoBattle(a));
      readAll(app, (opts) => opts.indexOf('開始挑戰'));
      settle(app);
      if (app.battle) autoBattle(app);
      readAll(app);
      if (!app.p.flags.bossDefeated) grind(app, 'forest', lead(app).level + 1);
    }
    log('boss');
    expect(app.mode).toBe('cleared');
    expect(app.clearedVM().party.length).toBeGreaterThan(0);
    app.press('confirm');
    readAll(app);
    expect(app.p.flags.clearedShown).toBe(true);
    expect(app.objective()!.id).toBe('free');

    // 繼續自由探索：還能走動
    const before = { ...app.p.player };
    app.press('down');
    settle(app);
    readAll(app);
    expect(app.mode).toBe('explore');
    expect(app.p.player).not.toEqual(before);

    // 讀檔驗證
    expect(app.save()).toBeNull();
    const snapshot = structuredClone(app.p);
    const reloaded = new GameApp({ storage, seed: 1 });
    expect(reloaded.titleLoad.status).toBe('ok');
    reloaded.press('confirm'); // 繼續旅程
    settle(reloaded);
    expect(reloaded.p).toEqual(snapshot);
    expect(reloaded.objective()!.id).toBe('free');
    expect(reloaded.p.defeated).toEqual(expect.arrayContaining(['ranger', 'boss']));

    // 紀錄這次通關的規模，方便調整平衡
    console.info(
      `通關：${Math.round(app.p.playTimeMs / 1000)}s（假時鐘） 勝 ${stats.wins} 敗 ${stats.losses} 捕捉 ${stats.catches}；隊伍 ${app.p.party
        .map((m) => `${m.nickname} Lv${m.level}`)
        .join('、')}`,
    );
  });
});
