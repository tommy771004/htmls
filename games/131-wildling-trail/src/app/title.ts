import { getMap } from '../data/maps';
import { formatPlayTime } from './menus';
import type { GameApp } from './game';
import { Panel } from './panel';

/** 標題畫面：繼續、新遊戲、設定。損壞的存檔會說明原因並提供重新開始。 */
export function buildTitlePanel(app: GameApp): Panel {
  const options = (): { label: string; run: () => void; disabled?: boolean; sub?: string }[] => {
    const load = app.titleLoad;
    const list: { label: string; run: () => void; disabled?: boolean; sub?: string }[] = [];
    if (load.status === 'ok') {
      list.push({
        label: '繼續旅程',
        sub: `${getMap(load.progress.player.map).name}・${formatPlayTime(load.progress.playTimeMs)}・隊伍 ${load.progress.party.length} 隻`,
        run: () => app.continueGame(),
      });
      list.push({
        label: '新的旅程',
        run: () =>
          app.ask(['要開始新的旅程嗎？原本的進度會保留，直到你在新旅程中存檔才會被覆蓋。'], {
            options: ['開始新旅程', '取消'],
            cancelIndex: 1,
            onPick: (i) => {
              if (i === 0) app.startNewGame();
            },
          }),
      });
    } else if (load.status === 'corrupt') {
      list.push({
        label: '重新開始',
        sub: '損壞的存檔會先另外備份，不會直接刪除',
        run: () => app.startNewGame(),
      });
    } else {
      list.push({ label: '開始旅程', run: () => app.startNewGame() });
    }
    list.push({ label: '設定', run: () => app.openSettings() });
    return list;
  };
  return new Panel({
    kind: 'title',
    title: '旅程選單',
    rows: () => options().map((o) => ({ label: o.label, sub: o.sub, disabled: o.disabled })),
    detail: () => {
      const load = app.titleLoad;
      if (load.status === 'corrupt') {
        return { title: '存檔讀取失敗', lines: [`原因：${load.error}`, '可以選「重新開始」；損壞的存檔會先備份到另一個位置。'] };
      }
      if (!app.slot.available) return { lines: ['這個瀏覽器無法使用存檔，進度會在關閉頁面後消失。'] };
      return undefined;
    },
    onConfirm: (i) => {
      const o = options()[i];
      if (!o || o.disabled) return;
      app.sfx('confirm');
      o.run();
    },
  });
}
