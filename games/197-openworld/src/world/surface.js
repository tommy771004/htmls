// 地表與樹皮的 PBR 貼圖組（albedo + normal）。
// 有照片貼圖（public/textures/*.jpg）就用照片，沒有就用這裡的程序生成版本。
// 做法都是先生成一張可平鋪的 heightfield，再由它導出法線與顏色，兩者才會對得上。

import * as THREE from 'three';
import { mulberry32, lerp, clamp, smoothstep } from '../core/noise.js';

const SIZE = 512;
/** 草地底色的目標平均色（sRGB）；草葉根部的顏色也對齊這個值（grass.js） */
export const GROUND_MEAN = [92, 102, 60];

/** 週期性 lattice value noise（格點以 period 取模 → 無縫平鋪） */
function tileNoise(rand, period) {
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  return (u, v) => {
    const x = u * period;
    const y = v * period;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const g = (i, j) => grid[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
    return lerp(lerp(g(x0, y0), g(x0 + 1, y0), sx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), sx), sy);
  };
}

/** 多個八度疊加，回傳約 0..1 */
function fractal(rand, periods, gain = 0.55) {
  let amp = 1;
  const layers = periods.map((p) => {
    const l = [tileNoise(rand, p), amp];
    amp *= gain;
    return l;
  });
  const norm = layers.reduce((s, l) => s + l[1], 0);
  return (u, v) => layers.reduce((s, [fn, a]) => s + fn(u, v) * a, 0) / norm;
}

function field(fn, size = SIZE) {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = fn(x / size, y / size);
  return out;
}

/** heightfield → 切線空間法線（回傳 [nx, ny] 兩張 Float32，值域 -1..1） */
function normalsOf(height, size, strength) {
  const nx = new Float32Array(size * size);
  const ny = new Float32Array(size * size);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      nx[y * size + x] = dx * inv;
      ny[y * size + x] = dy * inv;
    }
  }
  return [nx, ny];
}

function dataTexture(data, size, srgb) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** fn(i, u, v) → [r, g, b, a]（0..1） */
function colorTexture(fn, size = SIZE, srgb = true) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const c = fn(i, x / size, y / size);
      data[i * 4] = clamp(c[0], 0, 1) * 255;
      data[i * 4 + 1] = clamp(c[1], 0, 1) * 255;
      data[i * 4 + 2] = clamp(c[2], 0, 1) * 255;
      data[i * 4 + 3] = clamp(c[3] ?? 1, 0, 1) * 255;
    }
  }
  return dataTexture(data, size, srgb);
}

/** 把兩組法線的 xy 打包進一張 RGBA（省一次取樣） */
function packNormals(a, b, size = SIZE) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = (a[0][i] * 0.5 + 0.5) * 255;
    data[i * 4 + 1] = (a[1][i] * 0.5 + 0.5) * 255;
    data[i * 4 + 2] = (b[0][i] * 0.5 + 0.5) * 255;
    data[i * 4 + 3] = (b[1][i] * 0.5 + 0.5) * 255;
  }
  return dataTexture(data, size, false);
}

const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------------------------------------------------------------- 岩石

let rockCache = null;
function makeRock() {
  if (rockCache) return rockCache;
  const rand = mulberry32(9101);
  const base = fractal(rand, [3, 7, 15, 33, 71, 151]);
  const crackA = fractal(rand, [5, 11, 27, 61]);
  const crackB = fractal(rand, [4, 9, 23]);
  const lichen = fractal(rand, [6, 13, 37]);
  const grain = tileNoise(rand, 256);
  const cracks = new Float32Array(SIZE * SIZE);
  const height = field((u, v) => {
    // 層理：沿一個方向拉長的條帶，再被低頻 noise 扭曲
    const strata = Math.sin((v * 5 + base(u, v) * 5.5 + crackB(u, v) * 3.0 + u * 0.8) * Math.PI * 2) * 0.5 + 0.5;
    const c1 = 1 - Math.abs(crackA(u, v) - 0.5) * 2;
    const c2 = 1 - Math.abs(crackB(u + 0.37, v + 0.11) - 0.5) * 2;
    const crack = Math.pow(c1, 34) + Math.pow(c2, 44) * 0.8;
    const i = Math.min(SIZE - 1, Math.round(v * SIZE)) * SIZE + Math.min(SIZE - 1, Math.round(u * SIZE));
    cracks[i] = crack;
    return base(u, v) * 0.82 + strata * 0.07 + grain(u, v) * 0.06 - crack * 0.5;
  });
  const normals = normalsOf(height, SIZE, 7);
  const dark = [0.3, 0.28, 0.26];
  const mid = [0.43, 0.41, 0.38];
  const light = [0.56, 0.54, 0.5];
  const map = colorTexture((i, u, v) => {
    const h = height[i];
    let c = h < 0.45 ? mix3(dark, mid, smoothstep(0.1, 0.45, h)) : mix3(mid, light, smoothstep(0.45, 0.8, h));
    // 暖色鐵鏽斑與偏黃綠的地衣
    c = mix3(c, [0.52, 0.42, 0.33], smoothstep(0.55, 0.8, crackB(u, v)) * 0.35);
    const l = smoothstep(0.62, 0.74, lichen(u, v)) * smoothstep(0.35, 0.6, h);
    c = mix3(c, [0.56, 0.57, 0.43], l * 0.3);
    const shade = 1 - clamp(cracks[i], 0, 1) * 0.45;
    // alpha 放低頻亮度，地形 shader 拿來當大尺度明暗變化
    return [c[0] * shade, c[1] * shade, c[2] * shade, base(u * 0.25, v * 0.25)];
  });
  rockCache = { map, normals };
  return rockCache;
}

// ---------------------------------------------------------------- 沙

function makeSand() {
  const rand = mulberry32(9102);
  const warp = fractal(rand, [3, 7, 17]);
  const grain = tileNoise(rand, 256);
  const fine = tileNoise(rand, 128);
  const pebble = tileNoise(rand, 37);
  const height = field((u, v) => {
    const ripple = Math.sin((u * 9 + warp(u, v) * 4.5 + v * 2) * Math.PI * 2) * 0.5 + 0.5;
    const peb = smoothstep(0.82, 0.93, pebble(u, v));
    return ripple * 0.05 + warp(u * 2.0, v * 2.0) * 0.35 + grain(u, v) * 0.25 + fine(u, v) * 0.22 + peb * 0.6;
  });
  const map = colorTexture((i, u, v) => {
    const g = grain(u, v);
    let c = mix3([0.66, 0.58, 0.42], [0.86, 0.8, 0.64], clamp(height[i] * 0.9 + g * 0.3, 0, 1));
    const peb = smoothstep(0.82, 0.93, pebble(u, v));
    c = mix3(c, [0.42, 0.4, 0.38], peb * 0.7);
    return c;
  });
  return { map, normals: normalsOf(height, SIZE, 3.2) };
}

// ---------------------------------------------------------------- 泥土

function makeDirt() {
  const rand = mulberry32(9103);
  const base = fractal(rand, [4, 9, 21, 47, 101]);
  const clod = fractal(rand, [17, 41, 89]);
  const pebble = tileNoise(rand, 53);
  const twig = fractal(rand, [29, 67]);
  const height = field((u, v) => {
    const peb = smoothstep(0.8, 0.92, pebble(u, v));
    return base(u, v) * 0.55 + clod(u, v) * 0.35 + peb * 0.55;
  });
  const map = colorTexture((i, u, v) => {
    const h = height[i];
    let c = mix3([0.2, 0.15, 0.1], [0.5, 0.39, 0.27], clamp(h * 1.05, 0, 1));
    const peb = smoothstep(0.8, 0.92, pebble(u, v));
    c = mix3(c, [0.36, 0.34, 0.31], peb * 0.5);
    // 零星的枯葉／細枝
    const t = smoothstep(0.73, 0.78, twig(u, v));
    c = mix3(c, [0.6, 0.46, 0.25], t * 0.5);
    return c;
  });
  return { map, normals: normalsOf(height, SIZE, 5) };
}

// ---------------------------------------------------------------- 草地

/** 沒有照片時的替代草地：雜亂的綠色短條紋 */
function makeGrassFallback() {
  const rand = mulberry32(9104);
  const base = fractal(rand, [5, 11, 23, 53, 113, 251]);
  const patch = fractal(rand, [3, 6, 13]);
  const fine = tileNoise(rand, 256);
  const height = field((u, v) => base(u, v) * 0.6 + fine(u, v) * 0.4);
  const map = colorTexture((i, u, v) => {
    const h = height[i];
    let c = mix3([0.12, 0.24, 0.07], [0.42, 0.56, 0.2], clamp(h * 1.2 - 0.1, 0, 1));
    c = mix3(c, [0.5, 0.5, 0.22], smoothstep(0.6, 0.8, patch(u, v)) * 0.3);
    return c;
  });
  return { map, height };
}

/** 把圖片畫到 canvas 讀回像素；列的順序翻成由下而上，跟 TextureLoader 載入的貼圖（flipY）一致 */
function readPixels(image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const src = ctx.getImageData(0, 0, size, size).data;
  const out = new Uint8ClampedArray(src.length);
  const row = size * 4;
  for (let y = 0; y < size; y++) out.set(src.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  return out;
}

/** 從照片的亮度反推高度，再算出法線 */
function heightFromImage(image, size = SIZE) {
  const px = readPixels(image, size);
  const out = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) out[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
  return out;
}

/** 讀取現成的法線貼圖（OpenGL 慣例），取出 xy */
function normalsFromImage(image, size = SIZE) {
  const px = readPixels(image, size);
  const nx = new Float32Array(size * size);
  const ny = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    nx[i] = (px[i * 4] / 255) * 2 - 1;
    ny[i] = (px[i * 4 + 1] / 255) * 2 - 1;
  }
  return [nx, ny];
}

/** 照片顏色＋alpha 放低頻 noise（地形 shader 拿 alpha 當大尺度明暗） */
function photoWithMacroAlpha(image, size = 1024) {
  const px = readPixels(image, size);
  const macro = fractal(mulberry32(9105), [3, 7, 15]);
  const data = new Uint8Array(px.length);
  data.set(px);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data[(y * size + x) * 4 + 3] = macro(x / size, y / size) * 255;
  }
  return dataTexture(data, size, true);
}

/**
 * 掃描貼圖各自的明度與色調差很多（ambientCG 的林地偏黃白、帆布是中性灰）。
 * 算出「照片平均色 → 目標色」的線性乘數，乘到材質 color 或地形 tint 上，紋理細節保留、整體色調對齊。
 * @param target 目標平均色（sRGB 0..255）
 */
export function tintToMean(image, target) {
  const px = readPixels(image, 64);
  const sum = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) {
    sum[0] += px[i];
    sum[1] += px[i + 1];
    sum[2] += px[i + 2];
  }
  const n = px.length / 4;
  const lin = (v) => {
    const c = v / 255;
    return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
  };
  return new THREE.Color(...target.map((t, k) => lin(t) / Math.max(lin(sum[k] / n), 1e-3)));
}

function tuneTexture(tex, srgb = true) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 地形 shader 需要的整組貼圖。每一種地表都是「有掃描貼圖就用，沒有才程序生成」。
 * @param photos Assets.textures（可能缺任何一張）
 */
export function buildTerrainSurface(photos) {
  // ---- 草地 ----
  let grassMap;
  let grassN;
  // rgb = 色調乘數、w = 飽和度：草皮照片太鮮豔要壓，林地照片本來就自然
  let grassTint = new THREE.Vector4(1, 1, 1, 1);
  if (photos.ground) {
    grassMap = tuneTexture(photos.ground);
    grassN = photos.groundN ? normalsFromImage(photos.groundN.image) : normalsOf(heightFromImage(photos.ground.image), SIZE, 2.6);
    // 林地照片平均約 sRGB(152,147,87)，鋪滿山坡會像褪色的乾草；拉到偏綠、較暗的草地底色
    const t = tintToMean(photos.ground.image, GROUND_MEAN);
    grassTint.set(t.r, t.g, t.b, 0.92);
  } else if (photos.grass) {
    grassMap = tuneTexture(photos.grass);
    grassN = normalsOf(heightFromImage(photos.grass.image), SIZE, 2.6);
    grassTint.set(0.8, 0.76, 0.7, 0.78);
  } else {
    const g = makeGrassFallback();
    grassMap = g.map;
    grassN = normalsOf(g.height, SIZE, 2.6);
  }

  // ---- 岩石 ----
  let rockMap;
  let rockN;
  if (photos.rock) {
    rockMap = photoWithMacroAlpha(photos.rock.image);
    rockN = photos.rockN ? normalsFromImage(photos.rockN.image) : normalsOf(heightFromImage(photos.rock.image), SIZE, 5);
  } else {
    const rock = makeRock();
    rockMap = rock.map;
    rockN = rock.normals;
  }

  // ---- 沙與泥土：共用一組法線 channel（兩者的凹凸都偏細碎，混在一起看不出來）----
  const layer = (map, normal, make) => {
    if (map) return { map: tuneTexture(map), normals: normal ? normalsFromImage(normal.image) : normalsOf(heightFromImage(map.image), SIZE, 3) };
    return make();
  };
  const sand = layer(photos.sand, photos.sandN, makeSand);
  const dirt = layer(photos.dirt, photos.dirtN, makeDirt);
  const sandDirt = [new Float32Array(SIZE * SIZE), new Float32Array(SIZE * SIZE)];
  for (let i = 0; i < SIZE * SIZE; i++) {
    sandDirt[0][i] = (sand.normals[0][i] + dirt.normals[0][i]) * 0.5;
    sandDirt[1][i] = (sand.normals[1][i] + dirt.normals[1][i]) * 0.5;
  }

  const caustics = photos.caustics ?? null;
  if (caustics) {
    caustics.wrapS = caustics.wrapT = THREE.RepeatWrapping;
    caustics.colorSpace = THREE.SRGBColorSpace;
  }
  return {
    grass: grassMap,
    grassTint,
    rock: rockMap,
    sand: sand.map,
    dirt: dirt.map,
    normalA: packNormals(grassN, sandDirt),
    rockNormal: packNormals(rockN, rockN),
    caustics,
  };
}

// ---------------------------------------------------------------- 樹皮

/** 縱向裂紋的樹皮；tone 決定色調（針葉樹偏紅褐、闊葉樹偏灰褐） */
export function buildBark(tone = 'oak', photos = {}) {
  const photo = tone === 'pine' ? photos.barkFir : photos.barkOak;
  const photoN = tone === 'pine' ? photos.barkFirN : photos.barkOakN;
  if (photo && photoN) return { map: tuneTexture(photo), normalMap: tuneTexture(photoN, false) };
  const rand = mulberry32(tone === 'pine' ? 9201 : 9202);
  const warp = fractal(rand, [3, 7, 15]);
  const ridge = fractal(rand, [9, 19, 41]);
  const fine = tileNoise(rand, 128);
  const plates = tone === 'pine' ? 9 : 14;
  const size = 256;
  const height = field((u, v) => {
    // 沿 v（樹幹高度方向）拉長：u 方向高頻、v 方向低頻
    const w = warp(u, v * 0.35) * 1.4;
    const fissure = Math.abs(Math.sin((u * plates + w) * Math.PI));
    const cross = tone === 'pine' ? smoothstep(0.75, 0.9, Math.abs(Math.sin((v * 5 + warp(u * 2, v) * 2) * Math.PI))) * 0.35 : 0;
    return Math.pow(fissure, 0.55) * 0.7 + ridge(u, v * 0.3) * 0.25 + fine(u, v) * 0.1 - cross;
  }, size);
  const palette = tone === 'pine' ? [[0.16, 0.1, 0.07], [0.5, 0.33, 0.22]] : [[0.13, 0.11, 0.09], [0.47, 0.41, 0.33]];
  const map = colorTexture(
    (i, u, v) => {
      let c = mix3(palette[0], palette[1], clamp(height[i] * 1.15, 0, 1));
      // 背陰面長一點青苔
      c = mix3(c, [0.3, 0.36, 0.18], smoothstep(0.62, 0.8, ridge(u * 0.5, v * 0.5)) * 0.28);
      return c;
    },
    size,
  );
  const n = normalsOf(height, size, 6);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = (n[0][i] * 0.5 + 0.5) * 255;
    data[i * 4 + 1] = (n[1][i] * 0.5 + 0.5) * 255;
    data[i * 4 + 2] = Math.sqrt(Math.max(0, 1 - n[0][i] * n[0][i] - n[1][i] * n[1][i])) * 127.5 + 127.5;
    data[i * 4 + 3] = 255;
  }
  return { map, normalMap: dataTexture(data, size, false) };
}

/** 獨立的岩石貼圖組（石頭模型用；法線是標準的 RGB 切線空間格式） */
export function buildRockMaterialMaps(photos = {}) {
  if (photos.rock && photos.rockN) return { map: tuneTexture(photos.rock), normalMap: tuneTexture(photos.rockN, false) };
  const rock = makeRock();
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const x = rock.normals[0][i];
    const y = rock.normals[1][i];
    data[i * 4] = (x * 0.5 + 0.5) * 255;
    data[i * 4 + 1] = (y * 0.5 + 0.5) * 255;
    data[i * 4 + 2] = Math.sqrt(Math.max(0, 1 - x * x - y * y)) * 127.5 + 127.5;
    data[i * 4 + 3] = 255;
  }
  return { map: rock.map, normalMap: dataTexture(data, SIZE, false) };
}
