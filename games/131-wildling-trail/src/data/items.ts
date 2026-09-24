import type { ItemDef } from '../core/types';

export const ITEM_LIST: ItemDef[] = [
  { id: 'cage', name: '晶籠', kind: 'capture', price: 40, value: 1, sprite: 'item.cage', desc: '捕捉野生怪獸用的水晶籠。捕捉倍率 ×1。' },
  { id: 'fineCage', name: '精晶籠', kind: 'capture', price: 100, value: 1.6, sprite: 'item.fineCage', desc: '打磨過的水晶籠。捕捉倍率 ×1.6。' },
  { id: 'berry', name: '莓果露', kind: 'heal', price: 30, value: 25, sprite: 'item.berry', desc: '回復一隻怪獸 25 HP。' },
  { id: 'bigBerry', name: '濃莓果露', kind: 'heal', price: 80, value: 70, sprite: 'item.bigBerry', desc: '回復一隻怪獸 70 HP。' },
  { id: 'herb', name: '萬用草', kind: 'cure', price: 25, value: 0, sprite: 'item.herb', desc: '治好灼傷、中毒與睡眠。' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef {
  const item = ITEMS[id];
  if (!item) throw new Error(`未知道具：${id}`);
  return item;
}

/** 商店販售清單（依顯示順序）。 */
export const SHOP_STOCK = ['cage', 'fineCage', 'berry', 'bigBerry', 'herb'];
