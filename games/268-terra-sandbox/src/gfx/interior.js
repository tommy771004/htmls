// 室內網格：把 core/interior.js 的格局（房間、牆、門洞、家具、樓梯、燈）轉成一個合併網格。
// 只在玩家進入建物時建一次；外層建物以 uCutY／uCutBox 切開，攝影機從斜上方看進來。
import * as THREE from 'three';
import { Builder, P, mat } from './geo.js';
import { getAtlas } from './atlas.js';

const WALL_T = 0.12;

function rot(B, f, y, w, h, d, c, dx = 0, dz = 0, dy = 0) {
  // 家具座標系：中心 (f.x, f.z)，沿 f.rot 旋轉的局部偏移
  const cs = Math.cos(f.rot || 0);
  const sn = Math.sin(f.rot || 0);
  B.geom(P.box(), mat(f.x + dx * cs - dz * sn, y + dy + h / 2, f.z + dx * sn + dz * cs, w, h, d, 0, -(f.rot || 0), 0), c);
}

function furniture(B, f, y0) {
  const y = y0 + (f.y || 0);
  const { w, d, h, color: c } = f;
  switch (f.kind) {
    case 'bed':
      rot(B, f, y, w, 0.28, d, 0x6b5a48);
      rot(B, f, y + 0.28, w - 0.06, 0.2, d - 0.06, 0xf1ede6);
      rot(B, f, y + 0.48, w - 0.04, 0.06, d * 0.62, c, 0, d * 0.18);
      rot(B, f, y + 0.48, w * 0.36, 0.12, 0.32, 0xffffff, -w * 0.22, -d / 2 + 0.3);
      rot(B, f, y + 0.48, w * 0.36, 0.12, 0.32, 0xffffff, w * 0.22, -d / 2 + 0.3);
      rot(B, f, y, w, 0.95, 0.08, 0x5a4a3c, 0, -d / 2);
      break;
    case 'sofa':
      rot(B, f, y, w, 0.42, d, c);
      rot(B, f, y + 0.42, w, 0.42, 0.2, c, 0, d / 2 - 0.1);
      rot(B, f, y + 0.42, 0.18, 0.22, d, c, -w / 2 + 0.09);
      rot(B, f, y + 0.42, 0.18, 0.22, d, c, w / 2 - 0.09);
      for (let k = 0; k < 3; k++) rot(B, f, y + 0.42, w / 3 - 0.08, 0.1, d - 0.3, 0xffffff - 0x101010, (k - 1) * (w / 3), -0.05);
      break;
    case 'table':
    case 'desk':
      rot(B, f, y + h - 0.05, w, 0.05, d, c);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) rot(B, f, y, 0.05, h - 0.05, 0.05, 0x3a3f45, sx * (w / 2 - 0.06), sz * (d / 2 - 0.06));
      if (f.kind === 'desk') rot(B, f, y + h, 0.36, 0.02, 0.24, 0x2a2e33, -w * 0.25, 0.1);
      break;
    case 'chair':
      rot(B, f, y + 0.44, w, 0.05, d, c);
      rot(B, f, y + 0.44, w, 0.48, 0.05, c, 0, d / 2 - 0.03);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) rot(B, f, y, 0.04, 0.44, 0.04, 0x30343a, sx * (w / 2 - 0.04), sz * (d / 2 - 0.04));
      break;
    case 'bench':
      rot(B, f, y + h - 0.06, w, 0.06, d, c);
      rot(B, f, y, 0.08, h - 0.06, d * 0.8, 0x3a3f45, -w / 2 + 0.2);
      rot(B, f, y, 0.08, h - 0.06, d * 0.8, 0x3a3f45, w / 2 - 0.2);
      break;
    case 'shelf': {
      rot(B, f, y, w, h, 0.04, c, 0, d / 2 - 0.02);
      const n = Math.max(3, Math.round(h / 0.42));
      for (let k = 0; k <= n; k++) {
        rot(B, f, y + (k * (h - 0.05)) / n, w, 0.04, d, c);
        if (k < n) {
          // 架上的商品／書
          const cols = [0xd94f3d, 0x3b82c4, 0xe8b33a, 0x4caf7a, 0xf1ede6, 0x7b5ea7];
          let x = -w / 2 + 0.06;
          let i = (k * 7 + Math.round(f.x * 3)) % cols.length;
          while (x < w / 2 - 0.12) {
            const bw = 0.06 + ((i * 13) % 5) * 0.03;
            rot(B, f, y + (k * (h - 0.05)) / n + 0.04, bw, ((h - 0.05) / n) * (0.55 + ((i * 7) % 4) * 0.1), d * 0.75, cols[i % cols.length], x + bw / 2, -0.02);
            x += bw + 0.015;
            i++;
          }
        }
      }
      for (const s of [-1, 1]) rot(B, f, y, 0.04, h, d, c, s * (w / 2 - 0.02));
      break;
    }
    case 'counter':
      rot(B, f, y, w, h - 0.05, d, c);
      rot(B, f, y + h - 0.05, w + 0.05, 0.05, d + 0.05, 0xe9e4da);
      break;
    case 'display':
      rot(B, f, y, w, h * 0.6, d, c);
      rot(B, f, y + h * 0.6, w, h * 0.4, d, 0xcfe6ee);
      break;
    case 'plant':
      rot(B, f, y, w * 0.7, 0.4, d * 0.7, 0xb5643c);
      B.geom(P.ico(1), mat(f.x, y + 0.4 + h * 0.35, f.z, w * 0.75, h * 0.45, d * 0.75), 0x4f8f3a);
      break;
    case 'flowers':
      rot(B, f, y, w * 0.7, 0.18, d * 0.7, 0x8f6a46);
      for (let k = 0; k < 5; k++) B.geom(P.sphere(6, 4), mat(f.x + Math.cos(k * 1.3) * w * 0.25, y + 0.18 + h * 0.5, f.z + Math.sin(k * 1.3) * d * 0.25, w * 0.18, h * 0.3, d * 0.18), k % 2 ? c : 0x4f8f3a);
      break;
    case 'tier':
      for (let k = 0; k < 3; k++) rot(B, f, y + k * 0.35, w - k * 0.25, 0.04, d - k * 0.2, c, 0, k * 0.1);
      break;
    case 'rug':
      rot(B, f, y + 0.005, w, 0.015, d, c);
      break;
    case 'tv':
    case 'screen':
    case 'monitor':
      rot(B, f, y, w, h, Math.max(0.04, d), 0x14181d);
      rot(B, f, y + h * 0.06, w * 0.94, h * 0.86, 0.01, f.kind === 'monitor' ? 0x2f5d88 : 0x1d2a3a, 0, -Math.max(0.04, d) / 2 - 0.006);
      break;
    case 'fridge':
    case 'washer':
    case 'wardrobe':
      rot(B, f, y, w, h, d, c);
      rot(B, f, y + h * 0.4, 0.03, h * 0.3, 0.03, 0x9aa0a6, w * 0.38, -d / 2 - 0.02);
      if (f.kind === 'washer') B.geom(P.cyl(16), mat(f.x, y + h * 0.5, f.z - d / 2 - 0.01, w * 0.3, 0.02, w * 0.3, Math.PI / 2, 0, 0), 0x41474f);
      break;
    case 'toilet':
      rot(B, f, y, w * 0.7, 0.42, d * 0.6, 0xf4f4f1, 0, -d * 0.1);
      rot(B, f, y, w, 0.8, 0.18, 0xf4f4f1, 0, d / 2 - 0.09);
      break;
    case 'tub':
      rot(B, f, y, w, h, d, 0xf4f4f1);
      rot(B, f, y + h - 0.02, w - 0.14, 0.03, d - 0.14, 0x9ccde0);
      break;
    case 'sink':
      rot(B, f, y, w, h, d, c);
      rot(B, f, y + h, w * 0.5, 0.03, d * 0.5, 0xdfe5ea);
      break;
    case 'stairs': {
      const n = Math.max(8, Math.round(h / 0.18));
      const along = d > w;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const sy = (h * (k + 1)) / n;
        if (along) B.box(f.x - w / 2, y0, f.z + d / 2 - (t + 1 / n) * d, f.x + w / 2, y0 + sy, f.z + d / 2 - t * d, k % 2 ? 0x8d8478 : 0x958c80);
        else B.box(f.x - w / 2 + t * w, y0, f.z - d / 2, f.x - w / 2 + (t + 1 / n) * w, y0 + sy, f.z + d / 2, k % 2 ? 0x8d8478 : 0x958c80);
      }
      break;
    }
    case 'elevator':
      rot(B, f, y, w, h, d, 0xa7adb3);
      rot(B, f, y, w * 0.8, h * 0.9, 0.02, 0xc9ced3, 0, -d / 2 - 0.01);
      break;
    case 'fireplace':
      rot(B, f, y, w, h, d, 0x8c6e5a);
      rot(B, f, y + 0.1, w * 0.5, h * 0.4, 0.02, 0xff8a3d, 0, -d / 2 - 0.01);
      break;
    case 'frame':
      rot(B, f, y, w, h, d, 0xf4f1ea);
      rot(B, f, y + 0.08, w - 0.16, h - 0.16, 0.01, c, 0, -d / 2 - 0.006);
      break;
    default:
      rot(B, f, y, w, h, d, c);
  }
}

export function buildInterior(L) {
  const B = new Builder();
  const glass = new Builder();
  const glow = new Builder();
  const y0 = L.y;
  const H = Math.min(L.height, 3.2); // 剖面視角：牆只做到 3.2m，攝影機從上方看得進房間
  const A = getAtlas();
  const wood = A.rect('woodDeck');
  // 地板（每個房間一塊，用木地板圖磚；浴室與後場用素色）
  for (const r of L.rooms) {
    const tex = r.type === 'bath' || r.type === 'back' || r.type === 'stairs' ? null : wood;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    B.quad(r.x0, y0 + 0.02, r.z1, r.x1, y0 + 0.02, r.z1, r.x1, y0 + 0.02, r.z0, r.x0, y0 + 0.02, r.z0, r.floorColor, tex ? [0, 0, w / 2.4, 0, w / 2.4, d / 2.4, 0, d / 2.4] : null, tex);
    // 踢腳板顏色帶
    B.box(r.x0, y0, r.z0, r.x1, y0 + 0.02, r.z1, r.floorColor);
  }
  // 牆
  const roomAt = (x, z) => L.rooms.find((r) => x >= r.x0 - 0.01 && x <= r.x1 + 0.01 && z >= r.z0 - 0.01 && z <= r.z1 + 0.01);
  for (const w of L.walls) {
    const horiz = Math.abs(w.z1 - w.z0) < 1e-3;
    const x0 = Math.min(w.x0, w.x1) - (horiz ? 0 : WALL_T / 2);
    const x1 = Math.max(w.x0, w.x1) + (horiz ? 0 : WALL_T / 2);
    const z0 = Math.min(w.z0, w.z1) - (horiz ? WALL_T / 2 : 0);
    const z1 = Math.max(w.z0, w.z1) + (horiz ? WALL_T / 2 : 0);
    const mx = (w.x0 + w.x1) / 2;
    const mz = (w.z0 + w.z1) / 2;
    const r = roomAt(mx + (horiz ? 0 : 0.3), mz + (horiz ? 0.3 : 0)) || L.rooms[0];
    const col = r ? r.wallColor : 0xefe9de;
    if (w.glass) {
      // 店面玻璃：下方矮牆＋玻璃＋門楣
      B.box(x0, y0, z0, x1, y0 + 0.5, z1, 0x3a3f45);
      glass.box(x0, y0 + 0.5, z0, x1, y0 + H - 0.7, z1, 0xbfe0ee);
      B.box(x0, y0 + H - 0.7, z0, x1, y0 + H, z1, 0x3a3f45);
    } else if (w.windows) {
      // 外牆：窗台以下實牆、窗戶帶玻璃、上方實牆；窗框每 2.4m 一根
      const len = horiz ? x1 - x0 : z1 - z0;
      B.box(x0, y0, z0, x1, y0 + 0.9, z1, col);
      B.box(x0, y0 + H - 0.55, z0, x1, y0 + H, z1, col);
      const n = Math.max(1, Math.round(len / 2.4));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const px = horiz ? x0 + t * (x1 - x0) : mx;
        const pz = horiz ? mz : z0 + t * (z1 - z0);
        const hw = k === 0 || k === n ? 0.35 : 0.22;
        if (horiz) B.box(Math.max(x0, px - hw), y0 + 0.9, z0, Math.min(x1, px + hw), y0 + H - 0.55, z1, col);
        else B.box(x0, y0 + 0.9, Math.max(z0, pz - hw), x1, y0 + H - 0.55, Math.min(z1, pz + hw), col);
      }
      glass.box(x0 + (horiz ? 0 : 0.04), y0 + 0.9, z0 + (horiz ? 0.04 : 0), x1 - (horiz ? 0 : 0.04), y0 + H - 0.55, z1 - (horiz ? 0.04 : 0), 0xbfe0ee);
    } else {
      B.box(x0, y0, z0, x1, y0 + H - 0.02, z1, col, true);
    }
  }
  // 門框
  for (const d of L.doors) {
    const ax = d.axis === 'x';
    const t = WALL_T / 2 + 0.02;
    B.box(d.x - (ax ? 0.5 : t), y0 + 2.1, d.z - (ax ? t : 0.5), d.x + (ax ? 0.5 : t), y0 + H - 0.02, d.z + (ax ? t : 0.5), 0xe9e4da);
  }
  for (const f of L.furniture) furniture(B, f, y0);
  // 天花燈（發光面板）
  for (const l of L.lights) glow.geom(P.cyl(16), mat(l.x, y0 + H - 0.04, l.z, 0.35, 0.03, 0.35), 0xfff2d8);
  return { solid: B, glass, glow };
}
