// 隨等級變化的店面擺設：未開設的鐵捲門與出租牌、雨棚與招牌、Lv2 外帶座位、Lv3 屋頂看板與燈串；
// 海灘商家則是小屋、傘位、衝浪板架與碼頭售票亭。每家店一個網格，升級時整個重建。
import * as THREE from 'three';
import { Builder, prng, T } from './geo.js';
import { CITY_LOTS, lotRect, stackOf, BEACH, umbrellaSlot, SAND_Y, DECK_Y, UMBRELLA_MAX } from './layout.js';
import { PAL, lotFloors, bench, building } from './world.js';
import { interior, roomOf } from './interior.js';
import { BIZ_BY_ID } from './data.js';

const TBOX = T.box;
const matS = new THREE.MeshLambertMaterial({ vertexColors: true });
export const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.75, 0.75, 0.72) });
const UMB = ['#c8453c', '#2f7f8f', '#d9a63e', '#2d5a45', '#e07a5f', '#5f8790'];

export function createDecor(scene) {
  const meshes = {};
  return {
    set(id, lv) {
      if (meshes[id]) {
        for (const m of meshes[id]) { scene.remove(m); m.geometry.dispose(); }
      }
      const S = new Builder(), B = new Builder();
      const def = BIZ_BY_ID[id];
      const rnd = prng(id.length * 97 + lv);
      if (def.zone === 'city') cityShop(S, B, id, lv, def.color, rnd);
      else BEACH_DECOR[id](S, B, lv, def.color, rnd);
      const list = [];
      if (!S.empty) list.push(S.mesh(matS));
      if (!B.empty) list.push(B.mesh(glowMat, { cast: false, receive: false }));
      for (const m of list) scene.add(m);
      meshes[id] = list;
    },
    setNight(k) {
      glowMat.color.setRGB(0.75 + 0.25 * k, 0.75 + 0.25 * k, 0.72 + 0.2 * k);
    },
  };
}

function stripes(S, x0, x1, y, z, depth, drop, color, n = 0) {
  // 斜雨棚：交錯色條
  const w = x1 - x0;
  const cnt = n || Math.max(4, Math.round(w / 1.1));
  const sw = w / cnt;
  const ang = Math.atan2(drop, depth);
  const len = Math.hypot(drop, depth);
  for (let k = 0; k < cnt; k++) {
    S.add(TBOX, x0 + (k + 0.5) * sw, y - drop / 2 - 0.04, z + depth / 2, sw + 0.01, 0.1, len, 0, k % 2 ? PAL.cream : color, ang);
  }
  // 垂邊
  for (let k = 0; k < cnt; k++) S.box(x0 + k * sw, y - drop - 0.35, z + depth - 0.05, x0 + (k + 1) * sw, y - drop, z + depth + 0.03, k % 2 ? PAL.cream : color, true);
}

function cityShop(S, B, id, lv, color, rnd) {
  const [c, r, side] = CITY_LOTS[id];
  const rr = lotRect(c, r, side);
  // 已開設，或疊樓建築的任一層（空樓層畫成待租的空樓板）都用剖面室內
  if (lv > 0 || stackOf(id).floors > 1) { interior(S, B, id, lv, color); return; }
  // 未開設：兩層樓店屋，一樓鐵捲門＋出租牌
  const R = roomOf(id);
  building(S, S, S, rnd, { x0: rr.x0, x1: rr.x1, z0: R.z0, z1: rr.z1, floors: lotFloors(c, r, side), wall: R.wall, shop: true });
  const z1 = rr.z1, x0 = rr.x0 + 0.6, x1 = rr.x1 - 0.6, cx = (rr.x0 + rr.x1) / 2;
  S.box(x0 + 0.3, 0.55, z1 + 0.12, x1 - 0.3, 3.05, z1 + 0.26, '#9aa19c', true);
  for (let y = 0.8; y < 3.0; y += 0.32) S.box(x0 + 0.3, y, z1 + 0.26, x1 - 0.3, y + 0.05, z1 + 0.29, '#848b86', true);
  S.box(cx - 1.4, 1.6, z1 + 0.29, cx + 1.4, 2.7, z1 + 0.34, PAL.white, true);
  S.box(cx - 1.2, 1.9, z1 + 0.34, cx + 1.2, 2.4, z1 + 0.37, PAL.red, true);
}

// ───────── 海灘商家 ─────────
function hut(S, x, z, w, d, h, wall, roof, open) {
  S.box(x - w / 2, SAND_Y, z - d / 2, x + w / 2, SAND_Y + 0.3, z + d / 2, PAL.wood2);
  S.box(x - w / 2 + 0.2, SAND_Y + 0.3, z - d / 2 + 0.2, x + w / 2 - 0.2, SAND_Y + h, z + d / 2 - 0.2, wall);
  S.add(T.prism, x, SAND_Y + h, z, w + 0.8, 1.5, d + 0.8, 0, roof);
  if (open) {
    S.box(x - w / 2 + 0.8, SAND_Y + 1.1, z + d / 2 - 0.2, x + w / 2 - 0.8, SAND_Y + h - 0.4, z + d / 2 - 0.1, '#3e3226', true);
    S.box(x - w / 2 + 0.6, SAND_Y + 1.0, z + d / 2 - 0.2, x + w / 2 - 0.6, SAND_Y + 1.15, z + d / 2 + 0.5, PAL.wood);
  } else {
    for (let y = SAND_Y + 1.1; y < SAND_Y + h - 0.4; y += 0.35) S.box(x - w / 2 + 0.8, y, z + d / 2 - 0.2, x + w / 2 - 0.8, y + 0.28, z + d / 2 - 0.08, PAL.woodDark, true);
  }
}

function forLease(S, x, z) {
  S.box(x - 0.06, SAND_Y, z - 0.06, x + 0.06, 1.9, z + 0.06, PAL.woodDark);
  S.box(x - 0.9, 1.2, z, x + 0.9, 2.1, z + 0.08, PAL.white, true);
  S.box(x - 0.7, 1.45, z + 0.08, x + 0.7, 1.85, z + 0.11, PAL.red, true);
}

function picnic(S, x, z) {
  S.box(x - 1.1, SAND_Y + 0.7, z - 0.45, x + 1.1, SAND_Y + 0.8, z + 0.45, PAL.wood);
  for (const s of [-0.85, 0.85]) S.box(x - 1.1, SAND_Y + 0.4, z + s - 0.18, x + 1.1, SAND_Y + 0.48, z + s + 0.18, PAL.wood);
  for (const s of [-0.9, 0.9]) S.box(x + s - 0.08, SAND_Y, z - 1, x + s + 0.08, SAND_Y + 0.7, z + 1, PAL.woodDark);
}

function flag(S, x, z, h, color) {
  S.cyl(x, SAND_Y, z, 0.06, h, PAL.white, 6);
  S.box(x + 0.06, h - 1.1, z - 0.03, x + 1.5, h - 0.2, z + 0.03, color);
}

export function lounger(S, x, z, cushion) {
  S.box(x - 0.35, SAND_Y + 0.25, z - 0.9, x + 0.35, SAND_Y + 0.35, z + 0.9, PAL.white);
  S.add(TBOX, x, SAND_Y + 0.3, z - 0.75, 0.7, 0.1, 0.8, 0, PAL.white, 0.7);
  S.box(x - 0.3, SAND_Y + 0.35, z - 0.4, x + 0.3, SAND_Y + 0.4, z + 0.85, cushion);
  for (const sz of [-0.8, 0.8]) S.box(x - 0.32, SAND_Y, z + sz - 0.04, x + 0.32, SAND_Y + 0.25, z + sz + 0.04, PAL.white);
}

function parasol(S, x, z, color) {
  S.cyl(x, SAND_Y, z, 0.05, 2.5, PAL.white, 6);
  S.add(T.cone12, x, SAND_Y + 2.15, z, 3.4, 0.75, 3.4, 0, color);
  S.add(T.cone12, x, SAND_Y + 2.14, z, 3.4, 0.75, 3.4, Math.PI / 12, PAL.cream, 0, 0);
  S.ball(x, SAND_Y + 2.8, z, 0.1, PAL.white);
}

function surfboard(S, x, y, z, color, ry = 0, rx = 0) {
  S.add(T.ico, x, y, z, 0.55, 2.3, 0.14, ry, color, rx);
}

const BEACH_DECOR = {
  snack(S, B, lv, color) {
    const { x, z, w, d } = BEACH.snack;
    hut(S, x, z, w, d, 3.2, '#f0e4c4', lv ? color : '#8b7d68', lv > 0);
    if (!lv) { forLease(S, x + 4.6, z + 2.6); return; }
    stripes(S, x - w / 2 + 0.4, x + w / 2 - 0.4, SAND_Y + 3.0, z + d / 2 - 0.1, 1.2, 0.5, color, 6);
    S.box(x - 2.6, SAND_Y + 3.6, z + d / 2 + 0.2, x + 2.6, SAND_Y + 4.5, z + d / 2 + 0.45, PAL.cream, true);
    S.box(x - 2.3, SAND_Y + 3.8, z + d / 2 + 0.45, x + 2.3, SAND_Y + 4.3, z + d / 2 + 0.5, color, true);
    picnic(S, x - 5.5, z + 5.5);
    S.box(x + w / 2 + 0.2, SAND_Y, z - 1, x + w / 2 + 1.2, SAND_Y + 1.6, z + 0.4, '#5e8fa0');
    if (lv >= 2) {
      picnic(S, x + 5.5, z + 5.5);
      picnic(S, x, z + 8.5);
      parasol(S, x - 5.5, z + 5.5, color);
      flag(S, x - w / 2 - 0.8, z - 1, 5.2, color);
    }
    if (lv >= 3) {
      parasol(S, x + 5.5, z + 5.5, '#2f7f8f');
      parasol(S, x, z + 8.5, '#d9a63e');
      surfboard(S, x, SAND_Y + 4.6, z - 0.4, '#e07a5f', 0, Math.PI / 2);
      for (let k = -3; k <= 3; k++) B.ball(x + k * 1.1, SAND_Y + 2.45, z + d / 2 + 1.2, 0.11, '#ffe2a0');
      for (const s of [-2, 2]) S.cyl(x + s + 0.6, SAND_Y, z + d / 2 + 1.2, 0.18, 0.75, PAL.wood2, 6);
    }
  },
  umbrella(S, B, lv, color) {
    const cap = lv ? BIZ_BY_ID.umbrella.cap[lv - 1] : 0;
    // 售票亭
    const kx = -44, kz = 21.5;
    S.box(kx - 1.4, SAND_Y, kz - 1.1, kx + 1.4, SAND_Y + 2.2, kz + 1.1, lv ? '#f0e4c4' : '#a99d87');
    S.add(T.cone4, kx, SAND_Y + 2.2, kz, 4.2, 1.2, 3.6, 0, lv ? color : '#7c705e');
    if (!lv) {
      // 疊起來的躺椅與圍繩
      for (let k = 0; k < 4; k++) S.box(-34, SAND_Y + k * 0.25, 27, -32.6, SAND_Y + k * 0.25 + 0.18, 29, PAL.white);
      for (let k = 0; k < 6; k++) S.cyl(-38 + k * 6, SAND_Y, 22.5, 0.07, 0.9, PAL.woodDark, 6);
      S.box(-38, SAND_Y + 0.75, 22.47, -8, SAND_Y + 0.8, 22.53, '#d8c9a3');
      forLease(S, -30, 23);
      return;
    }
    S.box(kx - 1.3, SAND_Y + 0.9, kz + 1.1, kx + 1.3, SAND_Y + 1.0, kz + 1.6, PAL.wood);
    for (let k = 0; k < Math.min(cap, UMBRELLA_MAX); k++) {
      const p = umbrellaSlot(k);
      parasol(S, p.x, p.z, UMB[k % UMB.length]);
      lounger(S, p.x - 0.9, p.z + 0.3, k % 2 ? '#2f7f8f' : PAL.cream);
      lounger(S, p.x + 0.9, p.z + 0.3, k % 2 ? PAL.cream : '#c8453c');
      S.box(p.x - 0.25, SAND_Y, p.z - 0.25, p.x + 0.25, SAND_Y + 0.5, p.z + 0.25, '#4f7c8a');
    }
    if (lv >= 3) flag(S, kx + 2, kz, 5, color);
  },
  surf(S, B, lv, color) {
    const { x, z } = BEACH.surf;
    hut(S, x, z, 6, 4, 3, lv ? '#e8f0ea' : '#a2a08f', lv ? color : '#7c705e', lv > 0);
    if (!lv) { forLease(S, x + 4.2, z + 2.6); return; }
    // 衝浪板架
    const n = [0, 3, 5, 7][lv];
    S.box(x + 3.6, SAND_Y, z - 1.6, x + 3.8, SAND_Y + 2.2, z + 1.8, PAL.woodDark);
    S.box(x + 5.4, SAND_Y, z - 1.6, x + 5.6, SAND_Y + 2.2, z + 1.8, PAL.woodDark);
    const boardCols = ['#e07a5f', '#2f7f8f', '#d9a63e', '#f2e8cf', '#c0607a', '#5f8790', '#8ea488'];
    for (let k = 0; k < n; k++) surfboard(S, x + 4.6, SAND_Y + 0.2, z - 1.3 + k * 0.48, boardCols[k], Math.PI / 2, 0.15);
    S.box(x - 2.5, SAND_Y + 3.3, z + 2.05, x + 2.5, SAND_Y + 4.1, z + 2.3, color, true);
    S.box(x - 2.2, SAND_Y + 3.45, z + 2.3, x + 2.2, SAND_Y + 3.95, z + 2.35, PAL.cream, true);
    if (lv >= 2) {
      flag(S, x - 3.8, z, 5.4, color);
      surfboard(S, x - 3, SAND_Y + 0.15, z + 4.5, '#e07a5f', 0.4, Math.PI / 2);
      surfboard(S, x - 1, SAND_Y + 0.15, z + 4.8, '#2f7f8f', 0.2, Math.PI / 2);
    }
    if (lv >= 3) {
      parasol(S, x - 4, z + 6, color);
      lounger(S, x - 5, z + 6.4, PAL.cream);
      for (let k = -2; k <= 2; k++) B.ball(x + k * 1.1, SAND_Y + 2.6, z + 2.4, 0.11, '#ffe2a0');
    }
  },
  jetski(S, B, lv, color) {
    const { x, z } = BEACH.jetski;
    hut(S, x, z, 5.5, 4, 3, lv ? '#e9eef2' : '#a2a08f', lv ? color : '#7c705e', lv > 0);
    if (!lv) { forLease(S, x + 4, z + 2.6); return; }
    S.box(x - 2.3, SAND_Y + 3.3, z + 2.05, x + 2.3, SAND_Y + 4.1, z + 2.3, color, true);
    S.box(x - 2, SAND_Y + 3.45, z + 2.3, x + 2, SAND_Y + 3.95, z + 2.35, PAL.cream, true);
    // 救生衣架
    S.box(x + 3.2, SAND_Y, z - 0.5, x + 3.35, SAND_Y + 1.8, z + 0.5, PAL.metal);
    for (let k = 0; k < 3; k++) S.box(x + 3.35, SAND_Y + 0.8, z - 0.45 + k * 0.35, x + 3.6, SAND_Y + 1.5, z - 0.2 + k * 0.35, '#e0763a');
    if (lv >= 2) flag(S, x - 3.5, z + 1, 5.2, color);
    if (lv >= 3) {
      parasol(S, x + 4.5, z + 4.5, color);
      for (let k = -2; k <= 2; k++) B.ball(x + k * 1.1, SAND_Y + 2.6, z + 2.4, 0.11, '#ffe2a0');
    }
  },
  boat(S, B, lv, color) {
    const dk = BEACH.boat.deck;
    const hx = 11, hz = 21;
    // 平台上的售票小屋
    S.box(hx - 2.6, DECK_Y, hz - 2, hx + 2.6, DECK_Y + 2.8, hz + 2, lv ? '#e9efe6' : '#a2a08f');
    S.add(T.prism, hx, DECK_Y + 2.8, hz, 6.2, 1.4, 4.8, 0, lv ? color : '#7c705e');
    if (!lv) {
      S.box(hx - 1.8, DECK_Y + 0.8, hz + 2, hx + 1.8, DECK_Y + 2.2, hz + 2.1, PAL.woodDark, true);
      S.box(dk.x1 - 4, DECK_Y, 25.5, dk.x1 - 3.88, DECK_Y + 1.9, 25.62, PAL.woodDark);
      S.box(dk.x1 - 4.9, DECK_Y + 1.2, 25.6, dk.x1 - 3, DECK_Y + 2.1, 25.68, PAL.white, true);
      S.box(dk.x1 - 4.7, DECK_Y + 1.45, 25.68, dk.x1 - 3.2, DECK_Y + 1.85, 25.71, PAL.red, true);
      return;
    }
    S.box(hx - 1.8, DECK_Y + 1.0, hz + 2, hx + 1.8, DECK_Y + 2.2, hz + 2.1, '#3e5258', true);
    S.box(hx - 2.2, DECK_Y + 0.95, hz + 2, hx + 2.2, DECK_Y + 1.05, hz + 2.5, PAL.wood);
    stripes(S, hx - 2.6, hx + 2.6, DECK_Y + 2.6, hz + 2, 1.1, 0.4, color, 6);
    // 救生圈與纜繩樁
    for (const [lx, lz] of [[dk.x0 + 0.1, 23], [dk.x1 - 0.1, 23]]) S.add(T.cyl12, lx, DECK_Y + 0.4, lz, 0.9, 0.18, 0.9, 0, '#e0763a', Math.PI / 2, Math.PI / 2);
    S.box(24, DECK_Y, 19.5, 28, DECK_Y + 0.5, 21, PAL.wood2);
    if (lv >= 2) {
      bench(S, 24, DECK_Y, 24, 0);
      flag(S, dk.x1 - 1, 18.2, 6.2 + DECK_Y, color);
      flag(S, dk.x0 + 1, 18.2, 6.2 + DECK_Y, '#d9a63e');
    }
    if (lv >= 3) {
      // 第二座售票亭與燈串
      S.box(25, DECK_Y, 18, 28.5, DECK_Y + 2.4, 20.6, '#e9efe6');
      S.add(T.cone4, 26.75, DECK_Y + 2.4, 19.3, 4.8, 1.0, 3.6, 0, color);
      for (let k = 0; k < 16; k++) B.ball(16 + (k % 2 ? 4 : 0), DECK_Y + 1.6, 30 + Math.floor(k / 2) * 4, 0.12, '#ffe2a0');
    }
  },
};
