// 印出尋路格（# 不可走、. 可走、o 掩體點、V/E 出生點）
import { buildMap, BOUNDS } from '../src/sim/map.js';
import { World } from '../src/sim/world.js';
const map = buildMap(), w = new World(map);
const rows = [];
for (let j = 0; j < w.nh; j++) { let s = ''; for (let i = 0; i < w.nw; i++) s += w.walk[j * w.nw + i] ? '.' : (w.zoneOf[j * w.nw + i] >= 0 ? '#' : ' '); rows.push(s.split('')); }
const put = (x, z, ch) => { const c = w.cellOf(x, z); if (c >= 0) rows[(c / w.nw) | 0][c % w.nw] = ch; };
for (const p of w.cover) put(p.x, p.z, 'o');
map.spawns[0].forEach(p => put(p[0], p[1], 'V')); map.spawns[1].forEach(p => put(p[0], p[1], 'E'));
for (const l of map.lamps) put(l.x, l.z, '*');
console.log(rows.map(r => r.join('')).join('\n'));
console.log('boxes', map.boxes.length, 'items', map.items.length, 'lamps', map.lamps.length, 'cover', w.cover.length, 'pieces', map.pieces.length);
