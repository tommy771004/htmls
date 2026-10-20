// 木偶人角色：關節骨架（骨盆、脊椎、胸、頭、上臂、前臂、手、大腿、小腿、腳）＋程序動畫。
// 玩家穿橘色連帽外套、深灰短褲、護膝與背包（背上掛滑板或雪板）；路人共用同一套骨架，以 InstancedMesh 一次畫完。
import * as THREE from 'three';
import { Builder, P, mat } from './geo.js';

export const SKIN = 0xc9b79e;
const JOINT = 0x45484d;
const DARK = 0x2f3236;

const BONES = ['pelvis', 'spine', 'chest', 'head', 'uArmL', 'fArmL', 'handL', 'uArmR', 'fArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const PARENT = { spine: 'pelvis', chest: 'spine', head: 'chest', uArmL: 'chest', fArmL: 'uArmL', handL: 'fArmL', uArmR: 'chest', fArmR: 'uArmR', handR: 'fArmR', thighL: 'pelvis', shinL: 'thighL', footL: 'shinL', thighR: 'pelvis', shinR: 'thighR', footR: 'shinR' };
const OFFSET = {
  pelvis: [0, 0.94, 0], spine: [0, 0.07, 0], chest: [0, 0.2, 0], head: [0, 0.31, 0],
  uArmL: [-0.205, 0.175, 0], fArmL: [0, -0.27, 0], handL: [0, -0.245, 0],
  uArmR: [0.205, 0.175, 0], fArmR: [0, -0.27, 0], handR: [0, -0.245, 0],
  thighL: [-0.095, -0.05, 0], shinL: [0, -0.44, 0], footL: [0, -0.425, 0],
  thighR: [0.095, -0.05, 0], shinR: [0, -0.44, 0], footR: [0, -0.425, 0],
};
const UPPER = new Set(['spine', 'chest', 'uArmL', 'fArmL', 'uArmR', 'fArmR']);

export function makeRig() {
  const root = new THREE.Group();
  const b = {};
  for (const n of BONES) {
    const g = new THREE.Group();
    g.name = n;
    g.position.set(...OFFSET[n]);
    g.rotation.order = 'YXZ';
    b[n] = g;
    (PARENT[n] ? b[PARENT[n]] : root).add(g);
  }
  return { root, b };
}

// 各骨頭的幾何（cloth：衣物，乘上衣色；skin：皮膚與固定色細節）
function sph(B, x, y, z, sx, sy, sz, c) {
  B.geom(P.sphere(14, 10), mat(x, y, z, sx, sy, sz), c);
}
function cyl(B, x, y, z, r0, r1, h, c, rx = 0, rz = 0, seg = 10) {
  const g = r0 === r1 ? P.cyl(seg) : null;
  if (g) B.geom(g, mat(x, y, z, r0, h, r0, rx, 0, rz), c);
  else B.geom(new THREE.CylinderGeometry(r1, r0, h, seg, 1), mat(x, y, z, 1, 1, 1, rx, 0, rz), c);
}

export function buildParts(colors, detail = true) {
  const top = colors.top;
  const bot = colors.bottom;
  const skin = colors.skin ?? SKIN;
  const parts = {};
  const get = (n) => (parts[n] ||= { cloth: new Builder(), skin: new Builder() });
  // 骨盆：短褲
  let p = get('pelvis');
  sph(p.cloth, 0, -0.02, 0, 0.165, 0.12, 0.115, bot);
  // 腹部
  p = get('spine');
  sph(p.cloth, 0, 0.09, 0, 0.158, 0.15, 0.112, top);
  // 胸：連帽外套、肩、頸
  p = get('chest');
  sph(p.cloth, 0, 0.07, 0, 0.198, 0.2, 0.128, top);
  sph(p.cloth, -0.185, 0.165, 0, 0.078, 0.072, 0.078, top);
  sph(p.cloth, 0.185, 0.165, 0, 0.078, 0.072, 0.078, top);
  cyl(p.skin, 0, 0.27, 0, 0.042, 0.042, 0.1, skin);
  cyl(p.skin, 0, 0.232, 0, 0.062, 0.062, 0.05, JOINT);
  if (detail) {
    // 帽兜（後頸一圈）、拉鍊、口袋、抽繩
    p.cloth.geom(new THREE.TorusGeometry(0.085, 0.045, 8, 16, Math.PI * 1.25), mat(0, 0.235, 0.035, 1, 1, 1.15, Math.PI / 2, 0, Math.PI * 0.125 + Math.PI), top);
    sph(p.cloth, 0, 0.2, 0.085, 0.12, 0.09, 0.07, top);
    p.skin.geom(P.box(), mat(0, 0.04, -0.126, 0.008, 0.36, 0.006), 0xd8d4cc);
    p.cloth.geom(P.box(), mat(0, -0.075, -0.118, 0.2, 0.09, 0.03), shade(top, 0.92));
    p.skin.geom(P.cyl(5), mat(-0.03, 0.12, -0.13, 0.004, 0.13, 0.004), 0xe8e4dc);
    p.skin.geom(P.cyl(5), mat(0.03, 0.12, -0.13, 0.004, 0.13, 0.004), 0xe8e4dc);
  }
  // 頭：圓頭＋兩側耳盤＋小眼睛
  p = get('head');
  sph(p.skin, 0, 0.13, 0, 0.112, 0.138, 0.124, skin);
  for (const s of [-1, 1]) {
    cyl(p.skin, s * 0.112, 0.125, 0.005, 0.058, 0.058, 0.04, shade(skin, 0.9), 0, Math.PI / 2, 16);
    cyl(p.skin, s * 0.131, 0.125, 0.005, 0.032, 0.032, 0.012, DARK, 0, Math.PI / 2, 12);
    sph(p.skin, s * 0.043, 0.122, -0.112, 0.014, 0.017, 0.008, DARK);
  }
  // 手臂
  for (const s of ['L', 'R']) {
    p = get('uArm' + s);
    cyl(p.cloth, 0, -0.125, 0, 0.06, 0.06, 0.25, top);
    sph(p.cloth, 0, -0.25, 0, 0.056, 0.05, 0.056, top);
    p = get('fArm' + s);
    cyl(p.cloth, 0, -0.08, 0, 0.054, 0.05, 0.16, top);
    cyl(p.skin, 0, -0.165, 0, 0.042, 0.042, 0.03, JOINT);
    cyl(p.skin, 0, -0.205, 0, 0.033, 0.03, 0.08, skin);
    p = get('hand' + s);
    p.skin.geom(P.box(), mat(0, -0.045, 0, 0.068, 0.08, 0.03), skin);
    if (detail) {
      for (let f = 0; f < 4; f++) p.skin.geom(P.cyl(5), mat(-0.026 + f * 0.017, -0.112, 0, 0.0085, 0.06, 0.0085), skin);
      p.skin.geom(P.cyl(5), mat((s === 'L' ? 1 : -1) * 0.038, -0.065, -0.012, 0.009, 0.05, 0.009, 0, 0, (s === 'L' ? -1 : 1) * 0.6), skin);
    } else p.skin.geom(P.box(), mat(0, -0.11, 0, 0.066, 0.06, 0.025), skin);
  }
  // 腿
  for (const s of ['L', 'R']) {
    p = get('thigh' + s);
    cyl(p.cloth, 0, -0.13, 0, 0.088, 0.08, 0.27, bot);
    if (detail) p.cloth.geom(P.box(), mat((s === 'L' ? -1 : 1) * 0.08, -0.17, 0, 0.03, 0.1, 0.08), shade(bot, 0.9));
    cyl(p.skin, 0, -0.35, 0, 0.058, 0.05, 0.18, skin);
    p = get('shin' + s);
    sph(p.skin, 0, -0.01, -0.022, 0.058, 0.06, 0.052, JOINT);
    cyl(p.skin, 0, -0.21, 0, 0.048, 0.036, 0.4, skin);
    p = get('foot' + s);
    sph(p.skin, 0, -0.03, -0.045, 0.058, 0.05, 0.125, colors.shoe ?? 0x4d5259);
    p.skin.geom(P.box(), mat(0, -0.068, -0.045, 0.106, 0.026, 0.245), 0xe9e7e2);
  }
  return parts;
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}

// 背包（掛在胸骨上）與背上的板子
function buildBackpack(board) {
  const B = new Builder();
  const pack = 0x4a5562;
  B.geom(new THREE.CapsuleGeometry(0.13, 0.22, 4, 10), mat(0, 0.06, 0.2, 1.15, 1, 0.65), pack);
  B.geom(P.box(), mat(0, -0.04, 0.29, 0.2, 0.14, 0.04), 0x3d4752);
  for (const s of [-1, 1]) B.geom(new THREE.TorusGeometry(0.11, 0.016, 6, 12, Math.PI), mat(s * 0.1, 0.13, 0.03, 1, 1.3, 0.9, 0, Math.PI / 2, 0), 0x3d4752);
  if (board === 'skate') {
    B.geom(P.box(), mat(0, 0.08, 0.33, 0.21, 0.78, 0.025), 0xe8692d);
    B.geom(P.box(), mat(0, 0.08, 0.318, 0.2, 0.76, 0.006), 0x2b2b2b);
    for (const y of [-0.2, 0.36]) {
      B.geom(P.box(), mat(0, y, 0.36, 0.15, 0.03, 0.03), 0xb9bcc0);
      for (const s of [-1, 1]) B.geom(P.cyl(10), mat(s * 0.09, y, 0.375, 0.028, 0.032, 0.028, 0, 0, Math.PI / 2), 0xf3f1ea);
    }
    B.geom(P.cyl(12), mat(0, 0.08, 0.35, 0.07, 0.01, 0.07, Math.PI / 2, 0, 0), 0xf3f1ea);
  } else if (board === 'snow') {
    B.geom(P.box(), mat(0, 0.1, 0.33, 0.26, 1.2, 0.025), 0x2563eb);
    B.geom(P.box(), mat(0, 0.1, 0.345, 0.2, 0.1, 0.05), 0x1f2933);
  }
  return B.build();
}

// 姿勢：依動作狀態設定各骨頭旋轉
export function pose(r, s) {
  const b = r.b;
  for (const n of BONES) b[n].rotation.set(0, 0, 0);
  b.pelvis.position.set(0, 0.94, 0);
  const ph = s.phase || 0;
  const a = s.anim || 'idle';
  const sin = Math.sin;
  const cos = Math.cos;
  const arms = (down = 0.08) => {
    b.uArmL.rotation.z = -down;
    b.uArmR.rotation.z = down;
  };
  switch (a) {
    case 'walk':
    case 'run':
    case 'sprint': {
      const k = a === 'walk' ? 0.42 : a === 'run' ? 0.78 : 1.0;
      const w = ph * Math.PI * (a === 'walk' ? 1.05 : 1.0);
      const sw = sin(w);
      b.thighL.rotation.x = sw * k;
      b.thighR.rotation.x = -sw * k;
      b.shinL.rotation.x = -Math.max(0, -cos(w) * k * 1.6) - 0.08;
      b.shinR.rotation.x = -Math.max(0, cos(w) * k * 1.6) - 0.08;
      b.footL.rotation.x = Math.max(0, sw) * 0.3;
      b.footR.rotation.x = Math.max(0, -sw) * 0.3;
      b.uArmL.rotation.x = -sw * k * 0.8;
      b.uArmR.rotation.x = sw * k * 0.8;
      b.fArmL.rotation.x = 0.25 + k * 0.9;
      b.fArmR.rotation.x = 0.25 + k * 0.9;
      arms(0.1);
      const lean = a === 'walk' ? 0.03 : a === 'run' ? 0.14 : 0.26;
      b.spine.rotation.x = -lean;
      b.pelvis.position.y = 0.94 - (a === 'walk' ? 0.01 : 0.04) + Math.abs(sin(w)) * (a === 'walk' ? 0.025 : 0.06);
      b.spine.rotation.y = sw * 0.08 * k;
      b.head.rotation.x = lean * 0.6;
      break;
    }
    case 'jump':
    case 'fall':
      b.thighL.rotation.x = a === 'jump' ? 0.75 : 0.25;
      b.thighR.rotation.x = a === 'jump' ? 0.15 : -0.15;
      b.shinL.rotation.x = a === 'jump' ? -1.1 : -0.4;
      b.shinR.rotation.x = -0.5;
      b.uArmL.rotation.z = -0.9 - (a === 'fall' ? 0.6 : 0);
      b.uArmR.rotation.z = 0.9 + (a === 'fall' ? 0.6 : 0);
      b.uArmL.rotation.x = 0.4;
      b.uArmR.rotation.x = 0.4;
      b.fArmL.rotation.x = 0.5;
      b.fArmR.rotation.x = 0.5;
      break;
    case 'crouch':
      b.pelvis.position.y = 0.62;
      b.thighL.rotation.x = 1.25;
      b.thighR.rotation.x = 1.1;
      b.shinL.rotation.x = -1.95;
      b.shinR.rotation.x = -1.8;
      b.footL.rotation.x = 0.6;
      b.footR.rotation.x = 0.6;
      b.spine.rotation.x = 0.35;
      b.uArmL.rotation.x = 0.6;
      b.uArmR.rotation.x = 0.6;
      b.fArmL.rotation.x = 0.8;
      b.fArmR.rotation.x = 0.8;
      break;
    case 'swim': {
      b.pelvis.position.y = 0.94;
      b.spine.rotation.x = 0.1;
      const w = ph * 2.4;
      b.uArmL.rotation.x = -Math.PI + ((w % (Math.PI * 2)) / (Math.PI * 2)) * Math.PI * 2;
      b.uArmR.rotation.x = -Math.PI + (((w + Math.PI) % (Math.PI * 2)) / (Math.PI * 2)) * Math.PI * 2;
      b.thighL.rotation.x = sin(w * 2) * 0.3 - 0.1;
      b.thighR.rotation.x = -sin(w * 2) * 0.3 - 0.1;
      break;
    }
    case 'ride':
    case 'push':
    case 'crouchride':
    case 'air':
    case 'grab':
    case 'grind': {
      // 板上：身體側站（相對板子轉 90°），膝蓋微彎，手往兩側
      const deep = a === 'crouchride' || a === 'air' || a === 'grab' ? 1 : a === 'grind' ? 0.6 : 0.35;
      b.pelvis.position.y = 0.94 - deep * 0.22;
      b.thighL.rotation.x = 0.3 + deep * 0.6;
      b.thighR.rotation.x = 0.3 + deep * 0.6;
      b.shinL.rotation.x = -0.55 - deep * 1.1;
      b.shinR.rotation.x = -0.55 - deep * 1.1;
      b.footL.rotation.x = 0.2 + deep * 0.4;
      b.footR.rotation.x = 0.2 + deep * 0.4;
      b.thighL.rotation.z = -0.28;
      b.thighR.rotation.z = 0.28;
      b.spine.rotation.x = 0.12 + deep * 0.25;
      b.spine.rotation.z = (s.lean || 0) * 0.6;
      b.head.rotation.y = 1.3;
      b.uArmL.rotation.z = -0.75;
      b.uArmR.rotation.z = 0.75;
      b.uArmL.rotation.x = 0.2;
      b.uArmR.rotation.x = 0.2;
      b.fArmL.rotation.x = 0.4;
      b.fArmR.rotation.x = 0.4;
      if (a === 'push') {
        // 後腳往地面推
        const w = (ph * 3) % (Math.PI * 2);
        b.thighR.rotation.x = 0.25 - sin(w) * 0.55;
        b.shinR.rotation.x = -0.25 - Math.max(0, cos(w)) * 0.5;
        b.thighR.rotation.z = 0.05;
        b.pelvis.position.y = 0.86;
      }
      if (a === 'grab') {
        b.uArmR.rotation.z = 0.1;
        b.uArmR.rotation.x = 1.2;
        b.fArmR.rotation.x = 0.4;
      }
      if (a === 'grind') {
        b.uArmL.rotation.z = -1.3;
        b.uArmR.rotation.z = 1.3;
      }
      break;
    }
    case 'bail':
      b.spine.rotation.x = 0.8;
      b.uArmL.rotation.x = 1.5;
      b.uArmR.rotation.x = 1.5;
      b.thighL.rotation.x = 1.3;
      b.thighR.rotation.x = 0.8;
      b.shinL.rotation.x = -1.6;
      b.shinR.rotation.x = -1.2;
      b.pelvis.position.y = 0.32;
      break;
    case 'sit':
    case 'drive':
    case 'fly':
      b.pelvis.position.y = 0.5;
      b.thighL.rotation.x = 1.45;
      b.thighR.rotation.x = 1.45;
      b.shinL.rotation.x = -1.45;
      b.shinR.rotation.x = -1.45;
      b.thighL.rotation.z = -0.08;
      b.thighR.rotation.z = 0.08;
      if (a === 'sit') {
        b.uArmL.rotation.x = 0.4;
        b.uArmR.rotation.x = 0.4;
        b.fArmL.rotation.x = 0.9;
        b.fArmR.rotation.x = 0.9;
        b.thighL.rotation.x = 1.35 + sin(ph * 0.8) * 0.12;
        b.shinR.rotation.x = -1.2 + sin(ph * 0.9) * 0.2;
      } else {
        b.uArmL.rotation.x = 0.9;
        b.uArmR.rotation.x = 0.9;
        b.fArmL.rotation.x = 0.5;
        b.fArmR.rotation.x = 0.5;
        b.uArmL.rotation.z = 0.15;
        b.uArmR.rotation.z = -0.15;
        b.spine.rotation.x = -0.05;
      }
      break;
    case 'bike': {
      b.pelvis.position.y = 0.98;
      const w = ph * 3.2;
      b.thighL.rotation.x = 1.05 + sin(w) * 0.42;
      b.thighR.rotation.x = 1.05 - sin(w) * 0.42;
      b.shinL.rotation.x = -1.25 - cos(w) * 0.4;
      b.shinR.rotation.x = -1.25 + cos(w) * 0.4;
      b.spine.rotation.x = 0.45;
      b.head.rotation.x = -0.4;
      b.uArmL.rotation.x = 1.25;
      b.uArmR.rotation.x = 1.25;
      b.fArmL.rotation.x = 0.2;
      b.fArmR.rotation.x = 0.2;
      b.spine.rotation.z = (s.lean || 0) * 0.5;
      break;
    }
    case 'tpose':
      b.uArmL.rotation.z = -1.35;
      b.uArmR.rotation.z = 1.35;
      b.fArmL.rotation.z = -0.1;
      b.fArmR.rotation.z = 0.1;
      b.thighL.rotation.x = 0.2;
      b.shinL.rotation.x = -0.4;
      break;
    default: {
      // 待機：呼吸
      const br = sin(ph * 1.6) * 0.02;
      b.spine.rotation.x = br;
      b.head.rotation.x = -br;
      arms(0.1);
      b.fArmL.rotation.x = 0.15;
      b.fArmR.rotation.x = 0.15;
      b.thighL.rotation.z = -0.03;
      b.thighR.rotation.z = 0.03;
    }
  }
}

// ── 玩家角色 ──
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });

export class PlayerAvatar {
  constructor() {
    this.rig = makeRig();
    this.root = this.rig.root;
    const parts = buildParts({ top: 0xd65a22, bottom: 0x3e4652, shoe: 0x50555c }, true);
    this.meshes = [];
    for (const [n, pr] of Object.entries(parts)) {
      const B = new Builder();
      B.append(pr.cloth);
      B.append(pr.skin);
      const m = new THREE.Mesh(B.build(), MAT);
      m.castShadow = true;
      this.rig.b[n].add(m);
      this.meshes.push(m);
    }
    this.packs = { none: buildBackpack(null), skate: buildBackpack('skate'), snow: buildBackpack('snow') };
    this.pack = new THREE.Mesh(this.packs.skate, MAT);
    this.pack.castShadow = true;
    this.rig.b.chest.add(this.pack);
  }

  setBackItem(kind) {
    this.pack.geometry = this.packs[kind] || this.packs.none;
  }

  update(state) {
    pose(this.rig, state);
  }
}

// ── 路人群：每個骨頭兩個 InstancedMesh（衣物乘上衣色、皮膚） ──
const NPC_TOPS = [0x3b82c4, 0xe0b23a, 0x6b8f71, 0xb84a4a, 0xe8e4da, 0x2f3540, 0x8a5fb0, 0xd97941, 0x4fa3a5, 0xc7c1b3, 0x7d2f4a, 0x9cb36b];
const NPC_BOTS = [0x2b3a55, 0x3a3f46, 0xb9a986, 0x1f2328, 0x55606e, 0x6e5a48];
const NPC_SKINS = [[1, 1, 1], [0.34, 0.35, 0.38], [1.1, 1.1, 1.12], [0.82, 0.78, 0.74]];

export class Crowd {
  constructor(max = 64) {
    this.max = max;
    this.rig = makeRig();
    this.group = new THREE.Group();
    const parts = buildParts({ top: 0xffffff, bottom: 0xffffff, shoe: 0x55595f }, false);
    this.inst = [];
    const clothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    for (const [n, pr] of Object.entries(parts)) {
      for (const slot of ['cloth', 'skin']) {
        if (pr[slot].empty) continue;
        const im = new THREE.InstancedMesh(pr[slot].build(), clothMat, max);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.count = 0;
        im.castShadow = true;
        im.frustumCulled = false;
        im.setColorAt(0, new THREE.Color(1, 1, 1));
        this.group.add(im);
        this.inst.push({ bone: n, slot, im, upper: UPPER.has(n) });
      }
    }
    this.boards = new THREE.InstancedMesh(boardGeo(), clothMat, max);
    this.boards.count = 0;
    this.boards.frustumCulled = false;
    this.boards.castShadow = true;
    this.boards.setColorAt(0, new THREE.Color(1, 1, 1));
    this.group.add(this.boards);
    this._c = new THREE.Color();
    this._m = new THREE.Matrix4();
  }

  // list：[{x,y,z,yaw,anim,phase,look,board?}]
  update(list) {
    const n = Math.min(list.length, this.max);
    const r = this.rig;
    let nb = 0;
    for (let i = 0; i < n; i++) {
      const s = list[i];
      r.root.position.set(s.x, s.y, s.z);
      r.root.rotation.set(0, -s.yaw + (s.board ? -Math.PI / 2 : 0), 0);
      r.root.updateMatrix();
      pose(r, s);
      r.root.updateMatrixWorld(true);
      const look = s.look || 0;
      for (const it of this.inst) {
        it.im.setMatrixAt(i, r.b[it.bone].matrixWorld);
        if (it.slot === 'cloth') this._c.setHex(it.upper ? NPC_TOPS[look % NPC_TOPS.length] : NPC_BOTS[(look * 7 + 3) % NPC_BOTS.length]);
        else this._c.setRGB(...NPC_SKINS[(look * 5 + 1) % NPC_SKINS.length]);
        it.im.setColorAt(i, this._c);
      }
      if (s.board) {
        this._m.makeRotationY(-s.yaw);
        this._m.setPosition(s.x, s.y + 0.1, s.z);
        this.boards.setMatrixAt(nb, this._m);
        this.boards.setColorAt(nb, this._c.setHex(s.board === 'snow' ? 0x2a6fdb : 0xffffff));
        nb++;
      }
    }
    for (const it of this.inst) {
      it.im.count = n;
      it.im.instanceMatrix.needsUpdate = true;
      if (it.im.instanceColor) it.im.instanceColor.needsUpdate = true;
    }
    this.boards.count = nb;
    this.boards.instanceMatrix.needsUpdate = true;
    if (this.boards.instanceColor) this.boards.instanceColor.needsUpdate = true;
  }
}

// 板子（板身沿 -z 為前方）
export function boardGeo(kind = 'skate') {
  const B = new Builder();
  if (kind === 'snow') {
    B.geom(P.box(), mat(0, 0.02, 0, 0.3, 0.025, 1.55), 0xffffff);
    B.geom(P.box(), mat(0, 0.045, 0.2, 0.22, 0.05, 0.14), 0x1f2933);
    B.geom(P.box(), mat(0, 0.045, -0.2, 0.22, 0.05, 0.14), 0x1f2933);
    return B.build();
  }
  B.geom(P.box(), mat(0, 0.1, 0, 0.22, 0.022, 0.8), 0xe8692d);
  B.geom(P.box(), mat(0, 0.112, 0, 0.215, 0.004, 0.78), 0x24272b);
  B.geom(P.box(), mat(0, 0.115, -0.43, 0.2, 0.02, 0.1, 0.35, 0, 0), 0xe8692d);
  B.geom(P.box(), mat(0, 0.115, 0.43, 0.2, 0.02, 0.1, -0.35, 0, 0), 0xe8692d);
  for (const z of [-0.27, 0.27]) {
    B.geom(P.box(), mat(0, 0.07, z, 0.17, 0.025, 0.04), 0xb9bcc0);
    for (const s of [-1, 1]) B.geom(P.cyl(10), mat(s * 0.095, 0.035, z, 0.03, 0.035, 0.03, 0, 0, Math.PI / 2), 0xf3f1ea);
  }
  return B.build();
}
