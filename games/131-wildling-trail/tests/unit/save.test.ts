import { describe, expect, it } from 'vitest';
import { GameApp } from '../../src/app/game';
import { createMonster } from '../../src/core/monster';
import { CORRUPT_KEY, MemoryStorage, parseSave, SAVE_KEY, serializeSave } from '../../src/core/save';
import { makeApp, readAll, settle } from '../helpers/driver';

function startedWithSave() {
  const storage = new MemoryStorage();
  const { app } = makeApp(21, storage);
  app.press('confirm');
  settle(app);
  readAll(app);
  app.p.flags.gotStarter = true;
  app.p.flags.firstWildBattle = true;
  app.p.flags.firstCatch = true;
  app.p.flags.healedAfterCatch = true;
  app.p.party.push(createMonster('bubblet', 7, app.newUid()));
  app.p.box.push(createMonster('sprigling', 3, app.newUid()));
  app.p.bag.cage = 4;
  app.p.money = 777;
  app.p.dex = { seen: ['bubblet', 'sprigling', 'cinderow'], caught: ['bubblet', 'sprigling'] };
  app.p.defeated = ['ranger'];
  app.p.flags.hasPermit = true;
  app.p.player = { map: 'forest', x: 9, y: 17, facing: 'left' };
  app.updateSettings({ reducedMotion: true, sound: false });
  expect(app.save()).toBeNull();
  return { app, storage };
}

describe('讀檔後世界進度一致', () => {
  it('位置、隊伍、收納、背包、金錢、圖鑑、旗標、對手與設定全部還原', () => {
    const { app, storage } = startedWithSave();
    const loaded = new GameApp({ storage, seed: 1 });
    expect(loaded.titleLoad.status).toBe('ok');
    expect(loaded.settings.reducedMotion).toBe(true);
    loaded.press('confirm');
    settle(loaded);
    expect(loaded.p).toEqual(app.p);
    expect(loaded.objective()!.id).toBe('boss');
    // 新產生的個體不會和舊的撞號
    const uid = loaded.newUid();
    expect([...loaded.p.party, ...loaded.p.box].some((m) => m.uid === uid)).toBe(false);
  });

  it('存檔內容是可以重建的純資料', () => {
    const { app } = startedWithSave();
    const raw = serializeSave(app.p, 123);
    const back = parseSave(raw);
    expect(back.status).toBe('ok');
    if (back.status === 'ok') expect(back.progress).toEqual(app.p);
  });
});

describe('損壞存檔', () => {
  const cases: [string, (data: any) => void][] = [
    ['不存在的物種', (d) => (d.progress.party[0].species = 'pikachu')],
    ['HP 超過上限', (d) => (d.progress.party[0].hp = 9999)],
    ['招式次數為負', (d) => (d.progress.party[0].moves[0].pp = -1)],
    ['未知旗標', (d) => (d.progress.flags.hacked = true)],
    ['站在牆上', (d) => (d.progress.player = { map: 'village', x: 0, y: 0, facing: 'up' })],
    ['不存在的地圖', (d) => (d.progress.player.map = 'moon')],
    ['重複的個體', (d) => d.progress.box.push(d.progress.party[0])],
    ['金錢不是整數', (d) => (d.progress.money = 12.5)],
    ['版本不符', (d) => (d.version = 99)],
    ['經驗與等級不一致', (d) => (d.progress.party[0].exp = 0)],
    ['不存在的道具', (d) => (d.progress.bag.masterball = 1)],
  ];

  for (const [label, mutate] of cases) {
    it(`${label} → 判定為損壞`, () => {
      const { storage } = startedWithSave();
      const data = JSON.parse(storage.getItem(SAVE_KEY)!);
      mutate(data);
      storage.setItem(SAVE_KEY, JSON.stringify(data));
      const app = new GameApp({ storage, seed: 1 });
      expect(app.titleLoad.status).toBe('corrupt');
    });
  }

  it('不是 JSON 也不會白畫面：標題顯示原因，並提供重新開始', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{broken');
    const app = new GameApp({ storage, seed: 1 });
    expect(app.mode).toBe('title');
    const vm = app.topPanel!.vm();
    expect(vm.detail?.title).toBe('存檔讀取失敗');
    expect(vm.rows.map((r) => r.label)).toEqual(['重新開始', '設定']);
  });

  it('重新開始前會備份損壞的存檔；在新遊戲存檔之前原資料不會被覆寫', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{broken');
    const app = new GameApp({ storage, seed: 1 });
    app.press('confirm'); // 重新開始
    settle(app);
    readAll(app);
    expect(storage.getItem(CORRUPT_KEY)).toBe('{broken');
    expect(storage.getItem(SAVE_KEY)).toBe('{broken');
    expect(app.save()).toBeNull();
    expect(parseSave(storage.getItem(SAVE_KEY)!).status).toBe('ok');
    expect(storage.getItem(CORRUPT_KEY)).toBe('{broken');
  });

  it('瀏覽器不允許存取 localStorage 時仍能遊玩，只是無法存檔', () => {
    const app = new GameApp({ storage: null, seed: 1 });
    app.press('confirm');
    settle(app);
    readAll(app);
    expect(app.mode).toBe('explore');
    expect(app.save()).toContain('無法存檔');
  });

  it('寫入時丟例外不會讓遊戲中斷，原存檔保持不變', () => {
    const { storage, app } = startedWithSave();
    const before = storage.getItem(SAVE_KEY);
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    app.p.money = 1;
    expect(app.save()).toContain('拒絕寫入');
    expect(storage.getItem(SAVE_KEY)).toBe(before);
  });
});
