// 一次性：把 style.css 第 1 行（壓縮的原始淺色主題）裡寫死的淺色背景／邊框／亮色陰影與深色文字轉成深色玻璃主題的對應色
import { readFileSync, writeFileSync } from 'fs';
const [file] = process.argv.slice(2); // 用法：node tools/dark-theme/darken-line1.mjs src/style.css（只改第 1 行；已執行過，勿重跑）
const lines = readFileSync(file, 'utf8').split('\n');
let css = lines[0];
const toRGB = (tok) => {
  let m = tok.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const v = m[1].split(/[ ,\/]+/).filter(Boolean).map((x) => x.endsWith('%') ? parseFloat(x) / 100 : Number(x)); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; }
  m = tok.match(/^#([0-9a-f]{3,8})$/i); if (!m) return null;
  let h = m[1]; if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
  const v = [0, 2, 4, 6].map((i) => (i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255));
  return [v[0], v[1], v[2], h.length === 8 ? +(v[3] / 255).toFixed(3) : 1];
};
const L = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
const fmt = ([r, g, b, a]) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(3)})`;
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; };
const rgbOf = (h, s, l) => { if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t < 0 && (t += 1); t > 1 && (t -= 1); return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; };
const COLOR = /rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi;
const mapColors = (val, fn) => val.replace(COLOR, (tok) => { const c = toRGB(tok); if (!c || c.some((x) => Number.isNaN(x))) return tok; const n = fn(c); return n ? fmt(n) : tok; });
const stats = {};
const bump = (k) => (stats[k] = (stats[k] || 0) + 1);
const lightBg = (c) => (L(c) > 170 && c[3] > 0.02 ? (bump('bg'), [c[0], c[1], c[2], Math.max(0.035, Math.min(0.14, c[3] * 0.16))]) : null);
const lightLine = (c) => (L(c) > 170 && c[3] > 0.05 ? (bump('line'), [c[0], c[1], c[2], Math.max(0.06, c[3] * 0.24)]) : null);
const darkText = (c) => {
  if (L(c) >= 120 || c[3] < 0.3) return null;
  const [h, s, l] = hsl(c); bump('text');
  return [...rgbOf(h, Math.min(s, 0.85), s < 0.3 ? 0.84 : 0.72), c[3]];
};
const lightShadowToDark = (c) => (L(c) > 170 && c[3] > 0.05 ? (bump('tshadow'), [0, 0, 0, Math.min(0.6, c[3] * 0.7)]) : null);
// 宣告切分：括號內的分號（data: URI）不切
const splitDecl = (body) => { const out = []; let depth = 0, q = '', cur = ''; for (const ch of body) { if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ';' && depth === 0) { out.push(cur); cur = ''; continue; } cur += ch; } out.push(cur); return out; };
css = css.replace(/([^{}]*)\{([^{}]*)\}/g, (all, sel, body) => {
  if (/background-clip:text/.test(body)) return all; // 漸層字
  if (/(^|[\s,>])(#splash|\.sp-|#sp-|body\.sp-|\.swatch|\.q-|#stage|canvas)/.test(sel)) return all; // 開場另有規則；色票、品質色、畫布不動
  const decls = splitDecl(body).map((d) => {
    const i = d.indexOf(':'); if (i < 0) return d;
    const prop = d.slice(0, i).trim(), val = d.slice(i + 1);
    if (/url\(/.test(val) && !/gradient/.test(val)) return d;
    if (/^background(-color|-image)?$/.test(prop)) return prop + ':' + mapColors(val, lightBg);
    if (/^(border(-top|-right|-bottom|-left)?(-color)?|outline(-color)?)$/.test(prop)) return prop + ':' + mapColors(val, lightLine);
    if (prop === 'box-shadow') return prop + ':' + mapColors(val, lightLine);
    if (prop === 'color' || prop === '-webkit-text-fill-color') return prop + ':' + mapColors(val, darkText);
    if (prop === 'text-shadow') return prop + ':' + mapColors(val, lightShadowToDark);
    return d;
  });
  return sel + '{' + decls.join(';') + '}';
});
lines[0] = css;
writeFileSync(file, lines.join('\n'));
console.log(stats);
