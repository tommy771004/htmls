// 地圖道具：樹（三種闊葉、松、灌木）、長苔的岩石、外圍岩壁與台地林、野區草叢與花、河岸蘆葦與睡蓮、
// 過河踏石、塔旁石燈籠、基地旗幟與晶柱、泉水、野怪營地石圈。全部 InstancedMesh，材質都套用戰爭迷霧。
import * as THREE from 'three';
import { OBSTACLES, LANES, STRUCTURES, BUSHES, heightAt, riverDist, distToLanes, pointAlong, rng, insideObstacle } from './map.js';
import { BASE, FOUNTAIN, TEAM_COLOR, TEAM_LIGHT, CAMPS as CAMPS_ALL, DRAGON } from './config.js';
const CAMPS_LIST = [...CAMPS_ALL, { x: DRAGON.pit.x, z: DRAGON.pit.z, boss: true }]; // 神龍坑和大猿石場一樣清空
import { patchFog } from './fog.js';

const polyLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; };

// 依高度上色（頂亮底暗），讓樹冠有體積
function shadeY(g, lo = 0.62, hi = 1) {
  g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = (p.getY(i) - b.min.y) / (b.max.y - b.min.y || 1), v = lo + (hi - lo) * k; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
// 岩石：頂面長苔（綠），側面灰褐
function mossRock(seed, mossy = true) {
  const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position, R = rng(seed);
  const keyed = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!keyed.has(k)) keyed.set(k, [0.82 + R() * 0.34, 0.55 + R() * 0.3, 0.82 + R() * 0.34]);
    const s = keyed.get(k); p.setXYZ(i, p.getX(i) * s[0], p.getY(i) * s[1], p.getZ(i) * s[2]);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3, moss = mossy && ny > 0.62;
    const col = moss ? [0.45, 0.62, 0.3] : [0.62, 0.58, 0.52];
    for (let k = 0; k < 3; k++) { c[(i + k) * 3] = col[0]; c[(i + k) * 3 + 1] = col[1]; c[(i + k) * 3 + 2] = col[2]; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export function buildProps(group, quality, { toon, mergeGeo }) {
  const Q = quality > 0 ? 1 : 0.45;
  const R = rng(4242);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), col = new THREE.Color();
  const patched = new WeakSet();
  const fogMat = (m) => { if (!patched.has(m)) { patched.add(m); patchFog(m); } return m; };
  const inst = (geom, mat, list, fn, shadow = true) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geom, fogMat(mat), list.length);
    list.forEach((t, i) => fn(t, i, im));
    im.castShadow = shadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im); return im;
  };
  const place = (t, s, im, i, yoff = 0, sy = 1, tilt = 0) => {
    e3.set(tilt * Math.sin(t.rot * 3), t.rot, tilt * Math.cos(t.rot * 2)); q.setFromEuler(e3); sc.set(s, s * sy, s);
    p3.set(t.x, heightAt(t.x, t.z) + yoff + (t.y0 || 0), t.z); m4.compose(p3, q, sc); im.setMatrixAt(i, m4);
  };
  const ok = (x, z, laneGap = 6, riverGap = 6) => Math.abs(x) < 89 && Math.abs(z) < 89 && distToLanes(x, z) > laneGap && riverDist(x, z) > riverGap && !insideObstacle(x, z, 0.2)
    && !BASE.some((b) => Math.hypot(x - b[0], z - b[1]) < 24) && !CAMPS_LIST.some((c) => Math.hypot(x - c.x, z - c.z) < (c.boss ? 10 : 4.5));

  /* ---------- 樹叢障礙物：岩台（石壁＋草頂），樹長在台上 ---------- */
  const broad = [[], [], []], pines = [], bushes = [], rocks = [], mesas = [];
  for (const o of OBSTACLES) {
    if (o.kind === 'rock') {
      rocks.push({ x: o.x, z: o.z, s: o.r * 0.95, rot: R() * 6, v: R() });
      const n = 1 + ((R() * 3) | 0);
      for (let k = 0; k < n; k++) { const a = R() * 6.28, d = o.r * (0.55 + R() * 0.4); rocks.push({ x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, s: o.r * (0.28 + R() * 0.3), rot: R() * 6, v: R() }); }
      for (let k = 0; k < 3; k++) { const a = R() * 6.28, d = o.r * (0.9 + R() * 0.3); bushes.push({ x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, s: 0.6 + R() * 0.4, rot: R() * 6, hue: R() }); }
    } else {
      const top = Math.min(2.6, 0.9 + o.r * 0.42) * (0.85 + R() * 0.3);
      mesas.push({ x: o.x, z: o.z, r: o.r, h: top, rot: R() * 6, v: R(), k: (R() * 3) | 0 });
      const n = Math.max(2, Math.round(o.r * o.r * 0.5));
      for (let k = 0; k < n; k++) {
        const a = R() * 6.28, d = Math.sqrt(R()) * Math.max(0, o.r - 1.3);
        const t = { x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, s: 0.8 + R() * 0.55, rot: R() * 6, hue: R(), y0: top - 0.15 };
        const pick = R();
        if (pick < 0.55) pines.push(t); else broad[(pick * 10 | 0) % 3].push(t);
      }
      const nb = 2 + ((o.r * 1.4) | 0);
      for (let k = 0; k < nb; k++) { const a = R() * 6.28, onTop = R() < 0.6, d = o.r * (onTop ? 0.62 + R() * 0.2 : 1.02 + R() * 0.15); bushes.push({ x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, s: 0.5 + R() * 0.45, rot: R() * 6, hue: R(), y0: onTop ? top - 0.1 : 0 }); }
    }
  }
  /* ---------- 外圍：岩壁＋台地林 ---------- */
  const cliffs = [], boulders = [];
  const perim = (fn, step) => { for (let t = -96; t <= 96; t += step) { fn(t, -1, 'z'); fn(t, 1, 'z'); fn(t, -1, 'x'); fn(t, 1, 'x'); } };
  perim((t, side, axis) => {
    const off = 92.4 + (R() - 0.5) * 1.6;
    const x = axis === 'z' ? t + (R() - 0.5) * 1.5 : side * off, z = axis === 'z' ? side * off : t + (R() - 0.5) * 1.5;
    if (riverDist(x, z) < 9.5) return;
    cliffs.push({ x, z, s: 1.9 + R() * 1.3, h: 6 + R() * 5, rot: R() * 6, v: R() });
    if (R() < 0.5) cliffs.push({ x: x * 1.03, z: z * 1.03, s: 1.6 + R() * 1.2, h: 8 + R() * 4, rot: R() * 6, v: R() });
    if (R() < 0.55) boulders.push({ x: x * 0.985, z: z * 0.985, s: 0.8 + R() * 0.9, rot: R() * 6, v: R() });
  }, quality > 0 ? 2.3 : 3.2);
  // 峽谷兩側的岩塊
  for (const sgn of [-1, 1]) for (let d = 131; d < 182; d += 2.6) for (const side of [-1, 1]) {
    const tx = sgn * d / Math.SQRT2, tz = sgn * d / Math.SQRT2, off = (8.6 + R() * 1.5) * side;
    cliffs.push({ x: tx + off / Math.SQRT2, z: tz - off / Math.SQRT2, s: 1.6 + R() * 1, h: 3 + R() * 3, rot: R() * 6, v: R() });
  }
  for (let i = 0; i < (quality > 0 ? 700 : 300); i++) {
    const t = (R() * 2 - 1) * 96, side = R() < 0.5 ? -1 : 1, axisZ = R() < 0.5, off = 94.5 + R() * 3.5;
    const x = axisZ ? t : side * off, z = axisZ ? side * off : t;
    if (riverDist(x, z) < 12) continue;
    bushes.push({ x, z, s: 0.9 + R() * 0.9, rot: R() * 6, hue: R(), y: 5.5 + R() * 2.5 });
  }
  const outer = quality > 0 ? 1500 : 700;
  for (let i = 0; i < outer; i++) {
    const x = (R() * 2 - 1) * 128, z = (R() * 2 - 1) * 128, e = Math.max(Math.abs(x), Math.abs(z));
    if (e < 96.5 || riverDist(x, z) < 12) continue;
    const t = { x, z, s: 1.05 + R() * 0.8 + Math.min(1, (e - 96) / 20) * 0.5, rot: R() * 6, hue: R() };
    const pick = R();
    if (pick < 0.5) pines.push(t); else broad[(pick * 10 | 0) % 3].push(t);
    if (R() < 0.25) bushes.push({ x: x + (R() - 0.5) * 3, z: z + (R() - 0.5) * 3, s: 0.9 + R() * 0.6, rot: R() * 6, hue: R() });
  }

  // 幾何
  const trunkG = new THREE.CylinderGeometry(0.17, 0.3, 2.2, 6); trunkG.translate(0, 1.1, 0);
  const crownA = shadeY(mergeGeo([[1.45, 0, 2.9, 0], [1.05, 0.8, 2.4, 0.4], [1.0, -0.7, 2.5, -0.35], [0.85, 0.1, 3.75, 0.1]].map(([r, x, y, z]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z))));
  const crownB = shadeY(mergeGeo([[1.05, 0, 2.7, 0, 1.25], [0.9, 0.15, 3.85, 0.05, 1.2], [0.7, -0.1, 4.75, 0, 1.1]].map(([r, x, y, z, sy]) => new THREE.IcosahedronGeometry(r, 1).scale(1, sy, 1).translate(x, y, z))));
  const crownC = shadeY(mergeGeo([[1.7, 0, 2.6, 0, 0.5], [1.35, 0.35, 3.3, -0.2, 0.5], [0.95, -0.2, 3.95, 0.15, 0.55], [1.0, -0.9, 2.75, 0.6, 0.5]].map(([r, x, y, z, sy]) => new THREE.IcosahedronGeometry(r, 1).scale(1, sy, 1).translate(x, y, z))));
  const pineG = shadeY(mergeGeo([0, 1, 2, 3].map((k) => new THREE.ConeGeometry(1.55 - k * 0.33, 1.6, 8).translate(0, 1.5 + k * 0.95, 0))), 0.6, 1.05);
  const bushG = shadeY(mergeGeo([[0.75, 0, 0.5, 0], [0.6, 0.55, 0.42, 0.2], [0.55, -0.5, 0.4, -0.15], [0.45, 0.1, 0.85, -0.1]].map(([r, x, y, z]) => new THREE.IcosahedronGeometry(r, 0).translate(x, y, z))), 0.55, 1);
  const trunkMat = toon('#6b4a2f');
  const allBroad = broad[0].concat(broad[1], broad[2]);
  inst(trunkG, trunkMat, allBroad, (t, i, im) => place(t, t.s, im, i));
  inst(trunkG, trunkMat, pines, (t, i, im) => place(t, t.s * 0.8, im, i));
  const crownTint = (t, i, im, h0, s0, l0) => { col.setHSL(h0 + t.hue * 0.08, s0 + t.hue * 0.12, l0 + t.hue * 0.1); im.setColorAt(i, col); };
  inst(crownA, toon('#ffffff', { vertexColors: true }), broad[0], (t, i, im) => { place(t, t.s, im, i); crownTint(t, i, im, 0.25, 0.34, 0.3); });
  inst(crownB, toon('#ffffff', { vertexColors: true }), broad[1], (t, i, im) => { place(t, t.s, im, i); crownTint(t, i, im, 0.3, 0.3, 0.27); });
  inst(crownC, toon('#ffffff', { vertexColors: true }), broad[2], (t, i, im) => { place(t, t.s, im, i); crownTint(t, i, im, 0.21, 0.36, 0.32); });
  inst(pineG, toon('#ffffff', { vertexColors: true }), pines, (t, i, im) => { place(t, t.s, im, i, 0, 1.12); col.setHSL(0.4 + t.hue * 0.05, 0.3, 0.21 + t.hue * 0.06); im.setColorAt(i, col); });
  inst(bushG, toon('#ffffff', { vertexColors: true }), bushes, (t, i, im) => { if (t.y !== undefined) { e3.set(0, t.rot, 0); q.setFromEuler(e3); sc.setScalar(t.s); p3.set(t.x, Math.max(t.y, heightAt(t.x, t.z)), t.z); m4.compose(p3, q, sc); im.setMatrixAt(i, m4); } else place(t, t.s, im, i); col.setHSL(0.25 + t.hue * 0.08, 0.38, 0.3 + t.hue * 0.1); im.setColorAt(i, col); });

  // 岩石（長苔）、岩壁、巨石
  const rockMat = toon('#ffffff', { vertexColors: true });
  // 岩台：半徑 1、高 1 的不規則石柱，側面分層石紋、頂面草地、頂緣一圈外凸的草唇；依障礙物半徑與高度縮放
  const mesaG = [0, 1, 2].map((seed) => {
    const RR = rng(900 + seed), SEG = 18, rows = [0, 0.18, 0.42, 0.66, 0.88, 1], A = SEG;
    const jit = Array.from({ length: A }, () => 0.82 + RR() * 0.16);
    const pos = [], colr = [];
    const ring = rows.map((y, r) => Array.from({ length: A }, (_, a) => {
      const ang = (a / A) * Math.PI * 2, lean = 1 - y * 0.08 + (r % 2 ? 0.035 : -0.02) + (RR() - 0.5) * 0.05;
      const rad = Math.min(0.99, jit[a] * lean * (r === rows.length - 1 ? 0.97 : 1));
      return [Math.cos(ang) * rad, y + (r === rows.length - 1 ? (RR() - 0.5) * 0.06 : 0), Math.sin(ang) * rad];
    }));
    const tri = (a, b, c, cc) => { pos.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) colr.push(...cc); };
    for (let r = 0; r < rows.length - 1; r++) for (let a = 0; a < A; a++) {
      const a2 = (a + 1) % A, p00 = ring[r][a], p01 = ring[r][a2], p10 = ring[r + 1][a], p11 = ring[r + 1][a2];
      const band = 0.8 + (r % 2) * 0.12 + RR() * 0.1, cc = [0.55 * band, 0.5 * band, 0.42 * band];
      tri(p00, p11, p01, cc); tri(p00, p10, p11, cc);
    }
    const topY = 1, cTop = [0, topY + 0.08, 0], last = ring[rows.length - 1];
    for (let a = 0; a < A; a++) { const g = 0.85 + RR() * 0.2; tri(cTop, last[(a + 1) % A], last[a], [0.3 * g, 0.42 * g, 0.18 * g]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.computeVertexNormals(); return g;
  });
  for (let k = 0; k < 3; k++) inst(mesaG[k], rockMat, mesas.filter((m) => m.k === k), (t, i, im) => { e3.set(0, t.rot, 0); q.setFromEuler(e3); sc.set(t.r, t.h, t.r); p3.set(t.x, heightAt(t.x, t.z) - 0.25, t.z); m4.compose(p3, q, sc); im.setMatrixAt(i, m4); col.setHSL(0.09, 0.1, 0.85 + t.v * 0.15); im.setColorAt(i, col); });
  inst(mossRock(11), rockMat, rocks, (t, i, im) => { place(t, t.s, im, i, t.s * 0.22); col.setHSL(0.08, 0.06, 0.82 + t.v * 0.18); im.setColorAt(i, col); });
  const cliffG = (() => {
    const g = new THREE.CylinderGeometry(0.85, 1.15, 1, 7, 3).toNonIndexed(), p = g.attributes.position, RR = rng(31), keyed = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      const top = p.getY(i) > 0.45;
      if (!keyed.has(k)) keyed.set(k, [0.78 + RR() * 0.45, top ? -0.28 + RR() * 0.3 : (RR() - 0.5) * 0.1]);
      const s = keyed.get(k); p.setXYZ(i, p.getX(i) * s[0] * (top ? 0.82 : 1), p.getY(i) + 0.5 + s[1], p.getZ(i) * s[0] * (top ? 0.82 : 1));
    }
    g.computeVertexNormals();
    const n = g.attributes.normal, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 3) {
      const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3, yy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const colr = ny > 0.6 ? [0.24, 0.36, 0.17] : [0.34 + yy * 0.2, 0.31 + yy * 0.17, 0.28 + yy * 0.13];
      for (let k = 0; k < 3; k++) c.set(colr, (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  })();
  inst(cliffG, rockMat, cliffs, (t, i, im) => { e3.set(0, t.rot, 0); q.setFromEuler(e3); sc.set(t.s, t.h, t.s); p3.set(t.x, -0.6, t.z); m4.compose(p3, q, sc); im.setMatrixAt(i, m4); col.setHSL(0.07, 0.08, 0.8 + t.v * 0.2); im.setColorAt(i, col); });
  inst(mossRock(23), rockMat, boulders, (t, i, im) => { place(t, t.s, im, i, t.s * 0.2); col.setHSL(0.08, 0.06, 0.78 + t.v * 0.2); im.setColorAt(i, col); });

  /* ---------- 野區草叢與小花、路邊草簇 ---------- */
  const tufts = [], flowers = [];
  for (let i = 0; i < 5200 * Q; i++) {
    const x = (R() * 2 - 1) * 88, z = (R() * 2 - 1) * 88;
    if (!ok(x, z, 6, 6)) continue;
    tufts.push({ x, z, s: 0.5 + R() * 0.7, rot: R() * 6, hue: R() });
    if (R() < 0.22) { const n = 2 + ((R() * 4) | 0), fc = (R() * 5) | 0; for (let k = 0; k < n; k++) flowers.push({ x: x + (R() - 0.5) * 1.2, z: z + (R() - 0.5) * 1.2, s: 0.8 + R() * 0.5, rot: R() * 6, c: fc }); }
  }
  for (const p of LANES) {
    const L = polyLen(p);
    for (let d = 0; d < L; d += 0.8 / Q) {
      const a = pointAlong(p, d), b = pointAlong(p, d + 0.5), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      for (const side of [-1, 1]) {
        if (R() < 0.25) continue;
        const off = 5.3 + R() * 1.8, x = a.x - (dz / l) * off * side, z = a.z + (dx / l) * off * side;
        if (riverDist(x, z) < 5.5 || insideObstacle(x, z, 0)) continue;
        tufts.push({ x, z, s: 0.45 + R() * 0.6, rot: R() * 6, hue: R() });
      }
    }
  }
  const tuftG = shadeY(mergeGeo([0, 1, 2, 3].map((k) => new THREE.ConeGeometry(0.11, 0.85, 3).rotateZ((k - 1.5) * 0.3).rotateY(k * 1.3).translate((k - 1.5) * 0.12, 0.38, 0))), 0.55, 1.15);
  inst(tuftG, toon('#ffffff', { vertexColors: true }), tufts, (t, i, im) => { place(t, t.s, im, i); col.setHSL(0.21 + t.hue * 0.07, 0.4, 0.38 + t.hue * 0.12); im.setColorAt(i, col); }, false);
  const FLOWER = ['#fff1b8', '#f6b19c', '#ffffff', '#f7d14c', '#ee9fc2'];
  const flowerG = mergeGeo([new THREE.IcosahedronGeometry(0.12, 0).translate(0, 0.32, 0), new THREE.CylinderGeometry(0.015, 0.015, 0.32, 3).translate(0, 0.16, 0)]);
  inst(flowerG, toon('#ffffff'), flowers, (t, i, im) => { place(t, t.s, im, i); col.set(FLOWER[t.c]); im.setColorAt(i, col); }, false);

  /* ---------- 河：蘆葦、睡蓮、過河踏石、大猿石場 ---------- */
  const reeds = [], lilies = [], steps = [], smooth = [];
  for (let i = 0; i < 900 * Q; i++) {
    const t = (R() * 2 - 1) * 128, side = R() < 0.5 ? -1 : 1, off = (5.3 + R() * 1.6) * side;
    const x = t / Math.SQRT2 + off / Math.SQRT2, z = t / Math.SQRT2 - off / Math.SQRT2;
    if (distToLanes(x, z) < 7.5 || Math.max(Math.abs(x), Math.abs(z)) > 120 || CAMPS_LIST.some((c) => Math.hypot(x - c.x, z - c.z) < 11)) continue;
    if (R() < 0.6) reeds.push({ x, z, s: 0.7 + R() * 0.6, rot: R() * 6, hue: R() });
  }
  for (let i = 0; i < 260 * Q; i++) {
    const t = (R() * 2 - 1) * 110, off = (R() * 2 - 1) * 4.2;
    const x = t / Math.SQRT2 + off / Math.SQRT2, z = t / Math.SQRT2 - off / Math.SQRT2;
    if (distToLanes(x, z) < 6.5 || CAMPS_LIST.some((c) => Math.hypot(x - c.x, z - c.z) < 9)) continue;
    const n = R() < 0.4 ? 3 : 1;
    for (let k = 0; k < n; k++) lilies.push({ x: x + (R() - 0.5) * 1.4, z: z + (R() - 0.5) * 1.4, s: 0.35 + R() * 0.3, rot: R() * 6, bloom: R() < 0.2 });
  }
  // 路線過河處的踏石（中路在中央，上下路在轉角）
  for (const p of LANES) {
    const L = polyLen(p);
    for (let d = 0; d < L; d += 1.2) {
      const a = pointAlong(p, d); if (riverDist(a.x, a.z) > 6.2) continue;
      for (let k = 0; k < 2; k++) steps.push({ x: a.x + (R() - 0.5) * 7, z: a.z + (R() - 0.5) * 7, s: 0.45 + R() * 0.35, rot: R() * 6, v: R() });
    }
  }
  for (const c of CAMPS_LIST) {
    if (c.boss) { for (let k = 0; k < 26; k++) { const a = (k / 26) * 6.28 + R() * 0.15, r = 10 + R() * 1.5; smooth.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, s: 0.6 + R() * 0.8, rot: R() * 6, v: R() }); } }
    else { for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28 + R() * 0.4, r = 6 + R() * 0.8; smooth.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, s: 0.45 + R() * 0.4, rot: R() * 6, v: R(), moss: true }); } }
  }
  const reedG = shadeY(mergeGeo([0, 1, 2, 3, 4].map((k) => new THREE.ConeGeometry(0.045, 1.5 + (k % 3) * 0.35, 3).rotateZ((k - 2) * 0.12).translate((k - 2) * 0.13, 0.75, (k % 2) * 0.12)).concat([new THREE.CylinderGeometry(0.07, 0.07, 0.32, 5).translate(0.13, 1.65, 0), new THREE.CylinderGeometry(0.07, 0.07, 0.3, 5).translate(-0.26, 1.5, 0)])), 0.5, 1.1);
  inst(reedG, toon('#ffffff', { vertexColors: true }), reeds, (t, i, im) => { place(t, t.s, im, i, -0.1); col.setHSL(0.17 + t.hue * 0.06, 0.42, 0.42 + t.hue * 0.1); im.setColorAt(i, col); }, false);
  const lilyG = new THREE.CylinderGeometry(1, 1, 0.04, 10, 1, false, 0.4, Math.PI * 2 - 0.6);
  inst(lilyG, toon('#ffffff'), lilies, (t, i, im) => { e3.set(0, t.rot, 0); q.setFromEuler(e3); sc.set(t.s, 1, t.s); p3.set(t.x, -0.29, t.z); m4.compose(p3, q, sc); im.setMatrixAt(i, m4); col.setHSL(0.27, 0.45, 0.38 + (i % 5) * 0.03); im.setColorAt(i, col); }, false);
  const blooms = lilies.filter((l) => l.bloom);
  inst(new THREE.IcosahedronGeometry(0.13, 0), toon('#ffffff'), blooms, (t, i, im) => { p3.set(t.x + 0.1, -0.2, t.z); sc.setScalar(1); m4.compose(p3, q.identity(), sc); im.setMatrixAt(i, m4); col.set(i % 2 ? '#f7c6d8' : '#fff4e6'); im.setColorAt(i, col); }, false);
  const flatRockG = mossRock(57, false).scale(1, 0.35, 1);
  inst(flatRockG, rockMat, steps, (t, i, im) => { place(t, t.s, im, i, -0.05); col.setHSL(0.08, 0.05, 0.85 + t.v * 0.15); im.setColorAt(i, col); });
  const smoothG = new THREE.IcosahedronGeometry(1, 1).scale(1, 0.55, 0.85);
  inst(smoothG, toon('#ffffff'), smooth, (t, i, im) => { place(t, t.s, im, i, t.s * 0.12); col.setHSL(t.moss ? 0.12 : 0.08, t.moss ? 0.12 : 0.05, 0.56 + t.v * 0.14); im.setColorAt(i, col); });

  /* ---------- 塔旁石燈籠 ---------- */
  const lanterns = [];
  for (const s of STRUCTURES) {
    if (s.kind !== 'tower') continue;
    const p = LANES[s.lane]; // 找路線切向
    let best = 0, bd = 1e9; const L = polyLen(p);
    for (let d = 0; d < L; d += 1) { const a = pointAlong(p, d); const dd = Math.hypot(a.x - s.x, a.z - s.z); if (dd < bd) { bd = dd; best = d; } }
    const a = pointAlong(p, Math.max(0, best - 0.5)), b = pointAlong(p, Math.min(L, best + 0.5)), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    const back = s.team === 0 ? -1 : 1;
    for (const side of [-1, 1]) for (const along of [3.5, -5]) {
      const x = s.x - (dz / l) * 6.4 * side + (dx / l) * along * back, z = s.z + (dx / l) * 6.4 * side + (dz / l) * along * back;
      if (insideObstacle(x, z, 0.4) || riverDist(x, z) < 5.5) continue;
      lanterns.push({ x, z, s: 1, rot: Math.atan2(dx, dz), team: s.team });
    }
  }
  const lanternG = mergeGeo([
    new THREE.BoxGeometry(0.7, 0.25, 0.7).translate(0, 0.12, 0), new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6).translate(0, 0.7, 0),
    new THREE.BoxGeometry(0.62, 0.12, 0.62).translate(0, 1.2, 0), new THREE.ConeGeometry(0.62, 0.42, 4).rotateY(Math.PI / 4).translate(0, 1.82, 0), new THREE.SphereGeometry(0.09, 6, 4).translate(0, 2.08, 0),
  ]);
  const lampG = new THREE.BoxGeometry(0.36, 0.36, 0.36).translate(0, 1.44, 0);
  inst(lanternG, toon('#b8ab92'), lanterns, (t, i, im) => place(t, 1, im, i));
  inst(lampG, new THREE.MeshBasicMaterial({ color: '#ffffff' }), lanterns, (t, i, im) => { place(t, 1, im, i); col.set(t.team ? '#ffb089' : '#a9f3dd').multiplyScalar(1.4); im.setColorAt(i, col); }, false);

  /* ---------- 基地：旗幟、晶柱、泉水 ---------- */
  const poles = [[], []], pillars = [[], []];
  BASE.forEach((b, team) => {
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2, x = b[0] + Math.cos(a) * 22.6, z = b[1] + Math.sin(a) * 22.6;
      if (Math.max(Math.abs(x), Math.abs(z)) > 89 || distToLanes(x, z) < 6.8 || riverDist(x, z) < 6) continue;
      (k % 2 ? poles : pillars)[team].push({ x, z, rot: -a + Math.PI / 2, s: 1, team });
    }
  });
  const poleG = new THREE.CylinderGeometry(0.08, 0.1, 5.2, 6).translate(0, 2.6, 0);
  const clothG = (() => { const g = new THREE.PlaneGeometry(1.1, 2.4, 4, 8); g.translate(0.62, 3.6, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.4) * 0.12 + (p.getY(i) - 3.6) * 0.0); return g; })();
  const pillarG = mergeGeo([new THREE.BoxGeometry(1.1, 0.4, 1.1).translate(0, 0.2, 0), new THREE.CylinderGeometry(0.38, 0.45, 2.6, 8).translate(0, 1.7, 0), new THREE.BoxGeometry(0.9, 0.25, 0.9).translate(0, 3.1, 0)]);
  const crystalG = new THREE.OctahedronGeometry(0.42, 0).scale(1, 1.6, 1).translate(0, 3.95, 0);
  const banners = [];
  [0, 1].forEach((team) => {
    inst(poleG, toon('#5a4632'), poles[team], (t, i, im) => place(t, 1, im, i));
    const bm = inst(clothG, toon(TEAM_COLOR[team], { side: THREE.DoubleSide }), poles[team], (t, i, im) => place(t, 1, im, i));
    if (bm) banners.push(bm);
    inst(pillarG, toon('#c9bc9f'), pillars[team], (t, i, im) => place(t, 1, im, i));
    inst(crystalG, new THREE.MeshBasicMaterial({ color: new THREE.Color(TEAM_LIGHT[team]).multiplyScalar(1.15) }), pillars[team], (t, i, im) => place(t, 1, im, i), false);
  });
  const pools = [];
  FOUNTAIN.forEach((f, team) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.42, 6, 48), fogMat(toon('#d8ccb0')));
    ring.rotation.x = Math.PI / 2; ring.position.set(f[0], 0.28, f[1]); ring.castShadow = true; ring.receiveShadow = true; group.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 6, 32), fogMat(toon('#cfc2a4')));
    inner.rotation.x = Math.PI / 2; inner.position.set(f[0], 0.32, f[1]); group.add(inner);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(5.1, 48), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(TEAM_COLOR[team]) }, uLight: { value: new THREE.Color(TEAM_LIGHT[team]) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uCol, uLight;
        void main(){ vec2 d = vUv - .5; float r = length(d) * 2.;
          float w = sin(r * 18. - uTime * 2.4) * .5 + .5;
          vec3 c = mix(uCol * .75, uLight, smoothstep(.75, 1., w) * (1. - r) * .8 + (1. - r) * .25);
          gl_FragColor = vec4(c, .78 - r * .2);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(f[0], 0.12, f[1]); group.add(pool); pools.push(pool);
    const obs = [];
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; obs.push({ x: f[0] + Math.cos(a) * 6.6, z: f[1] + Math.sin(a) * 6.6, rot: a, s: 0.9 }); }
    inst(pillarG, toon('#d4c8ac'), obs, (t, i, im) => place(t, t.s, im, i));
    inst(crystalG, new THREE.MeshBasicMaterial({ color: new THREE.Color(TEAM_LIGHT[team]).multiplyScalar(1.2) }), obs, (t, i, im) => place(t, t.s, im, i), false);
  });

  /* ---------- 草叢：一叢叢高草（站進去會被藏起來） ---------- */
  {
    const RB = rng(31337), blades = [];
    for (const b of BUSHES) {
      const n = Math.round(b.r * b.r * (quality > 0 ? 10 : 5));
      for (let k = 0; k < n; k++) {
        const a = RB() * 6.283, d = Math.sqrt(RB()) * (b.r + 0.2);
        blades.push({ x: b.x + Math.cos(a) * d, z: b.z + Math.sin(a) * d, s: 0.85 + RB() * 0.5 - (d / b.r) * 0.25, rot: RB() * 6, hue: RB() });
      }
    }
    const tuft = mergeGeo([0, 1, 2, 3, 4].map((k) => { const g = new THREE.ConeGeometry(0.16, 1.7, 3); g.translate(0, 0.85, 0); g.rotateZ((k - 2) * 0.22); g.rotateY(k * 1.3); g.translate((k - 2) * 0.12, 0, (k % 2) * 0.1); return g; }));
    inst(tuft, toon('#ffffff'), blades, (t, i, im) => { place(t, t.s, im, i, -0.05, 1, 0.08); col.setHSL(0.24 + t.hue * 0.06, 0.55, 0.26 + t.hue * 0.12); im.setColorAt(i, col); }, false);
  }

  return {
    update(t) {
      for (const p of pools) p.material.uniforms.uTime.value = t;
    },
  };
}
