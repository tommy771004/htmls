import { TILES, type TileDef } from '../data/tiles';
import type { Dir } from './types';

export interface WarpDef {
  x: number;
  y: number;
  to: string;
  dest: { x: number; y: number };
  facing: Dir;
  /** 依序檢查；第一個缺少的旗標會擋住並顯示對話，不會切換地圖。 */
  requires?: GateRule[];
}

export interface GateRule {
  flag: string;
  speaker: string;
  text: string;
}

export type EntityKind = 'npc' | 'sign' | 'item' | 'terminal';

export interface EntityDef {
  id: string;
  kind: EntityKind;
  name: string;
  x: number;
  y: number;
  facing: Dir;
  sprite: string;
  script: string;
  /** 旗標成立後移到別的位置（例如讓出通道）。 */
  movedWhen?: { flag: string; x: number; y: number; facing?: Dir };
  /** 旗標成立後消失（例如地上的道具被撿走）。 */
  hiddenWhen?: string;
  item?: { id: string; count: number; flag: string };
}

export interface EncounterEntry {
  species: string;
  min: number;
  max: number;
  weight: number;
}

export interface MapDef {
  id: string;
  name: string;
  rows: string[];
  warps: WarpDef[];
  entities: EntityDef[];
  encounter?: { rate: number; table: EncounterEntry[] };
  battleBg: 'meadow' | 'forest' | 'arena';
}

export interface PlacedEntity {
  def: EntityDef;
  x: number;
  y: number;
  facing: Dir;
}

export type Flags = Record<string, boolean>;

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export const DIR_VEC: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function stepFrom(x: number, y: number, dir: Dir): { x: number; y: number } {
  const [dx, dy] = DIR_VEC[dir];
  return { x: x + dx, y: y + dy };
}

export function mapSize(map: MapDef): { w: number; h: number } {
  return { w: map.rows[0]?.length ?? 0, h: map.rows.length };
}

export function tileAt(map: MapDef, x: number, y: number): TileDef | null {
  if (y < 0 || y >= map.rows.length || x < 0 || x >= map.rows[y].length) return null;
  return TILES[map.rows[y][x]] ?? null;
}

export function placeEntity(def: EntityDef, flags: Flags): PlacedEntity | null {
  if (def.hiddenWhen && flags[def.hiddenWhen]) return null;
  if (def.movedWhen && flags[def.movedWhen.flag]) {
    return { def, x: def.movedWhen.x, y: def.movedWhen.y, facing: def.movedWhen.facing ?? def.facing };
  }
  return { def, x: def.x, y: def.y, facing: def.facing };
}

export function placedEntities(map: MapDef, flags: Flags): PlacedEntity[] {
  return map.entities.map((e) => placeEntity(e, flags)).filter((e): e is PlacedEntity => e !== null);
}

export function entityAt(map: MapDef, flags: Flags, x: number, y: number): PlacedEntity | null {
  return placedEntities(map, flags).find((e) => e.x === x && e.y === y) ?? null;
}

export function warpAt(map: MapDef, x: number, y: number): WarpDef | null {
  return map.warps.find((w) => w.x === x && w.y === y) ?? null;
}

/** 牆、樹、水、NPC 與地圖外都不能走。 */
export function isWalkable(map: MapDef, flags: Flags, x: number, y: number): boolean {
  const tile = tileAt(map, x, y);
  if (!tile || !tile.walkable) return false;
  return entityAt(map, flags, x, y) === null;
}

export type MoveResult =
  | { kind: 'blocked' }
  | { kind: 'gate'; warp: WarpDef; rule: GateRule }
  | { kind: 'step'; x: number; y: number; warp: WarpDef | null; grass: boolean };

/** 嘗試往 dir 走一格。只有真的走進去才會回傳 step。 */
export function resolveMove(map: MapDef, flags: Flags, x: number, y: number, dir: Dir): MoveResult {
  const next = stepFrom(x, y, dir);
  if (!isWalkable(map, flags, next.x, next.y)) return { kind: 'blocked' };
  const warp = warpAt(map, next.x, next.y);
  const rule = warp?.requires?.find((r) => !flags[r.flag]);
  if (warp && rule) return { kind: 'gate', warp, rule };
  const tile = tileAt(map, next.x, next.y)!;
  return { kind: 'step', x: next.x, y: next.y, warp, grass: tile.grass };
}

/**
 * 面向的互動對象：前方一格的實體；若前方是櫃台，則看櫃台後方那一格。
 */
export function interactTarget(map: MapDef, flags: Flags, x: number, y: number, dir: Dir): PlacedEntity | null {
  const front = stepFrom(x, y, dir);
  const direct = entityAt(map, flags, front.x, front.y);
  if (direct) return direct;
  if (tileAt(map, front.x, front.y)?.counter) {
    const beyond = stepFrom(front.x, front.y, dir);
    return entityAt(map, flags, beyond.x, beyond.y);
  }
  return null;
}
