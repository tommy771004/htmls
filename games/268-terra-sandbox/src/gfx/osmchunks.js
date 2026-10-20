// 真實地圖圖磚的網格：地面高度場（依土地用途上頂點色、運河挖空）、道路與人行道帶狀面、路口圓盤、標線與斑馬線、
// 橋與運河岸壁、建物（接近矩形的沿用程序外觀再轉到局部座標系，其餘多邊形擠出）、號誌與街道家具。
// 輸出格式與 chunks.js 的 buildChunk 相同。
import * as THREE from 'three';
import { Builder, P, mat } from './geo.js';
import { getAtlas } from './atlas.js';
import { STYLE, appendXform, bench, boat, buildBuilding, lamp, parkedCar, palm, shade, skatepark, tree } from './chunks.js';
import { RC, ROAD_Y, inPoly, inRing, localView } from '../core/osm.js';
import { hash2, mulberry32 } from '../core/math.js';

const R = (n) => getAtlas().rect(n);
const Y_WALK = 0.04;
const Y_PATH = 0.055;
const Y_MARK = 0.02; // 標線比路面高

// 法線朝上的四邊形（依 x 東、z 南自動調整繞向）
function upQuad(B, a, b, c, d, col, uv, rect) {
  const ux = b[0] - a[0];
  const uz = b[2] - a[2];
  const vx = d[0] - a[0];
  const vz = d[2] - a[2];
  if (uz * vx - ux * vz >= 0) B.quad(...a, ...b, ...c, ...d, col, uv, rect);
  else B.quad(...a, ...d, ...c, ...b, col, uv ? [uv[0], uv[1], uv[6], uv[7], uv[4], uv[5], uv[2], uv[3]] : null, rect);
}
// 直立面：(ax,az)→(bx,bz)，朝 (nx,nz)
function vQuad(B, ax, az, bx, bz, y0a, y0b, y1a, y1b, nx, nz, col, uv, rect) {
  const ex = bx - ax;
  const ez = bz - az;
  // quad 法線 = (b-a)×(d-a)，d 在 a 的正上方：結果 = (-ez, 0, ex)·(y1-y0)
  if (-ez * nx + ex * nz >= 0) B.quad(ax, y0a, az, bx, y0b, bz, bx, y1b, bz, ax, y1a, az, col, uv, rect);
  else B.quad(bx, y0b, bz, ax, y0a, az, ax, y1a, az, bx, y1b, bz, col, uv ? [uv[2], uv[3], uv[0], uv[1], uv[6], uv[7], uv[4], uv[5]] : null, rect);
}
function upTri(B, a, b, c, col, uv, rect) {
  const ux = b[0] - a[0];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vz = c[2] - a[2];
  if (uz * vx - ux * vz >= 0) B.tri(...a, ...b, ...c, col, uv, rect);
  else B.tri(...a, ...c, ...b, col, uv ? [uv[0], uv[1], uv[4], uv[5], uv[2], uv[3]] : null, rect);
}
const wuv = (pts, s) => pts.flatMap((p) => [p[0] / s, -p[2] / s]);

// 沿線段的帶狀面，每 seg 公尺細分以貼合地形
function ribbon(B, x0, z0, x1, z1, hw, hfn, col, tile, scale, seg = 5, t0 = 0, t1 = 1) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  if (L < 0.01) return;
  const dx = (x1 - x0) / L;
  const dz = (z1 - z0) / L;
  const rx = -dz * hw;
  const rz = dx * hw;
  const n = Math.max(1, Math.ceil(((t1 - t0) * L) / seg));
  const m = Math.max(1, Math.ceil((hw * 2) / Math.max(4, seg))); // 寬的路橫向也切，坡地上才不會被地形穿出
  const r = tile ? R(tile) : null;
  for (let k = 0; k < n; k++) {
    const ta = t0 + ((t1 - t0) * k) / n;
    const tb = t0 + ((t1 - t0) * (k + 1)) / n;
    const ax = x0 + (x1 - x0) * ta;
    const az = z0 + (z1 - z0) * ta;
    const bx = x0 + (x1 - x0) * tb;
    const bz = z0 + (z1 - z0) * tb;
    for (let q = 0; q < m; q++) {
      const u0 = 1 - (2 * q) / m;
      const u1 = 1 - (2 * (q + 1)) / m;
      const p = [
        [ax + rx * u0, hfn(ax + rx * u0, az + rz * u0), az + rz * u0],
        [bx + rx * u0, hfn(bx + rx * u0, bz + rz * u0), bz + rz * u0],
        [bx + rx * u1, hfn(bx + rx * u1, bz + rz * u1), bz + rz * u1],
        [ax + rx * u1, hfn(ax + rx * u1, az + rz * u1), az + rz * u1],
      ];
      upQuad(B, ...p, col, wuv(p, scale), r);
    }
  }
}
// 路口圓盤：兩圈頂點都貼地形（hfn 給高度）
function disc(B, x, z, rad, hfn, col, tile, scale) {
  const n = 12;
  const r = tile ? R(tile) : null;
  const ring = (f) => Array.from({ length: n + 1 }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    const px = x + Math.cos(a) * rad * f;
    const pz = z + Math.sin(a) * rad * f;
    return [px, hfn(px, pz), pz];
  });
  const c = [x, hfn(x, z), z];
  const r1 = ring(0.5);
  const r2 = ring(1);
  for (let k = 0; k < n; k++) {
    const p = [c, r1[k], r1[k + 1]];
    upTri(B, ...p, col, wuv(p, scale), r);
    const q = [r1[k], r2[k], r2[k + 1], r1[k + 1]];
    upQuad(B, ...q, col, wuv(q, scale), r);
  }
}

// 道路外觀：依類別與地區
function roadLook(W, cls) {
  const canal = W.kind === 'canal';
  if (cls <= 4) return { col: 0xffffff, tile: 'asphalt', s: 7 };
  if (cls <= 7) return canal ? { col: 0xb59484, tile: 'pavers', s: 2.4 } : { col: 0xffffff, tile: 'asphalt', s: 7 };
  if (cls === 8) return { col: 0xd8cfc0, tile: 'pavers', s: 2 };
  if (cls === 10) return { col: canal ? 0xc77a6a : 0xb9a29a, tile: 'asphalt', s: 7 };
  return canal || W.kind === 'metro' ? { col: 0xd3cbbd, tile: 'pavers', s: 2 } : { col: 0xd2ccc0, tile: 'concrete', s: 4 };
}
function walkLook(W) {
  if (W.kind === 'canal') return { col: 0xc9bfb3, tile: 'pavers', s: 2.2 };
  if (W.kind === 'beach') return { col: 0xd9d4c8, tile: 'concrete', s: 4 };
  return { col: 0xdcdcdc, tile: 'sidewalk', s: 3 };
}
const walkW = (W, r) => RC[r.cls].walk * (W.kind === 'metro' ? 1.45 : W.kind === 'canal' ? 0.8 : 1);

// 土地顏色
const GCOL = { park: 0x7fae58, garden: 0x86b35e, pitch: 0x6fa34e, playground: 0xc9b48f, cemetery: 0x8aa868, forest: 0x557f3a, sand: 0xeedfb8, parking: 0x9c9c9a, pier: 0x9c8466, pool: 0x58a8c8 };
const BASE = { metro: 0xcac5bd, canal: 0xbbb2a6, hills: 0xc9c3b6, town: 0x86ad5a, beach: 0xe2d7bf };

function groundMesh(Gd, W, c, step) {
  const nx = Math.max(1, Math.round((c.x1 - c.x0) / step));
  const nz = Math.max(1, Math.round((c.z1 - c.z0) / step));
  const sx = (c.x1 - c.x0) / nx;
  const sz = (c.z1 - c.z0) / nz;
  const canal = W.osm.flat && W.waterY > -900 && c.osm.water.length > 0;
  const base = BASE[W.kind] ?? 0xc9c3b6;
  const sea = W.osm.sea;
  const sink = W.osm.flat || !W.osm.dem ? 0 : step >= 10 ? 0.9 : 0.3;
  const H = [];
  for (let a = 0; a <= nx; a++) {
    H[a] = [];
    for (let b = 0; b <= nz; b++) H[a][b] = W.terrain(c.x0 + a * sx, c.z0 + b * sz);
  }
  const col = new THREE.Color();
  const r = R(W.kind === 'town' ? 'grass' : W.kind === 'beach' ? 'sand' : 'concrete');
  const vi = B_start(Gd);
  for (let b = 0; b <= nz; b++) {
    for (let a = 0; a <= nx; a++) {
      const x = c.x0 + a * sx;
      const z = c.z0 + b * sz;
      const y = H[a][b];
      const hl = H[Math.max(0, a - 1)][b];
      const hr = H[Math.min(nx, a + 1)][b];
      const hd = H[a][Math.max(0, b - 1)];
      const hu = H[a][Math.min(nz, b + 1)];
      const ddx = sx * ((a > 0 ? 1 : 0) + (a < nx ? 1 : 0));
      const ddz = sz * ((b > 0 ? 1 : 0) + (b < nz ? 1 : 0));
      const nX = -(hr - hl) / ddx;
      const nZ = -(hu - hd) / ddz;
      const l = Math.hypot(nX, 1, nZ);
      let cc = base;
      const g = W.greenAt(x, z);
      if (g) cc = GCOL[g.cls] ?? cc;
      else if (sea && y < 2.2) cc = y < 0.4 ? 0xcbb98f : 0xe6d6ae;
      else if (W.kind === 'hills' && 1 / l < 0.9) cc = 0x8fae6a;
      // 坡地：路面與人行道底下的地面壓低，避免兩種內插不同的網格互相穿出
      const under = sink && W.roadAt(x, z, 1.5, (rr) => !rr.bridge);
      Gd.pos.push(x, under ? y - sink : y, z);
      Gd.nor.push(nX / l, 1 / l, nZ / l);
      col.set(cc);
      Gd.col.push(col.r, col.g, col.b);
      Gd.uv.push(x / 6, -z / 6);
      Gd.atl.push(r[0], r[1], r[2], r[3]);
    }
  }
  const row = nx + 1;
  for (let b = 0; b < nz; b++) {
    for (let a = 0; a < nx; a++) {
      const cx = c.x0 + (a + 0.5) * sx;
      const cz = c.z0 + (b + 0.5) * sz;
      if (W.skateRect && W.inSkate(cx, cz)) continue;
      if (canal && W.inWater(cx, cz)) continue;
      const i0 = vi + b * row + a;
      const i1 = i0 + 1;
      const i2 = i0 + row;
      const i3 = i2 + 1;
      Gd.idx.push(i0, i2, i1, i1, i2, i3);
    }
  }
  Gd.n += (nx + 1) * (nz + 1);
  if (canal) {
    const y = W.waterY - 2.6;
    upQuad(Gd, [c.x0, y, c.z0], [c.x1, y, c.z0], [c.x1, y, c.z1], [c.x0, y, c.z1], 0x2b3a33);
  }
}
const B_start = (B) => B.n;

// ── 建物 ──
const _m = new THREE.Matrix4();
function rectBuilding(Bd, W, b, lod, win) {
  const T = new Builder();
  buildBuilding(T, localView(b), lod, W, win);
  const f = b.frame;
  _m.makeRotationY(-f.ang).setPosition(f.cx, 0, f.cz);
  appendXform(Bd, T, _m);
}
function polyBuilding(B, b, lod, win) {
  const st = STYLE[b.style] || STYLE.stone;
  const rnd = mulberry32(b.seed);
  const winTile = st.win[Math.floor(rnd() * st.win.length)];
  const r = b.poly;
  const n = r.length / 2;
  const y0 = b.base + (b.minH > 2 ? b.minH : 0);
  const yU = b.minH > 2 ? y0 : b.floor0 + b.groundH;
  const top = b.base + b.height;
  const col = b.color;
  // 窗燈：每條邊的窗欄位置（多邊形以外接矩形生成室內格局）
  const edges = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = r[i * 2];
    const az = r[i * 2 + 1];
    const bx = r[j * 2];
    const bz = r[j * 2 + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.2) continue;
    let nx = (bz - az) / L;
    let nz = -(bx - ax) / L;
    if (inRing(r, (ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05)) {
      nx = -nx;
      nz = -nz;
    }
    const bays = Math.max(1, Math.round(L / st.bay));
    const shopFace = b.shop && L > 4;
    const gB = shopFace ? Math.max(1, Math.round(L / 4.2)) : bays;
    edges.push({ i, ax, az, bx, bz, L, nx, nz, bays, gB, shopFace, u0: (b.seed % 7) + i * 0.37 });
  }
  const off = new Map();
  let wl = null;
  if (win) {
    const cols = [];
    for (const e of edges) {
      off.set(e.i, cols.length);
      const fu = Math.floor(e.u0);
      const m = Math.max(e.bays, e.gB) + 1;
      for (let c = 0; c < m; c++) {
        const u = fu + c + 0.5 - e.u0;
        const tU = Math.min(1, Math.max(0, u / e.bays));
        const tG = Math.min(1, Math.max(0, u / e.gB));
        cols.push({ u: [e.ax + (e.bx - e.ax) * tU, e.az + (e.bz - e.az) * tU], g: [e.ax + (e.bx - e.ax) * tG, e.az + (e.bz - e.az) * tG], n: [e.nx, e.nz] });
      }
    }
    wl = cols.length ? win.add(b, cols, cols.length) : null;
    if (wl) wl.stride = cols.length;
  }
  const wv = (e, floorOff) => (wl ? [wl.base + 1, wl.stride, off.get(e.i) - Math.floor(e.u0), floorOff + wl.rows * 4] : null);
  for (const e of edges) {
    const { ax, az, bx, bz, L, nx, nz, bays, shopFace, u0 } = e;
    if (b.minH <= 2) {
      if (b.floor0 - b.base > 0.05) vQuad(B, ax, az, bx, bz, b.base, b.base, b.floor0, b.floor0, nx, nz, shade(col, 0.7), [0, 0, L / 3, 0, L / 3, (b.floor0 - b.base) / 3, 0, (b.floor0 - b.base) / 3], R('stonePlain'));
      B.win(wv(e, 0), () => vQuad(B, ax, az, bx, bz, b.floor0, b.floor0, yU, yU, nx, nz, shopFace ? parseInt(b.shop.sign.slice(1), 16) : col, [u0, 0, u0 + e.gB, 0, u0 + e.gB, 1, u0, 1], R(shopFace ? 'shopA' : st.ground)));
    }
    if (top > yU + 0.01) B.win(wv(e, 1), () => vQuad(B, ax, az, bx, bz, yU, yU, top, top, nx, nz, col, [u0, 0, u0 + bays, 0, u0 + bays, (top - yU) / b.floorH, u0, (top - yU) / b.floorH], R(winTile)));
  }
  // 屋頂
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(r[i * 2], r[i * 2 + 1]));
  let tris = [];
  try {
    tris = THREE.ShapeUtils.triangulateShape(pts, []);
  } catch {
    tris = [];
  }
  const rr = R('roofGravel');
  for (const [a, bb, c] of tris) {
    const p = [[pts[a].x, top, pts[a].y], [pts[bb].x, top, pts[bb].y], [pts[c].x, top, pts[c].y]];
    upTri(B, ...p, 0x9a9ea3, wuv(p, 4), rr);
  }
  if (b.minH > 2) {
    for (const [a, bb, c] of tris) {
      const p = [[pts[a].x, y0, pts[a].y], [pts[c].x, y0, pts[c].y], [pts[bb].x, y0, pts[bb].y]];
      // 底面朝下
      const ux = p[1][0] - p[0][0];
      const uz = p[1][2] - p[0][2];
      const vx = p[2][0] - p[0][0];
      const vz = p[2][2] - p[0][2];
      if (uz * vx - ux * vz >= 0) B.tri(...p[0], ...p[2], ...p[1], shade(col, 0.6));
      else B.tri(...p[0], ...p[1], ...p[2], shade(col, 0.6));
    }
  }
}

// ── 號誌（OSM）：桿子在路邊、橫臂伸到車道上方、燈面朝來車 ──
function osmLight(B, t, gfn, lens) {
  const y = gfn(t.x, t.z);
  const c = 0x2d3135;
  B.geom(P.cyl(8), mat(t.x, y + 2.9, t.z, 0.1, 5.8, 0.1), c);
  const L = t.reach;
  const [ax, az] = t.arm;
  B.geom(P.box(), mat(t.x + (ax * L) / 2, y + 5.7, t.z + (az * L) / 2, 0.1, 0.1, L, 0, Math.atan2(ax, az), 0), c);
  const hx = t.x + ax * L;
  const hz = t.z + az * L;
  B.geom(P.box(), mat(hx, y + 5.0, hz, 0.38, 1.1, 0.38), 0x2a2d30);
  lens.push({ x: hx + t.face[0] * 0.2, y: y + 5.0, z: hz + t.face[1] * 0.2, axis: t.axis, fx: t.face[0], fz: t.face[1] });
  B.geom(P.box(), mat(t.x, y + 1.2, t.z, 0.25, 0.35, 0.25), 0x3a3f45);
}

export function buildOsmChunk(W, c, lod, win = null) {
  const Gd = new Builder();
  const Bd = new Builder();
  const Pr = new Builder();
  const Gl = new Builder();
  const pools = [];
  const lens = [];
  const D = W.osm;
  const N = D.N;
  const t = (x, z) => W.terrain(x, z);
  const g = (x, z) => W.groundAt(x, z);
  const rnd = mulberry32(hash2(c.i, c.j, 991) * 4294967296);
  const hasWater = c.osm.water.length > 0 && W.osm.flat && W.waterY > -900;
  const step = lod === 0 ? (hasWater ? 2 : W.kind === 'hills' ? 3 : 4) : lod === 1 ? 10 : 25;
  groundMesh(Gd, W, c, step);

  // 道路：人行道在下、車道在上
  const deckY = 0.45;
  const roadH = (r, dy) => (r.bridge ? (x, z) => deckY + dy - ROAD_Y : (x, z) => t(x, z) + dy);
  const wl = walkLook(W);
  const hilly = !W.osm.flat && !!W.osm.dem;
  const seg = lod === 0 ? (hilly ? 3 : 5) : 20;
  const RY = hilly ? 0.1 : ROAD_Y; // 坡地上車道再高一點，和人行道拉開距離
  for (const p of c.osm.pieces) {
    const r = p.r;
    const look = roadLook(W, r.cls);
    const ww = walkW(W, r);
    if (ww > 0 && !r.bridge) ribbon(Gd, p.x0, p.z0, p.x1, p.z1, r.w / 2 + ww, roadH(r, Y_WALK), wl.col, wl.tile, wl.s, seg);
    ribbon(Gd, p.x0, p.z0, p.x1, p.z1, r.w / 2, roadH(r, r.cls >= 8 ? Y_PATH : RY), look.col, look.tile, look.s, seg);
    if (r.bridge && lod <= 1) {
      // 橋面側牆與欄杆
      const L = Math.hypot(p.x1 - p.x0, p.z1 - p.z0) || 1;
      const dx = (p.x1 - p.x0) / L;
      const dz = (p.z1 - p.z0) / L;
      for (const s of [-1, 1]) {
        const ox = -dz * (r.w / 2) * s;
        const oz = dx * (r.w / 2) * s;
        vQuad(Gd, p.x0 + ox, p.z0 + oz, p.x1 + ox, p.z1 + oz, deckY - 1.1, deckY - 1.1, deckY + 0.85, deckY + 0.85, -dz * s, dx * s, 0x8c6a5a, [0, 0, L / 2.4, 0, L / 2.4, 1, 0, 1], R('quayBrick'));
        vQuad(Gd, p.x0 + ox * 0.94, p.z0 + oz * 0.94, p.x1 + ox * 0.94, p.z1 + oz * 0.94, deckY, deckY, deckY + 0.85, deckY + 0.85, dz * s, -dx * s, 0x8c6a5a);
        upQuad(Gd, [p.x0 + ox, deckY + 0.85, p.z0 + oz], [p.x1 + ox, deckY + 0.85, p.z1 + oz], [p.x1 + ox * 0.94, deckY + 0.85, p.z1 + oz * 0.94], [p.x0 + ox * 0.94, deckY + 0.85, p.z0 + oz * 0.94], 0xd7d0c4);
      }
      upQuad(Gd, [p.x0 - dz * r.w / 2, deckY - 1.1, p.z0 + dx * r.w / 2], [p.x1 - dz * r.w / 2, deckY - 1.1, p.z1 + dx * r.w / 2], [p.x1 + dz * r.w / 2, deckY - 1.1, p.z1 - dx * r.w / 2], [p.x0 + dz * r.w / 2, deckY - 1.1, p.z0 - dx * r.w / 2], 0x4a3a32);
    }
  }
  // 路口與轉折的圓盤，補齊帶狀面之間的縫
  for (const n of c.osm.nodes) {
    const x = N[n * 2];
    const z = N[n * 2 + 1];
    let hwR = 0;
    let hwW = 0;
    let hwP = 0;
    let cls = 99;
    let bridge = false;
    for (const [r] of D.nodeRoads.get(n) || []) {
      bridge = bridge || r.bridge;
      if (r.cls >= 8) hwP = Math.max(hwP, r.w / 2);
      else {
        hwR = Math.max(hwR, r.w / 2);
        cls = Math.min(cls, r.cls);
        hwW = Math.max(hwW, r.w / 2 + walkW(W, r));
      }
    }
    const hf = (dy) => (bridge ? () => deckY - ROAD_Y + dy : (px, pz) => t(px, pz) + dy);
    if (hwW > hwR && !bridge) disc(Gd, x, z, hwW, hf(Y_WALK), wl.col, wl.tile, wl.s);
    if (hwR > 0) {
      const lk = roadLook(W, cls);
      disc(Gd, x, z, hwR, hf(RY), lk.col, lk.tile, lk.s);
    } else if (hwP > 0) {
      const lk = roadLook(W, 9);
      disc(Gd, x, z, hwP, hf(Y_PATH), lk.col, lk.tile, lk.s);
    }
  }
  // 標線與斑馬線
  if (lod <= 1 && W.kind !== 'canal') {
    const junR = (n) => {
      let m = 0;
      for (const [r] of D.nodeRoads.get(n) || []) if (RC[r.cls].drive) m = Math.max(m, r.w / 2);
      return m;
    };
    const yel = 0xf2c230;
    const wht = 0xf2f2ee;
    for (const p of c.osm.pieces) {
      const r = p.r;
      if (!RC[r.cls].drive || r.cls > 5 || r.w < 7 || r.bridge) continue;
      const L = Math.hypot(p.x1 - p.x0, p.z1 - p.z0);
      if (L < 1) continue;
      let t0 = 0;
      let t1 = 1;
      if (p.first >= 0 && D.drv[p.first] >= 3) t0 = Math.min(1, (junR(p.first) + 3) / L);
      if (p.last >= 0 && D.drv[p.last] >= 3) t1 = Math.max(0, 1 - (junR(p.last) + 3) / L);
      if (t1 - t0 < 0.05) continue;
      const dx = (p.x1 - p.x0) / L;
      const dz = (p.z1 - p.z0) / L;
      const hf = (x, z) => t(x, z) + RY + Y_MARK;
      const line = (off, w, color, dash) => {
        const ox = -dz * off;
        const oz = dx * off;
        if (!dash) {
          ribbon(Gd, p.x0 + ox, p.z0 + oz, p.x1 + ox, p.z1 + oz, w / 2, hf, color, null, 1, seg, t0, t1);
          return;
        }
        for (let s = t0 * L; s < t1 * L - 1; s += 7) {
          const e = Math.min(t1 * L, s + 3);
          ribbon(Gd, p.x0 + ox, p.z0 + oz, p.x1 + ox, p.z1 + oz, w / 2, hf, color, null, 1, 20, s / L, e / L);
        }
      };
      const lanes = r.lanes || Math.max(1, Math.round(r.w / 3.4));
      if (!r.oneway) {
        if (W.kind === 'metro' || r.cls <= 3) {
          line(-0.13, 0.11, yel, false);
          line(0.13, 0.11, yel, false);
        } else line(0, 0.12, yel, true);
        const per = lanes >= 4 ? lanes / 2 : 1;
        for (let k = 1; k < per; k++) {
          const off = (r.w / 2 / per) * k;
          line(off, 0.12, wht, true);
          line(-off, 0.12, wht, true);
        }
      } else if (lanes >= 2) {
        for (let k = 1; k < lanes; k++) line(-r.w / 2 + (r.w / lanes) * k, 0.12, wht, true);
      }
    }
    if (lod === 0 && W.kind !== 'town') {
      for (const n of c.osm.nodes) {
        if (D.drv[n] < 3) continue;
        const x = N[n * 2];
        const z = N[n * 2 + 1];
        const jr = junR(n);
        for (const [r, at] of D.nodeRoads.get(n) || []) {
          if (!RC[r.cls].drive || r.cls > 5 || r.bridge) continue;
          for (const dir of [-1, 1]) {
            const o = at + dir;
            if (o < 0 || o >= r.idx.length) continue;
            const m = r.idx[o];
            const L = Math.hypot(N[m * 2] - x, N[m * 2 + 1] - z);
            if (L < jr + 6) continue;
            const ux = (N[m * 2] - x) / L;
            const uz = (N[m * 2 + 1] - z) / L;
            const s = jr + 1.6;
            const hf = (xx, zz) => t(xx, zz) + RY + Y_MARK;
            for (let q = -r.w / 2 + 0.5; q < r.w / 2 - 0.3; q += 1.1) {
              const cx = x + ux * s - uz * q;
              const cz = z + uz * s + ux * q;
              ribbon(Gd, cx, cz, cx + ux * 3, cz + uz * 3, 0.25, hf, 0xf4f4f0, null, 1, 3);
            }
          }
        }
      }
    }
  }
  // 運河岸壁：水域邊（中點在本圖磚）往水側 1 公尺的直立牆＋壓頂石
  if (hasWater && lod <= 1) {
    const wallBot = W.waterY - 2.8;
    for (const w of c.osm.water) {
      for (const r of w.rings) {
        const n = r.length / 2;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ax = r[i * 2];
          const az = r[i * 2 + 1];
          const bx = r[j * 2];
          const bz = r[j * 2 + 1];
          const mx = (ax + bx) / 2;
          const mz = (az + bz) / 2;
          if (mx < c.x0 || mx >= c.x1 || mz < c.z0 || mz >= c.z1) continue;
          const L = Math.hypot(bx - ax, bz - az);
          if (L < 0.3) continue;
          let nx = -(bz - az) / L;
          let nz = (bx - ax) / L;
          if (!W.inWater(mx + nx * 0.8, mz + nz * 0.8)) {
            nx = -nx;
            nz = -nz;
          }
          if (W.inWater(mx - nx * 0.8, mz - nz * 0.8)) continue; // 兩側都是水（相鄰水域的接縫）
          const ox = nx * 1.0;
          const oz = nz * 1.0;
          const yTop = 0.09;
          vQuad(Gd, ax + ox, az + oz, bx + ox, bz + oz, wallBot, wallBot, yTop, yTop, nx, nz, 0x8c6a5a, [0, 0, L / 2.4, 0, L / 2.4, 1.2, 0, 1.2], R('quayBrick'));
          upQuad(Gd, [ax - nx * 0.3, yTop, az - nz * 0.3], [bx - nx * 0.3, yTop, bz - nz * 0.3], [bx + ox, yTop, bz + oz], [ax + ox, yTop, az + oz], 0xb3aaa0, null, R('cobble'));
        }
      }
    }
  }
  if (W.skateRect && c.i === 0 && c.j === 0) skatepark(Gd, Pr, W, W.blockRect(0, 0));

  // 建物
  for (const b of c.layers.building) {
    if (b.frame) rectBuilding(Bd, W, b, lod, win);
    else polyBuilding(Bd, b, lod, win);
  }

  // 街道家具
  const P2 = c.props;
  if (lod <= 1) {
    for (const tr of P2.trees) tree(Pr, tr, g, rnd);
    for (const p of P2.palms) palm(Pr, p, g, rnd);
    for (const bt of P2.boats) {
      const T = new Builder();
      boat(T, { ...bt, x: 0, z: 0 }, W.waterY);
      _m.makeRotationY(-bt.ang).setPosition(bt.x, 0, bt.z);
      appendXform(Pr, T, _m);
    }
    for (const pc of P2.parked) parkedCar(Pr, pc, g);
  } else {
    for (const tr of P2.trees) Pr.geom(P.ico(0), mat(tr.x, g(tr.x, tr.z) + tr.h * 0.7, tr.z, tr.h * 0.35, tr.h * 0.35, tr.h * 0.35), 0x5d8f3f);
    for (const p of P2.palms) Pr.geom(P.ico(0), mat(p.x, g(p.x, p.z) + p.h, p.z, 2.2, 0.8, 2.2), 0x4f8f3a);
  }
  if (lod === 0) {
    for (const l of P2.lamps) pools.push(lamp(Pr, Gl, l, g));
    for (const tl of P2.tlights) osmLight(Pr, tl, g, lens);
    for (const h of P2.hydrants) {
      const y = g(h.x, h.z);
      Pr.geom(P.cyl(8), mat(h.x, y + 0.35, h.z, 0.13, 0.7, 0.13), W.kind === 'metro' ? 0xb3261e : 0xd9a520);
      Pr.geom(P.sphere(8, 5), mat(h.x, y + 0.72, h.z, 0.14, 0.12, 0.14), W.kind === 'metro' ? 0xb3261e : 0xd9a520);
    }
    for (const k of P2.benches) bench(Pr, k, g);
  } else if (lod === 1) {
    for (const l of P2.lamps) {
      const y = g(l.x, l.z);
      Pr.geom(P.cyl(5), mat(l.x, y + 3.5, l.z, 0.1, 7, 0.1), 0x5b6168);
      Gl.geom(P.box(), mat(l.x, y + 7.1, l.z, 0.4, 0.15, 0.4), 0xffe2b0);
    }
  }
  return { ground: Gd, build: Bd, props: Pr, glow: Gl, pools, lens };
}

export { inPoly };
