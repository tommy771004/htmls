// 其他玩家的角色模型（程式建模的低多邊形士兵）、降落傘、運輸機與槍枝外型。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MODE } from '../core/player.js';
import { WEAPON_KEYS } from '../core/rules.js';

const UNIFORMS = [
  ['#a58d66', '#5d5038'], ['#6e7552', '#3e4230'], ['#7c7d78', '#3b3c3a'], ['#8a5a3c', '#4a3324'], ['#c2b08a', '#6b5d43'], ['#4d5547', '#2a2e27'],
];
const SKIN = ['#e3b996', '#c99772', '#a4714f', '#7d5238'];

function box(w, h, d, x = 0, y = 0, z = 0) {
  // 圓角方塊：槍身邊緣有倒角，光影比較像實物
  const r = Math.min(w, h, d) * 0.22;
  const g = r > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z); return g;
}

// 槍枝：方塊與圓柱組成，前方為 -z，原點在握把上緣；依材質分組後合併成 3 個網格
function cyl(r, len, x = 0, y = 0, z = 0, seg = 10) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; }
function tilt(g, a, x, y, z) { g.translate(-x, -y, -z); g.rotateX(a); g.translate(x, y, z); return g; }
export function gunGeometry(w) {
  const P = { metal: [], poly: [], wood: [], tan: [], glass: [] };
  const mag = (list, z0, n, w2, h, d, curve) => { for (let i = 0; i < n; i++) list.push(tilt(box(w2, h, d, 0, -0.035 - i * h * 0.92, z0 - i * curve), i * 0.09, 0, -0.035, z0)); };
  if (w === 'p9') {
    P.metal.push(box(0.03, 0.035, 0.19, 0, 0.045, -0.07));                    // 滑套
    for (let i = 0; i < 5; i++) P.metal.push(box(0.032, 0.03, 0.004, 0, 0.045, 0.0 + i * 0.008 - 0.03));
    P.poly.push(box(0.027, 0.025, 0.16, 0, 0.018, -0.06), tilt(box(0.028, 0.11, 0.042, 0, -0.04, 0.012), -0.22, 0, 0, 0.01));
    P.poly.push(box(0.008, 0.03, 0.04, 0, -0.006, -0.04));                   // 扳機護弓
    P.metal.push(box(0.006, 0.01, 0.008, 0, 0.067, -0.155), box(0.02, 0.01, 0.008, 0, 0.067, 0.012));
  } else if (w === 'smg') {
    P.poly.push(box(0.045, 0.07, 0.3, 0, 0.03, -0.1), box(0.04, 0.03, 0.12, 0, 0.0, -0.25));
    P.metal.push(cyl(0.017, 0.12, 0, 0.04, -0.31), cyl(0.009, 0.05, 0, 0.04, -0.39));
    mag(P.metal, -0.15, 3, 0.03, 0.05, 0.04, 0.0);
    P.poly.push(tilt(box(0.03, 0.1, 0.04, 0, -0.04, 0.02), -0.25, 0, 0, 0.02));
    P.metal.push(box(0.012, 0.012, 0.22, -0.018, 0.035, 0.15), box(0.012, 0.012, 0.22, 0.018, 0.035, 0.15), box(0.05, 0.05, 0.012, 0, 0.03, 0.26));
    P.metal.push(box(0.03, 0.012, 0.16, 0, 0.072, -0.1));
  } else if (w === 'ar') {
    P.metal.push(box(0.048, 0.066, 0.32, 0, 0.03, -0.09), cyl(0.024, 0.3, 0, 0.055, -0.09, 12));       // 機匣與護蓋
    P.metal.push(cyl(0.011, 0.3, 0, 0.035, -0.4), cyl(0.012, 0.22, 0, 0.065, -0.36), cyl(0.016, 0.045, 0, 0.035, -0.57));
    P.wood.push(box(0.056, 0.058, 0.2, 0, 0.022, -0.35), box(0.044, 0.026, 0.15, 0, 0.068, -0.34));
    P.metal.push(box(0.006, 0.035, 0.012, 0, 0.065, -0.53), box(0.028, 0.02, 0.04, 0, 0.083, -0.16));
    mag(P.metal, -0.09, 4, 0.03, 0.048, 0.06, 0.018);
    P.poly.push(tilt(box(0.032, 0.105, 0.045, 0, -0.045, 0.03), -0.28, 0, 0, 0.03));
    P.wood.push(box(0.042, 0.06, 0.26, 0, 0.015, 0.2), tilt(box(0.04, 0.05, 0.2, 0, -0.03, 0.2), 0.18, 0, 0, 0.08));
    P.poly.push(cyl(0.021, 0.06, 0, 0.115, -0.08, 14), box(0.03, 0.012, 0.07, 0, 0.096, -0.08));              // 紅點鏡
    for (let i = 0; i < 9; i++) P.metal.push(box(0.03, 0.008, 0.008, 0, 0.09, -0.02 - i * 0.018));            // 導軌齒
    P.poly.push(box(0.004, 0.02, 0.05, 0.026, 0.045, -0.05));                                                 // 拋殼口
    P.glass.push(box(0.026, 0.026, 0.004, 0, 0.115, -0.112));
  } else if (w === 'sg') {
    P.metal.push(box(0.05, 0.07, 0.24, 0, 0.03, -0.06), cyl(0.014, 0.5, 0, 0.055, -0.43), cyl(0.012, 0.42, 0, 0.022, -0.39));
    P.wood.push(box(0.056, 0.05, 0.16, 0, 0.02, -0.38), box(0.046, 0.075, 0.28, 0, 0.0, 0.22), tilt(box(0.04, 0.05, 0.12, 0, -0.04, 0.09), 0.3, 0, 0, 0.06));
    P.metal.push(box(0.006, 0.012, 0.01, 0, 0.073, -0.67));
  } else if (w === 'dmr') {
    P.tan.push(box(0.05, 0.075, 0.4, 0, 0.03, -0.12), box(0.052, 0.07, 0.28, 0, 0.012, 0.24));
    P.metal.push(cyl(0.012, 0.36, 0, 0.045, -0.5), cyl(0.017, 0.05, 0, 0.045, -0.7), box(0.03, 0.012, 0.3, 0, 0.074, -0.12));
    mag(P.metal, -0.1, 3, 0.03, 0.045, 0.055, 0.0);
    P.poly.push(tilt(box(0.032, 0.105, 0.045, 0, -0.045, 0.03), -0.25, 0, 0, 0.03));
    P.poly.push(cyl(0.018, 0.2, 0, 0.115, -0.1, 14), cyl(0.024, 0.05, 0, 0.115, -0.22, 14), cyl(0.022, 0.04, 0, 0.115, 0.01, 14), box(0.012, 0.03, 0.02, 0, 0.09, -0.06), box(0.012, 0.03, 0.02, 0, 0.09, -0.15));
    P.glass.push(box(0.03, 0.03, 0.004, 0, 0.115, -0.246));
  } else {
    P.tan.push(box(0.056, 0.08, 0.36, 0, 0.02, -0.08), box(0.052, 0.09, 0.3, 0, 0.0, 0.26), box(0.04, 0.03, 0.14, 0, 0.065, 0.22));
    P.metal.push(cyl(0.013, 0.5, 0, 0.045, -0.5), cyl(0.02, 0.07, 0, 0.045, -0.77), box(0.04, 0.05, 0.08, 0, -0.02, -0.06));
    P.metal.push(cyl(0.008, 0.06, 0.04, 0.05, 0.03), box(0.014, 0.014, 0.014, 0.07, 0.05, 0.03));        // 槍機拉柄
    P.poly.push(cyl(0.024, 0.26, 0, 0.125, -0.06, 16), cyl(0.032, 0.07, 0, 0.125, -0.22, 16), cyl(0.028, 0.05, 0, 0.125, 0.1, 16), box(0.014, 0.035, 0.03, 0, 0.09, 0.0), box(0.014, 0.035, 0.03, 0, 0.09, -0.12));
    P.glass.push(box(0.04, 0.04, 0.004, 0, 0.125, -0.257));
  }
  return P;
}
// 迷彩貼圖：林地綠（槍身護木）與沙漠多地形（袖子）
export function camoTexture(pal, n = 70, seed = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  x.fillStyle = pal[0]; x.fillRect(0, 0, 256, 256);
  for (let k = 1; k < pal.length; k++) for (let i = 0; i < n; i++) {
    x.fillStyle = pal[k]; x.beginPath();
    const cx = rnd() * 256, cy = rnd() * 256, rr = 8 + rnd() * 26;
    for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, rad = rr * (0.6 + rnd() * 0.6); for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) void 0; x.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.7); }
    x.closePath(); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const gunMats = {
  metal: new THREE.MeshStandardMaterial({ color: '#2e2d2a', roughness: 0.35, metalness: 0.65 }),
  poly: new THREE.MeshStandardMaterial({ color: '#3b3a35', roughness: 0.7 }),
  wood: new THREE.MeshStandardMaterial({ map: camoTexture(['#4d6b34', '#2f4422', '#6f8a49', '#1f2a17'], 40, 7), roughness: 0.6 }),
  tan: new THREE.MeshStandardMaterial({ color: '#a8946c', roughness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: '#c8532d', roughness: 0.1, metalness: 0.3, emissive: '#5a1a08' }),
};
const gunCache = new Map();
export function gunMesh(w, scale = 1) {
  const key = w + scale;
  if (!gunCache.has(key)) {
    const parts = gunGeometry(w), g = new THREE.Group();
    for (const k of Object.keys(parts)) if (parts[k].length) {
      const geo = mergeGeometries(parts[k].map((x) => (x.index ? x.toNonIndexed() : x)));
      geo.scale(scale, scale, scale);
      g.add(new THREE.Mesh(geo, gunMats[k]));
    }
    gunCache.set(key, g);
  }
  const m = gunCache.get(key).clone();
  m.traverse((o) => { o.castShadow = true; });
  return m;
}

// ---- 士兵：Quaternius 人體＋動畫；沒有外部模型時用方塊人 ----
let SOLDIER = null;
const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;
export function setActors(A) {
  const g = A?.soldier;
  if (!g) return;
  const clips = {};
  for (const c of g.animations) clips[c.name] = c;
  const sub = (name, keep) => { const c = clips[name]; if (!c) return null; const t = c.tracks.filter((tr) => keep(tr.name.split('.')[0])); return new THREE.AnimationClip(name + (keep === isLower ? '_L' : '_U'), c.duration, t); };
  const isLower = (b) => LOWER.test(b), isUpper = (b) => !LOWER.test(b);
  const C = {
    full: clips,
    lower: Object.fromEntries(['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop'].map((n) => [n, sub(n, isLower)])),
    upper: Object.fromEntries(['Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Reload', 'Pistol_Shoot'].map((n) => [n, sub(n, isUpper)])),
  };
  // 制服：物件空間迷彩（綁定姿勢的頂點座標，跟著身體動）
  const camo = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
  camo.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vObj;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x), f.y), mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec3 q = vObj * 7.0;
      float a = n3(q) * 0.6 + n3(q * 2.3) * 0.4, b = n3(q * 1.3 + 17.) * 0.6 + n3(q * 3.1 + 5.) * 0.4;
      vec3 col = vec3(0.62, 0.55, 0.42);
      col = mix(col, vec3(0.43, 0.42, 0.3), smoothstep(0.5, 0.56, a));
      col = mix(col, vec3(0.34, 0.27, 0.19), smoothstep(0.58, 0.63, b));
      col = mix(col, vec3(0.74, 0.68, 0.55), smoothstep(0.66, 0.7, n3(q * 2.7 + 9.)));
      diffuseColor.rgb = pow(col, vec3(2.2));`);
  };
  const glove = new THREE.MeshStandardMaterial({ color: '#2a241e', roughness: 0.75 });
  const boot = new THREE.MeshStandardMaterial({ color: '#3a3027', roughness: 0.8 });
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const n = o.material.name;
    if (n === 'uniform') o.material = camo;
    else if (n === 'glove') o.material = glove;
    else if (n === 'boot') o.material = boot;
    else if (o.material.map) { o.material.roughness = 0.7; }
  });
  SOLDIER = { scene: g.scene, C };
}

const gearMat = {
  olive: new THREE.MeshStandardMaterial({ color: '#59553e', roughness: 0.85 }),
  tan: new THREE.MeshStandardMaterial({ color: '#8c7a58', roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2b2722', roughness: 0.7 }),
};
function helmet() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), gearMat.olive); shell.scale.set(1, 0.85, 1.12);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.158, 0.03, 18), gearMat.olive); brim.position.y = -0.005; brim.scale.z = 1.12;
  const nvg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), gearMat.dark); nvg.position.set(0, 0.07, 0.15);
  for (const m of [shell, brim, nvg]) { m.castShadow = true; g.add(m); }
  return g;
}
function vest() {
  const g = new THREE.Group();
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.07), gearMat.tan); front.position.set(0, 0, 0.13);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.07), gearMat.tan); back.position.set(0, 0, -0.13);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.16), gearMat.olive); pack.position.set(0, -0.02, -0.25);
  const add = [front, back, pack];
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), gearMat.olive); p.position.set(-0.11 + i * 0.11, -0.1, 0.19); add.push(p); }
  for (const m of add) { m.castShadow = true; g.add(m); }
  return g;
}

export function makeSoldier(id) {
  if (!SOLDIER) return makeBlockSoldier(id);
  const root = new THREE.Group();
  const body = skClone(SOLDIER.scene);
  body.rotation.y = Math.PI; // 模型面向 +z；遊戲的前方是 -z
  root.add(body);
  const bones = {};
  body.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  // 裝備在綁定姿勢下以模型座標擺好，再 attach 到骨頭（不用管骨頭自己的軸向）
  body.updateMatrixWorld(true);
  const wear = (obj, bone, x, y, z) => { if (!bone) return; body.add(obj); obj.position.set(x, y, z); obj.updateMatrixWorld(true); bone.attach(obj); };
  wear(helmet(), bones.Head, 0, 1.745, -0.005);
  wear(vest(), bones.spine_03, 0, 1.33, 0.0);
  // 槍每格依右手位置與瞄準方向擺放（見 poseSoldier）
  const gunHold = new THREE.Group(); root.add(gunHold);
  const mixer = new THREE.AnimationMixer(body);
  const acts = {};
  const act = (clip) => { if (!clip) return null; if (!acts[clip.name]) { const a = mixer.clipAction(clip); a.setEffectiveWeight(0); a.play(); acts[clip.name] = a; } return acts[clip.name]; };
  const chute = makeChute(); chute.visible = false; root.add(chute);
  return { rig: true, root, body, bones, mixer, act, acts, gunHold, chute, gun: null, gunKey: '', weights: {}, dead: false, shootT: 0 };
}

// 依模式與速度切換動畫：下半身走跑、上半身持槍瞄準（依俯仰混合上下瞄準）
export function poseSoldier(s, st, dt) {
  if (!s.rig) return poseBlock(s, st, dt);
  const C = SOLDIER.C, mode = st.mode;
  s.chute.visible = mode === MODE.CHUTE;
  const wkey = st.w >= 0 ? WEAPON_KEYS[st.w] : '';
  if (wkey !== s.gunKey) {
    if (s.gun) s.gunHold.remove(s.gun);
    s.gun = wkey ? gunMesh(wkey, 1.0) : null;
    if (s.gun) s.gunHold.add(s.gun);
    s.gunKey = wkey;
  }
  const want = {};
  s.body.rotation.x = 0; s.body.position.y = 0;
  if (st.dead) {
    want.Death01 = 1;
    const d = s.act(C.full.Death01); d.setLoop(THREE.LoopOnce, 1); d.clampWhenFinished = true;
    if (!s.dead) { d.reset(); d.play(); s.dead = true; }
  } else if (mode === MODE.FALL) {
    want.Swim_Idle_Loop = 1; s.body.rotation.x = 1.25; s.body.position.y = 0.9;
  } else if (mode === MODE.CHUTE) {
    want.Jump_Loop = 1;
  } else {
    const sp = st.speed || 0;
    if (st.spr && sp > 4) want.Sprint_Loop = 1;
    else {
      const crouch = st.cr;
      const base = crouch ? (sp > 0.5 ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop') : sp < 0.4 ? 'Idle_Loop' : sp < 3.6 ? 'Walk_Loop' : 'Jog_Fwd_Loop';
      want[base + '_L'] = 1;
      const p = st.pitch || 0;
      const up = Math.max(0, Math.min(1, p / 0.8)), down = Math.max(0, Math.min(1, -p / 0.8));
      if (st.reload) want.Pistol_Reload_U = 1;
      else { want.Pistol_Aim_Neutral_U = 1 - up - down; want.Pistol_Aim_Up_U = up; want.Pistol_Aim_Down_U = down; }
      if (s.acts[base + '_L']) s.acts[base + '_L'].timeScale = base === 'Walk_Loop' ? Math.max(0.6, sp / 2.2) : base === 'Jog_Fwd_Loop' ? Math.max(0.7, sp / 4.6) : 1;
    }
    if (s.acts.Sprint_Loop) s.acts.Sprint_Loop.timeScale = Math.max(0.8, (st.speed || 0) / 7);
  }
  // 平滑切換權重
  const resolve = (name) => (name.endsWith('_L') ? C.lower[name.slice(0, -2)] : name.endsWith('_U') ? C.upper[name.slice(0, -2)] : C.full[name]);
  const k = Math.min(1, dt * 10);
  for (const name of new Set([...Object.keys(s.weights), ...Object.keys(want)])) {
    const target = want[name] || 0, cur = s.weights[name] || 0;
    const w = name === 'Death01' ? target : cur + (target - cur) * k;
    const a = s.act(resolve(name));
    if (a) a.setEffectiveWeight(w);
    if (w < 0.002 && !target) { delete s.weights[name]; if (a) a.setEffectiveWeight(0); } else s.weights[name] = w;
  }
  if (st.dead) for (const [n, a] of Object.entries(s.acts)) if (n !== 'Death01') a.setEffectiveWeight(0);
  s.mixer.update(dt);
  // 槍：位置在右手，方向是角色的瞄準方向（衝刺時斜持）
  if (s.gun && s.bones.hand_r) {
    s.root.updateMatrixWorld(true);
    const hp = s.bones.hand_r.getWorldPosition(_v1);
    s.root.worldToLocal(hp);
    s.gunHold.position.copy(hp).add(_v2.set(0, 0.02, -0.05));
    const sprint = st.spr && (st.speed || 0) > 4;
    s.gunHold.rotation.set(sprint ? -0.6 : (st.pitch || 0), sprint ? 0.9 : 0.05, sprint ? 0.3 : 0, 'YXZ');
    s.gun.visible = mode === MODE.GROUND && !st.dead;
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

// ---- 備援：沒有外部模型時的方塊士兵 ----
function makeBlockSoldier(id) {
  const [uni, vestC] = UNIFORMS[id % UNIFORMS.length];
  const skin = SKIN[(id * 7) % SKIN.length];
  const mU = new THREE.MeshStandardMaterial({ color: uni, roughness: 0.9 });
  const mV = new THREE.MeshStandardMaterial({ color: vestC, roughness: 0.85 });
  const mS = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const mB = new THREE.MeshStandardMaterial({ color: '#2a241e', roughness: 0.9 });
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(torso, new THREE.BoxGeometry(0.42, 0.52, 0.24), mU, 0, 0.3, 0);
  add(torso, new THREE.BoxGeometry(0.46, 0.38, 0.3), mV, 0, 0.34, 0);
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
  add(head, new THREE.BoxGeometry(0.2, 0.24, 0.22), mS, 0, 0.1, 0);
  add(head, new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mV, 0, 0.16, 0);
  const limb = (parent, x, y, len, w, mat) => { const j = new THREE.Group(); j.position.set(x, y, 0); parent.add(j); add(j, new THREE.BoxGeometry(w, len, w), mat, 0, -len / 2, 0); const k = new THREE.Group(); k.position.y = -len; j.add(k); return [j, k]; };
  const [lArm, lFore] = limb(torso, -0.27, 0.52, 0.3, 0.12, mU);
  const [rArm, rFore] = limb(torso, 0.27, 0.52, 0.3, 0.12, mU);
  add(lFore, new THREE.BoxGeometry(0.1, 0.28, 0.1), mU, 0, -0.14, 0); add(rFore, new THREE.BoxGeometry(0.1, 0.28, 0.1), mU, 0, -0.14, 0);
  const [lLeg, lShin] = limb(hips, -0.11, 0, 0.45, 0.16, mU);
  const [rLeg, rShin] = limb(hips, 0.11, 0, 0.45, 0.16, mU);
  add(lShin, new THREE.BoxGeometry(0.14, 0.42, 0.14), mB, 0, -0.21, 0); add(rShin, new THREE.BoxGeometry(0.14, 0.42, 0.14), mB, 0, -0.21, 0);
  const gunHold = new THREE.Group(); gunHold.position.set(0.12, 0.36, -0.28); torso.add(gunHold);
  const chute = makeChute(); chute.visible = false; root.add(chute);
  return { root, hips, torso, head, lArm, lFore, rArm, rFore, lLeg, lShin, rLeg, rShin, gunHold, chute, gun: null, gunKey: '', phase: 0 };
}
function poseBlock(s, st, dt) {
  const mode = st.mode, cr = st.cr, sp = st.speed || 0;
  s.chute.visible = mode === MODE.CHUTE;
  s.root.rotation.x = st.dead ? Math.PI / 2 : 0;
  s.hips.position.y = cr ? 0.62 : 0.95;
  const wkey = st.w >= 0 ? WEAPON_KEYS[st.w] : '';
  if (wkey !== s.gunKey) { if (s.gun) s.gunHold.remove(s.gun); s.gun = wkey ? gunMesh(wkey, 1.15) : null; if (s.gun) s.gunHold.add(s.gun); s.gunKey = wkey; }
  if (mode === MODE.FALL) { s.root.rotation.x = -1.25; s.lArm.rotation.set(0, 0, 1.9); s.rArm.rotation.set(0, 0, -1.9); return; }
  if (mode === MODE.CHUTE) { s.lArm.rotation.set(0, 0, 2.6); s.rArm.rotation.set(0, 0, -2.6); return; }
  s.phase += dt * (sp > 0.3 ? 2.2 + sp * 1.1 : 0);
  const amp = Math.min(1, sp / 5) * 0.8, sw = Math.sin(s.phase) * amp;
  s.lLeg.rotation.set(sw * 0.8 - (cr ? 1.1 : 0), 0, 0); s.rLeg.rotation.set(-sw * 0.8 - (cr ? 0.5 : 0), 0, 0);
  s.lShin.rotation.x = Math.max(0, -Math.cos(s.phase) * amp) + (cr ? 1.6 : 0); s.rShin.rotation.x = Math.max(0, Math.cos(s.phase) * amp) + (cr ? 1.1 : 0);
  const p = st.pitch || 0;
  s.rArm.rotation.set(-1.25 + p * 0.5, 0, 0.05); s.lArm.rotation.set(-1.35 + p * 0.5, 0, 0.6);
  s.gunHold.rotation.set(p * 0.5, 0, 0);
}

// ---- 降落傘：平滑的翼型傘衣、傘肋與傘繩 ----
function makeChute() {
  const g = new THREE.Group();
  const cells = 9, segU = 36, segV = 6, span = 8.4, chord = 2.7, arc = 1.15;
  const tex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < cells; i++) { x.fillStyle = i % 2 ? '#e8b23c' : '#2f6fb0'; x.fillRect((i / cells) * 512, 0, 512 / cells + 1, 64); } x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < cells; i++) x.fillRect((i / cells) * 512 - 1, 0, 2, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
    const u = i / segU, v = j / segV;
    const a = (u - 0.5) * 2 * arc;
    const R = span / (2 * Math.sin(arc));
    const camber = Math.sin(v * Math.PI) * 0.22 * (1 - Math.abs(u - 0.5) * 0.6);
    const cellBulge = Math.abs(Math.sin(u * cells * Math.PI)) * 0.05;
    pos.push(Math.sin(a) * (R + camber + cellBulge), 6.6 + (Math.cos(a) - 1) * R + camber + cellBulge, (v - 0.5) * chord);
    uv.push(u, v);
    if (i < segU && j < segV) { const k = j * (segU + 1) + i; idx.push(k, k + segU + 1, k + 1, k + 1, k + segU + 1, k + segU + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const canopy = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.75 }));
  canopy.castShadow = true; g.add(canopy);
  const lines = [];
  const R = span / (2 * Math.sin(arc));
  for (let i = 0; i <= cells; i++) {
    const a = (i / cells - 0.5) * 2 * arc, x = Math.sin(a) * R, y = 6.6 + (Math.cos(a) - 1) * R;
    for (const z of [-chord * 0.35, chord * 0.2]) lines.push(new THREE.Vector3(Math.sign(x) * 0.18, 1.55, 0), new THREE.Vector3(x, y, z));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: '#1f1c19', transparent: true, opacity: 0.7 })));
  return g;
}

// ---- 運輸機：四發螺旋槳、上單翼、尾門 ----
export function makePlane() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#7d8170', roughness: 0.55, metalness: 0.35 });
  const d = new THREE.MeshStandardMaterial({ color: '#3d3f38', roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2b33', roughness: 0.1, metalness: 0.6 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  const body = new THREE.LatheGeometry([[0, -16], [1.2, -15.6], [2.1, -14], [2.5, -11], [2.6, -4], [2.6, 8], [2.3, 11], [1.6, 14], [0.9, 16]].map(([r, z]) => new THREE.Vector2(r, z)), 24);
  add(body, m, 0, 0, 0, Math.PI / 2, 0, 0);
  add(new THREE.SphereGeometry(1.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), glass, 0, 0.9, -12.6, -1.1, 0, 0).scale.set(0.9, 0.55, 0.9);
  const wing = new THREE.Shape(); wing.moveTo(-20, 0); wing.lineTo(20, 0); wing.lineTo(19, 3.6); wing.lineTo(-19, 3.6); wing.closePath();
  add(new THREE.ExtrudeGeometry(wing, { depth: 0.35, bevelEnabled: false }), m, 0, 2.5, -1.5, Math.PI / 2, 0, 0);
  add(new THREE.BoxGeometry(0.4, 6.5, 4.2), m, 0, 4.5, 13.5, 0.15, 0, 0);
  add(new THREE.BoxGeometry(13, 0.3, 3.2), m, 0, 2.2, 14.6);
  for (const x of [-13, -7, 7, 13]) {
    add(new THREE.CylinderGeometry(0.75, 0.9, 4.6, 14), d, x, 2.1, -3.2, Math.PI / 2, 0, 0);
    const disc = add(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ color: '#222', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }), x, 2.1, -5.6);
    disc.castShadow = false;
    for (let k = 0; k < 4; k++) { const b = add(new THREE.BoxGeometry(0.3, 2.3, 0.08), d, x, 2.1, -5.55, 0, 0, k * Math.PI / 2); b.userData.prop = true; }
  }
  add(new THREE.BoxGeometry(4.4, 0.25, 4.6), d, 0, -1.7, 13, 0.32, 0, 0);
  return g;
}
