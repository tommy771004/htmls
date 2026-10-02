// chars 軌道：外觀（Outfit）與卡通英雄身體烘焙。全部以圓潤基本體合併成單一蒙皮網格（剛性綁定）。
import * as THREE from 'three';
import { Baker, M, along, shade, mix, unitSphere, unitCone } from './chars-geo.js';

// ---------- 骨架定義（rest pose 無旋轉，只有平移；座標 = 父骨相對位置） ----------
export const BONES = [
  ['hips', -1, [0, 0.89, 0]], ['spine', 0, [0, 0.12, 0]], ['chest', 1, [0, 0.20, 0]], ['neck', 2, [0, 0.27, 0]], ['head', 3, [0, 0.02, 0]],
  ['shL', 2, [-0.25, 0.21, 0]], ['uArmL', 5, [0, 0, 0]], ['fArmL', 6, [0, -0.33, 0]],
  ['shR', 2, [0.25, 0.21, 0]], ['uArmR', 8, [0, 0, 0]], ['fArmR', 9, [0, -0.33, 0]],
  ['thighL', 0, [-0.1, -0.06, 0]], ['shinL', 11, [0, -0.40, 0]], ['footL', 12, [0, -0.34, 0]],
  ['thighR', 0, [0.1, -0.06, 0]], ['shinR', 14, [0, -0.40, 0]], ['footR', 15, [0, -0.34, 0]],
  ['pack', 2, [0, 0.17, 0.2]], ['tail', 2, [0, 0.27, 0.09]],
];
export const BI = {}; BONES.forEach((b, i) => (BI[b[0]] = i));
export const BONE_WORLD = BONES.map(() => [0, 0, 0]);
BONES.forEach((b, i) => { const p = b[1] < 0 ? [0, 0, 0] : BONE_WORLD[b[1]]; BONE_WORLD[i] = [p[0] + b[2][0], p[1] + b[2][1], p[2] + b[2][2]]; });
export const L1 = 0.33, L2 = 0.32; // 手臂骨長（IK 用，L2 含手掌中心）

// ---------- 配色與隨機外觀 ----------
const SKINS = ['#ffd8b8', '#f5be94', '#e2a173', '#c68059', '#9a5c3d', '#6b3e28', '#ffe3cf', '#f9c9a8'];
const HAIRS = ['#2a1b12', '#5a3a22', '#8a5a2b', '#d8a43a', '#e8d078', '#c4412f', '#ff6fa8', '#2ec4b6', '#7a5cff', '#1d1d28', '#e8e8f0', '#ff8a1f'];
const EYES = ['#3a2a1a', '#2a6fdb', '#2f9e5b', '#6b4a2a', '#1d1d28', '#7a3fbf'];
// [上衣, 下身, 配色, 副配色]
const PALETTES = [
  ['#ff4f6d', '#2b3a67', '#ffe14a', '#ffffff'], ['#ffd23d', '#3a3f55', '#ff4f6d', '#2ec4b6'], ['#2fd0b0', '#33415c', '#ffb703', '#ffffff'],
  ['#8a5cff', '#2d2a4a', '#ffe45e', '#ff6fa8'], ['#3d9bff', '#cfd6e4', '#ff7a1a', '#ffffff'], ['#ff8f3a', '#40485f', '#2ec4b6', '#fff3b0'],
  ['#7bd83a', '#3b3550', '#ff4f6d', '#ffffff'], ['#ff6fa8', '#344a6e', '#fff06a', '#7a5cff'], ['#f2f2f2', '#2a2f45', '#ff4f6d', '#3d9bff'],
  ['#d93b3b', '#2b2f3a', '#ffd23d', '#ffffff'], ['#2a2f45', '#8a6a42', '#ffb703', '#2ec4b6'], ['#14b8a6', '#6b4a8a', '#fff06a', '#ffffff'],
  ['#ffb703', '#2d4a3a', '#ff4f6d', '#ffffff'], ['#5a6bff', '#2b2f3a', '#ff9f43', '#ffffff'],
];
const SHOES = ['#f4f4f4', '#2b2b33', '#ff5a5a', '#ffd33d', '#3d9bff', '#fffaf0'];
export const HAIR_STYLES = ['spiky', 'bob', 'ponytail', 'buzz', 'curly', 'beanie', 'cap', 'mohawk', 'long'];
export const OUTFIT_TYPES = ['hoodie', 'jacket', 'overalls', 'tracksuit'];

export function makePlayerOutfit() {
  return {
    name: '阿嵐 RAN', skin: SKINS[1], hair: HAIRS[1], hairStyle: 0, outfitType: 0, top: '#ff7a1a', bottom: '#2a3552', accent: '#14c8b4', accent2: '#ffd23d',
    shoe: '#f4f4f4', sole: '#ff7a1a', eye: EYES[0], goggles: 2, shades: false, scarf: true, mask: false, back: 0, pants: 'long', gloves: false, brow: 1, mouth: 0, hat: 0,
    glider: ['#ff7a2a', '#ffffff', '#18c9b0'],
  };
}
export function makeOutfit(rng) {
  const pal = rng.pick(PALETTES), hairStyle = rng.int(HAIR_STYLES.length);
  const hatty = hairStyle === 5 || hairStyle === 6;
  const o = {
    skin: rng.pick(SKINS), hair: rng.pick(HAIRS), hairStyle, outfitType: rng.int(4), top: pal[0], bottom: pal[1], accent: pal[2], accent2: pal[3],
    shoe: rng.pick(SHOES), eye: rng.pick(EYES), goggles: 0, shades: false, scarf: rng() < 0.28, mask: rng() < 0.1, back: rng.int(6),
    pants: rng() < 0.22 ? 'shorts' : 'long', gloves: rng() < 0.3, brow: rng.int(3), mouth: rng.int(3), hat: 0,
  };
  o.sole = pal[2];
  const g = rng();
  if (!hatty) { if (g < 0.18) o.goggles = 2; else if (g < 0.3) o.goggles = 1; else if (g < 0.4) o.shades = true; }
  if (o.mask) { o.scarf = false; o.shades = false; if (o.goggles === 1) o.goggles = 0; }
  o.glider = [pal[0], pal[3], pal[2]];
  return o;
}

// ---------- 烘焙 ----------
const capCache = new Map();
function capGeo(thetaLen, thetaStart = 0) {
  const k = thetaLen + '_' + thetaStart;
  let g = capCache.get(k); if (!g) capCache.set(k, (g = new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, thetaStart, thetaLen)));
  return g;
}
const arcCache = new Map();
function arcGeo(arc, tube) {
  const k = arc + '_' + tube;
  let g = arcCache.get(k); if (!g) arcCache.set(k, (g = new THREE.TorusGeometry(1, tube, 6, 14, arc)));
  return g;
}
const HC = 0.115; // 頭中心在 head 骨局部的 y

function spike(B, from, dir, len, r, color) {
  const to = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len];
  B.add(unitCone(7), along(from, to, r, r), color);
}

function bakeHair(B, o) {
  const h = o.hair, hd = shade(h, 0.8), hl = shade(h, 1.18);
  const cap = (cx, cy, cz, rx, ry, rz, tl, tilt, c) => B.add(capGeo(tl), M(cx, cy, cz, tilt, 0, 0, rx, ry, rz), c);
  switch (o.hairStyle) {
    case 0: { // 刺刺頭
      cap(0, HC + 0.012, 0.004, 0.153, 0.155, 0.158, 1.6, 0.32, h);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, r = 0.095 + (i % 2) * 0.02;
        const bx = Math.sin(a) * r, bz = Math.cos(a) * r * 0.95;
        const up = 0.145 - Math.abs(Math.sin(a)) * 0.01 + HC;
        spike(B, [bx, up - 0.03, bz], [Math.sin(a) * 0.55, 0.85, Math.cos(a) * 0.55 - (bz < 0 ? 0.25 : 0)], 0.1 + (i % 3) * 0.02, 0.042, i % 2 ? h : hl);
      }
      spike(B, [0, HC + 0.13, -0.08], [0, 0.55, -0.85], 0.12, 0.04, hl); // 前翹瀏海
      break;
    }
    case 1: { // 鮑伯頭
      cap(0, HC + 0.014, 0.012, 0.158, 0.158, 0.163, 1.85, 0.18, h);
      B.sphere(-0.122, HC - 0.03, 0.02, 0.045, 0.1, 0.12, h); B.sphere(0.122, HC - 0.03, 0.02, 0.045, 0.1, 0.12, h);
      B.sphere(0, HC - 0.035, 0.1, 0.135, 0.12, 0.06, hd);
      B.sphere(0, HC + 0.075, -0.128, 0.125, 0.042, 0.035, h, undefined, [0.25, 0, 0]);
      B.sphere(-0.075, HC + 0.06, -0.125, 0.06, 0.05, 0.035, hl, undefined, [0.1, 0, 0.5]);
      break;
    }
    case 2: { // 馬尾
      cap(0, HC + 0.014, 0.008, 0.155, 0.156, 0.16, 1.62, 0.3, h);
      B.sphere(0, HC + 0.075, -0.128, 0.12, 0.038, 0.032, h, undefined, [0.25, 0, 0]);
      B.sphere(0, HC + 0.04, 0.155, 0.035, 0.035, 0.035, o.accent);
      B.limb([0, HC + 0.04, 0.17], [0, HC - 0.04, 0.26], 0.055, 0.045, h); B.limb([0, HC - 0.04, 0.26], [0, HC - 0.17, 0.27], 0.045, 0.02, hd);
      break;
    }
    case 3: { // 平頭
      cap(0, HC + 0.01, 0.004, 0.148, 0.15, 0.152, 1.45, 0.28, mix(h, o.skin, 0.25));
      break;
    }
    case 4: { // 捲髮
      cap(0, HC + 0.012, 0.01, 0.15, 0.152, 0.156, 1.55, 0.28, hd);
      const n = 22;
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 1.12, rad = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.399963;
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        if (z < -0.35 && y < 0.62) continue;
        B.sphere(x * 0.155, HC + 0.01 + y * 0.158, z * 0.165, 0.058, 0.058, 0.058, i % 3 ? h : hl);
      }
      break;
    }
    case 5: { // 毛帽
      B.add(capGeo(1.95), M(0, HC + 0.015, 0.012, 0.16, 0, 0, 0.164, 0.165, 0.172), o.accent);
      B.torus(0, HC + 0.042, 0.0, 0.158, 0.03, o.accent2, undefined, [Math.PI / 2 - 0.16, 0, 0], 1, 1.08);
      B.sphere(0, HC + 0.178, 0.01, 0.052, 0.05, 0.052, o.accent2);
      B.sphere(-0.138, HC - 0.01, 0.02, 0.03, 0.05, 0.07, h); B.sphere(0.138, HC - 0.01, 0.02, 0.03, 0.05, 0.07, h);
      break;
    }
    case 6: { // 棒球帽
      B.add(capGeo(1.7), M(0, HC + 0.03, 0.006, 0.16, 0, 0, 0.158, 0.158, 0.164), o.accent);
      B.sphere(0, HC + 0.04, -0.15, 0.1, 0.013, 0.085, shade(o.accent, 0.82), undefined, [-0.18, 0, 0]);
      B.sphere(0, HC + 0.19, 0.0, 0.016, 0.014, 0.016, o.accent2);
      B.sphere(0, HC - 0.02, 0.12, 0.125, 0.07, 0.05, h);
      B.sphere(0, HC + 0.055, -0.0, 0.015, 0.015, 0.15, o.accent2, undefined, [0.0, 0, 0]);
      break;
    }
    case 7: { // 龐克雞冠
      cap(0, HC + 0.008, 0.004, 0.146, 0.148, 0.15, 1.4, 0.28, mix(h, o.skin, 0.55));
      for (let i = 0; i < 7; i++) {
        const t = i / 6, z = -0.11 + t * 0.24, y = HC + 0.135 - Math.abs(t - 0.45) * 0.08;
        spike(B, [0, y - 0.02, z], [0, 1, 0.1 * (t - 0.5)], 0.1 + Math.sin(t * Math.PI) * 0.06, 0.04, i % 2 ? h : hl);
      }
      break;
    }
    default: { // 長髮
      cap(0, HC + 0.014, 0.012, 0.158, 0.158, 0.164, 1.8, 0.2, h);
      B.sphere(0, HC + 0.075, -0.13, 0.13, 0.04, 0.034, h, undefined, [0.25, 0, 0]);
      B.limb([0, HC + 0.06, 0.12], [0, HC - 0.2, 0.15], 0.14, 0.11, hd);
      B.limb([-0.115, HC + 0.02, 0.0], [-0.12, HC - 0.17, 0.06], 0.04, 0.03, h); B.limb([0.115, HC + 0.02, 0.0], [0.12, HC - 0.17, 0.06], 0.04, 0.03, h);
    }
  }
}

function bakeHead(B, o) {
  B.use(BI.head, ...BONE_WORLD[BI.head], 1.18, 1.18, 1.18, 0, HC, 0);
  const skin = o.skin, sd = shade(skin, 0.9);
  B.sphere(0, HC, 0, 0.14, 0.15, 0.145, skin);
  B.sphere(0, HC - 0.07, -0.012, 0.105, 0.075, 0.1, skin);
  B.sphere(-0.142, HC + 0.005, 0.0, 0.02, 0.034, 0.03, sd); B.sphere(0.142, HC + 0.005, 0.0, 0.02, 0.034, 0.03, sd);
  B.sphere(0, HC - 0.028, -0.143, 0.017, 0.016, 0.02, sd); // 鼻
  // 眼睛
  const eyeY = HC + 0.012, hide = o.goggles === 1 || o.shades;
  for (const sx of [-1, 1]) {
    const x = sx * 0.052;
    if (!hide) {
      B.sphere(x, eyeY, -0.126, 0.034, 0.04, 0.022, '#ffffff');
      B.sphere(x + sx * -0.002, eyeY - 0.002, -0.139, 0.021, 0.028, 0.013, o.eye);
      B.sphere(x + sx * -0.002, eyeY - 0.002, -0.147, 0.011, 0.016, 0.008, '#15151c');
      B.sphere(x + 0.008, eyeY + 0.011, -0.149, 0.0085, 0.0085, 0.006, '#ffffff');
    }
    // 眉
    const by = HC + 0.068, tilt = [0.012, 0.0, -0.012][o.brow] * sx;
    if (!(o.goggles === 1 || o.shades)) B.limb([x - sx * 0.032, by - tilt, -0.133], [x + sx * 0.032, by + tilt + (o.brow === 2 ? 0.014 : 0.004), -0.131], 0.0085, 0.0085, shade(o.hair, 0.7));
  }
  // 嘴
  if (!o.mask) {
    const my = HC - 0.052;
    if (o.mouth === 0) B.add(arcGeo(Math.PI, 0.2), M(0, my + 0.03, -0.136, 0, 0, Math.PI, 0.03, 0.03, 0.03), '#7a2a2a');
    else if (o.mouth === 1) { B.sphere(0, my - 0.003, -0.134, 0.034, 0.016, 0.012, '#6b1f26'); B.sphere(0, my + 0.006, -0.1395, 0.026, 0.006, 0.006, '#ffffff'); }
    else B.add(arcGeo(Math.PI * 0.8, 0.2), M(0.012, my + 0.026, -0.136, 0, 0, Math.PI * 1.1, 0.03, 0.03, 0.03), '#7a2a2a');
  }
  bakeHair(B, o);
  // 護目鏡
  const dark = '#2b2f3a';
  if (o.goggles === 2) {
    B.torus(0, HC + 0.075, 0.0, 0.155, 0.015, dark, undefined, [Math.PI / 2, 0, 0], 1, 1.05);
    for (const sx of [-1, 1]) {
      B.add(unitSphere(), M(sx * 0.055, HC + 0.098, -0.143, -0.5, 0, 0, 0.056, 0.056, 0.04), dark);
      B.add(unitSphere(), M(sx * 0.055, HC + 0.092, -0.158, -0.5, 0, 0, 0.044, 0.044, 0.03), '#8ff0ff');
      B.sphere(sx * 0.055 + 0.012, HC + 0.108, -0.172, 0.01, 0.008, 0.006, '#ffffff');
    }
    B.box(0, HC + 0.098, -0.15, 0.03, 0.02, 0.02, dark);
  } else if (o.goggles === 1) {
    B.torus(0, eyeY, 0.0, 0.151, 0.014, dark, undefined, [Math.PI / 2, 0, 0], 1, 1.04);
    for (const sx of [-1, 1]) {
      B.add(unitSphere(), M(sx * 0.055, eyeY, -0.138, 0, 0, 0, 0.056, 0.054, 0.04), dark);
      B.add(unitSphere(), M(sx * 0.055, eyeY, -0.152, 0, 0, 0, 0.045, 0.043, 0.03), '#ffc24a');
      B.sphere(sx * 0.055 + 0.014, eyeY + 0.014, -0.168, 0.011, 0.008, 0.006, '#ffffff');
    }
    B.box(0, eyeY, -0.146, 0.035, 0.02, 0.02, dark);
  }
  if (o.shades) {
    B.box(0, eyeY, -0.139, 0.235, 0.052, 0.03, '#1f2330', undefined, null, 0.018);
    B.box(-0.058, eyeY, -0.156, 0.085, 0.04, 0.012, '#3d6dff', undefined, null, 0.01); B.box(0.058, eyeY, -0.156, 0.085, 0.04, 0.012, '#3d6dff', undefined, null, 0.01);
    B.limb([-0.14, eyeY, -0.1], [-0.145, eyeY + 0.002, 0.0], 0.008, 0.008, '#1f2330'); B.limb([0.14, eyeY, -0.1], [0.145, eyeY + 0.002, 0.0], 0.008, 0.008, '#1f2330');
  }
  if (o.mask) {
    B.add(capGeo(Math.PI - 1.9, 1.9), M(0, HC, 0, 0, 0, 0, 0.152, 0.158, 0.153), o.accent2 === '#ffffff' ? o.accent : o.accent2);
    B.torus(0, HC - 0.04, -0.0, 0.149, 0.012, shade(o.accent, 0.8), undefined, [Math.PI / 2, 0, 0], 1, 1.02);
  }
}

function bakeTorso(B, o) {
  const t = o.outfitType, top = o.top, bot = o.bottom;
  const shirt = t === 2 ? top : top;
  // hips
  B.use(BI.hips, ...BONE_WORLD[BI.hips], 1.12, 1, 1.12);
  B.sphere(0, -0.015, 0, 0.158, 0.115, 0.126, bot);
  // spine（下軀幹）
  B.use(BI.spine, ...BONE_WORLD[BI.spine], 1.12, 1, 1.12);
  const lower = t === 2 ? bot : top;
  B.sphere(0, 0.035, 0, 0.158, 0.15, 0.12, lower);
  if (t === 0) { B.box(0, 0.005, -0.108, 0.17, 0.075, 0.04, shade(top, 0.86), undefined, [-0.12, 0, 0], 0.03); B.cyl(-0.075, 0.03, -0.125, 0.012, 0.012, 0.01, shade(top, 0.6), undefined, [Math.PI / 2, 0, 0]); }
  if (t === 1) { B.box(0, -0.04, -0.118, 0.17, 0.03, 0.03, o.accent, undefined, null, 0.012); }
  if (t === 2) { B.box(0, 0.045, -0.108, 0.095, 0.075, 0.03, shade(bot, 1.18), undefined, null, 0.012); B.sphere(-0.075, 0.1, -0.1, 0.014, 0.014, 0.008, o.accent2); B.sphere(0.075, 0.1, -0.1, 0.014, 0.014, 0.008, o.accent2); }
  if (t === 3) { for (const sx of [-1, 1]) B.box(sx * 0.16, 0.04, 0, 0.022, 0.31, 0.075, o.accent2, undefined, null, 0.008); }
  // chest（上軀幹）
  B.use(BI.chest, ...BONE_WORLD[BI.chest], 1.12, 1, 1.12);
  B.sphere(0, 0.10, 0, 0.19, 0.165, 0.13, shirt);
  B.sphere(0, 0.18, 0, 0.205, 0.07, 0.118, shirt);
  if (t === 0) {
    B.sphere(0, 0.262, 0.078, 0.125, 0.07, 0.075, shade(top, 0.9));          // 兜帽堆在頸後
    B.torus(0, 0.275, -0.012, 0.1, 0.034, shade(top, 0.92), undefined, [Math.PI / 2 - 0.15, 0, 0], 1, 1.0); // 帽緣
    for (const sx of [-1, 1]) B.limb([sx * 0.035, 0.235, -0.1], [sx * 0.04, 0.1, -0.128], 0.008, 0.008, '#fff7e8');
    B.sphere(-0.04, 0.095, -0.13, 0.012, 0.012, 0.012, o.accent2); B.sphere(0.04, 0.095, -0.13, 0.012, 0.012, 0.012, o.accent2);
  } else if (t === 1) {
    B.torus(0, 0.272, 0.0, 0.098, 0.034, o.accent, undefined, [Math.PI / 2, 0, 0], 1, 1.05);
    B.box(0, 0.12, -0.122, 0.2, 0.09, 0.02, o.accent2, undefined, [-0.1, 0, 0], 0.01);
    B.box(0, 0.05, -0.127, 0.014, 0.28, 0.012, '#f6f7fb', undefined, null, 0.005);
  } else if (t === 2) {
    B.box(0, 0.085, -0.1, 0.17, 0.15, 0.04, bot, undefined, [-0.1, 0, 0], 0.022);
    for (const sx of [-1, 1]) { B.limb([sx * 0.07, 0.15, -0.115], [sx * 0.085, 0.265, -0.04], 0.016, 0.016, bot); B.sphere(sx * 0.07, 0.15, -0.125, 0.015, 0.015, 0.01, o.accent2); }
    B.torus(0, 0.275, 0.0, 0.088, 0.026, shade(top, 0.9), undefined, [Math.PI / 2, 0, 0], 1, 1.0);
  } else {
    B.torus(0, 0.272, 0.0, 0.098, 0.036, o.accent, undefined, [Math.PI / 2, 0, 0], 1, 1.05);
    for (const sx of [-1, 1]) B.box(sx * 0.19, 0.08, 0, 0.022, 0.2, 0.08, o.accent2, undefined, null, 0.008);
    B.box(0, 0.05, -0.127, 0.014, 0.28, 0.012, o.accent2, undefined, null, 0.005);
  }
  // neck
  B.use(BI.neck, ...BONE_WORLD[BI.neck]);
  B.cyl(0, -0.01, 0, 0.052, 0.058, 0.1, o.skin);
  if (o.scarf) {
    B.torus(0, -0.018, 0, 0.1, 0.042, o.accent, undefined, [Math.PI / 2, 0, 0], 1.0, 1.05);
    B.torus(0, -0.045, -0.01, 0.105, 0.03, shade(o.accent, 0.82), undefined, [Math.PI / 2, 0, 0], 1.0, 1.05);
    B.sphere(-0.07, -0.05, -0.085, 0.045, 0.04, 0.04, o.accent);
  }
}

function bakeLimbs(B, o) {
  const t = o.outfitType, top = o.top, bot = o.bottom, skin = o.skin;
  const sleeveLong = t !== 2 || true;
  for (const sx of [-1, 1]) {
    const u = sx < 0 ? BI.uArmL : BI.uArmR, f = sx < 0 ? BI.fArmL : BI.fArmR;
    B.use(u, ...BONE_WORLD[u], 1.16, 1, 1.16);
    B.sphere(0, 0, 0, 0.076, 0.07, 0.07, top);
    B.limb([0, -0.015, 0], [0, -0.32, 0], 0.064, 0.056, top);
    if (t === 3) B.box(sx * 0.062, -0.15, 0, 0.014, 0.26, 0.04, o.accent2, undefined, null, 0.005);
    if (t === 1) B.torus(0, -0.05, 0, 0.066, 0.012, o.accent, undefined, [Math.PI / 2, 0, 0]);
    B.use(f, ...BONE_WORLD[f], 1.16, 1, 1.16);
    B.sphere(0, 0, 0, 0.057, 0.057, 0.057, top);
    const short = t === 2;
    B.limb([0, -0.01, 0], [0, -0.25, 0], 0.056, 0.047, (x, y) => (short && y < -0.07 ? skin : top));
    if (!short) B.torus(0, -0.232, 0, 0.05, 0.016, t === 0 ? shade(top, 0.8) : o.accent, undefined, [Math.PI / 2, 0, 0]);
    const hc = o.gloves ? o.accent : skin;
    B.sphere(0, -0.32, 0, 0.06, 0.064, 0.063, hc);
    B.sphere(-sx * 0.045, -0.302, -0.025, 0.026, 0.03, 0.03, hc); // 拇指
    if (o.gloves) B.torus(0, -0.265, 0, 0.05, 0.014, shade(o.accent, 0.8), undefined, [Math.PI / 2, 0, 0]);
  }
  for (const sx of [-1, 1]) {
    const th = sx < 0 ? BI.thighL : BI.thighR, sh = sx < 0 ? BI.shinL : BI.shinR, ft = sx < 0 ? BI.footL : BI.footR;
    const shorts = o.pants === 'shorts';
    B.use(th, ...BONE_WORLD[th], 1.12, 1, 1.12);
    if (shorts) { B.limb([0, 0, 0], [0, -0.22, 0], 0.095, 0.088, bot); B.limb([0, -0.2, 0], [0, -0.40, 0], 0.082, 0.074, o.skin); }
    else B.limb([0, 0, 0], [0, -0.40, 0], 0.095, 0.076, bot);
    if (t === 3 && !shorts) B.box(sx * 0.09, -0.2, 0, 0.014, 0.36, 0.04, o.accent2, undefined, null, 0.005);
    if (shorts) B.torus(0, -0.2, 0, 0.09, 0.016, shade(bot, 0.8), undefined, [Math.PI / 2, 0, 0]);
    B.use(sh, ...BONE_WORLD[sh], 1.12, 1, 1.12);
    B.sphere(0, 0, 0, 0.074, 0.074, 0.074, shorts ? o.skin : bot);
    if (shorts) { B.limb([0, -0.01, 0], [0, -0.30, 0], 0.068, 0.056, o.skin); B.limb([0, -0.15, 0], [0, -0.27, 0], 0.07, 0.062, o.accent); }
    else B.limb([0, -0.01, 0], [0, -0.30, 0], 0.07, 0.057, bot);
    if (!shorts) B.torus(0, -0.27, 0, 0.062, 0.02, shade(bot, 0.78), undefined, [Math.PI / 2, 0, 0]);
    B.use(ft, ...BONE_WORLD[ft], 1.12, 1.1, 1.1);
    B.sphere(0, -0.03, 0.01, 0.06, 0.058, 0.07, o.shoe);
    B.sphere(0, -0.045, -0.055, 0.058, 0.05, 0.085, o.shoe);
    B.sphere(0, -0.078, -0.04, 0.064, 0.026, 0.13, o.sole || '#ffffff');
    B.sphere(0, -0.04, -0.125, 0.045, 0.04, 0.04, shade(o.shoe, 0.9));
    B.box(0, 0.0, -0.045, 0.045, 0.012, 0.07, o.accent, undefined, [-0.4, 0, 0], 0.005);
  }
}

function bakeBack(B, o) {
  const g = o.glider || ['#ff7a2a', '#ffffff', '#18c9b0'];
  // 折起的滑翔翼（pack 骨，滑翔時縮放為 0）：直立的圓角翼包，三色條紋
  B.use(BI.pack, ...BONE_WORLD[BI.pack]);
  B.box(0, 0, 0, 0.3, 0.34, 0.085, g[0], undefined, null, 0.035);
  B.box(0, 0, 0.012, 0.09, 0.345, 0.09, g[1], undefined, null, 0.03);
  B.box(-0.1, 0, 0.012, 0.03, 0.35, 0.09, g[2], undefined, null, 0.012); B.box(0.1, 0, 0.012, 0.03, 0.35, 0.09, g[2], undefined, null, 0.012);
  B.sphere(0, 0.18, -0.01, 0.05, 0.03, 0.04, shade(g[2], 0.85));
  // 背部裝飾（掛在 chest 骨，位置在 pack 下方）
  B.use(BI.chest, ...BONE_WORLD[BI.chest]);
  const a = o.accent, a2 = o.accent2;
  switch (o.back) {
    case 0: B.box(0, -0.04, 0.24, 0.26, 0.24, 0.12, a, undefined, null, 0.04); B.box(0, -0.08, 0.305, 0.18, 0.1, 0.03, shade(a, 0.82), undefined, null, 0.012); B.box(0, 0.05, 0.24, 0.27, 0.05, 0.125, shade(a, 1.12), undefined, null, 0.02); break;
    case 1: B.box(0, -0.02, 0.22, 0.2, 0.2, 0.09, shade(a, 0.9), undefined, null, 0.03); B.cyl(0, -0.15, 0.23, 0.065, 0.065, 0.3, a2, undefined, [0, 0, Math.PI / 2]); B.torus(-0.1, -0.15, 0.23, 0.066, 0.012, shade(a2, 0.7), undefined, [0, Math.PI / 2, 0]); B.torus(0.1, -0.15, 0.23, 0.066, 0.012, shade(a2, 0.7), undefined, [0, Math.PI / 2, 0]); break;
    case 2:
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) B.box(sx * (0.2 + i * 0.08), 0.13 + i * 0.05, 0.19, 0.13, 0.035, 0.015, i % 2 ? a2 : a, undefined, [0, 0, sx * (0.3 + i * 0.3)], 0.008);
      break;
    case 3: break; // 披風在 tail 骨
    case 4:
      for (const sx of [-1, 1]) { B.cyl(sx * 0.15, 0.0, 0.2, 0.045, 0.045, 0.3, '#c8d0dc'); B.cone(sx * 0.15, -0.19, 0.2, 0.04, 0.09, '#ff9a3d', undefined, [Math.PI, 0, 0]); B.sphere(sx * 0.15, 0.15, 0.2, 0.045, 0.03, 0.045, a); }
      break;
    default: // 玩偶夥伴
      B.sphere(0, -0.07, 0.24, 0.1, 0.095, 0.09, mix(a, '#ffffff', 0.4));
      B.sphere(-0.07, 0.0, 0.24, 0.035, 0.035, 0.03, mix(a, '#ffffff', 0.4)); B.sphere(0.07, 0.0, 0.24, 0.035, 0.035, 0.03, mix(a, '#ffffff', 0.4));
      B.sphere(0, -0.085, 0.328, 0.04, 0.03, 0.02, a2); B.sphere(-0.035, -0.055, 0.325, 0.012, 0.012, 0.01, '#15151c'); B.sphere(0.035, -0.055, 0.325, 0.012, 0.012, 0.01, '#15151c');
  }
  // 披風／圍巾尾（tail 骨）
  B.use(BI.tail, ...BONE_WORLD[BI.tail]);
  if (o.back === 3) {
    B.box(0, -0.31, 0.085, 0.36, 0.62, 0.022, a, undefined, null, 0.008); B.box(0, -0.67, 0.085, 0.38, 0.11, 0.024, a2, undefined, null, 0.008);
    B.torus(0, 0.0, -0.01, 0.12, 0.02, a2, undefined, [Math.PI / 2, 0, 0], 1, 0.9);
  } else if (o.scarf) {
    B.box(0.035, -0.19, 0.04, 0.085, 0.4, 0.02, o.accent, undefined, null, 0.008);
    B.box(0.035, -0.37, 0.042, 0.085, 0.04, 0.02, o.accent2, undefined, null, 0.006);
    B.box(0.035, -0.31, 0.042, 0.085, 0.03, 0.02, o.accent2, undefined, null, 0.006);
  }
}

// 傳回已烘焙的蒙皮幾何
export function bakeCharacter(o) {
  const B = new Baker(true);
  bakeTorso(B, o); bakeLimbs(B, o); bakeHead(B, o); bakeBack(B, o);
  const g = B.geometry();
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 2.1);
  return g;
}
