// 遊戲流程的狀態機。任何時刻只有一個模式接收輸入；
// 畫面層只負責把按鍵轉成 Button、播放 Effect，並在轉場動畫結束時呼叫 endTransition()。

import { captureChance } from '../core/capture';
import { addItem, addMoney } from '../core/inventory';
import { cloneMonster, createMonster, fullHeal, isFainted } from '../core/monster';
import { storeNewMonster } from '../core/party';
import { currentObjective, type Objective } from '../core/progress';
import { createRng, type Rng } from '../core/rng';
import { DEFAULT_SETTINGS, SaveSlot, type KeyValueStorage, type LoadResult } from '../core/save';
import type { Dir, MonsterInstance, Progress, Settings } from '../core/types';
import {
  interactTarget,
  placedEntities,
  resolveMove,
  type PlacedEntity,
} from '../core/world';
import { getMap, START_POS, WHITEOUT_POS } from '../data/maps';
import { SPECIES_LIST } from '../data/species';
import { getTrainer } from '../data/trainers';
import { BattleSession, type BattleSummary, type BattleSetup } from './battleSession';
import { Dialog, type DialogChoice, type DialogLine } from './dialog';
import { buildMainMenu, buildSettingsPanel } from './menus';
import { Panel } from './panel';
import { runScript } from './scripts';
import { buildTitlePanel } from './title';
import { SETTINGS_KEY, START_MONEY, STEP_GUARD } from './constants';
import type { Button, ClearedVM, Effect, Mode, Sfx, TransitionKind } from './types';

export interface AppOptions {
  storage: KeyValueStorage | null;
  /** 固定種子讓整場遊戲可重現；省略時用目前時間。 */
  seed?: number;
  now?: () => number;
  /** 測試用：遭遇率改寫（0–1）。 */
  encounterRateOverride?: number;
}

interface TransitionState {
  kind: TransitionKind;
  run: () => void;
}

export function newProgress(settings: Settings): Progress {
  return {
    player: { ...START_POS },
    party: [],
    box: [],
    bag: {},
    money: START_MONEY,
    dex: { seen: [], caught: [] },
    flags: {},
    defeated: [],
    settings: { ...settings },
    nextUid: 1,
    playTimeMs: 0,
  };
}

export class GameApp {
  progress: Progress | null = null;
  readonly rng: Rng;
  readonly slot: SaveSlot;
  readonly now: () => number;
  dialog: Dialog | null = null;
  panels: Panel[] = [];
  battle: BattleSession | null = null;
  transition: TransitionState | null = null;
  clearedScreen = false;
  stepGuard = 0;
  /** 和玩家說話時 NPC 會轉身；只存在於記憶體。 */
  readonly npcFacing = new Map<string, Dir>();
  titleLoad: LoadResult;
  private titleSettings: Settings;
  private readonly storage: KeyValueStorage | null;
  private readonly listeners = new Set<(e: Effect) => void>();
  readonly encounterRateOverride?: number;
  /** 最後一次自動／手動存檔的結果訊息。 */
  lastSaveError: string | null = null;

  constructor(opts: AppOptions) {
    this.storage = opts.storage;
    this.slot = new SaveSlot(opts.storage);
    this.now = opts.now ?? (() => Date.now());
    this.rng = createRng(opts.seed ?? (this.now() & 0xffffffff));
    this.encounterRateOverride = opts.encounterRateOverride;
    this.titleSettings = this.readSettingsMirror();
    this.titleLoad = this.slot.load();
    if (this.titleLoad.status === 'ok') this.titleSettings = { ...this.titleLoad.progress.settings };
    this.panels = [buildTitlePanel(this)];
  }

  // ---------- 基本狀態 ----------

  get mode(): Mode {
    if (this.transition) return 'transition';
    if (this.dialog) return 'dialog';
    if (!this.progress) return 'title';
    if (this.battle) return this.battle.phase === 'result' ? 'result' : 'battle';
    if (this.panels.length > 0) return 'menu';
    if (this.clearedScreen) return 'cleared';
    return 'explore';
  }

  get p(): Progress {
    if (!this.progress) throw new Error('遊戲尚未開始');
    return this.progress;
  }

  get settings(): Settings {
    return this.progress?.settings ?? this.titleSettings;
  }

  updateSettings(patch: Partial<Settings>): void {
    const next = { ...this.settings, ...patch };
    if (this.progress) this.progress.settings = next;
    else this.titleSettings = next;
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // 設定寫不進去時只在本次遊玩生效。
    }
  }

  private readSettingsMirror(): Settings {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const s = JSON.parse(raw) as Partial<Settings>;
      return {
        sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
        reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
        instantText: typeof s.instantText === 'boolean' ? s.instantText : DEFAULT_SETTINGS.instantText,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  onEffect(fn: (e: Effect) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e: Effect): void {
    for (const fn of this.listeners) fn(e);
  }

  sfx(id: Sfx): void {
    this.emit({ kind: 'sfx', id });
  }

  tick(ms: number): void {
    if (this.progress && ms > 0 && ms < 60_000) this.progress.playTimeMs += Math.floor(ms);
  }

  objective(): Objective | null {
    if (!this.progress) return null;
    return currentObjective(this.p.flags, this.p.dex.caught.length, SPECIES_LIST.length);
  }

  // ---------- 對話與面板 ----------

  say(lines: (DialogLine | string)[], onClose?: () => void): void {
    const norm = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
    this.dialog = new Dialog(norm, undefined, onClose);
    this.sfx('talk');
  }

  ask(lines: (DialogLine | string)[], choice: DialogChoice): void {
    const norm = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
    this.dialog = new Dialog(norm, choice);
    this.sfx('talk');
  }

  openPanel(panel: Panel): void {
    this.panels.push(panel);
  }

  closePanel(panel?: Panel): void {
    if (!panel) this.panels.pop();
    else this.panels = this.panels.filter((p) => p !== panel);
  }

  closeAllPanels(): void {
    this.panels = [];
  }

  get topPanel(): Panel | null {
    return this.panels[this.panels.length - 1] ?? null;
  }

  // ---------- 輸入 ----------

  press(button: Button): void {
    switch (this.mode) {
      case 'transition':
        return;
      case 'dialog': {
        const d = this.dialog!;
        const r = d.press(button, () => {
          if (this.dialog === d) this.dialog = null;
        });
        if (r === 'cursor') this.sfx('cursor');
        else if (r === 'advance' || r === 'close' || r === 'pick') this.sfx('confirm');
        return;
      }
      case 'title':
      case 'menu':
        this.pressPanel(button);
        return;
      case 'battle':
      case 'result':
        this.battle!.press(button);
        return;
      case 'cleared':
        if (button === 'confirm' || button === 'cancel') this.finishCleared();
        return;
      case 'explore':
        this.pressExplore(button);
        return;
    }
  }

  /** 指標（滑鼠、觸控）直接點選清單中的第 index 列。 */
  select(index: number): void {
    const mode = this.mode;
    if (mode === 'dialog') {
      const d = this.dialog!;
      if (d.pick(index, () => {
        if (this.dialog === d) this.dialog = null;
      })) this.sfx('confirm');
      return;
    }
    if (mode === 'title' || mode === 'menu') {
      const panel = this.topPanel;
      if (!panel) return;
      panel.cursor = index;
      this.pressPanel('confirm');
      return;
    }
    if (mode === 'battle' || mode === 'result') this.battle!.select(index);
  }

  private pressPanel(button: Button): void {
    const panel = this.topPanel;
    if (!panel) return;
    const r = panel.press(button);
    if (r === 'cursor' || r === 'side') this.sfx('cursor');
    else if (r === 'cancel') this.sfx('cancel');
  }

  private pressExplore(button: Button): void {
    switch (button) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        this.walk(button);
        return;
      case 'confirm':
        this.interact();
        return;
      case 'cancel':
      case 'menu':
        this.sfx('confirm');
        this.openPanel(buildMainMenu(this));
        return;
    }
  }

  // ---------- 探索 ----------

  walk(dir: Dir): void {
    const p = this.p.player;
    const map = getMap(p.map);
    if (p.facing !== dir) {
      p.facing = dir;
      this.emit({ kind: 'turn', dir });
    }
    const result = resolveMove(map, this.p.flags, p.x, p.y, dir);
    if (result.kind === 'blocked') {
      this.emit({ kind: 'bump', dir });
      return;
    }
    if (result.kind === 'gate') {
      this.emit({ kind: 'bump', dir });
      this.say([{ speaker: result.rule.speaker, text: result.rule.text }]);
      return;
    }
    const from = { x: p.x, y: p.y };
    p.x = result.x;
    p.y = result.y;
    this.emit({ kind: 'step', from, to: { x: p.x, y: p.y }, dir });
    if (result.warp) {
      const warp = result.warp;
      this.startTransition('warp', () => {
        p.map = warp.to;
        p.x = warp.dest.x;
        p.y = warp.dest.y;
        p.facing = warp.facing;
        this.npcFacing.clear();
        this.emit({ kind: 'mapChanged', map: warp.to });
      });
      return;
    }
    if (this.stepGuard > 0) {
      this.stepGuard--;
      return;
    }
    if (result.grass && map.encounter && this.p.party.some((m) => !isFainted(m))) {
      const rate = this.encounterRateOverride ?? map.encounter.rate;
      if (this.rng.chance(rate)) this.startWildBattle();
    }
  }

  entityFacing(e: PlacedEntity): Dir {
    return this.npcFacing.get(`${this.p.player.map}:${e.def.id}`) ?? e.facing;
  }

  visibleEntities(): PlacedEntity[] {
    if (!this.progress) return [];
    return placedEntities(getMap(this.p.player.map), this.p.flags);
  }

  interact(): void {
    const p = this.p.player;
    const map = getMap(p.map);
    const target = interactTarget(map, this.p.flags, p.x, p.y, p.facing);
    if (!target) return;
    if (target.def.kind === 'npc') {
      const opposite: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      this.npcFacing.set(`${p.map}:${target.def.id}`, opposite[p.facing]);
    }
    runScript(this, target);
  }

  startTransition(kind: TransitionKind, run: () => void): void {
    if (this.transition) throw new Error('轉場進行中');
    this.transition = { kind, run };
  }

  /** 轉場動畫播完後由畫面層呼叫；重複呼叫無作用。 */
  endTransition(): void {
    const t = this.transition;
    if (!t) return;
    this.transition = null;
    t.run();
  }

  // ---------- 遊戲開始 ----------

  startNewGame(): void {
    if (this.titleLoad.status === 'corrupt') this.slot.backupCorrupt();
    this.progress = newProgress(this.titleSettings);
    this.closeAllPanels();
    this.startTransition('enterWorld', () => {
      this.emit({ kind: 'mapChanged', map: this.p.player.map });
      this.say([
        { speaker: '旅行筆記', text: '歡迎來到芽口村！這裡的人和野生怪獸「野靈」一起生活。' },
        { speaker: '旅行筆記', text: '用方向鍵或 WASD 一格一格移動；手機請用畫面下方的十字鍵。' },
        { speaker: '旅行筆記', text: '面向別人按 Enter 或 Z（手機按 A）說話、調查；Esc 或 X（手機按 B）取消，也能打開選單。' },
        { speaker: '旅行筆記', text: '畫面下方的旅行手帳會一直寫著目前的目標。先和正前方的禾老師說話吧！' },
      ]);
    });
  }

  continueGame(): void {
    if (this.titleLoad.status !== 'ok') return;
    this.progress = this.titleLoad.progress;
    this.closeAllPanels();
    this.startTransition('enterWorld', () => {
      this.emit({ kind: 'mapChanged', map: this.p.player.map });
    });
  }

  openSettings(): void {
    this.openPanel(buildSettingsPanel(this));
  }

  // ---------- 存檔 ----------

  /** 只在安全的探索狀態存檔；回傳 null 代表成功。 */
  save(): string | null {
    if (!this.progress) return '遊戲尚未開始';
    if (this.battle || this.transition) return '戰鬥或轉場中不能存檔';
    const error = this.slot.write(this.progress, this.now());
    this.lastSaveError = error;
    this.emit({ kind: 'saved', ok: error === null });
    if (error === null) this.titleLoad = { status: 'ok', progress: structuredClone(this.progress), savedAt: this.now() };
    return error;
  }

  autosave(): void {
    this.save();
  }

  // ---------- 怪獸與道具 ----------

  newUid(): string {
    return `m${this.p.nextUid++}`;
  }

  markSeen(species: string): void {
    if (!this.p.dex.seen.includes(species)) this.p.dex.seen.push(species);
  }

  markCaught(species: string): void {
    this.markSeen(species);
    if (!this.p.dex.caught.includes(species)) this.p.dex.caught.push(species);
  }

  giveMonster(speciesId: string, level: number): { mon: MonsterInstance; where: 'party' | 'box' | null } {
    const mon = createMonster(speciesId, level, this.newUid());
    const where = storeNewMonster(this.p, mon);
    if (where) this.markCaught(speciesId);
    return { mon, where };
  }

  giveItem(id: string, count: number): number {
    return addItem(this.p.bag, id, count);
  }

  healParty(): void {
    for (const mon of this.p.party) fullHeal(mon);
    this.emit({ kind: 'healParty' });
    this.sfx('heal');
  }

  // ---------- 戰鬥 ----------

  private startWildBattle(): void {
    const map = getMap(this.p.player.map);
    const table = map.encounter!.table;
    const entry = this.rng.weighted(table, (e) => e.weight);
    const level = this.rng.int(entry.min, entry.max);
    const enemy = createMonster(entry.species, level, 'wild');
    this.beginBattle({ kind: 'wild', enemyParty: [enemy], bg: map.battleBg });
  }

  startTrainerBattle(trainerId: string, hooks: { onWin?: () => void; onLose?: () => void } = {}): void {
    const trainer = getTrainer(trainerId);
    const enemyParty = trainer.party.map((m, i) => createMonster(m.species, m.level, `t${i}`));
    this.beginBattle({
      kind: 'trainer',
      trainerId,
      trainerName: trainer.name,
      enemyParty,
      bg: getMap(this.p.player.map).battleBg,
      onWin: hooks.onWin,
      onLose: hooks.onLose,
    });
  }

  private beginBattle(setup: Omit<BattleSetup, 'party' | 'bag' | 'rng' | 'partyRoom'>): void {
    // 戰前快照：戰鬥途中重新整理會回到這一刻。
    this.autosave();
    this.sfx('encounter');
    const party = this.p.party.map(cloneMonster);
    const bag = { ...this.p.bag };
    const partyRoom = this.p.party.length < 6 || this.p.box.length < 60;
    this.startTransition('battleIn', () => {
      this.battle = new BattleSession(this, { ...setup, party, bag, rng: this.rng, partyRoom });
      this.battle.start();
    });
  }

  /** 捕捉機率（給介面提示用，不影響結果）。 */
  captureHint(target: MonsterInstance, itemMultiplier: number): number {
    return captureChance(target, itemMultiplier);
  }

  /** 戰鬥與戰後結算都完成後，一次把結果寫回世界狀態。 */
  commitBattle(summary: BattleSummary): void {
    const p = this.p;
    p.party = summary.party;
    p.bag = summary.bag;
    for (const s of summary.seen) this.markSeen(s);
    if (summary.kind === 'wild') p.flags.firstWildBattle = true;
    if (summary.outcome === 'caught' && summary.caught) {
      const mon = cloneMonster(summary.caught);
      mon.uid = this.newUid();
      mon.status = mon.status === 'sleep' ? 'none' : mon.status;
      mon.sleepTurns = 0;
      const where = storeNewMonster(p, mon);
      if (where) {
        this.markCaught(mon.species);
        p.flags.firstCatch = true;
      }
    }
    if (summary.moneyDelta !== 0) addMoney(p, summary.moneyDelta);
    if (summary.outcome === 'win' && summary.trainerId && !p.defeated.includes(summary.trainerId)) {
      p.defeated.push(summary.trainerId);
      for (const f of getTrainer(summary.trainerId).winFlags) p.flags[f] = true;
    }
    const lost = summary.outcome === 'lose';
    if (lost) {
      for (const mon of p.party) fullHeal(mon);
      p.player = { ...WHITEOUT_POS };
    } else {
      // 戰鬥中的睡眠不帶出戰場。
      for (const mon of p.party) {
        if (mon.status === 'sleep') mon.status = 'none';
        mon.sleepTurns = 0;
      }
    }
    this.stepGuard = STEP_GUARD;
    this.startTransition(lost ? 'whiteout' : 'battleOut', () => {
      this.battle = null;
      if (lost) {
        this.npcFacing.clear();
        this.emit({ kind: 'mapChanged', map: p.player.map });
      }
      this.autosave();
      if (lost) {
        this.say(
          [
            '你帶著倒下的夥伴，急忙跑回了芽口村……',
            { speaker: '蘇護士', text: '夥伴們都已經恢復精神了。別灰心，整理好隊伍再出發吧！' },
          ],
          summary.onLose,
        );
      } else if (summary.outcome === 'win') {
        summary.onWin?.();
      }
    });
  }

  // ---------- 通關 ----------

  showCleared(): void {
    this.clearedScreen = true;
    this.sfx('clear');
  }

  clearedVM(): ClearedVM {
    const p = this.p;
    const totalSec = Math.floor(p.playTimeMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return {
      playTime: h > 0 ? `${h} 小時 ${m} 分` : `${m} 分 ${totalSec % 60} 秒`,
      caught: p.dex.caught.length,
      seen: p.dex.seen.length,
      total: SPECIES_LIST.length,
      party: p.party.map((mon) => ({ name: mon.nickname, species: mon.species, level: mon.level })),
    };
  }

  private finishCleared(): void {
    this.clearedScreen = false;
    this.p.flags.clearedShown = true;
    this.autosave();
    this.say([
      { speaker: '旅行筆記', text: '石冠挑戰通過了！之後可以自由探索，繼續收集還沒遇見的野靈。' },
      { speaker: '旅行筆記', text: '場主嵐和守林人朔隨時歡迎你回來聊聊。存檔後重新整理，也會從這裡繼續。' },
    ]);
  }
}
