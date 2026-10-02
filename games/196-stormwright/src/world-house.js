// 房屋建造器：由可破壞板塊（牆／窗台／窗頭／門楣／樓板／樓梯／屋頂）加上靜態裝飾組成。
// 局部座標：原點在地基中心；+X 右、+Z 後、-Z 為正面（門）。房屋 yaw 一律是 π/2 的倍數。
import * as THREE from 'three';
import { KIND } from './world-panels.js';

export const PAINTS = ['#7fe0c0', '#ff8e7a', '#fff0a8', '#8cc8f5', '#c9a8ff', '#ffc59b', '#c8e86a', '#ff9ec7'];
export const ROOFS = ['#e45c5c', '#4f7ee8', '#f2a83c', '#8a5ad8', '#2fb8a0', '#d9476f', '#5aa83a'];
const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const TRIM = '#fff7e6', STONE = '#b9b3a8', WOOD = '#c58f55', DARK = '#3b2f2a';

function triPrism(wBase, h, t) {
  const a = -wBase / 2, b = wBase / 2, z0 = -t / 2, z1 = t / 2, P = [];
  const tri = (p, q, r) => P.push(...p, ...q, ...r);
  tri([a, 0, z1], [b, 0, z1], [0, h, z1]); tri([b, 0, z0], [a, 0, z0], [0, h, z0]);
  tri([a, 0, z0], [a, 0, z1], [0, h, z1]); tri([a, 0, z0], [0, h, z1], [0, h, z0]);
  tri([b, 0, z1], [b, 0, z0], [0, h, z0]); tri([b, 0, z1], [0, h, z0], [0, h, z1]);
  tri([a, 0, z0], [b, 0, z0], [b, 0, z1]); tri([a, 0, z0], [b, 0, z1], [a, 0, z1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
let _prism = null;

export function buildHouse(W, cl, o) {
  const ctx = W.ctx, T = ctx.terrain, rng = W.rng, P = cl.panels, D = cl.deco, G = cl.glow;
  const { x, z } = o, yaw = o.yaw || 0, w = o.w, d = o.d;
  const F = d >= 8 && w >= 6 ? (o.floors ?? 2) : 1, TW = 0.3, H = 3.5, HW = 3.25;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const L2W = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const mat = o.mat || 'wood', wallKind = o.wallKind ?? (mat === 'stone' ? KIND.brick : mat === 'metal' ? KIND.metal : KIND.plank);
  const roofKind = o.roofKind ?? (mat === 'metal' ? KIND.metal : KIND.shingle);
  const wallCol = o.wall || PAINTS[rng.int(PAINTS.length)], roofCol = o.roof || ROOFS[rng.int(ROOFS.length)], trim = o.trim || TRIM;
  const poi = W.poiAt(x, z);
  // 地基高度：四角與中心取最高
  let by = -99, lo = 99;
  for (const [a, b] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0], [0, -d / 2 - 1.5]]) { const [px, pz] = L2W(a, b), h = T.heightAt(px, pz); by = Math.max(by, h); lo = Math.min(lo, h); }
  if (o.by != null) by = o.by;
  const y0 = by + 0.2;
  const dec = (lx, ly, lz, hx, hy, hz, col, ry = 0, tilt = 0) => { const [px, pz] = L2W(lx, lz); D.add(px, y0 + ly, pz, hx, hy, hz, col, yaw + ry, tilt); };
  const solid = (lx, ly, lz, hx, hy, hz, owner = null, kind = 'prop') => { const [px, pz] = L2W(lx, lz); ctx.physics.addBox({ cx: px, cy: y0 + ly, cz: pz, hx, hy, hz, yaw, owner, kind }); };
  const panel = (pk, kind, lx, ly, lz, sx, sy, sz, color, extra = {}) => {
    const [px, pz] = L2W(lx, lz);
    return P.add({ pk, kind, mat, cx: px, cy: y0 + ly, cz: pz, sx, sy, sz, yaw, color, ...extra });
  };
  // 地基（碰撞）與可見石基 + 室內地板
  const fb = Math.min(lo, by) - 0.7, ft = y0;
  { const [px, pz] = L2W(0, 0); ctx.physics.addBox({ cx: px, cy: (fb + ft) / 2, cz: pz, hx: w / 2 + 0.25, hy: (ft - fb) / 2, hz: d / 2 + 0.25, yaw, kind: 'prop' });
    D.add(px, (fb + ft) / 2 - 0.01, pz, w / 2 + 0.25, (ft - fb) / 2 - 0.01, d / 2 + 0.25, o.base || STONE, yaw);
    D.add(px, ft - 0.02, pz, w / 2 - 0.1, 0.035, d / 2 - 0.1, o.floor || WOOD, yaw); }
  const occ = [[], []]; // 各樓層已佔用的矩形 [x0,x1,z0,z1]（局部座標）
  const inRect = (r, x0, x1, z0, z1, m = 0) => !(x1 + m < r[0] || x0 - m > r[1] || z1 + m < r[2] || z0 - m > r[3]);
  // ---- 樓梯與樓板開口 ----
  const lx0 = -w / 2 + TW, zs = d / 2 - TW - 6, holeZ0 = zs + 1.5, SW = 1.6;
  if (F >= 2) {
    occ[0].push([lx0 - 0.1, lx0 + SW + 0.4, zs - 0.9, d / 2]);
    occ[1].push([lx0 - 0.1, lx0 + SW + 0.2, holeZ0 - 0.6, d / 2]);
    for (let n = 0; n < 12; n++) {
      const top = 0.2917 * (n + 1), z0 = zs + n * 0.5 + 0.25;
      panel('stair', KIND.floor, lx0 + SW / 2, top / 2, z0, SW, top, 0.5, '#d9a766', { hpMul: 0.8, debrisColor: '#d9a766' });
    }
    dec(lx0 + 0.04, 1.0, d / 2 - TW - 0.01, 0.05, 0.9, 0.04, trim); // 扶手端柱
  }
  // ---- 各層牆 ----
  const defs = [
    { side: 'front', along: 'x', fix: -d / 2 + TW / 2, c0: -w / 2, len: w },
    { side: 'back', along: 'x', fix: d / 2 - TW / 2, c0: -w / 2, len: w },
    { side: 'left', along: 'z', fix: -w / 2 + TW / 2, c0: -d / 2 + TW, len: d - 2 * TW },
    { side: 'right', along: 'z', fix: w / 2 - TW / 2, c0: -d / 2 + TW, len: d - 2 * TW },
  ];
  const doorCol = (n) => Math.floor((n - 1) / 2);
  const pat = o.pattern || ((side, c, n, L) => {
    if (side === 'front') { if (L === 0 && c === doorCol(n)) return 'door'; return (L === 0 ? c !== 0 || n < 3 : c % 2 === 1 || n <= 2) ? 'window' : 'solid'; }
    if (side === 'back') { if (L === 0 && o.backDoor && c === Math.floor(n / 2)) return 'door'; return (c + L) % 2 === 0 ? 'window' : 'solid'; }
    return (c + L) % 2 === 1 || n === 2 ? 'window' : 'solid';
  });
  const doorSpots = [];
  for (let L = 0; L < F; L++) {
    const yb = H * L;
    for (const df of defs) {
      const n = Math.max(1, Math.round(df.len / 2)), cw = df.len / n;
      for (let c = 0; c < n; c++) {
        const along = df.c0 + (c + 0.5) * cw, t = pat(df.side, c, n, L);
        const put = (ly0, ly1, a0 = -cw / 2, a1 = cw / 2) => {
          const aw = a1 - a0, ac = along + (a0 + a1) / 2, h = ly1 - ly0, cy = yb + (ly0 + ly1) / 2;
          if (h <= 0.01 || aw <= 0.01) return null;
          return df.along === 'x' ? panel('wall', wallKind, ac, cy, df.fix, aw, h, TW, wallCol) : panel('wall', wallKind, df.fix, cy, ac, TW, h, aw, wallCol);
        };
        if (t === 'solid') put(0, HW);
        else if (t === 'window') {
          put(0, 0.95); put(2.25, HW); put(0.95, 2.25, -cw / 2, -cw / 2 + 0.3); put(0.95, 2.25, cw / 2 - 0.3, cw / 2);
          // 窗外裝飾：窗框、百葉、花箱
          const out = df.side === 'front' ? -1 : df.side === 'back' ? 1 : df.side === 'left' ? -1 : 1, ofs = TW / 2 + 0.04;
          const wx = (a, ly, hw, hh, hd, col) => df.along === 'x' ? dec(a, yb + ly, df.fix + out * ofs, hw, hh, hd, col) : dec(df.fix + out * ofs, yb + ly, a, hd, hh, hw, col);
          wx(along, 0.98, cw / 2 - 0.08, 0.04, 0.07, trim); wx(along, 2.27, cw / 2 - 0.08, 0.04, 0.07, trim);
          wx(along - cw / 2 + 0.3, 1.6, 0.03, 0.67, 0.06, trim); wx(along + cw / 2 - 0.3, 1.6, 0.03, 0.67, 0.06, trim);
          wx(along, 1.6, 0.025, 0.65, 0.05, trim); wx(along, 1.6, cw / 2 - 0.35, 0.025, 0.05, trim);
          wx(along - cw / 2 + 0.05, 1.6, 0.17, 0.62, 0.035, o.shutter || roofCol); wx(along + cw / 2 - 0.05, 1.6, 0.17, 0.62, 0.035, o.shutter || roofCol);
          if (L === 0 && o.flowers !== false && rng() < 0.55) { wx(along, 0.78, cw / 2 - 0.3, 0.1, 0.13, '#8a5a33'); for (let k = -2; k <= 2; k++) wx(along + k * 0.22, 0.95, 0.09, 0.09, 0.09, ['#ff6fa5', '#ffe14d', '#ff9a3d', '#ffffff'][(k + 2 + rng.int(2)) % 4]); }
        } else if (t === 'door') {
          put(2.3, HW);
          const fixOut = df.side === 'front' ? -1 : 1, ofs = TW / 2 + 0.05;
          doorSpots.push({ side: df.side, a: along });
          if (df.along === 'x') {
            dec(along - cw / 2 + 0.07, yb + 1.15, df.fix + fixOut * ofs, 0.07, 1.17, 0.07, trim); dec(along + cw / 2 - 0.07, yb + 1.15, df.fix + fixOut * ofs, 0.07, 1.17, 0.07, trim);
            dec(along, yb + 2.35, df.fix + fixOut * ofs, cw / 2, 0.06, 0.07, trim);
            // 開著的門板（向外約 70°）
            { const hx = along - cw / 2 + 0.1; dec(hx + 0.17, yb + 1.1, df.fix + fixOut * (ofs + 0.47), 0.5, 1.1, 0.035, o.door || '#a86a3a', -fixOut * 1.22); }
            // 門燈（發光）
            { const [gx, gz] = L2W(along + cw / 2 + 0.28, df.fix + fixOut * (ofs + 0.1)); G.add(gx, y0 + yb + 2.0, gz, 0.09, 0.13, 0.09, hot('#ffd27a', 2.4)); }
          }
        }
      }
    }
    // 樓板（2F 地板）
    if (L === 0 && F >= 2) {
      const slabCol = new THREE.Color('#c9915a').lerp(new THREE.Color(wallCol), 0.55);
      const tile = (xa, xb, za, zb) => {
        if (xb - xa < 0.05 || zb - za < 0.05) return;
        const nx = Math.ceil((xb - xa) / 2.7), nz = Math.ceil((zb - za) / 2.7), sw = (xb - xa) / nx, sd = (zb - za) / nz;
        for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) panel('floor', KIND.floor, xa + (i + 0.5) * sw, H - 0.125, za + (k + 0.5) * sd, sw, 0.25, sd, slabCol, { debrisColor: '#c9915a' });
      };
      tile(-w / 2, w / 2, -d / 2, holeZ0);
      tile(lx0 + SW, w / 2, holeZ0, d / 2);
      tile(-w / 2, lx0, holeZ0, d / 2 - TW);
      tile(-w / 2, lx0 + SW, d / 2 - TW, d / 2);
    }
  }
  // ---- 屋頂 ----
  const Wt = H * (F - 1) + HW, th = o.pitch ?? 0.7, rise = th * d / 2, half = d / 2 + 0.55, slope = Math.sqrt(half * half + (th * half) ** 2), ang = Math.atan(th);
  const planeY = (az) => Wt + 0.0 + th * (d / 2 - az); // 屋頂面高度（az = |z|）
  const nSeg = Math.max(1, Math.ceil((w + 1) / 4.6)), segW = (w + 1.0) / nSeg;
  for (const sd of [-1, 1]) {
    for (let s = 0; s < nSeg; s++) {
      const lx = -w / 2 - 0.5 + (s + 0.5) * segW, zc = sd * half / 2, yc = planeY(half / 2) - 0.11 / Math.cos(ang);
      const cols = [], nB = Math.ceil(half / 0.6), dz = half / nB;
      for (let j = 0; j < nB; j++) { // 階梯 collider（以低邊為頂）
        const za = j * dz, zb = za + dz, top = planeY(zb) + 0.02, [px, pz] = L2W(lx, sd * (za + zb) / 2);
        cols.push({ cx: px, cy: y0 + top - 0.3, cz: pz, hx: segW / 2, hy: 0.3, hz: dz / 2 + 0.02, yaw });
      }
      const [px, pz] = L2W(lx, zc);
      P.add({ pk: 'roof', kind: roofKind, mat, cx: px, cy: y0 + yc, cz: pz, sx: segW, sy: 0.22, sz: slope + 0.12, yaw, tilt: sd * ang, color: roofCol, cols, debrisColor: roofCol });
    }
  }
  // 山牆（靜態）：三角形 + 階梯碰撞
  _prism ||= triPrism(1, 1, 1);
  for (const sx of [-1, 1]) {
    const [px, pz] = L2W(sx * (w / 2 - TW / 2), 0), M = new THREE.Matrix4().compose(new THREE.Vector3(px, y0 + Wt - 0.02, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + Math.PI / 2, 0)), new THREE.Vector3(d, rise + 0.04, TW));
    D.addGeo(_prism, M, wallCol);
    for (let k = 0; k < 3; k++) solid(sx * (w / 2 - TW / 2), Wt + (k + 0.5) * rise / 3, 0, TW / 2, rise / 6, (d / 2) * (1 - (k + 1) / 3) + 0.1);
    dec(sx * (w / 2 - TW / 2 + sx * 0.04), Wt + rise * 0.38, 0, 0.04, 0.34, 0.34, trim); dec(sx * (w / 2 - TW / 2 + sx * 0.06), Wt + rise * 0.38, 0, 0.03, 0.26, 0.26, '#3c5f8a');
    // 山牆邊飾
    for (const zz of [-1, 1]) dec(sx * (w / 2 + 0.52), planeY(half / 2) + 0.1, zz * half / 2, 0.06, 0.1, slope / 2, trim, 0, zz * ang);
  }
  // 屋脊、簷板
  dec(0, Wt + rise + 0.12, 0, w / 2 + 0.55, 0.12, 0.2, new THREE.Color(roofCol).multiplyScalar(0.75));
  for (const sd of [-1, 1]) dec(0, planeY(half) - 0.02, sd * half, w / 2 + 0.52, 0.09, 0.05, trim);
  // 轉角柱
  for (const sx of [-1, 1]) for (const sd of [-1, 1]) dec(sx * (w / 2 - 0.04), (H * F - 0.25) / 2 + 0.1, sd * (d / 2 - 0.04), 0.2, (H * F - 0.25) / 2 + 0.1, 0.2, trim);
  // 煙囪
  if (o.chimney ?? rng() < 0.6) {
    const cx = w / 2 - 1.3, cz = d / 4, top = planeY(Math.abs(cz)) + 1.6;
    dec(cx, top / 2 + 0.5, cz, 0.45, top / 2 + 0.5, 0.45, '#b4573f'); dec(cx, top + 1.05, cz, 0.55, 0.08, 0.55, '#7a3b2e'); solid(cx, top / 2 + 0.5, cz, 0.45, top / 2 + 0.5, 0.45);
  }
  // 門廊雨棚
  if (o.porch ?? rng() < 0.7) {
    const dc = doorSpots.find((s) => s.side === 'front');
    if (dc) { dec(dc.a, 2.65, -d / 2 - 0.9, 1.35, 0.08, 0.95, roofCol); dec(dc.a - 1.15, 1.3, -d / 2 - 1.7, 0.08, 1.3, 0.08, trim); dec(dc.a + 1.15, 1.3, -d / 2 - 1.7, 0.08, 1.3, 0.08, trim); solid(dc.a - 1.15, 1.3, -d / 2 - 1.7, 0.1, 1.3, 0.1); solid(dc.a + 1.15, 1.3, -d / 2 - 1.7, 0.1, 1.3, 0.1);
    }
  }
  // 門前台階：從門檻往下每階 0.38 m，直到踏面離該處地面 ≤ 0.45 m（地基比地面高時才需要）
  for (const ds of doorSpots) {
    const sgn = ds.side === 'front' ? -1 : 1;
    for (let i = 1; i < 12; i++) {
      const top = y0 - i * 0.38, lz = sgn * (d / 2 + 0.25 + 0.25 + (i - 1) * 0.5), [qx, qz] = L2W(ds.a, lz), hq = T.heightAt(qx, qz);
      if (i === 1 && y0 - hq <= 0.45) break; // 地基邊緣本身就跨得上去
      const base = Math.min(hq, top) - 0.5;
      dec(ds.a, (top + base) / 2 - y0, lz, 1.3, (top - base) / 2, 0.25, STONE); solid(ds.a, (top + base) / 2 - y0, lz, 1.3, (top - base) / 2, 0.25);
      if (top - hq <= 0.45) break;
    }
  }
  // ---- 室內：燈、地毯、家具、戰利品 ----
  const furniture = (L) => {
    const yb = H * L, items = [
      { w: 2.0, d: 1.0, h: 0.5, c: '#e98a9b', top: '#fff', name: 'bed' }, { w: 1.2, d: 0.9, h: 0.75, c: '#b07a45', name: 'table' },
      { w: 1.4, d: 0.45, h: 1.8, c: '#9a6a3a', name: 'shelf' }, { w: 1.8, d: 0.9, h: 0.55, c: '#4f9ad8', name: 'sofa' }, { w: 1.2, d: 0.6, h: 0.9, c: '#dcdcdc', name: 'counter' },
    ];
    const room = { x0: -w / 2 + TW + 0.1, x1: w / 2 - TW - 0.1, z0: -d / 2 + TW + 0.1, z1: d / 2 - TW - 0.1 };
    for (let k = 0, placed = 0; k < 12 && placed < (o.furn ?? 3); k++) {
      const it = items[rng.int(items.length)], side = rng.int(4), vert = side >= 2;
      const fw = vert ? it.d : it.w, fd = vert ? it.w : it.d;
      let cx, cz;
      if (side === 0) { cx = rng.range(room.x0 + fw / 2, room.x1 - fw / 2); cz = room.z1 - fd / 2; } // 後牆
      else if (side === 1) { cx = rng.range(room.x0 + fw / 2, room.x1 - fw / 2); cz = room.z0 + fd / 2; } // 前牆
      else if (side === 2) { cx = room.x0 + fw / 2; cz = rng.range(room.z0 + fd / 2, room.z1 - fd / 2); }
      else { cx = room.x1 - fw / 2; cz = rng.range(room.z0 + fd / 2, room.z1 - fd / 2); }
      const x0 = cx - fw / 2, x1 = cx + fw / 2, z0 = cz - fd / 2, z1 = cz + fd / 2;
      if (occ[L].some((r) => inRect(r, x0, x1, z0, z1, 0.55))) continue;
      if (L === 0 && side === 1 && doorSpots.some((s) => s.side === 'front' && Math.abs(s.a - cx) < 2.2 + fw / 2)) continue;
      if (L === 0 && side === 0 && doorSpots.some((s) => s.side === 'back' && Math.abs(s.a - cx) < 2.2 + fw / 2)) continue;
      occ[L].push([x0, x1, z0, z1]); placed++;
      dec(cx, yb + it.h / 2, cz, fw / 2, it.h / 2, fd / 2, it.c);
      if (it.top) dec(cx, yb + it.h + 0.06, cz - (vert ? 0 : 0), (vert ? fw : fw * 0.9) / 2, 0.07, (vert ? fd * 0.9 : fd) / 2, it.top);
      if (it.name === 'shelf') for (let b = 0; b < 4; b++) dec(cx, yb + 0.4 + b * 0.4, cz + (vert ? 0 : 0.0), (vert ? 0.05 : fw / 2 - 0.05), 0.12, (vert ? fd / 2 - 0.05 : 0.05), ['#e45c5c', '#4f7ee8', '#f2a83c', '#4fb06a'][(b + placed) % 4]);
      solid(cx, yb + it.h / 2, cz, fw / 2, it.h / 2, fd / 2);
    }
    // 地毯 + 吊燈
    if (rng() < 0.7) dec(rng.range(-0.8, 0.8), yb + 0.015, rng.range(-1, 0.4), rng.range(1.0, 1.5), 0.015, rng.range(0.8, 1.2), ['#e45c5c', '#4f7ee8', '#f2a83c', '#8a5ad8'][rng.int(4)], rng.int(2) * Math.PI / 2);
    const [lx2, lz2] = L2W(0.3, 0.3); G.add(lx2, y0 + yb + HW - 0.45, lz2, 0.16, 0.12, 0.16, hot('#ffd98a', 2.2)); D.add(lx2, y0 + yb + HW - 0.22, lz2, 0.02, 0.2, 0.02, '#333');
  };
  for (let L = 0; L < F; L++) furniture(L);
  // 戰利品／寶箱點位（只放在未被佔用的位置）
  const freeSpot = (L) => {
    for (let k = 0; k < 30; k++) {
      const lx = rng.range(-w / 2 + 0.9, w / 2 - 0.9), lz = rng.range(-d / 2 + 0.9, d / 2 - 0.9);
      if (occ[L].some((r) => inRect(r, lx - 0.3, lx + 0.3, lz - 0.3, lz + 0.3, 0.1))) continue;
      if (L === 0 && F >= 2 && lx < lx0 + SW + 0.3 && lz > zs - 0.8) continue;
      if (L === 1 && lx < lx0 + SW + 0.3 && lz > holeZ0 - 0.7) continue;
      if (L === 0 && Math.abs(lz + d / 2) < 1.4 && doorSpots.some((s) => s.side === 'front' && Math.abs(s.a - lx) < 1.5)) continue;
      return [lx, lz];
    }
    return null;
  };
  const nLoot = o.loot ?? (F >= 2 ? 3 : 2);
  for (let i = 0; i < nLoot; i++) {
    const L = F >= 2 ? (i === 0 ? 0 : i === 1 ? 1 : (rng() < 0.5 ? 0 : 1)) : 0, s = freeSpot(L); if (!s) continue;
    const [px, pz] = L2W(s[0], s[1]); W.lootSpots.push({ x: px, y: y0 + H * L + 0.05, z: pz, inside: true, poi });
  }
  if (rng() < (o.chest ?? 0.45)) {
    const L = F >= 2 && rng() < 0.55 ? 1 : 0, s = freeSpot(L);
    if (s) { const [px, pz] = L2W(s[0], s[1]); W.chestSpots.push({ x: px, y: y0 + H * L + 0.02, z: pz, yaw: yaw + Math.atan2(s[0], s[1]), poi, inside: true }); occ[L].push([s[0] - 0.7, s[0] + 0.7, s[1] - 0.7, s[1] + 0.7]); }
  }
  // 屋頂也放少量戰利品（可走上去的斜坡屋頂邊）省略；室外前院由 town 層處理
  const info = { x, z, y: y0, yaw, w: w / 2, d: d / 2, W: w, D: d, floors: F, poi, radius: Math.hypot(w, d) / 2 + 1.5, doors: doorSpots, L2W, stairs: F >= 2 ? { lx: lx0 + SW / 2, zs } : null };
  W.houses.push(info);
  return info;
}
