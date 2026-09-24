// 測試用的「玩家」：只透過 app.press() 操作，和真人按鍵走同一條路徑。

import { GameApp } from '../../src/app/game';
import type { Button } from '../../src/app/types';
import { typeMultiplier } from '../../src/data/elements';
import { getItem } from '../../src/data/items';
import { getMap } from '../../src/data/maps';
import { getMove } from '../../src/data/moves';
import { getSpecies } from '../../src/data/species';
import { MemoryStorage } from '../../src/core/save';
import { isFainted, maxHp } from '../../src/core/monster';
import type { Dir } from '../../src/core/types';
import { DIRS, interactTarget, isWalkable, stepFrom, warpAt } from '../../src/core/world';

export function makeApp(seed = 1234, storage = new MemoryStorage(), extra: Partial<ConstructorParameters<typeof GameApp>[0]> = {}) {
  let t = 1_700_000_000_000;
  const app = new GameApp({ storage, seed, now: () => (t += 1000), ...extra });
  return { app, storage };
}

export function press(app: GameApp, ...buttons: Button[]): void {
  for (const b of buttons) app.press(b);
}

/** 讓轉場立即結束（畫面層在動畫播完時才呼叫）。 */
export function settle(app: GameApp): void {
  let guard = 0;
  while (app.mode === 'transition') {
    app.endTransition();
    if (++guard > 10) throw new Error('轉場沒有結束');
  }
}

/** 一路按確認把對話看完；遇到選項時用 choose 決定。 */
export function readAll(app: GameApp, choose: (options: string[]) => number = () => 0): string[] {
  const seen: string[] = [];
  let guard = 0;
  settle(app);
  while (app.mode === 'dialog') {
    const vm = app.dialog!.vm();
    seen.push(vm.text);
    if (vm.choice) {
      const want = choose(vm.choice.options);
      while (app.dialog && app.dialog.vm().choice && app.dialog.vm().choice!.cursor !== want) app.press('down');
    }
    app.press('confirm');
    settle(app);
    if (++guard > 200) throw new Error('對話停不下來');
  }
  return seen;
}

export function face(app: GameApp, dir: Dir): void {
  const p = app.p.player;
  if (p.facing === dir) return;
  // 面向牆壁時按方向只會轉身不會移動；否則移動後再回頭不影響測試，這裡直接改朝向。
  p.facing = dir;
}

/** BFS 找路（避開 NPC、傳送點），回傳方向序列。 */
export function findPath(app: GameApp, tx: number, ty: number, allowWarpTarget = false): Dir[] | null {
  const map = getMap(app.p.player.map);
  const flags = app.p.flags;
  const start = `${app.p.player.x},${app.p.player.y}`;
  const prev = new Map<string, { from: string; dir: Dir }>();
  const queue = [start];
  const seen = new Set([start]);
  while (queue.length) {
    const cur = queue.shift()!;
    const [x, y] = cur.split(',').map(Number);
    if (x === tx && y === ty) {
      const dirs: Dir[] = [];
      let k = cur;
      while (k !== start) {
        const step = prev.get(k)!;
        dirs.unshift(step.dir);
        k = step.from;
      }
      return dirs;
    }
    for (const dir of DIRS) {
      const n = stepFrom(x, y, dir);
      const key = `${n.x},${n.y}`;
      if (seen.has(key) || !isWalkable(map, flags, n.x, n.y)) continue;
      const isTarget = n.x === tx && n.y === ty;
      if (warpAt(map, n.x, n.y) && !(allowWarpTarget && isTarget)) continue;
      seen.add(key);
      prev.set(key, { from: cur, dir });
      queue.push(key);
    }
  }
  return null;
}

export type BattleHook = (app: GameApp) => void;

/** 走到指定格子；途中遇到野生戰鬥就交給 onBattle 處理後繼續。 */
export function walkTo(app: GameApp, tx: number, ty: number, onBattle: BattleHook, allowWarpTarget = false): void {
  let guard = 0;
  const mapId = app.p.player.map;
  while (!(app.p.player.x === tx && app.p.player.y === ty)) {
    if (app.p.player.map !== mapId) return;
    if (++guard > 400) throw new Error(`走不到 (${tx},${ty})`);
    const path = findPath(app, tx, ty, allowWarpTarget);
    if (!path) throw new Error(`找不到路 (${tx},${ty}) 於 ${app.p.player.map} 從 (${app.p.player.x},${app.p.player.y})`);
    if (path.length === 0) return;
    app.press(path[0]);
    if (app.mode === 'transition' || app.mode === 'battle') {
      settle(app);
      if (app.battle) onBattle(app);
      settle(app);
      readAll(app);
    }
    if (app.mode === 'dialog') readAll(app);
  }
}

/** 走到某個實體旁邊並面向它按確認。 */
export function talkTo(app: GameApp, entityId: string, onBattle: BattleHook): void {
  const map = getMap(app.p.player.map);
  const ent = app.visibleEntities().find((e) => e.def.id === entityId);
  if (!ent) throw new Error(`找不到 ${entityId}`);
  let best: { x: number; y: number; dir: Dir; len: number } | null = null;
  for (const dir of DIRS) {
    // 站在實體的 dir 方向，面朝反方向
    for (const dist of [1, 2]) {
      const sx = ent.x + (dir === 'left' ? -dist : dir === 'right' ? dist : 0);
      const sy = ent.y + (dir === 'up' ? -dist : dir === 'down' ? dist : 0);
      const faceDir: Dir = dir === 'up' ? 'down' : dir === 'down' ? 'up' : dir === 'left' ? 'right' : 'left';
      if (!isWalkable(map, app.p.flags, sx, sy) || warpAt(map, sx, sy)) continue;
      const t = interactTarget(map, app.p.flags, sx, sy, faceDir);
      if (t?.def.id !== entityId) continue;
      const path = findPath(app, sx, sy);
      if (path && (!best || path.length < best.len)) best = { x: sx, y: sy, dir: faceDir, len: path.length };
    }
  }
  if (!best) throw new Error(`無法站到 ${entityId} 旁邊`);
  walkTo(app, best.x, best.y, onBattle);
  turnTo(app, best.dir);
  app.press('confirm');
}

/** 原地轉身：朝該方向按一次，若前方可走會移動，所以只在前方被擋住時使用按鍵。 */
export function turnTo(app: GameApp, dir: Dir): void {
  const p = app.p.player;
  const map = getMap(p.map);
  const n = stepFrom(p.x, p.y, dir);
  if (!isWalkable(map, app.p.flags, n.x, n.y)) {
    app.press(dir);
  } else {
    face(app, dir);
  }
}

export function goToMap(app: GameApp, mapId: string, onBattle: BattleHook): void {
  const order = ['village', 'route', 'forest', 'arena'];
  let guard = 0;
  while (app.p.player.map !== mapId) {
    if (++guard > 10) throw new Error('換地圖失敗');
    const cur = order.indexOf(app.p.player.map);
    const target = order.indexOf(mapId);
    const next = order[cur + (target > cur ? 1 : -1)];
    const map = getMap(app.p.player.map);
    const warp = map.warps.find((w) => w.to === next)!;
    walkTo(app, warp.x, warp.y, onBattle, true);
    settle(app);
    readAll(app);
    if (app.p.player.map !== next) throw new Error(`被擋在 ${app.p.player.map}，無法前往 ${next}`);
  }
}

export interface BattleStats {
  wins: number;
  losses: number;
  catches: number;
  runs: number;
}

export const stats: BattleStats = { wins: 0, losses: 0, catches: 0, runs: 0 };

/**
 * 自動打完一場戰鬥：
 * - capture(app) 回傳 true 時，在對手 HP 低於一半後丟最好的晶籠。
 * - 我方 HP 低於 30% 時用莓果露。
 * - 其餘時間選期望傷害最高的招式。
 */
export function autoBattle(app: GameApp, capture: (app: GameApp) => boolean = () => false): void {
  let guard = 0;
  while (app.battle && app.battle.phase !== 'done') {
    if (++guard > 3000) throw new Error('戰鬥停不下來');
    const b = app.battle;
    if (b.phase === 'events' || (b.phase === 'result' && !b.resultVM().panel)) {
      app.press('confirm');
      continue;
    }
    if (b.phase === 'result') {
      // 招式欄滿：忘掉威力最低的招式
      const mon = b.core.player.find((m) => m.moves.length === 4)!;
      let worst = 0;
      mon.moves.forEach((s, i) => {
        if (getMove(s.id).power < getMove(mon.moves[worst].id).power) worst = i;
      });
      app.select(worst);
      continue;
    }
    if (b.phase === 'panel') {
      // 強制換怪
      const idx = b.core.player.findIndex((m) => !isFainted(m));
      app.select(idx);
      continue;
    }
    // command
    const me = b.core.playerMon;
    const foe = b.core.enemyMon;
    const bag = b.core.bag;
    const hpRatio = foe.hp / maxHp(foe);
    if (b.core.kind === 'wild' && capture(app) && hpRatio < 0.55) {
      const cage = (bag.fineCage ?? 0) > 0 ? 'fineCage' : (bag.cage ?? 0) > 0 ? 'cage' : null;
      if (cage) {
        b.act({ kind: 'item', item: cage });
        continue;
      }
    }
    if (me.hp / maxHp(me) < 0.3) {
      const heal = (bag.bigBerry ?? 0) > 0 ? 'bigBerry' : (bag.berry ?? 0) > 0 ? 'berry' : null;
      if (heal) {
        b.act({ kind: 'item', item: heal, target: b.core.pActive });
        continue;
      }
    }
    const usable = b.core.usableMoveSlots('player');
    if (usable.length === 0) {
      b.act({ kind: 'struggle' });
      continue;
    }
    let best = usable[0];
    let score = -1;
    for (const slot of usable) {
      const move = getMove(me.moves[slot].id);
      let s = move.power * (move.type === getSpecies(me.species).type ? 1.25 : 1) * typeMultiplier(move.type, getSpecies(foe.species).type) * ((move.accuracy ?? 100) / 100);
      if (move.power === 0) s = 5;
      if (s > score) {
        score = s;
        best = slot;
      }
    }
    b.act({ kind: 'move', slot: best });
  }
  const outcome = app.battle?.core.outcome;
  if (outcome === 'win') stats.wins++;
  if (outcome === 'lose') stats.losses++;
  if (outcome === 'caught') stats.catches++;
  if (outcome === 'ran') stats.runs++;
  settle(app);
}

export function itemName(id: string): string {
  return getItem(id).name;
}
