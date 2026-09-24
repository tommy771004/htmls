// 探索中的選單：隊伍、背包、圖鑑、旅行筆記、存檔、設定。

import { MAX_LEVEL, displayName, expForLevel, isFainted, maxHp, statsOf } from '../core/monster';
import { swapParty } from '../core/party';
import { MILESTONES } from '../core/progress';
import type { MonsterInstance } from '../core/types';
import { ELEMENT_NAME } from '../data/elements';
import { getItem, ITEM_LIST } from '../data/items';
import { getMap } from '../data/maps';
import { getMove } from '../data/moves';
import { getSpecies, SPECIES_LIST } from '../data/species';
import type { GameApp } from './game';
import { Panel } from './panel';
import type { ListRow } from './types';

const STATUS_NAME: Record<string, string> = { none: '', burn: '灼傷', poison: '中毒', sleep: '睡眠' };

export function formatPlayTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function monRow(mon: MonsterInstance, extra = ''): ListRow {
  const fainted = isFainted(mon);
  return {
    label: displayName(mon),
    right: `Lv.${mon.level}`,
    sub: [fainted ? '倒下' : STATUS_NAME[mon.status], extra].filter(Boolean).join('・'),
    icon: getSpecies(mon.species).sprite.icon,
    hp: [mon.hp, maxHp(mon)],
    tone: fainted ? 'muted' : undefined,
  };
}

export function buildMainMenu(app: GameApp): Panel {
  const entries: { label: string; run: () => void }[] = [
    { label: '隊伍', run: () => app.openPanel(buildPartyPanel(app)) },
    { label: '背包', run: () => app.openPanel(buildBagPanel(app)) },
    { label: '圖鑑', run: () => app.openPanel(buildDexPanel(app)) },
    { label: '旅行筆記', run: () => app.openPanel(buildNotesPanel(app)) },
    { label: '存檔', run: () => app.openPanel(buildSavePanel(app)) },
    { label: '設定', run: () => app.openPanel(buildSettingsPanel(app)) },
    { label: '關閉', run: () => app.closeAllPanels() },
  ];
  return new Panel({
    kind: 'main',
    title: '選單',
    rows: () =>
      entries.map((e) => {
        if (e.label === '隊伍') return { label: e.label, right: `${app.p.party.length}/6` };
        if (e.label === '圖鑑') return { label: e.label, right: `${app.p.dex.caught.length}/${SPECIES_LIST.length}` };
        return { label: e.label };
      }),
    detail: () => ({
      lines: [`${getMap(app.p.player.map).name}`, `銅貝 ${app.p.money}`, `遊玩時間 ${formatPlayTime(app.p.playTimeMs)}`],
    }),
    onConfirm: (i) => {
      app.sfx('confirm');
      entries[i].run();
    },
    onCancel: () => app.closeAllPanels(),
  });
}

// ---------- 隊伍 ----------

export function buildPartyPanel(app: GameApp): Panel {
  let swapFrom: number | null = null;
  const panel: Panel = new Panel({
    kind: 'party',
    title: () => (swapFrom === null ? '隊伍' : '要和哪一隻交換位置？'),
    rows: () => {
      if (app.p.party.length === 0) return [{ label: '還沒有夥伴', disabled: true, tone: 'muted' }];
      return app.p.party.map((m, i) => ({ ...monRow(m, i === 0 ? '領頭' : ''), tone: i === swapFrom ? 'accent' : monRow(m).tone }));
    },
    hint: () => (swapFrom === null ? '第一隻會最先出戰。' : '選另一隻完成交換，按取消放棄。'),
    onConfirm: (i) => {
      const mon = app.p.party[i];
      if (!mon) return;
      if (swapFrom !== null) {
        if (swapFrom !== i) swapParty(app.p, swapFrom, i);
        swapFrom = null;
        app.sfx('confirm');
        return;
      }
      app.sfx('confirm');
      app.ask([`要對${displayName(mon)}做什麼？`], {
        options: ['查看能力', '調換順序', '取消'],
        cancelIndex: 2,
        onPick: (k) => {
          if (k === 0) app.openPanel(buildSummaryPanel(app, mon));
          if (k === 1) swapFrom = i;
        },
      });
    },
    onCancel: () => {
      if (swapFrom !== null) swapFrom = null;
      else app.closePanel(panel);
    },
  });
  return panel;
}

export function buildSummaryPanel(app: GameApp, mon: MonsterInstance): Panel {
  const panel: Panel = new Panel({
    kind: 'summary',
    title: () => `${displayName(mon)}・Lv.${mon.level}`,
    rows: () =>
      mon.moves.map((slot) => {
        const move = getMove(slot.id);
        return {
          label: move.name,
          right: `${slot.pp}/${move.pp}`,
          sub: `${move.type ? ELEMENT_NAME[move.type] : '無'}・${move.power > 0 ? `威力 ${move.power}` : '變化'}`,
        };
      }),
    detail: (i) => {
      const species = getSpecies(mon.species);
      const s = statsOf(mon);
      const next = mon.level >= MAX_LEVEL ? '已達等級上限' : `再 ${expForLevel(mon.level + 1) - mon.exp} 經驗值升級`;
      const move = mon.moves[i] ? getMove(mon.moves[i].id) : null;
      return {
        title: `${species.name}（${ELEMENT_NAME[species.type]}屬性）`,
        sprite: species.sprite.front,
        lines: [
          `HP ${mon.hp}/${maxHp(mon)}　攻擊 ${s.atk}　防禦 ${s.def}　速度 ${s.spd}`,
          `${next}${mon.status !== 'none' ? `・${STATUS_NAME[mon.status]}` : ''}`,
          move ? `${move.name}：${move.desc}` : '',
        ].filter(Boolean),
      };
    },
    onConfirm: () => undefined,
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}

/** 選一隻隊伍中的怪獸；用於道具。 */
export function buildPickMonPanel(app: GameApp, title: string, onPick: (mon: MonsterInstance) => void): Panel {
  const panel: Panel = new Panel({
    kind: 'pick',
    title,
    rows: () => app.p.party.map((m) => monRow(m)),
    onConfirm: (i) => {
      const mon = app.p.party[i];
      if (mon) onPick(mon);
    },
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}

// ---------- 背包 ----------

function bagIds(app: GameApp): string[] {
  return ITEM_LIST.map((i) => i.id).filter((id) => (app.p.bag[id] ?? 0) > 0);
}

/** 探索中對隊伍使用回復或治療道具；不合法時不消耗。 */
export function useFieldItem(app: GameApp, itemId: string, mon: MonsterInstance): string | null {
  const item = getItem(itemId);
  if ((app.p.bag[itemId] ?? 0) <= 0) return '沒有這個道具了。';
  if (item.kind === 'capture') return `${item.name}只能在和野生怪獸戰鬥時使用。`;
  if (isFainted(mon)) return `${displayName(mon)}已經倒下了，要到治療所才能恢復。`;
  if (item.kind === 'heal') {
    if (mon.hp >= maxHp(mon)) return `${displayName(mon)}的 HP 已經是滿的。`;
    const before = mon.hp;
    mon.hp = Math.min(maxHp(mon), mon.hp + item.value);
    app.p.bag[itemId] -= 1;
    return `${displayName(mon)}回復了 ${mon.hp - before} HP！`;
  }
  if (mon.status === 'none') return `${displayName(mon)}沒有需要治療的狀態。`;
  mon.status = 'none';
  mon.sleepTurns = 0;
  app.p.bag[itemId] -= 1;
  return `${displayName(mon)}的身體狀態恢復了！`;
}

export function buildBagPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'bag',
    title: '背包',
    rows: () => {
      const ids = bagIds(app);
      if (ids.length === 0) return [{ label: '背包是空的', disabled: true, tone: 'muted' }];
      return ids.map((id) => {
        const item = getItem(id);
        return { label: item.name, right: `×${app.p.bag[id]}`, icon: item.sprite, sub: item.kind === 'capture' ? '戰鬥中使用' : undefined };
      });
    },
    detail: (i) => {
      const id = bagIds(app)[i];
      if (!id) return { lines: ['可以在芽口村阿良的攤位購買道具。'] };
      const item = getItem(id);
      return { title: item.name, sprite: item.sprite, lines: [item.desc] };
    },
    onConfirm: (i) => {
      const id = bagIds(app)[i];
      if (!id) return;
      const item = getItem(id);
      if (item.kind === 'capture') {
        app.sfx('error');
        app.say([`${item.name}只能在和野生怪獸戰鬥時，從戰鬥選單的「背包」使用。`]);
        return;
      }
      if (app.p.party.length === 0) {
        app.sfx('error');
        app.say(['還沒有夥伴可以使用道具。']);
        return;
      }
      app.sfx('confirm');
      const pick = buildPickMonPanel(app, `對誰使用${item.name}？`, (mon) => {
        const before = app.p.bag[id] ?? 0;
        const msg = useFieldItem(app, id, mon);
        const used = (app.p.bag[id] ?? 0) < before;
        app.sfx(used ? 'heal' : 'error');
        app.closePanel(pick);
        app.say([msg ?? '']);
      });
      app.openPanel(pick);
    },
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}

// ---------- 圖鑑 ----------

export function buildDexPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'dex',
    title: () => `圖鑑　見過 ${app.p.dex.seen.length}・捕捉 ${app.p.dex.caught.length}／${SPECIES_LIST.length}`,
    rows: () =>
      SPECIES_LIST.map((s, i) => {
        const seen = app.p.dex.seen.includes(s.id);
        const caught = app.p.dex.caught.includes(s.id);
        return {
          label: `No.${String(i + 1).padStart(2, '0')} ${seen ? s.name : '？？？'}`,
          right: caught ? '已捕捉' : seen ? '已見過' : '',
          icon: seen ? s.sprite.icon : undefined,
          tone: caught ? 'ok' : seen ? undefined : 'muted',
        };
      }),
    detail: (i) => {
      const s = SPECIES_LIST[i];
      const seen = app.p.dex.seen.includes(s.id);
      const caught = app.p.dex.caught.includes(s.id);
      if (!seen) return { title: '？？？', lines: ['還沒遇過這種野靈。'] };
      const lines = [`${ELEMENT_NAME[s.type]}屬性`];
      if (caught) {
        lines.push(s.dex);
        if (s.evolution) lines.push(`Lv.${s.evolution.level} 進化成${getSpecies(s.evolution.into).name}`);
      } else {
        lines.push('捕捉之後才會記錄詳細資料。');
      }
      return { title: s.name, sprite: s.sprite.front, lines };
    },
    onConfirm: () => undefined,
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}

// ---------- 旅行筆記 ----------

export function buildNotesPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'notes',
    title: '旅行筆記',
    rows: () => MILESTONES.map((m) => ({ label: m.label, right: app.p.flags[m.flag] ? '完成' : '', tone: app.p.flags[m.flag] ? 'ok' : 'muted' })),
    detail: () => {
      const o = app.objective()!;
      return { title: `目前目標：${o.title}`, lines: [o.detail] };
    },
    onConfirm: () => undefined,
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}

// ---------- 存檔 ----------

export function buildSavePanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'save',
    title: '存檔',
    rows: () => [{ label: '儲存目前進度' }, { label: '返回' }],
    detail: () => {
      const load = app.slot.load();
      const last = load.status === 'ok' ? `上次存檔：${getMap(load.progress.player.map).name}・${formatPlayTime(load.progress.playTimeMs)}` : load.status === 'empty' ? '還沒有存檔。' : '目前的存檔已損壞，存檔會覆蓋它（損壞檔已另外備份）。';
      return {
        lines: [
          `現在：${getMap(app.p.player.map).name}・遊玩 ${formatPlayTime(app.p.playTimeMs)}`,
          `隊伍 ${app.p.party.length} 隻・圖鑑 ${app.p.dex.caught.length}/${SPECIES_LIST.length}・銅貝 ${app.p.money}`,
          last,
          '戰鬥結束、治療、購物與撿到道具時也會自動存檔。',
        ],
      };
    },
    onConfirm: (i) => {
      if (i === 1) {
        app.closePanel(panel);
        return;
      }
      if (app.slot.load().status === 'corrupt') app.slot.backupCorrupt();
      const error = app.save();
      app.sfx(error ? 'error' : 'save');
      app.say([error ?? '進度已經存好了。']);
    },
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}

// ---------- 設定 ----------

export function buildSettingsPanel(app: GameApp): Panel {
  const items = [
    { label: '音效', get: () => app.settings.sound, set: (v: boolean) => app.updateSettings({ sound: v }), on: '開', off: '關' },
    { label: '減少動態效果', get: () => app.settings.reducedMotion, set: (v: boolean) => app.updateSettings({ reducedMotion: v }), on: '開', off: '關' },
    { label: '文字速度', get: () => app.settings.instantText, set: (v: boolean) => app.updateSettings({ instantText: v }), on: '立即', off: '逐字' },
  ];
  const panel: Panel = new Panel({
    kind: 'settings',
    title: '設定',
    rows: () => [...items.map((it) => ({ label: it.label, right: it.get() ? it.on : it.off })), { label: '返回' }],
    detail: (i) => {
      const lines = [
        ['音效只會在你第一次按鍵或觸控之後啟用。'],
        ['關掉畫面震動、閃光與移動補間；戰鬥結果完全相同。'],
        ['「立即」會一次顯示整段文字。'],
        ['按確認切換，左右鍵也可以切換。'],
      ][i] ?? [];
      return { lines };
    },
    onConfirm: (i) => {
      const it = items[i];
      if (!it) {
        app.closePanel(panel);
        return;
      }
      it.set(!it.get());
      app.sfx('confirm');
    },
    onSide: () => {
      const it = items[panel.cursor];
      if (it) it.set(!it.get());
    },
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}
