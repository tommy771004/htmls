import { typeMultiplier } from '../data/elements';
import { getItem } from '../data/items';
import { getMove, STRUGGLE } from '../data/moves';
import { getSpecies } from '../data/species';
import { captureChance, captureShakes } from './capture';
import { displayName, expForLevel, isFainted, maxHp, statsOf } from './monster';
import type { Rng } from './rng';
import type { Bag, ElementType, MonsterInstance, MoveDef, StatKey, Status } from './types';

export type Side = 'player' | 'enemy';
export type BattleKind = 'wild' | 'trainer';
export type BattleOutcome = 'win' | 'lose' | 'caught' | 'ran';

export type PlayerAction =
  | { kind: 'move'; slot: number }
  | { kind: 'struggle' }
  | { kind: 'item'; item: string; target?: number }
  | { kind: 'switch'; to: number }
  | { kind: 'run' };

export type EnemyAction = { kind: 'move'; slot: number } | { kind: 'struggle' };

export type AnimCue =
  | { a: 'attack'; side: Side; type: ElementType | null; physical: boolean }
  | { a: 'hit'; side: Side; effectiveness: number }
  | { a: 'miss'; side: Side }
  | { a: 'heal'; side: Side }
  | { a: 'status'; side: Side; status: Status }
  | { a: 'stage'; side: Side; up: boolean }
  | { a: 'faint'; side: Side }
  | { a: 'switchOut'; side: Side }
  | { a: 'switchIn'; side: Side }
  | { a: 'throw'; item: string }
  | { a: 'shake' }
  | { a: 'caught' }
  | { a: 'breakout' }
  | { a: 'flee' }
  | { a: 'item'; side: Side };

export interface SideView {
  uid: string;
  species: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  status: Status;
  visible: boolean;
  /** 0–1，目前等級的經驗進度（只給玩家方顯示）。 */
  expPct: number;
  /** 隊伍概況：ok / fainted / status。 */
  roster: ('ok' | 'fainted' | 'status')[];
}

export interface Snapshot {
  player: SideView;
  enemy: SideView;
}

export interface BattleEvent {
  /** 空字串代表純動畫事件，畫面播完就自動前進。 */
  text: string;
  cues: AnimCue[];
  snap: Snapshot;
}

export const STAGE_LIMIT = 4;
/** 各行動的優先度：逃跑 > 交換 > 道具 > 招式（招式本身優先度 -1～+1）。 */
export const ACTION_PRIORITY = { run: 8, switch: 7, item: 6 } as const;
/** 狀態免疫：與狀態同屬性的怪獸不會陷入該狀態。 */
const STATUS_IMMUNITY: Partial<Record<Status, ElementType>> = { burn: 'flame', poison: 'moss' };
const STATUS_NAME: Record<Status, string> = { none: '', burn: '灼傷', poison: '中毒', sleep: '睡眠' };
const STAT_NAME: Record<StatKey, string> = { atk: '攻擊', def: '防禦', spd: '速度' };

export function stageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

export function expReward(enemy: MonsterInstance, kind: BattleKind): number {
  const base = Math.floor((getSpecies(enemy.species).expYield * enemy.level) / 4);
  return kind === 'trainer' ? Math.floor(base * 1.5) : base;
}

export interface BattleInit {
  kind: BattleKind;
  /** 訓練家名稱（野生戰為空）。 */
  trainerName?: string;
  playerParty: MonsterInstance[];
  enemyParty: MonsterInstance[];
  bag: Bag;
  rng: Rng;
  ai: 'wild' | 'smart';
  /** 捕捉後是否還有地方放（隊伍或收納箱）。 */
  canStoreCatch: boolean;
}

type Stages = Record<StatKey, number>;
const freshStages = (): Stages => ({ atk: 0, def: 0, spd: 0 });

/**
 * 單對單回合制戰鬥。擁有傳進來的隊伍與背包（呼叫端應傳入複本），
 * 戰鬥結束後由呼叫端一次提交回世界狀態。
 */
export class Battle {
  readonly kind: BattleKind;
  readonly trainerName: string;
  readonly player: MonsterInstance[];
  readonly enemy: MonsterInstance[];
  readonly bag: Bag;
  private readonly rng: Rng;
  readonly ai: 'wild' | 'smart';
  private readonly canStoreCatch: boolean;

  pActive: number;
  eActive = 0;
  pStages: Stages = freshStages();
  eStages: Stages = freshStages();
  runAttempts = 0;
  turn = 0;
  outcome: BattleOutcome | null = null;
  needsPlayerSwitch = false;
  caught: MonsterInstance | null = null;
  /** 每隻敵方怪獸的參戰者 uid。 */
  readonly participants: Set<string>[];
  /** 擊倒敵人累積的經驗值：uid → 數量，勝利結算時發放。 */
  readonly expLedger = new Map<string, number>();
  readonly seen = new Set<string>();

  constructor(init: BattleInit) {
    this.kind = init.kind;
    this.trainerName = init.trainerName ?? '';
    this.player = init.playerParty;
    this.enemy = init.enemyParty;
    this.bag = init.bag;
    this.rng = init.rng;
    this.ai = init.ai;
    this.canStoreCatch = init.canStoreCatch;
    const first = this.player.findIndex((m) => !isFainted(m));
    if (first < 0) throw new Error('玩家沒有可以出戰的怪獸');
    if (this.enemy.length === 0) throw new Error('敵方沒有怪獸');
    this.pActive = first;
    this.participants = this.enemy.map(() => new Set<string>());
    this.participants[0].add(this.player[first].uid);
    this.seen.add(this.enemy[0].species);
  }

  get playerMon(): MonsterInstance {
    return this.player[this.pActive];
  }

  get enemyMon(): MonsterInstance {
    return this.enemy[this.eActive];
  }

  // ---------- 顯示用 ----------

  private sideView(side: Side, visible: boolean): SideView {
    const party = side === 'player' ? this.player : this.enemy;
    const mon = side === 'player' ? this.playerMon : this.enemyMon;
    const next = expForLevel(mon.level + 1);
    const cur = expForLevel(mon.level);
    return {
      uid: mon.uid,
      species: mon.species,
      name: displayName(mon),
      level: mon.level,
      hp: mon.hp,
      maxHp: maxHp(mon),
      status: mon.status,
      visible,
      expPct: next > cur ? Math.max(0, Math.min(1, (mon.exp - cur) / (next - cur))) : 1,
      roster: party.map((m) => (isFainted(m) ? 'fainted' : m.status !== 'none' ? 'status' : 'ok')),
    };
  }

  private visiblePlayer = true;
  private visibleEnemy = true;

  snapshot(): Snapshot {
    return { player: this.sideView('player', this.visiblePlayer), enemy: this.sideView('enemy', this.visibleEnemy) };
  }

  private push(events: BattleEvent[], text: string, ...cues: AnimCue[]): void {
    events.push({ text, cues, snap: this.snapshot() });
  }

  label(side: Side, mon?: MonsterInstance): string {
    const m = mon ?? (side === 'player' ? this.playerMon : this.enemyMon);
    if (side === 'player') return displayName(m);
    return this.kind === 'wild' ? `野生的${displayName(m)}` : `對方的${displayName(m)}`;
  }

  /** 開場訊息。 */
  start(): BattleEvent[] {
    const events: BattleEvent[] = [];
    this.visiblePlayer = false;
    if (this.kind === 'wild') {
      this.push(events, `野生的${displayName(this.enemyMon)}跳出來了！`, { a: 'switchIn', side: 'enemy' });
    } else {
      this.push(events, `${this.trainerName}向你發起對戰！`);
      this.push(events, `${this.trainerName}派出了${displayName(this.enemyMon)}！`, { a: 'switchIn', side: 'enemy' });
    }
    this.visiblePlayer = true;
    this.push(events, `去吧，${displayName(this.playerMon)}！`, { a: 'switchIn', side: 'player' });
    return events;
  }

  // ---------- 合法性 ----------

  usableMoveSlots(side: Side): number[] {
    const mon = side === 'player' ? this.playerMon : this.enemyMon;
    return mon.moves.map((m, i) => (m.pp > 0 ? i : -1)).filter((i) => i >= 0);
  }

  /** 回傳 null 代表合法，否則是拒絕原因。 */
  validate(action: PlayerAction): string | null {
    if (this.outcome) return '戰鬥已經結束';
    if (this.needsPlayerSwitch) return '必須先換上新的怪獸';
    const mon = this.playerMon;
    switch (action.kind) {
      case 'move': {
        const slot = mon.moves[action.slot];
        if (!slot) return '沒有這個招式';
        if (slot.pp <= 0) return '這個招式的使用次數已經用完了';
        return null;
      }
      case 'struggle':
        return this.usableMoveSlots('player').length === 0 ? null : '還有可以使用的招式';
      case 'switch': {
        const target = this.player[action.to];
        if (!target) return '沒有這隻怪獸';
        if (action.to === this.pActive) return `${displayName(target)}已經在場上了`;
        if (isFainted(target)) return `${displayName(target)}已經沒有力氣戰鬥了`;
        return null;
      }
      case 'run':
        return this.kind === 'wild' ? null : '不能從訓練家的對戰中逃跑！';
      case 'item': {
        const count = this.bag[action.item] ?? 0;
        if (count <= 0) return '沒有這個道具';
        const item = getItem(action.item);
        if (item.kind === 'capture') {
          if (this.kind !== 'wild') return '不能捕捉別人的怪獸！';
          if (!this.canStoreCatch) return '隊伍和收納箱都滿了，無法再捕捉';
          return null;
        }
        const target = action.target === undefined ? undefined : this.player[action.target];
        if (!target) return '請選擇要使用的對象';
        if (isFainted(target)) return `${displayName(target)}已經倒下，無法使用`;
        if (item.kind === 'heal' && target.hp >= maxHp(target)) return 'HP 已經是滿的，沒有效果';
        if (item.kind === 'cure' && target.status === 'none') return '沒有需要治療的狀態';
        return null;
      }
    }
  }

  // ---------- 回合 ----------

  private effectiveSpeed(side: Side): number {
    const mon = side === 'player' ? this.playerMon : this.enemyMon;
    const stages = side === 'player' ? this.pStages : this.eStages;
    return statsOf(mon).spd * stageMultiplier(stages.spd);
  }

  private priorityOf(action: PlayerAction | EnemyAction, side: Side): number {
    if (action.kind === 'run') return ACTION_PRIORITY.run;
    if (action.kind === 'switch') return ACTION_PRIORITY.switch;
    if (action.kind === 'item') return ACTION_PRIORITY.item;
    if (action.kind === 'struggle') return STRUGGLE.priority;
    const mon = side === 'player' ? this.playerMon : this.enemyMon;
    return getMove(mon.moves[action.slot].id).priority;
  }

  /**
   * 解決一個回合：收集 → 驗證 → 排序 → 逐一執行（每次檢查倒下與結束）
   * → 回合末效果 → 強制換怪或進入下一回合。
   */
  resolveTurn(action: PlayerAction): BattleEvent[] {
    const error = this.validate(action);
    if (error) throw new Error(error);
    const enemyAction = chooseEnemyAction(this, this.rng);
    const events: BattleEvent[] = [];
    type Entry = { side: Side; action: PlayerAction | EnemyAction; priority: number; speed: number; mon: MonsterInstance };
    const entries: Entry[] = [
      { side: 'player', action, priority: this.priorityOf(action, 'player'), speed: this.effectiveSpeed('player'), mon: this.playerMon },
      { side: 'enemy', action: enemyAction, priority: this.priorityOf(enemyAction, 'enemy'), speed: this.effectiveSpeed('enemy'), mon: this.enemyMon },
    ];
    let order: Entry[];
    const [a, b] = entries;
    if (a.priority !== b.priority) order = a.priority > b.priority ? [a, b] : [b, a];
    else if (a.speed !== b.speed) order = a.speed > b.speed ? [a, b] : [b, a];
    else order = this.rng.chance(0.5) ? [a, b] : [b, a];

    for (const entry of order) {
      if (this.outcome) break;
      // 行動者在選擇後倒下或已經不在場上，就跳過它的行動。
      const current = entry.side === 'player' ? this.playerMon : this.enemyMon;
      if (current !== entry.mon || isFainted(current)) continue;
      this.execute(entry.side, entry.action, events);
      this.checkEnd(events);
    }

    if (!this.outcome) this.endOfTurn(events);
    if (!this.outcome) this.replaceFainted(events);
    this.turn++;
    return events;
  }

  private execute(side: Side, action: PlayerAction | EnemyAction, events: BattleEvent[]): void {
    switch (action.kind) {
      case 'move':
        this.useMove(side, action.slot, events);
        break;
      case 'struggle':
        this.useMove(side, -1, events);
        break;
      case 'switch':
        this.doSwitch(action.to, events);
        break;
      case 'item':
        this.useItem(action.item, action.target, events);
        break;
      case 'run':
        this.tryRun(events);
        break;
    }
  }

  private doSwitch(to: number, events: BattleEvent[]): void {
    this.push(events, `回來吧，${displayName(this.playerMon)}！`, { a: 'switchOut', side: 'player' });
    this.visiblePlayer = false;
    this.pStages = freshStages();
    this.pActive = to;
    this.participants[this.eActive].add(this.playerMon.uid);
    this.visiblePlayer = true;
    this.push(events, `去吧，${displayName(this.playerMon)}！`, { a: 'switchIn', side: 'player' });
  }

  private tryRun(events: BattleEvent[]): void {
    const chance = runChance(this.effectiveSpeed('player'), this.effectiveSpeed('enemy'), this.runAttempts);
    this.runAttempts++;
    if (this.rng.chance(chance)) {
      this.outcome = 'ran';
      this.visiblePlayer = false;
      this.push(events, '順利逃走了！', { a: 'flee' });
    } else {
      this.push(events, '逃不掉！');
    }
  }

  private useItem(itemId: string, target: number | undefined, events: BattleEvent[]): void {
    const item = getItem(itemId);
    this.bag[itemId] = Math.max(0, (this.bag[itemId] ?? 0) - 1);
    if (item.kind === 'capture') {
      const foe = this.enemyMon;
      const chance = captureChance(foe, item.value);
      const roll = this.rng.next();
      const success = roll < chance;
      const shakes = captureShakes(roll, chance, success);
      this.visibleEnemy = false;
      this.push(events, `你丟出了${item.name}！`, { a: 'throw', item: itemId });
      for (let i = 0; i < shakes; i++) this.push(events, '', { a: 'shake' });
      if (success) {
        this.outcome = 'caught';
        this.caught = foe;
        foe.sleepTurns = 0;
        if (foe.status === 'sleep') foe.status = 'none';
        this.push(events, `成功捕捉了${displayName(foe)}！`, { a: 'caught' });
      } else {
        this.visibleEnemy = true;
        this.push(events, `${displayName(foe)}從籠子裡掙脫了！`, { a: 'breakout' });
      }
      return;
    }
    const mon = this.player[target ?? this.pActive];
    const onField = mon === this.playerMon;
    if (item.kind === 'heal') {
      const before = mon.hp;
      mon.hp = Math.min(maxHp(mon), mon.hp + item.value);
      this.push(events, `對${displayName(mon)}使用了${item.name}，回復了 ${mon.hp - before} HP！`,
        ...(onField ? [{ a: 'heal', side: 'player' } as AnimCue] : []));
    } else {
      mon.status = 'none';
      mon.sleepTurns = 0;
      this.push(events, `對${displayName(mon)}使用了${item.name}，身體狀態恢復了！`,
        ...(onField ? [{ a: 'item', side: 'player' } as AnimCue] : []));
    }
  }

  /** slot = -1 代表替代招式「拚命」。 */
  private useMove(side: Side, slot: number, events: BattleEvent[]): void {
    const other: Side = side === 'player' ? 'enemy' : 'player';
    const user = side === 'player' ? this.playerMon : this.enemyMon;
    const target = other === 'player' ? this.playerMon : this.enemyMon;
    const userStages = side === 'player' ? this.pStages : this.eStages;
    const targetStages = side === 'player' ? this.eStages : this.pStages;

    if (user.status === 'sleep') {
      user.sleepTurns = Math.max(0, user.sleepTurns - 1);
      if (user.sleepTurns === 0) {
        user.status = 'none';
        this.push(events, `${this.label(side)}正在熟睡……醒過來了！`);
      } else {
        this.push(events, `${this.label(side)}正在熟睡。`);
      }
      return;
    }

    let move: MoveDef;
    if (slot < 0) {
      move = STRUGGLE;
      this.push(events, `${this.label(side)}已經沒有可以用的招式了！`);
    } else {
      const moveSlot = user.moves[slot];
      move = getMove(moveSlot.id);
      moveSlot.pp = Math.max(0, moveSlot.pp - 1);
    }

    const attackCue: AnimCue = { a: 'attack', side, type: move.type, physical: move.power > 0 };
    if (move.target === 'enemy' && move.accuracy !== null && this.rng.int(1, 100) > move.accuracy) {
      this.push(events, `${this.label(side)}使用了${move.name}！`, attackCue);
      this.push(events, '但是沒有命中！', { a: 'miss', side: other });
      return;
    }

    if (move.power > 0) {
      const mult = typeMultiplier(move.type, getSpecies(target.species).type);
      const damage = calcDamage(user, target, move, userStages.atk, targetStages.def, this.rng);
      target.hp = Math.max(0, target.hp - damage);
      this.push(events, `${this.label(side)}使用了${move.name}！`, attackCue, { a: 'hit', side: other, effectiveness: mult });
      if (mult > 1) this.push(events, '效果絕佳！');
      else if (mult < 1) this.push(events, '效果不太好……');

      for (const effect of move.effects) {
        if (effect.kind === 'drain' && !isFainted(user)) {
          const heal = Math.max(1, Math.floor(damage * effect.ratio));
          const before = user.hp;
          user.hp = Math.min(maxHp(user), user.hp + heal);
          if (user.hp > before) this.push(events, `${this.label(side)}吸取了養分！`, { a: 'heal', side });
        }
      }
      if (isFainted(target)) {
        this.faint(other, events);
      } else {
        for (const effect of move.effects) {
          if (effect.kind === 'status' && this.rng.chance(effect.chance)) this.inflict(other, effect.status, events, false);
          if (effect.kind === 'stage' && this.rng.chance(effect.chance)) {
            this.changeStage(effect.who === 'self' ? side : other, effect.stat, effect.delta, events, false);
          }
        }
      }
      for (const effect of move.effects) {
        if (effect.kind === 'recoil' && !isFainted(user)) {
          user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(damage * effect.ratio)));
          this.push(events, `${this.label(side)}受到了反作用傷害！`, { a: 'hit', side, effectiveness: 1 });
          if (isFainted(user)) this.faint(side, events);
        }
      }
      return;
    }

    // 變化招式
    this.push(events, `${this.label(side)}使用了${move.name}！`, attackCue);
    for (const effect of move.effects) {
      if (effect.kind === 'status') this.inflict(other, effect.status, events, true);
      if (effect.kind === 'stage') this.changeStage(effect.who === 'self' ? side : other, effect.stat, effect.delta, events, true);
    }
  }

  private inflict(side: Side, status: 'burn' | 'poison' | 'sleep', events: BattleEvent[], announceFailure: boolean): void {
    const mon = side === 'player' ? this.playerMon : this.enemyMon;
    const immune = STATUS_IMMUNITY[status] === getSpecies(mon.species).type;
    if (mon.status !== 'none' || immune) {
      if (announceFailure) this.push(events, `但是對${this.label(side)}沒有效果……`);
      return;
    }
    mon.status = status;
    if (status === 'sleep') mon.sleepTurns = this.rng.int(1, 3);
    const text = status === 'sleep' ? `${this.label(side)}睡著了！` : `${this.label(side)}${STATUS_NAME[status]}了！`;
    this.push(events, text, { a: 'status', side, status });
  }

  private changeStage(side: Side, stat: StatKey, delta: number, events: BattleEvent[], announceFailure: boolean): void {
    const stages = side === 'player' ? this.pStages : this.eStages;
    const next = Math.max(-STAGE_LIMIT, Math.min(STAGE_LIMIT, stages[stat] + delta));
    if (next === stages[stat]) {
      if (announceFailure) this.push(events, `${this.label(side)}的${STAT_NAME[stat]}已經無法再${delta > 0 ? '提高' : '降低'}了！`);
      return;
    }
    stages[stat] = next;
    this.push(events, `${this.label(side)}的${STAT_NAME[stat]}${delta > 0 ? '提高' : '降低'}了！`, { a: 'stage', side, up: delta > 0 });
  }

  private faint(side: Side, events: BattleEvent[]): void {
    const mon = side === 'player' ? this.playerMon : this.enemyMon;
    mon.hp = 0;
    mon.status = 'none';
    mon.sleepTurns = 0;
    if (side === 'player') this.visiblePlayer = false;
    else this.visibleEnemy = false;
    this.push(events, `${this.label(side, mon)}倒下了！`, { a: 'faint', side });
    if (side === 'enemy') {
      const reward = expReward(mon, this.kind);
      for (const uid of this.participants[this.eActive]) {
        this.expLedger.set(uid, (this.expLedger.get(uid) ?? 0) + reward);
      }
    }
  }

  private checkEnd(events: BattleEvent[]): void {
    if (this.outcome) return;
    // 同時全滅時判定為玩家落敗。
    if (this.player.every(isFainted)) {
      this.outcome = 'lose';
      this.push(events, '你的夥伴全部倒下了……');
    } else if (this.enemy.every(isFainted)) {
      this.outcome = 'win';
      this.push(events, this.kind === 'wild' ? '戰鬥勝利！' : `你打敗了${this.trainerName}！`);
    }
  }

  private endOfTurn(events: BattleEvent[]): void {
    const order: Side[] = this.effectiveSpeed('enemy') > this.effectiveSpeed('player') ? ['enemy', 'player'] : ['player', 'enemy'];
    for (const side of order) {
      if (this.outcome) return;
      const mon = side === 'player' ? this.playerMon : this.enemyMon;
      if (isFainted(mon) || (mon.status !== 'burn' && mon.status !== 'poison')) continue;
      const ratio = mon.status === 'burn' ? 12 : 8;
      mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(maxHp(mon) / ratio)));
      this.push(events, `${this.label(side)}受到${STATUS_NAME[mon.status]}的傷害！`, { a: 'hit', side, effectiveness: 1 });
      if (isFainted(mon)) this.faint(side, events);
      this.checkEnd(events);
    }
  }

  private replaceFainted(events: BattleEvent[]): void {
    if (isFainted(this.enemyMon)) {
      const next = this.enemy.findIndex((m) => !isFainted(m));
      if (next >= 0) {
        this.eActive = next;
        this.eStages = freshStages();
        // 我方同時倒下時，參戰者要等玩家換上新怪獸後再加入。
        if (!isFainted(this.playerMon)) this.participants[next].add(this.playerMon.uid);
        this.seen.add(this.enemyMon.species);
        this.visibleEnemy = true;
        this.push(events, `${this.trainerName}派出了${displayName(this.enemyMon)}！`, { a: 'switchIn', side: 'enemy' });
      }
    }
    if (isFainted(this.playerMon)) this.needsPlayerSwitch = true;
  }

  /** 我方怪獸倒下後的強制換怪；不消耗回合，敵人不會趁機攻擊。 */
  forceSwitch(to: number): BattleEvent[] {
    if (!this.needsPlayerSwitch) throw new Error('目前不需要換怪');
    const target = this.player[to];
    if (!target || isFainted(target)) throw new Error('必須選擇還能戰鬥的怪獸');
    const events: BattleEvent[] = [];
    this.pActive = to;
    this.pStages = freshStages();
    this.needsPlayerSwitch = false;
    this.participants[this.eActive].add(this.playerMon.uid);
    this.visiblePlayer = true;
    this.push(events, `去吧，${displayName(this.playerMon)}！`, { a: 'switchIn', side: 'player' });
    return events;
  }
}

/**
 * 傷害 = ⌊⌊⌊2·Lv/5+2⌋ · 威力 · 攻/防⌋ / 50⌋ + 2，
 * 再乘本系加成 1.25、屬性倍率與 0.85–1.00 的亂數，無條件捨去，至少 1。
 */
export function calcDamage(
  user: MonsterInstance,
  target: MonsterInstance,
  move: MoveDef,
  atkStage: number,
  defStage: number,
  rng: Rng,
): number {
  const atk = statsOf(user).atk * stageMultiplier(atkStage);
  const def = statsOf(target).def * stageMultiplier(defStage);
  const base = Math.floor(Math.floor(Math.floor((2 * user.level) / 5 + 2) * move.power * (atk / def)) / 50) + 2;
  const stab = move.type !== null && move.type === getSpecies(user.species).type ? 1.25 : 1;
  const mult = typeMultiplier(move.type, getSpecies(target.species).type);
  const roll = rng.int(85, 100) / 100;
  return Math.max(1, Math.floor(base * stab * mult * roll));
}

/** 逃跑機率 = clamp(50% + (我方速度 − 對手速度)·2% + 已失敗次數·15%, 20%, 100%)。 */
export function runChance(playerSpeed: number, enemySpeed: number, attempts: number): number {
  return Math.max(0.2, Math.min(1, 0.5 + (playerSpeed - enemySpeed) * 0.02 + attempts * 0.15));
}

/** 敵方 AI：只從剩餘次數 > 0 的招式中挑選；全部用完就使用「拚命」。 */
export function chooseEnemyAction(battle: Battle, rng: Rng): EnemyAction {
  const usable = battle.usableMoveSlots('enemy');
  if (usable.length === 0) return { kind: 'struggle' };
  const self = battle.enemyMon;
  const foe = battle.playerMon;
  const useful = usable.filter((slot) => {
    const move = getMove(self.moves[slot].id);
    if (move.power > 0) return true;
    return move.effects.some((effect) => {
      if (effect.kind === 'status') {
        return foe.status === 'none' && STATUS_IMMUNITY[effect.status] !== getSpecies(foe.species).type;
      }
      if (effect.kind === 'stage') {
        const stages = effect.who === 'self' ? battle.eStages : battle.pStages;
        return effect.delta > 0 ? stages[effect.stat] < 2 : stages[effect.stat] > -2;
      }
      return false;
    });
  });
  const pool = useful.length > 0 ? useful : usable;
  if (battle.ai === 'wild' || rng.chance(0.25)) {
    return { kind: 'move', slot: pool[rng.int(0, pool.length - 1)] };
  }
  let best = pool[0];
  let bestScore = -Infinity;
  for (const slot of pool) {
    const move = getMove(self.moves[slot].id);
    let score: number;
    if (move.power > 0) {
      const stab = move.type === getSpecies(self.species).type ? 1.25 : 1;
      score = move.power * stab * typeMultiplier(move.type, getSpecies(foe.species).type) * ((move.accuracy ?? 100) / 100);
    } else {
      score = move.effects.some((e) => e.kind === 'status') ? 38 : 28;
    }
    if (score > bestScore) {
      bestScore = score;
      best = slot;
    }
  }
  return { kind: 'move', slot: best };
}
