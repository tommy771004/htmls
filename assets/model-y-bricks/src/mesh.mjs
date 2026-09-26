// 把 .ldr 用到的每種零件展開成三角網格與邊線，輸出給網頁的 Three.js 直接畫（網頁執行時不需要 LDraw 零件庫）。
// 用法：LDRAW_DIR=... node mesh.mjs ../model-y.ldr ../model-y.mesh.json
import fs from 'node:fs';
import { walk, loadColors, loadFile } from './ldraw.mjs';
import { parseModel } from './ldr.mjs';

const [, , inFile, outFile] = process.argv;
const model = parseModel(inFile);
const colors = loadColors();
const q = (v) => Math.round(v * 100) / 100;

const geo = {};
for (const p of model.parts) {
  if (geo[p.file]) continue;
  const tris = {}; const lines = [];
  walk(p.file, (kind, d) => {
    if (kind === 'tri') {
      const key = String(d.color);
      const arr = tris[key] || (tris[key] = []);
      const P = d.pts;
      const push = (a) => arr.push(q(a[0]), q(a[1]), q(a[2]));
      push(P[0]); push(P[1]); push(P[2]);
      if (P.length === 4) { push(P[0]); push(P[2]); push(P[3]); }
    } else if (kind === 'line') {
      for (const a of d.pts) lines.push(q(a[0]), q(a[1]), q(a[2]));
    }
  });
  geo[p.file] = { title: loadFile(p.file).title, tris, lines };
}
const used = new Set([16, 24]);
for (const p of model.parts) used.add(p.color);
for (const g of Object.values(geo)) for (const k of Object.keys(g.tris)) used.add(Number(k));
const pal = {};
for (const c of used) { const v = colors.get(c); if (v) pal[c] = { name: v.name, rgb: v.rgb, edge: v.edge, alpha: v.alpha, extra: v.extra }; }
const out = {
  meta: model.meta,
  colors: pal,
  geo,
  parts: model.parts.map((p) => ({ f: p.file, c: p.color, m: p.m.map(q), s: p.step })),
  steps: model.steps.map((s) => ({ title: s.title, n: s.parts.length, view: s.view || 'above' })),
};
fs.writeFileSync(outFile, JSON.stringify(out));
console.log('parts', model.parts.length, 'unique', Object.keys(geo).length, 'bytes', fs.statSync(outFile).size);
