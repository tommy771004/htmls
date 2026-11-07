#!/usr/bin/env node
// 作品 278 素材管線：從 Poly Haven（CC0）下載 PBR 貼圖與 HDRI，轉成遊戲要的格式。
//
//   node tools/fetch-textures.mjs              全部（有快取，重跑只會重新轉檔）
//   node tools/fetch-textures.mjs --only=flag,sand
//   node tools/fetch-textures.mjs --no-sky     只處理貼圖
//   node tools/fetch-textures.mjs --sky-only   只處理天空
//
// 需要 cwebp、ffmpeg。下載快取在 dist/dl/（已 gitignore），這裡的檔案只當資料讀。
// 產出：
//   assets/278/tex/<name>_{a,n,orm}.webp   albedo、normal（OpenGL Y+）、ORM（R=AO G=rough B=metal）
//   assets/278/sky/env.hdr                 1024×512，IBL 用，太陽盤已移除（見 buildSky）
//   assets/278/sky/sky.webp                2048×1024，已 tonemap 的背景（顯示時不可再過一次 tonemap）
//   dist/assets-sky.json                   太陽方位、仰角、輻照度、tonemap 參數
//   credits/textures.md                    素材 id、作者、授權、實際尺寸

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(GAME, '../..');
const OUT_TEX = path.join(ROOT, 'assets/278/tex');
const OUT_SKY = path.join(ROOT, 'assets/278/sky');
const DL = path.join(GAME, 'dist/dl');
const WORK = path.join(GAME, 'dist/work');
const SKY_JSON = path.join(GAME, 'dist/assets-sky.json');
const CREDITS = path.join(GAME, 'credits/textures.md');
const TARGETS = path.join(GAME, 'ref/targets.json');

const API = 'https://api.polyhaven.com';
const UA = { headers: { 'User-Agent': 'ochre-line-asset-fetch/1.0 (work 278)' } };

// 素材清單。挑選過程：先看球體縮圖，再看 1k diffuse 的 2×2 拼貼，並量平均色相對照 ref/key.jpg。
// size 依實際尺寸定：小物的貼圖只有 1 m 左右，512 的像素密度已高於 3 m 牆面的 1024。
const SLOTS = [
  { name: 'sandstone', id: 'sandstone_blocks_05', size: 1024, use: '暖色砂岩牆', why: '整層砌石，亮面偏奶油色，最接近 key.jpg 角石與牆腳' },
  { name: 'plaster', id: 'damaged_plaster', size: 1024, use: '剝落灰泥牆', why: '灰泥塊狀剝落露出磚石，平均色相 30° 與 key.jpg 牆面相同' },
  { name: 'whitewash', id: 'white_rough_plaster', size: 1024, use: '曝曬白灰泥', why: '白灰層龜裂剝落，色相近中性；實際 1 m，大牆建議放大到 2.5 m 左右再貼' },
  { name: 'ashlar', id: 'white_sandstone_blocks_02', size: 1024, use: '方整石塊（城門、基座）', why: '淺色整層石塊，石緣圓鈍有真實起伏，像 key.jpg 左下的牆基；sandstone_blocks_08 顏色也對但法線幾乎全平' },
  { name: 'brick', id: 'brick_wall_02', size: 1024, use: '老磚', why: '暖色磚配淺色灰縫，比紅磚更貼近赭色主調' },
  // key.jpg 的地面比牆亮，原圖卻比砂岩牆暗（v 0.50 對 0.69），不調的話光照怎麼打都反過來。
  { name: 'flag', id: 'stone_pathway', size: 1024, use: '不規則石板地', why: '不規則暖色石板，排列最像 key.jpg 地面；albedo 調色：提亮 ×1.3、飽和 ×0.8、色相 +4°',
    grade: "lutrgb=r='clip(val*1.3,0,255)':g='clip(val*1.3,0,255)':b='clip(val*1.3,0,255)',hue=h=4:s=0.8" },
  { name: 'cobble', id: 'cobblestone_floor_01', size: 1024, use: '卵石地', why: '暖灰方卵石，沒有長草' },
  { name: 'sand', id: 'dense_sand', size: 1024, use: '砂土', why: '淺褐夯實砂土，比 dirt_floor 的橘色更接近 key.jpg 的塵土色' },
  { name: 'tile', id: 'marble_mosaic_tiles', size: 1024, use: '褪色彩磚', why: 'Poly Haven 沒有彩繪花磚，這張赭底碎石馬賽克的褪色感最接近' },
  { name: 'wood', id: 'brown_planks_03', size: 512, use: '風化木板（木箱）', why: '灰褐曝曬感最明顯；板條為垂直方向' },
  { name: 'woodpaint', id: 'blue_painted_planks', size: 512, use: '剝漆藍木門', why: '色相 182° 接近 key.jpg 門板；板條為水平方向，做門時 UV 要轉 90°' },
  { name: 'metal', id: 'rusty_metal_05', size: 512, use: '鏽鐵', why: '大面積片狀鏽，帶殘留漆色' },
  // Poly Haven 沒有軍綠漆鋼板，原圖偏草綠（色相 94°），轉到橄欖綠。
  { name: 'military', id: 'green_metal_rust', size: 512, use: '軍綠漆鋼板', why: '唯一帶刮痕的綠漆鋼板；albedo 調色：色相 -22°、飽和 ×0.85', grade: 'hue=h=-22:s=0.85' },
  { name: 'canvas', id: 'hessian_380', size: 512, use: '粗帆布', why: '密織無鏤空（hessian_230 是網眼）；實際只有 27 cm，UV 要依此縮放；原檔 metal 通道非零，已清為 0',
    ormFilter: 'colorchannelmixer=bb=0' },
];

const HDRI = { id: 'qwantani_noon_puresky', why: '萬里無雲、天空偏淡，太陽仰角實測 49.8°，符合 key.jpg 約 50° 的斜射' };

// ---- 共用 ----

const args = process.argv.slice(2);
const onlyArg = args.find(a => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;
const doTex = !args.includes('--sky-only');
const doSky = !args.includes('--no-sky') && !only;

const md5 = buf => createHash('md5').update(buf).digest('hex');
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const mkdir = d => fs.mkdirSync(d, { recursive: true });

async function fetchJson(url) {
  const r = await fetch(url, UA);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

/** 下載並驗 md5，已有正確檔案就跳過。 */
async function download(entry, dest) {
  if (fs.existsSync(dest) && md5(fs.readFileSync(dest)) === entry.md5) return dest;
  mkdir(path.dirname(dest));
  const r = await fetch(entry.url, UA);
  if (!r.ok) throw new Error(`${entry.url} → ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (md5(buf) !== entry.md5) throw new Error(`md5 不符：${entry.url}`);
  fs.writeFileSync(dest, buf);
  return dest;
}

const cwebp = (input, output, opts) => run('cwebp', ['-quiet', '-m', '6', '-metadata', 'none', ...opts, input, '-o', output]);

/**
 * 一律先經 ffmpeg 轉成 8 位元 PPM 再給 cwebp。cwebp 讀 PNG 時會套用 gAMA 區塊，
 * hessian_380 的法線因此整張變亮（平均誤差 33°），而 ffmpeg 輸出 PNG 時又會把 gAMA 寫回去，
 * 所以中間檔不能用 PNG。縮圖用 area 取平均。
 */
function normalize(src, dest, size, filter) {
  const vf = [`scale=${size}:${size}:flags=area`, filter].filter(Boolean).join(',');
  run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf, '-pix_fmt', 'rgb24', dest]);
  return dest;
}

// ---- 貼圖 ----

const WEBP = {
  a: ['-q', '80', '-sharp_yuv'],
  // 有損 WebP 固定 4:2:0，法線的 X、Y 會被砍半解析度：q100 仍有 7° 平均誤差、裂縫處超過 30°。
  // near-lossless 不做色度抽樣，誤差降到約 1.3°，大小約 2 倍。
  n: ['-lossless', '-near_lossless', '40', '-q', '100'],
  // ORM 的 G 走亮度，AO 與 metal 半解析度可接受；關掉依視覺的量化分配與去塊濾波。
  orm: ['-q', '80', '-sns', '0', '-f', '0', '-sharp_yuv'],
};

async function buildTexture(slot, info) {
  const files = await fetchJson(`${API}/files/${slot.id}`);
  const pick = (key, ext) => {
    const e = files[key]?.['1k']?.[ext];
    if (!e) throw new Error(`${slot.id} 沒有 ${key} 1k ${ext}（只有 ${Object.keys(files).join(' ')}）`);
    return e;
  };
  const dir = path.join(DL, 'tex', slot.id);
  const srcA = await download(pick('Diffuse', 'jpg'), path.join(dir, 'diff.jpg'));
  // 法線與 ARM 用 PNG：JPG 的色度抽樣會讓通道互相污染。
  const srcN = await download(pick('nor_gl', 'png'), path.join(dir, 'nor_gl.png'));
  const srcO = await download(pick('arm', 'png'), path.join(dir, 'arm.png'));

  mkdir(WORK);
  mkdir(OUT_TEX);
  const work = s => path.join(WORK, `${slot.name}_${s}.ppm`);
  // Poly Haven 的 arm 正好是 R=AO、G=rough、B=metal，與 SPEC 的 ORM 順序相同，不用換通道。
  cwebp(normalize(srcA, work('a'), slot.size, slot.grade), path.join(OUT_TEX, `${slot.name}_a.webp`), WEBP.a);
  cwebp(normalize(srcN, work('n'), slot.size), path.join(OUT_TEX, `${slot.name}_n.webp`), WEBP.n);
  cwebp(normalize(srcO, work('orm'), slot.size, slot.ormFilter), path.join(OUT_TEX, `${slot.name}_orm.webp`), WEBP.orm);

  const meta = info[slot.id];
  return {
    ...slot,
    title: meta.name,
    authors: meta.authors,
    metres: (meta.dimensions || []).map(d => Math.round(d / 10) / 100),
  };
}

// ---- HDR 讀寫（Radiance RGBE，自己寫才不用依賴影像函式庫）----

function readHdr(file) {
  const b = fs.readFileSync(file);
  let o = 0, line = '', res = null;
  while (!res) {
    const c = b[o++];
    if (c !== 10) { line += String.fromCharCode(c); continue; }
    res = line.match(/^-Y (\d+) \+X (\d+)$/);
    line = '';
  }
  const H = +res[1], W = +res[2];
  const px = new Float32Array(W * H * 3);
  const scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (b[o] !== 2 || b[o + 1] !== 2) throw new Error('只支援新式 RLE 掃描線');
    o += 4;
    for (let ch = 0; ch < 4; ch++) {
      for (let x = 0; x < W;) {
        let n = b[o++];
        if (n > 128) {
          n -= 128;
          const v = b[o++];
          while (n--) scan[(x++) * 4 + ch] = v;
        } else {
          while (n--) scan[(x++) * 4 + ch] = b[o++];
        }
      }
    }
    for (let x = 0; x < W; x++) {
      const e = scan[x * 4 + 3];
      const k = e ? 2 ** (e - 136) : 0;
      const i = (y * W + x) * 3;
      px[i] = scan[x * 4] * k;
      px[i + 1] = scan[x * 4 + 1] * k;
      px[i + 2] = scan[x * 4 + 2] * k;
    }
  }
  return { W, H, px };
}

function writeHdr(file, { W, H, px }) {
  const out = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'latin1')];
  const scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const m = Math.max(px[i], px[i + 1], px[i + 2]);
      if (m < 1e-32) { scan.fill(0, x * 4, x * 4 + 4); continue; }
      const e = Math.ceil(Math.log2(m) + 1e-9);
      const k = 256 / 2 ** e;
      scan[x * 4] = Math.min(255, px[i] * k);
      scan[x * 4 + 1] = Math.min(255, px[i + 1] * k);
      scan[x * 4 + 2] = Math.min(255, px[i + 2] * k);
      scan[x * 4 + 3] = e + 128;
    }
    const line = [2, 2, W >> 8, W & 255];
    for (let ch = 0; ch < 4; ch++) {
      for (let x = 0; x < W;) {
        // 找下一段至少 4 個相同值的連續區，之前的放字面量。
        let run0 = x, runLen = 0;
        while (run0 < W) {
          runLen = 1;
          while (run0 + runLen < W && runLen < 127 && scan[(run0 + runLen) * 4 + ch] === scan[run0 * 4 + ch]) runLen++;
          if (runLen >= 4) break;
          run0 += runLen;
        }
        if (run0 >= W) { run0 = W; runLen = 0; }
        while (x < run0) {
          const n = Math.min(128, run0 - x);
          line.push(n);
          for (let i = 0; i < n; i++) line.push(scan[(x++) * 4 + ch]);
        }
        if (runLen) {
          line.push(128 + runLen, scan[x * 4 + ch]);
          x += runLen;
        }
      }
    }
    out.push(Buffer.from(line));
  }
  fs.writeFileSync(file, Buffer.concat(out));
}

/** 2×2 平均降採樣，水平環繞不需處理（偶數列對齊）。 */
function halve({ W, H, px }) {
  const w = W >> 1, h = H >> 1;
  const d = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        d[(y * w + x) * 3 + c] = 0.25 * (
          px[(y * 2 * W + x * 2) * 3 + c] + px[(y * 2 * W + x * 2 + 1) * 3 + c] +
          px[((y * 2 + 1) * W + x * 2) * 3 + c] + px[((y * 2 + 1) * W + x * 2 + 1) * 3 + c]);
      }
    }
  }
  return { W: w, H: h, px: d };
}

const lum = (p, i) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];

/** 全景像素中心的單位向量。只用來量夾角；這不是遊戲世界的方向，世界方向見 worldToSun。 */
function pixelDir(x, y, W, H, out) {
  const ph = (y + 0.5) / H * Math.PI;
  const th = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
  out[0] = Math.sin(ph) * Math.cos(th);
  out[1] = Math.cos(ph);
  out[2] = Math.sin(ph) * Math.sin(th);
}

/** 找太陽：亮度質心。再把 SUN_R 內的像素積分成太陽輻照度，並用外圈的天空補掉。 */
const SUN_R = 3;       // 度。3° 內 99% 是太陽盤能量，3° 外才是真正的天空亮度。
function extractSun(img) {
  const { W, H, px } = img;
  let peak = 0;
  for (let i = 0; i < px.length; i += 3) peak = Math.max(peak, lum(px, i));
  let sx = 0, sy = 0, sw = 0;
  const cut = peak * 0.02;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = lum(px, (y * W + x) * 3);
      if (l > cut) { sx += (x + 0.5) * l; sy += (y + 0.5) * l; sw += l; }
    }
  }
  const u = sx / sw / W, v = sy / sw / H;
  const ph = v * Math.PI, th = (u - 0.5) * 2 * Math.PI;
  const dir = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];

  const cosIn = Math.cos(SUN_R * Math.PI / 180), cosOut = Math.cos((SUN_R + 0.5) * Math.PI / 180);
  const d = [0, 0, 0], ring = [0, 0, 0];
  const irr = [0, 0, 0];
  let n = 0;
  const hit = [];
  for (let y = 0; y < H; y++) {
    const dOm = Math.sin((y + 0.5) / H * Math.PI) * (Math.PI / H) * (2 * Math.PI / W);
    for (let x = 0; x < W; x++) {
      pixelDir(x, y, W, H, d);
      const c = d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2];
      const i = (y * W + x) * 3;
      if (c >= cosIn) {
        hit.push(i);
        for (let k = 0; k < 3; k++) irr[k] += px[i + k] * dOm;
      } else if (c >= cosOut) {
        n++;
        for (let k = 0; k < 3; k++) ring[k] += px[i + k];
      }
    }
  }
  for (let k = 0; k < 3; k++) ring[k] /= n;
  for (const i of hit) for (let k = 0; k < 3; k++) px[i + k] = ring[k];
  return { u, v, dir, peak, irradiance: irr, ring, pixels: hit.length };
}

/**
 * 全景座標 → Babylon 世界方向（左手系，未旋轉的 HDRCubeTexture）。
 * 實測結果，不是由 PanoramaToCubeMapTools 的公式推得（照公式 x、z 會對調）：
 * 方位角（+z 向 +x）= (u − ½) × 360°，仰角 = 90° − v × 180°。
 */
function worldToSun(u, v) {
  const az = (u - 0.5) * 2 * Math.PI, el = (0.5 - v) * Math.PI;
  return { azimuthDeg: az * 180 / Math.PI, elevationDeg: el * 180 / Math.PI, dir: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)] };
}

const acesFit = x => Math.max(0, Math.min(1, x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14)));
const oetf = x => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

/** 線性輻射度 → sRGB（0–1）。sat 在顯示空間對亮度做內插。 */
function tonemap(r, g, b, exposure, sat, out) {
  const R = oetf(acesFit(r * exposure)), G = oetf(acesFit(g * exposure)), B = oetf(acesFit(b * exposure));
  const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  out[0] = Math.max(0, Math.min(1, L + (R - L) * sat));
  out[1] = Math.max(0, Math.min(1, L + (G - L) * sat));
  out[2] = Math.max(0, Math.min(1, L + (B - L) * sat));
}

/** key.jpg 的天空在畫面上半、遠離太陽；用仰角 15–40°、離太陽 60° 以外的平均去對色。 */
function fitSky(img, sun, target) {
  const { W, H, px } = img;
  const d = [0, 0, 0], sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.round(H * 50 / 180); y < Math.round(H * 75 / 180); y += 2) {
    for (let x = 0; x < W; x += 2) {
      pixelDir(x, y, W, H, d);
      if (d[0] * sun.dir[0] + d[1] * sun.dir[1] + d[2] * sun.dir[2] > 0.5) continue;
      const i = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) sum[k] += px[i + k];
      n++;
    }
  }
  const mean = sum.map(v => v / n);
  const out = [0, 0, 0];
  let best = null;
  for (let e = 0.5; e <= 30; e *= 1.02) {
    for (let s = 0.2; s <= 1.2; s += 0.01) {
      tonemap(mean[0], mean[1], mean[2], e, s, out);
      const err = Math.hypot(out[0] * 255 - target[0], out[1] * 255 - target[1], out[2] * 255 - target[2]);
      if (!best || err < best.err) best = { exposure: e, sat: s, err, rgb: out.map(v => Math.round(v * 255)) };
    }
  }
  return { ...best, skyMean: mean };
}

async function buildSky(info) {
  const files = await fetchJson(`${API}/files/${HDRI.id}`);
  const src = await download(files.hdri['2k'].hdr, path.join(DL, 'sky', `${HDRI.id}_2k.hdr`));
  const img = readHdr(src);
  const original = img.px.slice();
  const sun = extractSun(img);    // img 此後已無太陽盤
  mkdir(OUT_SKY);

  // env.hdr 只負責天空光。太陽由 DirectionalLight 打（才有陰影），留在 IBL 裡會在陰影區重複
  // 算一次沒有遮擋的太陽，並把亮度拉高到 6 倍以上。下半球維持原檔。
  writeHdr(path.join(OUT_SKY, 'env.hdr'), halve(img));

  // sky.webp 用含太陽盤的原圖，看到的天空才有太陽。
  const targets = JSON.parse(fs.readFileSync(TARGETS, 'utf8'));
  const fit = fitSky(img, sun, targets.regions.sky.rgb);
  const { W, H } = img;
  const rgb = Buffer.alloc(W * H * 3);
  const c = [0, 0, 0];
  let seed = 278;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0, n = W * H; i < n; i++) {
    tonemap(original[i * 3], original[i * 3 + 1], original[i * 3 + 2], fit.exposure, fit.sat, c);
    const dither = rand() - rand();     // 三角分布 ±1 LSB，避免天空漸層出現色帶
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.max(0, Math.min(255, Math.round(c[k] * 255 + dither)));
  }
  mkdir(WORK);
  const pnm = path.join(WORK, 'sky.ppm');
  fs.writeFileSync(pnm, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), rgb]));
  // 天空是大片緩坡，q92 就會吃掉抖動而出現色帶；q100 也才 90 KB 左右。
  cwebp(pnm, path.join(OUT_SKY, 'sky.webp'), ['-q', '100', '-sns', '0', '-f', '20', '-sharp_yuv']);

  const world = worldToSun(sun.u, sun.v);
  const round = (v, n = 4) => +v.toFixed(n);
  const json = {
    hdri: HDRI.id,
    authors: info[HDRI.id].authors,
    license: 'CC0',
    why: HDRI.why,
    source: `2k .hdr（${W}×${H}）`,
    sun: {
      u: round(sun.u), v: round(sun.v),
      elevationDeg: round(world.elevationDeg, 2),
      // 方位角：從 +z（北）轉向 +x（東），以 Babylon 未旋轉的 HDRCubeTexture 為準（已用無頭 Chrome 實測）。
      azimuthDeg: round(world.azimuthDeg, 2),
      toSun: world.dir.map(v => round(v)),
      // 直接填給 DirectionalLight.direction（engine.js 的 SUN_DIR）。
      lightDirection: world.dir.map(v => round(-v)),
      // 垂直入射輻照度（線性、未曝光），可換算 DirectionalLight 強度與色彩比例。
      irradianceRgb: sun.irradiance.map(v => round(v, 3)),
      peakLuminance: Math.round(sun.peak),
    },
    env: {
      file: 'assets/278/sky/env.hdr',
      size: [W >> 1, H >> 1],
      sunRemoved: { radiusDeg: SUN_R, pixelsAt2k: sun.pixels, filledWith: sun.ring.map(v => round(v, 3)) },
      lowerHemisphere: '原檔（偏藍暗）；暖色地面反彈由 engine.js 的 HemisphericLight groundColor 補',
      rotation: '實測：texture.rotationY = θ 時太陽方位角變成 azimuthDeg − θ',
    },
    sky: {
      file: 'assets/278/sky/sky.webp',
      size: [W, H],
      tonemap: 'exposure → ACES 擬合 → sRGB → 顯示空間飽和度內插',
      exposure: round(fit.exposure, 3),
      saturation: round(fit.sat, 2),
      fittedRgb: fit.rgb,
      targetRgb: targets.regions.sky.rgb,
      note: '已含 tonemap 與 sRGB，顯示時要繞過場景的 image processing',
      dome: '實測：CreateSphere 天空球要 invertY=false，否則太陽在地平線下；此時方位比 env 少 90°，dome.rotation.y = π/2 才對齊',
    },
  };
  mkdir(path.dirname(SKY_JSON));
  fs.writeFileSync(SKY_JSON, JSON.stringify(json, null, 2) + '\n');
  return json;
}

// ---- 授權清單 ----

const fmtAuthors = a => Object.keys(a || {}).join('、') || '（未列）';

function writeCredits(slots, info) {
  const rows = slots.map(s =>
    `| \`${s.name}\` | ${s.use} | [${s.title}](https://polyhaven.com/a/${s.id})（\`${s.id}\`） | ${fmtAuthors(s.authors)} | ${s.metres.join(' × ')} m | ${s.size} | ${s.why} |`);
  const text = `# 貼圖與天空來源

全部來自 [Poly Haven](https://polyhaven.com/)，授權 CC0。此檔由 \`tools/fetch-textures.mjs\` 產生，要改請改該工具的 \`SLOTS\`。

## 貼圖（\`assets/278/tex/<名稱>_{a,n,orm}.webp\`）

「實際尺寸」是一張貼圖對應的真實公尺數，世界座標 UV 要依此縮放。

| 名稱 | 用途 | Poly Haven 素材 | 作者 | 實際尺寸 | 邊長 | 選擇理由 |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

- \`_n\` 是 Poly Haven 的 \`nor_gl\`（OpenGL，Y+）。
- \`_orm\` 是 Poly Haven 的 \`arm\`：R=AO、G=rough、B=metal，通道順序未改動（\`canvas\` 的 metal 清為 0）。
- \`flag\`、\`military\` 的 albedo 有調色（數值見選擇理由），其餘都是原色。

## 天空（\`assets/278/sky/\`）

| 檔案 | Poly Haven 素材 | 作者 | 處理 |
| --- | --- | --- | --- |
| \`env.hdr\` | [${info[HDRI.id].name}](https://polyhaven.com/a/${HDRI.id})（\`${HDRI.id}\`） | ${fmtAuthors(info[HDRI.id].authors)} | 2k 降到 1024×512，移除半徑 ${SUN_R}° 的太陽盤 |
| \`sky.webp\` | 同上 | 同上 | 2048×1024，tonemap 並對色到 \`ref/targets.json\` 的 sky |

${HDRI.why}。
`;
  mkdir(path.dirname(CREDITS));
  fs.writeFileSync(CREDITS, text);
}

// ---- 主流程 ----

const [texInfo, hdriInfo] = await Promise.all([
  fetchJson(`${API}/assets?t=textures`),
  fetchJson(`${API}/assets?t=hdris`),
]);
const info = { ...texInfo, ...hdriInfo };

const selected = SLOTS.filter(s => !only || only.has(s.name));
const built = [];
if (doTex) {
  for (const slot of selected) {
    built.push(await buildTexture(slot, info));
    console.log(`貼圖 ${slot.name} ← ${slot.id}`);
  }
}
if (doSky) {
  const sky = await buildSky(info);
  console.log(`天空 ${sky.hdri}：仰角 ${sky.sun.elevationDeg}°、方位 ${sky.sun.azimuthDeg}°`);
}
// 授權清單要列全部素材，只在完整重跑時更新。
if (doTex && !only) writeCredits(built, info);
fs.rmSync(WORK, { recursive: true, force: true });

const total = [OUT_TEX, OUT_SKY].flatMap(d => (fs.existsSync(d) ? fs.readdirSync(d).map(f => path.join(d, f)) : []))
  .reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`總大小 ${(total / 1048576).toFixed(2)} MB`);
if (total > 25 * 1048576) {
  console.error('超過 25 MB 上限');
  process.exitCode = 1;
}
