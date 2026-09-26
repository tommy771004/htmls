// 讀寫模型 .ldr：每個零件一行 type-1，搭建步驟以「0 STEP」分隔，另外支援「0 !PY STEP 標題」這類自訂註解（LDraw 規格允許以 ! 開頭的 meta）。
import fs from 'node:fs';

export function parseModel(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parts = [];
  const steps = [{ title: '', parts: [] }];
  const meta = {};
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    const tok = t.split(/\s+/);
    if (tok[0] === '0') {
      if (tok[1] === 'STEP') steps.push({ title: '', parts: [] });
      else if (tok[1] === '!MY' && tok[2] === 'TITLE') steps[steps.length - 1].title = tok.slice(3).join(' ');
      else if (tok[1] === '!MY' && tok[2] === 'META') meta[tok[3]] = tok.slice(4).join(' ');
      else if (tok[1] === '!MY' && tok[2] === 'META_STEP') steps[steps.length - 1][tok[3]] = tok.slice(4).join(' ');
      continue;
    }
    if (tok[0] !== '1') continue;
    const n = tok.slice(2, 14).map(Number);
    const [x, y, z, a, b, c, d, e, f, g, h, i] = n;
    const p = { idx: parts.length, color: Number(tok[1]), m: [a, b, c, x, d, e, f, y, g, h, i, z], file: tok.slice(14).join(' ').toLowerCase(), step: steps.length - 1 };
    parts.push(p);
    steps[steps.length - 1].parts.push(p.idx);
  }
  // 結尾的空步驟（檔案以 0 STEP 結束時）去掉
  while (steps.length && steps[steps.length - 1].parts.length === 0) steps.pop();
  return { parts, steps, meta };
}

const fmt = (v) => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
export function formatLine(p) {
  const m = p.m;
  return ['1', p.color, fmt(m[3]), fmt(m[7]), fmt(m[11]), fmt(m[0]), fmt(m[1]), fmt(m[2]), fmt(m[4]), fmt(m[5]), fmt(m[6]), fmt(m[8]), fmt(m[9]), fmt(m[10]), p.file].join(' ');
}
