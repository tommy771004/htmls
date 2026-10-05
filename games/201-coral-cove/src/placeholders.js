// 程式佔位幾何：GLB 還沒做好（或缺某個節點）時用，節點名稱、原點與骨頭名稱都照 SPEC，
// 遊戲其他模組用 getObjectByName 取用時不必分辨來源。動畫用程式產生的 AnimationClip。
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './terrain.js';

const mats = new Map();
export function pmat(color, rough = 0.9) {
  const k = color + rough;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true }));
  return mats.get(k);
}
// 低多邊形化：合併頂點→抖動→拆面→平面法線
export function lowpoly(geo, jit = 0, seed = 1) {
  let g = geo.index ? geo : geo;
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  if (jit) {
    const r = rng(seed), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (r() - 0.5) * jit, p.getY(i) + (r() - 0.5) * jit, p.getZ(i) + (r() - 0.5) * jit);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}
function M(geo, color, { jit = 0, seed = 1, pos, rot, scl, name } = {}) {
  const m = new THREE.Mesh(lowpoly(geo, jit, seed), pmat(color));
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scl) m.scale.set(...scl);
  if (name) m.name = name;
  return m;
}
const N = (name, pos = [0, 0, 0], kids = []) => { const o = new THREE.Object3D(); o.name = name; o.position.set(...pos); kids.forEach((k) => o.add(k)); return o; };
const D = Math.PI / 180;

const C = {
  sand: '#f2dfb8', wet: '#e3c595', wood: '#c49a6c', woodOld: '#a5805c', woodDark: '#7d5f45',
  straw: '#e8c983', strawDark: '#c9a35f', kelp: '#7fb58a', kelpDark: '#5e9670',
  shirt: '#e9967a', pants: '#56717f', skin: '#e7b58f', belt: '#7d5f45', ink: '#3b3732', paper: '#fbf3e2',
};

// ───────────── 漁夫 ─────────────
export function fisherPH() {
  const rig = N('fisher_rig');
  const root = N('root'); rig.add(root);
  const hips = N('hips', [0, 0.82, 0]); root.add(hips);
  hips.add(M(new THREE.CylinderGeometry(0.17, 0.16, 0.2, 7), C.belt, { pos: [0, 0, 0] }));
  const spine = N('spine', [0, 0.1, 0]); hips.add(spine);
  spine.add(M(new THREE.CylinderGeometry(0.18, 0.17, 0.2, 7), C.shirt, { pos: [0, 0.1, 0], jit: 0.01 }));
  const chest = N('chest', [0, 0.2, 0]); spine.add(chest);
  chest.add(M(new THREE.CylinderGeometry(0.2, 0.18, 0.28, 7), C.shirt, { pos: [0, 0.13, 0], jit: 0.012 }));
  const neck = N('neck', [0, 0.28, 0]); chest.add(neck);
  const head = N('head', [0, 0.06, 0]); neck.add(head);
  head.add(M(new THREE.IcosahedronGeometry(0.17, 1), C.skin, { pos: [0, 0.17, 0], scl: [1, 1.05, 1], jit: 0.01 }));
  head.add(M(new THREE.SphereGeometry(0.022, 5, 4), C.ink, { pos: [0.06, 0.2, 0.15] }));
  head.add(M(new THREE.SphereGeometry(0.022, 5, 4), C.ink, { pos: [-0.06, 0.2, 0.15] }));
  head.add(M(new THREE.ConeGeometry(0.46, 0.3, 12, 1), C.straw, { pos: [0, 0.42, 0], jit: 0.015, seed: 3 }));
  head.add(M(new THREE.CylinderGeometry(0.46, 0.44, 0.03, 12), C.strawDark, { pos: [0, 0.27, 0] }));
  const arm = (s) => {
    const ua = N('upperarm_' + s, [s === 'L' ? 0.25 : -0.25, 0.22, 0]); chest.add(ua);
    ua.add(M(new THREE.CylinderGeometry(0.06, 0.055, 0.28, 6), C.shirt, { pos: [0, -0.13, 0] }));
    const fa = N('forearm_' + s, [0, -0.27, 0]); ua.add(fa);
    fa.add(M(new THREE.CylinderGeometry(0.05, 0.045, 0.25, 6), C.skin, { pos: [0, -0.12, 0] }));
    const h = N('hand_' + s, [0, -0.25, 0]); fa.add(h);
    h.add(M(new THREE.IcosahedronGeometry(0.055, 0), C.skin, { pos: [0, -0.04, 0] }));
    return h;
  };
  arm('L'); const hR = arm('R');
  const leg = (s) => {
    const th = N('thigh_' + s, [s === 'L' ? 0.1 : -0.1, -0.06, 0]); hips.add(th);
    th.add(M(new THREE.CylinderGeometry(0.08, 0.07, 0.38, 6), C.pants, { pos: [0, -0.19, 0] }));
    const sh = N('shin_' + s, [0, -0.38, 0]); th.add(sh);
    sh.add(M(new THREE.CylinderGeometry(0.065, 0.055, 0.34, 6), C.pants, { pos: [0, -0.17, 0] }));
    const ft = N('foot_' + s, [0, -0.34, 0]); sh.add(ft);
    ft.add(M(new THREE.BoxGeometry(0.11, 0.06, 0.2), C.woodDark, { pos: [0, -0.01, 0.04] }));
  };
  leg('L'); leg('R');
  // 釣竿：rod_0 在右手，竿身沿 rod_0 的 +Z，四節共 2.2 m
  let prev = N('rod_0', [0, -0.04, 0]); hR.add(prev);
  prev.add(M(new THREE.CylinderGeometry(0.02, 0.022, 0.3, 5), C.woodDark, { pos: [0, 0, 0.0], rot: [90 * D, 0, 0] }));
  prev.add(M(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), C.ink, { pos: [0.05, -0.03, 0.08], rot: [0, 0, 90 * D] }));
  const segL = 0.55;
  prev.add(M(new THREE.CylinderGeometry(0.014, 0.018, segL, 5), C.wood, { pos: [0, 0, segL / 2], rot: [90 * D, 0, 0] }));
  for (let i = 1; i <= 3; i++) {
    const b = N('rod_' + i, [0, 0, segL]); prev.add(b);
    const r0 = 0.014 - i * 0.003;
    b.add(M(new THREE.CylinderGeometry(Math.max(0.004, r0 - 0.003), r0, segL, 5), i === 3 ? C.shirt : C.wood, { pos: [0, 0, segL / 2], rot: [90 * D, 0, 0] }));
    prev = b;
  }
  prev.add(N('rod_tip', [0, 0, segL]));
  rig.updateMatrixWorld(true);
  return { scene: rig, clips: fisherClips() };
}

// 姿勢（度）；沒列到的骨頭是 0
const POSE = {
  idle: { upperarm_R: [-20, 0, -8], forearm_R: [-110, 0, 0], hand_R: [-13, 0, 0], upperarm_L: [-8, 0, 6], forearm_L: [-12, 0, 0] },
  windup: { upperarm_R: [-150, 0, -10], forearm_R: [-20, 0, 0], hand_R: [50, 0, 0], spine: [-8, 18, 0], upperarm_L: [-30, 0, 15], forearm_L: [-40, 0, 0] },
  release: { upperarm_R: [-85, 0, -6], forearm_R: [-8, 0, 0], hand_R: [68, 0, 0], spine: [10, -8, 0], upperarm_L: [-25, 0, 10], forearm_L: [-30, 0, 0] },
  wait: { upperarm_R: [-35, 0, -4], forearm_R: [-45, 0, 0], hand_R: [55, 0, 0], upperarm_L: [-40, 0, -20], forearm_L: [-50, 0, 0] },
  hook: { upperarm_R: [-65, 0, -6], forearm_R: [-70, 0, 0], hand_R: [55, 0, 0], spine: [-14, 0, 0], upperarm_L: [-55, 0, -20], forearm_L: [-60, 0, 0] },
  reel: { upperarm_R: [-42, 0, -5], forearm_R: [-50, 0, 0], hand_R: [47, 0, 0], spine: [-10, 0, 0], rod_1: [10, 0, 0], rod_2: [14, 0, 0], rod_3: [18, 0, 0], upperarm_L: [-45, 0, -25], forearm_L: [-65, 0, 0] },
  reel2: { upperarm_R: [-42, 0, -5], forearm_R: [-50, 0, 0], hand_R: [47, 0, 0], spine: [-12, 0, 0], rod_1: [12, 0, 0], rod_2: [17, 0, 0], rod_3: [22, 0, 0], upperarm_L: [-55, 0, -15], forearm_L: [-45, 0, 0] },
  cheer: { upperarm_R: [-20, 0, -8], forearm_R: [-110, 0, 0], hand_R: [-13, 0, 0], upperarm_L: [-165, 0, 10], forearm_L: [-10, 0, 0], spine: [-6, 0, 0] },
};
const BONES = ['hips', 'spine', 'chest', 'head', 'upperarm_L', 'forearm_L', 'hand_L', 'upperarm_R', 'forearm_R', 'hand_R', 'thigh_L', 'shin_L', 'thigh_R', 'shin_R', 'rod_1', 'rod_2', 'rod_3'];
function clipFrom(name, keys) {
  // keys: [[t, pose, hipsY?]]
  const tracks = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const b of BONES) {
    if (!keys.some(([, p]) => p[b])) continue;
    const times = [], vals = [];
    for (const [t, p] of keys) {
      const r = p[b] || [0, 0, 0];
      q.setFromEuler(e.set(r[0] * D, r[1] * D, r[2] * D));
      times.push(t); vals.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, vals));
  }
  if (keys.some((k) => k[2] != null)) tracks.push(new THREE.VectorKeyframeTrack('hips.position', keys.map((k) => k[0]), keys.flatMap((k) => [0, 0.82 + (k[2] || 0), 0])));
  return new THREE.AnimationClip(name, keys[keys.length - 1][0], tracks);
}
const mix = (a, b, extra = {}) => ({ ...a, ...b, ...extra });
function fisherClips() {
  const P = POSE;
  const breathe = mix(P.idle, { chest: [-3, 0, 0] });
  const step = (s) => mix(P.idle, {
    thigh_L: [-28 * s, 0, 0], shin_L: [s < 0 ? 30 : 8, 0, 0], thigh_R: [28 * s, 0, 0], shin_R: [s > 0 ? 30 : 8, 0, 0],
    upperarm_L: [20 * s, 0, 6], spine: [0, 6 * s, 0],
  });
  const waitB = mix(P.wait, { spine: [3, 0, 0], hand_R: [58, 0, 0] });
  return [
    clipFrom('idle', [[0, P.idle, 0], [1, breathe, -0.01], [2, P.idle, 0]]),
    clipFrom('walk', [[0, step(1), 0], [0.225, P.idle, 0.04], [0.45, step(-1), 0], [0.675, P.idle, 0.04], [0.9, step(1), 0]]),
    clipFrom('cast', [[0, P.idle, 0], [0.42, P.windup, 0], [0.55, P.release, 0], [0.65, mix(P.release, { hand_R: [60, 0, 0] }), 0], [1.0, P.wait, 0]]),
    clipFrom('wait', [[0, P.wait, 0], [1.2, waitB, -0.008], [2.4, P.wait, 0]]),
    clipFrom('hook', [[0, P.wait, 0], [0.15, P.hook, 0.02], [0.4, P.reel, 0]]),
    clipFrom('reel', [[0, P.reel, 0], [0.3, P.reel2, -0.01], [0.6, P.reel, 0]]),
    clipFrom('stow', [[0, P.wait, 0], [0.4, mix(P.idle, { upperarm_R: [-60, 0, -8] }), 0], [0.8, P.idle, 0]]),
    clipFrom('cheer', [[0, P.idle, 0], [0.3, P.cheer, 0.12], [0.55, P.cheer, 0], [0.8, P.cheer, 0.06], [1.2, P.cheer, 0]]),
  ];
}

// ───────────── 魚 ─────────────
export const SPECIES = {
  clown: { name: '小丑魚', len: 0.30, w: 0.11, h: 0.15, body: '#f7a464', belly: '#fbe2c8', fin: '#3b3732', band: '#fbf3e2' },
  tang: { name: '藍倒吊', len: 0.40, w: 0.08, h: 0.24, body: '#7fa8d6', belly: '#a9c6e6', fin: '#f2cf63', band: '#3b3732' },
  snapper: { name: '紅笛鯛', len: 0.55, w: 0.12, h: 0.2, body: '#f0958a', belly: '#fbe6dc', fin: '#e57d73' },
  puffer: { name: '河豚', len: 0.36, w: 0.22, h: 0.22, body: '#f2db95', belly: '#fbf3e2', fin: '#c9a35f', spot: '#a5805c' },
  parrot: { name: '鸚哥魚', len: 0.62, w: 0.15, h: 0.24, body: '#8fd1b5', belly: '#f4b6b0', fin: '#f4a196' },
  sardine: { name: '小沙丁魚', len: 0.16, w: 0.04, h: 0.05, body: '#8fa9bd', belly: '#eef2f2', fin: '#b9c9d4' },
};
export function fishPH(id) {
  const s = SPECIES[id], L = s.len;
  const rig = N(id + '_rig');
  const b0 = N(id + '_b0', [0, 0, L * 0.18]); rig.add(b0);
  const b1 = N(id + '_b1', [0, 0, -L * 0.2]); b0.add(b1);
  const b2 = N(id + '_b2', [0, 0, -L * 0.2]); b1.add(b2);
  const b3 = N(id + '_b3', [0, 0, -L * 0.17]); b2.add(b3);
  const body = new THREE.OctahedronGeometry(0.5, 1);
  b0.add(M(body.clone(), s.body, { pos: [0, 0, 0.02 * L], scl: [s.w, s.h, L * 0.42] }));
  b0.add(M(new THREE.OctahedronGeometry(0.5, 0), s.belly, { pos: [0, -s.h * 0.18, 0.04 * L], scl: [s.w * 0.8, s.h * 0.5, L * 0.3] }));
  b0.add(M(new THREE.SphereGeometry(0.5, 4, 3), C.ink, { pos: [s.w * 0.42, s.h * 0.12, L * 0.12], scl: [0.03 * L * 2, 0.03 * L * 2, 0.03 * L * 2] }));
  b0.add(M(new THREE.SphereGeometry(0.5, 4, 3), C.ink, { pos: [-s.w * 0.42, s.h * 0.12, L * 0.12], scl: [0.03 * L * 2, 0.03 * L * 2, 0.03 * L * 2] }));
  b1.add(M(body.clone(), s.body, { pos: [0, 0, -0.02 * L], scl: [s.w * 0.92, s.h * 0.92, L * 0.36] }));
  b1.add(M(new THREE.ConeGeometry(0.5, 1, 3), s.fin, { pos: [0, s.h * 0.55, -0.04 * L], scl: [0.02, s.h * 0.45, L * 0.3], rot: [0, 0, 0] }));
  if (s.band) b1.add(M(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), s.band, { pos: [0, 0, 0.06 * L], rot: [90 * D, 0, 0], scl: [s.w * 0.98, L * 0.05, s.h * 0.95] }));
  b2.add(M(body.clone(), s.body, { pos: [0, 0, -0.04 * L], scl: [s.w * 0.6, s.h * 0.62, L * 0.3] }));
  if (s.spot) b2.add(M(new THREE.SphereGeometry(0.5, 4, 3), s.spot, { pos: [0, s.h * 0.2, 0.05 * L], scl: [s.w * 0.4, 0.03, 0.06] }));
  const tail = new THREE.ConeGeometry(0.5, 1, 4);
  b3.add(M(tail, s.fin, { pos: [0, 0, -0.08 * L], rot: [-90 * D, 0, 0], scl: [0.02 + s.w * 0.05, L * 0.2, s.h * 1.0] }));
  return { scene: rig, clips: fishClips(id) };
}
function fishClips(id) {
  const mk = (name, dur, amp, n = 8) => {
    const tracks = [];
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    [[0, -0.4], [1, 0.6], [2, 1], [3, 1.3]].forEach(([bi, k]) => {
      const times = [], vals = [];
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * dur;
        const a = Math.sin((i / n) * Math.PI * 2 - bi * 0.9) * amp * k;
        q.setFromEuler(e.set(0, a, 0)); times.push(t); vals.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${id}_b${bi}.quaternion`, times, vals));
    });
    return new THREE.AnimationClip(name, dur, tracks);
  };
  return [mk(id + '_swim', 0.8, 0.22), mk(id + '_flop', 0.4, 0.6)];
}

// ───────────── 海草 ─────────────
export function seaweedPH() {
  const rig = N('seaweed_rig');
  let p = rig;
  for (let i = 0; i < 4; i++) {
    const b = N('seaweed_' + i, [0, i ? 0.3 : 0, 0]); p.add(b);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i * 0.4;
      b.add(M(new THREE.ConeGeometry(0.07 - i * 0.012, 0.42, 3), k ? C.kelp : C.kelpDark, { pos: [Math.cos(a) * 0.05, 0.16, Math.sin(a) * 0.05], rot: [Math.sin(a) * 0.2, a, Math.cos(a) * 0.2], scl: [1, 1, 0.25] }));
    }
    p = b;
  }
  const tracks = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 4; i++) {
    const times = [], vals = [];
    for (let k = 0; k <= 12; k++) {
      const t = (k / 12) * 3, ph = (k / 12) * Math.PI * 2 - i * 0.7;
      q.setFromEuler(e.set(Math.sin(ph) * 0.18, 0, Math.cos(ph) * 0.12)); times.push(t); vals.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`seaweed_${i}.quaternion`, times, vals));
  }
  return { scene: rig, clips: [new THREE.AnimationClip('seaweed_sway', 3, tracks)] };
}

// ───────────── 道具與礁石 ─────────────
function plank(w, h, d, color, pos, seed) { return M(new THREE.BoxGeometry(w, h, d), color, { pos, jit: 0.012, seed }); }
export const PROP_PH = {
  pier() {
    const g = N('pier'); let seed = 1;
    const woods = [C.wood, C.wood, C.woodOld, C.wood];
    for (let z = -0.15; z > -13; z -= 0.32) g.add(plank(2.4, 0.07, 0.29, woods[seed % 4], [0, -0.035, z], seed++));
    for (let z = -13.15; z > -18; z -= 0.32) g.add(plank(6, 0.07, 0.29, woods[seed % 4], [0, -0.035, z], seed++));
    for (const x of [-1.15, 1.15]) {
      g.add(plank(0.08, 0.06, 13, C.woodOld, [x, 0.55, -6.5], seed++));
      for (let z = 0; z >= -12; z -= 2) g.add(plank(0.09, 0.6, 0.09, C.woodDark, [x, 0.28, z - 0.3], seed++));
    }
    for (let z = 0; z >= -12; z -= 2) for (const x of [-1.15, 1.15]) g.add(M(new THREE.CylinderGeometry(0.11, 0.12, 4, 6), C.woodDark, { pos: [x, -2.07, z], jit: 0.02, seed: seed++ }));
    for (const z of [-13.1, -15.5, -17.9]) for (const x of [-2.95, 0, 2.95]) g.add(M(new THREE.CylinderGeometry(0.13, 0.14, 4, 6), C.woodDark, { pos: [x, -2.07, z], jit: 0.02, seed: seed++ }));
    g.add(plank(0.18, 0.12, 13, C.woodDark, [0, -0.13, -6.5], seed++));
    for (const [x, z] of [[-2.8, -13.2], [2.8, -13.2], [-2.8, -17.8], [2.8, -17.8]]) g.add(M(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 7), C.woodDark, { pos: [x, 0.17, z], jit: 0.01 }));
    for (let i = 0; i < 6; i++) g.add(plank(0.6, 0.05, 0.08, C.woodOld, [-2.4, -0.25 - i * 0.28, -18.05], seed++));
    for (const x of [-2.72, -2.08]) g.add(plank(0.06, 1.8, 0.06, C.woodDark, [x, -0.85, -18.05], seed++));
    return g;
  },
  boat() {
    const g = N('boat');
    const sh = new THREE.Shape();
    sh.moveTo(0, 1.6); sh.quadraticCurveTo(0.68, 0.7, 0.62, -1.2); sh.quadraticCurveTo(0, -1.65, -0.62, -1.2); sh.quadraticCurveTo(-0.68, 0.7, 0, 1.6);
    const hole = new THREE.Path();
    hole.moveTo(0, 1.38); hole.quadraticCurveTo(0.56, 0.62, 0.52, -1.1); hole.quadraticCurveTo(0, -1.5, -0.52, -1.1); hole.quadraticCurveTo(-0.56, 0.62, 0, 1.38);
    sh.holes.push(hole);
    const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 5 });
    hull.rotateX(-Math.PI / 2); hull.translate(0, -0.3, 0); hull.scale(1, 1, -1);
    g.add(M(hull, C.wood, { jit: 0.01 }));
    const floor = new THREE.ShapeGeometry(new THREE.Shape(hole.getPoints(5)));
    floor.rotateX(-Math.PI / 2); floor.scale(1, 1, -1); floor.translate(0, -0.18, 0);
    g.add(M(floor, C.woodOld));
    g.add(plank(1.08, 0.05, 0.3, C.woodOld, [0, 0.0, -0.1], 7));
    g.add(plank(0.9, 0.05, 0.26, C.woodOld, [0, 0.0, -0.95], 8));
    for (const s of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.06, 0.03, 1.6), C.woodDark, { pos: [s * 0.3, 0.02, 0.1], rot: [0, s * 0.18, 0] }));
    g.add(M(new THREE.BoxGeometry(0.62, 0.06, 1.6), C.woodDark, { pos: [0, 0.205, 0.05], scl: [1, 0.5, 1] }));
    g.add(M(new THREE.TorusGeometry(0.16, 0.035, 4, 10), C.straw, { pos: [0, 0.0, 1.05], rot: [Math.PI / 2, 0, 0] }));
    return g;
  },
  crate() {
    const g = N('crate');
    g.add(M(new THREE.BoxGeometry(0.58, 0.58, 0.58), C.woodOld, { pos: [0, 0.29, 0], jit: 0.01 }));
    for (const y of [0.08, 0.5]) for (const s of [-1, 1]) {
      g.add(M(new THREE.BoxGeometry(0.62, 0.08, 0.04), C.woodDark, { pos: [0, y, s * 0.3] }));
      g.add(M(new THREE.BoxGeometry(0.04, 0.08, 0.62), C.woodDark, { pos: [s * 0.3, y, 0] }));
    }
    return g;
  },
  creel() {
    const g = N('creel');
    g.add(M(new THREE.CylinderGeometry(0.17, 0.2, 0.42, 9, 3, true), C.straw, { pos: [0, 0.21, 0], jit: 0.012 }));
    g.add(M(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 9), C.strawDark, { pos: [0, 0.01, 0] }));
    g.add(M(new THREE.TorusGeometry(0.175, 0.018, 4, 10), C.strawDark, { pos: [0, 0.42, 0], rot: [Math.PI / 2, 0, 0] }));
    g.add(M(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 9), C.strawDark, { pos: [0, 0.5, -0.17], rot: [-1.1, 0, 0] }));
    g.add(M(new THREE.TorusGeometry(0.2, 0.012, 3, 10, Math.PI), C.woodDark, { pos: [0, 0.3, 0], rot: [0, Math.PI / 2, 0] }));
    return g;
  },
  bobber() {
    const g = N('bobber');
    g.add(M(new THREE.SphereGeometry(0.035, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#f07c6c', { pos: [0, 0, 0] }));
    g.add(M(new THREE.SphereGeometry(0.035, 7, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), C.paper, { pos: [0, 0, 0] }));
    g.add(M(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 4), C.ink, { pos: [0, 0.07, 0] }));
    return g;
  },
  bread() { return N('bread', [0, 0, 0], [M(new THREE.BoxGeometry(0.05, 0.04, 0.05), '#f2cf8f', { jit: 0.008 })]); },
  bread_loaf() {
    const g = N('bread_loaf');
    g.add(M(new THREE.BoxGeometry(0.16, 0.1, 0.3), '#d9a463', { pos: [0, 0.05, 0], jit: 0.01 }));
    g.add(M(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 7, 1, false, -Math.PI / 2, Math.PI), '#c98e4f', { pos: [0, 0.1, 0], rot: [Math.PI / 2, 0, 0], jit: 0.006 }));
    return g;
  },
  hook() { return N('hook', [0, 0, 0], [M(new THREE.TorusGeometry(0.012, 0.002, 3, 8, Math.PI * 1.4), '#9aa3a6', { pos: [0, -0.02, 0] })]); },
};

const coralCol = ['#f4a196', '#f7c08f', '#c8a9d6', '#f6e3a1'];
export const REEF_PH = {
  coral_branch() {
    const g = N('coral_branch'); const r = rng(11);
    const add = (p, dir, len, rad, depth) => {
      const end = p.clone().addScaledVector(dir, len);
      const m = M(new THREE.CylinderGeometry(rad * 0.7, rad, len, 5), coralCol[0], { jit: 0.006, seed: depth * 7 + len * 100 | 0 });
      m.position.copy(p).lerp(end, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(m);
      if (depth < 3) for (let i = 0; i < 2; i++) {
        const nd = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.4, 0.2, (r() - 0.5) * 1.4)).normalize();
        add(end, nd, len * 0.75, rad * 0.7, depth + 1);
      }
    };
    add(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.28, 0.06, 0);
    return g;
  },
  coral_brain() { return N('coral_brain', [0, 0, 0], [M(new THREE.IcosahedronGeometry(0.4, 1), coralCol[1], { pos: [0, 0.18, 0], scl: [1, 0.6, 1], jit: 0.05, seed: 4 })]); },
  coral_fan() {
    const g = N('coral_fan');
    g.add(M(new THREE.CircleGeometry(0.42, 7), coralCol[2], { pos: [0, 0.5, 0], scl: [1, 1.05, 1], jit: 0.04, seed: 9 }));
    g.add(M(new THREE.CircleGeometry(0.42, 7), coralCol[2], { pos: [0, 0.5, -0.005], rot: [0, Math.PI, 0], jit: 0.04, seed: 9 }));
    g.add(M(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5), coralCol[2], { pos: [0, 0.1, 0] }));
    return g;
  },
  coral_tube() {
    const g = N('coral_tube'); const r = rng(5);
    for (let i = 0; i < 6; i++) { const h = 0.25 + r() * 0.25; g.add(M(new THREE.CylinderGeometry(0.05, 0.045, h, 6, 1, true), coralCol[3], { pos: [(r() - 0.5) * 0.3, h / 2, (r() - 0.5) * 0.3] })); }
    return g;
  },
  coral_plate() {
    const g = N('coral_plate');
    g.add(M(new THREE.CylinderGeometry(0.5, 0.42, 0.07, 9), coralCol[0], { pos: [0, 0.32, 0], jit: 0.03, seed: 2 }));
    g.add(M(new THREE.CylinderGeometry(0.06, 0.1, 0.3, 5), coralCol[0], { pos: [0, 0.15, 0] }));
    return g;
  },
  rock_a() { return N('rock_a', [0, 0, 0], [M(new THREE.DodecahedronGeometry(0.4, 0), '#b9ab95', { pos: [0, 0.25, 0], scl: [1.2, 0.75, 1], jit: 0.08, seed: 1 })]); },
  rock_b() { return N('rock_b', [0, 0, 0], [M(new THREE.DodecahedronGeometry(0.55, 0), '#a89a85', { pos: [0, 0.3, 0], scl: [1.3, 0.65, 1.1], jit: 0.1, seed: 2 })]); },
  rock_c() { return N('rock_c', [0, 0, 0], [M(new THREE.DodecahedronGeometry(0.3, 0), '#c4b6a0', { pos: [0, 0.18, 0], scl: [1, 0.8, 1.2], jit: 0.06, seed: 3 })]); },
  shell() { return N('shell', [0, 0, 0], [M(new THREE.ConeGeometry(0.07, 0.05, 7), '#f6d9c4', { pos: [0, 0.025, 0], scl: [1, 1, 0.8] })]); },
  starfish() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.045 : 0.125; s[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    return N('starfish', [0, 0, 0], [M(geo, '#f7a07a')]);
  },
  palm() {
    const g = N('palm'); const pts = [];
    let p = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      const n = new THREE.Vector3(Math.sin(i * 0.25) * 0.25, 0.82, 0).add(p);
      const m = M(new THREE.CylinderGeometry(0.12 - i * 0.01, 0.15 - i * 0.01, 0.86, 6), i % 2 ? C.woodOld : C.wood, { jit: 0.015, seed: i });
      m.position.copy(p).lerp(n, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().sub(p).normalize()); g.add(m);
      p = n; pts.push(n);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = new THREE.PlaneGeometry(0.5, 2.0, 1, 3);
      const pa = leaf.attributes.position;
      for (let k = 0; k < pa.count; k++) { const y = pa.getY(k) + 1; pa.setZ(k, -0.35 * y * y); pa.setX(k, pa.getX(k) * (1 - y / 2.3)); }
      leaf.translate(0, 1, 0); leaf.rotateX(Math.PI / 2 - 0.25);
      const m = M(leaf, i % 2 ? C.kelp : C.kelpDark, { jit: 0.02, seed: 20 + i });
      m.material = m.material.clone(); m.material.side = THREE.DoubleSide;
      m.position.copy(p); m.rotation.y = a; g.add(m);
    }
    for (let i = 0; i < 3; i++) g.add(M(new THREE.IcosahedronGeometry(0.11, 0), '#8a6a48', { pos: [p.x + Math.cos(i * 2.1) * 0.14, p.y - 0.12, Math.sin(i * 2.1) * 0.14] }));
    return g;
  },
  grass() {
    const g = N('grass'); const r = rng(8);
    for (let i = 0; i < 7; i++) g.add(M(new THREE.ConeGeometry(0.035, 0.3 + r() * 0.15, 3), i % 2 ? C.kelp : C.kelpDark, { pos: [(r() - 0.5) * 0.25, 0.17, (r() - 0.5) * 0.25], rot: [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5] }));
    return g;
  },
};
