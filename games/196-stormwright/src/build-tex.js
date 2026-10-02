// 建材程序貼圖（開機時用 Canvas 畫，無下載）。每張 256 px = 2 m × 2 m，可無縫重複。
import * as THREE from 'three';
import { mulberry32 } from './shared.js';

const S = 256;
function mk() { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; }
function finish(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function shade(c, f) { const r = Math.min(255, ((c >> 16) & 255) * f) | 0, g = Math.min(255, ((c >> 8) & 255) * f) | 0, b = Math.min(255, (c & 255) * f) | 0; return `rgb(${r},${g},${b})`; }
function nail(g, x, y, r = 3.2) {
  for (const ox of [0, -S, S]) {
    g.fillStyle = 'rgba(40,20,5,.45)'; g.beginPath(); g.arc(x + ox + 1, y + 1.5, r, 0, 7); g.fill();
    g.fillStyle = '#d8d2c4'; g.beginPath(); g.arc(x + ox, y, r, 0, 7); g.fill();
    g.fillStyle = '#fff8e8'; g.beginPath(); g.arc(x + ox - 1, y - 1, r * 0.4, 0, 7); g.fill();
  }
}

// 木：暖色橫向木板（每 0.5 m 一塊）、木紋、板端釘子
export function woodTexture() {
  const [c, g] = mk(), R = mulberry32(11);
  const base = [0xe0a050, 0xd19040, 0xe6aa5a, 0xc98638];
  for (let b = 0; b < 4; b++) {
    const y = b * 64, col = base[b];
    g.fillStyle = shade(col, 1); g.fillRect(0, y, S, 64);
    g.fillStyle = shade(col, 1.12); g.fillRect(0, y + 3, S, 5);
    for (let i = 0; i < 26; i++) {
      const gy = y + 6 + R() * 52, gx = R() * S, len = 40 + R() * 150;
      g.strokeStyle = `rgba(110,60,18,${0.12 + R() * 0.2})`; g.lineWidth = 1 + R() * 1.4;
      g.beginPath(); g.moveTo(gx, gy);
      for (let k = 1; k <= 4; k++) g.lineTo((gx + (len / 4) * k) % S, gy + Math.sin(k + R() * 2) * 1.6);
      g.stroke();
    }
    g.fillStyle = 'rgba(90,45,12,.55)'; g.fillRect(0, y + 61, S, 3); // 板縫
    g.fillStyle = 'rgba(255,230,170,.35)'; g.fillRect(0, y, S, 2);
    nail(g, 12, y + 20); nail(g, 12, y + 44); nail(g, S - 12, y + 20); nail(g, S - 12, y + 44);
  }
  return finish(c);
}
// 石：灰藍磚塊（1 m × 0.5 m，錯縫）
export function stoneTexture() {
  const [c, g] = mk(), R = mulberry32(23);
  g.fillStyle = '#4a5670'; g.fillRect(0, 0, S, S);
  const tones = [0, 1, 2, 3].map(() => [0.88 + R() * 0.26, 0.88 + R() * 0.26]);
  for (let row = 0; row < 4; row++) {
    const y = row * 64, off = row % 2 ? 64 : 0;
    for (let b = -1; b < 3; b++) {
      const x = b * 128 + off, tone = tones[row][((b % 2) + 2) % 2];
      const cx = x + 4, cy = y + 4, w = 120, h = 56;
      g.fillStyle = shade(0x95a8c6, tone); g.beginPath(); g.roundRect(cx, cy, w, h, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(cx + 4, cy + 2, w - 8, 4);
      g.fillStyle = 'rgba(30,40,70,.22)'; g.fillRect(cx + 4, cy + h - 7, w - 8, 5);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '40,50,80'},${0.05 + R() * 0.08})`; g.fillRect(cx + R() * w, cy + R() * h, 2 + R() * 4, 2); }
      if (R() > 0.7) { g.strokeStyle = 'rgba(40,50,80,.4)'; g.lineWidth = 1.5; g.beginPath(); const sx = cx + 20 + R() * 70; g.moveTo(sx, cy + 4); g.lineTo(sx + 10 - R() * 20, cy + h * 0.5); g.lineTo(sx + 8 - R() * 16, cy + h - 4); g.stroke(); }
    }
  }
  // 因為 roundRect 在 canvas 邊界會被切，補一次平移複製以確保無縫
  return finish(c);
}
// 金屬：縱向波浪鐵皮、鉚釘、橫向接縫
export function metalTexture() {
  const [c, g] = mk();
  for (let x = 0; x < S; x++) {
    const ph = (x / S) * 8 * Math.PI * 2, s = Math.sin(ph), l = 0.78 + 0.22 * s;
    g.fillStyle = `rgb(${(150 * l + 25) | 0},${(172 * l + 28) | 0},${(190 * l + 30) | 0})`; g.fillRect(x, 0, 1, S);
    if (s > 0.9) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x, 0, 1, S); }
  }
  for (const y of [0, 128]) {
    g.fillStyle = 'rgba(30,45,60,.55)'; g.fillRect(0, y, S, 5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y + 5, S, 2);
    for (let x = 16; x < S; x += 32) {
      g.fillStyle = 'rgba(20,30,45,.5)'; g.beginPath(); g.arc(x + 1, y + 16.5, 5, 0, 7); g.fill();
      g.fillStyle = '#c8d4de'; g.beginPath(); g.arc(x, y + 15, 4.6, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1.4, y + 13.4, 1.6, 0, 7); g.fill();
    }
  }
  const R = mulberry32(5);
  for (let i = 0; i < 24; i++) { g.strokeStyle = `rgba(255,255,255,${0.04 + R() * 0.06})`; g.lineWidth = 1; g.beginPath(); const x = R() * S, y = R() * S; g.moveTo(x, y); g.lineTo(x + 6 + R() * 20, y + 2 + R() * 6); g.stroke(); }
  return finish(c);
}
export function makeTextures() { return [woodTexture(), stoneTexture(), metalTexture()]; }
// 碎片配色
export const DEBRIS_COLORS = [[0xe0a050, 0xc98638, 0xa56a2a, 0xf0c070], [0x95a8c6, 0x7d90b0, 0xb4c4dc, 0x5c6c88], [0xb8c6d4, 0x8fa0b2, 0xdce6ee, 0x6d7e90]];
void hex;
