// 飯店場景：由 sim/map.js 的同一份資料建出牆、地板、天花板、門窗、家具與燈具，烘焙光照後回傳。
import * as THREE from 'three';
import { Builder, Lights, ambientPatch, lampPatch, BAKE_U } from './builder.js';
import { makeTextures, textTexture } from './textures.js';
import { ITEM, fixture, chandelier, C, mul, WOOD_D, WOOD_M, BRASS, STEEL, RED, GREEN, CREAM, BLACK } from './props.js';
import { T as WT, H, HL } from '../sim/map.js';

const STYLE = {
  lobby:    { low: 'panel', lowH: 1.1, up: 'paperC' },
  corridor: { low: 'panel', lowH: 1.0, up: 'paperB' },
  room:     { low: null, lowH: 0, up: 'paperA' },
  office:   { low: null, lowH: 0, up: 'paperC' },
  bar:      { low: 'panel', lowH: 1.3, up: 'paperB' },
  dining:   { low: 'panel', lowH: 1.0, up: 'paperC' },
};
const CHUNK = { lobby: 'c', office: 'c', elev: 'c', ncor: 'n', n1: 'nw', n2: 'nw', n3: 'nw', n4: 'ne', n5: 'ne', n6: 'ne', bar: 'bar', dining: 'din' };
const chunkOf = z => z ? (CHUNK[z.id] || (z.id[0] === 'W' ? 'w' : 'e')) : 'c';
function hash(n) { const s = Math.sin(n * 91.7 + 13.3) * 43758.5453; return s - Math.floor(s); }

export function makeMaterials(Tx) {
  const std = (t, o = {}) => ambientPatch(new THREE.MeshStandardMaterial({ map: t.map || null, normalMap: t.normalMap || null, roughnessMap: t.roughnessMap || null, roughness: t.roughnessMap ? 1 : (t.rough ?? 0.8), metalness: 0, vertexColors: true, envMapIntensity: 0.7, ...o }), 'vertex');
  const M = {
    marble: std(Tx.marble, { envMapIntensity: 1.0 }), carpet: std(Tx.carpet), runner: std(Tx.runner), wood: std(Tx.wood), paperA: std(Tx.paperA), paperB: std(Tx.paperB), paperC: std(Tx.paperC),
    plaster: std(Tx.plaster), panel: std(Tx.panel), woodF: std(Tx.woodF), fabric: std(Tx.fabric), door: std(Tx.door),
    leather: std({ normalMap: Tx.fabric.normalMap, rough: 0.5 }, { normalScale: new THREE.Vector2(0.3, 0.3) }),
    paint: std({ rough: 0.62 }), lacquer: std({ rough: 0.12 }, { envMapIntensity: 1.2 }),
    metal: std({ rough: 0.36 }, { metalness: 1, envMapIntensity: 1.5 }), mirror: std({ rough: 0.06 }, { metalness: 1, envMapIntensity: 2.2 }),
    glassy: std({ rough: 0.08 }, { envMapIntensity: 1.6 }),
    rug: std(Tx.rug, { alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    art: std(Tx.art), debris: std(Tx.debris, { alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    shade: lampPatch(new THREE.MeshBasicMaterial({ map: Tx.fabric.map, vertexColors: true, side: THREE.DoubleSide })),
    glow: lampPatch(new THREE.MeshBasicMaterial({ vertexColors: true })),
  };
  for (const k of ['rug', 'debris']) { M[k].userData.noShadow = true; }
  for (const k of ['shade', 'glow']) { M[k].userData.noShadow = true; M[k].userData.unlit = true; }
  M.glass = new THREE.MeshStandardMaterial({ map: Tx.glass.map, transparent: true, roughness: 0.08, metalness: 0, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide });
  return M;
}

export async function buildHotel(map, world, onProgress) {
  const Tx = makeTextures(), M = makeMaterials(Tx), B = new Builder(), I4 = new THREE.Matrix4();
  const extras = new THREE.Group(); extras.name = 'extras';
  const zoneAt = map.zoneAt;
  const inWall = (x, z) => map.pieces.some(p => p.y0 < 1 && p.y1 > 1 && (p.axis === 'x' ? (x > p.a && x < p.b && Math.abs(z - p.c) < WT / 2) : (z > p.a && z < p.b && Math.abs(x - p.c) < WT / 2)));
  const tallAt = (x, z) => map.boxes.some(b => b.kind !== 'wall' && b.kind !== 'glass' && b.y1 > 1.25 && x > b.x0 - 0.45 && x < b.x1 + 0.45 && z > b.z0 - 0.45 && z < b.z1 + 0.45);

  // ---------- 地板與天花板 ----------
  for (const z of map.zones) {
    const ch = chunkOf(z), w = z.x1 - z.x0, d = z.z1 - z.z0;
    const fm = z.floor === 'parquet' ? 'wood' : z.floor, s = Tx[fm].scale;
    if (z.floor === 'parquet') B.quad('wood', ch, z.x0, 0, z.z0, w, 0, 0, 0, 0, d, 0, 1, 0, z.z0 / s, z.x0 / s, 0, 0, 0.5, [1.35, 1.2, 0.95]), fixUV(B, 'wood', ch, w, d, s, z);
    else B.quad(fm, ch, z.x0, 0, z.z0, w, 0, 0, 0, 0, d, 0, 1, 0, z.x0 / s, z.z0 / s, w / s, d / s, 0.5);
    const ps = Tx.plaster.scale;
    B.quad('plaster', ch, z.x0, z.h, z.z0, w, 0, 0, 0, 0, d, 0, -1, 0, z.x0 / ps, z.z0 / ps, w / ps, d / ps, 0.7);
  }
  // 大廳天花板的格樑
  { const L = B.local('c', I4); for (let z = -3.5; z <= 12; z += 3.1) L.box('plaster', 0, HL - 0.2, z, 15.7, 0.4, 0.34, { uvs: 2.4, col: [0.9, 0.86, 0.78] }); for (const x of [-4.6, 4.6]) L.box('plaster', x, HL - 0.16, 4, 0.34, 0.32, 17.7, { uvs: 2.4, col: [0.9, 0.86, 0.78] }); }

  // ---------- 牆面 ----------
  const paintSpots = [];
  for (const p of map.pieces) {
    const hz = p.axis === 'x', n = Math.max(1, Math.ceil((p.b - p.a) / 0.5));
    for (const side of [-1, 1]) {
      let run = null;
      const flush = () => { if (run) wallRun(p, side, run); run = null; };
      for (let i = 0; i < n; i++) {
        const s0 = p.a + (p.b - p.a) * i / n, s1 = p.a + (p.b - p.a) * (i + 1) / n, mid = (s0 + s1) / 2;
        const z = hz ? zoneAt(mid, p.c + side * 0.3) : zoneAt(p.c + side * 0.3, mid);
        if (run && run.zone === z) run.s1 = s1; else { flush(); if (z) run = { zone: z, s0, s1 }; }
        if (!z) flush();
      }
      flush();
    }
    // 端面（門框內側）、門楣底、窗台面
    const full = p.y0 === 0 && p.y1 >= H - 1e-3;
    if (full) for (const e of [-1, 1]) {
      const s = e < 0 ? p.a : p.b, px = hz ? s + e * 0.15 : p.c, pz = hz ? p.c : s + e * 0.15, z = zoneAt(px, pz);
      if (!z || inWall(px, pz)) continue;
      const y1 = Math.min(p.y1, z.h), ch = chunkOf(z);
      if (hz) B.quad('woodF', ch, s, 0, p.c - WT / 2, 0, 0, WT, 0, y1, 0, e, 0, 0, 0, 0, WT / 0.9, y1 / 0.9, 0.5, WOOD_D);
      else B.quad('woodF', ch, p.c - WT / 2, 0, s, WT, 0, 0, 0, y1, 0, 0, 0, e, 0, 0, WT / 0.9, y1 / 0.9, 0.5, WOOD_D);
    }
    if (p.y0 > 0 || p.y1 < H - 1e-3) {
      const y = p.y0 > 0 ? p.y0 : p.y1, ny = p.y0 > 0 ? -1 : 1, len = p.b - p.a, mid = (p.a + p.b) / 2, z = hz ? (zoneAt(mid, p.c + 0.3) || zoneAt(mid, p.c - 0.3)) : (zoneAt(p.c + 0.3, mid) || zoneAt(p.c - 0.3, mid)), ch = chunkOf(z);
      if (hz) B.quad('woodF', ch, p.a, y, p.c - WT / 2, len, 0, 0, 0, 0, WT, 0, ny, 0, 0, 0, len / 0.9, WT / 0.9, 0.5, WOOD_D);
      else B.quad('woodF', ch, p.c - WT / 2, y, p.a, WT, 0, 0, 0, 0, len, 0, ny, 0, 0, 0, WT / 0.9, len / 0.9, 0.5, WOOD_D);
    }
  }
  function wallRun(p, side, run) {
    const z = run.zone, st = STYLE[z.style], ch = chunkOf(z), hz = p.axis === 'x', y0 = p.y0, y1 = Math.min(p.y1, z.h); if (y1 <= y0 + 1e-4) return;
    const len = run.s1 - run.s0, f = p.c + side * WT / 2, L = B.local(ch, I4);
    const bands = []; if (st.low) bands.push([0, st.lowH, st.low]); bands.push([st.lowH, Math.min(z.h, H), st.up]); if (z.h > H) bands.push([H, z.h, 'plaster']);
    for (const [b0, b1, mat] of bands) {
      const a = Math.max(y0, b0), b = Math.min(y1, b1); if (b <= a + 1e-4) continue;
      const sc = Tx[mat].scale, pan = mat === 'panel';
      const u0 = run.s0 / (pan ? 0.9 : sc), ul = len / (pan ? 0.9 : sc), v0 = pan ? a / st.lowH : a / sc, vl = pan ? (b - a) / st.lowH : (b - a) / sc;
      if (hz) B.quad(mat, ch, run.s0, a, f, len, 0, 0, 0, b - a, 0, 0, 0, side, u0, v0, ul, vl, 0.5);
      else B.quad(mat, ch, f, a, run.s0, 0, 0, len, 0, b - a, 0, side, 0, 0, u0, v0, ul, vl, 0.5);
    }
    const mid = (run.s0 + run.s1) / 2;
    const strip = (y, h, t, mat, col) => { if (hz) L.box(mat, mid, y, f + side * t / 2, len, h, t, { col, skip: side > 0 ? 'z' : 'Z' }); else L.box(mat, f + side * t / 2, y, mid, t, h, len, { col, skip: side > 0 ? 'x' : 'X' }); };
    if (y0 === 0) strip(0.07, 0.14, 0.025, 'woodF', WOOD_D);
    if (st.low && y0 <= st.lowH && y1 >= st.lowH) strip(st.lowH, 0.06, 0.04, 'woodF', WOOD_D);
    if (y1 >= Math.min(z.h, H) - 1e-3 && y0 < H) strip(Math.min(z.h, H) - 0.06, 0.12, 0.06, z.h > H ? 'woodF' : 'plaster', z.h > H ? WOOD_D : [0.92, 0.88, 0.8]);
    if (z.h > H && y1 >= z.h - 1e-3) strip(z.h - 0.1, 0.2, 0.1, 'plaster', [0.92, 0.88, 0.8]);
    // 掛畫候選
    if (y0 === 0 && p.y1 >= H - 1e-3 && len >= 2.0) {
      const cnt = Math.floor(len / 3.4) || 1;
      for (let k = 0; k < cnt; k++) { const s = run.s0 + len * (k + 0.5) / cnt; paintSpots.push({ hz, s, f, side, zone: z, ch }); }
    }
  }

  // ---------- 門、拱門、窗 ----------
  const glassQuads = [];
  for (const o of map.openings) {
    const hz = o.axis === 'x', za = hz ? zoneAt(o.at, o.c + 0.4) : zoneAt(o.c + 0.4, o.at), zb = hz ? zoneAt(o.at, o.c - 0.4) : zoneAt(o.c - 0.4, o.at);
    const ch = chunkOf(za || zb), m = new THREE.Matrix4().makeRotationY(hz ? 0 : Math.PI / 2).setPosition(hz ? o.at : o.c, 0, hz ? o.c : o.at), L = B.local(ch, m);
    // 局部：x 沿牆、z 垂直牆
    const w = o.w, y0 = o.y0, y1 = o.y1, t = WT / 2;
    if (o.k !== 'window') {
      for (const sd of [-1, 1]) { if (!(sd > 0 ? (hz ? za : zb) : (hz ? zb : za)) && false) continue;
        for (const s of [-1, 1]) L.box('woodF', s * (w / 2 + 0.045), y1 / 2 + 0.045, sd * (t + 0.015), 0.11, y1 + 0.09, 0.03, { col: WOOD_D });
        L.box('woodF', 0, y1 + 0.055, sd * (t + 0.015), w + 0.2, 0.11, 0.03, { col: WOOD_D });
      }
      L.box('metal', 0, 0.006, 0, w, 0.012, WT + 0.04, { col: BRASS });
      if (o.k === 'door') {
        // 門扇：開到貼牆；若會穿進家具就不放（門板早被拆走了）
        const id = Math.round(o.c * 31 + o.at * 17); let placed = false;
        for (const [hs, sd] of [[1, 1], [-1, 1], [1, -1], [-1, -1]].sort(() => hash(id) - 0.5)) {
          if (placed || hash(id + 3) < 0.18) break;
          const ang = (1.62 + hash(id + hs) * 0.5) * hs * sd, lw = w - 0.06;
          const hx = hs * (w / 2 - 0.03), hzl = sd * (t + 0.03), ex = hx - hs * Math.cos(ang) * lw, ez = hzl + Math.sin(Math.abs(ang)) * lw * sd;
          const wp = new THREE.Vector3((hx + ex) / 2, 1, (hzl + ez) / 2).applyMatrix4(m), we = new THREE.Vector3(ex, 1, ez).applyMatrix4(m);
          if (tallAt(wp.x, wp.z) || tallAt(we.x, we.z) || !world.walkable(we.x, we.z) && !world.walkable(wp.x, wp.z)) continue;
          const dm = new THREE.Matrix4().makeRotationY(Math.atan2(-(ez - hzl), ex - hx)).setPosition((hx + ex) / 2, 0, (hzl + ez) / 2).premultiply(m), D = B.local(ch, dm);
          D.box('door', 0, 1.06, 0, lw, 2.1, 0.045, { uvFit: 1 }); D.sph('metal', lw / 2 - 0.08, 1.02, 0.045, 0.028, { col: BRASS }); D.sph('metal', lw / 2 - 0.08, 1.02, -0.045, 0.028, { col: BRASS });
          D.box('metal', 0, 1.62, 0.024, 0.14, 0.07, 0.006, { col: BRASS }); D.box('metal', 0, 1.62, -0.024, 0.14, 0.07, 0.006, { col: BRASS });
          placed = true;
        }
      }
    } else {
      const hgt = y1 - y0, cy = (y0 + y1) / 2, fr = C('#2a1c14');
      for (const s of [-1, 1]) L.box('woodF', s * (w / 2 - 0.03), cy, 0, 0.06, hgt, WT + 0.06, { col: fr });
      L.box('woodF', 0, y1 - 0.03, 0, w, 0.06, WT + 0.06, { col: fr }); L.box('woodF', 0, y0 + 0.03, 0, w + 0.12, 0.06, WT + 0.16, { col: fr });
      const nv = w > 2 ? 2 : 1, nh = Math.max(1, Math.round(hgt / 1.3) - 1);
      for (let i = 1; i <= nv; i++) L.box('woodF', -w / 2 + w * i / (nv + 1), cy, 0, 0.035, hgt, 0.05, { col: fr });
      for (let i = 1; i <= nh; i++) L.box('woodF', 0, y0 + hgt * i / (nh + 1), 0, w, 0.035, 0.05, { col: fr });
      glassQuads.push({ m, w, y0, y1 });
      // 窗簾：朝室內那一側
      const inside = (hz ? za : zb) ? 1 : -1, zi = inside * (t + 0.09), tall = hgt > 3, cc = tall ? RED : (hash(o.at * 3.1) > 0.5 ? GREEN : RED);
      if (y0 > 0.3 || tall) {
        const top = y1 + 0.16, bot = tall ? 0.04 : Math.max(0.05, y0 - 0.25), open = 0.2 + hash(o.at * 7.7) * (tall ? 0.15 : 0.45);
        for (const s of [-1, 1]) { const cw = (w / 2) * (1 - open) + 0.1, n = Math.max(3, Math.round(cw / 0.11));
          for (let i = 0; i < n; i++) { const x = s * (w / 2 + 0.08 - (i + 0.5) * cw / n); L.box('fabric', x, (top + bot) / 2, zi + ((i % 2) ? 0.035 : -0.01), cw / n * 1.25, top - bot, 0.03, { col: mul(cc, 0.8 + (i % 3) * 0.12), ry: (i % 2 ? 1 : -1) * 0.5, tess: 0.7 }); } }
        L.box('woodF', 0, top + 0.05, zi, w + 0.4, 0.1, 0.1, { col: WOOD_D }); if (tall) L.box('fabric', 0, top - 0.16, zi + inside * 0.03, w + 0.3, 0.42, 0.06, { col: cc, r: 0.02 });
      }
    }
  }

  // ---------- 家具 ----------
  for (const it of map.items) {
    const fn = ITEM[it.type]; if (!fn) continue;
    const m = new THREE.Matrix4().makeRotationY(it.rot * Math.PI / 2).setPosition(it.x, 0, it.z);
    B.owner = it.hp0 ? 'i' + it.id : null; fn(B.local(chunkOf(zoneAt(it.x, it.z)), m), it); B.owner = null;
  }
  // ---------- 燈具 ----------
  for (const l of map.lamps) {
    if (l.kind === 'window' || l.kind === 'chandelier' || l.kind === 'neon') continue;
    let wd = [0, 1];
    if (l.kind === 'sconce') for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.raycast(l.x, l.y, l.z, d[0], 0, d[1], 0.4) < Infinity) wd = d;
    const z = zoneAt(l.x, l.z);
    B.lamp = l.id; B.owner = l.item >= 0 ? 'i' + l.item : null; // 檯燈算在床頭櫃名下，櫃子壞了一起消失
    fixture(B.local(chunkOf(z), new THREE.Matrix4().makeTranslation(l.x, l.y, l.z)), l, wd, z ? z.h : H); B.lamp = -1; B.owner = null;
  }
  // ---------- 裝飾 ----------
  for (const d of map.decor) {
    if (d.type === 'rug') { const s = d.big ? 1 : 1; B.quad('rug', chunkOf(zoneAt(d.x, d.z)), d.x - d.w / 2, 0.012, d.z - d.d / 2, d.w, 0, 0, 0, 0, d.d, 0, 1, 0, 0, 0, s, s, 0.6); }
    else if (d.type === 'chandelier') { chandelier(B.local(chunkOf(zoneAt(d.x, d.z)), new THREE.Matrix4().makeTranslation(d.x, d.y, d.z)), d); B.lamp = -1; }
    else if (d.type === 'balcony') {
      const L = B.local('c', I4), w = d.x1 - d.x0, dp = d.z1 - d.z0;
      L.box('woodF', 0, d.y + 0.125, (d.z0 + d.z1) / 2, w, 0.25, dp, { col: WOOD_D }); L.box('plaster', 0, d.y - 0.02, (d.z0 + d.z1) / 2, w, 0.04, dp, { uvs: 2.4, skip: 'Y' });
      L.box('woodF', 0, d.y + 1.2, d.z1 - 0.05, w, 0.07, 0.11, { col: WOOD_M }); L.box('metal', 0, d.y + 0.33, d.z1 - 0.05, w, 0.03, 0.04, { col: BRASS });
      for (let x = d.x0 + 0.2; x < d.x1; x += 0.2) L.cyl('metal', x, d.y + 0.72, d.z1 - 0.05, 0.012, 0.012, 0.9, 5, { col: (Math.round(x * 5) % 8 === 0) ? WOOD_D : BRASS });
      for (let x = d.x0 + 0.1; x <= d.x1; x += 2.6) L.box('woodF', x, d.y + 0.72, d.z1 - 0.05, 0.12, 1.0, 0.12, { col: WOOD_D });
      // 陽台後方牆上的門（裝飾）
      for (const x of [-4.5, 4.5]) { L.box('door', x, d.y + 0.25 + 1.05, -5 + WT / 2 + 0.02, 0.95, 2.1, 0.04, { uvFit: 1 }); L.box('woodF', x, d.y + 0.25 + 2.16, -5 + WT / 2 + 0.03, 1.15, 0.1, 0.05, { col: WOOD_D }); }
    } else if (d.type === 'keyrack') {
      const L = B.local('c', new THREE.Matrix4().makeTranslation(d.x, 0, d.z));
      L.box('woodF', 0, 1.75, 0.03, d.w, 1.1, 0.06, { col: WOOD_D }); L.box('woodF', 0, 2.33, 0.05, d.w + 0.16, 0.08, 0.12, { col: WOOD_M });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
        const x = -d.w / 2 + 0.16 + c * (d.w - 0.32) / 11, y = 2.12 - r * 0.25, k = hash(r * 13 + c);
        L.box('paint', x, y - 0.04, 0.062, 0.2, 0.2, 0.004, { col: C('#241710') }); L.cyl('metal', x, y + 0.04, 0.07, 0.006, 0.006, 0.03, 5, { col: BRASS, rx: Math.PI / 2 });
        if (k > 0.3) { L.box('metal', x, y - 0.02, 0.074, 0.035, 0.085, 0.006, { col: BRASS, rz: (k - 0.6) * 0.3 }); L.cyl('metal', x, y - 0.1, 0.076, 0.03, 0.03, 0.006, 8, { col: k > 0.8 ? C('#8a2a22') : BRASS, rx: Math.PI / 2 }); }
      }
    } else if (d.type === 'elevator') {
      const L = B.local('c', new THREE.Matrix4().makeTranslation(d.x, 0, d.z));
      L.box('metal', 0, 1.1, 0.012, 1.2, 2.2, 0.02, { col: C('#6f6753') }); L.box('paint', 0, 1.1, 0.024, 0.012, 2.2, 0.004, { col: BLACK });
      for (const s of [-1, 1]) L.box('metal', s * 0.68, 1.15, 0.03, 0.16, 2.3, 0.06, { col: BRASS }); L.box('metal', 0, 2.34, 0.03, 1.52, 0.16, 0.06, { col: BRASS });
      L.box('paint', 0, 2.62, 0.02, 0.7, 0.24, 0.03, { col: BLACK }); L.cyl('glow', (hash(d.x) - 0.5) * 0.4, 2.62, 0.04, 0.03, 0.03, 0.01, 10, { col: [6, 3, 0.8], rx: Math.PI / 2 });
      L.box('metal', 0.92, 1.15, 0.015, 0.09, 0.2, 0.02, { col: BRASS }); L.cyl('glow', 0.92, 1.18, 0.03, 0.018, 0.018, 0.01, 8, { col: [3, 1.6, 0.4], rx: Math.PI / 2 });
    }
  }
  // 掛畫
  let pi = 0;
  for (const s of paintSpots) {
    const k = hash(++pi * 7.31); if (k < 0.42) continue;
    const x = s.hz ? s.s : s.f + s.side * 0.03, z = s.hz ? s.f + s.side * 0.03 : s.s;
    if (map.lamps.some(l => Math.hypot(l.x - x, l.z - z) < 1.3) || tallAt(x, z) || map.openings.some(o => o.k === 'window' && o.axis === (s.hz ? 'x' : 'z') && Math.abs(o.c - (s.hz ? s.f : s.f)) < 0.3 && Math.abs(o.at - s.s) < o.w / 2 + 0.7)) continue;
    if (map.decor.some(d => (d.type === 'keyrack' || d.type === 'elevator' || d.type === 'sign') && Math.hypot(d.x - x, d.z - z) < 2.6)) continue;
    const big = s.zone.style === 'lobby' || s.zone.style === 'dining', w = big ? 1.1 : 0.62 + (k - 0.4) * 0.5, h = big ? 0.8 : 0.5 + hash(pi) * 0.25, y = big ? 2.0 : 1.72;
    const ry = s.hz ? (s.side > 0 ? 0 : Math.PI) : (s.side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const L = B.local(s.ch, new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z)), cell = (pi * 5) % 8, u0 = (cell % 4) / 4, v0 = 1 - ((cell >> 2) + 1) / 2;
    L.box(k > 0.7 ? 'metal' : 'woodF', 0, 0, 0, w + 0.1, h + 0.1, 0.04, { col: k > 0.7 ? BRASS : WOOD_D, rz: (hash(pi * 3) - 0.5) * (k > 0.85 ? 0.22 : 0.03) });
    const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < 4; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v0 + uv.getY(i) * 0.5);
    L.geo('art', g, 0, 0, 0.024, { rz: 0 });
  }
  // 地上的紙張與碎屑
  let di = 0;
  for (const z of map.zones) {
    const n = Math.round((z.x1 - z.x0) * (z.z1 - z.z0) / 16);
    for (let i = 0; i < n; i++) {
      const x = z.x0 + 0.5 + hash(++di * 3.7) * (z.x1 - z.x0 - 1), zz = z.z0 + 0.5 + hash(di * 9.1) * (z.z1 - z.z0 - 1), s = 0.5 + hash(di) * 0.6, a = hash(di * 2.3) * 6.28, cell = (hash(di * 5.5) * 4) | 0;
      const ax = Math.cos(a) * s, az = Math.sin(a) * s;
      B.quad('debris', chunkOf(z), x - ax / 2 + az / 2, 0.006 + (di % 5) * 0.0015, zz - az / 2 - ax / 2, ax, 0, az, -az, 0, ax, 0, 1, 0, (cell % 2) * 0.5, (cell >> 1) * 0.5, 0.5, 0.5, 1);
    }
  }

  // ---------- 烘焙 ----------
  const lights = new Lights(map, world);
  await B.bake(lights, onProgress);
  const group = B.build(M); group.name = 'hotel';

  // ---------- 不烘焙的附加物 ----------
  // 窗玻璃
  { const g = []; for (const q of glassQuads) { const p = new THREE.PlaneGeometry(q.w - 0.1, q.y1 - q.y0 - 0.1); p.applyMatrix4(new THREE.Matrix4().makeTranslation(0, (q.y0 + q.y1) / 2, 0).premultiply(q.m)); g.push(p); }
    const mesh = new THREE.Mesh(mergeGeos(g), M.glass); mesh.renderOrder = 4; extras.add(mesh); }
  // 招牌與霓虹
  for (const d of map.decor) {
    if (d.type === 'sign') {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.62), new THREE.MeshStandardMaterial({ map: textTexture(d.text, { w: 1024, h: 128, size: 92, color: '#c9a45c', spacing: '18px', weight: 500 }), transparent: true, roughness: 0.4, metalness: 0.9, emissive: new THREE.Color('#5a3f14'), emissiveMap: null, depthWrite: false }));
      m.material.emissiveMap = m.material.map; m.position.set(d.x, d.y, d.z + 0.02); extras.add(m);
    } else if (d.type === 'neon') {
      const tx = textTexture(d.text, { w: 512, h: 192, size: 150, color: '#fff', font: '"Snell Roundhand", "Brush Script MT", cursive', weight: 700 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), new THREE.MeshBasicMaterial({ map: tx, transparent: true, color: new THREE.Color(5, 1.1, 0.35), depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(d.x, d.y, d.z); m.rotation.y = Math.PI; extras.add(m); extras.userData.neon = m; m.userData.lamp = d.lamp;
    }
  }
  // 室外：地面、遠方建築剪影、路燈、天空、雨
  const out = new THREE.Group(); extras.add(out);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uFlash: BAKE_U.uMoon },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform float uFlash;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){ vec3 d = normalize(vP); float c = n(d.xz / (abs(d.y) + 0.25) * 2.0) * 0.6 + n(d.xz / (abs(d.y) + 0.25) * 5.0) * 0.4;
        vec3 col = mix(vec3(0.02,0.028,0.045), vec3(0.06,0.075,0.11), c) * (1.0 + (uFlash - 1.0) * 1.6 * c);
        gl_FragColor = vec4(col * smoothstep(-0.2, 0.25, d.y + 0.1), 1.0); }` }));
  sky.renderOrder = -10; out.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.35, metalness: 0.2, envMapIntensity: 0.4 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; out.add(ground);
  { // 遠方建築與亮著的幾扇窗
    const bg = [], wg = [];
    for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + hash(i) * 0.2, r = 75 + hash(i * 3) * 50, w = 12 + hash(i * 5) * 16, h = 14 + hash(i * 7) * 40, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const b = new THREE.BoxGeometry(w, h, w); b.translate(x, h / 2, z); bg.push(b);
      for (let k = 0; k < 5; k++) { const p = new THREE.PlaneGeometry(1.1, 1.5); p.lookAt(new THREE.Vector3(-x, 0, -z).normalize()); p.translate(x - Math.cos(a) * (w / 2 + 0.2) + (hash(i * 11 + k) - 0.5) * w * 0.7 * Math.sin(a), 3 + hash(i * 13 + k) * (h - 5), z - Math.sin(a) * (w / 2 + 0.2) - (hash(i * 11 + k) - 0.5) * w * 0.7 * Math.cos(a)); wg.push(p); } }
    out.add(new THREE.Mesh(mergeGeos(bg), new THREE.MeshBasicMaterial({ color: 0x05070a })));
    out.add(new THREE.Mesh(mergeGeos(wg), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.7) })));
    for (const [x, z] of [[-5, 24], [7, 27], [-17, 25], [18, 24], [-12, -26], [10, -27], [22, -25]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5.2, 6), new THREE.MeshBasicMaterial({ color: 0x08090b })); pole.position.set(x, 2.6, z); out.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.6, 7) })); lamp.position.set(x, 5.3, z); out.add(lamp);
    }
  }
  // 雨：窗外的捲動雨絲
  const rainMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uFlash: BAKE_U.uMoon },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uFlash;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){ float a = 0.0; for (int i = 0; i < 3; i++) { float fi = float(i); vec2 p = vec2(vUv.x * (90.0 + fi * 50.0) + vUv.y * 4.0, vUv.y * (3.0 + fi) + uT * (2.6 + fi * 0.8)); vec2 c = floor(p); float r = h(c + fi * 7.0); float s = smoothstep(0.42, 0.5, 1.0 - abs(fract(p.x) - 0.5)) * step(0.86, r) * smoothstep(0.0, 0.3, fract(p.y)) * smoothstep(1.0, 0.5, fract(p.y)); a += s * (0.5 - fi * 0.12); }
        gl_FragColor = vec4(vec3(0.45, 0.55, 0.75) * a * (0.5 + (uFlash - 1.0) * 0.5), 1.0); }` });
  for (const [x, y, z, w, h, ry] of [[0, 4, 14.2, 20, 8, 0], [-16, 2, 18.0, 18, 4, 0], [16, 2, 18.0, 18, 4, 0], [0, 2, -20.0, 50, 4, 0]]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rainMat); r.position.set(x, y, z); r.rotation.y = ry; r.renderOrder = 3; out.add(r); }
  extras.userData.rain = rainMat;
  // 環境貼圖：一間只有幾塊暖色光板的小房間（給金屬與亮面一點反射）
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: 0x120d0a, side: THREE.BackSide })));
  for (const [x, y, z, s, c] of [[0, 2.9, 0, 2.2, [9, 6, 3]], [4.9, 0.5, 1, 1.2, [5, 3.2, 1.4]], [-4.9, 0.8, -2, 1.0, [4, 2.6, 1.2]], [1, 0.4, -4.9, 1.6, [1.2, 1.6, 2.6]], [-2, -2.9, 2, 3, [0.5, 0.3, 0.18]]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(s * 0.5, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) })); m.position.set(x, y, z); envScene.add(m); }

  return { group, extras, materials: M, textures: Tx, lights, envScene, stats: group.userData.stats };
}

function fixUV(B, mat, ch, w, d, s, z) { // parquet：把 uv 改成沿另一個方向，讓木條轉 90 度
  const b = B.bin(mat, ch), na = Math.max(1, Math.ceil(w / 0.5 - 1e-6)), nb = Math.max(1, Math.ceil(d / 0.5 - 1e-6)), n = (na + 1) * (nb + 1), start = b.uv.length / 2 - n;
  for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) { const k = (start + j * (na + 1) + i) * 2; b.uv[k] = (z.z0 + d * j / nb) / s; b.uv[k + 1] = (z.x0 + w * i / na) / s; }
}
export function mergeGeos(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni); let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i;
    vo += n;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
