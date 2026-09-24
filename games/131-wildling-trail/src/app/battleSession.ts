// 戰鬥畫面的流程：播放事件 → 選指令 → 解決回合 → …… → 結算 → 一次提交。
// 規則全部在 core/battle.ts；這裡只負責介面狀態與呼叫順序。

import { Battle, type AnimCue, type BattleEvent, type BattleKind, type PlayerAction } from '../core/battle';
import { growthFlow, type GrowthStep } from '../core/growth';
import { MONEY_MAX } from '../core/inventory';
import { displayName, isFainted, maxHp } from '../core/monster';
import type { Rng } from '../core/rng';
import type { Bag, MonsterInstance } from '../core/types';
import { ELEMENT_NAME } from '../data/elements';
import { getItem, ITEM_LIST } from '../data/items';
import { getMove, STRUGGLE } from '../data/moves';
import { getSpecies } from '../data/species';
import { getTrainer } from '../data/trainers';
import type { GameApp } from './game';
import { WHITEOUT_MONEY_RATIO } from './constants';
import { Panel } from './panel';
import type { BattleVM, Button, ListRow, ResultVM } from './types';

export interface BattleSetup {
  kind: BattleKind;
  trainerId?: string;
  trainerName?: string;
  enemyParty: MonsterInstance[];
  party: MonsterInstance[];
  bag: Bag;
  rng: Rng;
  bg: string;
  partyRoom: boolean;
  onWin?: () => void;
  onLose?: () => void;
}

export interface BattleSummary {
  kind: BattleKind;
  outcome: 'win' | 'lose' | 'caught' | 'ran';
  trainerId?: string;
  party: MonsterInstance[];
  bag: Bag;
  seen: string[];
  caught: MonsterInstance | null;
  moneyDelta: number;
  onWin?: () => void;
  onLose?: () => void;
}

const COMMANDS = ['招式', '背包', '隊伍', '逃跑'] as const;

/** 野生戰勝利時的銅貝：對手等級 × 8（本遊戲自訂規則）。 */
export function wildPrize(enemy: MonsterInstance): number {
  return enemy.level * 8;
}

interface Shown {
  text: string;
  cues: AnimCue[];
  snap: BattleEvent['snap'];
  serial: number;
}

let serial = 0;

export class BattleSession {
  readonly core: Battle;
  phase: 'events' | 'command' | 'panel' | 'result' | 'done' = 'events';
  private queue: Shown[] = [];
  private qi = 0;
  commandCursor = 0;
  private panels: Panel[] = [];
  private growth: Generator<GrowthStep, void, number | undefined> | null = null;
  private growthStep: GrowthStep | null = null;
  private growthSerial = 0;
  private moneyDelta = 0;
  private resultPanel: Panel | null = null;

  constructor(
    private readonly app: GameApp,
    readonly setup: BattleSetup,
  ) {
    this.core = new Battle({
      kind: setup.kind,
      trainerName: setup.trainerName,
      playerParty: setup.party,
      enemyParty: setup.enemyParty,
      bag: setup.bag,
      rng: setup.rng,
      ai: setup.kind === 'trainer' ? 'smart' : 'wild',
      canStoreCatch: setup.partyRoom,
    });
  }

  start(): void {
    this.show(this.core.start());
  }

  private show(events: BattleEvent[]): void {
    this.queue = events.map((e) => ({ ...e, serial: ++serial }));
    this.qi = 0;
    this.panels = [];
    if (this.queue.length === 0) this.afterEvents();
    else this.phase = 'events';
  }

  /** 顯示一段不屬於回合的提示（例如「不能逃跑」），看完回到指令選單。 */
  private notice(text: string): void {
    this.app.sfx('error');
    this.show([{ text, cues: [], snap: this.core.snapshot() }]);
  }

  private afterEvents(): void {
    if (this.core.outcome) {
      this.beginResult();
      return;
    }
    if (this.core.needsPlayerSwitch) {
      this.phase = 'panel';
      this.panels = [this.partyPanel(true)];
      return;
    }
    this.phase = 'command';
  }

  get current(): Shown | null {
    return this.phase === 'events' ? this.queue[this.qi] ?? null : null;
  }

  // ---------- 輸入 ----------

  press(button: Button): void {
    switch (this.phase) {
      case 'events':
        if (button === 'confirm' || button === 'cancel') this.advance();
        return;
      case 'command':
        this.pressCommand(button);
        return;
      case 'panel': {
        const top = this.panels[this.panels.length - 1];
        const r = top?.press(button);
        if (r === 'cursor') this.app.sfx('cursor');
        else if (r === 'cancel') this.app.sfx('cancel');
        return;
      }
      case 'result':
        this.pressResult(button);
        return;
      case 'done':
        return;
    }
  }

  select(index: number): void {
    if (this.phase === 'command') {
      this.commandCursor = index;
      this.pressCommand('confirm');
    } else if (this.phase === 'panel') {
      const top = this.panels[this.panels.length - 1];
      if (!top) return;
      top.cursor = index;
      top.press('confirm');
    } else if (this.phase === 'result' && this.resultPanel) {
      this.resultPanel.cursor = index;
      this.resultPanel.press('confirm');
    } else if (this.phase === 'events' || this.phase === 'result') {
      this.press('confirm');
    }
  }

  /** 事件逐一前進；最後一個看完才進入下一階段。 */
  advance(): void {
    if (this.phase !== 'events') return;
    this.qi++;
    if (this.qi >= this.queue.length) this.afterEvents();
  }

  private pressCommand(button: Button): void {
    const grid = COMMANDS.length;
    if (button === 'up' || button === 'down') {
      this.commandCursor = (this.commandCursor + 2) % grid;
      this.app.sfx('cursor');
      return;
    }
    if (button === 'left' || button === 'right') {
      this.commandCursor = this.commandCursor % 2 === 0 ? this.commandCursor + 1 : this.commandCursor - 1;
      this.app.sfx('cursor');
      return;
    }
    if (button !== 'confirm') return;
    this.app.sfx('confirm');
    switch (COMMANDS[this.commandCursor]) {
      case '招式':
        this.openPanel(this.movePanel());
        return;
      case '背包':
        this.openPanel(this.bagPanel());
        return;
      case '隊伍':
        this.openPanel(this.partyPanel(false));
        return;
      case '逃跑':
        this.act({ kind: 'run' });
        return;
    }
  }

  private openPanel(panel: Panel): void {
    this.panels.push(panel);
    this.phase = 'panel';
  }

  private closePanel(): void {
    this.panels.pop();
    if (this.panels.length === 0) this.phase = 'command';
  }

  /** 驗證後執行一個玩家行動；不合法時顯示原因，不消耗回合。 */
  act(action: PlayerAction): void {
    if (this.phase !== 'command' && this.phase !== 'panel') return;
    const error = this.core.validate(action);
    if (error) {
      this.notice(error);
      return;
    }
    this.show(this.core.resolveTurn(action));
  }

  // ---------- 面板 ----------

  private movePanel(): Panel {
    const mon = this.core.playerMon;
    const exhausted = () => this.core.usableMoveSlots('player').length === 0;
    return new Panel({
      kind: 'moves',
      title: '招式',
      columns: 2,
      rows: (): ListRow[] => {
        if (exhausted()) {
          return [{ label: STRUGGLE.name, right: '—', sub: '無屬性・招式用盡時使用', tone: 'warn' }];
        }
        return mon.moves.map((slot) => {
          const move = getMove(slot.id);
          return {
            label: move.name,
            right: `${slot.pp}/${move.pp}`,
            sub: `${move.type ? ELEMENT_NAME[move.type] : '無'}・${move.power > 0 ? `威力 ${move.power}` : '變化'}`,
            disabled: slot.pp <= 0,
            tone: slot.pp <= 0 ? 'muted' : undefined,
          };
        });
      },
      detail: (i) => {
        if (exhausted()) return { title: STRUGGLE.name, lines: [STRUGGLE.desc] };
        const slot = mon.moves[i];
        if (!slot) return undefined;
        const move = getMove(slot.id);
        const acc = move.accuracy === null ? '必中' : `命中 ${move.accuracy}`;
        return { title: move.name, lines: [move.desc, `${acc}・優先度 ${move.priority >= 0 ? '+' : ''}${move.priority}`] };
      },
      hint: () => (exhausted() ? '所有招式的使用次數都用完了，只能使出「拚命」。' : ''),
      onConfirm: (i) => {
        if (exhausted()) this.act({ kind: 'struggle' });
        else this.act({ kind: 'move', slot: i });
      },
      onCancel: () => this.closePanel(),
    });
  }

  private bagItems(): string[] {
    return ITEM_LIST.map((i) => i.id).filter((id) => (this.core.bag[id] ?? 0) > 0);
  }

  private bagPanel(): Panel {
    return new Panel({
      kind: 'bag',
      title: '背包',
      rows: () => {
        const ids = this.bagItems();
        if (ids.length === 0) return [{ label: '背包是空的', disabled: true, tone: 'muted' }];
        return ids.map((id) => {
          const item = getItem(id);
          const blocked = item.kind === 'capture' && this.core.kind !== 'wild';
          return { label: item.name, right: `×${this.core.bag[id]}`, icon: item.sprite, disabled: blocked, tone: blocked ? 'muted' : undefined };
        });
      },
      detail: (i) => {
        const id = this.bagItems()[i];
        if (!id) return undefined;
        const item = getItem(id);
        const lines = [item.desc];
        if (item.kind === 'capture') {
          if (this.core.kind !== 'wild') lines.push('訓練家的怪獸不能捕捉。');
          else lines.push(`目前成功率約 ${Math.round(this.app.captureHint(this.core.enemyMon, item.value) * 100)}%`);
        }
        return { title: item.name, sprite: item.sprite, lines };
      },
      onConfirm: (i) => {
        const id = this.bagItems()[i];
        if (!id) return;
        const item = getItem(id);
        if (item.kind === 'capture') {
          this.act({ kind: 'item', item: id });
          return;
        }
        this.openPanel(this.targetPanel(id));
      },
      onCancel: () => this.closePanel(),
    });
  }

  private monRow(mon: MonsterInstance, index: number): ListRow {
    const active = index === this.core.pActive;
    const status = mon.status === 'burn' ? '灼傷' : mon.status === 'poison' ? '中毒' : mon.status === 'sleep' ? '睡眠' : '';
    return {
      label: displayName(mon),
      right: `Lv.${mon.level}`,
      sub: [active ? '出戰中' : '', isFainted(mon) ? '倒下' : status].filter(Boolean).join('・'),
      icon: getSpecies(mon.species).sprite.icon,
      hp: [mon.hp, maxHp(mon)],
      tone: isFainted(mon) ? 'muted' : active ? 'accent' : undefined,
    };
  }

  private targetPanel(itemId: string): Panel {
    const item = getItem(itemId);
    return new Panel({
      kind: 'target',
      title: `對誰使用${item.name}？`,
      rows: () => this.core.player.map((m, i) => this.monRow(m, i)),
      onConfirm: (i) => this.act({ kind: 'item', item: itemId, target: i }),
      onCancel: () => this.closePanel(),
    });
  }

  private partyPanel(forced: boolean): Panel {
    return new Panel({
      kind: 'party',
      title: forced ? '換上哪一隻夥伴？' : '隊伍',
      rows: () => this.core.player.map((m, i) => this.monRow(m, i)),
      cursor: forced ? Math.max(0, this.core.player.findIndex((m) => !isFainted(m))) : this.core.pActive,
      hint: forced ? '出戰的夥伴倒下了，必須換上另一隻。' : '選擇要換上場的夥伴（會消耗這一回合）。',
      onConfirm: (i) => {
        if (forced) {
          const target = this.core.player[i];
          if (!target || isFainted(target)) {
            this.app.sfx('error');
            return;
          }
          this.show(this.core.forceSwitch(i));
          return;
        }
        this.act({ kind: 'switch', to: i });
      },
      onCancel: forced ? undefined : () => this.closePanel(),
    });
  }

  // ---------- 結算 ----------

  private beginResult(): void {
    this.phase = 'result';
    this.growth = this.resultFlow();
    this.stepGrowth(undefined);
  }

  private *resultFlow(): Generator<GrowthStep, void, number | undefined> {
    const core = this.core;
    const money = this.app.p.money;
    if (core.outcome === 'win') {
      if (core.kind === 'wild') {
        const prize = wildPrize(core.enemy[0]);
        this.moneyDelta = Math.min(prize, MONEY_MAX - money);
        yield { kind: 'msg', text: `撿到了 ${prize} 銅貝。` };
      } else if (this.setup.trainerId && !this.app.p.defeated.includes(this.setup.trainerId)) {
        const trainer = getTrainer(this.setup.trainerId);
        this.moneyDelta = Math.min(trainer.reward, MONEY_MAX - money);
        yield { kind: 'msg', text: `從${trainer.name}那裡得到了 ${trainer.reward} 銅貝作為獎金！` };
      }
      yield* growthFlow(core.player, core.expLedger);
    } else if (core.outcome === 'caught' && core.caught) {
      const name = displayName(core.caught);
      if (!this.app.p.dex.caught.includes(core.caught.species)) {
        yield { kind: 'msg', text: `${name}的資料登錄到圖鑑了！` };
      }
      if (core.player.length >= 6) yield { kind: 'msg', text: `隊伍已經滿了，${name}被送到收納石的收納箱。` };
      else yield { kind: 'msg', text: `${name}加入了隊伍！` };
    } else if (core.outcome === 'lose') {
      const lost = Math.floor(money * WHITEOUT_MONEY_RATIO);
      this.moneyDelta = -lost;
      yield { kind: 'msg', text: lost > 0 ? `你慌忙中掉了 ${lost} 銅貝……眼前一片漆黑。` : '眼前一片漆黑……' };
    }
  }

  private stepGrowth(input: number | undefined): void {
    const g = this.growth!;
    const next = g.next(input);
    this.resultPanel = null;
    if (next.done) {
      this.growthStep = null;
      this.finish();
      return;
    }
    this.growthStep = next.value;
    this.growthSerial = ++serial;
    const step = next.value;
    if (step.kind === 'msg' && step.cue) {
      if (step.cue.a === 'levelup' || step.cue.a === 'learn') this.app.sfx('levelup');
      if (step.cue.a === 'evolved') this.app.sfx('evolve');
    }
    if (step.kind === 'learn') {
      const mon = this.core.player.find((m) => m.uid === step.uid)!;
      const learning = getMove(step.move);
      this.resultPanel = new Panel({
        kind: 'learn',
        title: `要忘記哪個招式來學習${learning.name}？`,
        rows: () => [
          ...mon.moves.map((slot) => {
            const move = getMove(slot.id);
            return { label: move.name, right: `${slot.pp}/${move.pp}`, sub: move.type ? ELEMENT_NAME[move.type] : '' };
          }),
          { label: `放棄學習${learning.name}`, tone: 'warn' as const },
        ],
        detail: (i) => {
          const slot = mon.moves[i];
          const move = slot ? getMove(slot.id) : learning;
          return { title: move.name, lines: [move.desc] };
        },
        onConfirm: (i) => this.stepGrowth(i < mon.moves.length ? i : -1),
        onCancel: () => this.stepGrowth(-1),
      });
    }
  }

  private pressResult(button: Button): void {
    if (!this.growthStep) return;
    if (this.resultPanel) {
      const r = this.resultPanel.press(button);
      if (r === 'cursor') this.app.sfx('cursor');
      return;
    }
    if (button === 'confirm' || button === 'cancel') {
      this.app.sfx('confirm');
      this.stepGrowth(undefined);
    }
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    const core = this.core;
    this.app.commitBattle({
      kind: core.kind,
      outcome: core.outcome!,
      trainerId: this.setup.trainerId,
      party: core.player,
      bag: core.bag,
      seen: [...core.seen],
      caught: core.caught,
      moneyDelta: this.moneyDelta,
      onWin: this.setup.onWin,
      onLose: this.setup.onLose,
    });
  }

  // ---------- 畫面 ----------

  vm(): BattleVM {
    const cur = this.current;
    const top = this.panels[this.panels.length - 1];
    const snap = cur?.snap ?? this.core.snapshot();
    let text = cur?.text ?? '';
    if (this.phase === 'command') text = `${displayName(this.core.playerMon)}要做什麼？`;
    if (this.phase === 'panel' && top) text = top.vm().hint || top.vm().title;
    return {
      kind: this.core.kind,
      bg: this.setup.bg,
      trainerName: this.core.trainerName,
      snap,
      text,
      serial: cur?.serial ?? (this.phase === 'command' ? -1 : -2),
      cues: cur?.cues ?? [],
      phase: this.phase === 'panel' ? 'panel' : this.phase === 'command' ? 'command' : 'events',
      commands: this.phase === 'command' ? { labels: [...COMMANDS], cursor: this.commandCursor } : undefined,
      panel: this.phase === 'panel' && top ? top.vm() : undefined,
      turn: this.core.turn,
    };
  }

  resultVM(): ResultVM {
    const step = this.growthStep;
    const cue = step?.kind === 'msg' ? step.cue : undefined;
    let focus: ResultVM['focus'];
    if (cue && 'uid' in cue) {
      const mon = this.core.player.find((m) => m.uid === cue.uid);
      if (mon) focus = { uid: mon.uid, species: cue.a === 'evolveStart' ? cue.from : mon.species };
    }
    return {
      text: step?.text ?? '',
      serial: this.growthSerial,
      cue,
      bg: this.setup.bg,
      panel: this.resultPanel?.vm(),
      focus,
    };
  }
}
