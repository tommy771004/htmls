import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

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
