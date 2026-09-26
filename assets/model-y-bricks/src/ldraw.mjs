// 讀取 LDraw 官方零件庫（https://library.ldraw.org）：解析 .dat、展開子檔、取出三角面、邊線與凸點（stud）位置。
// 零件庫不隨專案提交，用環境變數 LDRAW_DIR 指到解壓後的 ldraw/ 目錄。
import fs from 'node:fs';
import path from 'node:path';

export const LDRAW_DIR = process.env.LDRAW_DIR || '';

const cache = new Map();
let index = null;

function buildIndex() {
  if (!LDRAW_DIR || !fs.existsSync(LDRAW_DIR)) throw new Error('請設定 LDRAW_DIR 指向 LDraw 零件庫（含 parts/ 與 p/ 的目錄）');
  index = new Map();
  const roots = [['parts', ''], ['parts/s', 's/'], ['p', ''], ['p/48', '48/'], ['p/8', '8/']];
  for (const [dir, prefix] of roots) {
    const full = path.join(LDRAW_DIR, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      const key = (prefix + f).toLowerCase();
      if (!index.has(key)) index.set(key, path.join(full, f));
    }
  }
}

export function normName(name) { return name.trim().replace(/\\/g, '/').toLowerCase(); }

export function resolveFile(name) {
  if (!index) buildIndex();
  return index.get(normName(name)) || null;
}

// 解析一個 LDraw 檔，回傳 { title, lines: [{type, color, m?, file?, pts?}] }
export function loadFile(name) {
  const key = normName(name);
  if (cache.has(key)) return cache.get(key);
  const file = resolveFile(key);
  if (!file) throw new Error('LDraw 零件庫找不到 ' + name);
  const text = fs.readFileSync(file, 'utf8');
  const out = { name: key, title: '', lines: [] };
  let first = true;
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    const tok = t.split(/\s+/);
    const type = tok[0];
    if (type === '0') {
      if (first) { out.title = t.slice(1).trim(); first = false; }
      if (tok[1] === 'BFC' && tok.includes('INVERTNEXT')) out.lines.push({ type: 'invert' });
      continue;
    }
    first = false;
    const color = Number(tok[1]);
    const nums = tok.slice(2).map(Number);
    if (type === '1') {
      const [x, y, z, a, b, c, d, e, f, g, h, i] = nums;
      out.lines.push({ type: 1, color, m: [a, b, c, x, d, e, f, y, g, h, i, z], file: tok.slice(14).join(' ') });
    } else if (type === '2' || type === '3' || type === '4' || type === '5') {
      const n = type === '5' ? 4 : Number(type);
      const pts = [];
      for (let k = 0; k < n; k++) pts.push([nums[k * 3], nums[k * 3 + 1], nums[k * 3 + 2]]);
      out.lines.push({ type: Number(type), color, pts });
    }
  }
  cache.set(key, out);
  return out;
}

// 3×4 仿射矩陣 [a b c x; d e f y; g h i z]
export const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
export function mul(A, B) {
  const r = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r[i * 4 + j] = A[i * 4] * B[j] + A[i * 4 + 1] * B[4 + j] + A[i * 4 + 2] * B[8 + j];
    r[i * 4 + 3] = A[i * 4] * B[3] + A[i * 4 + 1] * B[7] + A[i * 4 + 2] * B[11] + A[i * 4 + 3];
  }
  return r;
}
export function apply(M, p) {
  return [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]];
}
export function applyDir(M, p) {
  return [M[0] * p[0] + M[1] * p[1] + M[2] * p[2], M[4] * p[0] + M[5] * p[1] + M[6] * p[2], M[8] * p[0] + M[9] * p[1] + M[10] * p[2]];
}
export function det3(M) {
  return M[0] * (M[5] * M[10] - M[6] * M[9]) - M[1] * (M[4] * M[10] - M[6] * M[8]) + M[2] * (M[4] * M[9] - M[5] * M[8]);
}

// 凸點類原始檔：上方的公凸點；stug 是凸點群組，會再展開成 stud
const MALE_STUD = /^(stud|stud2|stud2a|stud10|stud15|stud17a|stud18a|studp01|studel|stud-logo\d*)\.dat$/;
export function isStudPrimitive(name) {
  const n = normName(name);
  return MALE_STUD.test(n) || /^stug/.test(n);
}

// 展開零件：visit(kind, data)；kind = 'tri' | 'line' | 'cond' | 'stud'
// opts.skipStuds：凸點不輸出幾何，只回報 'stud'（位置與朝上方向）
export function walk(name, visit, opts = {}, M = IDENT, color = 16, depth = 0) {
  const f = loadFile(name);
  const mine = (c) => (c === 16 ? color : c === 24 ? 24 : c);
  for (const ln of f.lines) {
    if (ln.type === 'invert') continue;
    if (ln.type === 1) {
      const sub = normName(ln.file);
      const M2 = mul(M, ln.m);
      const c2 = mine(ln.color);
      if (MALE_STUD.test(sub)) {
        visit('stud', { pos: apply(M2, [0, 0, 0]), up: applyDir(M2, [0, -1, 0]), file: sub, color: c2 });
        if (opts.skipStuds) continue;
      }
      walk(sub, visit, opts, M2, c2, depth + 1);
    } else if (ln.type === 3 || ln.type === 4) {
      visit('tri', { pts: ln.pts.map((p) => apply(M, p)), color: mine(ln.color) });
    } else if (ln.type === 2) {
      visit('line', { pts: ln.pts.map((p) => apply(M, p)), color: mine(ln.color) });
    } else if (ln.type === 5) {
      visit('cond', { pts: ln.pts.map((p) => apply(M, p)), color: mine(ln.color) });
    }
  }
}

// LDConfig.ldr：顏色代碼 → { name, rgb, edge, alpha }
export function loadColors() {
  const text = fs.readFileSync(path.join(LDRAW_DIR, 'LDConfig.ldr'), 'utf8');
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/!COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+#([0-9A-Fa-f]{6})\s+EDGE\s+#?([0-9A-Fa-f]{6}|\d+)(.*)/);
    if (!m) continue;
    const alpha = /ALPHA\s+(\d+)/.exec(m[5]);
    map.set(Number(m[2]), { name: m[1], rgb: m[3].toUpperCase(), edge: m[4], alpha: alpha ? Number(alpha[1]) : 255, extra: m[5].trim() });
  }
  return map;
}

// 零件本體（不含凸點）的包圍盒與凸點列表
export function partInfo(name) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const studs = [];
  let tris = 0;
  walk(name, (kind, d) => {
    if (kind === 'stud') { studs.push(d); return; }
    if (kind !== 'tri') return;
    tris++;
    for (const p of d.pts) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
  }, { skipStuds: true });
  return { title: loadFile(name).title, lo, hi, studs, tris };
}
