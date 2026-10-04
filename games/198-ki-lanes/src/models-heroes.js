// 六名英雄的有機造型（SDF → 網格）。部件與 models.js 的骨架一一對應：
// heads{base,ssj}、hips、torso、upperL/R、foreL/R、thighL/R、shinL/R，以及 sash、tail、sword、sheath。
// 全部程式產生；臉是畫在 canvas 上的貼花。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Body, sphere, ellip, cone, rbox, torus, plane, strand, region, meshBody } from './models-sdf.js';
import { unzlibSync } from 'three/examples/jsm/libs/fflate.module.js';
import { BAKED } from './models-baked.js';

// 比例（FighterZ 的英雄比例：約 5.6 頭身、寬肩）
export const PROPS = {
  goku: { H: 1.85, hr: 0.165, L: 0.88, sw: 0.25, chest: [0.215, 0.3, 0.158], waist: 0.15, arm: 0.068, fore: 0.062, fist: 0.086, thigh: 0.112, shin: 0.08, hip: 0.122 },
  vegeta: { H: 1.72, hr: 0.157, L: 0.81, sw: 0.24, chest: [0.208, 0.29, 0.152], waist: 0.138, arm: 0.066, fore: 0.06, fist: 0.083, thigh: 0.106, shin: 0.077, hip: 0.114 },
  trunks: { H: 1.86, hr: 0.157, L: 0.9, sw: 0.228, chest: [0.195, 0.28, 0.142], waist: 0.13, arm: 0.06, fore: 0.055, fist: 0.078, thigh: 0.098, shin: 0.073, hip: 0.11 },
  piccolo: { H: 2.12, hr: 0.168, L: 1.02, sw: 0.27, chest: [0.235, 0.31, 0.162], waist: 0.148, arm: 0.07, fore: 0.064, fist: 0.09, thigh: 0.116, shin: 0.084, hip: 0.124 },
  frieza: { H: 1.55, hr: 0.15, L: 0.7, sw: 0.178, chest: [0.158, 0.24, 0.128], waist: 0.1, arm: 0.048, fore: 0.045, fist: 0.062, thigh: 0.076, shin: 0.06, hip: 0.096 },
  a18: { H: 1.72, hr: 0.151, L: 0.86, sw: 0.183, chest: [0.168, 0.26, 0.128], waist: 0.112, arm: 0.046, fore: 0.042, fist: 0.06, thigh: 0.088, shin: 0.065, hip: 0.114 },
};

const C = {
  gi: 0xff8424, giD: 0xd8601a, blue: 0x2a4fb8, blueD: 0x1c3384, red: 0xd0342c, yellow: 0xf2c632, black: 0x1a1614, blackL: 0x34302c,
  suit: 0x2b4ec4, suitD: 0x1f3a96, armor: 0xf6f3ea, ochre: 0xe8b030,
  jacket: 0x1c2240, tank: 0x16161a, grey: 0x7a7e8a, lav: 0xbba6ea, lavD: 0x9a86d0, steel: 0xe3e9f0, hilt: 0x3a2a1e, sheath: 0x6a5430, brass: 0xb08a3a,
  pgi: 0x5d3a94, pgiD: 0x46296f, sash: 0x5fb8e8, brown: 0x6e4428, pink: 0xe6909e, pskin: 0x66b83e, pskinD: 0x4a9a2c,
  fskin: 0xf7f4f0, dome: 0x7a3cc4, domeL: 0xb27ae8,
  denim: 0x3f70ba, denimD: 0x2c5290, blonde: 0xf5dc7e, blondeD: 0xdcbc52, stripeW: 0xf2f0ea, stripeB: 0x1e1e24, legging: 0x1c1c22, boot: 0x7c4c2c,
  gold: 0xffd23f, goldL: 0xfff2a8,
};
const SKIN = { goku: 0xf6c9a0, vegeta: 0xf2c69e, trunks: 0xf7cfa8, piccolo: C.pskin, frieza: C.fskin, a18: 0xf9d6bd };

// 各部件減面目標（三角形數）
export const SEGMENT_TARGETS = (name) => name.startsWith('head') ? 5200 : name === 'torso' ? 2300 : name === 'hips' ? 1000 : name.startsWith('upper') ? 650
  : name.startsWith('fore') ? 1100 : name.startsWith('thigh') ? 800 : name.startsWith('shin') ? 1050 : name === 'sword' ? 500 : name === 'sheath' ? 200 : 160;

const cache = new Map();
// 有烘焙資料就解碼（快），否則現場以 SDF 建（慢，烘焙工具與開發時用）
export function buildHeroParts(id, d) {
  if (cache.has(id)) return cache.get(id);
  const out = BAKED[id] ? decodeHero(id, d) : buildHeroLive(id, d);
  cache.set(id, out);
  return out;
}
export function buildHeroLive(id, d) { return build(id, d); }

function decodeHero(id, d) {
  const B = BAKED[id];
  const bin = atob(B.data), z = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) z[i] = bin.charCodeAt(i);
  const buf = unzlibSync(z);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // 調色盤存的是線性色值（不再做 sRGB 轉換）
  const pal = B.pal.map((h) => new THREE.Color().setRGB(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255));
  let o = 0;
  const pad = () => { o += (4 - (o % 4)) % 4; };
  const segs = {};
  for (const name of B.names) {
    const n = dv.getFloat32(o, true), ni = dv.getFloat32(o + 4, true);
    const lo = [dv.getFloat32(o + 8, true), dv.getFloat32(o + 12, true), dv.getFloat32(o + 16, true)], sz = [dv.getFloat32(o + 20, true), dv.getFloat32(o + 24, true), dv.getFloat32(o + 28, true)];
    o += 32;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cA = new Float32Array(n * 3), cB = new Float32Array(n * 3), mat = new Float32Array(n * 2), edge = new Float32Array(n), ao = new Float32Array(n);
    for (let v = 0; v < n; v++, o += 13) {
      for (let i = 0; i < 3; i++) pos[v * 3 + i] = lo[i] + (dv.getUint16(o + i * 2, true) / 65535) * sz[i];
      let x = dv.getInt8(o + 6) / 127, y = dv.getInt8(o + 7) / 127, zz = 1 - Math.abs(x) - Math.abs(y);
      if (zz < 0) { const ox = x; x = (1 - Math.abs(y)) * Math.sign(ox || 1); y = (1 - Math.abs(ox)) * Math.sign(y || 1); }
      const l = Math.hypot(x, y, zz) || 1; nor[v * 3] = x / l; nor[v * 3 + 1] = y / l; nor[v * 3 + 2] = zz / l;
      const a = pal[buf[o + 8]], b = pal[buf[o + 9]];
      cA[v * 3] = a.r; cA[v * 3 + 1] = a.g; cA[v * 3 + 2] = a.b; cB[v * 3] = b.r; cB[v * 3 + 1] = b.g; cB[v * 3 + 2] = b.b;
      mat[v * 2] = buf[o + 10] & 15; mat[v * 2 + 1] = buf[o + 10] >> 4;
      edge[v] = (dv.getInt8(o + 11) / 127) * 0.05; ao[v] = buf[o + 12] / 255;
    }
    pad();
    const idx = new Uint16Array(ni); for (let i = 0; i < ni; i++) idx[i] = dv.getUint16(o + i * 2, true);
    o += ni * 2; pad();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cA, 3)); g.setAttribute('aColB', new THREE.BufferAttribute(cB, 3));
    g.setAttribute('aMat', new THREE.BufferAttribute(mat, 2)); g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1)); g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    segs[name] = g;
  }
  const out = { heads: {}, faceRect: B.faceRect };
  for (const name in segs) {
    const g = segs[name];
    if (name.startsWith('head_')) { const f = name.slice(5); out.heads[f] = { main: g, face: drawFace(id, f === 'ssj', d.hr) }; }
    else if (name.startsWith('sash')) (out.sash ||= [])[+name.slice(4)] = g;
    else if (name.startsWith('tail')) (out.tail ||= [])[+name.slice(4)] = g;
    else out[name] = g;
  }
  return out;
}

/* ---------------- 共用 ---------------- */
// 橫條紋塗色區（負值＝黑條），可再以 clip(x,y,z) 限制範圍
const stripes = (P, clip) => region((x, y, z) => { const f = ((y / P) % 1 + 1) % 1; return Math.max((Math.abs(f - 0.5) - 0.25) * P, clip ? clip(x, y, z) : -1); });
const merge = (list) => { const g = mergeGeometries(list.filter(Boolean)); for (const x of list) x && x.dispose(); return g; };
const lerp = (a, b, t) => a + (b - a) * t;

function build(id, d) {
  const skin = SKIN[id];
  const T = d.torso, [cx, , cz] = d.chest, w = d.waist, hr = d.hr, cy = hr * 0.9;
  const out = {};
  const CELL = 0.021, CELL_LIMB = 0.017, CELL_HEAD = 0.0125, CELL_HAIR = 0.0145, CELL_HAND = 0.0095;

  /* ================= 頭 ================= */
  const skull = () => {
    const B = new Body();
    const s = skin;
    B.add(ellip([0, cy + hr * 0.08, -hr * 0.04], [hr * 0.9, hr * 0.95, hr * 0.93]), s, { k: 0.02 });
    // 臉頰與下巴：往前下收尖（動畫臉）
    B.add(cone([0, cy - hr * 0.05, hr * 0.18], [0, cy - hr * 0.8, hr * 0.5], hr * 0.62, hr * 0.16), s, { k: 0.08 });
    for (const sx of [-1, 1]) B.add(ellip([sx * hr * 0.42, cy - hr * 0.28, hr * 0.42], [hr * 0.3, hr * 0.3, hr * 0.28]), s, { k: 0.06 });
    // 鼻
    B.add(cone([0, cy - hr * 0.08, hr * 0.8], [0, cy - hr * 0.32, hr * 0.9], hr * 0.035, hr * 0.05), s, { k: 0.03 });
    // 耳
    if (id !== 'piccolo') for (const sx of [-1, 1]) B.add(ellip([sx * hr * 0.88, cy - hr * 0.08, -hr * 0.05], [hr * 0.12, hr * 0.2, hr * 0.1], [0, sx * 0.3, 0]), s, { k: 0.02 });
    return B;
  };
  // 髮帽：頭頂與後腦，前面切出髮際線
  const hairCap = (B, c, front = 0.4, back = -0.9, scale = 1.06, sides = -0.25) => {
    B.add(ellip([0, cy + hr * 0.1, -hr * 0.06], [hr * 0.93 * scale, hr * 0.98 * scale, hr * 0.97 * scale]), c, { mat: 1, k: 0.0 });
    // 髮際線：前高後低的斜面
    B.add(plane([0, cy + hr * front, hr * 0.3], [0, -1, 0.45]), c, { inter: true, k: 0.02 });
  };
  const spike = (B, c, root, mid, tip, r0, r1 = 0.004, n = 3, mat = 1) => B.add(strand(root, mid, tip, r0, r1, n), c, { mat, k: 0.012 });
  // 以極座標描述一束：從頭殼表面方位 (yaw, pitch) 長出，往 dir 方向彎
  const tuft = (B, c, yaw, pitch, len, r0, bendUp = 0.25, twist = 0, out0 = 0.85) => {
    const ux = Math.sin(yaw) * Math.cos(pitch), uy = Math.sin(pitch), uz = Math.cos(yaw) * Math.cos(pitch);
    const root = [ux * hr * out0, cy + hr * 0.1 + uy * hr * out0, -hr * 0.06 + uz * hr * out0];
    const mid = [root[0] + ux * len * 0.5 + twist * uz * len * 0.2, root[1] + uy * len * 0.5 + bendUp * len * 0.3, root[2] + uz * len * 0.5 - twist * ux * len * 0.2];
    const tip = [root[0] + ux * len, root[1] + uy * len + bendUp * len * 0.5, root[2] + uz * len];
    spike(B, c, root, mid, tip, r0);
  };
  const heads = {};
  const skullGeo = meshBody(skull(), { cell: CELL_HEAD });
  const forms = ['goku', 'vegeta', 'trunks'].includes(id) ? ['base', 'ssj'] : ['base'];
  for (const form of forms) {
    const ssj = form === 'ssj';
    const H = new Body();
    if (id === 'goku') {
      const hc = ssj ? C.gold : C.black;
      hairCap(H, hc, 0.42);
      if (!ssj) {
        // 招牌的棕櫚葉放射狀：粗根、尖梢；頭頂往上外翹，兩側水平張開，後腦往後下
        [[0.25, 1.15, 0.36, 0.1, 0.35], [-0.35, 1.1, 0.34, 0.095, 0.3], [0.9, 0.9, 0.36, 0.095, 0.25], [-0.95, 0.88, 0.36, 0.095, 0.25],
          [1.45, 0.45, 0.38, 0.095, 0.15], [-1.45, 0.45, 0.38, 0.095, 0.15], [1.75, 0.05, 0.3, 0.085, -0.1], [-1.75, 0.05, 0.3, 0.085, -0.1],
          [2.25, 0.65, 0.34, 0.1, 0.2], [-2.25, 0.65, 0.34, 0.1, 0.2], [2.75, 0.2, 0.32, 0.1, 0.0], [-2.75, 0.2, 0.32, 0.1, 0.0], [3.14, 0.75, 0.3, 0.1, 0.25],
          [2.5, -0.35, 0.26, 0.085, -0.2], [-2.5, -0.35, 0.26, 0.085, -0.2]]
          .forEach(([yaw, pitch, len, r, bend], i) => tuft(H, hc, yaw, pitch, len, r, bend, (i % 2 ? 1 : -1) * 0.25, 0.78));
        // 前額瀏海：幾綹短而尖，壓在眉毛上方、往外撇
        [[-0.5, -0.32, 0.36], [-0.18, -0.05, 0.42], [0.14, 0.12, 0.4], [0.46, 0.34, 0.34]].forEach(([x, tx, l]) => {
          const root = [x * hr, cy + hr * 0.9, hr * 0.5];
          spike(H, hc, root, [x * hr * 1.1 + tx * hr * 0.3, cy + hr * 0.72, hr * 0.92], [x * hr + tx * hr * 0.9, cy + hr * (0.72 - l), hr * 0.95], 0.06, 0.004);
        });
      } else {
        // 超級賽亞人：整束往上、往後豎起，前面只垂一綹
        [[0, 1.35, 0.42, 0.08], [0.55, 1.15, 0.4, 0.075], [-0.55, 1.15, 0.4, 0.075], [1.15, 0.95, 0.36, 0.07], [-1.15, 0.95, 0.36, 0.07],
          [1.8, 0.85, 0.36, 0.07], [-1.8, 0.85, 0.36, 0.07], [2.5, 0.95, 0.36, 0.075], [-2.5, 0.95, 0.36, 0.075], [3.14, 0.75, 0.36, 0.075],
          [2.2, 0.4, 0.28, 0.062], [-2.2, 0.4, 0.28, 0.062], [1.5, 0.35, 0.24, 0.055], [-1.5, 0.35, 0.24, 0.055]]
          .forEach(([yaw, pitch, len, r], i) => tuft(H, hc, yaw, pitch, len, r, 0.55, (i % 2 ? 1 : -1) * 0.2));
        spike(H, hc, [-hr * 0.1, cy + hr * 0.7, hr * 0.62], [-hr * 0.2, cy + hr * 0.55, hr * 1.0], [-hr * 0.35, cy + hr * 0.05, hr * 1.0], 0.04);
      }
    } else if (id === 'vegeta') {
      const hc = ssj ? C.gold : C.black;
      // 高髮際＋深 M 字美人尖
      hairCap(H, hc, 0.62, -0.9, 1.05);
      spike(H, hc, [0, cy + hr * 0.86, hr * 0.5], [0, cy + hr * 0.74, hr * 0.84], [0, cy + hr * 0.5, hr * 0.93], 0.05, 0.006);
      // 火焰：一束束幾乎垂直往上、略向後
      [[0, 1.45, 0.62, 0.085], [0.35, 1.3, 0.56, 0.08], [-0.35, 1.3, 0.56, 0.08], [0.8, 1.15, 0.5, 0.075], [-0.8, 1.15, 0.5, 0.075],
        [1.35, 1.0, 0.42, 0.07], [-1.35, 1.0, 0.42, 0.07], [2.2, 1.1, 0.48, 0.075], [-2.2, 1.1, 0.48, 0.075], [2.8, 1.2, 0.54, 0.08], [-2.8, 1.2, 0.54, 0.08], [3.14, 1.25, 0.56, 0.085],
        [1.8, 0.6, 0.3, 0.06], [-1.8, 0.6, 0.3, 0.06]]
        .forEach(([yaw, pitch, len, r], i) => tuft(H, hc, yaw, pitch, len * (ssj ? 1.08 : 1), r, 0.35, (i % 2 ? 1 : -1) * 0.15));
    } else if (id === 'trunks') {
      if (!ssj) {
        // 淡紫中分：兩片垂到下顎的髮簾
        hairCap(H, C.lav, 0.55, -0.9, 1.08);
        for (const sx of [-1, 1]) {
          for (let i = 0; i < 5; i++) {
            const a = sx * (0.25 + i * 0.32);
            const rx = Math.sin(a) * hr * 0.92, rz = Math.cos(a) * hr * 0.92;
            if (i < 2) continue; // 前面兩綹會蓋到眼睛
            spike(H, C.lav, [rx * 0.7, cy + hr * 0.95, rz * 0.6 - hr * 0.06], [rx * 1.12, cy + hr * 0.45, rz * 1.05 - hr * 0.04], [rx * 1.08, cy - hr * 0.45, rz * 1.0 - hr * 0.02], 0.055, 0.012);
          }
          // 中分的前髮
          spike(H, C.lavD, [sx * hr * 0.05, cy + hr * 0.95, hr * 0.42], [sx * hr * 0.42, cy + hr * 0.82, hr * 0.85], [sx * hr * 0.82, cy + hr * 0.42, hr * 0.7], 0.05, 0.01);
        }
        for (let i = 0; i < 5; i++) { const a = Math.PI + (i - 2) * 0.32; spike(H, C.lav, [Math.sin(a) * hr * 0.6, cy + hr * 0.9, Math.cos(a) * hr * 0.6 - 0.02], [Math.sin(a) * hr * 1.05, cy + hr * 0.3, Math.cos(a) * hr * 1.05 - 0.02], [Math.sin(a) * hr * 1.0, cy - hr * 0.5, Math.cos(a) * hr * 1.0 - 0.02], 0.06, 0.014); }
      } else {
        hairCap(H, C.gold, 0.45);
        [[0, 1.3, 0.38, 0.075], [0.6, 1.1, 0.36, 0.07], [-0.6, 1.1, 0.36, 0.07], [1.3, 0.85, 0.32, 0.065], [-1.3, 0.85, 0.32, 0.065],
          [2.1, 0.8, 0.34, 0.068], [-2.1, 0.8, 0.34, 0.068], [2.8, 0.85, 0.34, 0.07], [-2.8, 0.85, 0.34, 0.07]]
          .forEach(([yaw, pitch, len, r], i) => tuft(H, C.gold, yaw, pitch, len, r, 0.5, (i % 2 ? 1 : -1) * 0.2));
        for (const sx of [-1, 1]) spike(H, C.gold, [sx * hr * 0.15, cy + hr * 0.75, hr * 0.6], [sx * hr * 0.35, cy + hr * 0.6, hr * 0.98], [sx * hr * 0.55, cy + hr * 0.15, hr * 0.95], 0.035);
      }
    } else if (id === 'piccolo') {
      // 觸角＋尖長耳＋頭頂紋路（以皮膚色建在頭殼外）
      for (const sx of [-1, 1]) {
        spike(H, skin, [sx * hr * 0.25, cy + hr * 0.75, hr * 0.55], [sx * hr * 0.3, cy + hr * 1.35, hr * 0.85], [sx * hr * 0.45, cy + hr * 1.55, hr * 1.25], 0.018, 0.012, 3, 0);
        H.add(sphere([sx * hr * 0.46, cy + hr * 1.56, hr * 1.27], 0.022), skin, { k: 0.01 });
        H.add(strand([sx * hr * 0.8, cy - hr * 0.05, -hr * 0.05], [sx * hr * 1.25, cy + hr * 0.15, -hr * 0.12], [sx * hr * 1.55, cy + hr * 0.45, -hr * 0.18], 0.06, 0.006, 3), skin, { k: 0.02 });
      }
      H.add(ellip([0, cy + hr * 0.62, hr * 0.62], [hr * 0.55, hr * 0.12, hr * 0.12], [0.5, 0, 0]), skin, { k: 0.03 }); // 眉骨
    } else if (id === 'frieza') {
      // 光滑的紫色頭頂圓頂
      H.add(ellip([0, cy + hr * 0.38, -hr * 0.12], [hr * 0.92, hr * 0.78, hr * 0.98]), C.dome, { mat: 2, k: 0 });
      H.add(plane([0, cy + hr * 0.25, 0], [0, -1, 0.55]), C.dome, { inter: true, k: 0.01 });
    } else if (id === 'a18') {
      // 金色及下顎鮑伯，側分
      hairCap(H, C.blonde, 0.5, -0.9, 1.08);
      for (let i = 0; i < 16; i++) {
        const a = -2.6 + i * (5.2 / 15), front = Math.cos(a) > 0.55;
        if (front && i !== 4 && i !== 5) continue;
        const rx = Math.sin(a) * hr, rz = Math.cos(a) * hr - hr * 0.05;
        spike(H, i % 3 ? C.blonde : C.blondeD, [rx * 0.75, cy + hr * 0.95, rz * 0.7], [rx * 1.12, cy + hr * 0.35, rz * 1.1], [rx * 1.12, cy - hr * 0.62, rz * 1.06], 0.06, 0.014);
      }
      // 大片側分瀏海（從左分往右掃）
      spike(H, C.blonde, [hr * 0.25, cy + hr * 0.95, hr * 0.5], [-hr * 0.15, cy + hr * 0.82, hr * 1.0], [-hr * 0.75, cy + hr * 0.3, hr * 0.85], 0.08, 0.015);
      spike(H, C.blondeD, [hr * 0.45, cy + hr * 0.85, hr * 0.62], [hr * 0.7, cy + hr * 0.45, hr * 0.95], [hr * 0.72, cy - hr * 0.1, hr * 0.85], 0.055, 0.012);
    }
    const hairGeo = H.prims.length ? meshBody(H, { cell: CELL_HAIR }) : null;
    heads[form] = { main: merge([skullGeo.clone(), hairGeo]), face: drawFace(id, ssj, hr) };
  }
  skullGeo.dispose();
  out.heads = heads;
  out.faceRect = [0, cy - hr * 0.12, hr * 1.9, hr * 1.9];

  /* ================= 軀幹 ================= */
  {
    const B = new Body();
    const top = { goku: C.gi, vegeta: C.suit, trunks: C.jacket, piccolo: C.pgi, frieza: skin, a18: C.stripeW }[id];
    const loose = id === 'goku' || id === 'piccolo' ? 1.07 : 1;
    // 腰
    B.add(ellip([0, T * 0.2, 0], [w * 1.12 * loose, T * 0.22, cz * 0.85 * loose]), top, { k: 0.04 });
    // 腹
    B.add(ellip([0, T * 0.42, cz * 0.1], [w * 1.08 * loose, T * 0.22, cz * 0.86 * loose]), top, { k: 0.06 });
    // 胸廓
    B.add(ellip([0, T * 0.66, -cz * 0.02], [cx * 1.0 * loose, T * 0.24, cz * 0.94 * loose]), top, { k: 0.07 });
    // 胸肌
    for (const sx of [-1, 1]) B.add(ellip([sx * cx * 0.44, T * 0.71, cz * 0.32], [cx * 0.56 * loose, T * 0.12, cz * 0.46 * loose], [0.18, 0, sx * 0.1]), top, { k: 0.05 });
    // 背闊肌
    for (const sx of [-1, 1]) B.add(ellip([sx * cx * 0.62, T * 0.58, -cz * 0.2], [cx * 0.4 * loose, T * 0.22, cz * 0.55 * loose], [0, 0, sx * 0.25]), top, { k: 0.05 });
    // 斜方肌與肩
    for (const sx of [-1, 1]) {
      B.add(cone([sx * 0.04, T + 0.03, -0.015], [sx * d.sw * 0.8, T * 0.9, -0.01], hr * 0.32, d.arm * 1.05), top, { k: 0.05 });
      B.add(sphere([sx * d.sw, T - 0.05, 0], d.arm * 1.32 * loose), top, { k: 0.05 });
    }
    // 頸
    const neckC = id === 'vegeta' ? C.suit : id === 'a18' ? C.stripeB : skin;
    B.add(cone([0, T - 0.05, 0], [0, T + 0.1, 0.012], hr * 0.34, hr * 0.3), neckC, { k: 0.03 });
    if (id === 'goku' || id === 'piccolo') {
      // 交領道服：V 領露出內衫／胸口（塗色區），領口一圈深色滾邊
      const inner = id === 'goku' ? C.blue : skin, trim = id === 'goku' ? C.giD : C.pgiD, y0 = T * (id === 'goku' ? 0.52 : 0.58), kv = id === 'goku' ? 0.24 : 0.3, ytop = T + 0.07;
      B.add(region((x, y, z) => Math.max(Math.abs(x) - (y - y0) * kv, -z, y - ytop), [-0.3, y0, -0.1], [0.3, ytop, 0.4]), inner, { paint: true, bias: -0.004 });
      if (id === 'goku') {
        B.add(region((x, y, z) => Math.max(Math.hypot(x, y - T * 0.64) - 0.07, z + cz * 0.3), [-0.1, T * 0.5, -0.4], [0.1, T * 0.8, 0]), 0xf6f0e2, { paint: true, bias: -0.02 });
      }
    }
    if (id === 'vegeta') {
      // 白色胸甲：加厚的殼＋塗色區保證整片白，腋下露出藍色緊身衣；金黃肩片
      B.add(ellip([0, T * 0.64, 0], [cx * 1.06, T * 0.29, cz * 1.12]), C.armor, { mat: 2, k: 0.03 });
      B.add(ellip([0, T * 0.4, cz * 0.04], [w * 1.14, T * 0.17, cz * 0.96]), C.armor, { mat: 2, k: 0.04 });
      B.add(region((x, y, z) => Math.max(y - T * 0.9, T * 0.3 - y, Math.abs(x) - cx * 0.98 + Math.max(0, y - T * 0.75) * 0.6), [-0.4, T * 0.25, -0.3], [0.4, T * 0.95, 0.3]), C.armor, { paint: true, bias: -0.04, mat: 2 });
      B.add(region((x, y, z) => Math.max(Math.abs(y - T * 0.31) - 0.012, -z), [-0.4, T * 0.25, -0.3], [0.4, T * 0.4, 0.3]), 0xd8d2c4, { paint: true, bias: -0.05, mat: 2 });
      for (const sx of [-1, 1]) B.add(rbox([sx * d.sw * 0.98, T * 0.93, 0], [d.arm * 1.3, 0.016, d.arm * 1.35], 0.012, [0, 0, -sx * 0.42]), C.ochre, { mat: 2, k: 0.012 });
    }
    if (id === 'frieza') {
      B.add(ellip([0, T * 0.72, cz * 0.18], [cx * 0.92, T * 0.16, cz * 0.85]), C.dome, { mat: 2, k: 0.015 });
      for (const sx of [-1, 1]) B.add(ellip([sx * d.sw, T - 0.03, 0], [d.arm * 1.55, d.arm * 1.3, d.arm * 1.5]), C.dome, { mat: 2, k: 0.015 });
    }
    if (id === 'a18') {
      B.add(stripes(0.09, (x, y, z) => Math.max(Math.abs(x) - cx * 0.22, -z, y - T * 0.98)), C.stripeB, { paint: true, bias: -0.004 });
      // 牛仔背心（前開）
      B.add(ellip([0, T * 0.6, -cz * 0.04], [cx * 1.1, T * 0.38, cz * 1.05]), C.denim, { k: 0.02 });
      for (const sx of [-1, 1]) B.add(ellip([sx * d.sw * 0.82, T * 0.9, 0], [d.arm * 1.5, d.arm * 0.9, d.arm * 1.6]), C.denim, { k: 0.02 });
      B.add(rbox([0, T * 0.6, cz * 0.98], [cx * 0.24, T * 0.32, 0.03], 0.01), 0, { sub: true, k: 0.015 });
    }
    if (id === 'trunks') {
      // 短夾克：下擺與立領
      B.add(ellip([0, T * 0.62, -cz * 0.03], [cx * 1.07, T * 0.3, cz * 1.04]), C.jacket, { k: 0.02 });
      B.add(rbox([0, T * 0.58, cz * 0.98], [cx * 0.2, T * 0.34, 0.03], 0.01), 0, { sub: true, k: 0.015 });
      B.add(torus([0, T + 0.02, 0.0], hr * 0.4, 0.022, [0.12, 0, 0]), C.jacket, { k: 0.015 });
    }
    out.torso = meshBody(B, {
      cell: CELL,
      paint: (x, y, z, nx, ny, nz, c, p) => {
        if (id === 'a18' && p && p.color.getHex() === C.denim && Math.abs(Math.abs(x) - cx * 0.48) < 0.008 && z > 0) c.set(C.denimD);
        if (id === 'trunks' && p && p.color.getHex() === C.jacket && Math.abs(Math.abs(x) - cx * 0.36) < 0.009 && z > 0) c.set(0x2e3658);
        if (id === 'frieza' && p && p.color.getHex() === skin && z > 0 && Math.abs(x) < 0.006 && y < T * 0.55 && y > T * 0.15) c.set(0xd8d2cc);
      },
    });
  }

  /* ================= 腰臀 ================= */
  {
    const B = new Body();
    const pc = { goku: C.gi, vegeta: C.suit, trunks: C.grey, piccolo: C.pgi, frieza: skin, a18: C.denim }[id];
    const loose = id === 'goku' || id === 'piccolo' ? 1.1 : 1;
    B.add(ellip([0, -0.02, 0], [d.hip * 1.42 * loose, d.hip * 1.0, d.hip * 1.08 * loose]), pc, { k: 0.04 });
    for (const sx of [-1, 1]) B.add(sphere([sx * d.hip * 0.62, -0.04, 0], d.thigh * 1.08 * loose), pc, { k: 0.05 });
    B.add(ellip([0, 0.08, 0], [w * 1.12 * loose, 0.06, cz * 0.86 * loose]), pc, { k: 0.04 });
    let sashC = null;
    if (id === 'goku') sashC = C.blue; if (id === 'piccolo') sashC = C.sash; if (id === 'trunks') sashC = 0x1a1a1a; if (id === 'a18') sashC = 0x5a3a22;
    if (sashC) B.add(ellip([0, 0.07, 0], [w * 1.2 * loose, id === 'goku' || id === 'piccolo' ? 0.05 : 0.025, cz * 0.94 * loose]), sashC, { k: 0.01 });
    if (id === 'goku' || id === 'piccolo') B.add(ellip([w * 0.7, 0.07, cz * 0.86], [0.04, 0.035, 0.028]), sashC, { k: 0.01 }); // 結
    if (id === 'trunks') B.add(rbox([0, 0.07, cz * 0.92], [0.024, 0.018, 0.008], 0.004), 0xa0a0a8, { mat: 2, k: 0.005 });
    if (id === 'vegeta') for (const sx of [-1, 1]) B.add(rbox([sx * d.hip * 0.92, -0.02, 0.01], [0.012, 0.09, d.hip * 0.9], 0.012, [0, 0, sx * 0.18]), C.ochre, { mat: 2, k: 0.012 });
    if (id === 'a18') { B.add(cone([0, 0.04, 0], [0, -0.17, 0], w * 1.2, d.hip * 1.55), C.denim, { k: 0.015 }); B.add(plane([0, -0.2, 0], [0, 1, 0]), C.denim, { sub: true, k: 0.01 }); }
    out.hips = meshBody(B, { cell: CELL });
  }

  /* ================= 手臂 ================= */
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const up = d.upper, lo = d.lower, a = d.arm, f = d.fore;
    {
      const B = new Body();
      const ac = { goku: skin, vegeta: C.suit, trunks: C.jacket, piccolo: skin, frieza: skin, a18: C.stripeW }[id];
      B.add(sphere([0, -0.005, 0], a * 1.32), ac, { k: 0.04 }); // 三角肌
      B.add(cone([0, -0.02, 0], [0, -up, 0], a * 1.12, a * 0.9), ac, { k: 0.05 });
      if (id !== 'a18' && id !== 'frieza' && id !== 'trunks') B.add(ellip([0, -up * 0.45, a * 0.32], [a * 0.82, up * 0.28, a * 0.72]), ac, { k: 0.04 }); // 二頭肌
      if (id === 'goku') B.add(cone([0, 0.0, 0], [0, -up * 0.42, 0], a * 1.36, a * 1.18), C.blue, { k: 0.01 }); // 內衫短袖
      if (id === 'trunks') B.add(cone([0, 0.0, 0], [0, -up * 0.98, 0], a * 1.22, a * 1.06), C.jacket, { k: 0.01 });
      if (id === 'piccolo') B.add(region((x, y, z) => Math.hypot((x - sx * a * 0.7) / 1.0, (y + up * 0.45) / 2.6, (z - a * 0.1) / 0.9) - a * 0.5), C.pink, { paint: true, bias: -0.01 });
      if (id === 'frieza') B.add(ellip([0, -0.01, 0], [a * 1.4, a * 1.2, a * 1.4]), C.dome, { mat: 2, k: 0.01 });
      if (id === 'a18') B.add(stripes(0.08, (x, y, z) => y + 0.03), C.stripeB, { paint: true, bias: -0.004 });
      out['upper' + side] = meshBody(B, { cell: CELL_LIMB * 1.05 });
    }
    {
      const B = new Body();
      const hy = -lo - d.fist * 0.6;
      const fc = { goku: skin, vegeta: C.suit, trunks: skin, piccolo: skin, frieza: skin, a18: C.stripeW }[id];
      B.add(sphere([0, 0, 0], f * 1.12), fc, { k: 0.03 });
      B.add(ellip([0, -lo * 0.28, f * 0.12], [f * 1.18, lo * 0.3, f * 1.05]), fc, { k: 0.05 }); // 前臂肌
      B.add(cone([0, 0, 0], [0, -lo, 0], f * 1.02, f * 0.78), fc, { k: 0.04 });
      // 拳頭（另外用細格建）：手掌、四根指節、拇指
      const hc = id === 'vegeta' ? C.armor : skin;
      const fi = d.fist, Hd = new Body();
      Hd.add(cone([0, hy + fi * 0.62, 0], [0, hy + fi * 0.2, 0.0], f * 0.8, fi * 0.5), hc, { k: 0.02 }); // 手腕到掌
      Hd.add(rbox([0, hy + fi * 0.04, 0.0], [fi * 0.24, fi * 0.26, fi * 0.18], fi * 0.36), hc, { k: 0.03 });
      for (let i = 0; i < 4; i++) {
        const fx = (i - 1.5) * fi * 0.27;
        Hd.add(cone([fx, hy - fi * 0.22, fi * 0.05], [fx, hy - fi * 0.38, fi * 0.36], fi * 0.15, fi * 0.14), hc, { k: 0.012 }); // 近節
        Hd.add(cone([fx, hy - fi * 0.38, fi * 0.36], [fx, hy - fi * 0.08, fi * 0.42], fi * 0.14, fi * 0.13), hc, { k: 0.012 }); // 往掌心捲
      }
      Hd.add(cone([sx * fi * 0.42, hy + fi * 0.1, fi * 0.12], [sx * fi * 0.1, hy - fi * 0.12, fi * 0.52], fi * 0.16, fi * 0.13), hc, { k: 0.02 });
      if (id === 'goku') B.add(cone([0, -lo * 0.58, 0], [0, -lo * 1.0, 0], f * 1.18, f * 1.08), C.blue, { k: 0.008 }); // 藍護腕
      if (id === 'vegeta') { B.add(cone([0, -lo * 0.52, 0], [0, -lo * 1.0, 0], f * 1.06, f * 0.92), C.armor, { k: 0.01 }); B.add(torus([0, -lo * 0.5, 0], f * 1.12, 0.014), C.armor, { k: 0.01 }); } // 白手套與袖口
      if (id === 'piccolo') { B.add(region((x, y, z) => Math.hypot(x - sx * f * 0.75, (y + lo * 0.4) / 2.4, z - f * 0.15) - f * 0.48), C.pink, { paint: true, bias: -0.01 }); B.add(cone([0, -lo * 0.8, 0], [0, -lo * 0.97, 0], f * 1.04, f * 0.96), 0x9a2a2a, { k: 0.006 }); }
      if (id === 'frieza') B.add(ellip([0, -lo * 0.42, -f * 0.1], [f * 1.25, lo * 0.4, f * 1.2]), C.dome, { mat: 2, k: 0.012 });
      if (id === 'trunks') B.add(cone([0, -lo * 0.86, 0], [0, -lo * 1.0, 0], f * 1.05, f * 1.0), 0x1a1a1a, { k: 0.006 });
      if (id === 'a18') B.add(stripes(0.08, (x, y, z) => -lo * 0.94 - y), C.stripeB, { paint: true, bias: -0.004 });
      out['fore' + side] = merge([meshBody(B, { cell: CELL_LIMB }), meshBody(Hd, { cell: CELL_HAND })]);
    }
  }

  /* ================= 腿 ================= */
  for (const side of ['L', 'R']) {
    const pc = { goku: C.gi, vegeta: C.suit, trunks: C.grey, piccolo: C.pgi, frieza: skin, a18: C.legging }[id];
    const loose = id === 'goku' || id === 'piccolo' ? 1.32 : id === 'trunks' ? 1.08 : 1;
    const th = d.thigh, sh = d.shin, TL = d.thighLen, SL = d.shinLen;
    {
      const B = new Body();
      B.add(sphere([0, -0.01, 0], th * 1.08 * loose), pc, { k: 0.04 });
      B.add(ellip([0, -TL * 0.38, th * 0.12], [th * 1.05 * loose, TL * 0.42, th * 1.05 * loose]), pc, { k: 0.06 });
      B.add(cone([0, -0.02, 0], [0, -TL, 0], th * 1.0 * loose, sh * 1.12 * loose), pc, { k: 0.05 });
      if (id === 'a18') B.add(ellip([0, -0.02, 0], [th * 1.25, TL * 0.16, th * 1.2]), C.denim, { k: 0.01 }); // 裙擺下緣
      out['thigh' + side] = meshBody(B, { cell: CELL * 0.95 });
    }
    {
      const B = new Body();
      B.add(sphere([0, 0, 0], sh * 1.12 * loose), pc, { k: 0.03 });
      B.add(ellip([0, -SL * 0.28, -sh * 0.25], [sh * 1.05 * loose, SL * 0.25, sh * 1.0 * loose]), pc, { k: 0.06 }); // 小腿肚
      B.add(cone([0, 0, 0], [0, -SL * 0.95, 0], sh * 1.0 * loose, sh * 0.72 * Math.min(loose, 1.15)), pc, { k: 0.05 });
      const boot = (c, shaftTop, toeC = c, trim = null, shaftR = 1.22) => {
        B.add(cone([0, -SL * shaftTop, 0], [0, -SL * 0.95, 0.0], sh * shaftR, sh * shaftR * 0.92), c, { k: 0.015 });
        B.add(rbox([0, -SL - 0.012, sh * 0.6], [sh * 0.82, 0.04, sh * 1.55], 0.035), toeC, { k: 0.04 });
        B.add(ellip([0, -SL - 0.005, sh * 1.6], [sh * 0.85, 0.05, sh * 0.8]), toeC, { k: 0.03 });
        if (trim != null) B.add(torus([0, -SL * shaftTop, 0], sh * shaftR * 1.0, 0.014), trim, { k: 0.006 });
      };
      if (id === 'goku') boot(C.blueD, 0.55, C.blueD, C.red);
      else if (id === 'vegeta') boot(C.armor, 0.55, C.ochre);
      else if (id === 'trunks') boot(0xdcab30, 0.45, 0x3a2a1a);
      else if (id === 'piccolo') boot(C.brown, 0.78, C.brown, null, 1.1);
      else if (id === 'a18') boot(C.boot, 0.38, C.boot, 0x5a361e, 1.15);
      else if (id === 'frieza') {
        B.add(ellip([0, -SL * 0.45, sh * 0.42], [sh * 0.9, SL * 0.3, sh * 0.62]), C.dome, { mat: 2, k: 0.012 });
        for (const tx of [-1, 0, 1]) B.add(cone([tx * sh * 0.35, -SL - 0.01, sh * 0.3], [tx * sh * 0.55, -SL - 0.02, sh * 1.6], sh * 0.32, sh * 0.18), skin, { k: 0.02 });
        B.add(ellip([0, -SL, 0.0], [sh * 0.85, 0.04, sh * 1.0]), skin, { k: 0.03 });
      }
      out['shin' + side] = meshBody(B, {
        cell: CELL_LIMB * 1.05,
        paint: (x, y, z, nx, ny, nz, c, p) => {
          // 悟空靴：前面的黃色鞋帶
          if (id === 'goku' && z > sh * 0.9 && Math.abs(x) < 0.012 && y < -SL * 0.6 && y > -SL * 0.98) c.set(C.yellow);
        },
      });
    }
  }

  /* ================= 次級擺動 ================= */
  const flap = (c, wid, len, thick = 0.016) => { const B = new Body(); B.add(rbox([0, -len / 2, 0], [wid / 2, len / 2, thick / 2], 0.008), c, { k: 0 }); return meshBody(B, { cell: 0.01 }); };
  if (id === 'goku') out.sash = [flap(C.blue, 0.06, 0.18), flap(C.blue, 0.055, 0.16)];
  if (id === 'piccolo') out.sash = [flap(C.sash, 0.08, 0.2), flap(C.sash, 0.07, 0.18)];
  if (id === 'frieza') {
    out.tail = [0, 1, 2, 3, 4].map((i) => {
      const B = new Body(), r0 = 0.066 - i * 0.01, r1 = 0.066 - (i + 1) * 0.01;
      B.add(cone([0, 0, 0], [0, -0.2, 0], r0, Math.max(0.012, r1)), i === 4 ? C.dome : skin, { k: 0.01, mat: i === 4 ? 2 : 0 });
      B.add(sphere([0, 0, 0], r0 * 1.02), i === 4 ? C.dome : skin, { k: 0.01, mat: i === 4 ? 2 : 0 });
      if (i === 4) B.add(cone([0, -0.2, 0], [0, -0.3, 0], 0.016, 0.003), C.dome, { k: 0.01, mat: 2 });
      return meshBody(B, { cell: 0.01 });
    });
  }
  if (id === 'trunks') {
    // 劍：握把在原點，刃沿 +y
    const B = new Body();
    B.add(cone([0, -0.1, 0], [0, 0.1, 0], 0.017, 0.019), C.hilt, { k: 0.005 });
    B.add(sphere([0, -0.115, 0], 0.025), C.brass, { mat: 2, k: 0.005 });
    B.add(rbox([0, 0.115, 0], [0.065, 0.012, 0.022], 0.008), C.brass, { mat: 2, k: 0.005 });
    B.add(rbox([0, 0.58, 0], [0.022, 0.44, 0.004], 0.003), C.steel, { mat: 2, k: 0.004 });
    B.add(cone([0, 1.0, 0], [0, 1.08, 0], 0.016, 0.002), C.steel, { mat: 2, k: 0.01 });
    out.sword = meshBody(B, { cell: 0.006 });
    const Q = new Body();
    Q.add(rbox([0, 0.6, 0], [0.032, 0.47, 0.016], 0.01), C.sheath, { k: 0.005 });
    Q.add(rbox([0, 0.16, 0], [0.038, 0.022, 0.02], 0.008), C.brass, { mat: 2, k: 0.004 });
    Q.add(rbox([0, 1.05, 0], [0.038, 0.026, 0.02], 0.008), C.brass, { mat: 2, k: 0.004 });
    out.sheath = meshBody(Q, { cell: 0.009 });
  }
  return out;
}

/* ---------------- 臉（canvas 貼花） ---------------- */
// 畫布座標：中心對應 faceRect 的中心，邊長 = 1.9 hr；上方是頭頂
const FACE = {
  goku: { iris: '#2a1d16', irisL: '#4a3426', brow: '#1a1614', browTilt: 0.18, eyeW: 0.3, eyeH: 0.17, eyeX: 0.36, eyeY: 0.06, sharp: 0.55, mouth: 'grin' },
  vegeta: { iris: '#20160f', irisL: '#3a2a20', brow: '#1a1614', browTilt: 0.42, eyeW: 0.29, eyeH: 0.13, eyeX: 0.35, eyeY: 0.06, sharp: 0.9, mouth: 'frown' },
  trunks: { iris: '#3b5fb5', irisL: '#7fa2e6', brow: '#8a74c0', browTilt: 0.12, eyeW: 0.3, eyeH: 0.17, eyeX: 0.36, eyeY: 0.06, sharp: 0.5, mouth: 'flat' },
  piccolo: { iris: '#1a120c', irisL: '#1a120c', brow: '#2f6a1e', browTilt: 0.45, eyeW: 0.3, eyeH: 0.13, eyeX: 0.36, eyeY: 0.08, sharp: 0.95, mouth: 'frown', noPupil: true, sclera: '#fffbe8' },
  frieza: { iris: '#d0203a', irisL: '#ff6a7a', brow: null, browTilt: 0, eyeW: 0.3, eyeH: 0.16, eyeX: 0.35, eyeY: 0.07, sharp: 0.85, mouth: 'smirk', lips: '#3a1838', lid: '#4a1a40' },
  a18: { iris: '#4c98d6', irisL: '#a6d6ff', brow: '#c9a24a', browTilt: 0.05, eyeW: 0.32, eyeH: 0.2, eyeX: 0.36, eyeY: 0.06, sharp: 0.3, mouth: 'lips', lashes: true },
};
function drawFace(id, ssj, hr) {
  if (typeof document === 'undefined') return null;
  const f = { ...FACE[id] };
  if (ssj) { f.iris = '#1a9a8a'; f.irisL = '#7ff0dc'; f.brow = '#d8a82a'; f.browTilt += 0.12; f.sharp += 0.15; }
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const S = N; // 單位：hr*1.9 → N
  const X = (u) => N / 2 + (u / 1.9) * S, Y = (v) => N / 2 - ((v + 0.12) / 1.9) * S; // v 以 hr 為單位、相對頭心
  const ink = f.lid || '#1a110c';
  for (const sx of [-1, 1]) {
    const ex = X(sx * f.eyeX), ey = Y(f.eyeY), ew = (f.eyeW / 1.9) * S, eh = (f.eyeH / 1.9) * S;
    g.save(); g.translate(ex, ey); g.scale(sx, 1);
    // 眼形：內眼角低、外眼角上揚（杏仁形）
    const shape = () => {
      g.beginPath();
      g.moveTo(-ew * 0.55, eh * 0.15);
      g.bezierCurveTo(-ew * 0.35, -eh * (0.75 + f.sharp * 0.1), ew * 0.35, -eh * (0.85 + f.sharp * 0.25), ew * 0.6, -eh * (0.2 + f.sharp * 0.45));
      g.bezierCurveTo(ew * 0.45, eh * 0.55, -ew * 0.3, eh * 0.65, -ew * 0.55, eh * 0.15);
      g.closePath();
    };
    shape(); g.fillStyle = f.sclera || '#fdfbf6'; g.fill();
    g.save(); shape(); g.clip();
    if (!f.noPupil) {
      // 虹膜：上深下亮的漸層、瞳孔、兩點反光
      const ir = eh * 0.95, ix = -ew * 0.02, iy = eh * 0.08;
      const gr = g.createLinearGradient(0, iy - ir, 0, iy + ir);
      gr.addColorStop(0, f.iris); gr.addColorStop(1, f.irisL);
      g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, ir * 0.78, ir, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(10,6,4,.85)'; g.beginPath(); g.ellipse(ix, iy + ir * 0.1, ir * 0.36, ir * 0.48, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix + ir * 0.28, iy - ir * 0.38, ir * 0.22, ir * 0.26, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(ix - ir * 0.3, iy + ir * 0.45, ir * 0.1, ir * 0.1, 0, 0, Math.PI * 2); g.fill();
    }
    // 上眼瞼的陰影
    g.fillStyle = 'rgba(80,50,40,.25)'; g.fillRect(-ew, -eh * 2, ew * 2, eh * 1.55);
    g.restore();
    // 上眼線：粗、外側延伸上挑
    g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = eh * 0.32;
    g.beginPath(); g.moveTo(-ew * 0.6, eh * 0.05);
    g.bezierCurveTo(-ew * 0.35, -eh * (0.82 + f.sharp * 0.1), ew * 0.35, -eh * (0.92 + f.sharp * 0.25), ew * 0.72, -eh * (0.25 + f.sharp * 0.5));
    g.stroke();
    if (f.lashes) { g.lineWidth = eh * 0.16; g.beginPath(); g.moveTo(ew * 0.55, -eh * 0.5); g.lineTo(ew * 0.85, -eh * 0.65); g.moveTo(ew * 0.62, -eh * 0.25); g.lineTo(ew * 0.88, -eh * 0.25); g.stroke(); }
    // 下眼線（細、只畫外側）
    g.lineWidth = eh * 0.1; g.beginPath(); g.moveTo(ew * 0.1, eh * 0.55); g.quadraticCurveTo(ew * 0.42, eh * 0.45, ew * 0.58, -eh * 0.05); g.stroke();
    // 眉毛：粗而銳利，往眉心壓低
    if (f.brow) {
      g.fillStyle = f.brow;
      const by = -eh * 1.55, tilt = f.browTilt;
      g.beginPath();
      g.moveTo(-ew * 0.62, by + eh * (0.25 + tilt * 1.6));
      g.quadraticCurveTo(0, by - eh * 0.55 + eh * tilt * 0.6, ew * 0.75, by - eh * (0.2 + tilt * 0.4));
      g.lineTo(ew * 0.55, by + eh * (0.12 - tilt * 0.2));
      g.quadraticCurveTo(0, by - eh * 0.1 + eh * tilt * 0.9, -ew * 0.62, by + eh * (0.6 + tilt * 1.6));
      g.closePath(); g.fill();
    }
    g.restore();
  }
  // 鼻：側面一筆陰影
  g.strokeStyle = 'rgba(120,60,40,.55)'; g.lineWidth = S * 0.008; g.lineCap = 'round';
  g.beginPath(); g.moveTo(X(0.05), Y(-0.18)); g.quadraticCurveTo(X(0.09), Y(-0.3), X(0.03), Y(-0.34)); g.stroke();
  // 嘴
  const my = Y(-0.6), mw = S * 0.07;
  g.strokeStyle = f.lips || '#5a2a1e'; g.lineWidth = S * 0.011;
  g.beginPath();
  if (f.mouth === 'grin') { g.moveTo(X(0) - mw, my - S * 0.004); g.quadraticCurveTo(X(0), my + S * 0.02, X(0) + mw, my - S * 0.012); }
  else if (f.mouth === 'frown') { g.moveTo(X(0) - mw * 0.8, my + S * 0.008); g.quadraticCurveTo(X(0), my - S * 0.008, X(0) + mw * 0.8, my + S * 0.008); }
  else if (f.mouth === 'smirk') { g.moveTo(X(0) - mw * 0.7, my); g.quadraticCurveTo(X(0) + mw * 0.2, my + S * 0.01, X(0) + mw * 0.85, my - S * 0.018); }
  else if (f.mouth === 'lips') { g.strokeStyle = '#c87a78'; g.moveTo(X(0) - mw * 0.6, my); g.quadraticCurveTo(X(0), my + S * 0.012, X(0) + mw * 0.6, my); }
  else { g.moveTo(X(0) - mw * 0.7, my); g.lineTo(X(0) + mw * 0.7, my); }
  g.stroke();
  if (id === 'frieza') { g.strokeStyle = 'rgba(60,20,50,.6)'; g.lineWidth = S * 0.006; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.22), Y(-0.05)); g.quadraticCurveTo(X(sx * 0.25), Y(-0.2), X(sx * 0.18), Y(-0.32)); g.stroke(); } }
  if (id === 'piccolo') { g.strokeStyle = 'rgba(40,90,25,.6)'; g.lineWidth = S * 0.008; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.4), Y(-0.28)); g.lineTo(X(sx * 0.3), Y(-0.5)); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
