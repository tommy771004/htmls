// 圖磚網格：把 core/world.js 的向量圖磚轉成三個合併網格（地面、建物、街道家具）＋夜間發光網格。
import * as THREE from 'three';
import { Builder, P, mat } from './geo.js';
import { getAtlas } from './atlas.js';
import { carParts } from './vehicles.js';
import { CURB, LIFT, SKATE, bowlSD } from '../core/world.js';
import { clamp, hash2, mulberry32 } from '../core/math.js';

const A = () => getAtlas();
const R = (n) => getAtlas().rect(n);

const STYLE = {
  glass: { win: ['glassA', 'glassB', 'glassC'], plain: 'glassA', ground: 'glassLobby', bay: 3.0 },
  stone: { win: ['stoneWin', 'stoneWin2', 'officeRibbon'], plain: 'stonePlain', ground: 'stoneGround', bay: 3.6 },
  brick: { win: ['brickWin', 'brickWin2'], plain: 'brickPlain', ground: 'brickGround', bay: 3.4 },
  canal: { win: ['canalWin', 'canalWin2', 'canalWin'], plain: 'canalPlain', ground: 'canalGround', bay: 2.7 },
  plaster: { win: ['canalWin', 'canalWin2'], plain: 'canalPlain', ground: 'canalGround', bay: 2.7 },
  stucco: { win: ['stuccoWin', 'stuccoWin2'], plain: 'stuccoPlain', ground: 'stuccoGround', bay: 3.2 },
  siding: { win: ['sidingWin'], plain: 'sidingPlain', ground: 'sidingGround', bay: 3.6 },
  lodge: { win: ['lodgeWin'], plain: 'lodgePlain', ground: 'lodgeWin', bay: 3.4 },
};

function shade(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k).getHex();
}

// 一面牆：沿外側法線（n/s/e/w）放置，u 以開間數、v 以樓層數重複
function face(B, side, x0, z0, x1, z1, yb, yt, tile, color, u0, u1, v0, v1) {
  const uv = [u0, v0, u1, v0, u1, v1, u0, v1];
  const r = tile ? R(tile) : null;
  switch (side) {
    case 'n':
      B.quad(x1, yb, z0, x0, yb, z0, x0, yt, z0, x1, yt, z0, color, uv, r);
      break;
    case 's':
      B.quad(x0, yb, z1, x1, yb, z1, x1, yt, z1, x0, yt, z1, color, uv, r);
      break;
    case 'e':
      B.quad(x1, yb, z1, x1, yb, z0, x1, yt, z0, x1, yt, z1, color, uv, r);
      break;
    case 'w':
      B.quad(x0, yb, z0, x0, yb, z1, x0, yt, z1, x0, yt, z0, color, uv, r);
      break;
    default:
  }
}

// 水平面（地面），可沿地形細分
function ground(B, x0, z0, x1, z1, hfn, tile, color, scale, seg = 0) {
  const r = tile ? R(tile) : null;
  const nx = seg > 0 ? Math.max(1, Math.ceil((x1 - x0) / seg)) : 1;
  const nz = seg > 0 ? Math.max(1, Math.ceil((z1 - z0) / seg)) : 1;
  for (let a = 0; a < nx; a++) {
    for (let b = 0; b < nz; b++) {
      const xa = x0 + ((x1 - x0) * a) / nx;
      const xb = x0 + ((x1 - x0) * (a + 1)) / nx;
      const za = z0 + ((z1 - z0) * b) / nz;
      const zb = z0 + ((z1 - z0) * (b + 1)) / nz;
      const uv = [xa / scale, -zb / scale, xb / scale, -zb / scale, xb / scale, -za / scale, xa / scale, -za / scale];
      B.quad(xa, hfn(xa, zb), zb, xb, hfn(xb, zb), zb, xb, hfn(xb, za), za, xa, hfn(xa, za), za, color, uv, r);
    }
  }
}

// 高度場網格（雪山、沙灘、碗池），頂點色由 colorFn 決定
function heightfield(B, x0, z0, x1, z1, step, hfn, colorFn, tile, scale) {
  const nx = Math.max(1, Math.round((x1 - x0) / step));
  const nz = Math.max(1, Math.round((z1 - z0) / step));
  const r = tile ? R(tile) : null;
  const H = [];
  for (let a = 0; a <= nx; a++) {
    H[a] = [];
    for (let b = 0; b <= nz; b++) H[a][b] = hfn(x0 + ((x1 - x0) * a) / nx, z0 + ((z1 - z0) * b) / nz);
  }
  const base = B.n;
  const c = new THREE.Color();
  for (let b = 0; b <= nz; b++) {
    for (let a = 0; a <= nx; a++) {
      const x = x0 + ((x1 - x0) * a) / nx;
      const z = z0 + ((z1 - z0) * b) / nz;
      const y = H[a][b];
      const hl = H[Math.max(0, a - 1)][b];
      const hr = H[Math.min(nx, a + 1)][b];
      const hd = H[a][Math.max(0, b - 1)];
      const hu = H[a][Math.min(nz, b + 1)];
      const dx = ((x1 - x0) / nx) * ((a > 0 ? 1 : 0) + (a < nx ? 1 : 0));
      const dz = ((z1 - z0) / nz) * ((b > 0 ? 1 : 0) + (b < nz ? 1 : 0));
      let nxv = -(hr - hl) / dx;
      let nzv = -(hu - hd) / dz;
      const l = Math.hypot(nxv, 1, nzv);
      B.pos.push(x, y, z);
      B.nor.push(nxv / l, 1 / l, nzv / l);
      c.set(colorFn(x, z, y, 1 / l));
      B.col.push(c.r, c.g, c.b);
      B.uv.push(x / scale, -z / scale);
      const rr = r || [0, 0, 0, 0];
      B.atl.push(rr[0], rr[1], rr[2], rr[3]);
    }
  }
  const row = nx + 1;
  for (let b = 0; b < nz; b++) {
    for (let a = 0; a < nx; a++) {
      const i0 = base + b * row + a;
      const i1 = i0 + 1;
      const i2 = i0 + row;
      const i3 = i2 + 1;
      B.idx.push(i0, i2, i1, i1, i2, i3);
    }
  }
  B.n += (nx + 1) * (nz + 1);
}

// 沿地形的直立帶（路緣、運河岸壁）
function strip(B, xa, za, xb, zb, botFn, topFn, tile, color, scale, seg = 6) {
  const len = Math.hypot(xb - xa, zb - za);
  const n = Math.max(1, Math.ceil(len / seg));
  const r = tile ? R(tile) : null;
  for (let k = 0; k < n; k++) {
    const t0 = k / n;
    const t1 = (k + 1) / n;
    const x0 = xa + (xb - xa) * t0;
    const z0 = za + (zb - za) * t0;
    const x1 = xa + (xb - xa) * t1;
    const z1 = za + (zb - za) * t1;
    const b0 = botFn(x0, z0);
    const b1 = botFn(x1, z1);
    const u0 = (len * t0) / scale;
    const u1 = (len * t1) / scale;
    B.quad(x0, b0, z0, x1, b1, z1, x1, topFn(x1, z1), z1, x0, topFn(x0, z0), z0, color, [u0, 0, u1, 0, u1, (topFn(x1, z1) - b1) / scale, u0, (topFn(x0, z0) - b0) / scale], r);
  }
}

// ── 建物 ──
// 一側牆上第 t（0..1，從 uv 的 u0 端起算）處的位置與外法線（與 face() 的 u 方向一致）
function wallAt(p, s, t) {
  if (s === 'n') return [[p.x1 - (p.x1 - p.x0) * t, p.z0], [0, -1]];
  if (s === 's') return [[p.x0 + (p.x1 - p.x0) * t, p.z1], [0, 1]];
  if (s === 'e') return [[p.x1, p.z1 - (p.z1 - p.z0) * t], [1, 0]];
  return [[p.x0, p.z0 + (p.z1 - p.z0) * t], [-1, 0]];
}

// win：WinLights 的收集器（只給近景圖磚），把每扇窗對應到室內的房間
export function buildBuilding(B, b, lod, W, win = null) {
  const st = STYLE[b.style] || STYLE.stone;
  const rnd = mulberry32(b.seed);
  const winTile = st.win[Math.floor(rnd() * st.win.length)];
  const col = b.color;
  const yU = b.floor0 + b.groundH; // 二樓地板
  const uOff = (b.seed % 17) + 0.0;
  const sides = ['n', 's', 'e', 'w'];
  const shopSign = b.shop ? parseInt(b.shop.sign.slice(1), 16) : col;
  const facing = (s) => s === b.front || s === b.corner;
  // 和隔壁相接的側牆（連棟屋）不開窗
  const party = (s) => {
    if (b.osm) return false;
    if (!(b.style === 'canal' || b.style === 'plaster' || b.style === 'stucco' || b.style === 'brick')) return false;
    const blk = W.blockRect(Math.floor(((b.x0 + b.x1) / 2) / W.chunkW), Math.floor(((b.z0 + b.z1) / 2) / W.chunkD));
    if (s === 'w') return b.x0 > blk.x0 + 0.5;
    if (s === 'e') return b.x1 < blk.x1 - 0.5;
    return false;
  };

  // 每一段（量體 × 側）的窗欄數與位置
  const bayOf = (p, s) => Math.max(1, Math.round((s === 'n' || s === 's' ? p.x1 - p.x0 : p.z1 - p.z0) / st.bay));
  const gBayOf = (p, s) => (b.shop && facing(s) && !party(s) ? Math.max(1, Math.round((s === 'n' || s === 's' ? p.x1 - p.x0 : p.z1 - p.z0) / 4.2)) : bayOf(p, s));
  const colOff = {};
  let wl = null;
  if (win) {
    const cols = [];
    b.parts.forEach((p, pi) => {
      for (const s of sides) {
        const bays = bayOf(p, s);
        const gB = pi === 0 ? gBayOf(p, s) : 0;
        colOff[`${pi}${s}`] = cols.length;
        for (let k = 0; k < Math.max(bays, gB); k++) {
          const [u, n] = wallAt(p, s, Math.min(1, (k + 0.5) / bays));
          const g = gB ? wallAt(p, s, Math.min(1, (k + 0.5) / gB))[0] : u;
          cols.push({ g, u, n });
        }
      }
    });
    wl = cols.length ? win.add(b, cols, cols.length) : null;
    if (wl) wl.stride = cols.length;
  }
  // 窗燈屬性：[起點 + 1, 每層欄數, 欄位偏移, 樓層偏移 + 層數 × 4]
  const wv = (pi, s, du, floorOff) => (wl ? [wl.base + 1, wl.stride, colOff[`${pi}${s}`] + du, floorOff + wl.rows * 4] : null);

  b.parts.forEach((p, pi) => {
    const yb = pi === 0 ? b.base : b.base + b.parts[pi - 1].top;
    const yt = b.base + p.top;
    for (const s of sides) {
      const along = s === 'n' || s === 's' ? p.x1 - p.x0 : p.z1 - p.z0;
      const bays = bayOf(p, s);
      const pw = party(s) && pi === 0;
      if (pi === 0) {
        // 地基（坡地時露出）
        if (b.floor0 - b.base > 0.05) face(B, s, p.x0, p.z0, p.x1, p.z1, b.base, b.floor0, 'stonePlain', shade(col, 0.7), 0, along / 3, 0, (b.floor0 - b.base) / 3);
        // 一樓：店面、車庫或大門
        let gTile = pw ? st.plain : st.ground;
        let gCol = col;
        let gBays = bays;
        if (b.shop && facing(s) && !pw) {
          gTile = 'shopB';
          gCol = shopSign;
          gBays = Math.max(1, Math.round(along / 4.2));
        } else if (b.garage && s === b.front) gTile = 'garage';
        else if (!facing(s) && !pw) gTile = b.style === 'glass' ? 'glassLobby' : winTile;
        if (gTile === 'shopB' && gBays > 1) {
          // 中間一格是門，其餘是櫥窗
          const segs = gBays;
          for (let k = 0; k < segs; k++) {
            const t0 = k / segs;
            const t1 = (k + 1) / segs;
            const door = k === Math.floor(segs / 2);
            B.win(wv(0, s, k, 0), () => sub(B, s, p, t0, t1, b.floor0, yU, door ? 'shopB' : 'shopA', gCol, 0, 1, 0, 1));
          }
        } else B.win(wv(0, s, -uOff, 0), () => face(B, s, p.x0, p.z0, p.x1, p.z1, b.floor0, yU, gTile, gCol, uOff, uOff + gBays, 0, 1));
        // 樓上
        if (yt > yU + 0.01) {
          const tile = pw ? st.plain : winTile;
          B.win(wv(0, s, -uOff, 1), () => face(B, s, p.x0, p.z0, p.x1, p.z1, yU, yt, tile, col, uOff, uOff + bays, 0, (yt - yU) / b.floorH));
        }
      } else {
        const v0 = (yb - yU) / b.floorH;
        B.win(wv(pi, s, -uOff, 1), () => face(B, s, p.x0, p.z0, p.x1, p.z1, yb, yt, winTile, col, uOff, uOff + bays, v0, v0 + (yt - yb) / b.floorH));
      }
    }
    // 屋頂
    const isTop = pi === b.parts.length - 1;
    const pitched = isTop && b.roof !== 'flat';
    if (!pitched) {
      const rc = 0x9a9ea3;
      B.quad(p.x0, yt, p.z1, p.x1, yt, p.z1, p.x1, yt, p.z0, p.x0, yt, p.z0, rc, [p.x0 / 4, -p.z1 / 4, p.x1 / 4, -p.z1 / 4, p.x1 / 4, -p.z0 / 4, p.x0 / 4, -p.z0 / 4], R('roofGravel'));
      if (lod <= 1 && b.style !== 'glass') {
        // 簷口
        const cc = shade(col, b.style === 'brick' ? 1.35 : 0.88);
        const o = 0.28;
        B.box(p.x0 - o, yt - 0.55, p.z0 - o, p.x1 + o, yt + 0.15, p.z0 + 0.3, cc);
        B.box(p.x0 - o, yt - 0.55, p.z1 - 0.3, p.x1 + o, yt + 0.15, p.z1 + o, cc);
        B.box(p.x0 - o, yt - 0.55, p.z0, p.x0 + 0.3, yt + 0.15, p.z1, cc);
        B.box(p.x1 - 0.3, yt - 0.55, p.z0, p.x1 + o, yt + 0.15, p.z1, cc);
      } else if (b.style === 'glass') {
        B.box(p.x0, yt, p.z0, p.x1, yt + 0.9, p.z0 + 0.25, shade(col, 0.8));
        B.box(p.x0, yt, p.z1 - 0.25, p.x1, yt + 0.9, p.z1, shade(col, 0.8));
        B.box(p.x0, yt, p.z0, p.x0 + 0.25, yt + 0.9, p.z1, shade(col, 0.8));
        B.box(p.x1 - 0.25, yt, p.z0, p.x1, yt + 0.9, p.z1, shade(col, 0.8));
      }
    } else roof(B, b, p, yt, lod);
  });

  if (lod <= 1 && b.bay) bayWindows(B, b, st);
  if (lod === 0) {
    if (b.shop && b.style !== 'glass' && rnd() < 0.65) awning(B, b, shopSign);
    if (b.stoop && (!b.shop || b.stoopY !== undefined)) stoop(B, b, col);
    if (b.porch) porch(B, b);
    for (const rp of b.roofProps || []) roofProp(B, rp, b.base + b.parts[b.parts.length - 1].top, rnd);
  }
}

// 牆面的一段（t0..t1 沿牆方向）
function sub(B, s, p, t0, t1, yb, yt, tile, color, u0, u1, v0, v1) {
  let x0 = p.x0;
  let x1 = p.x1;
  let z0 = p.z0;
  let z1 = p.z1;
  if (s === 'n') {
    // 由東往西（x1 → x0）
    const a = p.x1 - (p.x1 - p.x0) * t0;
    const b2 = p.x1 - (p.x1 - p.x0) * t1;
    x0 = b2;
    x1 = a;
  } else if (s === 's') {
    x0 = p.x0 + (p.x1 - p.x0) * t0;
    x1 = p.x0 + (p.x1 - p.x0) * t1;
  } else if (s === 'e') {
    const a = p.z1 - (p.z1 - p.z0) * t0;
    const b2 = p.z1 - (p.z1 - p.z0) * t1;
    z0 = b2;
    z1 = a;
  } else {
    z0 = p.z0 + (p.z1 - p.z0) * t0;
    z1 = p.z0 + (p.z1 - p.z0) * t1;
  }
  face(B, s, x0, z0, x1, z1, yb, yt, tile, color, u0, u1, v0, v1);
}

function roof(B, b, p, yt, lod) {
  const w = p.x1 - p.x0;
  const d = p.z1 - p.z0;
  const rc = b.roofColor ?? 0x3e4147;
  const wallTile = (STYLE[b.style] || STYLE.stone).plain;
  const col = b.color;
  const o = 0.35;
  const T = R('roofTile');
  if (b.roof === 'gablex' || b.roof === 'hip') {
    // 屋脊沿 x
    const H = Math.min(d * 0.45, 4.5);
    const yr = yt + H;
    const zm = (p.z0 + p.z1) / 2;
    const inset = b.roof === 'hip' ? Math.min(d / 2, w / 2 - 0.5) : 0;
    const xa = p.x0 + inset;
    const xb = p.x1 - inset;
    const uvL = [0, 0, w / 3, 0, w / 3, H / 2.4, 0, H / 2.4];
    // 北坡、南坡
    B.quad(p.x1 + o, yt - 0.2, p.z0 - o, p.x0 - o, yt - 0.2, p.z0 - o, xa - (inset ? 0 : o), yr, zm, xb + (inset ? 0 : o), yr, zm, rc, uvL, T);
    B.quad(p.x0 - o, yt - 0.2, p.z1 + o, p.x1 + o, yt - 0.2, p.z1 + o, xb + (inset ? 0 : o), yr, zm, xa - (inset ? 0 : o), yr, zm, rc, uvL, T);
    if (b.roof === 'hip') {
      B.tri(p.x0 - o, yt - 0.2, p.z0 - o, p.x0 - o, yt - 0.2, p.z1 + o, xa, yr, zm, rc, [0, 0, d / 3, 0, d / 6, H / 2.4], T);
      B.tri(p.x1 + o, yt - 0.2, p.z1 + o, p.x1 + o, yt - 0.2, p.z0 - o, xb, yr, zm, rc, [0, 0, d / 3, 0, d / 6, H / 2.4], T);
    } else {
      const wr = R(wallTile);
      B.tri(p.x0, yt, p.z0, p.x0, yt, p.z1, p.x0, yr, zm, col, [0, 0, d / 3, 0, d / 6, H / 3], wr);
      B.tri(p.x1, yt, p.z1, p.x1, yt, p.z0, p.x1, yr, zm, col, [0, 0, d / 3, 0, d / 6, H / 3], wr);
    }
    if (b.style === 'lodge' && lod <= 1) {
      // 煙囪
      B.box(p.x1 - 3, yt, zm + 1, p.x1 - 1.8, yr + 1.4, zm + 2.2, 0x7d7a74);
    }
    return;
  }
  // 運河屋：屋脊沿 z，山形牆朝街
  const H = Math.min(Math.max(w * 0.8, 2.6), 6.2);
  const yr = yt + H;
  const xm = (p.x0 + p.x1) / 2;
  const uvL = [0, 0, d / 3, 0, d / 3, H / 2.4, 0, H / 2.4];
  // 西坡、東坡
  B.quad(p.x0 - 0.1, yt - 0.1, p.z0 + 0.2, p.x0 - 0.1, yt - 0.1, p.z1 - 0.2, xm, yr, p.z1 - 0.2, xm, yr, p.z0 + 0.2, rc, uvL, T);
  B.quad(p.x1 + 0.1, yt - 0.1, p.z1 - 0.2, p.x1 + 0.1, yt - 0.1, p.z0 + 0.2, xm, yr, p.z0 + 0.2, xm, yr, p.z1 - 0.2, rc, uvL, T);
  const fronts = b.front === 's' ? ['s', 'n'] : ['n', 's'];
  fronts.forEach((s, k) => {
    const z = s === 'n' ? p.z0 : p.z1;
    const kind = k === 0 ? b.roof : 'gable';
    gableFace(B, s, p.x0, p.x1, z, yt, H, kind, col, b.trim ?? 0xf4f1ea, lod);
  });
}

function gableFace(B, s, x0, x1, z, yt, H, kind, col, trim, lod) {
  const w = x1 - x0;
  const xm = (x0 + x1) / 2;
  const plain = R('canalPlain');
  const attic = R('attic');
  // 依面向決定頂點順序（讓法線朝外）
  const Q = (xa, ya, xb, yb2, tile, c, u = 1, v = 1) => {
    if (s === 'n') B.quad(xb, ya, z, xa, ya, z, xa, yb2, z, xb, yb2, z, c, [0, 0, u, 0, u, v, 0, v], tile);
    else B.quad(xa, ya, z, xb, ya, z, xb, yb2, z, xa, yb2, z, c, [0, 0, u, 0, u, v, 0, v], tile);
  };
  const Tri = (xa, xb, ya, xc, yc, tile, c) => {
    if (s === 'n') B.tri(xb, ya, z, xa, ya, z, xc, yc, z, c, [0, 0, (xb - xa) / 2.7, 0, (xb - xa) / 5.4, (yc - ya) / 3.1], tile);
    else B.tri(xa, ya, z, xb, ya, z, xc, yc, z, c, [0, 0, (xb - xa) / 2.7, 0, (xb - xa) / 5.4, (yc - ya) / 3.1], tile);
  };
  const off = s === 'n' ? -0.04 : 0.04;
  if (kind === 'step') {
    const n = 4;
    for (let k = 0; k < n; k++) {
      const hw = (w / 2) * (1 - k / n);
      const y0 = yt + (H * k) / n;
      const y1 = yt + (H * (k + 1)) / n;
      Q(xm - hw, y0, xm + hw, y1, k === 0 ? attic : plain, col, 1, 1);
      // 每一階的白色頂邊
      if (lod <= 1) B.box(xm - hw - 0.05, y1 - 0.08, z - 0.12 + off, xm + hw + 0.05, y1 + 0.06, z + 0.12 + off, trim);
    }
  } else if (kind === 'neck' || kind === 'bell') {
    const nw = w * 0.46;
    const sh = H * 0.42;
    Q(x0, yt, x1, yt + sh * 0.35, plain, col, 2, 0.4);
    Tri(x0, xm - nw / 2, yt + sh * 0.35, xm - nw / 2, yt + sh, plain, col);
    Tri(xm + nw / 2, x1, yt + sh * 0.35, xm + nw / 2, yt + sh, plain, col);
    Q(xm - nw / 2, yt + sh * 0.35, xm + nw / 2, yt + H - 0.6, attic, col, 1, 1);
    Tri(xm - nw / 2 - 0.25, xm + nw / 2 + 0.25, yt + H - 0.6, xm, yt + H + 0.4, null, trim);
    if (lod <= 1) {
      B.box(xm - nw / 2 - 0.3, yt + H - 0.72, z - 0.15 + off, xm + nw / 2 + 0.3, yt + H - 0.55, z + 0.15 + off, trim);
      if (kind === 'bell') {
        for (const sx of [-1, 1]) B.geom(P.sphere(8, 6), mat(xm + sx * (nw / 2 + 0.35), yt + sh * 0.7, z + off, 0.45, 0.55, 0.15), trim);
      }
    }
  } else {
    // 普通山形牆：白色封簷板
    Tri(x0, x1, yt, xm, yt + H, attic, col);
    if (lod <= 1) {
      const len = Math.hypot(w / 2, H) + 0.4;
      const ang = Math.atan2(H, w / 2);
      B.geom(P.box(), mat(x0 + w / 4, yt + H / 2, z + off * 3, len, 0.18, 0.12, 0, 0, ang), trim);
      B.geom(P.box(), mat(x1 - w / 4, yt + H / 2, z + off * 3, len, 0.18, 0.12, 0, 0, -ang), trim);
    }
  }
  // 吊貨樑
  if (lod === 0 && kind !== 'gable') B.box(xm - 0.08, yt + H - 1.0, z - (s === 'n' ? 0.9 : -0.1), xm + 0.08, yt + H - 0.8, z + (s === 'n' ? -0.1 : 0.9), 0x2a2420);
}

function bayWindows(B, b, st) {
  const s = b.front;
  if (s !== 'n' && s !== 's') return;
  const w = b.x1 - b.x0;
  const n = w > 12 ? 2 : 1;
  const z = s === 'n' ? b.z0 : b.z1;
  const dir = s === 'n' ? -1 : 1;
  const yU = b.floor0 + b.groundH;
  const top = b.base + b.parts[0].top - 0.5;
  if (top - yU < 2) return;
  const tr = b.trim ?? 0xffffff;
  for (let k = 0; k < n; k++) {
    const cx = b.x0 + (w * (k + 0.5)) / n;
    const hw = 1.6;
    const zf = z + dir * 0.85;
    const za = Math.min(z, zf);
    const zb = Math.max(z, zf);
    const p = { x0: cx - hw, x1: cx + hw, z0: za, z1: zb };
    const tile = st.win[0];
    face(B, s, p.x0, p.z0, p.x1, p.z1, yU, top, tile, b.color, 0, 1, 0, (top - yU) / b.floorH);
    face(B, 'e', p.x0, p.z0, p.x1, p.z1, yU, top, tile, b.color, 0, 0.35, 0, (top - yU) / b.floorH);
    face(B, 'w', p.x0, p.z0, p.x1, p.z1, yU, top, tile, b.color, 0.65, 1, 0, (top - yU) / b.floorH);
    B.box(p.x0 - 0.1, top, p.z0 - 0.1, p.x1 + 0.1, top + 0.25, p.z1 + 0.1, tr);
    B.box(p.x0, yU - 0.2, p.z0, p.x1, yU, p.z1, tr);
  }
}

function awning(B, b, color) {
  const s = b.front;
  if (s !== 'n' && s !== 's') return;
  const dir = s === 'n' ? -1 : 1;
  const z = s === 'n' ? b.z0 : b.z1;
  const y = b.floor0 + b.groundH - 0.55;
  const x0 = b.x0 + 0.4;
  const x1 = b.x1 - 0.4;
  const zo = z + dir * 1.5;
  if (s === 'n') B.quad(x1, y - 0.7, zo, x0, y - 0.7, zo, x0, y, z, x1, y, z, color);
  else B.quad(x0, y - 0.7, zo, x1, y - 0.7, zo, x1, y, z, x0, y, z, color);
  B.box(Math.min(x0, x1), y - 0.95, Math.min(zo, zo - dir * 0.05), Math.max(x0, x1), y - 0.7, Math.max(zo, zo - dir * 0.05) + 0.001, shade(color, 0.8));
}

function stoop(B, b, col) {
  const s = b.door.side;
  if (s !== 'n' && s !== 's') return;
  const dir = s === 'n' ? -1 : 1;
  const z = s === 'n' ? b.z0 : b.z1;
  const cx = b.door.x;
  const c = shade(col, 0.75);
  if (b.stoopY !== undefined) {
    // 坡地：從門前的人行道一階階爬到一樓地板
    const drop = b.floor0 - b.stoopY;
    const n = clamp(Math.round(drop / 0.18), 1, 14);
    const rise = drop / n;
    for (let k = 0; k < n; k++) {
      const za = z + dir * ((n - 1 - k) * 0.3);
      const zb = z + dir * ((n - k) * 0.3);
      B.box(cx - 0.95, b.stoopY - 0.3, Math.min(za, zb), cx + 0.95, b.stoopY + rise * (k + 1), Math.max(za, zb), c);
    }
    const ze = z + dir * (n * 0.3 + 0.1);
    for (const sx of [-1, 1]) B.box(cx + sx * 1.0 - 0.08, b.stoopY - 0.3, Math.min(z, ze), cx + sx * 1.0 + 0.08, b.floor0 + 0.9, Math.max(z, ze), shade(col, 0.55));
    return;
  }
  for (let k = 0; k < 4; k++) {
    const za = z + dir * (k * 0.32);
    const zb = z + dir * ((k + 1) * 0.32);
    B.box(cx - 0.95, b.floor0, Math.min(za, zb) - (k === 0 ? 0 : 0), cx + 0.95, b.floor0 + 0.2 * (4 - k), Math.max(za, zb), c);
  }
  for (const sx of [-1, 1]) B.box(cx + sx * 1.0 - 0.06, b.floor0, Math.min(z, z + dir * 1.3), cx + sx * 1.0 + 0.06, b.floor0 + 1.6, Math.max(z, z + dir * 1.3), 0x2a2e33);
}

function porch(B, b) {
  const s = b.front;
  const dir = s === 'n' ? -1 : 1;
  const z = s === 'n' ? b.z0 : b.z1;
  const x0 = b.x0 + 1;
  const x1 = b.x1 - 1;
  const zo = z + dir * 2.2;
  B.box(x0, b.floor0, Math.min(z, zo), x1, b.floor0 + 0.45, Math.max(z, zo), 0xd9d4c8);
  B.box(x0 - 0.2, b.floor0 + 2.8, Math.min(z, zo) - 0.1, x1 + 0.2, b.floor0 + 3.0, Math.max(z, zo) + 0.1, b.roofColor ?? 0x4a4f57);
  for (const x of [x0 + 0.2, x1 - 0.2]) B.geom(P.cyl(8), mat(x, b.floor0 + 1.6, zo - dir * 0.2, 0.1, 2.4, 0.1), 0xffffff);
}

function roofProp(B, rp, y, rnd) {
  if (rp.type === 'watertower') {
    const wood = 0x7a5a3d;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.geom(P.cyl(5), mat(rp.x + dx * 1.2, y + 1.6, rp.z + dz * 1.2, 0.09, 3.2, 0.09), 0x3b3f44);
    B.geom(P.cyl(14), mat(rp.x, y + 4.6, rp.z, 1.8, 2.9, 1.8), wood);
    for (const hy of [3.6, 4.6, 5.6]) B.geom(P.cyl(14), mat(rp.x, y + hy, rp.z, 1.83, 0.08, 1.83), 0x2f3337);
    B.geom(P.cone(14), mat(rp.x, y + 6.6, rp.z, 2.0, 1.1, 2.0), 0x4a4f55);
  } else if (rp.type === 'hvac') {
    const w = 2 + rnd() * 3;
    const d = 1.5 + rnd() * 2;
    B.box(rp.x - w / 2, y, rp.z - d / 2, rp.x + w / 2, y + 1.3 + rnd(), rp.z + d / 2, 0xb2b6bb);
    B.geom(P.cyl(10), mat(rp.x, y + 1.6, rp.z, 0.6, 0.6, 0.6), 0x8c9096);
  } else if (rp.type === 'antenna') {
    B.geom(P.cyl(6), mat(rp.x, y + 9, rp.z, 0.25, 18, 0.25), 0xc9ccd0);
    B.geom(P.cyl(6), mat(rp.x, y + 1.5, rp.z, 1.2, 3, 1.2), 0x9aa0a6);
  }
}

// ── 街道家具 ──
function lamp(B, G, l, gfn) {
  const y = gfn(l.x, l.z);
  if (l.kind === 'lantern') {
    const c = 0x24332c;
    B.geom(P.cyl(8), mat(l.x, y + 2.0, l.z, 0.07, 4.0, 0.07), c);
    B.geom(P.cyl(8), mat(l.x, y + 0.25, l.z, 0.14, 0.5, 0.14), c);
    B.geom(P.cone(6), mat(l.x, y + 4.75, l.z, 0.32, 0.3, 0.32), c);
    G.geom(P.cyl(6), mat(l.x, y + 4.3, l.z, 0.22, 0.6, 0.22), 0xffd59a);
    return [l.x, y + 4.3, l.z];
  }
  const c = 0x5b6168;
  const dx = -Math.sin(l.rot);
  const dz = -Math.cos(l.rot);
  B.geom(P.cyl(8), mat(l.x, y + 3.8, l.z, 0.1, 7.6, 0.1), c);
  B.geom(P.cyl(8), mat(l.x, y + 0.3, l.z, 0.18, 0.6, 0.18), c);
  B.geom(P.box(), mat(l.x + dx * 1.1, y + 7.55, l.z + dz * 1.1, 0.09, 0.09, 2.2, 0, Math.atan2(dx, dz), 0), c);
  B.geom(P.box(), mat(l.x + dx * 2.2, y + 7.5, l.z + dz * 2.2, 0.36, 0.16, 0.7, 0, Math.atan2(dx, dz), 0), 0x7b8188);
  G.geom(P.box(), mat(l.x + dx * 2.2, y + 7.4, l.z + dz * 2.2, 0.28, 0.04, 0.5, 0, Math.atan2(dx, dz), 0), 0xffe2b0);
  return [l.x + dx * 2.2, y + 7.4, l.z + dz * 2.2];
}

function tree(B, t, gfn, rnd) {
  const y = gfn(t.x, t.z);
  const h = t.h;
  B.geom(P.cyl(6), mat(t.x, y + h * 0.3, t.z, 0.16 + h * 0.012, h * 0.6, 0.16 + h * 0.012), 0x6b5440);
  const greens = [0x5d8f3f, 0x6fa04a, 0x4f7f38, 0x7aa64f];
  const n = t.kind === 'elm' ? 5 : 4;
  const r0 = h * (t.kind === 'street' ? 0.28 : 0.32);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd();
    const rr = r0 * (0.75 + rnd() * 0.4);
    const off = k === 0 ? 0 : r0 * 0.55;
    B.geom(P.ico(1), mat(t.x + Math.cos(a) * off, y + h * (0.68 + (k === 0 ? 0.12 : rnd() * 0.12)), t.z + Math.sin(a) * off, rr, rr * (t.kind === 'elm' ? 1.15 : 0.9), rr), greens[(k + Math.floor(rnd() * 4)) % 4]);
  }
}

function palm(B, t, gfn, rnd) {
  const y = gfn(t.x, t.z);
  const lean = (rnd() - 0.5) * 0.25;
  const la = rnd() * Math.PI * 2;
  let px = t.x;
  let pz = t.z;
  let py = y;
  const segs = 6;
  for (let k = 0; k < segs; k++) {
    const sh = t.h / segs;
    const nx = px + Math.cos(la) * lean * sh * (k / segs) * 2;
    const nz = pz + Math.sin(la) * lean * sh * (k / segs) * 2;
    B.geom(P.cyl(6), mat((px + nx) / 2, py + sh / 2, (pz + nz) / 2, 0.2 - k * 0.012, sh * 1.02, 0.2 - k * 0.012, 0, 0, 0), k % 2 ? 0x9c8366 : 0x8e7559);
    px = nx;
    pz = nz;
    py += sh;
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + rnd() * 0.3;
    const L = 2.8 + rnd() * 0.8;
    B.geom(P.box(), mat(px + Math.cos(a) * L * 0.45, py - 0.35, pz + Math.sin(a) * L * 0.45, 0.6, 0.05, L, 0.42, -a + Math.PI / 2, 0), k % 2 ? 0x4f8f3a : 0x5f9d42);
  }
  B.geom(P.sphere(6, 5), mat(px, py - 0.25, pz, 0.35, 0.3, 0.35), 0x6b5236);
}

function pine(B, t, gfn) {
  const y = gfn(t.x, t.z);
  const h = t.h;
  B.geom(P.cyl(5), mat(t.x, y + h * 0.12, t.z, 0.22, h * 0.25, 0.22), 0x5a4332);
  const tiers = 4;
  for (let k = 0; k < tiers; k++) {
    const r = h * 0.26 * (1 - k / (tiers + 0.6));
    const ty = y + h * (0.2 + k * 0.2);
    B.geom(P.cone(7), mat(t.x, ty + h * 0.14, t.z, r, h * 0.32, r), k % 2 ? 0x2f5a3a : 0x2a5134);
    if (t.snow) B.geom(P.cone(7), mat(t.x, ty + h * 0.2, t.z, r * 0.78, h * 0.18, r * 0.78), 0xf1f5f9);
  }
}

function trafficLight(B, t, gfn, lens) {
  const y = gfn(t.x, t.z);
  const c = 0x2d3135;
  B.geom(P.cyl(8), mat(t.x, y + 2.9, t.z, 0.1, 5.8, 0.1), c);
  // 伸向路中央的橫臂（雙向各一）
  const dirs = t.rot === 0 ? [[-1, 0], [0, -1]] : [[1, 0], [0, 1]];
  for (const [dx, dz] of dirs) {
    const L = 4.6;
    B.geom(P.box(), mat(t.x + dx * L / 2, y + 5.7, t.z + dz * L / 2, dx ? L : 0.1, 0.1, dz ? L : 0.1), c);
    const hx = t.x + dx * L;
    const hz = t.z + dz * L;
    B.geom(P.box(), mat(hx, y + 5.0, hz, 0.38, 1.1, 0.38), 0x2a2d30);
    // 沿 x 的橫臂吊在大道上（管南北向車流），沿 z 的吊在街道上（管東西向車流）；燈面朝向來車
    const axis = dx ? 'z' : 'x';
    const fx = dx ? 0 : dz;
    const fz = dx ? -dx : 0;
    lens.push({ x: hx + fx * 0.2, y: y + 5.0, z: hz + fz * 0.2, axis, fx, fz });
  }
  B.geom(P.box(), mat(t.x, y + 1.2, t.z + 0.12, 0.25, 0.35, 0.12), 0x3a3f45);
}

function bench(B, k, gfn) {
  const y = gfn(k.x, k.z);
  const r = k.rot || 0;
  B.geom(P.box(), mat(k.x, y + 0.45, k.z, 1.8, 0.06, 0.5, 0, r, 0), 0x8a6a4a);
  B.geom(P.box(), mat(k.x, y + 0.8, k.z + 0.24, 1.8, 0.4, 0.05, 0, r, 0), 0x8a6a4a);
  for (const s of [-0.75, 0.75]) B.geom(P.box(), mat(k.x + s, y + 0.22, k.z, 0.06, 0.45, 0.45, 0, r, 0), 0x2f3337);
}

function parkedCar(B, c, gfn) {
  const parts = carParts(c.model, c.color, true);
  const y = gfn(c.x, c.z);
  const m = mat(c.x, y, c.z, 1, 1, 1, 0, c.rot, 0).clone();
  // Builder.append 只能平移；這裡逐塊套用矩陣
  appendXform(B, parts.paint, m);
  appendXform(B, parts.detail, m);
  appendXform(B, parts.lights, m, 0.75);
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
function appendXform(B, src, m, dim = 1) {
  const base = B.n;
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  for (let i = 0; i < src.pos.length; i += 3) {
    _v.set(src.pos[i], src.pos[i + 1], src.pos[i + 2]).applyMatrix4(m);
    B.pos.push(_v.x, _v.y, _v.z);
    _n.set(src.nor[i], src.nor[i + 1], src.nor[i + 2]).applyMatrix3(nm).normalize();
    B.nor.push(_n.x, _n.y, _n.z);
  }
  for (const v of src.col) B.col.push(v * dim);
  for (const v of src.uv) B.uv.push(v);
  for (const v of src.atl) B.atl.push(v);
  for (const i of src.idx) B.idx.push(base + i);
  for (const r of src.wlr) B.wlr.push({ s: base + r.s, e: base + r.e, v: r.v });
  B.n += src.n;
}

function boat(B, bt, waterY) {
  const y = waterY;
  const hx = bt.len / 2;
  const hz = bt.w / 2;
  if (bt.kind === 'buoy') {
    B.geom(P.cyl(10), mat(bt.x, y + 0.5, bt.z, 0.6, 1.6, 0.6), bt.color);
    B.geom(P.cone(10), mat(bt.x, y + 1.7, bt.z, 0.4, 0.9, 0.4), bt.color);
    return;
  }
  // 船身（沿 x 長）
  B.box(bt.x - hx, y - 0.5, bt.z - hz, bt.x + hx, y + 0.75, bt.z + hz, bt.color, false);
  B.box(bt.x - hx - 0.4, y - 0.4, bt.z - hz * 0.8, bt.x - hx, y + 0.6, bt.z + hz * 0.8, bt.color);
  if (bt.kind === 'houseboat') {
    const cx0 = bt.x - hx + 1.2;
    const cx1 = bt.x + hx - 2.4;
    B.box(cx0, y + 0.75, bt.z - hz + 0.45, cx1, y + 2.55, bt.z + hz - 0.45, 0xe9e2d0);
    // 窗帶
    for (let x = cx0 + 0.8; x < cx1 - 0.8; x += 1.8) {
      for (const s of [-1, 1]) B.box(x, y + 1.35, bt.z + s * (hz - 0.46) - 0.02, x + 1.1, y + 2.1, bt.z + s * (hz - 0.46) + 0.02, 0x2a3540);
    }
    B.box(cx0 - 0.2, y + 2.55, bt.z - hz + 0.3, cx1 + 0.2, y + 2.7, bt.z + hz - 0.3, bt.roof);
    // 甲板盆栽
    for (let k = 0; k < 3; k++) {
      B.geom(P.cyl(6), mat(cx1 + 0.6 + k * 0.5, y + 0.95, bt.z - hz + 0.6 + k * 0.6, 0.18, 0.35, 0.18), 0x9a5a3a);
      B.geom(P.ico(0), mat(cx1 + 0.6 + k * 0.5, y + 1.3, bt.z - hz + 0.6 + k * 0.6, 0.3, 0.3, 0.3), 0x4f8f3a);
    }
  } else {
    B.box(bt.x - 1.2, y + 0.75, bt.z - hz * 0.6, bt.x + 1.5, y + 1.6, bt.z + hz * 0.6, 0xf2efe8);
    B.geom(P.cyl(6), mat(bt.x, y + 4.5, bt.z, 0.06, 7.5, 0.06), 0xd9d4c8);
  }
}

function bike(B, k, gfn) {
  const y = gfn(k.x, k.z);
  const r = k.rot;
  const fx = Math.sin(r);
  const fz = Math.cos(r);
  for (const s of [-0.55, 0.55]) B.geom(P.cyl(14), mat(k.x + fx * s, y + 0.34, k.z + fz * s, 0.34, 0.04, 0.34, 0, r, Math.PI / 2), 0x1d1f22);
  B.geom(P.box(), mat(k.x, y + 0.6, k.z, 0.05, 0.05, 1.0, 0, r, 0), k.color);
  B.geom(P.box(), mat(k.x - fx * 0.15, y + 0.5, k.z - fz * 0.15, 0.05, 0.4, 0.05, 0, r, 0.3), k.color);
  B.geom(P.box(), mat(k.x + fx * 0.5, y + 0.9, k.z + fz * 0.5, 0.5, 0.04, 0.04, 0, r, 0), 0x2a2d31);
  B.geom(P.box(), mat(k.x - fx * 0.2, y + 0.85, k.z - fz * 0.2, 0.12, 0.05, 0.22, 0, r, 0), 0x1f2328);
}

function railing(B, r, y) {
  const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
  const n = Math.floor(len / 3.2);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = r.x0 + (r.x1 - r.x0) * t;
    const z = r.z0 + (r.z1 - r.z0) * t;
    B.geom(P.cyl(8), mat(x, y + 0.42, z, 0.09, 0.85, 0.09), 0x5a2a20);
    B.geom(P.sphere(6, 4), mat(x, y + 0.86, z, 0.1, 0.06, 0.1), 0x5a2a20);
  }
}

// ── 主要建構：一塊圖磚 ──
export function buildChunk(W, c, lod, win = null) {
  const Gd = new Builder();
  const Bd = new Builder();
  const Pr = new Builder();
  const Gl = new Builder();
  const pools = [];
  const lens = [];
  const g = (x, z) => W.groundAt(x, z);
  const t = (x, z) => W.terrain(x, z);
  const rnd = mulberry32(hash2(c.i, c.j, 991) * 4294967296);
  const terrSeg = W.kind === 'hills' || W.kind === 'town' ? (lod === 0 ? 6 : lod === 1 ? 12 : 24) : 0;

  if (W.K.grid) gridGround(W, c, lod, Gd, Pr, terrSeg);
  else if (W.kind === 'ski') {
    const step = lod === 0 ? 4 : lod === 1 ? 8 : 16;
    heightfield(Gd, c.x0, c.z0, c.x1, c.z1, step, t, (x, z, y, ny) => {
      const run = W.onRun(x, z);
      if (ny < 0.72) return 0x9a958f;
      return run ? 0xffffff : 0xe7edf3;
    }, 'snow', 8);
  }

  for (const b of c.layers.building) buildBuilding(Bd, b, lod, W, win);

  const P2 = c.props;
  if (lod <= 1) {
    for (const tr of P2.trees) tree(Pr, tr, g, rnd);
    for (const p of P2.palms) palm(Pr, p, g, rnd);
    for (const p of P2.pines) pine(Pr, p, t);
    for (const bt of P2.boats) boat(Pr, bt, W.waterY);
    for (const r of P2.rocks) Pr.geom(P.ico(0), mat(r.x, t(r.x, r.z) + r.s * 0.3, r.z, r.s, r.s * 0.7, r.s * 1.1, 0, rnd() * 3, 0), 0x77736d);
    for (const tw of P2.towers) liftTower(Pr, tw, t);
    for (const sh of P2.ship) ship(Pr, sh);
    if (W.kind === 'ski' && c.i === 1 && c.j === 1) liftStations(Pr, W);
    if (W.kind === 'ski' && c.i === 1 && c.j === -6) liftStations(Pr, W, true);
  } else {
    // 遠景：樹只畫成一顆球
    for (const tr of P2.trees) Pr.geom(P.ico(0), mat(tr.x, g(tr.x, tr.z) + tr.h * 0.7, tr.z, tr.h * 0.35, tr.h * 0.35, tr.h * 0.35), 0x5d8f3f);
    for (const p of P2.pines) Pr.geom(P.cone(5), mat(p.x, t(p.x, p.z) + p.h * 0.5, p.z, p.h * 0.25, p.h, p.h * 0.25), 0x2c5537);
    for (const p of P2.palms) Pr.geom(P.ico(0), mat(p.x, g(p.x, p.z) + p.h, p.z, 2.2, 0.8, 2.2), 0x4f8f3a);
    for (const tw of P2.towers) liftTower(Pr, tw, t);
    for (const sh of P2.ship) ship(Pr, sh);
  }
  if (lod === 0) {
    for (const l of P2.lamps) {
      const at = lamp(Pr, Gl, l, g);
      pools.push(at);
    }
    for (const tl of P2.tlights) trafficLight(Pr, tl, g, lens);
    for (const h of P2.hydrants) {
      const y = g(h.x, h.z);
      Pr.geom(P.cyl(8), mat(h.x, y + 0.35, h.z, 0.13, 0.7, 0.13), W.kind === 'metro' ? 0xb3261e : 0xd9a520);
      Pr.geom(P.sphere(8, 5), mat(h.x, y + 0.72, h.z, 0.14, 0.12, 0.14), W.kind === 'metro' ? 0xb3261e : 0xd9a520);
    }
    for (const k of P2.benches) bench(Pr, k, g);
    for (const k of P2.bikes) bike(Pr, k, g);
    for (const r of P2.railings) railing(Pr, r, 0);
    for (const h of P2.hedges) Pr.box(h.x0, g(h.x0, h.z), h.z - 0.4, h.x1, g(h.x0, h.z) + 1.0, h.z + 0.4, 0x4c7a3a);
    for (const lg of P2.lifeguard) lifeguard(Pr, lg, g);
  } else if (lod === 1) {
    for (const l of P2.lamps) {
      const y = g(l.x, l.z);
      Pr.geom(P.cyl(5), mat(l.x, y + 3.5, l.z, 0.1, 7, 0.1), 0x5b6168);
      Gl.geom(P.box(), mat(l.x, y + 7.1, l.z, 0.4, 0.15, 0.4), 0xffe2b0);
    }
  }
  if (lod <= 1) for (const pc of P2.parked) parkedCar(Pr, pc, g);

  return { ground: Gd, build: Bd, props: Pr, glow: Gl, pools, lens };
}

function gridGround(W, c, lod, Gd, Pr, seg) {
  const K = W.K;
  const { i, j } = c;
  const ax = i * K.PX;
  const sz = j * K.PZ;
  const swj = W.streetW(j);
  const swn = W.streetW(j + 1);
  const g = (x, z) => W.groundAt(x, z);
  const t = (x, z) => W.terrain(x, z);
  const canal = W.kind === 'canal';
  const roadTile = canal ? 'pavers' : 'asphalt';
  const roadCol = canal ? 0x9c7f72 : 0xffffff;
  const walkTile = canal ? 'pavers' : W.kind === 'beach' ? 'concrete' : 'sidewalk';
  const walkCol = canal ? 0xc9bfb3 : 0xdcdcdc;
  const curbCol = 0xb9b9b4;
  const b = c.block;

  // 大道段
  if (W.avenueExists(i)) {
    const z0 = sz + swj / 2;
    const z1 = (j + 1) * K.PZ - swn / 2;
    const path = W.avenueClass(i) === 'path';
    ground(Gd, ax - K.avW / 2, z0, ax + K.avW / 2, z1, t, path ? 'woodDeck' : roadTile, path ? 0xcfb79a : roadCol, path ? 3 : 7, seg || 0);
    if (!path && lod <= 1) avenueMarks(Gd, W, ax, z0, z1, t);
  }
  // 街道段與路口
  if (W.streetExists(i, j)) {
    const x0 = ax + K.avW / 2;
    const x1 = (i + 1) * K.PX - K.avW / 2;
    if (W.isCanalLine(j)) {
      const qz = K.canalW / 2;
      for (const s of [-1, 1]) {
        const za = s < 0 ? sz - swj / 2 : sz + qz;
        const zb = s < 0 ? sz - qz : sz + swj / 2;
        ground(Gd, x0, za, x1, zb, t, 'cobble', 0xb3aaa0, 3);
        // 岸壁
        const zw = sz + s * qz;
        // 岸壁面向運河中央
        if (s < 0) strip(Gd, x0, zw, x1, zw, () => W.waterY - 2.8, () => 0, 'quayBrick', 0x8c6a5a, 2.4, 20);
        else strip(Gd, x1, zw, x0, zw, () => W.waterY - 2.8, () => 0, 'quayBrick', 0x8c6a5a, 2.4, 20);
        B_edge(Gd, x0, x1, zw, s);
      }
      if (W.avenueExists(i)) bridge(Gd, Pr, W, ax, sz, lod);
      if (W.avenueExists(i)) {
        // 橋兩端的路口
        for (const s of [-1, 1]) ground(Gd, ax - K.avW / 2, s < 0 ? sz - swj / 2 : sz + qz, ax + K.avW / 2, s < 0 ? sz - qz : sz + swj / 2, t, 'cobble', 0xb3aaa0, 3);
      }
    } else {
      ground(Gd, x0, sz - swj / 2, x1, sz + swj / 2, t, roadTile, roadCol, 7, seg || 0);
      if (W.avenueExists(i)) ground(Gd, ax - K.avW / 2, sz - swj / 2, ax + K.avW / 2, sz + swj / 2, t, roadTile, roadCol, 7, seg || 0);
      if (lod <= 1 && !canal) streetMarks(Gd, W, x0, x1, sz, swj, t, i);
    }
  }

  const use = c.use;
  if (use === 'water' || use === 'beach') {
    heightfield(Gd, c.x0, c.z0, c.x1, c.z1, lod === 0 ? 6 : 12, t, (x, z, y) => (y < 0.3 ? 0xd9c9a3 : W.kind === 'hills' ? 0x8fae6a : 0xeedfb8), W.kind === 'hills' ? 'grass' : 'sand', 6);
    return;
  }
  // 街廓：人行道＋內部
  const top = (x, z) => t(x, z) + CURB;
  const inner = { x0: b.x0 + K.walk, x1: b.x1 - K.walk, z0: b.z0 + K.walk, z1: b.z1 - K.walk };
  if (use === 'skate') {
    skatepark(Gd, Pr, W, b);
  } else if (use === 'parking') {
    ground(Gd, b.x0, b.z0, b.x1, b.z1, (x, z) => t(x, z) + 0.02, 'asphaltPatch', 0xd9d9d9, 8);
    for (let x = b.x0 + 2.55; x < b.x1 - 2; x += 2.9) {
      for (const zz of [b.z0 + 4, b.z0 + 24, b.z0 + 44, b.z0 + 64]) {
        if (zz > b.z1 - 6) continue;
        Gd.quad(x - 0.06, 0.64, zz + 4.5, x + 0.06, 0.64, zz + 4.5, x + 0.06, 0.64, zz - 2.5, x - 0.06, 0.64, zz - 2.5, 0xeeeeee);
      }
    }
  } else {
    // 人行道環（四條）
    ground(Gd, b.x0, b.z0, b.x1, inner.z0, top, walkTile, walkCol, 3, seg);
    ground(Gd, b.x0, inner.z1, b.x1, b.z1, top, walkTile, walkCol, 3, seg);
    ground(Gd, b.x0, inner.z0, inner.x0, inner.z1, top, walkTile, walkCol, 3, seg);
    ground(Gd, inner.x1, inner.z0, b.x1, inner.z1, top, walkTile, walkCol, 3, seg);
    const innerTile = use === 'park' ? 'grass' : W.kind === 'town' ? 'grass' : walkTile;
    const innerCol = use === 'park' || W.kind === 'town' ? 0x7fae58 : walkCol;
    ground(Gd, inner.x0, inner.z0, inner.x1, inner.z1, top, innerTile, innerCol, use === 'park' ? 5 : 3, seg);
    if (use === 'park') {
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      ground(Gd, inner.x0, cz - 1.6, inner.x1, cz + 1.6, (x, z) => top(x, z) + 0.02, 'pavers', 0xd8cfc0, 2, seg);
      ground(Gd, cx - 1.6, inner.z0, cx + 1.6, inner.z1, (x, z) => top(x, z) + 0.02, 'pavers', 0xd8cfc0, 2, seg);
    }
    for (const yd of c.layers.park) if (yd.cls === 'yard' || yd.cls === 'garden') ground(Gd, yd.x0, yd.z0, yd.x1, yd.z1, (x, z) => top(x, z) + 0.015, 'grass', 0x86b35e, 4, seg);
  }
  // 路緣
  if (use !== 'parking') {
    const bot = (x, z) => t(x, z);
    strip(Gd, b.x1, b.z0, b.x0, b.z0, bot, top, null, curbCol, 1, seg || 200);
    strip(Gd, b.x0, b.z1, b.x1, b.z1, bot, top, null, curbCol, 1, seg || 200);
    strip(Gd, b.x0, b.z0, b.x0, b.z1, bot, top, null, curbCol, 1, seg || 200);
    strip(Gd, b.x1, b.z1, b.x1, b.z0, bot, top, null, curbCol, 1, seg || 200);
  }
}

function B_edge(Gd, x0, x1, z, s) {
  // 岸邊石條
  Gd.box(x0, 0, s < 0 ? z - 0.45 : z, x1, 0.12, s < 0 ? z : z + 0.45, 0xb8b0a4);
}

function avenueMarks(B, W, ax, z0, z1, t) {
  const K = W.K;
  const yel = 0xf2c230;
  const wht = 0xf4f4f2;
  const y = (x, z) => t(x, z) + 0.02;
  const cw = 3.2;
  // 中央雙黃線
  for (const o of [-0.16, 0.16]) mark(B, ax + o - 0.06, z0 + cw + 1, ax + o + 0.06, z1 - cw - 1, y, yel);
  if (K.avW >= 20) {
    for (const s of [-1, 1]) {
      for (let z = z0 + cw + 2; z < z1 - cw - 4; z += 9) mark(B, ax + s * 4.25 - 0.07, z, ax + s * 4.25 + 0.07, z + 3, y, wht);
    }
  }
  // 斑馬線與停止線
  for (const [zc, dir] of [[z0, 1], [z1, -1]]) {
    for (let x = ax - K.avW / 2 + 0.7; x < ax + K.avW / 2 - 0.5; x += 1.15) mark(B, x, Math.min(zc + dir * 0.5, zc + dir * (cw + 0.5)), x + 0.6, Math.max(zc + dir * 0.5, zc + dir * (cw + 0.5)), y, wht);
    const zs = zc + dir * (cw + 1.3);
    const half = dir > 0 ? [ax, ax + K.avW / 2 - 0.3] : [ax - K.avW / 2 + 0.3, ax];
    mark(B, half[0], Math.min(zs, zs + dir * 0.45), half[1], Math.max(zs, zs + dir * 0.45), y, wht);
  }
}

function streetMarks(B, W, x0, x1, sz, sw, t, i) {
  const y = (x, z) => t(x, z) + 0.02;
  const wht = 0xf4f4f2;
  const cw = 3.2;
  for (let x = x0 + cw + 2; x < x1 - cw - 3; x += 7) mark(B, x, sz - 0.07, x + 3, sz + 0.07, y, W.kind === 'metro' ? wht : 0xf2c230);
  if (!W.avenueExists(i) && !W.avenueExists(i + 1)) return;
  for (const [xc, dir] of [[x0, 1], [x1, -1]]) {
    for (let z = sz - sw / 2 + 0.7; z < sz + sw / 2 - 0.5; z += 1.15) mark(B, Math.min(xc + dir * 0.5, xc + dir * (cw + 0.5)), z, Math.max(xc + dir * 0.5, xc + dir * (cw + 0.5)), z + 0.6, y, wht);
  }
}

function mark(B, x0, z0, x1, z1, y, color) {
  B.quad(x0, y(x0, z1), z1, x1, y(x1, z1), z1, x1, y(x1, z0), z0, x0, y(x0, z0), z0, color);
}

function bridge(Gd, Pr, W, ax, sz, lod) {
  const K = W.K;
  const hw = K.avW / 2;
  const qz = K.canalW / 2;
  const n = 10;
  const deck = (z) => W.groundAt(ax, z);
  for (let k = 0; k < n; k++) {
    const za = sz - qz + (2 * qz * k) / n;
    const zb = sz - qz + (2 * qz * (k + 1)) / n;
    const ya = deck(za);
    const yb = deck(zb);
    const uv = [(ax - hw) / 3, -zb / 3, (ax + hw) / 3, -zb / 3, (ax + hw) / 3, -za / 3, (ax - hw) / 3, -za / 3];
    Gd.quad(ax - hw, yb, zb, ax + hw, yb, zb, ax + hw, ya, za, ax - hw, ya, za, 0xb3aaa0, uv, R('cobble'));
    // 側牆：從拱下緣到欄杆頂
    const archA = W.waterY + 0.6 + 1.6 * Math.cos(((za - sz) / qz) * Math.PI * 0.5);
    const archB = W.waterY + 0.6 + 1.6 * Math.cos(((zb - sz) / qz) * Math.PI * 0.5);
    for (const s of [-1, 1]) {
      const x = ax + s * hw;
      if (s < 0) Gd.quad(x, archA, za, x, archB, zb, x, yb + 0.9, zb, x, ya + 0.9, za, 0x8c6a5a, [za / 2, 0, zb / 2, 0, zb / 2, 1, za / 2, 1], R('quayBrick'));
      else Gd.quad(x, archB, zb, x, archA, za, x, ya + 0.9, za, x, yb + 0.9, zb, 0x8c6a5a, [zb / 2, 0, za / 2, 0, za / 2, 1, zb / 2, 1], R('quayBrick'));
      const xi = x - s * 0.4;
      if (s > 0) {
        Gd.quad(xi, yb + 0.9, zb, x, yb + 0.9, zb, x, ya + 0.9, za, xi, ya + 0.9, za, 0xd7d0c4);
        Gd.quad(xi, ya, za, xi, yb, zb, xi, yb + 0.9, zb, xi, ya + 0.9, za, 0x8c6a5a);
      } else {
        Gd.quad(x, yb + 0.9, zb, xi, yb + 0.9, zb, xi, ya + 0.9, za, x, ya + 0.9, za, 0xd7d0c4);
        Gd.quad(xi, yb, zb, xi, ya, za, xi, ya + 0.9, za, xi, yb + 0.9, zb, 0x8c6a5a);
      }
    }
    // 拱腹
    Gd.quad(ax - hw, archA, za, ax + hw, archA, za, ax + hw, archB, zb, ax - hw, archB, zb, 0x4a3a32);
  }
  if (lod === 0) {
    for (const s of [-1, 1]) for (const z of [sz - qz - 1, sz + qz + 1]) {
      Pr.geom(P.cyl(8), mat(ax + s * (hw + 0.4), deck(z) + 1.5, z, 0.08, 3, 0.08), 0x24332c);
      Pr.geom(P.sphere(8, 6), mat(ax + s * (hw + 0.4), deck(z) + 3.1, z, 0.22, 0.28, 0.22), 0xfff0c8);
    }
  }
}

function skatepark(Gd, Pr, W, b) {
  const g = (x, z) => W.groundAt(x, z);
  heightfield(Gd, b.x0, b.z0, b.x1, b.z1, 0.5, g, (x, z, y) => (y < 0.5 ? 0xa4a8ad : 0xb8bbbf), 'concrete', 4);
  const coping = 0x22a39a;
  for (const bw of SKATE.bowls) {
    const pts = [];
    const N = 96;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      let x;
      let z;
      if (bw.kind === 'circle') {
        x = bw.cx + Math.cos(a) * bw.r;
        z = bw.cz + Math.sin(a) * bw.r;
      } else {
        // 圓角矩形外緣：從中心射線找 sd = 0
        let lo = 0;
        let hi = 30;
        for (let it = 0; it < 22; it++) {
          const m = (lo + hi) / 2;
          if (bowlSD(bw, bw.cx + Math.cos(a) * m, bw.cz + Math.sin(a) * m) < 0) lo = m;
          else hi = m;
        }
        x = bw.cx + Math.cos(a) * lo;
        z = bw.cz + Math.sin(a) * lo;
      }
      pts.push(new THREE.Vector3(x, W.terrain(x, z) + CURB + 0.05, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    Pr.geom(new THREE.TubeGeometry(curve, 160, 0.11, 6, true), new THREE.Matrix4(), coping);
    // 碗池外圍的彩色牆帶
    Gd.geom(new THREE.TubeGeometry(curve, 160, 0.06, 4, true), mat(0, -0.12, 0, 1, 1, 1), 0x1f8e86);
  }
  const q = SKATE.quarter;
  const qy = W.terrain(q.x1, q.z0) + CURB + q.h;
  Pr.geom(P.cyl(8), mat(q.x1, qy + 0.05, (q.z0 + q.z1) / 2, 0.1, q.z1 - q.z0, 0.1, Math.PI / 2, 0, 0), coping);
  // 四分之一管背後的牆
  Gd.quad(q.deck, W.terrain(q.deck, q.z1) + CURB, q.z1, q.deck, W.terrain(q.deck, q.z0) + CURB, q.z0, q.deck, qy, q.z0, q.deck, qy, q.z1, 0xc9ccd0, [0, 0, 6, 0, 6, 0.6, 0, 0.6], R('concrete'));
  for (const z of [q.z0, q.z1]) {
    const s = z === q.z0 ? -1 : 1;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const x = q.x0 + ((q.deck - q.x0) * k) / 12;
      pts.push([x, g(x, z - s * 0.01)]);
    }
    for (let k = 0; k < 12; k++) {
      const [xa, ya] = pts[k];
      const [xb, yb] = pts[k + 1];
      const yb0 = W.terrain(xa, z) + CURB;
      if (s < 0) Gd.quad(xb, yb0, z, xa, yb0, z, xa, ya, z, xb, yb, z, 0xc2c5c9);
      else Gd.quad(xa, yb0, z, xb, yb0, z, xb, yb, z, xa, ya, z, 0xc2c5c9);
    }
  }
  const f = SKATE.funbox;
  const fy = W.terrain(f.cx, f.cz) + CURB;
  Pr.box(f.cx - f.hx, fy + f.h - 0.02, f.cz - f.hz - 0.06, f.cx + f.hx, fy + f.h + 0.04, f.cz - f.hz + 0.04, 0x8b9096);
  for (const s of [-1, 1]) Gd.quad(f.cx - f.hx - f.slope, fy, f.cz + s * f.hz, f.cx + f.hx + f.slope, fy, f.cz + s * f.hz, f.cx + f.hx, fy + f.h, f.cz + s * f.hz, f.cx - f.hx, fy + f.h, f.cz + s * f.hz, 0xbfc3c7);
  const l = SKATE.ledge;
  Pr.box(l.x0, fy, l.z0, l.x1, fy + l.h + 0.02, l.z1, 0xb0b4b9);
  Pr.box(l.x0, fy + l.h, l.z0 - 0.03, l.x1, fy + l.h + 0.05, l.z1 + 0.03, 0x6b7076);
  for (const r of SKATE.rails) {
    const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
    const yaw = Math.atan2(r.x1 - r.x0, r.z1 - r.z0);
    Pr.geom(P.cyl(8), mat((r.x0 + r.x1) / 2, fy + r.h, (r.z0 + r.z1) / 2, 0.045, len, 0.045, Math.PI / 2, yaw, 0), 0xe0b02a);
    for (const tt of [0.05, 0.5, 0.95]) Pr.geom(P.cyl(6), mat(r.x0 + (r.x1 - r.x0) * tt, fy + r.h / 2, r.z0 + (r.z1 - r.z0) * tt, 0.035, r.h, 0.035), 0x3a3f45);
  }
  // 圍欄
  for (const [xa, za, xb, zb] of [[b.x0, b.z0, b.x1, b.z0], [b.x0, b.z1, b.x1, b.z1], [b.x1, b.z0, b.x1, b.z1]]) {
    const len = Math.hypot(xb - xa, zb - za);
    for (let k = 0; k <= len / 3; k++) {
      const x = xa + ((xb - xa) * k * 3) / len;
      const z = za + ((zb - za) * k * 3) / len;
      Pr.geom(P.cyl(5), mat(x, W.terrain(x, z) + 0.9, z, 0.04, 1.8, 0.04), 0x8b9096);
    }
  }
}

function liftTower(B, tw, t) {
  const y = t(tw.x, tw.z);
  const c = 0x6b7178;
  B.geom(new THREE.CylinderGeometry(0.35, 0.6, 1, 8), mat(tw.x, y + 6, tw.z, 1, 12, 1), c);
  B.geom(P.box(), mat(tw.x, y + 12.2, tw.z, 7.2, 0.4, 0.6), c);
  for (const s of [-1, 1]) {
    B.geom(P.cyl(10), mat(tw.x + s * LIFT.gauge, y + 12.0, tw.z, 0.35, 0.2, 0.35, 0, 0, Math.PI / 2), 0x2a2d31);
    B.geom(P.box(), mat(tw.x + s * LIFT.gauge, y + 11.9, tw.z, 0.3, 0.3, 1.8), 0x50565d);
  }
}

function liftStations(B, W, top = false) {
  const z = top ? LIFT.zTop : LIFT.zBase;
  const x = LIFT.x;
  const y = W.terrain(x, z);
  B.box(x - 6, y - 1, z - 5, x + 6, y + 0.6, z + 5, 0x8b9096);
  B.box(x - 5.5, y + 8.8, z - 5, x + 5.5, y + 9.4, z + 5, 0x2c5b7a);
  for (const [dx, dz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) B.geom(P.cyl(8), mat(x + dx, y + 4.6, z + dz, 0.25, 8.4, 0.25), 0x50565d);
  B.geom(P.cyl(20), mat(x, y + 8.4, z + (top ? -2.5 : 2.5), LIFT.gauge + 0.2, 0.4, LIFT.gauge + 0.2), 0x3a3f45);
  B.box(x - 8, y, z + (top ? -10 : 5), x - 6.2, y + 2.2, z + (top ? -5 : 10), 0xe9e2d0);
}

function ship(B, s) {
  const c = Math.cos(s.rot);
  const sn = Math.sin(s.rot);
  const put = (lx, ly, lz, w, h, d, color) => B.geom(P.box(), mat(s.x + lx * c + lz * sn, ly + h / 2, s.z - lx * sn + lz * c, w, h, d, 0, s.rot, 0), color);
  put(0, -6, 0, 30, 12, 190, 0x1f3a5a);
  put(0, -6, 0, 30.4, 4, 190.5, 0x8c2a22);
  put(0, 6, 78, 26, 14, 18, 0xf1f1ee);
  put(0, 20, 78, 30, 2, 10, 0xf1f1ee);
  const cols = [0xc0392b, 0x2e86c1, 0x27ae60, 0xd68910, 0x8e44ad, 0x7f8c8d, 0xe5e7e9];
  let k = 0;
  for (let z = -80; z < 64; z += 12.5) {
    for (let x = -12; x <= 12; x += 2.6) {
      const h = 2 + ((k * 7) % 4);
      for (let y = 0; y < h; y++) put(x, 6 + y * 2.6, z, 2.5, 2.55, 12.2, cols[(k + y * 3) % cols.length]);
      k++;
    }
  }
}

function lifeguard(B, lg, g) {
  const y = g(lg.x, lg.z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.geom(P.cyl(6), mat(lg.x + dx * 1.1, y + 1.4, lg.z + dz * 1.1, 0.1, 2.8, 0.1), 0xd9d4c8);
  B.box(lg.x - 1.6, y + 2.8, lg.z - 1.6, lg.x + 1.6, y + 3.0, lg.z + 1.6, 0xe9e2d0);
  B.box(lg.x - 1.3, y + 3.0, lg.z - 1.3, lg.x + 1.3, y + 5.0, lg.z + 1.3, lg.color);
  B.box(lg.x - 1.5, y + 5.0, lg.z - 1.5, lg.x + 1.5, y + 5.25, lg.z + 1.5, 0xf4f1ea);
  B.quad(lg.x + 1.6, y + 3.0, lg.z - 0.6, lg.x + 1.6, y + 3.0, lg.z + 0.6, lg.x + 4.5, y, lg.z + 0.6, lg.x + 4.5, y, lg.z - 0.6, 0xd9d4c8);
}

export { shade, STYLE, face, ground, heightfield, strip, tree, palm, pine, lamp, bench, parkedCar, boat, bike, appendXform, skatepark, roofProp };
