// 外緣山林（blender/forest.py）的葉片貼圖：Poly Haven 的 CC0 葉片圖（.cache/tex-src/ph/，JPG 沒有透明，遮罩是另外的 PNG）合成帶 alpha 的 PNG，
// 楓葉叢沒有現成的照片，用 SVG 畫（五裂掌狀葉、葉脈、從橘黃到深紅的漸層，每片色調不同）。輸出到 gitignore 的 .cache/forest/，
// forest.py 載入後匯出 .cache/props/forest_src.glb，再由 tools/props.mjs 的 nat_forest 組壓成 assets/260/props/nat_forest.glb。借 197 的 sharp。
//   node tools/forest-tex.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(resolve(root, '../197-openworld/package.json'))('sharp');
const PH = resolve(root, '.cache/tex-src/ph'), OUT = resolve(root, '.cache/forest'), S = 1024;
mkdirSync(OUT, { recursive: true });

// 底色 JPG ＋ 遮罩 PNG → RGBA PNG（遮罩外的顏色保留：mipmap 平均時邊緣才不會帶進黑邊）
async function rgba(diff, alpha, out) {
  const c = await sharp(diff).resize(S, S).removeAlpha().raw().toBuffer(), a = await sharp(alpha).resize(S, S).greyscale().raw().toBuffer();
  const o = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i++) { o[i * 4] = c[i * 3]; o[i * 4 + 1] = c[i * 3 + 1]; o[i * 4 + 2] = c[i * 3 + 2]; o[i * 4 + 3] = a[i]; }
  await sharp(o, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(OUT, out));
  console.log(out);
}
await rgba(`${PH}/fir_tree_01/textures/fir_tree_01_twig_diff_1k.jpg`, `${PH}/fir_tree_01/fir_tree_01_twig_alpha_1k.png`, 'fir_twig.png');
await rgba(`${PH}/pine_tree_01/textures/pine_tree_01_twig_diff_1k.jpg`, `${PH}/pine_tree_01/pine_tree_01_twig_alpha_1k.png`, 'pine_twig.png');
await rgba(`${PH}/fern_02/textures/fern_02_diff_1k.jpg`, `${PH}/fern_02/fern_02_alpha_1k.png`, 'fern.png');
await rgba(`${PH}/periwinkle_plant/textures/periwinkle_plant_diff_1k.jpg`, `${PH}/periwinkle_plant/periwinkle_plant_opacity_1k.png`, 'periwinkle.png');
await rgba(`${PH}/grass_medium_01/textures/grass_medium_01_diff_1k.jpg`, `${PH}/grass_medium_01/grass_medium_01_alpha_1k.png`, 'grass.png');

// ─── 冷杉的整段枝條卡：照片裡一枝枝的小枝太稀（一張卡只遮得住一成），把四枝大的與三枝小的剪下來，沿一根主枝左右交錯貼二十幾枝
// （下段大、往梢越來越小，越裡層越暗），合成一張 1024² 的卡：枝的基部在下緣中點、梢在上緣。forest.py 每根枝貼兩張成 V 字 ───
const FIR_CUT = [[.31, .645, .39, .77], [.635, .957, .45, .83], [.19, .42, .04, .31], [.655, .94, .04, .37], [270 / 512, 300 / 512, 50 / 512, 115 / 512], [200 / 512, 235 / 512, 148 / 512, 195 / 512], [255 / 512, 320 / 512, 130 / 512, 205 / 512]];
{
  const src = resolve(OUT, 'fir_twig.png'), cuts = [];
  for (const [u0, u1, v0, v1] of FIR_CUT) {
    const left = Math.round(u0 * S), top = Math.round(v0 * S), width = Math.round((u1 - u0) * S), height = Math.round((v1 - v0) * S);
    const px = await sharp(src).extract({ left, top, width, height }).raw().toBuffer();
    if (cuts.length === 1) for (let y = Math.floor(height * .68); y < height; y++) for (let x = Math.floor(width * .7); x < width; x++) px[(y * width + x) * 4 + 3] = 0;   // 第二枝的右下角是圖上那根長枝
    cuts.push({ buf: await sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer(), w: width, h: height });
  }
  let s2 = 21; const r2 = () => ((s2 = Math.imul(s2 ^ (s2 >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const layers = [];
  // 小枝：沿主枝 t（0 基部 → 1 梢），左右交錯斜出；size 是小枝長（px）
  const twig = async (t, side, ang, size, dark) => {
    const c = cuts[size < 260 ? 4 + Math.floor(r2() * 3) : Math.floor(r2() * 4)], k = size / c.h;
    let img = sharp(c.buf).resize(Math.max(8, Math.round(c.w * k)), Math.max(8, Math.round(c.h * k)));
    img = img.modulate({ brightness: (dark || 1) * .34, saturation: .8, hue: 14 });   // 照片的枝葉在遊戲的日光下偏亮偏黃：壓暗、往藍綠偏一點（冷杉是深的藍綠）
    const deg = side * ang;   // 小枝原圖梢朝上；轉 deg 度（正＝順時針，往右）
    const rb = await img.rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), m = await sharp(rb).metadata();
    // 小枝基部（原圖下緣中點）轉過之後落在：中心 + 旋轉(0, h/2)
    const a = deg * Math.PI / 180, bx = -Math.sin(a) * size / 2, by = Math.cos(a) * size / 2;
    const px = 512 + (r2() - .5) * 10, py = 1000 - t * 940;
    layers.push({ input: rb, left: Math.round(px - bx - m.width / 2), top: Math.round(py - by - m.height / 2) });
  };
  for (let i = 0; i < 26; i++) { const t = .03 + .9 * i / 26; await twig(t, i % 2 ? 1 : -1, 38 + r2() * 22, 470 - 260 * t + r2() * 40, .62 + .2 * r2()); }   // 底層：暗、大
  for (let i = 0; i < 18; i++) { const t = .08 + .85 * i / 18; await twig(t, i % 2 ? -1 : 1, 28 + r2() * 26, 380 - 200 * t + r2() * 40, .85 + .15 * r2()); }
  await twig(.9, 1, (r2() - .5) * 10, 260, 1);   // 梢
  const raw = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([...layers.map(l => ({ ...l, left: Math.max(-2000, l.left), top: Math.max(-2000, l.top) }))]).raw().toBuffer();
  for (let i = 0; i < S * S; i++) if (raw[i * 4 + 3] < 8) { raw[i * 4] = 52; raw[i * 4 + 1] = 66; raw[i * 4 + 2] = 38; }
  await sharp(raw, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(OUT, 'fir_branch.png'));
  console.log('fir_branch.png');
}

// ─── 楓葉叢：一張 1024² 的卡，葉柄從下緣中間長出來，十幾片葉子散成一叢（卡的下緣中點是枝的位置） ───
let seed = 7;
const rr = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
// 掌狀五裂：五個裂片（上、左右上、左右下）各一個高斯峰，葉緣鋸齒；角度 0 朝上
function leafPath(sz) {
  const lobes = [[0, 1], [.85, .86], [-.85, .86], [1.75, .5], [-1.75, .5]], pts = [];
  for (let i = 0; i < 160; i++) {
    const th = -Math.PI + i / 160 * Math.PI * 2;
    let r = .2; for (const [a, L] of lobes) r = Math.max(r, .22 + L * .78 * Math.exp(-(((th - a) / .3) ** 2)));
    r *= 1 - .05 * Math.abs(Math.sin(th * 26));   // 鋸齒
    if (Math.abs(th) > 2.85) r = Math.min(r, .12);   // 葉柄那一端
    pts.push([Math.sin(th) * r * sz, -Math.cos(th) * r * sz]);
  }
  return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';
}
const PAL = [['#f4b23a', '#d9531e'], ['#f08a24', '#c22a18'], ['#e8641c', '#a8180f'], ['#d8401a', '#7e130c'], ['#f6c548', '#e2741f'], ['#c9321a', '#6c1009']];
let defs = '', body = '';
const leaves = [];
for (let k = 0; k < 34; k++) {
  const a = (rr() - .5) * 2.6, d = 150 + rr() * 330, x = 512 + Math.sin(a) * d, y = 1000 - Math.cos(a) * d * 1.05, sz = 78 + rr() * 52;
  leaves.push({ x, y, sz, rot: a * 57 + (rr() - .5) * 40, p: PAL[Math.floor(rr() * PAL.length)], a });
}
leaves.sort((p, q) => q.y - p.y);   // 下面的先畫（上面的葉子蓋在上面）
leaves.forEach((L, k) => {
  defs += `<radialGradient id="g${k}" cx="50%" cy="85%" r="85%"><stop offset="0" stop-color="${L.p[0]}"/><stop offset="1" stop-color="${L.p[1]}"/></radialGradient>`;
  body += `<path d="M512,1024 Q${(512 + L.x) / 2 + (rr() - .5) * 60},${(1024 + L.y) / 2} ${L.x.toFixed(0)},${L.y.toFixed(0)}" stroke="#5a2a12" stroke-width="5" fill="none"/>`;   // 葉柄
  body += `<g transform="translate(${L.x.toFixed(1)},${L.y.toFixed(1)}) rotate(${L.rot.toFixed(1)})"><path d="${leafPath(L.sz)}" fill="url(#g${k})" stroke="#4a1a0a" stroke-opacity=".35" stroke-width="2"/>`;
  for (const [th, l] of [[0, 1], [.85, .8], [-.85, .8], [1.75, .45], [-1.75, .45]]) body += `<line x1="0" y1="0" x2="${(Math.sin(th) * l * L.sz * .9).toFixed(1)}" y2="${(-Math.cos(th) * l * L.sz * .9).toFixed(1)}" stroke="#ffd9a0" stroke-opacity=".45" stroke-width="2.5"/>`;
  body += '</g>';
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${defs}</defs>${body}</svg>`;
// 透明處填上葉子的平均色（mipmap 不帶黑邊）：先畫一張底色，再用 SVG 的 alpha
const leafRGBA = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
for (let i = 0; i < S * S; i++) if (leafRGBA[i * 4 + 3] < 8) { leafRGBA[i * 4] = 190; leafRGBA[i * 4 + 1] = 70; leafRGBA[i * 4 + 2] = 28; }
await sharp(leafRGBA, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(OUT, 'maple_leaves.png'));
console.log('maple_leaves.png');

// ─── 林下的野花叢（卡的下緣是地面）：三十幾根細莖、對生的小葉、紫色系的五瓣花（紫菀、桔梗色）與幾支穗狀的紫花（魯冰花那樣），中間夾幾片草葉 ───
{
  let s3 = 33; const r3 = () => ((s3 = Math.imul(s3 ^ (s3 >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const FL = ['#7b4bc4', '#9a5fd6', '#6a3fb0', '#b48ae8', '#8e44ad', '#c79be0'];
  let body = '';
  for (let k = 0; k < 46; k++) {   // 草葉：從底部彎出去
    const x = 512 + (r3() - .5) * 760, h = 260 + r3() * 420, b = (r3() - .5) * 260, w = 5 + r3() * 7;
    body += `<path d="M${x - w},1024 Q${x + b * .4},${1024 - h * .6} ${x + b},${1024 - h} Q${x + b * .4 + w * .6},${1024 - h * .6} ${x + w},1024 Z" fill="${['#3f6a2a', '#4e7a30', '#5d8a36', '#36592a'][k % 4]}"/>`;
  }
  for (let k = 0; k < 34; k++) {
    const x = 512 + (r3() - .5) * 800, h = 380 + r3() * 520, b = (r3() - .5) * 160, tx = x + b, ty = 1024 - h, c = FL[Math.floor(r3() * FL.length)];
    body += `<path d="M${x},1024 Q${x + b * .3},${1024 - h * .5} ${tx},${ty}" stroke="#4d6e2e" stroke-width="5" fill="none"/>`;
    for (let j = 1; j < 4; j++) { const yy = 1024 - h * j / 4, xx = x + b * (j / 4) ** 1.5, sd = j % 2 ? 1 : -1; body += `<ellipse cx="${xx + sd * 22}" cy="${yy}" rx="26" ry="9" transform="rotate(${sd * -30} ${xx + sd * 22} ${yy})" fill="#4f7a32"/>`; }
    if (k % 5 === 0) {   // 穗狀花序
      for (let j = 0; j < 9; j++) { const yy = ty + j * 20, rr = 15 - j * .6; body += `<circle cx="${tx + (j % 2 ? 9 : -9)}" cy="${yy}" r="${rr}" fill="${c}"/><circle cx="${tx + (j % 2 ? 9 : -9) - 3}" cy="${yy - 4}" r="${rr * .45}" fill="#e6d4ff" fill-opacity=".5"/>`; }
    } else {
      const R = 26 + r3() * 18;
      for (let j = 0; j < 5; j++) { const a = j * 72 + r3() * 10; body += `<ellipse cx="${tx}" cy="${ty - R * .55}" rx="${R * .32}" ry="${R * .58}" transform="rotate(${a} ${tx} ${ty})" fill="${c}"/>`; }
      body += `<circle cx="${tx}" cy="${ty}" r="${R * .2}" fill="#f2d24a"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${body}</svg>`;
  const px = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < S * S; i++) if (px[i * 4 + 3] < 8) { px[i * 4] = 70; px[i * 4 + 1] = 100; px[i * 4 + 2] = 50; }
  await sharp(px, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(OUT, 'flowers.png'));
  console.log('flowers.png');
}
// ─── 草叢卡（下緣是地面）：一百多片細長的草葉從底部散開，底暗頂亮、偶爾一支結穗的 ───
{
  let s4 = 44; const r4 = () => ((s4 = Math.imul(s4 ^ (s4 >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  let defs = '', body = '';
  const GC = [['#2c4a1e', '#7d9a3e'], ['#33531f', '#93a84a'], ['#294219', '#6e8f36'], ['#3a5a24', '#a7b056']];
  GC.forEach(([a, b], k) => { defs += `<linearGradient id="q${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`; });
  for (let k = 0; k < 150; k++) {
    const x = 512 + (r4() - .5) * 520, h = 380 + r4() * 600, b = (x - 512) * (.6 + r4()) + (r4() - .5) * 200, w = 4 + r4() * 6;
    body += `<path d="M${x - w},1024 Q${x + b * .35},${1024 - h * .55} ${x + b},${1024 - h} Q${x + b * .35 + w * .5},${1024 - h * .55} ${x + w},1024 Z" fill="url(#q${k % 4})"/>`;
    if (k % 23 === 0) body += `<ellipse cx="${x + b}" cy="${1024 - h - 30}" rx="9" ry="34" transform="rotate(${b / 12} ${x + b} ${1024 - h})" fill="#b7a868"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${defs}</defs>${body}</svg>`;
  const px = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < S * S; i++) if (px[i * 4 + 3] < 8) { px[i * 4] = 60; px[i * 4 + 1] = 86; px[i * 4 + 2] = 36; }
  await sharp(px, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(OUT, 'grass_tuft.png'));
  console.log('grass_tuft.png');
}
// ─── 闊葉樹的葉叢（榛嶺的雜木林：枹櫟、山毛櫸那種卵形、葉緣細鋸齒的綠葉；使用者給的參考圖是一片深淺不同的綠）：細枝從卡的下緣中間散出去，
// 每根枝上互生十來片葉，整張卡大半是葉子（遠一點看是一團綠，不是一片片分開的葉） ───
{
  let s5 = 55; const r5 = () => ((s5 = Math.imul(s5 ^ (s5 >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const GP = [['#33501f', '#16290d'], ['#2c461b', '#12230a'], ['#3e5829', '#1d3311'], ['#273f17', '#0e1d06'], ['#486232', '#223916'], ['#2e4823', '#13260d']];   // 參考圖的林子是暗、偏灰的森林綠
  const leaf = L => {   // 卵形、尖頭，葉緣細鋸齒；葉柄在原點，葉尖朝 −y
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40, w = Math.sin(Math.PI * Math.min(1, t * 1.08)) ** .75 * (1 - .35 * t) * L * .36 * (1 - .06 * (i % 2)); pts.push([w, -t * L]); }
    const all = pts.concat(pts.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
    return 'M' + all.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';
  };
  let defs = '', body = '';
  GP.forEach(([a, b], k) => { defs += `<radialGradient id="b${k}" cx="50%" cy="80%" r="90%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`; });
  const L = [];
  for (let k = 0; k < 13; k++) {   // 枝：從下緣中間往上散開
    const a = (r5() - .5) * 2.4, len = 420 + r5() * 470, ex = 512 + Math.sin(a) * len, ey = 1024 - Math.cos(a) * len * 1.02;
    body += `<path d="M512,1024 Q${(512 + ex) / 2 + (r5() - .5) * 80},${(1024 + ey) / 2} ${ex.toFixed(0)},${ey.toFixed(0)}" stroke="#4a3a24" stroke-width="${(7 - k * .2).toFixed(1)}" fill="none"/>`;
    for (let j = 0; j < 14; j++) {   // 葉：沿枝互生，越往外越密
      const t = .3 + .7 * (j / 13) ** .8, x = 512 + (ex - 512) * t, y = 1024 + (ey - 1024) * t, sd = j % 2 ? 1 : -1;
      L.push({ x, y, rot: a * 57 + sd * (35 + r5() * 35) + (r5() - .5) * 20, sz: 95 + r5() * 70, g: Math.floor(r5() * GP.length) });
    }
  }
  L.sort((p, q) => q.y - p.y);
  for (const l of L) {
    body += `<g transform="translate(${l.x.toFixed(1)},${l.y.toFixed(1)}) rotate(${l.rot.toFixed(1)})"><path d="${leaf(l.sz)}" fill="url(#b${l.g})" stroke="#1c330c" stroke-opacity=".4" stroke-width="2"/>`;
    body += `<line x1="0" y1="0" x2="0" y2="${(-l.sz * .92).toFixed(1)}" stroke="#7d9258" stroke-opacity=".4" stroke-width="2"/>`;
    for (let v = 1; v < 5; v++) for (const s of [-1, 1]) body += `<line x1="0" y1="${(-l.sz * v * .18).toFixed(1)}" x2="${(s * l.sz * .12).toFixed(1)}" y2="${(-l.sz * (v * .18 + .08)).toFixed(1)}" stroke="#7d9258" stroke-opacity=".25" stroke-width="1.4"/>`;
    body += '</g>';
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${defs}</defs>${body}</svg>`;
  const px = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < S * S; i++) if (px[i * 4 + 3] < 8) { px[i * 4] = 46; px[i * 4 + 1] = 66; px[i * 4 + 2] = 30; }
  await sharp(px, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(OUT, 'broad_leaves.png'));
  console.log('broad_leaves.png');
}

// ─── 松（forest.py 的 pine）的針葉叢卡：pine_tree_01 的小枝照片一枝一枝很稀，剪下最完整的那一枝（圖的左上，梢朝上），從卡底往上扇形疊二十幾枝，
// 成一團刷子狀的針葉叢（卡的下緣中點是枝的位置；下層暗、大，外層亮）；壓暗、往黃綠偏一點（赤松比冷杉淺） ───
{
  const left = 50, top = 40, width = 165, height = 415, stem = 90;   // stem：小枝基部在剪下來那張的 x
  const px = await sharp(resolve(OUT, 'pine_twig.png')).extract({ left, top, width, height }).raw().toBuffer();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (y > 290 && Math.abs(x - stem) > 28) px[(y * width + x) * 4 + 3] = 0;   // 下段兩側是圖上的樹皮與毬果
  const cut = await sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer();
  let s3 = 33; const r3 = () => ((s3 = Math.imul(s3 ^ (s3 >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const layers = [];
  const tuft = async (bx, by, deg, size, dark) => {
    const k = size / height, w = Math.max(8, Math.round(width * k)), h = Math.max(8, Math.round(height * k));
    const img = sharp(cut).resize(w, h).modulate({ brightness: dark * .5, saturation: .85, hue: 8 });
    const rb = await img.rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), m = await sharp(rb).metadata();
    const a = deg * Math.PI / 180, sx = (stem / width - .5) * w, ox = sx * Math.cos(a) - Math.sin(a) * h / 2, oy = sx * Math.sin(a) + Math.cos(a) * h / 2;   // 基部（下緣、stem 那一點）轉過之後相對中心的位置
    layers.push({ input: rb, left: Math.round(bx - ox - m.width / 2), top: Math.round(by - oy - m.height / 2) });
  };
  for (let i = 0; i < 9; i++) await tuft(512 + (r3() - .5) * 30, 990 - i * 28, (i % 2 ? 1 : -1) * (30 + r3() * 40), 560 + r3() * 80, .55 + .15 * r3());   // 底層：暗、大、往兩側開
  for (let i = 0; i < 11; i++) await tuft(512 + (r3() - .5) * 60, 900 - i * 45, (i % 2 ? -1 : 1) * (8 + r3() * 45), 440 + r3() * 80, .8 + .15 * r3());
  for (let i = 0; i < 5; i++) await tuft(512 + (r3() - .5) * 40, 520 - i * 30, (r3() - .5) * 36, 400 + r3() * 40, 1);   // 梢
  const raw = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers.map(l => ({ ...l, left: Math.max(-2000, l.left), top: Math.max(-2000, l.top) }))).raw().toBuffer();
  for (let i = 0; i < S * S; i++) if (raw[i * 4 + 3] < 8) { raw[i * 4] = 58; raw[i * 4 + 1] = 70; raw[i * 4 + 2] = 38; }
  await sharp(raw, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(OUT, 'pine_branch.png'));
  console.log('pine_branch.png');
}
