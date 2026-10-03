import * as THREE from 'three';
import { mulberry32, lerp, clamp } from '../core/noise.js';

/** 週期性 lattice value noise：格點以 period 取模，貼圖邊界自然接得起來 */
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
    const g = (i, j) => grid[(j % period) * period + (i % period)];
    return lerp(lerp(g(x0, y0), g(x0 + 1, y0), sx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), sx), sy);
  };
}

function fractal(rand, periods) {
  const layers = periods.map((p, i) => [tileNoise(rand, p), 1 / (i + 1)]);
  const norm = layers.reduce((s, l) => s + l[1], 0);
  return (u, v) => layers.reduce((s, [fn, amp]) => s + fn(u, v) * amp, 0) / norm;
}

/**
 * 地表細節貼圖：四種地表各佔一個 channel，值以 0.5 為中心（shader 內 ×2 當乘數）。
 * R = 草地、G = 岩石、B = 沙、A = 泥土。遠處 mipmap 會收斂到 0.5，自然不會有重複感。
 */
export function makeGroundDetail(size = 256) {
  const rand = mulberry32(4711);
  const grass = fractal(rand, [8, 24, 64, 128]);
  const grassFine = tileNoise(rand, 256);
  const rockA = fractal(rand, [5, 13, 32]);
  const rockB = fractal(rand, [9, 27, 80]);
  const sand = fractal(rand, [40, 128, 256]);
  const dirt = fractal(rand, [7, 20, 90]);
  const pebble = tileNoise(rand, 48);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const g = 0.5 + (grass(u, v) - 0.5) * 0.9 + (grassFine(u, v) - 0.5) * 0.35;
      // 岩石：ridged noise 做出裂紋
      const crack = 1 - Math.abs(rockB(u, v) - 0.5) * 2;
      const r = 0.5 + (rockA(u, v) - 0.5) * 0.9 - Math.pow(crack, 6) * 0.45;
      const s = 0.5 + (sand(u, v) - 0.5) * 0.4;
      const peb = pebble(u, v);
      const d = 0.5 + (dirt(u, v) - 0.5) * 0.8 + (peb > 0.78 ? 0.22 : 0) - (peb < 0.15 ? 0.12 : 0);
      const k = (y * size + x) * 4;
      data[k] = clamp(g, 0, 1) * 255;
      data[k + 1] = clamp(r, 0, 1) * 255;
      data[k + 2] = clamp(s, 0, 1) * 255;
      data[k + 3] = clamp(d, 0, 1) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function canvasTexture(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** 木板：直向木紋＋板縫 */
export function makeWoodTexture(base = [128, 92, 58]) {
  const rand = mulberry32(88);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = `rgb(${base.join(',')})`;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 20 + rand() * 90;
      const shade = rand() < 0.5 ? 0 : 255;
      g.strokeStyle = `rgba(${shade},${shade},${shade},${0.03 + rand() * 0.07})`;
      g.lineWidth = 0.6 + rand() * 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + (rand() - 0.5) * 6, y + len * 0.3, x + (rand() - 0.5) * 6, y + len * 0.7, x + (rand() - 0.5) * 4, y + len);
      g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const x = (i * w) / 4;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(x, 0, 2, h);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + 2, 0, 1.5, h);
    }
    for (let i = 0; i < 5; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const grad = g.createRadialGradient(x, y, 0, x, y, 7);
      grad.addColorStop(0, 'rgba(40,24,12,0.7)');
      grad.addColorStop(1, 'rgba(40,24,12,0)');
      g.fillStyle = grad;
      g.fillRect(x - 8, y - 8, 16, 16);
    }
  });
}

/** 帆布：織紋＋不均勻的舊化 */
export function makeCanvasTexture(base = [176, 160, 118]) {
  const rand = mulberry32(51);
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = `rgb(${base.join(',')})`;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.05})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = `rgba(255,255,255,${0.03 + rand() * 0.05})`;
      g.fillRect(x, 0, 1, h);
    }
    for (let i = 0; i < 14; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 10 + rand() * 30;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(60,50,30,${0.05 + rand() * 0.1})`);
      grad.addColorStop(1, 'rgba(60,50,30,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

/** 柔邊圓點：煙、螢火蟲、光暈共用 */
export function makeSoftSprite() {
  return canvasTexture(
    64,
    64,
    (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    },
    false,
  );
}

/** 月面：亮盤＋幾塊暗色月海與坑 */
export function makeMoonTexture() {
  const rand = mulberry32(1969);
  return canvasTexture(
    128,
    128,
    (g) => {
      g.clearRect(0, 0, 128, 128);
      g.beginPath();
      g.arc(64, 64, 62, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#eef0f6';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 9; i++) {
        const x = 20 + rand() * 88;
        const y = 20 + rand() * 88;
        const r = 8 + rand() * 20;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(120,128,150,0.5)');
        grad.addColorStop(1, 'rgba(120,128,150,0)');
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        g.arc(rand() * 128, rand() * 128, 1 + rand() * 3, 0, Math.PI * 2);
        g.fillStyle = `rgba(110,118,140,${0.2 + rand() * 0.3})`;
        g.fill();
      }
    },
    false,
  );
}
