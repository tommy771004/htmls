// 其他玩家的角色模型（程式建模的低多邊形士兵）、降落傘、運輸機與槍枝外型。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODE } from '../core/player.js';
import { WEAPON_KEYS } from '../core/rules.js';

const UNIFORMS = [
  ['#a58d66', '#5d5038'], ['#6e7552', '#3e4230'], ['#7c7d78', '#3b3c3a'], ['#8a5a3c', '#4a3324'], ['#c2b08a', '#6b5d43'], ['#4d5547', '#2a2e27'],
];
const SKIN = ['#e3b996', '#c99772', '#a4714f', '#7d5238'];

function box(w, h, d, x = 0, y = 0, z = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }

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
const gunMats = {
  metal: new THREE.MeshStandardMaterial({ color: '#34332f', roughness: 0.38, metalness: 0.55 }),
  poly: new THREE.MeshStandardMaterial({ color: '#45443d', roughness: 0.75 }),
  wood: new THREE.MeshStandardMaterial({ color: '#86512c', roughness: 0.55 }),
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

export function makeSoldier(id) {
  const [uni, vest] = UNIFORMS[id % UNIFORMS.length];
  const skin = SKIN[(id * 7) % SKIN.length];
  const mU = new THREE.MeshStandardMaterial({ color: uni, roughness: 0.9 });
  const mV = new THREE.MeshStandardMaterial({ color: vest, roughness: 0.85 });
  const mS = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const mB = new THREE.MeshStandardMaterial({ color: '#2a241e', roughness: 0.9 });
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(torso, new THREE.BoxGeometry(0.42, 0.52, 0.24), mU, 0, 0.3, 0);
  add(torso, new THREE.BoxGeometry(0.46, 0.38, 0.3), mV, 0, 0.34, 0);
  add(torso, new THREE.BoxGeometry(0.4, 0.14, 0.26), mB, 0, 0.02, 0);
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
  add(head, new THREE.BoxGeometry(0.2, 0.24, 0.22), mS, 0, 0.1, 0);
  add(head, new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mV, 0, 0.16, 0.0).scale.set(1, 0.9, 1.1);
  add(head, new THREE.BoxGeometry(0.21, 0.05, 0.05), mB, 0, 0.12, -0.11);
  const limb = (parent, x, y, len, w, mat) => {
    const j = new THREE.Group(); j.position.set(x, y, 0); parent.add(j);
    add(j, new THREE.BoxGeometry(w, len, w), mat, 0, -len / 2, 0);
    const k = new THREE.Group(); k.position.y = -len; j.add(k);
    return [j, k];
  };
  const [lArm, lFore] = limb(torso, -0.27, 0.52, 0.3, 0.12, mU);
  const [rArm, rFore] = limb(torso, 0.27, 0.52, 0.3, 0.12, mU);
  add(lFore, new THREE.BoxGeometry(0.1, 0.28, 0.1), mU, 0, -0.14, 0); add(lFore, new THREE.BoxGeometry(0.09, 0.09, 0.1), mS, 0, -0.3, 0);
  add(rFore, new THREE.BoxGeometry(0.1, 0.28, 0.1), mU, 0, -0.14, 0); add(rFore, new THREE.BoxGeometry(0.09, 0.09, 0.1), mS, 0, -0.3, 0);
  const [lLeg, lShin] = limb(hips, -0.11, 0, 0.45, 0.16, mU);
  const [rLeg, rShin] = limb(hips, 0.11, 0, 0.45, 0.16, mU);
  add(lShin, new THREE.BoxGeometry(0.14, 0.42, 0.14), mU, 0, -0.21, 0); add(lShin, new THREE.BoxGeometry(0.15, 0.1, 0.26), mB, 0, -0.44, -0.04);
  add(rShin, new THREE.BoxGeometry(0.14, 0.42, 0.14), mU, 0, -0.21, 0); add(rShin, new THREE.BoxGeometry(0.15, 0.1, 0.26), mB, 0, -0.44, -0.04);
  const gunHold = new THREE.Group(); gunHold.position.set(0.12, 0.36, -0.28); torso.add(gunHold);
  const chute = makeChute(); chute.visible = false; root.add(chute);
  return { root, hips, torso, head, lArm, lFore, rArm, rFore, lLeg, lShin, rLeg, rShin, gunHold, chute, gun: null, gunKey: '', phase: 0 };
}

function makeChute() {
  const g = new THREE.Group();
  const segs = 9, span = 7.2, rise = 1.6;
  const mats = [new THREE.MeshStandardMaterial({ color: '#c8532d', roughness: 0.8, side: THREE.DoubleSide }), new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8, side: THREE.DoubleSide })];
  for (let i = 0; i < segs; i++) {
    const a = (i / (segs - 1) - 0.5) * 2.1;
    const m = new THREE.Mesh(new THREE.BoxGeometry(span / segs + 0.05, 0.12, 2.4), mats[i % 2]);
    m.position.set(Math.sin(a) * span / 2.1, 6.4 + Math.cos(a) * rise - rise, 0);
    m.rotation.z = -a * 0.95;
    m.castShadow = true;
    g.add(m);
  }
  const lineMat = new THREE.LineBasicMaterial({ color: '#2a241e', transparent: true, opacity: 0.6 });
  const pts = [];
  for (const sx of [-1, 1]) for (const k of [0.3, 1]) for (const sz of [-1, 1]) pts.push(new THREE.Vector3(sx * 0.22, 1.5, 0), new THREE.Vector3(sx * k * 3.3, 5.6 + (1 - k) * 1.2, sz * 1.1));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  return g;
}

export function makePlane() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#8d8a7a', roughness: 0.6, metalness: 0.2 });
  const d = new THREE.MeshStandardMaterial({ color: '#4a4740', roughness: 0.7 });
  const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  const body = add(new THREE.CylinderGeometry(2.4, 2.0, 30, 14), m, 0, 0, 0); body.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0, -15).rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(40, 0.6, 4.5), m, 0, 2.2, -3);
  add(new THREE.BoxGeometry(0.5, 7, 4), m, 0, 4, 13.5);
  add(new THREE.BoxGeometry(13, 0.4, 3), m, 0, 2.0, 14);
  for (const x of [-13, -7, 7, 13]) {
    add(new THREE.CylinderGeometry(0.8, 0.9, 4, 10), d, x, 1.4, -4.5).rotation.x = Math.PI / 2;
    const prop = add(new THREE.BoxGeometry(5, 0.2, 0.25), d, x, 1.4, -6.6); prop.userData.prop = true;
  }
  add(new THREE.BoxGeometry(4.6, 0.3, 4), d, 0, -1.9, 12).rotation.x = 0.25;
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

// 依模式與速度擺姿勢
export function poseSoldier(s, st, dt) {
  const mode = st.mode, cr = st.cr, sp = st.speed || 0;
  s.chute.visible = mode === MODE.CHUTE;
  s.root.rotation.x = 0;
  s.hips.position.y = cr ? 0.62 : 0.95;
  s.hips.rotation.set(0, 0, 0); s.torso.rotation.set(0, 0, 0);
  const wkey = st.w >= 0 ? WEAPON_KEYS[st.w] : '';
  if (wkey !== s.gunKey) {
    if (s.gun) s.gunHold.remove(s.gun);
    s.gun = wkey ? gunMesh(wkey, 1.15) : null;
    if (s.gun) s.gunHold.add(s.gun);
    s.gunKey = wkey;
  }
  if (mode === MODE.FALL) {
    s.root.rotation.x = -1.25;
    s.lArm.rotation.set(0, 0, 1.9); s.rArm.rotation.set(0, 0, -1.9); s.lFore.rotation.set(0, 0, 0.4); s.rFore.rotation.set(0, 0, -0.4);
    s.lLeg.rotation.set(0.2, 0, 0.35); s.rLeg.rotation.set(0.2, 0, -0.35); s.lShin.rotation.x = 0.6; s.rShin.rotation.x = 0.6;
    if (s.gun) s.gun.visible = false;
    return;
  }
  if (s.gun) s.gun.visible = mode === MODE.GROUND;
  if (mode === MODE.CHUTE) {
    s.lArm.rotation.set(0, 0, 2.6); s.rArm.rotation.set(0, 0, -2.6); s.lFore.rotation.set(0, 0, 0.2); s.rFore.rotation.set(0, 0, -0.2);
    s.lLeg.rotation.set(0.3, 0, 0.05); s.rLeg.rotation.set(0.1, 0, -0.05); s.lShin.rotation.x = 0.3; s.rShin.rotation.x = 0.4;
    return;
  }
  // 走路：步伐週期依水平速度
  s.phase += dt * (sp > 0.3 ? 2.2 + sp * 1.1 : 0);
  const amp = Math.min(1, sp / 5) * (st.spr ? 1.15 : 0.75);
  const sw = Math.sin(s.phase) * amp;
  s.lLeg.rotation.set(sw * 0.8 - (cr ? 1.1 : 0), 0, 0); s.rLeg.rotation.set(-sw * 0.8 - (cr ? 0.5 : 0), 0, 0);
  s.lShin.rotation.x = Math.max(0, -Math.cos(s.phase) * amp) * 1.1 + (cr ? 1.6 : 0);
  s.rShin.rotation.x = Math.max(0, Math.cos(s.phase) * amp) * 1.1 + (cr ? 1.1 : 0);
  s.hips.position.y += Math.abs(Math.sin(s.phase)) * amp * 0.05;
  // 持槍：手臂指向瞄準方向
  const p = st.pitch;
  s.torso.rotation.x = p * 0.5 + (st.spr ? 0.18 : 0);
  s.head.rotation.x = p * 0.5;
  if (st.spr) {
    s.rArm.rotation.set(0.5 + sw * 0.4, 0, 0); s.rFore.rotation.set(-1.1, 0, 0);
    s.lArm.rotation.set(-0.4 - sw * 0.4, 0, 0); s.lFore.rotation.set(-0.9, 0, 0);
    s.gunHold.rotation.set(0.7, 0.4, 0); s.gunHold.position.set(0.16, 0.3, -0.2);
  } else {
    s.rArm.rotation.set(-1.25 + p * 0.5, 0, 0.05); s.rFore.rotation.set(-0.35, 0, 0);
    s.lArm.rotation.set(-1.35 + p * 0.5, 0, 0.6); s.lFore.rotation.set(-0.5, 0, 0);
    s.gunHold.rotation.set(p * 0.5, 0, 0); s.gunHold.position.set(0.11, 0.38, -0.36);
    if (st.reload) { s.lArm.rotation.x = -0.6; s.gunHold.rotation.x -= 0.5; }
  }
}
