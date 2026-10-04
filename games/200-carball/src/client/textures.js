// 程序貼圖：清水模牆、地坪、天花板、球門鐵網、足球。全部用 canvas 畫，不載入外部圖檔。
import * as THREE from 'three';
import { ARENA, PADS_BIG, PADS_SMALL } from '../core/const.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// 可重現的雜訊
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 平滑值雜訊（可平鋪）
function valueNoise(w, h, cell, seed) {
  const r = rng(seed);
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const g = new Float32Array(gw * gh).map(() => r());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / cell, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < w; x++) {
      const fx = x / cell, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
      const a = g[(iy % gh) * gw + (ix % gw)], b = g[(iy % gh) * gw + ((ix + 1) % gw)];
      const c = g[((iy + 1) % gh) * gw + (ix % gw)], d = g[((iy + 1) % gh) * gw + ((ix + 1) % gw)];
      out[y * w + x] = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    }
  }
  return out;
}

function tex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 清水模：一塊 2.4 m 見方，橫向模板 0.3 m 一條，四個繫結孔
export function boardFormTexture() {
  const S = 512;
  const [c, g] = canvas(S, S);
  const n1 = valueNoise(S, S, 64, 3), n2 = valueNoise(S, S, 12, 7), n3 = valueNoise(S, S, 3, 11);
  const img = g.createImageData(S, S);
  const r = rng(5);
  const boards = 8, bh = S / boards;
  const shade = Array.from({ length: boards }, () => 0.94 + r() * 0.1);
  for (let y = 0; y < S; y++) {
    const bi = Math.floor(y / bh), by = (y % bh) / bh;
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      // 木紋：沿模板方向拉長的雜訊
      const grain = Math.sin((x * 0.07 + n2[i] * 9 + bi * 13)) * 0.012;
      let v = 0.78 * shade[bi] + (n1[i] - 0.5) * 0.07 + (n3[i] - 0.5) * 0.012 + grain * 0.6;
      // 模板接縫：上下各一條細暗線，下緣微亮（溢漿）
      if (by < 0.025) v -= 0.12 * (1 - by / 0.025);
      else if (by > 0.975) v += 0.05;
      const k = Math.max(0, Math.min(1, v));
      const o = i * 4;
      img.data[o] = 168 * k + 18; img.data[o + 1] = 162 * k + 16; img.data[o + 2] = 152 * k + 14; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // 繫結孔：每塊 2×2 個
  for (const [tx, ty] of [[0.25, 0.3125], [0.75, 0.3125], [0.25, 0.8125], [0.75, 0.8125]]) {
    const x = tx * S, y = ty * S;
    const grd = g.createRadialGradient(x, y + 1, 1, x, y, 6);
    grd.addColorStop(0, 'rgba(70,64,58,0.7)'); grd.addColorStop(0.6, 'rgba(100,94,86,0.35)'); grd.addColorStop(1, 'rgba(100,94,86,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

// 地坪：鏝光混凝土、6.4 m 的伸縮縫、兩隊半場淡淡的顏色、白線與補給點的圈
export function floorTexture() {
  const { A, B, GD, GW } = ARENA;
  const W = 1600, L = B + GD, H = Math.round(W * L / A);
  const [c, g] = canvas(W, H);
  const px = W / (2 * A);                // 每公尺幾個像素
  const X = (x) => (x + A) * px, Z = (z) => (z + L) * px;
  const n1 = valueNoise(W, H, 160, 31), n2 = valueNoise(W, H, 22, 37);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const z = y / px - L;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = 0.5 + (n1[i] - 0.5) * 0.12 + (n2[i] - 0.5) * 0.05;
      // 半場色：靠近中線淡、靠近球門濃
      const t = Math.min(1, Math.abs(z) / B) * 0.22;
      let r = 150 * v, gg = 145 * v, b = 136 * v;
      // 白堊隊的半場偏亮、煤煙隊的半場偏暗
      if (z < 0) { r += (214 - r) * t; gg += (208 - gg) * t; b += (196 - b) * t; }
      else { r += (40 - r) * t; gg += (37 - gg) * t; b += (33 - b) * t; }
      const o = i * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // 伸縮縫
  g.strokeStyle = 'rgba(30,27,24,0.45)'; g.lineWidth = 2;
  for (let x = -A + 6.4; x < A; x += 6.4) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); }
  for (let z = 0; z < L; z += 6.4) for (const s of [1, -1]) { if (!z && s < 0) continue; g.beginPath(); g.moveTo(0, Z(z * s)); g.lineTo(W, Z(z * s)); g.stroke(); }
  // 白線：漆料略帶磨損
  const line = (w) => { g.lineWidth = w * px; g.strokeStyle = 'rgba(236,230,214,0.82)'; };
  line(0.28);
  g.beginPath(); g.moveTo(0, Z(0)); g.lineTo(W, Z(0)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), 10 * px, 0, Math.PI * 2); g.stroke();
  line(0.22);
  for (const s of [-1, 1]) {
    // 球門前的禁區框
    const z0 = Z(s * B), z1 = Z(s * (B - 12));
    g.beginPath(); g.moveTo(X(-GW - 6), z0); g.lineTo(X(-GW - 6), z1); g.lineTo(X(GW + 6), z1); g.lineTo(X(GW + 6), z0); g.stroke();
    // 球門線
    g.beginPath(); g.moveTo(X(-GW), Z(s * B)); g.lineTo(X(GW), Z(s * B)); g.stroke();
    g.beginPath(); g.arc(X(0), Z(s * (B - 12)), 6 * px, s > 0 ? Math.PI : 0, s > 0 ? Math.PI * 2 : Math.PI); g.stroke();
  }
  // 中圈內的大字樣：開球點
  g.fillStyle = 'rgba(236,230,214,0.82)';
  g.beginPath(); g.arc(X(0), Z(0), 0.5 * px, 0, Math.PI * 2); g.fill();
  // 補給點的地面圈
  g.strokeStyle = 'rgba(226,162,59,0.75)';
  for (const [x, z] of PADS_BIG) { g.lineWidth = 0.18 * px; g.beginPath(); g.arc(X(x), Z(z), 2.3 * px, 0, Math.PI * 2); g.stroke(); }
  for (const [x, z] of PADS_SMALL) { g.lineWidth = 0.1 * px; g.beginPath(); g.arc(X(x), Z(z), 1.1 * px, 0, Math.PI * 2); g.stroke(); }
  // 磨損：一些亂數擦痕把白線吃掉一點
  const r = rng(77);
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, len = 8 + r() * 50, a = r() * Math.PI;
    g.strokeStyle = `rgba(${140 + r() * 50},${135 + r() * 50},${125 + r() * 50},${0.05 + r() * 0.08})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  const t = tex(c, false);
  t.anisotropy = 16;
  return t;
}

// 天花板：井字格梁，中間五條長天窗
export function ceilingTextures() {
  const { A, B } = ARENA;
  const W = 512, H = Math.round(W * B / A);
  const [c, g] = canvas(W, H);
  const [e, ge] = canvas(W, H);
  const px = W / (2 * A);
  const n = valueNoise(W, H, 40, 91);
  const img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = 70 + (n[i] - 0.5) * 22; img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.97; img.data[i * 4 + 2] = v * 0.93; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  // 梁
  g.fillStyle = 'rgba(40,37,33,0.9)';
  for (let x = -A; x <= A; x += 8.2) g.fillRect((x + A) * px - 3, 0, 6, H);
  for (let z = -B; z <= B; z += 8.5) g.fillRect(0, (z + B) * px - 2, W, 4);
  // 天窗
  for (const x of [-24.6, -12.3, 0, 12.3, 24.6]) {
    const x0 = (x + A) * px - 1.4 * px, w = 2.8 * px;
    g.fillStyle = '#d9dcd6'; g.fillRect(x0, 6 * px, w, H - 12 * px);
    ge.fillStyle = '#e8ecef'; ge.fillRect(x0, 6 * px, w, H - 12 * px);
    ge.fillStyle = '#000';
    for (let z = 0; z < H; z += 4.25 * px) ge.fillRect(x0, z, w, 2);
  }
  const t = tex(c, false), te = tex(e, false);
  return [t, te];
}

// 球門內部：鐵網（透光）
export function cageTexture(color) {
  const S = 128;
  const [c, g] = canvas(S, S);
  g.clearRect(0, 0, S, S);
  g.strokeStyle = color; g.lineWidth = 5;
  for (let i = -S; i < S * 2; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke();
    g.beginPath(); g.moveTo(i + S, 0); g.lineTo(i, S); g.stroke();
  }
  return tex(c);
}

// 足球：12 塊五邊形深灰、20 塊六邊形米白，縫線處加深
export function soccerTexture() {
  const W = 1024, H = 512;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const phi = (1 + Math.sqrt(5)) / 2;
  const ico = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]]
    .map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
  // 二十面體的面中心＝六邊形中心
  const faces = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    const d = (a, b) => Math.hypot(ico[a][0] - ico[b][0], ico[a][1] - ico[b][1], ico[a][2] - ico[b][2]);
    if (d(i, j) < 1.1 && d(j, k) < 1.1 && d(i, k) < 1.1) {
      const v = [0, 1, 2].map((t) => ico[i][t] + ico[j][t] + ico[k][t]);
      const l = Math.hypot(...v); faces.push(v.map((x) => x / l));
    }
  }
  const centers = [...ico.map((v) => [v, 1]), ...faces.map((v) => [v, 0])];
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2;
      // three.js 球面 UV：u 對應 phi，v 對應 theta
      const px = -Math.cos(lon) * Math.cos(lat), py = Math.sin(lat), pz = Math.sin(lon) * Math.cos(lat);
      let b1 = -2, b2 = -2, kind = 0;
      for (const [v, k] of centers) {
        // 五邊形稍微放大，比例才像真的足球
        const d = (v[0] * px + v[1] * py + v[2] * pz) + (k ? 0.035 : 0);
        if (d > b1) { b2 = b1; b1 = d; kind = k; } else if (d > b2) b2 = d;
      }
      const seam = b1 - b2;
      let r, gg, b;
      if (kind) { r = 46; gg = 44; b = 42; } else { r = 233; gg = 226; b = 210; }
      const s = Math.min(1, seam / 0.012);
      const k = 0.55 + 0.45 * s;
      const o = (y * W + x) * 4;
      img.data[o] = r * k; img.data[o + 1] = gg * k; img.data[o + 2] = b * k; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, false);
}

// 牆上的大字（隊名），白漆、邊緣略有噴漆的毛邊
export function stencilTexture(text, sub, color) {
  const W = 2048, H = 512;
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 300px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  g.fillText(text, W / 2, H * 0.43);
  g.font = '700 74px Futura, "Century Gothic", "Trebuchet MS", sans-serif';
  g.fillText(sub, W / 2, H * 0.88);
  // 噴漆毛邊：用雜訊擦掉一些像素
  const img = g.getImageData(0, 0, W, H);
  const r = rng(9);
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] > 0 && r() < 0.08) img.data[i + 3] *= 0.4;
  g.putImageData(img, 0, 0);
  return tex(c, false);
}
