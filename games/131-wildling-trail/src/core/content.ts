// 內容驗證：重複 ID、缺少的素材、指向不存在資料的參照，以及地圖落點是否安全。
// 只讀資料，不依賴 Phaser 或 DOM；測試與開發模式啟動時都會跑一次。

import { ELEMENTS } from '../data/elements';
import { ITEM_LIST, SHOP_STOCK } from '../data/items';
import { MAP_LIST, START_POS, WHITEOUT_POS } from '../data/maps';
import { MOVE_LIST, STRUGGLE } from '../data/moves';
import { SPECIES_LIST, STARTERS } from '../data/species';
import { TILE_LIST, TILES } from '../data/tiles';
import { TRAINER_LIST } from '../data/trainers';
import { FLAG_NAMES } from './progress';
import type { Dir } from './types';
import { DIRS, placedEntities, stepFrom, tileAt, warpAt, type MapDef } from './world';

export interface ContentContext {
  /** 已產生的素材 key；省略時不檢查素材。 */
  spriteKeys?: ReadonlySet<string>;
  /** 已實作的 NPC 劇本名稱；省略時不檢查。 */
  scripts?: ReadonlySet<string>;
}

/** 角色素材的方向與影格；每個角色 key 都要有 4 方向 × 3 影格。 */
export const CHAR_FRAMES = [0, 1, 2] as const;

export function charFrameKey(sprite: string, dir: Dir, frame: number): string {
  return `${sprite}.${dir}.${frame}`;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

/** 回傳所有問題；空陣列代表內容完整。 */
export function validateContent(ctx: ContentContext = {}): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);
  const flagSet = new Set<string>(FLAG_NAMES);
  const speciesIds = new Set(SPECIES_LIST.map((s) => s.id));
  const moveIds = new Set(MOVE_LIST.map((m) => m.id));
  const itemIds = new Set(ITEM_LIST.map((i) => i.id));
  const mapIds = new Set(MAP_LIST.map((m) => m.id));

  const needSprite = (key: string, owner: string) => {
    if (ctx.spriteKeys && !ctx.spriteKeys.has(key)) err(`${owner} 缺少素材 ${key}`);
  };

  for (const [label, ids] of [
    ['物種', SPECIES_LIST.map((s) => s.id)],
    ['招式', [...MOVE_LIST.map((m) => m.id), STRUGGLE.id]],
    ['道具', ITEM_LIST.map((i) => i.id)],
    ['地圖', MAP_LIST.map((m) => m.id)],
    ['訓練家', TRAINER_LIST.map((t) => t.id)],
    ['地形字元', TILE_LIST.map((t) => t.char)],
    ['旗標', [...FLAG_NAMES]],
  ] as const) {
    for (const id of duplicates([...ids])) err(`${label} ID 重複：${id}`);
  }

  // 首版內容數量
  if (SPECIES_LIST.length !== 8) err(`物種應為 8 種，目前 ${SPECIES_LIST.length}`);
  if (MOVE_LIST.length !== 12) err(`招式應為 12 個，目前 ${MOVE_LIST.length}`);
  if (ELEMENTS.length !== 3) err(`屬性應為 3 種，目前 ${ELEMENTS.length}`);
  if (MAP_LIST.length !== 4) err(`地圖應為 4 張，目前 ${MAP_LIST.length}`);

  // 物種
  const learnable = new Set<string>();
  for (const s of SPECIES_LIST) {
    if (!ELEMENTS.includes(s.type)) err(`物種 ${s.id} 的屬性 ${s.type} 不存在`);
    if (s.learnset.length === 0 || !s.learnset.some((e) => e.level <= 1)) err(`物種 ${s.id} 沒有 Lv1 招式`);
    for (const entry of s.learnset) {
      if (!moveIds.has(entry.move)) err(`物種 ${s.id} 的學習表參照不存在的招式 ${entry.move}`);
      learnable.add(entry.move);
    }
    if (s.evolution && !speciesIds.has(s.evolution.into)) err(`物種 ${s.id} 進化成不存在的 ${s.evolution.into}`);
    if (s.catchRate <= 0 || s.catchRate > 1) err(`物種 ${s.id} 的捕捉率超出 0–1`);
    needSprite(s.sprite.front, `物種 ${s.id}`);
    needSprite(s.sprite.back, `物種 ${s.id}`);
    needSprite(s.sprite.icon, `物種 ${s.id}`);
  }
  for (const m of MOVE_LIST) {
    if (!learnable.has(m.id)) err(`招式 ${m.id} 沒有任何物種會學`);
    if (m.pp <= 0) err(`招式 ${m.id} 的使用次數必須大於 0`);
    if (m.accuracy !== null && (m.accuracy < 1 || m.accuracy > 100)) err(`招式 ${m.id} 的命中率超出 1–100`);
    if (m.type === null) err(`招式 ${m.id} 缺少屬性`);
  }
  const hasTwoStage = SPECIES_LIST.some((s) => {
    const mid = s.evolution && SPECIES_LIST.find((x) => x.id === s.evolution!.into);
    return !!mid?.evolution;
  });
  if (!hasTwoStage) err('至少需要一條兩階段進化路線');
  for (const id of STARTERS) if (!speciesIds.has(id)) err(`初始夥伴 ${id} 不存在`);

  // 道具
  for (const item of ITEM_LIST) needSprite(item.sprite, `道具 ${item.id}`);
  for (const id of SHOP_STOCK) if (!itemIds.has(id)) err(`商店販售不存在的道具 ${id}`);

  // 地形
  for (const tile of TILE_LIST) needSprite(tile.sprite, `地形 ${tile.char}`);

  // 訓練家
  for (const t of TRAINER_LIST) {
    if (t.party.length === 0) err(`訓練家 ${t.id} 沒有怪獸`);
    for (const p of t.party) if (!speciesIds.has(p.species)) err(`訓練家 ${t.id} 使用不存在的物種 ${p.species}`);
    for (const f of t.winFlags) if (!flagSet.has(f)) err(`訓練家 ${t.id} 的旗標 ${f} 未定義`);
  }

  // 地圖
  for (const map of MAP_LIST) errors.push(...validateMap(map, { flagSet, mapIds, itemIds, speciesIds, ctx }));
  for (const [label, pos] of [['起點', START_POS], ['全隊倒下的回復點', WHITEOUT_POS]] as const) {
    const map = MAP_LIST.find((m) => m.id === pos.map);
    if (!map) err(`${label}的地圖 ${pos.map} 不存在`);
    else if (!isSafeLanding(map, pos.x, pos.y)) err(`${label} (${pos.x},${pos.y}) 不是安全落點`);
  }
  errors.push(...validateReachability());
  return errors;
}

/** 落點安全：在地圖內、可以走、上面沒有人，而且不是另一個傳送點。 */
export function isSafeLanding(map: MapDef, x: number, y: number): boolean {
  const tile = tileAt(map, x, y);
  if (!tile || !tile.walkable) return false;
  if (warpAt(map, x, y)) return false;
  // 所有旗標狀態下都不能有人：原位置與移動後的位置都要避開。
  return !map.entities.some((e) => (e.x === x && e.y === y) || (e.movedWhen && e.movedWhen.x === x && e.movedWhen.y === y));
}

function validateMap(
  map: MapDef,
  refs: { flagSet: Set<string>; mapIds: Set<string>; itemIds: Set<string>; speciesIds: Set<string>; ctx: ContentContext },
): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(`地圖 ${map.id}：${msg}`);
  const width = map.rows[0]?.length ?? 0;
  map.rows.forEach((row, y) => {
    if (row.length !== width) err(`第 ${y} 列寬度 ${row.length} 與第 0 列 ${width} 不同`);
    for (const ch of row) if (!TILES[ch]) err(`第 ${y} 列有未定義的地形字元「${ch}」`);
  });
  for (const id of duplicates(map.entities.map((e) => e.id))) err(`實體 ID 重複：${id}`);

  for (const warp of map.warps) {
    const tile = tileAt(map, warp.x, warp.y);
    if (!tile?.walkable) err(`傳送點 (${warp.x},${warp.y}) 不在可行走格子上`);
    if (!refs.mapIds.has(warp.to)) {
      err(`傳送點 (${warp.x},${warp.y}) 指向不存在的地圖 ${warp.to}`);
      continue;
    }
    const dest = MAP_LIST.find((m) => m.id === warp.to)!;
    if (!isSafeLanding(dest, warp.dest.x, warp.dest.y)) {
      err(`傳送點 (${warp.x},${warp.y}) 的落點 ${warp.to}(${warp.dest.x},${warp.dest.y}) 不安全`);
    }
    for (const rule of warp.requires ?? []) if (!refs.flagSet.has(rule.flag)) err(`傳送條件旗標 ${rule.flag} 未定義`);
  }

  const occupied = new Map<string, string>();
  for (const e of map.entities) {
    const spots: [number, number][] = [[e.x, e.y]];
    if (e.movedWhen) spots.push([e.movedWhen.x, e.movedWhen.y]);
    for (const [x, y] of spots) {
      const tile = tileAt(map, x, y);
      if (!tile?.walkable) err(`實體 ${e.id} 站在不可行走的格子 (${x},${y})`);
      if (warpAt(map, x, y)) err(`實體 ${e.id} 擋住傳送點 (${x},${y})`);
      const key = `${x},${y}`;
      if (occupied.has(key) && occupied.get(key) !== e.id) err(`實體 ${e.id} 與 ${occupied.get(key)} 重疊於 (${x},${y})`);
      occupied.set(key, e.id);
    }
    for (const f of [e.hiddenWhen, e.movedWhen?.flag, e.item?.flag]) {
      if (f && !refs.flagSet.has(f)) err(`實體 ${e.id} 參照未定義旗標 ${f}`);
    }
    if (e.item && !refs.itemIds.has(e.item.id)) err(`實體 ${e.id} 放著不存在的道具 ${e.item.id}`);
    if (e.kind === 'item' && !e.item) err(`道具實體 ${e.id} 缺少 item 設定`);
    if (refs.ctx.scripts && !refs.ctx.scripts.has(e.script)) err(`實體 ${e.id} 的劇本 ${e.script} 尚未實作`);
    if (refs.ctx.spriteKeys) {
      if (e.sprite.startsWith('char.')) {
        for (const dir of DIRS) {
          for (const frame of CHAR_FRAMES) {
            const key = charFrameKey(e.sprite, dir, frame);
            if (!refs.ctx.spriteKeys.has(key)) err(`實體 ${e.id} 缺少素材 ${key}`);
          }
        }
      } else if (!refs.ctx.spriteKeys.has(e.sprite)) {
        err(`實體 ${e.id} 缺少素材 ${e.sprite}`);
      }
    }
  }
  if (map.encounter) {
    if (map.encounter.rate <= 0 || map.encounter.rate >= 1) err('遭遇率必須介於 0 與 1 之間');
    for (const entry of map.encounter.table) {
      if (!refs.speciesIds.has(entry.species)) err(`遭遇表有不存在的物種 ${entry.species}`);
      if (entry.min > entry.max || entry.min < 1) err(`遭遇表 ${entry.species} 的等級範圍錯誤`);
    }
    const hasGrass = map.rows.some((row) => [...row].some((ch) => TILES[ch]?.grass));
    if (!hasGrass) err('有遭遇表卻沒有草叢');
  }
  return errors;
}

/**
 * 從起點出發（忽略旗標門檻，所有旗標都當作已取得），
 * 確認每張地圖、每個傳送點與每個可互動實體都走得到。
 */
function validateReachability(): string[] {
  const errors: string[] = [];
  const allFlags: Record<string, boolean> = Object.fromEntries(FLAG_NAMES.map((f) => [f, false]));
  const reached = new Map<string, Set<string>>();
  const queue: { map: string; x: number; y: number }[] = [{ map: START_POS.map, x: START_POS.x, y: START_POS.y }];
  const mark = (map: string, x: number, y: number) => {
    const set = reached.get(map) ?? new Set<string>();
    reached.set(map, set);
    const key = `${x},${y}`;
    if (set.has(key)) return false;
    set.add(key);
    return true;
  };
  mark(START_POS.map, START_POS.x, START_POS.y);
  while (queue.length) {
    const cur = queue.shift()!;
    const map = MAP_LIST.find((m) => m.id === cur.map)!;
    const warp = warpAt(map, cur.x, cur.y);
    if (warp) {
      const dest = MAP_LIST.find((m) => m.id === warp.to);
      if (dest && mark(dest.id, warp.dest.x, warp.dest.y)) queue.push({ map: dest.id, x: warp.dest.x, y: warp.dest.y });
      continue;
    }
    for (const dir of DIRS) {
      const next = stepFrom(cur.x, cur.y, dir);
      const tile = tileAt(map, next.x, next.y);
      // 可達性以「實體不在場」計算，再另外檢查每個實體都有可站的相鄰格。
      if (!tile?.walkable) continue;
      if (placedEntities(map, allFlags).some((e) => e.x === next.x && e.y === next.y)) continue;
      if (mark(map.id, next.x, next.y)) queue.push({ map: map.id, x: next.x, y: next.y });
    }
  }
  for (const map of MAP_LIST) {
    const set = reached.get(map.id);
    if (!set) {
      errors.push(`地圖 ${map.id} 從起點走不到`);
      continue;
    }
    for (const warp of map.warps) {
      if (!set.has(`${warp.x},${warp.y}`)) errors.push(`地圖 ${map.id} 的傳送點 (${warp.x},${warp.y}) 走不到`);
    }
    for (const e of map.entities) {
      const spots: [number, number][] = [[e.x, e.y]];
      if (e.movedWhen) spots.push([e.movedWhen.x, e.movedWhen.y]);
      for (const [x, y] of spots) {
        const ok = DIRS.some((dir) => {
          const a = stepFrom(x, y, dir);
          if (set.has(`${a.x},${a.y}`)) return true;
          // 隔著櫃台說話
          if (tileAt(map, a.x, a.y)?.counter) {
            const b = stepFrom(a.x, a.y, dir);
            return set.has(`${b.x},${b.y}`);
          }
          return false;
        });
        if (!ok) errors.push(`地圖 ${map.id} 的 ${e.id} 在 (${x},${y}) 沒有可以站著互動的位置`);
      }
    }
  }
  return errors;
}
