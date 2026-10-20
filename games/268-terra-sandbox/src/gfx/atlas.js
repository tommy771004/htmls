// 立面／地面圖集（2048² canvas 繪製）與共用的「世界材質」。
// 圖集 alpha 是遮罩：0 = 牆面（乘上頂點色）、0.5 = 窗框等不染色、0.75 = 帷幕玻璃（染色）、1 = 一般玻璃（不染色）。
// 著色器用 fract() 在圖集子區塊內重複貼圖，夜間依窗格雜湊點亮部分窗戶，玻璃比較光滑並反射環境。
import * as THREE from 'three';

const N = 8;
const T = 256;
const SIZE = N * T;

const NAMES = [
  'glassA', 'glassB', 'glassC', 'glassLobby', 'stoneWin', 'stoneWin2', 'stoneGround', 'stonePlain',
  'brickWin', 'brickWin2', 'brickPlain', 'brickGround', 'canalWin', 'canalWin2', 'canalGround', 'canalPlain',
  'stuccoWin', 'stuccoWin2', 'stuccoPlain', 'garage', 'stuccoGround', 'sidingWin', 'sidingPlain', 'sidingGround',
  'shopA', 'shopB', 'lodgeWin', 'lodgePlain', 'roofGravel', 'roofTile', 'roofSlate', 'attic',
  'asphalt', 'asphaltPatch', 'sidewalk', 'pavers', 'cobble', 'grass', 'sand', 'snow',
  'concrete', 'parking', 'dirt', 'quayBrick', 'beachWin', 'officeRibbon', 'woodDeck', 'rock',
];

let atlas = null;

export function getAtlas() {
  if (atlas) return atlas;
  const rgb = document.createElement('canvas');
  rgb.width = rgb.height = SIZE;
  const msk = document.createElement('canvas');
  msk.width = msk.height = SIZE;
  const c = rgb.getContext('2d', { willReadFrequently: true });
  const m = msk.getContext('2d', { willReadFrequently: true });
  m.fillStyle = '#000';
  m.fillRect(0, 0, SIZE, SIZE);
  const rects = {};
  NAMES.forEach((name, k) => {
    const col = k % N;
    const row = Math.floor(k / N);
    const ox = col * T;
    const oy = row * T;
    c.save();
    m.save();
    c.beginPath();
    c.rect(ox, oy, T, T);
    c.clip();
    m.beginPath();
    m.rect(ox, oy, T, T);
    m.clip();
    c.translate(ox, oy);
    m.translate(ox, oy);
    PAINT[name]?.(c, m, k);
    c.restore();
    m.restore();
    rects[name] = [col / N, 1 - (row + 1) / N, 1 / N, 1 / N];
  });
  grain(c);
  // 合成 RGBA（不經過 premultiply），並上下翻轉成 GL 的 v 向上
  const a = c.getImageData(0, 0, SIZE, SIZE).data;
  const b = m.getImageData(0, 0, SIZE, SIZE).data;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    const src = y * SIZE * 4;
    const dst = (SIZE - 1 - y) * SIZE * 4;
    for (let x = 0; x < SIZE * 4; x += 4) {
      data[dst + x] = a[src + x];
      data[dst + x + 1] = a[src + x + 1];
      data[dst + x + 2] = a[src + x + 2];
      data[dst + x + 3] = b[src + x];
    }
  }
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  atlas = { tex, rects, rect: (n) => rects[n] };
  return atlas;
}

// ── 繪圖工具 ──
const MASK = { wall: '#000', frame: '#808080', tglass: '#bfbfbf', glass: '#fff' };

function fill(c, m, x, y, w, h, color, mask = 'wall') {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
  m.fillStyle = MASK[mask];
  m.fillRect(x, y, w, h);
}

function glassGrad(c, x, y, w, h, top, bot) {
  const g = c.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  return g;
}

// 一扇窗：外框＋玻璃＋十字窗櫺，可加窗台與過樑
function windowAt(c, m, x, y, w, h, o = {}) {
  const fw = o.frameW ?? 7;
  const frame = o.frame ?? '#f2efe8';
  if (o.lintel) fill(c, m, x - 8, y - 14, w + 16, 12, o.lintel, 'wall');
  if (o.sill) fill(c, m, x - 6, y + h, w + 12, 9, o.sill, o.sillMask || 'frame');
  fill(c, m, x, y, w, h, frame, 'frame');
  const gx = x + fw;
  const gy = y + fw;
  const gw = w - fw * 2;
  const gh = h - fw * 2;
  c.fillStyle = glassGrad(c, gx, gy, gw, gh, o.glassTop ?? '#9fb4c6', o.glassBot ?? '#3c4a5a');
  c.fillRect(gx, gy, gw, gh);
  m.fillStyle = MASK[o.tinted ? 'tglass' : 'glass'];
  m.fillRect(gx, gy, gw, gh);
  // 窗簾（部分窗戶）
  if (o.curtain) {
    c.fillStyle = o.curtain;
    c.fillRect(gx, gy, gw * 0.28, gh);
    c.fillRect(gx + gw * 0.72, gy, gw * 0.28, gh);
  }
  // 反光斜線
  c.fillStyle = 'rgba(255,255,255,0.13)';
  c.beginPath();
  c.moveTo(gx + gw * 0.15, gy + gh);
  c.lineTo(gx + gw * 0.55, gy);
  c.lineTo(gx + gw * 0.75, gy);
  c.lineTo(gx + gw * 0.35, gy + gh);
  c.fill();
  const mul = o.mullion ?? 4;
  if (o.cross !== false) {
    fill(c, m, gx + gw / 2 - mul / 2, gy, mul, gh, frame, 'frame');
    if (o.hbar !== false) fill(c, m, gx, gy + gh * (o.hbarAt ?? 0.5) - mul / 2, gw, mul, frame, 'frame');
  }
}

function bricks(c, x, y, w, h, base = 222, rowH = 9, var_ = 26) {
  for (let r = 0; r * rowH < h; r++) {
    const off = (r & 1) * 14;
    for (let bx = -off; bx < w; bx += 28) {
      const l = base - Math.random() * var_;
      c.fillStyle = `rgb(${l},${l},${l})`;
      c.fillRect(x + bx + 1, y + r * rowH + 1, 26, rowH - 2);
    }
  }
}

function wallTone(c, x, y, w, h, l = 236) {
  c.fillStyle = `rgb(${l},${l},${l})`;
  c.fillRect(x, y, w, h);
}

function grain(c) {
  const img = c.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
}

function speckle(c, w, h, base, spread, count, size = 2) {
  for (let k = 0; k < count; k++) {
    const l = base + (Math.random() - 0.5) * spread;
    c.fillStyle = `rgb(${l},${l},${l})`;
    c.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

function colorSpeckle(c, w, h, colors, count, size = 3) {
  for (let k = 0; k < count; k++) {
    c.fillStyle = colors[k % colors.length];
    c.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

// 店面：上方招牌帶（染色）＋大面玻璃
function storefront(c, m, door) {
  wallTone(c, 0, 0, T, T, 70);
  fill(c, m, 0, 0, T, 52, '#e9e9e9', 'wall'); // 招牌帶（乘上店家顏色）
  fill(c, m, 0, 52, T, 8, '#2b2f33', 'frame');
  fill(c, m, 0, 240, T, 16, '#55595e', 'frame');
  const gx = 10;
  const gw = door ? 140 : 236;
  windowAt(c, m, gx, 64, gw, 172, { frame: '#2b2f33', frameW: 6, glassTop: '#c9d6de', glassBot: '#58636c', hbar: false, cross: !door });
  // 店內暖光
  c.fillStyle = 'rgba(255,214,150,0.22)';
  c.fillRect(gx + 6, 120, gw - 12, 110);
  if (door) {
    fill(c, m, 160, 64, 86, 176, '#2b2f33', 'frame');
    c.fillStyle = glassGrad(c, 168, 72, 70, 164, '#bccbd4', '#4b565f');
    c.fillRect(168, 72, 70, 164);
    m.fillStyle = MASK.glass;
    m.fillRect(168, 72, 70, 164);
    fill(c, m, 225, 150, 6, 26, '#c9b37a', 'frame');
  }
}

const PAINT = {
  glassA(c, m) {
    fill(c, m, 0, 0, T, T, '#ffffff', 'wall');
    c.fillStyle = glassGrad(c, 0, 0, T, 200, '#d6e4ef', '#7f93a6');
    c.fillRect(0, 0, T, 200);
    m.fillStyle = MASK.tglass;
    m.fillRect(0, 0, T, 200);
    fill(c, m, 0, 200, T, 56, '#c7c7c7', 'wall');
    for (const x of [0, 126, 252]) fill(c, m, x - 2, 0, 6, T, '#9aa1a8', 'frame');
    fill(c, m, 0, 196, T, 5, '#9aa1a8', 'frame');
  },
  glassB(c, m) {
    c.fillStyle = glassGrad(c, 0, 0, T, T, '#e3edf4', '#6d8194');
    c.fillRect(0, 0, T, T);
    m.fillStyle = MASK.tglass;
    m.fillRect(0, 0, T, T);
    for (const x of [0, 64, 128, 192]) fill(c, m, x, 0, 10, T, '#d9dcdf', 'wall');
    fill(c, m, 0, 236, T, 20, '#b8b8b8', 'wall');
  },
  glassC(c, m) {
    c.fillStyle = glassGrad(c, 0, 0, T, T, '#a9bccb', '#2d3a47');
    c.fillRect(0, 0, T, T);
    m.fillStyle = MASK.tglass;
    m.fillRect(0, 0, T, T);
    fill(c, m, 0, 0, T, 34, '#5f656b', 'wall');
    for (const x of [0, 85, 170]) fill(c, m, x, 34, 4, T, '#4b5157', 'frame');
  },
  glassLobby(c, m) {
    wallTone(c, 0, 0, T, T, 120);
    fill(c, m, 0, 0, T, 30, '#d8d8d8', 'wall');
    windowAt(c, m, 8, 34, 240, 222, { frame: '#3a3f44', frameW: 6, glassTop: '#d0dde6', glassBot: '#5d6a74', hbarAt: 0.2 });
    c.fillStyle = 'rgba(255,220,170,0.25)';
    c.fillRect(14, 90, 228, 160);
  },
  stoneWin(c, m) {
    wallTone(c, 0, 0, T, T, 232);
    speckle(c, T, T, 220, 30, 900);
    fill(c, m, 0, 250, T, 6, '#cfcfcf', 'wall');
    windowAt(c, m, 70, 46, 116, 168, { frame: '#e9e6df', lintel: '#d6d6d6', sill: '#dcdcdc', curtain: Math.random() < 0.5 ? 'rgba(240,230,210,0.5)' : null });
  },
  stoneWin2(c, m) {
    wallTone(c, 0, 0, T, T, 228);
    speckle(c, T, T, 215, 30, 900);
    windowAt(c, m, 26, 52, 86, 160, { frame: '#3e4348', frameW: 5, sill: '#d6d6d6', sillMask: 'wall' });
    windowAt(c, m, 144, 52, 86, 160, { frame: '#3e4348', frameW: 5, sill: '#d6d6d6', sillMask: 'wall' });
  },
  stoneGround(c, m) {
    wallTone(c, 0, 0, T, T, 205);
    for (let y = 0; y < T; y += 32) fill(c, m, 0, y, T, 3, '#b5b5b5', 'wall');
    windowAt(c, m, 40, 40, 176, 190, { frame: '#2d3135', frameW: 8, glassTop: '#c6d2da', glassBot: '#4a545c', hbarAt: 0.25 });
  },
  stonePlain(c) {
    wallTone(c, 0, 0, T, T, 226);
    speckle(c, T, T, 214, 34, 1400);
    for (let y = 0; y < T; y += 64) {
      c.fillStyle = 'rgb(205,205,205)';
      c.fillRect(0, y, T, 2);
    }
  },
  brickWin(c, m) {
    wallTone(c, 0, 0, T, T, 160);
    bricks(c, 0, 0, T, T, 214);
    windowAt(c, m, 74, 50, 108, 162, { frame: '#f3f0ea', lintel: '#e0e0e0', sill: '#e0e0e0', curtain: Math.random() < 0.6 ? 'rgba(230,225,215,0.45)' : null });
  },
  brickWin2(c, m) {
    wallTone(c, 0, 0, T, T, 160);
    bricks(c, 0, 0, T, T, 208);
    windowAt(c, m, 34, 56, 78, 154, { frame: '#1f2326', frameW: 6, sill: '#cfcfcf', sillMask: 'wall' });
    windowAt(c, m, 144, 56, 78, 154, { frame: '#1f2326', frameW: 6, sill: '#cfcfcf', sillMask: 'wall' });
  },
  brickPlain(c) {
    wallTone(c, 0, 0, T, T, 160);
    bricks(c, 0, 0, T, T, 214);
  },
  brickGround(c, m) {
    wallTone(c, 0, 0, T, T, 160);
    bricks(c, 0, 0, T, T, 200);
    fill(c, m, 30, 36, 84, 220, '#3b2a22', 'frame');
    fill(c, m, 40, 46, 64, 96, '#2c1f19', 'frame');
    fill(c, m, 40, 150, 64, 96, '#2c1f19', 'frame');
    fill(c, m, 96, 140, 6, 18, '#c9b37a', 'frame');
    windowAt(c, m, 150, 60, 80, 150, { frame: '#f3f0ea', sill: '#e0e0e0' });
  },
  canalWin(c, m) {
    wallTone(c, 0, 0, T, T, 150);
    bricks(c, 0, 0, T, T, 205, 8, 30);
    windowAt(c, m, 58, 34, 140, 196, { frame: '#f6f4ef', frameW: 9, sill: '#ece9e2', lintel: '#e8e5df', hbarAt: 0.38, curtain: Math.random() < 0.4 ? 'rgba(235,228,214,0.45)' : null });
  },
  canalWin2(c, m) {
    wallTone(c, 0, 0, T, T, 150);
    bricks(c, 0, 0, T, T, 200, 8, 30);
    windowAt(c, m, 30, 44, 84, 180, { frame: '#f6f4ef', frameW: 8, sill: '#ece9e2', hbarAt: 0.4 });
    windowAt(c, m, 142, 44, 84, 180, { frame: '#f6f4ef', frameW: 8, sill: '#ece9e2', hbarAt: 0.4 });
  },
  canalGround(c, m) {
    wallTone(c, 0, 0, T, T, 150);
    bricks(c, 0, 0, T, T, 196, 8, 30);
    fill(c, m, 26, 40, 84, 216, '#f3f1ec', 'frame');
    fill(c, m, 34, 48, 68, 208, '#26302c', 'frame');
    fill(c, m, 34, 48, 68, 50, '#c9d4dc', 'glass');
    fill(c, m, 90, 150, 6, 16, '#c9b37a', 'frame');
    windowAt(c, m, 132, 50, 100, 170, { frame: '#f6f4ef', frameW: 9, sill: '#ece9e2', hbarAt: 0.35 });
  },
  canalPlain(c) {
    wallTone(c, 0, 0, T, T, 150);
    bricks(c, 0, 0, T, T, 205, 8, 30);
  },
  stuccoWin(c, m) {
    wallTone(c, 0, 0, T, T, 240);
    speckle(c, T, T, 232, 18, 1500);
    windowAt(c, m, 62, 40, 132, 176, { frame: '#ffffff', frameW: 9, sill: '#f4f4f4', hbarAt: 0.5, curtain: Math.random() < 0.5 ? 'rgba(240,235,225,0.5)' : null });
    fill(c, m, 0, 0, T, 10, '#dedede', 'wall');
  },
  stuccoWin2(c, m) {
    wallTone(c, 0, 0, T, T, 240);
    speckle(c, T, T, 230, 18, 1500);
    windowAt(c, m, 26, 50, 90, 160, { frame: '#ffffff', frameW: 8, sill: '#f4f4f4' });
    windowAt(c, m, 140, 50, 90, 160, { frame: '#ffffff', frameW: 8, sill: '#f4f4f4' });
  },
  stuccoPlain(c) {
    wallTone(c, 0, 0, T, T, 240);
    speckle(c, T, T, 230, 20, 1800);
  },
  garage(c, m) {
    wallTone(c, 0, 0, T, T, 236);
    speckle(c, T, T, 228, 18, 900);
    fill(c, m, 24, 50, 208, 206, '#f0f0ee', 'frame');
    for (let y = 58; y < 250; y += 24) fill(c, m, 30, y, 196, 3, '#c7c7c3', 'frame');
  },
  stuccoGround(c, m) {
    wallTone(c, 0, 0, T, T, 236);
    speckle(c, T, T, 228, 18, 1200);
    fill(c, m, 28, 50, 82, 206, '#ffffff', 'frame');
    fill(c, m, 36, 58, 66, 198, '#7a2e24', 'frame');
    fill(c, m, 36, 58, 66, 50, '#c9d4dc', 'glass');
    windowAt(c, m, 140, 70, 92, 140, { frame: '#ffffff', frameW: 8, sill: '#f4f4f4' });
  },
  sidingWin(c, m) {
    wallTone(c, 0, 0, T, T, 238);
    for (let y = 0; y < T; y += 16) {
      c.fillStyle = 'rgb(206,206,206)';
      c.fillRect(0, y + 13, T, 3);
    }
    fill(c, m, 50, 52, 22, 150, '#4b5560', 'frame');
    fill(c, m, 184, 52, 22, 150, '#4b5560', 'frame');
    windowAt(c, m, 74, 52, 108, 150, { frame: '#ffffff', frameW: 8, sill: '#f4f4f4' });
  },
  sidingPlain(c) {
    wallTone(c, 0, 0, T, T, 238);
    for (let y = 0; y < T; y += 16) {
      c.fillStyle = 'rgb(206,206,206)';
      c.fillRect(0, y + 13, T, 3);
    }
  },
  sidingGround(c, m) {
    PAINT.sidingPlain(c, m);
    fill(c, m, 84, 48, 92, 208, '#ffffff', 'frame');
    fill(c, m, 92, 56, 76, 200, '#2f4858', 'frame');
    fill(c, m, 104, 70, 52, 40, '#c9d4dc', 'glass');
    fill(c, m, 156, 150, 6, 14, '#c9b37a', 'frame');
  },
  shopA(c, m) {
    storefront(c, m, false);
  },
  shopB(c, m) {
    storefront(c, m, true);
  },
  lodgeWin(c, m) {
    wallTone(c, 0, 0, T, T, 200);
    for (let y = 0; y < T; y += 22) {
      c.fillStyle = 'rgb(165,165,165)';
      c.fillRect(0, y + 18, T, 4);
    }
    windowAt(c, m, 60, 50, 136, 150, { frame: '#3a2a1e', frameW: 10, sill: '#5a4030' });
  },
  lodgePlain(c) {
    wallTone(c, 0, 0, T, T, 200);
    for (let y = 0; y < T; y += 22) {
      c.fillStyle = 'rgb(165,165,165)';
      c.fillRect(0, y + 18, T, 4);
    }
  },
  roofGravel(c) {
    wallTone(c, 0, 0, T, T, 200);
    speckle(c, T, T, 185, 60, 4000, 2);
  },
  roofTile(c) {
    wallTone(c, 0, 0, T, T, 210);
    for (let y = 0; y < T; y += 18) {
      const off = ((y / 18) & 1) * 16;
      for (let x = -off; x < T; x += 32) {
        const l = 200 - Math.random() * 40;
        c.fillStyle = `rgb(${l},${l},${l})`;
        c.fillRect(x + 1, y + 1, 30, 15);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x + 1, y + 14, 30, 3);
      }
    }
  },
  roofSlate(c) {
    wallTone(c, 0, 0, T, T, 180);
    for (let y = 0; y < T; y += 14) {
      c.fillStyle = 'rgb(140,140,140)';
      c.fillRect(0, y + 11, T, 3);
    }
  },
  attic(c, m) {
    wallTone(c, 0, 0, T, T, 150);
    bricks(c, 0, 0, T, T, 205, 8, 30);
    windowAt(c, m, 96, 70, 64, 100, { frame: '#f6f4ef', frameW: 7, hbar: false });
  },
  asphalt(c) {
    wallTone(c, 0, 0, T, T, 92);
    speckle(c, T, T, 96, 50, 6000, 2);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(0, 120, T, 30);
  },
  asphaltPatch(c) {
    wallTone(c, 0, 0, T, T, 98);
    speckle(c, T, T, 98, 40, 5000, 2);
    c.fillStyle = 'rgb(80,80,80)';
    c.fillRect(40, 60, 90, 70);
    c.strokeStyle = 'rgb(70,70,70)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(150, 0);
    c.bezierCurveTo(170, 80, 120, 160, 180, 256);
    c.stroke();
  },
  sidewalk(c) {
    wallTone(c, 0, 0, T, T, 214);
    speckle(c, T, T, 210, 22, 2600);
    c.fillStyle = 'rgb(176,176,176)';
    c.fillRect(0, 0, T, 3);
    c.fillRect(0, 128, T, 3);
    c.fillRect(0, 0, 3, T);
    c.fillRect(128, 0, 3, T);
  },
  pavers(c) {
    wallTone(c, 0, 0, T, T, 120);
    for (let y = 0; y < T; y += 16) {
      const off = ((y / 16) & 1) * 16;
      for (let x = -off; x < T; x += 32) {
        const l = 205 - Math.random() * 45;
        c.fillStyle = `rgb(${l},${l},${l})`;
        c.fillRect(x + 1, y + 1, 30, 14);
      }
    }
  },
  cobble(c) {
    wallTone(c, 0, 0, T, T, 110);
    for (let y = 0; y < T; y += 21) {
      for (let x = (y / 21) % 2 ? 0 : 11; x < T; x += 22) {
        const l = 190 - Math.random() * 50;
        c.fillStyle = `rgb(${l},${l},${l})`;
        c.beginPath();
        c.ellipse(x, y + 10, 9.5, 9, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  },
  grass(c) {
    wallTone(c, 0, 0, T, T, 222);
    speckle(c, T, T, 200, 70, 7000, 3);
  },
  sand(c) {
    wallTone(c, 0, 0, T, T, 236);
    speckle(c, T, T, 225, 30, 5000, 2);
    c.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let k = 0; k < 8; k++) {
      c.beginPath();
      c.moveTo(0, k * 32 + 10);
      c.bezierCurveTo(80, k * 32, 170, k * 32 + 20, 256, k * 32 + 8);
      c.stroke();
    }
  },
  snow(c) {
    wallTone(c, 0, 0, T, T, 248);
    speckle(c, T, T, 240, 16, 3000, 3);
  },
  concrete(c) {
    wallTone(c, 0, 0, T, T, 226);
    speckle(c, T, T, 220, 22, 3000, 2);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.fillRect(0, 0, T, 2);
    c.fillRect(0, 0, 2, T);
  },
  parking(c) {
    PAINT.asphalt(c);
  },
  dirt(c) {
    wallTone(c, 0, 0, T, T, 200);
    speckle(c, T, T, 180, 60, 5000, 3);
  },
  quayBrick(c) {
    wallTone(c, 0, 0, T, T, 120);
    bricks(c, 0, 0, T, T, 170, 10, 40);
  },
  beachWin(c, m) {
    wallTone(c, 0, 0, T, T, 242);
    speckle(c, T, T, 234, 16, 1200);
    windowAt(c, m, 40, 60, 176, 140, { frame: '#ffffff', frameW: 8, sill: '#f4f4f4', hbar: false });
  },
  officeRibbon(c, m) {
    wallTone(c, 0, 0, T, T, 225);
    speckle(c, T, T, 215, 24, 900);
    c.fillStyle = glassGrad(c, 0, 70, T, 140, '#b6c7d4', '#3f4d5a');
    c.fillRect(0, 70, T, 130);
    m.fillStyle = MASK.glass;
    m.fillRect(0, 70, T, 130);
    for (const x of [0, 85, 170]) fill(c, m, x, 70, 5, 130, '#4a5056', 'frame');
  },
  woodDeck(c) {
    wallTone(c, 0, 0, T, T, 180);
    for (let x = 0; x < T; x += 32) {
      const l = 200 - Math.random() * 40;
      c.fillStyle = `rgb(${l},${l},${l})`;
      c.fillRect(x + 1, 0, 29, T);
    }
  },
  rock(c) {
    wallTone(c, 0, 0, T, T, 170);
    speckle(c, T, T, 160, 70, 6000, 4);
  },
};

// 世界材質：所有建物、地面與街道家具共用
export function createWorldMaterial() {
  const A = getAtlas();
  const uniforms = { uAtlas: { value: A.tex }, uNight: { value: 0 }, uWet: { value: 0 }, uSnow: { value: 0 }, uCutY: { value: 1e6 }, uCutBox: { value: new THREE.Vector4(1e6, 1e6, -1e6, -1e6) }, uWin: { value: null }, uHour: { value: 12 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 atl;\nattribute vec4 wl;\nvarying vec4 vAtl;\nflat varying vec4 vWl;\nvarying vec2 vRep;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAtl = atl;\nvWl = wl;\nvRep = uv;\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uAtlas;
uniform float uNight;
uniform float uWet;
uniform float uSnow;
uniform float uCutY;
uniform vec4 uCutBox;
uniform sampler2D uWin;
uniform float uHour;
varying vec4 vAtl;
flat varying vec4 vWl;
varying vec2 vRep;
varying vec3 vWPos;
varying vec3 vWNorm;
float hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// 窗燈：房間類型在這個時刻開燈的機率（與 winlights.js 的 roomLightP 相同）
float inH(float h, float a, float b) { return a < b ? step(a, h) * (1.0 - step(b, h)) : max(step(a, h), 1.0 - step(b, h)); }
float roomP(float t, float h) {
  if (t < 0.5) return 0.0;
  if (t < 1.5 || t > 11.5) return mix(0.06, 0.95, inH(h, 8.0, 22.0));
  if (t < 2.5) return mix(0.03, 0.5, inH(h, 8.0, 23.0));
  if (t < 3.5) return 0.85;
  if (t > 9.5 && t < 10.5) return mix(0.85, 0.4, inH(h, 23.0, 6.0));
  if (t > 10.5 && t < 11.5) return 0.7;
  if (t < 4.5) return max(max(0.75 * inH(h, 17.0, 23.5), 0.3 * inH(h, 6.0, 8.0)), 0.05);
  if (t < 5.5) return max(max(0.45 * inH(h, 21.0, 24.0), 0.35 * inH(h, 6.0, 7.5)), max(0.15 * inH(h, 0.0, 1.0), 0.03));
  if (t < 6.5) return max(max(0.5 * inH(h, 6.0, 9.0), 0.7 * inH(h, 17.0, 21.0)), 0.04);
  if (t < 7.5) return max(0.4 * inH(h, 6.0, 8.0), 0.12);
  return max(max(0.9 * inH(h, 7.0, 19.0), 0.35 * inH(h, 19.0, 22.0)), 0.12);
}
vec3 roomCol(float t) {
  if (t < 1.5 || t > 11.5) return vec3(1.0, 0.88, 0.7) * 0.95;
  if (t < 2.5) return vec3(0.95, 0.95, 0.9) * 0.55;
  if (t < 3.5 || (t > 9.5 && t < 11.5)) return vec3(1.0, 0.8, 0.52) * 0.5;
  if (t < 4.5) return vec3(1.0, 0.7, 0.4) * 0.75;
  if (t < 5.5) return vec3(1.0, 0.6, 0.32) * 0.5;
  if (t < 6.5) return vec3(1.0, 0.88, 0.68) * 0.8;
  if (t < 7.5) return vec3(0.86, 0.93, 1.0) * 0.65;
  return vec3(0.82, 0.9, 1.0) * 0.85;
}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
if (vWPos.y > uCutY && vWPos.x > uCutBox.x && vWPos.x < uCutBox.z && vWPos.z > uCutBox.y && vWPos.z < uCutBox.w) discard;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 atx = vec4(1.0);
float gMask = 0.0;
float tGlass = 0.0;
if (vAtl.z > 0.0) {
  vec2 f = fract(vRep);
  vec2 auv = vAtl.xy + (f * 0.984 + 0.008) * vAtl.zw;
  atx = textureGrad(uAtlas, auv, dFdx(vRep) * vAtl.zw, dFdy(vRep) * vAtl.zw);
  float a = atx.a;
  gMask = smoothstep(0.62, 0.7, a);
  float neutral = smoothstep(0.37, 0.45, a) * (1.0 - gMask) + smoothstep(0.87, 0.93, a);
  diffuseColor.rgb = mix(atx.rgb * vColor.rgb, atx.rgb, neutral);
  tGlass = gMask;
} else {
  diffuseColor.rgb = vColor.rgb;
}`,
      )
      .replace('#include <color_fragment>', '')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.06, tGlass);
float upF = clamp(vWNorm.y, 0.0, 1.0);
roughnessFactor = mix(roughnessFactor, 0.18, uWet * upF);
diffuseColor.rgb *= 1.0 - uWet * upF * 0.35;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnow * smoothstep(0.55, 0.85, vWNorm.y) * (1.0 - tGlass));`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.45, tGlass);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (tGlass > 0.0 && uNight > 0.0) {
  if (vWl.x > 0.5) {
    // 近景：查這扇窗後面的房間
    float rows = floor(vWl.w / 4.0);
    float row = mod(vWl.w, 4.0) + floor(vRep.y + 0.001);
    if (row > rows - 0.5) row = rows > 1.5 ? 1.0 + mod(row - 1.0, rows - 1.0) : 0.0;
    float col = clamp(vWl.z + floor(vRep.x), 0.0, vWl.y - 1.0);
    float idx = vWl.x - 1.0 + row * vWl.y + col;
    vec4 d = texelFetch(uWin, ivec2(int(mod(idx, 1024.0)), int(floor(idx / 1024.0))), 0);
    float type = floor(d.r * 255.0 + 0.5);
    float lit = step(d.g + 0.0001, roomP(type, uHour)) * tGlass * uNight;
    totalEmissiveRadiance += lit * roomCol(type) * (0.8 + 0.35 * d.b);
  } else {
    // 遠景：依時刻的平均亮燈率
    vec2 cell = floor(vRep) + floor(vWPos.xz * 0.07) * 7.0;
    float h = hash21(cell);
    float p = max(max(0.6 * inH(uHour, 17.5, 23.0), 0.3 * inH(uHour, 23.0, 1.5)), max(0.35 * inH(uHour, 5.5, 8.0), 0.14));
    float lit = step(h, p) * tGlass * uNight;
    vec3 warm = mix(vec3(1.0, 0.74, 0.42), vec3(0.8, 0.88, 1.0), step(0.88, fract(h * 13.0)));
    totalEmissiveRadiance += lit * warm * (0.45 + 0.4 * fract(h * 7.0));
  }
}`,
      );
  };
  mat.userData.uniforms = uniforms;
  mat.customProgramCacheKey = () => 'terra-world-v2';
  return mat;
}
