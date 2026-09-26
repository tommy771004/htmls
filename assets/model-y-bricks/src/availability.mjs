// 從 Rebrickable 公開資料（https://rebrickable.com/downloads/）算出每個零件＋顏色組合最近出現在哪些套組，
// 產生 ../availability.json，供設計程式挑零件、驗證程式檢查「現行真實存在」。
// 用法：RB_DIR=（含 sets.csv、inventories.csv、inventory_parts.csv、colors.csv 的目錄）LDRAW_DIR=... node availability.mjs
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { CATALOG } from './parts.mjs';
import { loadColors } from './ldraw.mjs';

const RB = process.env.RB_DIR;
const SINCE = 2024;
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'availability.json');

function parseCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out;
}
async function* rows(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(RB, file)) });
  let head = null;
  for await (const line of rl) { const r = parseCSVLine(line); if (!head) { head = r; continue; } yield Object.fromEntries(head.map((h, i) => [h, r[i]])); }
}

const rbIds = new Map(Object.entries(CATALOG).map(([id, c]) => [c.rb || id, id]));
const sets = new Map();
for await (const r of rows('sets.csv')) sets.set(r.set_num, { year: +r.year, name: r.name });
const inv = new Map();
for await (const r of rows('inventories.csv')) inv.set(r.id, r.set_num);
const rbColors = new Map();
for await (const r of rows('colors.csv')) rbColors.set(r.id, r.name);

const combos = {};
for await (const r of rows('inventory_parts.csv')) {
  const id = rbIds.get(r.part_num); if (!id) continue;
  const setNum = inv.get(r.inventory_id); const s = sets.get(setNum); if (!s) continue;
  const key = id + '|' + r.color_id;
  const c = combos[key] || (combos[key] = { sets: 0, lastYear: 0, example: null, setList: new Set() });
  if (s.year > c.lastYear) c.lastYear = s.year;
  if (s.year >= SINCE && !c.setList.has(setNum)) {
    c.setList.add(setNum); c.sets++;
    if (!c.example || s.year > c.example.year) c.example = { set: setNum, name: s.name, year: s.year };
  }
}
for (const c of Object.values(combos)) delete c.setList;

// LDraw 顏色代碼與 Rebrickable 顏色編號：本模型用到的顏色兩邊編號相同，這裡比對名稱確認
const ld = loadColors();
const colorCheck = {};
for (const code of [0, 15, 19, 36, 47, 71, 72]) {
  const n = (t) => t.replace(/[_-]/g, ' ').replace(/grey/gi, 'gray').toLowerCase();
  const a = n(ld.get(code).name), b = n(rbColors.get(String(code)) || '');
  colorCheck[code] = { ldraw: ld.get(code).name, rebrickable: rbColors.get(String(code)), same: a === b };
}
fs.writeFileSync(OUT, JSON.stringify({ source: 'Rebrickable CSV downloads', since: SINCE, generated: new Date().toISOString().slice(0, 10), colorCheck, combos }, null, 0));
console.log('combos', Object.keys(combos).length, colorCheck);
