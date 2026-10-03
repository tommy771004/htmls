// 枝葉卡片樹：樹幹與主枝是真的幾何體，葉子是貼了「一小枝葉子」貼圖的平面卡片。
// 這是遊戲裡做寫實樹木的標準做法——面數低，但輪廓與透光感都是葉子的形狀而不是一團球。

import * as THREE from 'three';
import { mulberry32, lerp, clamp } from '../core/noise.js';

const TAU = Math.PI * 2;
const ATLAS = 1024; // 繪製座標仍以 512 為基準，atlasTexture 會整體放大
// 貼圖左下角留一小塊不透明的樹皮色，遠景 LOD 的樹幹直接用葉子材質畫（省一個 draw call）
const BARK_PATCH = 24 / ATLAS;

function atlasTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS;
  const g = canvas.getContext('2d');
  g.save();
  g.scale(ATLAS / 512, ATLAS / 512);
  draw(g);
  g.restore();
  g.fillStyle = '#4a3a2a';
  g.fillRect(0, ATLAS - 24, 24, 24);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * 把「顏色＋不透明度」兩張掃描圖合成一張帶 alpha 的 canvas，並自動找出裡面每一個獨立的圖樣
 * （先找出有內容的橫列，再在每一列裡找出各自的欄範圍）。
 */
function spritesFrom(colorTex, alphaTex) {
  const w = colorTex.image.width;
  const h = colorTex.image.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(alphaTex.image, 0, 0, w, h);
  const alpha = g.getImageData(0, 0, w, h).data;
  g.drawImage(colorTex.image, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = alpha[i * 4];
  g.putImageData(img, 0, 0);

  const solid = (x, y) => alpha[(y * w + x) * 4] > 60;
  const runs = (n, test) => {
    const out = [];
    let start = -1;
    for (let i = 0; i <= n; i++) {
      const on = i < n && test(i);
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        if (i - start > 12) out.push([start, i]);
        start = -1;
      }
    }
    return out;
  };
  const any = (x0, x1, y0, y1) => {
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) if (solid(x, y)) return true;
    return false;
  };
  const cells = [];
  for (const [y0, y1] of runs(h, (y) => any(0, w, y, y + 1))) {
    for (const [x0, x1] of runs(w, (x) => any(x, x + 1, y0, y1))) cells.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return { canvas, cells };
}

/** 一片葉子：尖橢圓、漸層、葉脈 */
function drawLeaf(g, x, y, len, width, angle, hue, light) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const grad = g.createLinearGradient(0, 0, 0, -len);
  grad.addColorStop(0, `hsl(${hue}, 36%, ${light - 7}%)`);
  grad.addColorStop(0.6, `hsl(${hue + 6}, 40%, ${light}%)`);
  grad.addColorStop(1, `hsl(${hue + 12}, 42%, ${light + 6}%)`);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(width, -len * 0.25, width * 0.85, -len * 0.75, 0, -len);
  g.bezierCurveTo(-width * 0.85, -len * 0.75, -width, -len * 0.25, 0, 0);
  g.fill();
  // 半邊壓暗一點，葉子才有立體的摺痕
  g.fillStyle = 'rgba(0, 20, 0, 0.16)';
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(width, -len * 0.25, width * 0.85, -len * 0.75, 0, -len);
  g.closePath();
  g.fill();
  g.strokeStyle = `hsla(${hue + 20}, 45%, ${light + 16}%, 0.75)`;
  g.lineWidth = Math.max(1, len * 0.022);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -len * 0.96);
  g.stroke();
  g.lineWidth = Math.max(0.6, len * 0.012);
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(0, -len * t);
      g.lineTo(s * width * 0.62 * Math.sin(t * Math.PI), -len * (t + 0.13));
      g.stroke();
    }
  }
  g.restore();
}

function twig(g, pts, width, color) {
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
}

/**
 * 闊葉枝：一根主枝反覆分岔成細枝，細枝兩側密生小葉。枝條基部在貼圖底部中央。
 * 葉片要夠小夠多——一張卡片在世界裡約 2 公尺寬，葉子畫太大整棵樹就會像卡通。
 */
export function makeBroadleafAtlas(photos = {}) {
  const rand = mulberry32(3301);
  const scan = photos.leaves && photos.leavesA ? spritesFrom(photos.leaves, photos.leavesA) : null;
  const stamp = (g, x, y, len, angle, pass) => {
    const c = scan.cells[Math.floor(rand() * scan.cells.length)];
    const width = (len * c.w) / c.h;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    // 後排的葉子比較暗，疊起來才有深度
    g.filter = `brightness(${[0.5, 0.72, 1][pass]})`;
    g.drawImage(scan.canvas, c.x, c.y, c.w, c.h, -width / 2, -len, width, len);
    g.restore();
  };
  return atlasTexture((g) => {
    // 遞迴長出枝條：每段往前延伸並略為彎曲，沿途分出更細的側枝
    const twigs = [];
    const grow = (x, y, angle, length, width, depth) => {
      const pts = [[x, y]];
      const steps = Math.max(3, Math.round(length / 26));
      let a = angle;
      for (let i = 1; i <= steps; i++) {
        a += (rand() - 0.5) * 0.28;
        x += Math.sin(a) * (length / steps);
        y -= Math.cos(a) * (length / steps);
        pts.push([x, y]);
        if (depth > 0 && i > 0 && i < steps && rand() < 0.75) {
          const side = rand() < 0.5 ? -1 : 1;
          grow(x, y, a + side * (0.55 + rand() * 0.5), length * (0.42 + rand() * 0.2), width * 0.6, depth - 1);
        }
      }
      twigs.push({ pts, width, depth });
    };
    grow(256, 506, 0, 430, 7, 2);
    grow(256, 470, -0.75, 250, 4.5, 1);
    grow(256, 440, 0.8, 240, 4.5, 1);
    for (const t of twigs) twig(g, t.pts, t.width, '#43342a');

    // 沿每根枝條密集放葉：先畫後排（暗、偏藍綠）再畫前排（亮、偏黃綠），疊出深度
    for (const pass of [0, 1, 2]) {
      for (const t of twigs) {
        for (let k = 0; k < t.pts.length - 1; k++) {
          const [x0, y0] = t.pts[k];
          const [x1, y1] = t.pts[k + 1];
          const dir = Math.atan2(x1 - x0, -(y1 - y0));
          const seg = Math.hypot(x1 - x0, y1 - y0);
          // 掃描葉片比手繪的寬：葉子縮小、數量加多，樹冠才有細碎的透光，不會糊成一片
          const count = Math.max(2, Math.round(seg / (scan ? 6 : 9)));
          for (let j = 0; j < count; j++) {
            // 主幹的下半段不長葉
            if (t.depth === 2 && k < 2) continue;
            const u = (j + rand()) / count;
            const side = (j + pass) % 2 ? 1 : -1;
            const len = 24 + rand() * 20;
            const off = (rand() - 0.5) * 10;
            const lx = lerp(x0, x1, u) + Math.cos(dir) * off;
            const ly = lerp(y0, y1, u) + Math.sin(dir) * off;
            const la = dir + side * (0.5 + rand() * 0.9);
            if (scan) stamp(g, lx, ly, len * 0.8, la, pass);
            else drawLeaf(g, lx, ly, len, len * (0.36 + rand() * 0.12), la, 84 + rand() * 26 + pass * 5, 14 + pass * 6 + rand() * 9);
          }
        }
        const [ex, ey] = t.pts[t.pts.length - 1];
        if (scan) stamp(g, ex, ey, 38, (rand() - 0.5) * 0.8, pass);
        else drawLeaf(g, ex, ey, 34, 14, (rand() - 0.5) * 0.8, 96, 30);
      }
    }
  });
}

/** 針葉枝：中央枝條兩側密生針葉，往末端收窄。基部在貼圖底部中央 */
export function makeNeedleAtlas(photos = {}) {
  const rand = mulberry32(3302);
  if (photos.conifer && photos.coniferA) {
    const scan = spritesFrom(photos.conifer, photos.coniferA);
    // 掃描圖裡的枝條是橫的（基部在左、尖端在右）：轉到指定方向後，從基部往外貼
    const place = (g, x, y, angle, len, shade) => {
      const c = scan.cells.reduce((a, b) => (b.w > a.w ? b : a)); // 用最長的那一枝
      const height = (len * c.h) / c.w;
      g.save();
      g.translate(x, y);
      g.rotate(angle - Math.PI / 2);
      g.filter = `brightness(${shade})`;
      g.drawImage(scan.canvas, c.x, c.y, c.w, c.h, 0, -height / 2, len, height);
      g.restore();
    };
    return atlasTexture((g) => {
      twig(g, [[256, 506], [256, 60]], 5, '#3f2e1f');
      // 先貼側枝（暗）再貼主枝（亮）
      for (let i = 0; i < 6; i++) {
        const y = 450 - i * 66;
        const len = 235 - i * 26;
        for (const side of [-1, 1]) place(g, 256, y, side * (0.95 + rand() * 0.2), len, 0.62 + rand() * 0.15);
      }
      for (let i = 0; i < 5; i++) {
        const y = 418 - i * 70;
        const len = 190 - i * 22;
        for (const side of [-1, 1]) place(g, 256, y, side * (0.55 + rand() * 0.2), len, 0.8 + rand() * 0.15);
      }
      place(g, 256, 506, 0, 490, 1);
    });
  }
  return atlasTexture((g) => {
    const spray = (x0, y0, x1, y1, width) => {
      twig(g, [[x0, y0], [x1, y1]], 5, '#3f2e1f');
      const len = Math.hypot(x1 - x0, y1 - y0);
      const dir = Math.atan2(x1 - x0, -(y1 - y0));
      const count = Math.floor(len * 1.5);
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const px = lerp(x0, x1, t);
        const py = lerp(y0, y1, t);
        const reach = width * (1 - t * 0.75) * (0.7 + rand() * 0.5);
        const side = i % 2 ? 1 : -1;
        const a = dir + side * (0.75 + rand() * 0.5);
        g.strokeStyle = `hsl(${125 + rand() * 25}, ${38 + rand() * 18}%, ${14 + rand() * 16}%)`;
        g.lineWidth = 1.6 + rand() * 1.2;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.sin(a) * reach, py - Math.cos(a) * reach);
        g.stroke();
      }
    };
    spray(256, 505, 256, 30, 74);
    // 側枝
    for (let i = 0; i < 6; i++) {
      const y = 440 - i * 68;
      const reach = 190 - i * 24;
      for (const s of [-1, 1]) spray(256, y, 256 + s * reach, y - reach * 0.55, 46 - i * 3);
    }
  });
}

// ---------------------------------------------------------------- 幾何

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

class Builder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  vertex(p, n, u, v, shade, tint = [1, 1, 1]) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.col.push(shade * tint[0], shade * tint[1], shade * tint[2]);
    return this.pos.length / 3 - 1;
  }

  /**
   * 沿一條折線放樣出圓管（樹幹、樹枝）。
   * @param path [{p: Vector3, r: number}]
   */
  tube(path, radial, uScale, vScale, shade = 1) {
    const rings = [];
    let v = 0;
    const up = new THREE.Vector3();
    const side = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const n = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < path.length; i++) {
      const cur = path[i];
      dir.copy(path[Math.min(i + 1, path.length - 1)].p).sub(path[Math.max(i - 1, 0)].p).normalize();
      side.set(1, 0, 0);
      if (Math.abs(dir.x) > 0.9) side.set(0, 0, 1);
      up.crossVectors(dir, side).normalize();
      side.crossVectors(up, dir).normalize();
      if (i > 0) v += cur.p.distanceTo(path[i - 1].p) * vScale;
      const ring = [];
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU;
        n.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
        p.copy(cur.p).addScaledVector(n, cur.r);
        ring.push(this.vertex(p, n, (j / radial) * uScale, v, shade * (cur.shade ?? 1)));
      }
      rings.push(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = rings[i][j];
        const b = rings[i][j + 1];
        const c = rings[i + 1][j];
        const d = rings[i + 1][j + 1];
        this.idx.push(a, b, c, b, d, c);
      }
    }
  }

  /**
   * 一張葉片卡：base 是枝條接點，along 是葉枝延伸方向，width 方向由 planeNormal 決定。
   * 法線不用卡片本身的面法線，而是「從樹冠中心往外」，整棵樹的明暗才會像一個立體的樹冠。
   */
  card(base, along, planeNormal, length, width, centre, shade, tint, uvRect = [0, 0, 1, 1]) {
    _a.copy(along).normalize();
    _b.crossVectors(_a, planeNormal).normalize();
    const [u0, v0, u1, v1] = uvRect;
    const corners = [
      [-0.5, 0, u0, v0],
      [0.5, 0, u1, v0],
      [0.5, 1, u1, v1],
      [-0.5, 1, u0, v1],
    ];
    const ids = corners.map(([sx, sy, u, v]) => {
      _v.copy(base).addScaledVector(_b, sx * width).addScaledVector(_a, sy * length);
      _c.copy(_v).sub(centre).normalize().lerp(planeNormal, 0.25);
      _c.y += 0.35;
      _c.normalize();
      // 靠近枝條（內側）的一端比較暗
      return this.vertex(_v, _c, u, v, shade * (sy === 0 ? 0.72 : 1), tint);
    });
    this.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setIndex(this.idx);
    return geo;
  }
}

const BARK_UV = [0, 0, BARK_PATCH * 0.8, BARK_PATCH * 0.8];

/** 遠景 LOD 的樹幹：一個貼著「樹皮色塊」的細長角柱，併進葉子的 mesh */
function lowTrunk(leaves, height, r0, r1) {
  const segs = 5;
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const ring = (y, r) => {
    const out = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * TAU;
      n.set(Math.cos(a), 0, Math.sin(a));
      p.set(n.x * r, y, n.z * r);
      out.push(leaves.vertex(p, n, BARK_UV[2] * 0.5, BARK_UV[3] * 0.5, 0.8));
    }
    return out;
  };
  const a = ring(0, r0);
  const b = ring(height, r1);
  for (let j = 0; j < segs; j++) {
    const k = (j + 1) % segs;
    leaves.idx.push(a[j], a[k], b[j], a[k], b[k], b[j]);
  }
}

/**
 * 闊葉樹。回傳 { wood, leaves }（low = true 時 wood 為 null，樹幹併在 leaves 裡）。
 */
export function buildBroadleafTree(seed, low = false) {
  const rand = mulberry32(seed);
  const wood = new Builder();
  const leaves = new Builder();
  const H = 4.6;
  const centre = new THREE.Vector3(0, H + 0.6, 0);
  const lean = new THREE.Vector3((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);

  const trunkAt = (t) => new THREE.Vector3(lean.x * t * t, H * t, lean.z * t * t);
  if (low) {
    lowTrunk(leaves, H, 0.3, 0.14);
  } else {
    const path = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      path.push({ p: trunkAt(t), r: lerp(0.34, 0.15, t) * (1 + 0.6 * Math.pow(1 - t, 8)), shade: 0.75 + 0.25 * t });
    }
    wood.tube(path, 8, 2, 0.5);
  }

  const branches = low ? 5 : 8;
  const cardsPer = low ? 2 : 6;
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const pn = new THREE.Vector3();
  const along = new THREE.Vector3();
  for (let i = 0; i < branches; i++) {
    const t0 = lerp(0.5, 1, i / (branches - 1));
    const phi = i * 2.4 + rand() * 0.8;
    const elev = lerp(0.35, 1.15, i / (branches - 1)) + (rand() - 0.5) * 0.2;
    const length = lerp(3.4, 2.0, i / (branches - 1)) * (0.85 + rand() * 0.3);
    dir.set(Math.cos(phi) * Math.cos(elev), Math.sin(elev), Math.sin(phi) * Math.cos(elev));
    const start = trunkAt(t0);
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const s = k / 4;
      // 枝條先往外、末端略為上翹
      const p = start.clone().addScaledVector(dir, length * s);
      p.y += s * s * 0.5;
      pts.push({ p, r: lerp(0.11, 0.025, s), shade: 0.85 });
    }
    if (!low) wood.tube(pts, 5, 1, 0.6);

    for (let c = 0; c < cardsPer; c++) {
      const s = lerp(0.3, 1, (c + rand() * 0.6) / cardsPer);
      const k = Math.min(3, Math.floor(s * 4));
      const base = pts[k].p.clone().lerp(pts[k + 1].p, s * 4 - k);
      // 葉枝朝外偏上，左右交錯張開
      const spread = (c % 2 ? 1 : -1) * (0.5 + rand() * 0.7);
      along.copy(dir).applyAxisAngle(up, spread);
      along.y += 0.25 + rand() * 0.5;
      pn.set(rand() - 0.5, 0.9 + rand() * 0.6, rand() - 0.5).normalize();
      const size = (low ? 3.2 : 2.1) * (0.8 + rand() * 0.5);
      const depth = clamp(base.distanceTo(centre) / 3.2, 0, 1);
      const hue = 0.86 + rand() * 0.28;
      leaves.card(base, along, pn, size, size * 0.95, centre, 0.62 + depth * 0.5, [hue, 1, hue * 0.8]);
    }
  }
  // 樹冠頂端補幾張往上的葉枝，從下往上看才不會空一塊
  const crown = low ? 3 : 6;
  for (let i = 0; i < crown; i++) {
    const a = (i / crown) * TAU + rand();
    along.set(Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7);
    pn.set(Math.cos(a + 1.6), 0.5, Math.sin(a + 1.6)).normalize();
    const size = (low ? 3.0 : 2.2) * (0.85 + rand() * 0.3);
    leaves.card(trunkAt(0.92), along, pn, size, size * 0.95, centre, 1.05, [1, 1, 0.82]);
  }
  return { wood: low ? null : wood.build(), leaves: leaves.build() };
}

/** 針葉樹：筆直樹幹、一層層輪生的下垂枝條 */
export function buildConiferTree(seed, low = false) {
  const rand = mulberry32(seed);
  const wood = new Builder();
  const leaves = new Builder();
  const H = 9.5;
  const centre = new THREE.Vector3(0, H * 0.5, 0);
  if (low) {
    lowTrunk(leaves, H, 0.24, 0.03);
  } else {
    const path = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      path.push({ p: new THREE.Vector3(0, H * t, 0), r: lerp(0.26, 0.03, t) * (1 + 0.5 * Math.pow(1 - t, 8)), shade: 0.8 });
    }
    wood.tube(path, 7, 2, 0.4);
  }
  const levels = low ? 6 : 12;
  const perLevel = low ? 4 : 5;
  const dir = new THREE.Vector3();
  const pn = new THREE.Vector3();
  const side = new THREE.Vector3();
  const base = new THREE.Vector3();
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1);
    const y = lerp(1.7, H - 0.5, t);
    const reach = lerp(3.0, 0.7, Math.pow(t, 0.85)) * (0.9 + rand() * 0.2);
    for (let b = 0; b < perLevel; b++) {
      const phi = (b / perLevel) * TAU + l * 0.9 + rand() * 0.4;
      // 下層枝條下垂得多，越往上越平、頂端上揚
      const droop = lerp(-0.42, 0.25, t) + (rand() - 0.5) * 0.12;
      dir.set(Math.cos(phi) * Math.cos(droop), Math.sin(droop), Math.sin(phi) * Math.cos(droop));
      base.set(0, y + (rand() - 0.5) * 0.25, 0);
      side.set(-Math.sin(phi), 0, Math.cos(phi));
      // 一張平躺的針葉扇面，再疊一張立著的，側面看才有厚度
      pn.crossVectors(side, dir).normalize();
      const shade = 0.7 + rand() * 0.25 + t * 0.15;
      const tint = [0.9 + rand() * 0.15, 1, 0.9 + rand() * 0.15];
      leaves.card(base, dir, pn, reach, reach * (low ? 0.95 : 0.8), centre, shade, tint);
      if (!low) leaves.card(base, dir, side, reach, reach * 0.42, centre, shade * 0.85, tint);
    }
  }
  // 樹尖
  dir.set(0, 1, 0);
  for (let i = 0; i < 2; i++) {
    pn.set(Math.cos(i * 1.57), 0, Math.sin(i * 1.57));
    base.set(0, H - 1.0, 0);
    leaves.card(base, dir, pn, 1.9, 1.0, centre, 1, [1, 1, 1]);
  }
  return { wood: low ? null : wood.build(), leaves: leaves.build() };
}

/** 灌木：從地面往外張開的一圈葉枝 */
export function buildShrub(seed) {
  const rand = mulberry32(seed);
  const leaves = new Builder();
  const centre = new THREE.Vector3(0, 0.3, 0);
  const along = new THREE.Vector3();
  const pn = new THREE.Vector3();
  const base = new THREE.Vector3();
  const count = 9;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rand() * 0.5;
    const tilt = 0.35 + rand() * 0.75;
    along.set(Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt));
    pn.set(-Math.sin(a) * 0.4 + along.x * 0.2, 0.8, Math.cos(a) * 0.4).normalize();
    base.set(Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08);
    const size = 0.95 + rand() * 0.6;
    const hue = 0.85 + rand() * 0.3;
    leaves.card(base, along, pn, size, size * 0.9, centre, 0.75 + rand() * 0.3, [hue, 1, hue * 0.8]);
  }
  return leaves.build();
}
