// 六器鏢行 — 偃甲（機關巨偶）：竹骨 → 銅骨 → 金樞「不周」三階。
// 木＋青銅的骨架，關節是齒輪與鉚接，背上一只發條樞輪；右手千鈞錘、左臂連弩匣。主角坐進胸艙（艙門是銅柵，從外面看不到人）。
// 模型面向 +Z、腳底在原點，自然身高約 3.9 m；updateMechAppearance 依階數切換外觀並縮放。
import * as THREE from 'three';
import { Kit, T } from './kit.js';
import { MECH_TIERS } from '../core/data.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function part(parent, pivot, fn, seed = 3) {
  const k = new Kit(seed);
  fn(k);
  const g = k.build({ name: 'mech' });
  g.position.copy(pivot);
  parent.add(g);
  return g;
}

function gear(k, mat, color, r, t, teeth, m, hole = 0.3) {
  const s = new THREE.Shape();
  const N = teeth * 4;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = i % 4 === 1 || i % 4 === 2 ? r : r * 0.86;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const h = new THREE.Path();
  h.absarc(0, 0, r * hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  k.extrude(mat, color, s, t, m);
}

// 竹節桿：一節一節的竹管，節處加粗
function bamboo(k, color, a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const n = Math.max(2, Math.round(len / 0.32));
  for (let i = 0; i < n; i++) {
    const p0 = A.clone().lerp(B, i / n), p1 = A.clone().lerp(B, (i + 1) / n);
    k.rod('wood', color, p0.toArray(), p1.toArray(), r, 8);
    k.rod('wood', 0x8a7a3a, p1.clone().lerp(p0, 0.04).toArray(), p1.toArray(), r * 1.18, 8);
  }
}

const PAL = {
  1: { frame: 0xc2ad62, frameMat: 'wood', joint: 0x6a5232, jointMat: 'wood', plate: 0x8a6a40, plateMat: 'wood', trim: 0xb59a6a, trimMat: 'cloth', accent: 0x9a3a24 },
  2: { frame: 0x9a7444, frameMat: 'bronze', joint: 0x5a8a70, jointMat: 'bronze', plate: 0x2a1e18, plateMat: 'woodDark', trim: 0xb08d48, trimMat: 'bronze', accent: 0x2c3e57 },
  3: { frame: 0xc9a050, frameMat: 'bronze', joint: 0xd9b25a, jointMat: 'bronze', plate: 0x6a1a14, plateMat: 'woodDark', trim: 0xe0c070, trimMat: 'bronze', accent: 0xb23a24 },
};

const HIP_Y = 1.9;

// 鉚釘一圈（銅骨、金樞的鑄殼）
function rivetRing(k, mat, color, r, y, n, m) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    k.sphere(mat, color, 0.022, 6, 4, new THREE.Matrix4().multiplyMatrices(m || new THREE.Matrix4(), T(Math.sin(a) * r, y, Math.cos(a) * r)));
  }
}

// 四肢的一節：竹骨是竹管加麻繩綁紮；銅骨、金樞是上粗下細的鑄殼加一圈鉚釘
function limb(k, tier, P, len, r0, r1, frameRod) {
  if (tier === 1) {
    frameRod(k, [0, 0, 0], [0, -len, 0.03], r0 * 0.55);
    frameRod(k, [r0 * 0.55, -0.05, 0], [r1 * 0.55, -len + 0.05, 0.03], r0 * 0.3);
    frameRod(k, [-r0 * 0.55, -0.05, 0], [-r1 * 0.55, -len + 0.05, 0.03], r0 * 0.3);
    for (const t of [0.22, 0.5, 0.78]) k.torus('cloth', P.trim, r0 * 0.75 - (r0 - r1) * 0.5 * t, 0.022, 4, 12, Math.PI * 2, T(0, -len * t, 0.015, Math.PI / 2, 0, 0));
    return;
  }
  k.lathe(P.plateMat, P.plate, [[0, -len], [r1 * 0.8, -len], [r1, -len * 0.9], [r0 * 0.94, -len * 0.55], [r0, -len * 0.12], [r0 * 0.9, 0], [0, 0]], 10, T(0, 0, 0.02));
  k.torus(P.trimMat, P.trim, r0 * 1.0, 0.025, 5, 16, Math.PI * 2, T(0, -len * 0.14, 0.02, Math.PI / 2, 0, 0));
  rivetRing(k, P.trimMat, P.trim, r0 * 1.02, -len * 0.14, 10, T(0, 0, 0.02));
  k.torus(P.trimMat, P.trim, r1 * 1.04, 0.022, 5, 14, Math.PI * 2, T(0, -len * 0.84, 0.02, Math.PI / 2, 0, 0));
}

function buildTier(tier) {
  const P = PAL[tier];
  const root = new THREE.Group();
  root.name = `mech-t${tier}`;
  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  root.add(hips);
  const frameRod = (k, a, b, r) => (tier === 1 ? bamboo(k, P.frame, a, b, r) : k.rod(P.frameMat, P.frame, a, b, r, 8));

  // 骨盆：齒輪軸＋護裙板
  part(hips, V(0, 0, 0), (k) => {
    k.lathe(P.plateMat, P.plate, [[0, -0.14], [0.36, -0.14], [0.42, 0], [0.4, 0.14], [0, 0.14]], 8, T(0, 0, 0, 0, Math.PI / 8, 0, 1, 1, 0.72));
    gear(k, P.jointMat, P.joint, 0.2, 0.12, 12, T(0, 0, 0.32));
    for (let i = 0; i < 5; i++) {
      const x = -0.36 + i * 0.18;
      k.box(P.plateMat, P.plate, 0.16, 0.44, 0.04, T(x, -0.3, 0.3, 0.14, 0, 0));
      k.sphere(P.trimMat, P.trim, 0.025, 6, 4, T(x, -0.13, 0.33));
    }
    if (tier === 3) for (const sx of [-1, 1]) k.box('cloth', P.accent, 0.1, 0.62, 0.02, T(sx * 0.46, -0.36, 0.26, 0.1, 0, 0));
  }, 4);

  // 胸艙：上寬下窄的八角桶（肩寬約 1.3、腰約 0.8），前面銅柵艙門、護心鏡
  const torso = new THREE.Group();
  torso.position.y = 0.18;
  hips.add(torso);
  part(torso, V(0, 0, 0), (k) => {
    const shell = [[0, 0], [0.4, 0], [0.44, 0.12], [0.56, 0.55], [0.66, 0.98], [0.64, 1.14], [0.48, 1.26], [0, 1.26]];
    k.lathe(P.plateMat, P.plate, shell, 8, T(0, 0, 0, 0, Math.PI / 8, 0, 1, 1, 0.74));
    // 骨架肋條沿桶身
    for (const [x, z] of [[-0.42, -0.3], [0.42, -0.3], [-0.42, 0.3], [0.42, 0.3]]) frameRod(k, [x * 0.98, 0.04, z * 0.98], [x * 1.48, 1.0, z * 1.42], 0.045);
    if (tier === 1) {
      for (const [y, r] of [[0.3, 0.5], [0.8, 0.63]]) k.torus('cloth', P.trim, r, 0.03, 4, 24, Math.PI * 2, T(0, y, 0, Math.PI / 2, 0, 0, 1, 0.74, 1)); // 麻繩綑紮
    } else {
      for (const [y, r] of [[0.08, 0.43], [1.0, 0.67]]) {
        k.torus(P.trimMat, P.trim, r, 0.03, 5, 32, Math.PI * 2, T(0, y, 0, Math.PI / 2, 0, 0, 1, 0.74, 1));
        rivetRing(k, P.trimMat, P.trim, r + 0.01, y + 0.05, 14, T(0, 0, 0, 0, 0, 0, 1, 1, 0.74));
      }
    }
    // 艙門：銅柵（裡面一點暖光）
    k.box(P.plateMat, P.plate, 0.92, 0.14, 0.06, T(0, 1.02, 0.5));
    k.box(P.plateMat, P.plate, 0.68, 0.14, 0.06, T(0, 0.2, 0.42));
    for (let i = 0; i < 6; i++) k.rod(P.trimMat, P.trim, [-0.3 + i * 0.12, 0.26, 0.44], [-0.38 + i * 0.152, 0.96, 0.5], 0.02);
    k.box('paper', 0xff9a3a, 0.62, 0.62, 0.02, T(0, 0.6, 0.36)); // 艙內燈光
    k.cyl(P.trimMat, P.trim, 0.18, 0.18, 0.05, 20, T(0, 0.62, 0.52, Math.PI / 2, 0, 0));
    gear(k, P.jointMat, P.joint, 0.14, 0.04, 14, T(0, 0.62, 0.55));
    // 肩甲：三片疊的魚鱗甲
    for (const sx of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const r = 0.36 - j * 0.06;
        k.add(P.plateMat, new THREE.CylinderGeometry(r * 0.85, r, 0.1, 10, 1, false, 0, Math.PI), j === 1 ? P.trim : P.plate, T(sx * (0.8 + j * 0.05), 1.2 - j * 0.15, 0, 0, sx > 0 ? 0 : Math.PI, -sx * (0.35 + j * 0.12)));
      }
    }
  }, 5);

  // 頭：竹骨戴斗笠；銅骨是銅盔加護頰；金樞「不周」再加冠翎。眼縫一點暖光
  const head = part(torso, V(0, 1.27, 0.04), (k) => {
    k.lathe(P.plateMat, P.plate, [[0, 0], [0.16, 0], [0.2, 0.12], [0.2, 0.3], [0.15, 0.42], [0, 0.44]], 10, T(0, 0, 0, 0, 0, 0, 1, 1, 0.92));
    k.box(P.trimMat, P.trim, 0.3, 0.05, 0.05, T(0, 0.27, 0.17));
    for (const sx of [-1, 1]) k.box('paper', 0xffb24a, 0.09, 0.025, 0.02, T(sx * 0.08, 0.22, 0.19));
    if (tier === 1) {
      k.cone('wood', 0xb8a06a, 0.48, 0.24, 16, T(0, 0.52, 0)); // 斗笠
      k.torus('cloth', P.trim, 0.2, 0.02, 4, 16, Math.PI * 2, T(0, 0.42, 0, Math.PI / 2, 0, 0));
    } else {
      k.lathe(P.trimMat, P.trim, [[0, 0.22], [0.25, 0.22], [0.25, 0.26], [0.22, 0.4], [0.12, 0.49], [0, 0.5]], 12, T(0, 0, 0));
      for (const sx of [-1, 1]) k.box(P.trimMat, P.trim, 0.05, 0.22, 0.18, T(sx * 0.21, 0.13, 0.06, 0, 0, sx * 0.12)); // 護頰
      k.cone(P.trimMat, P.trim, 0.04, 0.22, 6, T(0, 0.6, 0));
    }
    if (tier === 3) {
      for (const sx of [-1, 1]) k.box(P.trimMat, P.trim, 0.04, 0.55, 0.1, T(sx * 0.16, 0.7, -0.12, -0.5, 0, sx * -0.25));
      k.box('cloth', P.accent, 0.06, 0.4, 0.02, T(0, 0.42, -0.24, 0.5, 0, 0));
    }
  }, 6);
  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 1.0, 0);
  head.add(headAnchor);

  // 背上的發條樞輪：縮小、加厚，外套半圓筒護罩，旁邊有搖柄與發條盤簧，背面看得出是機關
  const wr = tier === 3 ? 0.46 : 0.4;
  const wheel = part(torso, V(0, 0.72, -0.6), (k) => {
    gear(k, P.frameMat, tier === 1 ? 0xa88a54 : P.trim, wr, 0.12, tier === 3 ? 20 : 16, T(0, 0, 0), 0.22);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      k.box(P.frameMat, P.frame, 0.05, wr * 0.75, 0.05, T(Math.sin(a) * wr * 0.4, Math.cos(a) * wr * 0.4, 0, 0, 0, -a));
    }
    k.cyl(P.trimMat, P.trim, 0.08, 0.08, 0.22, 12, T(0, 0, 0, Math.PI / 2, 0, 0));
  }, 7);
  part(torso, V(0, 0.72, -0.6), (k) => {
    // 半圓筒護罩（罩住上半）
    k.add(P.plateMat, new THREE.CylinderGeometry(wr + 0.1, wr + 0.1, 0.26, 16, 1, true, -Math.PI / 2, Math.PI), P.plate, T(0, 0, 0, Math.PI / 2, 0, 0));
    k.torus(P.trimMat, P.trim, wr + 0.1, 0.025, 4, 16, Math.PI, T(0, 0, -0.13));
    // 發條盤簧（側面一卷）
    const pts = [];
    for (let i = 0; i <= 40; i++) { const a = i * 0.45, r = 0.04 + i * 0.0042; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    k.add(P.trimMat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.012, 4), P.trim, T(-(wr + 0.24), -0.18, 0.02, 0, Math.PI / 2, 0));
    // 搖柄
    k.rod(P.trimMat, P.trim, [wr + 0.14, -0.1, 0.0], [wr + 0.3, -0.1, -0.12], 0.025);
    k.rod(P.trimMat, P.trim, [wr + 0.3, -0.1, -0.12], [wr + 0.3, -0.34, -0.12], 0.025);
    k.cyl('wood', 0x4a3524, 0.035, 0.035, 0.16, 8, T(wr + 0.3, -0.42, -0.12));
    if (tier === 3) {
      // 背旗：一面朱色鏢旗，拉長剪影
      k.rod('wood', 0x3d2a1c, [-0.52, -0.5, -0.1], [-0.62, 1.4, -0.1], 0.03);
      k.add('cloth', new THREE.PlaneGeometry(0.4, 0.66), P.accent, T(-0.8, 1.05, -0.1, 0, 0, 0.05), 0.02);
    }
  }, 17);
  const small = part(torso, V(0.42, 1.02, -0.5), (k) => gear(k, P.jointMat, P.trim, 0.18, 0.06, 10, T(0, 0, 0)), 9);

  // 手臂：肩齒輪、上臂、前臂；肘外露一根斜拉連桿
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = part(torso, V(sx * 0.84, 1.02, 0), (k) => {
      gear(k, P.jointMat, P.joint, 0.2, 0.1, 12, T(sx * 0.06, 0, 0, 0, Math.PI / 2, 0));
      k.box(P.jointMat, P.joint, 0.14, 0.14, 0.14, T(sx * 0.1, -0.04, 0));
      const g = new Kit(); limb(g, tier, P, 0.72, 0.15, 0.12, frameRod); k.merge(g, T(sx * 0.12, -0.08, 0));
      k.rod(P.trimMat, P.trim, [sx * 0.24, -0.2, -0.06], [sx * 0.22, -0.82, 0.08], 0.022); // 肘拉桿
    }, 10);
    const fa = part(sh, V(sx * 0.12, -0.84, 0.02), (k) => {
      gear(k, P.jointMat, P.joint, 0.12, 0.08, 10, T(0, 0, 0, 0, Math.PI / 2, 0));
      const g = new Kit(); limb(g, tier, P, 0.62, 0.13, 0.11, frameRod); k.merge(g, T(0, -0.04, 0.02));
      // 手：掌＋三指
      k.box(P.frameMat, P.frame, 0.18, 0.12, 0.18, T(0, -0.72, 0.06));
      for (let f = -1; f <= 1; f++) k.box(P.jointMat, P.joint, 0.045, 0.14, 0.05, T(f * 0.055, -0.84, 0.12));
      if (sx < 0) {
        // 連弩匣：箭槽與弩臂
        k.box(P.plateMat, P.plate, 0.18, 0.18, 0.7, T(-0.18, -0.4, 0.25));
        for (let i = 0; i < 3; i++) k.cyl('iron', 0x3a3530, 0.015, 0.015, 0.6, 4, T(-0.18 + (i - 1) * 0.05, -0.3, 0.32, Math.PI / 2, 0, 0));
        k.box(P.frameMat, P.frame, 0.7, 0.04, 0.04, T(-0.18, -0.3, 0.55));
      }
    }, 11);
    arms.push({ sh, fa, sx });
  }
  // 千鈞錘（掛右手）
  part(arms[1].fa, V(0, -0.76, 0.08), (k) => {
    k.cyl('wood', 0x4a3524, 0.045, 0.05, 1.7, 8, T(0, 0, 0.5, Math.PI / 2, 0, 0));
    k.cyl(P.trimMat, P.trim, 0.055, 0.055, 0.12, 8, T(0, 0, -0.25, Math.PI / 2, 0, 0));
    k.lathe(P.jointMat, P.joint, [[0, 0], [0.16, 0], [0.22, 0.08], [0.22, 0.48], [0.16, 0.56], [0, 0.56]], 8, T(0, 0, 1.1, Math.PI / 2, 0, 0));
    for (const z of [1.18, 1.58]) k.torus(P.trimMat, P.trim, 0.225, 0.03, 4, 16, Math.PI * 2, T(0, 0, z));
  }, 12);

  // 腿：大腿 0.85、小腿 0.8，膝外一根連桿，腳是三爪獸足
  const legs = [];
  for (const sx of [-1, 1]) {
    const th = part(hips, V(sx * 0.3, -0.08, 0), (k) => {
      gear(k, P.jointMat, P.joint, 0.17, 0.1, 10, T(sx * 0.14, 0, 0, 0, Math.PI / 2, 0));
      const g = new Kit(); limb(g, tier, P, 0.85, 0.17, 0.13, frameRod); k.merge(g, T(0, -0.02, 0.03));
      k.rod(P.trimMat, P.trim, [sx * 0.2, -0.15, 0.08], [sx * 0.18, -0.9, 0.12], 0.024); // 膝拉桿
    }, 13);
    const sn = part(th, V(0, -0.88, 0.04), (k) => {
      gear(k, P.jointMat, P.joint, 0.13, 0.12, 10, T(0, 0, 0, 0, Math.PI / 2, 0));
      const g = new Kit(); limb(g, tier, P, 0.72, 0.14, 0.1, frameRod); k.merge(g, T(0, -0.04, 0));
      // 三爪獸足：腳掌、三根前爪、一根後距
      k.box(P.frameMat, P.frame, 0.24, 0.12, 0.3, T(0, -0.82, 0.06));
      for (let f = -1; f <= 1; f++) {
        k.box(P.jointMat, P.joint, 0.08, 0.08, 0.22, T(f * 0.1, -0.84, 0.3, 0, f * 0.25, 0));
        k.cone(P.trimMat, P.trim, 0.035, 0.12, 5, T(f * 0.13, -0.86, 0.44, Math.PI / 2, 0, 0));
      }
      k.cone(P.jointMat, P.joint, 0.05, 0.2, 5, T(0, -0.84, -0.16, -Math.PI / 2, 0, 0));
    }, 14);
    legs.push({ th, sn });
  }
  return { root, hips, torso, head, headAnchor, wheel, small, arms, legs };
}

export function buildMechRig() {
  const g = new THREE.Group();
  const tiers = { 1: buildTier(1), 2: buildTier(2), 3: buildTier(3) };
  for (const k of [1, 2, 3]) {
    tiers[k].root.visible = k === 1;
    g.add(tiers[k].root);
  }
  const headAnchor = new THREE.Object3D();
  g.add(headAnchor);
  let cur = 1;
  let gait = 0;
  g.userData = {
    tiers,
    tier: 1,
    headAnchor,
    setTier(t) {
      if (t === cur) return;
      tiers[cur].root.visible = false;
      cur = tiers[t] ? t : 1;
      tiers[cur].root.visible = true;
    },
    animate(dt, t, speed, swing) {
      const R = tiers[cur];
      const walk = Math.min(1, speed / 3);
      gait += dt * (1.6 + speed * 1.2);
      R.legs.forEach((L, i) => {
        const ph = gait + i * Math.PI;
        L.th.rotation.x = Math.sin(ph) * 0.42 * walk;
        L.sn.rotation.x = Math.max(0, -Math.sin(ph + 0.6)) * 0.55 * walk;
      });
      R.hips.position.y = HIP_Y - Math.abs(Math.sin(gait)) * 0.06 * walk;
      R.torso.rotation.z = Math.sin(gait) * 0.04 * walk;
      R.wheel.rotation.z = t * 1.2;
      R.small.rotation.z = -t * 2.6;
      const sw = swing > 0 ? Math.sin((1 - swing) * Math.PI) : 0;
      R.arms.forEach((A, i) => {
        const base = -Math.sin(gait + i * Math.PI) * 0.3 * walk;
        if (i === 1) {
          A.sh.rotation.x = swing > 0 ? -2.4 * Math.sin(Math.min(1, (1 - swing) * 1.6) * Math.PI * 0.5) + sw * 1.6 : -0.15 + base;
          A.fa.rotation.x = -0.5;
        } else {
          A.sh.rotation.x = -0.35 + base * 0.5;
          A.fa.rotation.x = -0.9;
        }
        A.sh.rotation.z = A.sx * 0.12;
      });
      R.head.rotation.y = Math.sin(t * 0.7) * 0.1;
      R.headAnchor.getWorldPosition(headAnchor.position);
      g.worldToLocal(headAnchor.position);
    },
  };
  return g;
}

export function updateMechAppearance(mechGroup, tier = 1) {
  const info = MECH_TIERS[tier] || MECH_TIERS[1];
  mechGroup.userData.setTier(info.tier);
  mechGroup.scale.setScalar(info.scale * 0.5);
}
