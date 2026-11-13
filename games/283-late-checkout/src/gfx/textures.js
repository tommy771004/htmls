// 程序貼圖：全部用 Canvas 2D 畫出來，另外由高度圖算法線。沒有任何外部圖檔。
import * as THREE from 'three';

function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// 可平鋪的 fbm 雜訊（值域約 0..1）
export function fbm(size, cells, seed, oct = 4) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const n = cells << o, r = rng(seed + o * 131), lat = new Float32Array(n * n); for (let i = 0; i < n * n; i++) lat[i] = r();
    const sc = n / size;
    for (let y = 0; y < size; y++) {
      const fy = y * sc, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty), ya = (y0 % n) * n, yb = ((y0 + 1) % n) * n;
      for (let x = 0; x < size; x++) {
        const fx = x * sc, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx), xa = x0 % n, xb = (x0 + 1) % n;
        const a = lat[ya + xa], b = lat[ya + xb], c = lat[yb + xa], d = lat[yb + xb];
        out[y * size + x] += (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * amp;
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function tex(c, srgb, rep = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// 高度（Float32Array 0..1）→ 法線貼圖
function normalMap(hgt, size, strength) {
  const c = canvas(size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = hgt[y * size + ((x + size - 1) % size)], r = hgt[y * size + ((x + 1) % size)], u = hgt[((y + size - 1) % size) * size + x], dn = hgt[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1; const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
    const i = (y * size + x) * 4; d[i] = nx * 127 + 128; d[i + 1] = -ny * 127 + 128; d[i + 2] = nz * 127 + 128; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return tex(c, false);
}
// 用函式逐像素寫入：fn(x, y, i) → [r,g,b]（0..255），同時可回寫 height / rough
function paint(size, fn) {
  const c = canvas(size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  const hgt = new Float32Array(size * size), rgh = new Float32Array(size * size).fill(0.8), o = [0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x; fn(x, y, i, o, hgt, rgh);
    d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0); return { c, hgt, rgh, size };
}
function roughMap(rgh, size) {
  const c = canvas(size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  for (let i = 0; i < size * size; i++) { const v = Math.max(0, Math.min(255, rgh[i] * 255)); d[i * 4] = 255; d[i * 4 + 1] = v; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return tex(c, false);
}
const mixc = (a, b, t, o) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; };
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeTextures() {
  const T = {}; const S = 512;
  const n1 = fbm(S, 4, 11), n2 = fbm(S, 16, 23), n3 = fbm(S, 64, 37, 3), n4 = fbm(S, 2, 51, 5);

  { // 大理石棋盤：2×2 格，每張貼圖 = 1.8 m
    const p = paint(S, (x, y, i, o, h, r) => {
      const tx = x / (S / 2), ty = y / (S / 2), cx = tx | 0, cy = ty | 0, fx = tx - cx, fy = ty - cy, dark = (cx + cy) & 1;
      const w = n1[i] * 5 + n2[i] * 1.2, vv = Math.abs(Math.sin((x / S * 3 + y / S * 2 + w) * Math.PI)), w2 = Math.abs(Math.sin((x / S * 5 - y / S * 4 + n4[i] * 9) * Math.PI));
      const v2 = (1 - sm(0.0, 0.07, vv)) * 0.9 + (1 - sm(0.0, 0.04, w2)) * 0.5 + (n1[i] - 0.5) * 0.5;
      if (dark) mixc([24, 36, 31], [110, 132, 118], v2 * 0.75, o); else mixc([208, 196, 170], [128, 112, 92], v2 * 0.6, o);
      const k = 0.86 + n3[i] * 0.28; o[0] *= k; o[1] *= k; o[2] *= k;
      const e = Math.min(fx, fy, 1 - fx, 1 - fy), grout = 1 - sm(0.004, 0.012, e);
      h[i] = 1 - grout; r[i] = 0.16 + n4[i] * 0.3 + grout * 0.5 + sm(0.55, 0.8, n2[i]) * 0.2;
      if (grout > 0.5) { o[0] = 38; o[1] = 34; o[2] = 28; }
      const dirt = sm(0.5, 0.75, n4[i]) * 0.3; o[0] *= 1 - dirt; o[1] *= 1 - dirt; o[2] *= 1 - dirt * 1.1;
    });
    T.marble = { map: tex(p.c, true), normalMap: normalMap(p.hgt, S, 2.0), roughnessMap: roughMap(p.rgh, S), scale: 1.8 };
  }
  { // 客房地毯：酒紅底、金色扇紋
    const p = paint(S, (x, y, i, o, h) => {
      const u = x / S * 4, v = y / S * 4, cu = u | 0, cv = v | 0; let fu = u - cu - 0.5, fv = v - cv; if (cv & 1) { fu = ((u + 0.5) % 1) - 0.5; }
      const d = Math.hypot(fu, fv), ring = Math.abs(((d * 5) % 1) - 0.5), fan = d < 0.52 && fv > 0 ? 1 - sm(0.06, 0.16, ring) : 0;
      const fib = n3[i];
      mixc([78, 20, 28], [150, 112, 54], fan * 0.75, o);
      const k = 0.7 + fib * 0.6 - sm(0.5, 0.8, n4[i]) * 0.35; o[0] *= k; o[1] *= k; o[2] *= k; h[i] = fib * 0.6 + fan * 0.3;
    });
    T.carpet = { map: tex(p.c, true), normalMap: normalMap(p.hgt, S, 1.2), scale: 1.6, rough: 1 };
  }
  { // 走廊地毯：墨綠底、米金菱格
    const p = paint(S, (x, y, i, o, h) => {
      const u = x / S * 4, v = y / S * 4, a = Math.abs(((u + v) % 1) - 0.5), b = Math.abs(((u - v + 8) % 1) - 0.5);
      const line = 1 - sm(0.02, 0.07, Math.min(a, b)), dot = 1 - sm(0.05, 0.1, Math.hypot(((u + 0.5) % 1) - 0.5, ((v + 0) % 1) - 0.5));
      mixc([24, 50, 44], [176, 150, 96], Math.max(line * 0.8, dot * 0.9), o);
      const k = 0.7 + n3[i] * 0.6 - sm(0.45, 0.8, n4[i]) * 0.4; o[0] *= k; o[1] *= k; o[2] *= k; h[i] = n3[i] * 0.6 + line * 0.25;
    });
    T.runner = { map: tex(p.c, true), normalMap: normalMap(p.hgt, S, 1.2), scale: 1.5, rough: 1 };
  }
  { // 木地板：長條拼
    const r = rng(7), rows = 12, offs = [], tint = [];
    for (let i = 0; i < rows; i++) { offs.push(r()); tint.push([]); for (let j = 0; j < 4; j++) tint[i].push(0.75 + r() * 0.45); }
    const p = paint(S, (x, y, i, o, h, rg) => {
      const row = (y / S * rows) | 0, fy = y / S * rows - row, u = (x / S + offs[row]) * 3, seg = (u | 0) % 3, fu = u - (u | 0);
      const grain = Math.sin((x / S * 40 + n2[i] * 6 + row * 3.1) * 1.2 + n1[i] * 10) * 0.5 + 0.5;
      const t = tint[row][seg]; mixc([70, 44, 26], [112, 76, 46], grain * 0.55, o); o[0] *= t; o[1] *= t; o[2] *= t;
      const gap = Math.min(fy, 1 - fy) < 0.035 || Math.min(fu, 1 - fu) < 0.006;
      h[i] = gap ? 0 : 0.8 + grain * 0.2; if (gap) { o[0] *= 0.3; o[1] *= 0.3; o[2] *= 0.3; }
      const wear = sm(0.45, 0.75, n4[i]); o[0] *= 1 - wear * 0.25; o[1] *= 1 - wear * 0.25; o[2] *= 1 - wear * 0.2;
      rg[i] = 0.32 + wear * 0.4 + (gap ? 0.4 : 0) + n3[i] * 0.12;
    });
    T.wood = { map: tex(p.c, true), normalMap: normalMap(p.hgt, S, 1.6), roughnessMap: roughMap(p.rgh, S), scale: 1.7 };
  }
  // 壁紙：base 色、花樣色、花樣函式
  const paper = (base, ink, pat, seed, stain) => {
    const m1 = fbm(S, 3, seed, 5), m2 = fbm(S, 32, seed + 5, 3);
    const p = paint(S, (x, y, i, o, h) => {
      const k = pat(x / S, y / S); mixc(base, ink, k, o);
      const st = sm(0.52, 0.8, m1[i]) * stain, drip = sm(0.6, 0.9, m1[(i + 97 * S) % (S * S)]) * sm(0.3, 0.9, n2[(x + ((y * 0.07) | 0) * S) % (S * S)]) * stain;
      const d = 1 - st * 0.55 - drip * 0.35; o[0] *= d; o[1] *= d * 0.97; o[2] *= d * 0.9;
      const f = 0.92 + m2[i] * 0.16; o[0] *= f; o[1] *= f; o[2] *= f; h[i] = m2[i] * 0.4 + k * 0.3;
    });
    return { map: tex(p.c, true), normalMap: normalMap(p.hgt, S, 0.6), scale: 1.2, rough: 0.9 };
  };
  const damask = (u, v) => { // 重複的尖拱花樣
    const cu = (u * 4) % 1, cv = (v * 4 + (((u * 4) | 0) & 1) * 0.5) % 1, a = Math.abs(cu - 0.5) * 2, b = Math.abs(cv - 0.5) * 2;
    const leaf = Math.pow(a, 1.6) + Math.pow(b, 0.9), inner = Math.pow(a * 2.4, 2) + Math.pow(b * 1.6, 2);
    return (leaf < 0.75 && leaf > 0.55 ? 1 : 0) * 0.7 + (inner < 0.5 ? 0.5 : 0);
  };
  T.paperA = paper([176, 168, 134], [136, 142, 108], (u, v) => { const s = Math.abs(((u * 8) % 1) - 0.5) < 0.07 ? 0.8 : 0; const d = Math.hypot(((u * 8 + 0.5) % 1) - 0.5, ((v * 8) % 1) - 0.5) < 0.12 ? 0.9 : 0; return Math.max(s, d); }, 101, 1.0);
  T.paperB = paper([92, 40, 34], [120, 58, 44], damask, 202, 0.9);
  T.paperC = paper([196, 184, 152], [168, 138, 84], (u) => (Math.abs(((u * 10) % 1) - 0.5) < 0.04 ? 0.9 : Math.abs(((u * 10 + 0.5) % 1) - 0.5) < 0.012 ? 0.5 : 0), 303, 0.7);
  { // 灰泥天花板：裂紋與水漬
    const c = canvas(S), g = c.getContext('2d'), r = rng(99);
    g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.strokeStyle = '#000'; g.lineWidth = 1.2;
    for (let k = 0; k < 9; k++) { let x = r() * S, y = r() * S, a = r() * 6.28; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 40; s++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); if (r() < 0.06) { g.stroke(); g.beginPath(); g.moveTo(x, y); a += (r() - 0.5) * 2; } } g.stroke(); }
    const cr = g.getImageData(0, 0, S, S).data;
    const p = paint(S, (x, y, i, o, h) => {
      const crack = 1 - cr[i * 4] / 255, ring = n1[i], st = sm(0.6, 0.66, ring) * (1 - sm(0.66, 0.9, ring)) * 0.35 + sm(0.66, 0.95, ring) * 0.22;
      mixc([186, 180, 164], [120, 96, 62], st, o); const k = (0.9 + n3[i] * 0.2) * (1 - crack * 0.7); o[0] *= k; o[1] *= k; o[2] *= k; h[i] = 1 - crack + n3[i] * 0.25;
    });
    T.plaster = { map: tex(p.c, true), normalMap: normalMap(p.hgt, S, 1.4), scale: 2.4, rough: 0.92 };
  }
  { // 護牆板：一格凸板（u 0..1 = 0.9 m，v 0..1 = 板高）
    const p = paint(S, (x, y, i, o, h, rg) => {
      const u = x / S, v = y / S, e = Math.min(u, 1 - u, v, 1 - v), bev = sm(0.06, 0.1, e) - sm(0.13, 0.17, e) + sm(0.2, 0.26, e);
      const grain = Math.sin((u * 3 + n2[i] * 1.5 + v * 60) * 1.0 + n1[i] * 8) * 0.5 + 0.5;
      mixc([54, 28, 18], [92, 52, 30], grain * 0.5 + (bev - 0.5) * 0.15, o); h[i] = bev;
      const w = sm(0.5, 0.8, n4[i]); o[0] *= 1 - w * 0.3; o[1] *= 1 - w * 0.3; o[2] *= 1 - w * 0.3; rg[i] = 0.34 + w * 0.3 + n3[i] * 0.1;
    });
    T.panel = { map: tex(p.c, true), normalMap: normalMap(p.hgt, S, 3.0), roughnessMap: roughMap(p.rgh, S), scale: 1 };
  }
  { // 家具木紋（白底，靠頂點色上色）
    const p = paint(256, (x, y, i, o, h, rg) => {
      const j = (y * 2) * S + x * 2, grain = Math.sin((y / 256 * 26 + n1[j] * 9) * 2.2 + n2[j] * 3) * 0.5 + 0.5, v = 188 + grain * 42 + n3[j] * 22;
      o[0] = o[1] = o[2] = Math.min(255, v); h[i] = grain; rg[i] = 0.38 + grain * 0.15 + n4[j] * 0.25;
    });
    T.woodF = { map: tex(p.c, true), normalMap: normalMap(p.hgt, 256, 0.9), roughnessMap: roughMap(p.rgh, 256), scale: 0.9 };
  }
  { // 布料（白底）
    const p = paint(256, (x, y, i, o, h) => {
      const w = (Math.sin(x * 1.57) * 0.5 + 0.5) * (Math.sin(y * 1.57) * 0.5 + 0.5), j = (y * 2) * S + x * 2, v = 190 + w * 40 + n3[j] * 30 - sm(0.5, 0.8, n4[j]) * 50;
      o[0] = o[1] = o[2] = v; h[i] = w * 0.7 + n3[j] * 0.3;
    });
    T.fabric = { map: tex(p.c, true), normalMap: normalMap(p.hgt, 256, 1.0), scale: 0.5, rough: 0.95 };
  }
  { // 槍的金屬：細顆粒的磷化表面＋零星刮痕（刮痕處較亮、較光滑）
    const Z = 256, r = rng(771), n = fbm(Z, 32, 91, 3), big = fbm(Z, 4, 92, 3), h = new Float32Array(Z * Z), rg = new Float32Array(Z * Z);
    for (let i = 0; i < Z * Z; i++) { h[i] = n[i] * 0.45 + r() * 0.3; rg[i] = 0.4 + big[i] * 0.22 + (r() - 0.5) * 0.06; }
    for (let k = 0; k < 34; k++) { let x = r() * Z, y = r() * Z; const a = (r() - 0.5) * 0.7 + (r() < 0.25 ? 1.57 : 0), dx = Math.cos(a), dy = Math.sin(a), len = 14 + r() * 80, dp = 0.25 + r() * 0.45;
      for (let t = 0; t < len; t++) { const i = ((y | 0) & (Z - 1)) * Z + ((x | 0) & (Z - 1)); h[i] -= dp; rg[i] -= 0.16; x += dx; y += dy; } }
    T.gunMetal = { normalMap: normalMap(h, Z, 0.9), roughnessMap: roughMap(rg, Z) };
  }
  { // 槍的聚合物：交錯排列的小凸點（握把、槍托的止滑紋）
    const Z = 128, h = new Float32Array(Z * Z), rg = new Float32Array(Z * Z), r = rng(772);
    for (let y = 0; y < Z; y++) for (let x = 0; x < Z; x++) { const xx = (x + ((y >> 2) & 1) * 2) % 4 - 1.5, yy = y % 4 - 1.5, d = Math.hypot(xx, yy); h[y * Z + x] = Math.max(0, 1 - d / 1.9) * 0.8 + r() * 0.12; rg[y * Z + x] = 0.62 + r() * 0.1; }
    T.gunPoly = { normalMap: normalMap(h, Z, 1.1), roughnessMap: roughMap(rg, Z) };
  }
  { // 衣服：大皺褶（脊狀雜訊）＋細織紋；底色只做明暗變化（髒污、磨白），顏色由頂點色決定
    const Z = 256, f1 = fbm(Z, 3, 311, 3), f2 = fbm(Z, 7, 312, 3), dirt = fbm(Z, 5, 313, 4), r = rng(773), h = new Float32Array(Z * Z);
    const p = paint(Z, (x, y, i, o) => {
      const rd1 = 1 - Math.abs(2 * f1[i] - 1), rd2 = 1 - Math.abs(2 * f2[i] - 1), w = (Math.sin(x * 1.57) * 0.5 + 0.5) * (Math.sin(y * 1.57) * 0.5 + 0.5);
      h[i] = rd1 * rd1 * 0.75 + rd2 * rd2 * 0.3 + w * 0.05;
      const v = 236 + (rd1 * rd1 - 0.4) * 20 - sm(0.55, 0.85, dirt[i]) * 34 + (r() - 0.5) * 10; o[0] = o[1] = o[2] = Math.max(60, Math.min(255, v));
    });
    T.cloth = { map: tex(p.c, true), normalMap: normalMap(h, Z, 2.4) };
  }
  { // 門板：兩格凹板（整張 = 一扇門）
    const p = paint(256, (x, y, i, o, h, rg) => {
      const u = x / 256, v = y / 256, j = (y * 2) * S + x * 2;
      const pan = (v0, v1) => { const e = Math.min(u - 0.14, 0.86 - u, v - v0, v1 - v); return sm(0, 0.03, e) - sm(0.04, 0.07, e) * 0.6; };
      const b = Math.max(pan(0.06, 0.42), pan(0.5, 0.93)), grain = Math.sin((u * 30 + n1[j] * 6) * 2) * 0.5 + 0.5;
      mixc([64, 34, 22], [98, 58, 34], grain * 0.5, o); const k = 1 - b * 0.25 - sm(0.5, 0.8, n4[j]) * 0.25; o[0] *= k; o[1] *= k; o[2] *= k; h[i] = 1 - b; rg[i] = 0.4 + n3[j] * 0.2;
    });
    T.door = { map: tex(p.c, true), normalMap: normalMap(p.hgt, 256, 2.4), roughnessMap: roughMap(p.rgh, 256), scale: 1 };
  }
  { // 地毯（整張一塊，四周流蘇透明）
    const c = canvas(512, 384), g = c.getContext('2d');
    g.fillStyle = '#4a141b'; g.fillRect(10, 10, 492, 364);
    g.strokeStyle = '#b8935a'; g.lineWidth = 6; g.strokeRect(26, 26, 460, 332); g.lineWidth = 2; g.strokeRect(40, 40, 432, 304);
    g.fillStyle = '#1d3a36'; g.fillRect(54, 54, 404, 276);
    g.strokeStyle = '#c7a368'; g.fillStyle = '#7a2a2a';
    g.save(); g.translate(256, 192);
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(0, 0, 150 - k * 34, 100 - k * 22, 0, 0, 6.3); g.fillStyle = ['#7a2a2a', '#1d3a36', '#a5803f', '#4a141b'][k]; g.fill(); g.stroke(); }
    for (let k = 0; k < 16; k++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(14, 60, 0, 96); g.quadraticCurveTo(-14, 60, 0, 30); g.stroke(); }
    g.restore();
    for (const [x, y] of [[90, 90], [422, 90], [90, 294], [422, 294]]) { g.beginPath(); g.arc(x, y, 22, 0, 6.3); g.fillStyle = '#7a2a2a'; g.fill(); g.stroke(); }
    const im = g.getImageData(0, 0, 512, 384), d = im.data, r = rng(5);
    for (let y = 0; y < 384; y++) for (let x = 0; x < 512; x++) { const i = (y * 512 + x) * 4, f = 0.34 + r() * 0.26 - sm(0.5, 0.8, n4[(y % S) * S + (x % S)]) * 0.35; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; if (d[i + 3] === 0 && (x < 10 || x > 501) && (y % 4 < 2) && y > 10 && y < 374) { d[i] = 150; d[i + 1] = 120; d[i + 2] = 80; d[i + 3] = 255; } }
    g.putImageData(im, 0, 0);
    T.rug = { map: tex(c, true, false), rough: 1 };
  }
  { // 掛畫圖集 4×2
    const c = canvas(512, 256), g = c.getContext('2d'), r = rng(321);
    for (let k = 0; k < 8; k++) {
      const x0 = (k % 4) * 128, y0 = (k >> 2) * 128; g.save(); g.beginPath(); g.rect(x0, y0, 128, 128); g.clip(); g.translate(x0, y0);
      const sky = g.createLinearGradient(0, 0, 0, 128); const hue = [28, 200, 36, 150, 12, 210, 44, 180][k];
      sky.addColorStop(0, `hsl(${hue},32%,${30 + r() * 20}%)`); sky.addColorStop(1, `hsl(${hue + 20},40%,${14 + r() * 10}%)`); g.fillStyle = sky; g.fillRect(0, 0, 128, 128);
      if (k % 3 === 0) { for (let m = 0; m < 4; m++) { g.fillStyle = `hsl(${hue + 30},${20 + m * 6}%,${10 + m * 6}%)`; g.beginPath(); g.moveTo(0, 128); let y = 50 + m * 18; for (let x = 0; x <= 128; x += 8) { y += (r() - 0.5) * 14; g.lineTo(x, y); } g.lineTo(128, 128); g.fill(); } g.fillStyle = '#e8d8a8'; g.beginPath(); g.arc(90, 30, 9, 0, 6.3); g.fill(); }
      else if (k % 3 === 1) { g.fillStyle = `hsl(${hue + 150},25%,16%)`; g.beginPath(); g.ellipse(64, 58, 26, 34, 0, 0, 6.3); g.fill(); g.fillRect(34, 86, 60, 42); g.fillStyle = `hsl(${hue + 20},30%,52%)`; g.beginPath(); g.ellipse(64, 48, 13, 16, 0, 0, 6.3); g.fill(); }
      else { for (let m = 0; m < 9; m++) { g.fillStyle = `hsl(${hue + r() * 80},${30 + r() * 30}%,${20 + r() * 40}%)`; g.beginPath(); g.ellipse(r() * 128, r() * 128, 8 + r() * 26, 6 + r() * 20, r() * 3, 0, 6.3); g.fill(); } }
      g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(0, 0, 128, 128); g.restore();
    }
    T.art = { map: tex(c, true, false), rough: 0.6 };
  }
  { // 地上的紙張、碎屑（alpha）
    const c = canvas(256), g = c.getContext('2d'), r = rng(808);
    for (let k = 0; k < 4; k++) {
      const x0 = (k % 2) * 128, y0 = (k >> 1) * 128; g.save(); g.translate(x0 + 64, y0 + 64);
      if (k < 2) for (let m = 0; m < 3 + k; m++) { g.save(); g.rotate(r() * 6.28); g.translate((r() - 0.5) * 50, (r() - 0.5) * 50); g.fillStyle = `rgba(${200 + r() * 30},${195 + r() * 25},${170 + r() * 30},0.95)`; g.fillRect(-16, -22, 32, 44); g.fillStyle = 'rgba(60,50,40,0.5)'; for (let l = 0; l < 7; l++) g.fillRect(-12, -17 + l * 5, 10 + r() * 14, 1.4); g.restore(); }
      else if (k === 2) for (let m = 0; m < 46; m++) { g.fillStyle = `rgba(${150 + r() * 60},${140 + r() * 50},${120 + r() * 40},${0.6 + r() * 0.4})`; g.beginPath(); const a = r() * 6.28, d = Math.pow(r(), 0.7) * 54; g.ellipse(Math.cos(a) * d, Math.sin(a) * d, 1 + r() * 5, 1 + r() * 3, r() * 3, 0, 6.3); g.fill(); }
      else { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 58); gr.addColorStop(0, 'rgba(20,12,6,0.75)'); gr.addColorStop(0.7, 'rgba(24,14,8,0.45)'); gr.addColorStop(1, 'rgba(20,12,6,0)'); g.fillStyle = gr; g.beginPath(); for (let a = 0; a < 6.3; a += 0.3) { const d = 40 + r() * 18; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.fill(); }
      g.restore();
    }
    T.debris = { map: tex(c, true, false), rough: 0.9 };
  }
  { // 窗玻璃：髒污與雨痕（alpha）
    const c = canvas(256), g = c.getContext('2d'), im = g.createImageData(256, 256), d = im.data, r = rng(41);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const j = (y * 2) * S + x * 2, i = (y * 256 + x) * 4, a = 0.1 + sm(0.4, 0.8, n1[j]) * 0.3 + n3[j] * 0.08; d[i] = 150; d[i + 1] = 165; d[i + 2] = 180; d[i + 3] = a * 255; }
    g.putImageData(im, 0, 0); g.strokeStyle = 'rgba(200,215,235,0.3)'; g.lineWidth = 1;
    for (let k = 0; k < 70; k++) { let x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); const L = 10 + r() * 60; for (let s = 0; s < L; s += 4) { x += (r() - 0.5) * 1.6; y += 4; g.lineTo(x, y); } g.stroke(); }
    T.glass = { map: tex(c, true) };
  }
  // ---- 特效用 ----
  const radial = (size, stops) => { const c = canvas(size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); for (const [t, col] of stops) gr.addColorStop(t, col); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; };
  T.blob = tex(radial(64, [[0, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]), false, false);
  T.soft = tex(radial(64, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]), false, false);
  { // 彈孔
    const c = canvas(64), g = c.getContext('2d'), r = rng(64);
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.2, 'rgba(6,5,4,0.95)'); gr.addColorStop(0.42, 'rgba(20,16,12,0.5)'); gr.addColorStop(1, 'rgba(20,16,12,0)');
    g.fillStyle = gr; g.beginPath(); for (let a = 0; a < 6.3; a += 0.35) { const d = 20 + r() * 11; g.lineTo(32 + Math.cos(a) * d, 32 + Math.sin(a) * d); } g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.8; for (let k = 0; k < 6; k++) { const a = r() * 6.28; g.beginPath(); g.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6); g.lineTo(32 + Math.cos(a + 0.2) * (16 + r() * 12), 32 + Math.sin(a + 0.2) * (16 + r() * 12)); g.stroke(); }
    T.hole = tex(c, false, false);
  }
  { // 槍口火光（星芒）
    const c = canvas(128), g = c.getContext('2d'), r = rng(12); g.translate(64, 64);
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + r() * 0.5, L = 34 + r() * 28, gr = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); gr.addColorStop(0, 'rgba(255,240,200,0.95)'); gr.addColorStop(0.5, 'rgba(255,170,70,0.6)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.22) * L * 0.5, Math.sin(a - 0.22) * L * 0.5); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 0.22) * L * 0.5, Math.sin(a + 0.22) * L * 0.5); g.fill(); }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 26); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
    T.flash = tex(c, true, false);
  }
  { // 煙塵
    const c = canvas(64), g = c.getContext('2d'), im = g.createImageData(64, 64), d = im.data;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4, r2 = Math.hypot(x - 32, y - 32) / 32, a = Math.max(0, 1 - r2) * (0.45 + n2[(y * 8) * S + x * 8] * 0.9); d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * a * 255); }
    g.putImageData(im, 0, 0); T.smoke = tex(c, false, false);
  }
  return T;
}

// 文字牌（房號、招牌）
export function textTexture(text, o = {}) {
  const w = o.w || 256, h = o.h || 64, c = canvas(w, h), g = c.getContext('2d');
  if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); }
  g.font = `${o.weight || 600} ${o.size || 40}px ${o.font || 'Didot, "Bodoni 72", Georgia, serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (o.spacing) g.letterSpacing = o.spacing;
  g.fillStyle = o.color || '#fff'; g.fillText(text, w / 2, h / 2 + (o.dy || 0));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
