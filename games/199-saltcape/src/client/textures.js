// 程序貼圖：全部在 canvas 上即時畫，不載入任何圖檔。
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const S = 256;
function canvas(size = S) { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')]; }
function noise(ctx, size, amt, r, light = true) {
  const img = ctx.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  void light;
}
function blotches(ctx, size, n, r, col, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = r() * size, y = r() * size, rr = rmin + r() * (rmax - rmin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, col.replace('A', alpha)); g.addColorStop(1, col.replace('A', 0));
    ctx.fillStyle = g;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { ctx.save(); ctx.translate(ox, oy); ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); ctx.restore(); }
  }
}
function tex(c, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(rep, rep);
  return t;
}

export function makeTextures() {
  const r = mulberry32(42);
  const T = {};
  // 灰泥：白底帶斑駁與雨痕（以白為底，顏色由頂點色乘上）
  {
    const [c, x] = canvas();
    x.fillStyle = '#e9e4da'; x.fillRect(0, 0, S, S);
    blotches(x, S, 40, r, 'rgba(160,140,110,A)', 10, 50, 0.12);
    blotches(x, S, 30, r, 'rgba(255,255,255,A)', 8, 40, 0.18);
    for (let i = 0; i < 26; i++) { const xx = r() * S; x.fillStyle = `rgba(110,95,75,${0.04 + r() * 0.05})`; x.fillRect(xx, r() * S * 0.3, 1 + r() * 2, 30 + r() * 90); }
    noise(x, S, 18, r);
    T.plaster = tex(c, 1 / 3);
  }
  // 紅磚
  {
    const [c, x] = canvas();
    x.fillStyle = '#8f8576'; x.fillRect(0, 0, S, S);
    const bh = 16, bw = 42;
    for (let row = 0; row < S / bh; row++) for (let k = -1; k < S / bw + 1; k++) {
      const ox = (row % 2) * bw / 2 + k * bw;
      const v = 150 + r() * 50;
      x.fillStyle = `rgb(${v + 20},${v * 0.52},${v * 0.38})`;
      x.fillRect(ox + 1.5, row * bh + 1.5, bw - 3, bh - 3);
    }
    noise(x, S, 22, r);
    T.brick = tex(c, 1 / 2.4);
  }
  // 木地板
  {
    const [c, x] = canvas();
    for (let i = 0; i < 8; i++) {
      const v = 120 + r() * 50;
      x.fillStyle = `rgb(${v},${v * 0.7},${v * 0.45})`; x.fillRect(0, i * 32, S, 32);
      x.fillStyle = 'rgba(40,25,10,.5)'; x.fillRect(0, i * 32, S, 1.5);
      const off = r() * S; x.fillRect(off, i * 32, 1.5, 32);
      for (let g = 0; g < 14; g++) { x.fillStyle = `rgba(60,35,15,${0.05 + r() * 0.08})`; x.fillRect(r() * S, i * 32 + r() * 30, 20 + r() * 80, 1); }
    }
    noise(x, S, 14, r);
    T.wood = tex(c, 1 / 2.5);
  }
  // 磁磚
  {
    const [c, x] = canvas();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const v = 200 + r() * 30, warm = (i + j) % 2;
      x.fillStyle = warm ? `rgb(${v},${v * 0.86},${v * 0.72})` : `rgb(${v * 0.78},${v * 0.5},${v * 0.36})`;
      x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
    }
    noise(x, S, 10, r);
    T.tile = tex(c, 1 / 2);
  }
  // 混凝土
  {
    const [c, x] = canvas();
    x.fillStyle = '#b9b3a8'; x.fillRect(0, 0, S, S);
    blotches(x, S, 50, r, 'rgba(90,85,75,A)', 6, 40, 0.13);
    x.strokeStyle = 'rgba(70,65,58,.25)'; x.lineWidth = 1;
    for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(0, i * 128); x.lineTo(S, i * 128); x.stroke(); }
    noise(x, S, 26, r);
    T.concrete = tex(c, 1 / 4);
  }
  // 浪板鐵皮
  {
    const [c, x] = canvas();
    for (let i = 0; i < S; i++) { const v = 190 + Math.sin(i / S * Math.PI * 24) * 40; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, S); }
    blotches(x, S, 12, r, 'rgba(120,70,40,A)', 8, 40, 0.2);
    noise(x, S, 12, r);
    T.metal = tex(c, 1 / 3);
  }
  // 鏽鐵屋頂
  {
    const [c, x] = canvas();
    for (let i = 0; i < S; i++) { const v = 150 + Math.sin(i / S * Math.PI * 20) * 30; x.fillStyle = `rgb(${v * 0.85},${v * 0.55},${v * 0.4})`; x.fillRect(i, 0, 1, S); }
    blotches(x, S, 40, r, 'rgba(80,40,20,A)', 6, 40, 0.3);
    noise(x, S, 18, r);
    T.rust = tex(c, 1 / 3);
  }
  // 貨櫃（白底波紋，染色靠頂點色）
  {
    const [c, x] = canvas();
    for (let i = 0; i < S; i++) { const v = 205 + ((i % 21) < 3 ? -60 : (i % 21) < 11 ? 25 : 0); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, S); }
    blotches(x, S, 18, r, 'rgba(110,60,30,A)', 4, 30, 0.25);
    noise(x, S, 12, r);
    T.container = tex(c, 1 / 2.6);
  }
  // 石塊
  {
    const [c, x] = canvas();
    x.fillStyle = '#9d9483'; x.fillRect(0, 0, S, S);
    for (let row = 0; row < 8; row++) { let xx = -r() * 40; while (xx < S) { const w = 30 + r() * 40, v = 170 + r() * 50; x.fillStyle = `rgb(${v},${v * 0.95},${v * 0.86})`; x.fillRect(xx + 1.5, row * 32 + 1.5, w - 3, 29); xx += w; } }
    noise(x, S, 26, r);
    T.stone = tex(c, 1 / 3);
  }
  // 瓦屋頂
  {
    const [c, x] = canvas();
    for (let row = 0; row < 16; row++) for (let k = 0; k < 9; k++) {
      const v = 160 + r() * 40, ox = (row % 2) * 16 + k * 32;
      const g = x.createLinearGradient(0, row * 16, 0, row * 16 + 16);
      g.addColorStop(0, `rgb(${v + 30},${v * 0.55},${v * 0.36})`); g.addColorStop(1, `rgb(${v * 0.7},${v * 0.36},${v * 0.24})`);
      x.fillStyle = g; x.fillRect(ox, row * 16, 31, 16);
    }
    noise(x, S, 14, r);
    T.roof = tex(c, 1 / 2);
  }
  // 木箱
  {
    const [c, x] = canvas();
    x.fillStyle = '#a77f4c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(60,35,10,${0.2 + r() * 0.2})`; x.fillRect(0, i * 43, S, 2); }
    x.strokeStyle = '#6b4b25'; x.lineWidth = 12; x.strokeRect(6, 6, S - 12, S - 12);
    x.beginPath(); x.moveTo(6, 6); x.lineTo(S - 6, S - 6); x.stroke();
    noise(x, S, 18, r);
    T.crate = tex(c, 1 / 2.4);
  }
  // 廟：朱紅漆
  {
    const [c, x] = canvas();
    x.fillStyle = '#b13a24'; x.fillRect(0, 0, S, S);
    blotches(x, S, 30, r, 'rgba(60,10,5,A)', 6, 40, 0.18);
    x.fillStyle = '#d9a64a'; x.fillRect(0, 230, S, 10);
    noise(x, S, 14, r);
    T.temple = tex(c, 1 / 3);
  }
  // 柏油（中央虛線另外畫在道路貼圖）
  {
    const [c, x] = canvas();
    x.fillStyle = '#5d5850'; x.fillRect(0, 0, S, S);
    blotches(x, S, 40, r, 'rgba(20,18,15,A)', 6, 30, 0.25);
    noise(x, S, 30, r);
    T.asphalt = tex(c, 1 / 6);
  }
  {
    const [c, x] = canvas(256);
    x.fillStyle = '#5a554d'; x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 30, r, 'rgba(25,22,18,A)', 6, 26, 0.25);
    noise(x, 256, 26, r);
    x.fillStyle = 'rgba(232,214,170,.85)';
    x.fillRect(124, 0, 8, 140);
    x.fillStyle = 'rgba(232,226,214,.6)'; x.fillRect(8, 0, 5, 256); x.fillRect(243, 0, 5, 256);
    const t = tex(c, 1); t.repeat.set(1, 1); T.road = t;
  }
  // 鋪面（廟埕、港區）
  {
    const [c, x] = canvas();
    x.fillStyle = '#a49a89'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const v = 150 + r() * 40; x.fillStyle = `rgb(${v},${v * 0.95},${v * 0.88})`; x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    noise(x, S, 20, r);
    T.pave = tex(c, 1 / 4);
  }
  // 地表細節（灰階，乘上頂點色）
  {
    const [c, x] = canvas(512);
    x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 220, r, 'rgba(255,255,255,A)', 4, 26, 0.16);
    blotches(x, 512, 220, r, 'rgba(60,60,60,A)', 3, 20, 0.12);
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '40,40,40' : '255,255,255'},${r() * 0.2})`; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 2 + r() * 4); }
    noise(x, 512, 28, r);
    T.ground = tex(c, 1);
  }
  // 鹽
  {
    const [c, x] = canvas();
    x.fillStyle = '#f2efe6'; x.fillRect(0, 0, S, S);
    blotches(x, S, 30, r, 'rgba(180,170,150,A)', 4, 26, 0.15);
    noise(x, S, 20, r);
    T.salt = tex(c, 1 / 3);
  }
  // 窗玻璃（車窗）
  {
    const [c, x] = canvas(64);
    const g = x.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, '#6e7d80'); g.addColorStop(0.5, '#2a3233'); g.addColorStop(1, '#58666a');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    T.glass = tex(c, 1);
  }
  return T;
}

// 直式招牌：漆底白字
export function signTexture(text, color) {
  const pal = [['#a8321f', '#f6efe0'], ['#1f3f3a', '#f2e7c9'], ['#e2b33c', '#2a1d10'], ['#f1ebe0', '#a8321f']][color % 4];
  const c = document.createElement('canvas'); c.width = 64; c.height = 64 * Math.max(2, text.length);
  const x = c.getContext('2d');
  x.fillStyle = pal[0]; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = pal[1]; x.lineWidth = 3; x.strokeRect(4, 4, c.width - 8, c.height - 8);
  x.fillStyle = pal[1]; x.font = 'bold 44px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [...text].forEach((ch, i) => x.fillText(ch, 32, 32 + i * 64 + 2));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// 美式店面的橫式招牌：深底白字或白底深字
export function hsignTexture(text, color) {
  const pal = [['#24343a', '#f3efe6'], ['#7a2a1e', '#f6ead2'], ['#efe9dc', '#27323a'], ['#2f4a2c', '#efe6cc']][color % 4];
  const c = document.createElement('canvas'); c.width = 64 * Math.max(4, text.length + 2); c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = pal[0]; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = pal[1]; x.globalAlpha = 0.6; x.lineWidth = 2; x.strokeRect(5, 5, c.width - 10, c.height - 10); x.globalAlpha = 1;
  x.fillStyle = pal[1]; x.font = 'bold 40px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
