// 零件清單：從 .ldr 統計每種「零件＋顏色」的數量，輸出 parts.csv、BrickLink 需求清單 XML 與網頁／說明書用的 bom.json。
// 價格（prices.json，由瀏覽器在 BrickLink 查得）存在時一併合併。
// 用法：LDRAW_DIR=... node bom.mjs ../model-y.ldr
import fs from 'node:fs';
import path from 'node:path';
import { parseModel } from './ldr.mjs';
import { CATALOG, idForFile } from './parts.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '..');
const model = parseModel(process.argv[2]);
// 顏色：LDraw 代碼 → 名稱、BrickLink 顏色編號、Rebrickable 顏色編號（與 LDraw 相同）、顯示用 RGB（Rebrickable colors.csv）
export const COLORS = {
  0:  { en: 'Black', zh: '黑', bl: 11, rgb: '05131D' },
  15: { en: 'White', zh: '白', bl: 1, rgb: 'FFFFFF' },
  19: { en: 'Tan', zh: '棕黃', bl: 2, rgb: 'E4CD9E' },
  36: { en: 'Trans-Red', zh: '透明紅', bl: 17, rgb: 'C91A09' },
  47: { en: 'Trans-Clear', zh: '透明', bl: 12, rgb: 'FCFCFC' },
  72: { en: 'Dark Bluish Gray', zh: '深藍灰', bl: 85, rgb: '6C6E68' },
};
const prices = fs.existsSync(path.join(OUT, 'prices.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'prices.json'), 'utf8')) : { lots: {} };
const lots = new Map();
for (const p of model.parts) {
  const id = idForFile(p.file);
  const key = id + '|' + p.color;
  if (!lots.has(key)) {
    const c = CATALOG[id];
    lots.set(key, { key, id, ldraw: p.file, bl: c.bl || id, rb: c.rb || id, name: c.name, zh: c.zh, color: p.color, colorEn: COLORS[p.color].en, colorZh: COLORS[p.color].zh, blColor: COLORS[p.color].bl, rgb: COLORS[p.color].rgb, qty: 0, firstStep: p.step + 1 });
  }
  lots.get(key).qty++;
}
const list = [...lots.values()].sort((a, b) => a.firstStep - b.firstStep || a.id.localeCompare(b.id));
for (const l of list) { const pr = prices.lots[l.key]; if (pr) Object.assign(l, { price: pr }); }
const csv = ['bricklink_id,rebrickable_id,ldraw_file,name,name_zh,color,color_zh,bricklink_color_id,ldraw_color,qty'];
for (const l of list) csv.push([l.bl, l.rb, l.ldraw, `"${l.name}"`, l.zh, l.colorEn, l.colorZh, l.blColor, l.color, l.qty].join(','));
fs.writeFileSync(path.join(OUT, 'parts.csv'), '﻿' + csv.join('\n') + '\n');
// BrickLink 需求清單（Wanted List）上傳格式：https://www.bricklink.com/help.asp?helpID=207
const xml = ['<INVENTORY>'];
for (const l of list) xml.push(`  <ITEM><ITEMTYPE>P</ITEMTYPE><ITEMID>${l.bl}</ITEMID><COLOR>${l.blColor}</COLOR><MINQTY>${l.qty}</MINQTY><CONDITION>N</CONDITION><NOTIFY>N</NOTIFY></ITEM>`);
xml.push('</INVENTORY>');
fs.writeFileSync(path.join(OUT, 'wanted-list.xml'), xml.join('\n') + '\n');
const plan = (prices.plan || []).map((s) => ({ store: s.store, user: s.user, country: s.country, minBuy: s.minBuy, subtotal: s.subtotal, items: s.items.map((i) => ({ key: i.key, bl: i.bl, blColor: i.blColor, qty: i.qty, price: i.price, idInv: i.idInv })) }));
for (const l of list) if (l.price) l.price = { unit: l.price.unit, store: l.price.store, forSaleNew: l.price.forSaleNew, sold6mNew: l.price.sold6mNew, sellersShippingToTW: l.price.sellersShippingToTW, sellers: l.price.sellers };
fs.writeFileSync(path.join(OUT, 'bom.json'), JSON.stringify({ parts: model.parts.length, lots: list, prices: prices.meta || null, plan }, null, 1));
console.log('lots', list.length, 'parts', model.parts.length);
