// 從 RO 客戶端 data.grf 轉出武器／盾牌精靈圖，寫到 assets/282/parts/equip/，並把 tools/equip-missing.json
// 裡對應的 manifest 項目接回 assets/282/manifest.json（只接回真的轉出檔案的項目）。
//   node tools/grf/convert-equip.mjs <data.grf>
// 轉檔流程以身體圖驗證過：同一份 GRF 轉出的 body_*.json 與作品原本的檔案逐格相同。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grf } from './grf.mjs';
import { buildSheet } from './sprite.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = path.resolve(root, '../../assets/282');
const grf = new Grf(process.argv[2]);

// 武器資料夾（data/sprite/인간족/<資料夾>/）；轉生職沿用一轉職業的武器圖
const WPN_JOB = {
  swordsman: '검사', knight: '기사', knight_peco: '페코페코_기사', crusader: '크루세이더', crusader_peco: '신페코크루세이더',
  paladin: '크루세이더', merchant: '상인', blacksmith: '제철공', alchemist: '연금술사', thief: '도둑', assassin: '어세신',
  rogue: '로그', ninja: '닌자', archer: '궁수', hunter: '헌터', sniper: '헌터', bard: { m: '바드', f: '무희' },
  mage: '마법사', wizard: '위저드', sage: '세이지', professor: '세이지', acolyte: '성직자', priest: '프리스트',
  high_priest: '프리스트', monk: '몽크', soul_linker: '소울링커', gunslinger: '건너', taekwon: '태권소년', star_gladiator: '권성',
};
// 盾牌資料夾（data/sprite/방패/<資料夾>/）；騎鳥職業沿用沒騎鳥的盾牌
const SH_JOB = {
  ...WPN_JOB, knight_peco: '기사', crusader_peco: '크루세이더', paladin: '팔라딘', professor: '프로페서',
  high_priest: '하이프리스트', sniper: '스나이퍼',
};
const WTYPE = {
  sword: ['검'], '2hsword': ['양손검'], dagger: ['단검'], axe: ['도끼'], '2haxe': ['양손도끼'], spear: ['창'], '2hspear': ['양손창'],
  mace: ['클럽'], bow: ['활'], katar: ['카타르_카타르', '카타르'], huuma: ['수리검'], rod: ['롯드'], instrument: ['악기'],
  whip: ['채찍'], book: ['책'], pistol: ['권총'], dagger_dagger: ['단검_단검'], dagger_sword: ['단검_검'], sword_sword: ['검_검'],
};
const SHIELD = { 2101: ['가드'], 2103: ['버클러'], 2105: ['쉴드'], 2107: ['미러쉴드'] };
// 官方客戶端沒有的組合：轉生職的舊盾牌沿用一轉職業（和客戶端一樣）；特殊外觀杖退回一般杖
const SH_FALLBACK = { paladin: '크루세이더', high_priest: '프리스트', professor: '세이지', sniper: '헌터' };
const WPN_FALLBACK = (id) => (/^16\d\d$/.test(id) ? ['롯드'] : []);
const SEX = { m: '남', f: '여' };
const pick = (v, g) => (typeof v === 'string' ? v : v?.[g]);

function resolve(file) {
  const m = file.match(/^parts\/equip\/(wpn|sh)_(.+)_(m|f)_([^/]+)\.json$/);
  if (!m) return null;
  const [, kind, job, g, what] = m;
  const tries = [];
  if (kind === 'wpn') {
    const folder = pick(WPN_JOB[job], g);
    const names = WTYPE[what] ?? (/^\d+$/.test(what) ? [what, ...WPN_FALLBACK(what)] : []);
    if (folder) for (const n of names) tries.push(`data\\sprite\\인간족\\${folder}\\${folder}_${SEX[g]}_${n}`);
  } else {
    const names = SHIELD[what] ?? [`${what}_방패`];
    for (const folder of [pick(SH_JOB[job], g), SH_FALLBACK[job]].filter(Boolean))
      for (const n of names) tries.push(`data\\sprite\\방패\\${folder}\\${folder}_${SEX[g]}_${n}`);
  }
  return tries.find((b) => grf.has(b + '.spr') && grf.has(b + '.act')) ?? null;
}

const missing = JSON.parse(fs.readFileSync(path.join(root, 'tools/equip-missing.json'), 'utf8'));
const files = new Set();
(function walk(o) { for (const v of Object.values(o)) typeof v === 'string' ? files.add(v) : v && typeof v === 'object' && walk(v); })(missing);

const ok = new Set(), fail = [];
let bytes = 0;
for (const file of [...files].sort()) {
  const src = resolve(file);
  if (!src) { fail.push(file); continue; }
  const base = path.basename(file, '.json');
  const { json, png, pal } = buildSheet(grf.get(src + '.spr'), grf.get(src + '.act'), base);
  const out = path.join(assets, path.dirname(file));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, base + '.json'), JSON.stringify(json));
  fs.writeFileSync(path.join(out, base + '.png'), png);
  fs.writeFileSync(path.join(out, base + '.pal.png'), pal);
  bytes += png.length + pal.length;
  ok.add(file);
}

// 接回 manifest
const manPath = path.join(assets, 'manifest.json');
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
let restored = 0, skipped = 0;
for (const [key, map] of Object.entries(missing)) {
  let node = man;
  for (const k of key.split('.')) node = node[k] ??= {};
  for (const [id, file] of Object.entries(map)) {
    if (ok.has(file)) { node[id] = file; restored++; } else skipped++;
  }
}
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
console.log(`轉出 ${ok.size}/${files.size} 個精靈圖（圖檔 ${(bytes / 1048576).toFixed(1)} MB），接回 manifest ${restored} 筆，略過 ${skipped} 筆`);
if (fail.length) console.log('GRF 裡找不到：\n  ' + fail.join('\n  '));
