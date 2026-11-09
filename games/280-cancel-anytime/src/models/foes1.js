// 第 1–5 關敵人模型（21 種）。全部程序生成、卡通描邊、原創造型。
// 契約：回傳 THREE.Group，腳底 y=0、面向 +Z；userData.height = 最高點；
// userData.parts = { body, head, armL, armR, forearmL, forearmR, legL, legR, weapon, eyes[], mouth, tail, extra[] }（依角色提供）。
// 手臂／腿的部件群組本身旋轉為 0，姿勢放在子群組 userData.pose；前臂（手肘樞紐）有靜止彎曲。
// head 樞紐在脖子；eyes 每顆是以眼球中心為原點的群組（縮放 y 可眨眼）；extra 的樞紐都在根部（可擺動）。
// userData.anim(t, dt)：每幀呼叫的待機小動畫（只動非契約子物件，不改共用材質）。
// 幾何依參數快取，同種敵人多隻共用幾何與材質。THREE 是全域變數，只能在函式內使用。
/* global THREE */
import { part, roundedBoxGeo, toon, flat, textTexture } from '../kit.js';

const PI = Math.PI;
const SKIN = 0xf2c29b;
const INK = 0x16121c;
const WHITE = 0xffffff;

// ── 幾何／材質快取 ─────────────────────────────────────
const _geo = new Map();
const r3 = v => Math.round(v * 1000) / 1000;
function memo(k, f) { let g = _geo.get(k); if (!g) { g = f(); _geo.set(k, g); } return g; }
// 只把影響材質的選項交給 toon，避免同色因 seg/r 等選項產生多份材質
function mk(geo, color, o) {
  let mat = o.mat;
  if (!mat) {
    const mo = {};
    if (o.emissive) { mo.emissive = o.emissive; mo.emissiveIntensity = o.emissiveIntensity ?? 1; }
    if (o.transparent) { mo.transparent = true; mo.opacity = o.opacity ?? 0.6; }
    if (o.side) mo.side = o.side;
    mat = toon(color, mo);
  }
  return part(geo, color, { mat, outline: o.outline, shadow: o.shadow });
}
function box(w, h, d, c, x = 0, y = 0, z = 0, o = {}) {
  const r = o.r ?? Math.min(w, h, d) * 0.12;
  const m = mk(memo(`b${r3(w)},${r3(h)},${r3(d)},${r3(r)}`, () => roundedBoxGeo(r3(w), r3(h), r3(d), r3(r))), c, o); m.position.set(x, y, z); return m;
}
function sphere(r, c, x = 0, y = 0, z = 0, o = {}) {
  const s = o.seg || 16;
  const m = mk(memo(`s${r3(r)},${s}`, () => new THREE.SphereGeometry(r3(r), s, Math.max(4, Math.floor(s * 0.75)))), c, o); m.position.set(x, y, z); return m;
}
function cyl(rt, rb, h, c, x = 0, y = 0, z = 0, o = {}) {
  const s = o.seg || 14;
  const m = mk(memo(`c${r3(rt)},${r3(rb)},${r3(h)},${s}`, () => new THREE.CylinderGeometry(r3(rt), r3(rb), r3(h), s)), c, o); m.position.set(x, y, z); return m;
}
function cone(r, h, c, x = 0, y = 0, z = 0, o = {}) {
  const s = o.seg || 14;
  const m = mk(memo(`k${r3(r)},${r3(h)},${s}`, () => new THREE.ConeGeometry(r3(r), r3(h), s)), c, o); m.position.set(x, y, z); return m;
}
function capsule(r, len, c, x = 0, y = 0, z = 0, o = {}) {
  const s = o.seg || 12;
  const m = mk(memo(`p${r3(r)},${r3(len)},${s}`, () => new THREE.CapsuleGeometry(r3(r), r3(len), 4, s)), c, o); m.position.set(x, y, z); return m;
}
function torus(r, t, c, x = 0, y = 0, z = 0, o = {}) {
  const s = o.seg || 20;
  const m = mk(memo(`t${r3(r)},${r3(t)},${s}`, () => new THREE.TorusGeometry(r3(r), r3(t), 8, s)), c, o); m.position.set(x, y, z); return m;
}
// 半球（開口朝下），r 半徑、sy 垂直壓扁
function dome(r, c, x = 0, y = 0, z = 0, sy = 1, o = {}) {
  const s = o.seg || 18;
  const m = mk(memo(`d${r3(r)},${s}`, () => new THREE.SphereGeometry(r3(r), s, 8, 0, PI * 2, 0, PI / 2)), c, o);
  m.position.set(x, y, z); m.scale.set(1, sy, 1); return m;
}
// 弧形圓環（弓、把手、漩渦）
function arc(r, t, ang, c, o = {}) { const s = o.seg || 14; return mk(memo(`a${r3(r)},${r3(t)},${r3(ang)},${s}`, () => new THREE.TorusGeometry(r3(r), r3(t), 6, s, r3(ang))), c, o); }
// 兩點之間的圓柱（繩、管線、骨架）
function rod(a, b, r, c, o = {}) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = Math.round(va.distanceTo(vb) * 200) / 200;
  const m = cyl(r, r, len, c, 0, 0, 0, { seg: 8, ...o });
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}
// 文字貼片（幾何與材質快取）
const _txt = new Map();
function txt(text, w, o = {}) {
  const key = JSON.stringify([text, w, o]);
  let c = _txt.get(key);
  if (!c) {
    const { tex, aspect } = textTexture(text, o);
    c = { geo: new THREE.PlaneGeometry(w, w / aspect), mat: new THREE.MeshBasicMaterial({ map: tex, transparent: !o.bg, depthWrite: !!o.bg }) };
    _txt.set(key, c);
  }
  return new THREE.Mesh(c.geo, c.mat);
}
const glow = c => ({ mat: flat(c), outline: false, shadow: false });

// ── 小工具 ───────────────────────────────────────────
const G = () => new THREE.Group();
function R(m, x = 0, y = 0, z = 0) { m.rotation.set(x, y, z); return m; }
function S(m, x = 1, y = x, z = x) { m.scale.set(x, y, z); return m; }
function add(p, ...kids) { for (const k of kids) if (k) p.add(k); return p; }
function at(m, x = 0, y = 0, z = 0) { m.position.set(x, y, z); return m; }
// 把已在 parent 座標建好的物件包進樞紐群組（樞紐在 x,y,z），回傳樞紐（擺動時以根部為軸）
function pivot(parent, x, y, z, ...kids) {
  const p = G(); p.position.set(x, y, z); parent.add(p);
  for (const k of kids) { k.position.x -= x; k.position.y -= y; k.position.z -= z; p.add(k); }
  return p;
}

// 設定手臂／腿的姿勢（作用在 pose 子群組）；e = 手肘彎曲（正值往前彎）
function pose(limb, x = 0, y = 0, z = 0, e = 0) {
  limb.userData.pose.rotation.set(x, y, z);
  if (limb.userData.fore) limb.userData.fore.rotation.x = -e;
  return limb;
}
// 把物件掛在手上：物件原點 = 握把，物件以「模型方向」建模（自動抵消手臂與手肘姿勢）
const _q = [];
function hold(limb, obj, dx = 0, dy = 0, dz = 0) {
  const F = limb.userData.fore || limb.userData.pose;
  F.updateWorldMatrix(true, false);
  const q = _q[0] || (_q[0] = new THREE.Quaternion());
  F.getWorldQuaternion(q);
  obj.position.set(dx, (limb.userData.fore ? -limb.userData.foreLen : limb.userData.hand) + dy, dz);
  obj.quaternion.premultiply(q.invert());
  F.add(obj);
  return obj;
}

// 眼睛：頭部中心為原點，r = 頭半徑。回傳兩顆眼的群組（以眼球中心為原點）
function eyes(H, r, o = {}) {
  const sp = o.gap ?? r * 0.36, ey = o.y ?? r * 0.12, er = o.r ?? r * 0.22;
  const z = (o.z ?? Math.sqrt(Math.max(0.01, r * r - sp * sp - ey * ey))) - er * 0.35;
  const out = [];
  for (const s of [1, -1]) {
    const E = G(); E.position.set(s * sp, ey, z); H.add(E); out.push(E);
    const px = (o.look ?? 0) + s * (o.cross ?? 0), py = o.py ?? 0, pr = er * (o.pr ?? 0.5) * (s > 0 ? o.prL ?? 1 : 1);
    if (o.white !== null) E.add(S(sphere(er, o.white ?? WHITE, 0, 0, 0, { seg: 12 }), o.sx ?? 1, o.sy ?? 1, 0.9));
    if (o.iris != null) E.add(sphere(er * (o.ir ?? 0.66), o.iris, px, py, er * 0.42, { seg: 10, outline: false }));
    E.add(sphere(pr, o.pupil ?? INK, px, py, er * 0.66, { seg: 8, outline: false }));
    if (o.glint !== false) E.add(sphere(er * 0.16, WHITE, px + er * 0.2, py + er * 0.24, er * 0.66 + pr * 0.8, { seg: 6, ...glow(WHITE) }));
    // 眼皮：半球蓋住上緣，傾斜做出怒目／睡眼
    if (o.lid != null) E.add(R(dome(er * 1.12, o.lid, 0, 0, 0, 1, { seg: 12, outline: false }), o.lidX ?? -0.35, 0, -s * (o.lidZ ?? 0.35)));
    if (o.brow != null) H.add(R(box(er * 2.3, er * (o.browH ?? 0.5), er * 0.6, o.brow, s * sp, ey + er * 1.25 + (o.browY ?? 0), z + er * 0.3), 0, 0, s * (o.angry ?? 0.35)));
  }
  return out;
}
// 嘴：頭部前方的群組（深色口腔＋選配牙齒、獠牙、舌頭），回傳群組
function mouth(H, r, w, h, y, o = {}) {
  const z = (o.z ?? Math.sqrt(Math.max(0.01, r * r - y * y))) - h * 0.15 + (o.dz ?? 0);
  const M = G(); M.position.set(o.x ?? 0, y, z); M.rotation.z = o.tilt ?? 0; H.add(M);
  M.add(box(w, h, 0.05, o.color ?? 0x5a1020, 0, 0, 0, { r: Math.min(w, h) * 0.45, outline: o.outline }));
  if (o.teeth) M.add(box(w * 0.8, Math.max(0.008, h * 0.28), 0.03, WHITE, 0, h * 0.3, 0.018, { outline: false, r: 0.004 }));
  if (o.lower) M.add(box(w * 0.7, Math.max(0.008, h * 0.22), 0.03, WHITE, 0, -h * 0.32, 0.018, { outline: false, r: 0.004 }));
  if (o.tongue) M.add(S(sphere(w * 0.26, o.tongue === true ? 0xff6a8a : o.tongue, 0, -h * 0.2, 0.014, { outline: false, seg: 8 }), 1, 0.6, 0.45));
  if (o.fangs) for (const s of [1, -1]) M.add(R(cone(w * 0.09, h * 0.6, WHITE, s * w * 0.3, h * 0.12, 0.03, { seg: 6, outline: false }), PI));
  return M;
}
function nose(H, r, size, color, y = -0.02, o = {}) {
  return H.add(S(sphere(size, color, 0, y, Math.sqrt(Math.max(0.01, r * r - y * y)) - size * 0.25, { seg: 10, outline: o.outline }), o.sx ?? 1, o.sy ?? 0.9, o.sz ?? 0.9));
}
function ears(H, r, color, o = {}) {
  for (const s of [1, -1]) H.add(S(sphere(r * 0.22, color, s * r * 0.97, o.y ?? -r * 0.05, o.z ?? 0, { seg: 10 }), 0.5, 1, 0.8));
}
function cheeks(H, r, color = 0xff7a8a, y = -0.35, gap = 0.55) {
  for (const s of [1, -1]) H.add(S(sphere(r * 0.14, color, s * r * gap, r * y, Math.sqrt(Math.max(0.01, 1 - gap * gap - y * y)) * r * 0.97, { seg: 8, outline: false }), 1, 0.6, 0.35));
}

// 人形骨架：回傳 { g, body, head(脖子樞紐), H(頭中心), armL, armR, legL, legR, ... }
// body 原點在髖部；手臂原點在肩、幾何往 −Y；腿原點在髖、幾何往 −Y。左手 = +X（面向 +Z）。
function humanoid(o = {}) {
  const y0 = o.y0 || 0, hip = o.hip ?? 0.74, th = o.th ?? 0.5, w = o.w ?? 0.44, d = o.d ?? 0.27;
  const skin = o.skin ?? SKIN, shirt = o.shirt ?? 0x888888, pants = o.pants ?? 0x333344;
  const g = G();
  const body = G(); body.position.y = y0 + hip; g.add(body);
  const legR = o.legR ?? 0.085, legX = o.legX ?? w * 0.27, shoeH = o.shoeH ?? 0.1;
  const shoeW = o.shoeW ?? legR * 2.4, shoeL = o.shoeL ?? 0.3;
  const legs = [1, -1].map(s => {
    const L = G(); L.position.set(s * legX, y0 + hip, 0); g.add(L);
    const P = G(); L.add(P); L.userData.pose = P;
    const len = hip - shoeH * 0.5;
    if (o.shorts) {
      P.add(cyl(legR * 1.4, legR * 1.3, len * 0.46, pants, 0, -len * 0.21, 0));
      P.add(capsule(legR * 0.85, Math.max(0.01, len * 0.6 - legR * 1.7), o.legSkin ?? skin, 0, -len * 0.68, 0));
      if (o.sock != null) P.add(cyl(legR * 0.95, legR * 0.95, len * 0.22, o.sock, 0, -len * 0.86, 0, { outline: false }));
    } else {
      P.add(capsule(legR, Math.max(0.01, len - legR), pants, 0, -len / 2, 0));
      if (o.cuff != null) P.add(cyl(legR * 1.12, legR * 1.12, len * 0.12, o.cuff, 0, -len * 0.9, 0, { outline: false }));
    }
    if (o.shoe !== null) {
      P.add(box(shoeW, shoeH * 0.82, shoeL, o.shoe ?? 0x2a2a2a, 0, -hip + shoeH * 0.57, 0.05));
      P.add(box(shoeW * 1.06, shoeH * 0.3, shoeL * 1.04, o.sole ?? 0x2a2230, 0, -hip + shoeH * 0.15, 0.05, { outline: false }));
    }
    return L;
  });
  if (o.torso !== false) {
    body.add(box(w, th, d, shirt, 0, th / 2, 0, { r: Math.min(w, d) * 0.22 }));
    if (o.belly) body.add(S(sphere(o.belly, o.bellyColor ?? shirt, 0, th * 0.3, d * 0.22), 1, 0.95, 0.85));
  }
  if (o.pelvis !== false) body.add(box(w * 0.94, 0.16, d * 1.02, pants, 0, 0.02, 0));
  const armR = o.armR ?? 0.07, armLen = o.armLen ?? th * 1.05, up = armLen * 0.48, fore = armLen - up;
  const shY = o.shoulderY ?? th - armR * 1.1, shX = o.shoulderX ?? w / 2 + armR * 0.8;
  const hand = o.hand === null ? null : o.hand ?? skin, handR = o.handR ?? armR * 1.3;
  const arms = [1, -1].map(s => {
    const A = G(); A.position.set(s * shX, shY, o.shoulderZ ?? 0); body.add(A);
    const P = G(); A.add(P);
    const F = G(); F.position.y = -up; F.rotation.x = -(o.elbow ?? 0.15); P.add(F);
    A.userData = { pose: P, fore: F, foreLen: fore, hand: -armLen, up };
    const sl = o.sleeve ?? shirt, sk = o.armSkin ?? skin;
    if (o.shortSleeve) {
      P.add(capsule(armR * 1.18, up * 0.42, sl, 0, -up * 0.28, 0));
      P.add(capsule(armR * 0.9, up * 0.6, sk, 0, -up * 0.62, 0, { outline: false }));
      F.add(capsule(armR * 0.88, Math.max(0.01, fore - armR * 1.4), sk, 0, -fore / 2 + armR * 0.1, 0));
    } else {
      P.add(capsule(armR, Math.max(0.01, up - armR * 0.4), sl, 0, -up / 2, 0));
      F.add(capsule(armR * 0.93, Math.max(0.01, fore - armR * 1.3), o.forearm ?? sl, 0, -fore / 2 + armR * 0.15, 0));
    }
    if (o.cuffArm != null) F.add(cyl(armR * 1.08, armR * 1.08, fore * 0.16, o.cuffArm, 0, -fore * 0.8, 0, { outline: false }));
    if (hand != null) {
      F.add(S(sphere(handR, hand, 0, -fore - handR * 0.15, 0, { seg: 10 }), 0.9, 1.05, 0.8));
      F.add(R(capsule(handR * 0.3, handR * 0.45, hand, -s * handR * 0.25, -fore + handR * 0.05, handR * 0.6, { seg: 6, outline: false }), 0.7));
    }
    return A;
  });
  const headR = o.headR ?? 0.23, neck = o.neck ?? 0.04;
  const hcY = o.headY ?? th + neck + headR * 0.92, lift = o.headLift ?? headR * 0.92;
  const N = G(); N.position.y = hcY - lift; body.add(N);
  const H = G(); H.position.y = lift; N.add(H);
  if (o.head !== false) {
    H.add(S(sphere(headR, o.headColor ?? skin, 0, 0, 0, { seg: 18 }), o.headSx ?? 1, o.headSy ?? 1, 1));
    if (neck > 0) body.add(cyl(headR * 0.4, headR * 0.45, 0.12, o.neckColor ?? skin, 0, th + 0.02, 0));
  }
  return { g, body, head: N, H, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], headR, th, w, d, armLen, hip };
}

// 收尾：計算最高點、寫入 parts 與 anim
function fin(g, parts, k = 1, anim = null) {
  if (k !== 1) { const rig = G(); rig.name = 'rig'; rig.scale.setScalar(k); while (g.children.length) rig.add(g.children[0]); g.add(rig); }
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g);
  g.userData.height = Math.round(b.max.y * 100) / 100;
  for (const key of Object.keys(parts)) if (parts[key] == null || (Array.isArray(parts[key]) && !parts[key].length)) delete parts[key];
  g.userData.parts = parts;
  if (anim) g.userData.anim = anim;
  return g;
}
const P6 = h => ({ body: h.body, head: h.head, armL: h.armL, armR: h.armR, legL: h.legL, legR: h.legR, forearmL: h.armL.userData.fore, forearmR: h.armR.userData.fore });
// 四足：後腿跟著對角前腿走（契約只有 legL/legR）
function trot(legL, legR, bL, bR) { bR.rotation.x = legL.rotation.x; bL.rotation.x = legR.rotation.x; }
const wave = (t, f, a = 1, ph = 0) => Math.sin(t * f + ph) * a;
// 眼睛的靜止縮放放在內層群組，契約 eyes[] 本身維持單位縮放（眨眼直接設 scale.y 不會蓋掉）
function eyeScale(e, x, y = x) { const inner = G(); while (e.children.length) inner.add(e.children[0]); inner.scale.set(x, y, x); e.add(inner); return e; }

// ── 第 1 關 ──────────────────────────────────────────
// 外星洗腦吉娃娃：粉紅毛衣、旋轉催眠眼、玻璃罩外露大腦＋發光觸角，全身發抖
function chihuahua() {
  const g = G(), TAN = 0xe2a65e, CREAM = 0xf8dfb8, PINK = 0xff3d9a, LIME = 0x9dff3a;
  const body = G(); body.position.y = 0.3; g.add(body);
  const torso = G(); body.add(torso);
  torso.add(R(capsule(0.12, 0.2, TAN, 0, 0, -0.02), PI / 2));
  for (const s of [1, -1]) torso.add(S(sphere(0.075, TAN, s * 0.07, -0.02, -0.12, { seg: 10 }), 0.8, 1, 1.1));
  // 毛衣＋羅紋＋背上愛心
  torso.add(R(cyl(0.135, 0.135, 0.17, PINK, 0, 0.005, 0.03), PI / 2));
  for (const z of [-0.055, 0.115]) torso.add(torus(0.135, 0.014, 0xd91a78, 0, 0.005, z, { outline: false, seg: 16 }));
  for (const s of [1, -1]) torso.add(S(sphere(0.026, WHITE, s * 0.017, 0.137, 0.035, { seg: 8, outline: false }), 1, 0.4, 1));
  torso.add(R(S(cone(0.035, 0.04, WHITE, 0, 0.137, 0.006, { seg: 4, outline: false }), 1, 1, 0.4), PI / 2, 0, 0));
  torso.add(S(sphere(0.09, CREAM, 0, -0.065, 0.07, { outline: false }), 1, 0.55, 1.3));
  // 尾巴（捲起）
  const tail = pivot(body, 0, 0.05, -0.15,
    R(capsule(0.024, 0.1, TAN, 0, 0.1, -0.2), -0.6),
    sphere(0.028, TAN, 0, 0.16, -0.23, { seg: 8 }));
  // 腿：前腿 legL/legR，後腿跟著走
  const leg = (x, z, back) => {
    const L = G(); L.position.set(x, 0.28, z); g.add(L);
    add(L, cyl(back ? 0.04 : 0.033, 0.024, 0.25, TAN, 0, -0.13, 0), S(sphere(0.037, CREAM, 0, -0.25, 0.014, { seg: 8 }), 1, 0.6, 1.25));
    return L;
  };
  const legL = leg(0.07, 0.1), legR = leg(-0.07, 0.1), bL = leg(0.075, -0.14, 1), bR = leg(-0.075, -0.14, 1);
  // 項圈＋骨頭吊牌
  body.add(R(torus(0.085, 0.016, 0x2fd4ff, 0, 0.11, 0.14, { seg: 16 }), PI / 2 - 0.6));
  body.add(R(cyl(0.022, 0.022, 0.008, 0xffcc33, 0, 0.04, 0.2, { seg: 8, outline: false }), PI / 2 - 0.3));
  // 頭（脖子樞紐）
  const N = G(); N.position.set(0, 0.1, 0.15); body.add(N);
  const H = G(); H.position.set(0, 0.07, 0.02); N.add(H);
  H.add(S(sphere(0.13, TAN), 1.06, 0.95, 1));
  H.add(S(sphere(0.065, CREAM, 0, -0.045, 0.11), 1, 0.8, 1.1));
  H.add(S(sphere(0.05, CREAM, 0, 0.03, 0.105, { outline: false, seg: 10 }), 0.55, 1.3, 0.5));
  H.add(S(sphere(0.022, INK, 0, -0.022, 0.18, { seg: 8 }), 1.2, 0.9, 1));
  H.add(sphere(0.006, WHITE, 0.007, -0.015, 0.2, { seg: 4, ...glow(WHITE) }));
  const M = mouth(H, 0.13, 0.07, 0.032, -0.095, { z: 0.15, fangs: true, tongue: true });
  // 凸出的催眠漩渦眼
  const E = [], swirl = [];
  for (const s of [1, -1]) {
    const e = G(); e.position.set(s * 0.062, 0.025, 0.088); H.add(e); E.push(e);
    e.add(sphere(0.058, WHITE, 0, 0, 0, { seg: 12 }));
    const sw = G(); sw.position.z = 0.052; e.add(sw); swirl.push(sw);
    add(sw, arc(0.032, 0.007, PI * 1.5, 0xff2fd0, { outline: false, seg: 12 }), R(arc(0.017, 0.006, PI * 1.3, 0xff2fd0, { outline: false, seg: 10 }), 0, 0, PI));
    e.add(sphere(0.011, INK, 0, 0, 0.057, { seg: 6, outline: false }));
    e.add(sphere(0.008, WHITE, 0.016, 0.02, 0.054, { seg: 4, ...glow(WHITE) }));
    H.add(R(box(0.055, 0.012, 0.014, 0x8a5a2a, s * 0.06, 0.088, 0.1, { outline: false }), 0, 0, -s * 0.35));
  }
  // 大耳朵（根部樞紐，可抖動）
  const earsP = [1, -1].map(s => pivot(H, s * 0.05, 0.035, -0.01,
    R(cone(0.068, 0.21, TAN, s * 0.11, 0.12, -0.01), 0, 0, -s * 0.6),
    R(cone(0.04, 0.13, 0xff9fb8, s * 0.103, 0.11, 0.012, { outline: false }), 0, 0, -s * 0.6)));
  // 外露大腦＋玻璃罩＋觸角
  const brain = G(); brain.position.set(0, 0.115, -0.02); H.add(brain);
  add(brain, S(sphere(0.08, 0xff86ad), 1, 0.75, 1.15), R(torus(0.05, 0.01, 0xe0558a, 0, 0.03, 0, { outline: false, seg: 12 }), PI / 2), R(torus(0.06, 0.009, 0xe0558a, 0, 0, 0.03, { outline: false, seg: 12 }), 0, PI / 2, 0));
  H.add(sphere(0.105, 0xbff6ff, 0, 0.1, -0.02, { transparent: true, opacity: 0.35, outline: false, shadow: false }));
  H.add(R(torus(0.1, 0.014, 0xb8c2cc, 0, 0.07, -0.02), PI / 2));
  const tips = [];
  const ant = [1, -1].map(s => {
    const tip = sphere(0.026, LIME, s * 0.07, 0.31, -0.03, { seg: 8, mat: flat(LIME) });
    tips.push(tip);
    return pivot(H, s * 0.03, 0.19, -0.02, rod([s * 0.03, 0.19, -0.02], [s * 0.07, 0.3, -0.03], 0.008, 0x8a96a2, { outline: false }), tip);
  });
  return fin(g, { body, head: N, legL, legR, tail, eyes: E, mouth: M, extra: [...ant, ...earsP] }, 1, t => {
    swirl[0].rotation.z = t * 5; swirl[1].rotation.z = -t * 5;
    const p = 1 + wave(t, 9, 0.25); tips[0].scale.setScalar(p); tips[1].scale.setScalar(2 - p);
    brain.scale.setScalar(1 + wave(t, 4, 0.05));
    torso.rotation.z = wave(t, 47, 0.03); H.position.x = wave(t, 53, 0.003);
    trot(legL, legR, bL, bR);
  });
}

// 垃圾桶變異浣熊：直立小胖子、三隻眼、頭頂香蕉皮、垃圾桶蓋盾、爪子、綠色口水
function raccoon() {
  const GREY = 0x8b8f9c, LIGHT = 0xdfe0e6, DARK = 0x2a2a33, SLIME = 0x7dff3a;
  const h = humanoid({ hip: 0.2, th: 0.3, w: 0.34, d: 0.28, headR: 0.155, torso: false, pelvis: false, neck: 0, head: false,
    skin: GREY, pants: GREY, shirt: GREY, legR: 0.062, legX: 0.09, shoeH: 0.05, shoe: DARK, sole: 0x1c1c24, shoeL: 0.14, armR: 0.045, armLen: 0.22, hand: DARK, shoulderY: 0.27 });
  const { g, body, H } = h;
  body.add(S(sphere(0.2, GREY, 0, 0.13, 0), 1, 1.12, 0.9));
  body.add(S(sphere(0.14, LIGHT, 0, 0.1, 0.095, { outline: false }), 1, 1.1, 0.55));
  // 胸前螢光污漬、肚子上的魚骨貼紙
  body.add(S(sphere(0.022, SLIME, 0.12, 0.2, 0.13, { outline: false }), 1, 1.6, 0.6));
  body.add(rod([-0.08, 0.06, 0.16], [0.0, 0.08, 0.17], 0.006, WHITE, { outline: false }));
  for (const x of [-0.06, -0.04, -0.02]) body.add(R(box(0.004, 0.03, 0.004, WHITE, x, 0.07, 0.172, { outline: false }), 0, 0, 0.1));
  // 環紋尾巴
  const tail = G(); tail.position.set(0, 0.06, -0.15); body.add(tail);
  for (let i = 0; i < 4; i++) tail.add(R(cyl(0.062 - i * 0.004, 0.062 - i * 0.004, 0.09, i % 2 ? GREY : DARK, 0, -0.02 + i * 0.054, -0.02 - i * 0.072, { seg: 10 }), -0.93));
  tail.add(sphere(0.05, DARK, 0, 0.2, -0.3, { seg: 10 }));
  // 頭
  H.add(S(sphere(0.155, GREY), 1.12, 0.95, 1));
  H.add(S(sphere(0.115, LIGHT, 0, -0.03, 0.07, { outline: false }), 1.2, 0.8, 0.8));
  for (const s of [1, -1]) H.add(S(sphere(0.055, 0x1c1c24, s * 0.06, 0.02, 0.115, { outline: false }), 1.45, 0.8, 0.6));
  for (const s of [1, -1]) H.add(R(box(0.06, 0.03, 0.02, LIGHT, s * 0.06, 0.07, 0.135, { outline: false }), 0, 0, -s * 0.3));
  const earsP = [1, -1].map(s => pivot(H, s * 0.08, 0.1, -0.01,
    R(cone(0.05, 0.08, GREY, s * 0.1, 0.13, -0.01), 0, 0, -s * 0.45),
    R(cone(0.03, 0.05, 0xff9fb8, s * 0.098, 0.128, 0.006, { outline: false, seg: 8 }), 0, 0, -s * 0.45)));
  const E = eyes(H, 0.155, { r: 0.034, gap: 0.06, y: 0.02, z: 0.16, pupil: 0xd01818, pr: 0.55 });
  // 額頭第三隻眼（綠色）
  const e3 = G(); e3.position.set(0, 0.09, 0.135); H.add(e3); E.push(e3);
  e3.add(sphere(0.03, 0x9dff3a, 0, 0, 0, { seg: 10 }));
  const iris3 = sphere(0.014, INK, 0, 0, 0.026, { seg: 6, outline: false }); e3.add(iris3);
  // 鼻吻、鼻子、鬍鬚
  H.add(R(cone(0.055, 0.12, LIGHT, 0, -0.045, 0.17), PI / 2));
  H.add(sphere(0.022, INK, 0, -0.045, 0.235, { seg: 8 }));
  for (const s of [1, -1]) for (const dy of [0.012, -0.012]) H.add(rod([s * 0.03, -0.05, 0.2], [s * 0.13, -0.05 + dy * 3, 0.17], 0.003, INK, { outline: false }));
  const M = mouth(H, 0.155, 0.05, 0.02, -0.095, { z: 0.15, teeth: true });
  // 會滴的綠色口水
  const drool = S(sphere(0.016, SLIME, 0.02, -0.11, 0.165, { outline: false, seg: 8 }), 0.8, 1.6, 0.8); H.add(drool);
  // 香蕉皮帽
  const peel = G(); peel.position.set(0, 0.15, 0); H.add(peel);
  for (let i = 0; i < 3; i++) peel.add(R(capsule(0.024, 0.09, 0xffd43a, Math.sin(i * 2.1) * 0.05, 0, Math.cos(i * 2.1) * 0.05), Math.cos(i * 2.1) * 0.9, 0, -Math.sin(i * 2.1) * 0.9));
  for (let i = 0; i < 3; i++) peel.add(sphere(0.008, 0x5a3a1a, Math.sin(i * 2.1) * 0.09, -0.03, Math.cos(i * 2.1) * 0.09, { seg: 4, outline: false }));
  peel.add(cyl(0.012, 0.016, 0.05, 0x5a3a1a, 0, 0.05, 0));
  // 垃圾桶蓋盾（左手）＋右手爪子
  pose(h.armL, -1.15, 0, -0.15, 0.3);
  const lid = G();
  add(lid, R(cyl(0.2, 0.2, 0.025, 0xa7b0ba, 0, 0, 0.04, { seg: 16 }), PI / 2), torus(0.13, 0.012, 0x7d8792, 0, 0, 0.055, { outline: false }), box(0.08, 0.03, 0.03, 0x7d8792, 0, 0, 0.065));
  add(lid, S(sphere(0.035, 0x6d7782, 0.1, -0.08, 0.05, { outline: false, seg: 8 }), 1, 1, 0.3), R(box(0.07, 0.05, 0.005, 0xff4fa3, -0.11, 0.07, 0.056, { outline: false }), 0, 0, 0.3));
  hold(h.armL, lid);
  pose(h.armR, -1.9, 0, 0.3, 0.2);
  const claws = G();
  for (const s of [-1, 0, 1]) claws.add(R(cone(0.014, 0.07, 0xf3f0e0, s * 0.025, 0.02, 0.04, { seg: 6 }), 1.1));
  hold(h.armR, claws);
  return fin(g, { ...P6(h), weapon: lid, tail, eyes: E, mouth: M, extra: [peel, ...earsP] }, 1, t => {
    const k = (t * 0.7) % 1;
    drool.position.y = -0.11 - k * 0.09; drool.scale.set(0.8, 1.2 + k * 1.2, 0.8); drool.visible = k < 0.85;
    iris3.position.x = wave(t, 1.3, 0.012); iris3.position.y = wave(t, 1.9, 0.008);
  });
}

// 錫箔紙帽陰謀論弓手：迷彩背心、大鬍子、一大一小偏執眼、閃燈天線錫箔帽、PVC 水管弓、報紙捲箭筒
function tinfoil() {
  const PLAID = 0xe0702a, CAMO = 0x5d7a3a, FOIL = 0xdfe4ea, BEARD = 0x7a4a24;
  const h = humanoid({ hip: 0.7, th: 0.48, w: 0.42, d: 0.26, headR: 0.21, shirt: PLAID, pants: 0xc2a878, shorts: true, shoe: 0x6b4a2b, sole: 0x3a2a1a, sock: 0xf2f2f2, armLen: 0.48 });
  const { g, body, H } = h;
  body.add(box(h.w + 0.03, h.th * 0.86, h.d + 0.03, CAMO, 0, h.th * 0.5, 0));
  body.add(box(0.12, h.th * 0.84, 0.02, PLAID, 0, h.th * 0.5, h.d / 2 + 0.02, { outline: false }));
  for (const [x, y] of [[0.14, 0.32], [-0.13, 0.18], [0.12, 0.12]]) body.add(S(sphere(0.05, 0x3a5124, x, y, h.d / 2 + 0.01, { outline: false }), 1.3, 0.8, 0.3));
  // 背心口袋（塞著手電筒與對講機）
  body.add(box(0.1, 0.09, 0.04, 0x4a6230, -0.14, 0.3, h.d / 2 + 0.03));
  body.add(cyl(0.022, 0.022, 0.1, 0x2a2a2a, -0.16, 0.38, h.d / 2 + 0.03, { seg: 8 }));
  body.add(at(txt('THEY\nLIE', 0.12, { color: '#fff', bg: '#c4161c', size: 48 }), 0.13, 0.36, h.d / 2 + 0.03));
  // 腰包（膠帶補過）
  body.add(box(0.2, 0.08, 0.08, 0x3a3a44, 0.05, 0.04, h.d / 2 + 0.04));
  body.add(box(0.06, 0.085, 0.085, 0xb8c2cc, 0.1, 0.04, h.d / 2 + 0.04, { outline: false }));
  // 頭：大鬍子、鼻子、偏執眼（左大右小）
  H.add(S(sphere(0.17, BEARD, 0, -0.11, 0.07), 1.1, 1.05, 0.8));
  H.add(S(sphere(0.07, BEARD, 0, -0.26, 0.1, { seg: 10 }), 1, 1.2, 0.8));
  for (const s of [1, -1]) H.add(R(capsule(0.025, 0.07, BEARD, s * 0.05, -0.045, 0.19, { seg: 8, outline: false }), 0, 0, s * 1.2));
  nose(H, 0.21, 0.045, 0xd8906a, -0.01);
  ears(H, 0.21, SKIN);
  const E = eyes(H, 0.21, { r: 0.06, gap: 0.08, y: 0.04, pr: 0.32, prL: 0.6, look: 0.03, brow: 0x5a3a1a, angry: -0.25 });
  const pupils = [E[0].children[1], E[1].children[1]];
  eyeScale(E[1], 0.82);
  const M = mouth(H, 0.21, 0.07, 0.035, -0.09, { teeth: true, tilt: 0.15 });
  // 錫箔帽（多層皺褶）＋閃燈天線
  const hat = G(); H.add(hat);
  hat.add(cone(0.22, 0.38, FOIL, 0, 0.27, 0, { seg: 7 }));
  hat.add(R(cone(0.2, 0.3, 0xc5ccd4, 0.02, 0.22, -0.01, { seg: 5 }), 0.1, 0.6, 0.1));
  hat.add(R(torus(0.2, 0.025, 0xc5ccd4, 0, 0.1, 0, { seg: 9 }), PI / 2));
  const led = sphere(0.025, 0xff3a3a, 0.04, 0.57, 0, { seg: 8, mat: flat(0xff3a3a) });
  const antenna = pivot(H, 0, 0.45, 0, rod([0, 0.45, 0], [0.04, 0.56, 0], 0.008, 0x8a96a2, { outline: false }), led);
  // 弓（左手前伸）
  pose(h.armL, -1.4, 0, 0.15, 0.05);
  const bow = G();
  const limb = arc(0.55, 0.035, 1.9, 0xf5f5f0);
  R(limb, 0, -PI / 2, -0.95); limb.position.z = -0.55;
  const string = cyl(0.006, 0.006, 0.9, 0x222222, 0, 0, -0.23, { outline: false });
  const arrow = rod([0, 0, -0.3], [0, 0, 0.32], 0.012, 0xa0703a, { outline: false });
  add(bow, limb, string, arrow, cyl(0.045, 0.045, 0.14, 0x8a929c), R(cone(0.03, 0.08, 0xff7a1a, 0, 0, 0.36, { seg: 6 }), PI / 2));
  for (const s of [1, -1]) bow.add(R(box(0.045, 0.004, 0.06, 0x2fd4ff, s * 0.02, 0, -0.27, { outline: false }), 0, 0, s * 0.5));
  for (const y of [0.3, -0.3]) bow.add(cyl(0.04, 0.04, 0.06, 0x8a929c, 0, y, -0.55 + Math.sqrt(0.3025 - y * y)));
  bow.add(cyl(0.05, 0.05, 0.05, 0xb8c2cc, 0, 0.09, 0, { outline: false }));
  bow.rotation.z = 0.55;
  hold(h.armL, bow);
  pose(h.armR, -1.35, 0, 0.35, 0.5);
  // 報紙捲箭筒＋插著的箭
  const quiver = G(); quiver.position.set(-0.1, h.th * 0.55, -h.d / 2 - 0.08); quiver.rotation.set(-0.15, 0, 0.35); body.add(quiver);
  add(quiver, cyl(0.07, 0.07, 0.5, 0xeee6cf), torus(0.07, 0.01, 0x8a8a8a, 0, 0.1, 0, { outline: false, seg: 12 }));
  quiver.children[1].rotation.x = PI / 2;
  for (const dx of [-0.03, 0.02]) add(quiver, cyl(0.008, 0.008, 0.18, 0xa0703a, dx, 0.3, 0, { outline: false, seg: 6 }), box(0.06, 0.08, 0.01, 0xff7a1a, dx, 0.36, 0, { outline: false }));
  return fin(g, { ...P6(h), weapon: bow, eyes: E, mouth: M, extra: [antenna, quiver] }, 1, t => {
    led.visible = (t * 2.5) % 1 < 0.5;
    // 偏執：瞳孔左右亂飄
    const lx = Math.sign(Math.sin(t * 1.7)) * 0.018;
    pupils[0].position.x = lx; pupils[1].position.x = lx;
  });
}

// 外星速食吉祥物・漢堡魔神：會走路的巨型漢堡，芝麻麵包頭、小惡魔角、獠牙大嘴、吉祥物手套、逼你付小費的平板
function burger() {
  const BUN = 0xe08f3c, BUN2 = 0xc9762a, PATTY = 0x5b3320, CHEESE = 0xffc21a, LETTUCE = 0x5bbf3a, TOMATO = 0xe5352a;
  const h = humanoid({ hip: 0.72, th: 0.7, w: 1.2, torso: false, pelvis: false, head: false, neck: 0, headY: 0.73, headLift: 0,
    legR: 0.11, legX: 0.3, shoe: WHITE, sole: 0xe5352a, shoeL: 0.4, shoeH: 0.16, shoeW: 0.3, pants: 0x6b3b1f,
    armR: 0.085, armLen: 0.55, shirt: 0x6b3b1f, hand: 0xfff1d0, handR: 0.13, shoulderY: 0.42, shoulderX: 0.74, cuffArm: 0xfff1d0 });
  const { g, body, H } = h;
  // 下層麵包、肉排（烤痕）、起司、生菜、番茄
  body.add(cyl(0.7, 0.62, 0.3, BUN, 0, 0.15, 0, { seg: 22 }));
  body.add(cyl(0.63, 0.6, 0.04, BUN2, 0, 0.005, 0, { seg: 22, outline: false }));
  body.add(cyl(0.77, 0.77, 0.24, PATTY, 0, 0.42, 0, { seg: 22 }));
  for (const dy of [-0.06, 0.04]) for (const a of [-0.3, 0.3]) body.add(R(box(0.24, 0.025, 0.02, 0x2a1408, Math.sin(a) * 0.77, 0.42 + dy, Math.cos(a) * 0.765, { outline: false }), 0, a, 0.4));
  body.add(R(box(1.1, 0.05, 1.1, CHEESE, 0, 0.565, 0, { r: 0.02 }), 0, PI / 4));
  for (const [x, z, l] of [[0, 0.78, 0.12], [0.55, 0.55, 0.16], [-0.55, 0.55, 0.1], [0.78, 0, 0.13]]) body.add(capsule(0.04, l, CHEESE, x, 0.52 - l * 0.3, z));
  // 生菜：一圈荷葉邊
  body.add(cyl(0.8, 0.8, 0.07, LETTUCE, 0, 0.615, 0, { seg: 10 }));
  for (let i = 0; i < 10; i++) { const a = i * PI / 5 + 0.3; body.add(R(S(sphere(0.12, 0x6fd44a, Math.sin(a) * 0.8, 0.6, Math.cos(a) * 0.8, { seg: 8, outline: false }), 1, 0.35, 0.7), 0, a, 0)); }
  body.add(cyl(0.72, 0.72, 0.08, TOMATO, 0, 0.685, 0, { seg: 20 }));
  for (const a of [0.5, -0.5, 2.2]) body.add(R(S(sphere(0.05, 0xffd0a0, Math.sin(a) * 0.7, 0.685, Math.cos(a) * 0.7, { seg: 6, outline: false }), 1, 0.4, 0.4), 0, a, 0));
  // 頭 = 上層麵包
  H.add(dome(0.76, BUN, 0, 0, 0, 0.95, { seg: 22 }));
  H.add(S(sphere(0.3, 0xf2a95a, 0.2, 0.5, 0.25, { outline: false, seg: 10 }), 1, 0.4, 0.6));
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, rr = 0.2 + (i % 4) * 0.12, yy = Math.sqrt(Math.max(0, 1 - (rr / 0.76) ** 2)) * 0.72;
    if (Math.cos(a) * rr > 0.25 && Math.abs(Math.sin(a) * rr) < 0.32) continue; // 臉部留白
    H.add(R(S(sphere(0.04, 0xfff6e0, Math.sin(a) * rr, yy, Math.cos(a) * rr, { seg: 6, outline: false }), 1, 0.5, 1.6), 0, a, 0));
  }
  const E = eyes(H, 0.76, { r: 0.13, gap: 0.21, y: 0.3, z: 0.73, pr: 0.4, iris: 0xff3a1a, ir: 0.62, brow: 0x3a1a0a, angry: 0.45, browY: 0.02, browH: 0.6, lid: BUN2, lidX: -0.5, lidZ: 0.4 });
  // 獠牙大嘴（嘴在麵包邊緣下方，含舌頭與上下排牙）
  const M = G(); M.position.set(0, 0.06, 0.7); H.add(M);
  add(M, S(sphere(0.2, 0x5a1020, 0, 0, 0, { seg: 14 }), 1.5, 0.45, 0.4), box(0.42, 0.04, 0.06, WHITE, 0, 0.045, 0.04, { outline: false, r: 0.015 }));
  M.add(S(sphere(0.08, 0xff6a8a, 0.04, -0.04, 0.05, { outline: false, seg: 8 }), 1.3, 0.5, 0.6));
  for (const s of [1, -1]) M.add(R(cone(0.045, 0.16, WHITE, s * 0.17, 0.0, 0.06, { seg: 8 }), PI));
  for (const x of [-0.06, 0.06]) M.add(R(cone(0.03, 0.08, WHITE, x, 0.03, 0.07, { seg: 6, outline: false }), PI));
  // 番茄醬口水（會滴）
  const drip = S(sphere(0.035, TOMATO, -0.12, -0.08, 0.06, { seg: 8 }), 0.8, 1.4, 0.8); M.add(drip);
  // 小惡魔角＋外星觸角
  for (const s of [1, -1]) {
    H.add(R(cone(0.1, 0.34, 0xd9261c, s * 0.3, 0.7, -0.05), 0, 0, -s * 0.35));
    H.add(R(torus(0.095, 0.02, 0x8a1010, s * 0.27, 0.57, -0.05, { outline: false, seg: 12 }), PI / 2, 0, -s * 0.35));
  }
  const orb = sphere(0.07, 0x9dff3a, 0, 1.02, -0.3, { seg: 10, mat: flat(0x9dff3a) });
  const halo = torus(0.11, 0.012, 0x9dff3a, 0, 1.02, -0.3, { ...glow(0x9dff3a), seg: 16 });
  const antenna = pivot(H, 0, 0.7, -0.15, rod([0, 0.7, -0.15], [0, 0.98, -0.3], 0.02, 0x8a96a2), orb, halo);
  // 吉祥物手套：四指
  for (const A of [h.armL, h.armR]) for (const i of [-1, 0, 1]) A.userData.fore.add(capsule(0.035, 0.06, 0xfff1d0, i * 0.055, -A.userData.foreLen - 0.13, 0.03, { seg: 6, outline: false }));
  // 平板（逼簽小費單，數字會跳）
  pose(h.armR, -1.2, 0, 0.25, 0.2);
  const tab = G();
  add(tab, R(box(0.5, 0.36, 0.035, 0x222630, 0, 0.12, 0.05), -0.25));
  const scr = [];
  for (const [i, s] of ['TIP\n25%', 'TIP\n40%', 'TIP\n99%'].entries()) {
    const p = txt(s, 0.36, { color: '#1b1226', bg: i === 2 ? '#ff4a6a' : '#9dff3a', size: 60 });
    R(p, -0.25); p.position.set(0, 0.12, 0.07); p.scale.y = 0.75; p.visible = i === 0; tab.add(p); scr.push(p);
  }
  hold(h.armR, tab);
  pose(h.armL, -0.3, 0, 0.08, 0.4);
  return fin(g, { ...P6(h), weapon: tab, eyes: E, mouth: M, extra: [antenna] }, 1, t => {
    const k = Math.floor(t * 1.2) % 3; scr[0].visible = k === 0; scr[1].visible = k === 1; scr[2].visible = k === 2;
    const d = (t * 0.6) % 1; drip.position.y = -0.08 - d * 0.18; drip.visible = d < 0.8;
    halo.rotation.x = PI / 2 + wave(t, 2, 0.3); halo.rotation.z = t * 1.5; orb.scale.setScalar(1 + wave(t, 6, 0.15));
  });
}

// ── 第 2 關 ──────────────────────────────────────────
// 搶電視狂暴大媽：大捲髮＋頭頂墨鏡、花襯衫、腰包、張嘴怒吼，推著塞滿電視與衛生紙的購物車
function auntie() {
  const HAIR = 0xc0472c, SHIRT = 0xe0287c, MET = 0xc3c9d2;
  const h = humanoid({ hip: 0.68, th: 0.5, w: 0.48, d: 0.3, headR: 0.22, shirt: SHIRT, pants: 0x1fa596, shoe: WHITE, sole: 0xd8dde3, belly: 0.2, armLen: 0.46, shortSleeve: true });
  const { g, body, H } = h;
  for (const [x, y] of [[0.12, 0.38], [-0.1, 0.28], [0.05, 0.16], [-0.16, 0.42], [0.18, 0.22]]) body.add(S(sphere(0.035, 0xffe14a, x, y, h.d / 2 + 0.06, { outline: false, seg: 8 }), 1, 1, 0.4));
  body.add(box(0.2, 0.05, 0.03, 0xf6f0e0, 0, h.th - 0.02, h.d / 2 + 0.005, { outline: false }));
  // 腰包＋拉鍊
  body.add(box(0.26, 0.11, 0.1, 0x7a4b2a, 0, 0.06, h.d / 2 + 0.07));
  body.add(box(0.22, 0.012, 0.01, 0xffcc33, 0, 0.08, h.d / 2 + 0.122, { outline: false }));
  // 捲髮（大球少一點，保持輪廓）
  for (const [x, y, z, r] of [[0, 0.17, -0.04, 0.12], [0.15, 0.09, -0.06, 0.11], [-0.15, 0.09, -0.06, 0.11], [0, 0.04, -0.18, 0.13], [0.18, -0.06, -0.06, 0.09], [-0.18, -0.06, -0.06, 0.09]]) H.add(sphere(r, HAIR, x, y, z, { seg: 10 }));
  for (const [x, z] of [[0.08, 0.06], [-0.1, 0.07]]) H.add(sphere(0.05, 0xa83a22, x, 0.19, z, { seg: 8, outline: false }));
  // 頭頂墨鏡
  for (const s of [1, -1]) H.add(R(S(sphere(0.05, INK, s * 0.065, 0.17, 0.12, { seg: 10 }), 1.2, 0.8, 0.4), -0.7));
  H.add(box(0.05, 0.012, 0.012, 0xffcc33, 0, 0.18, 0.14, { outline: false }));
  const E = eyes(H, 0.22, { r: 0.05, gap: 0.075, y: 0.03, pr: 0.4, iris: 0x2f8a4a, brow: 0x7a2a1a, angry: 0.5, lid: SKIN, lidX: -0.6, lidZ: 0.5 });
  nose(H, 0.22, 0.035, 0xe8a888, -0.02);
  const M = mouth(H, 0.22, 0.1, 0.08, -0.1, { teeth: true, lower: true, tongue: true });
  cheeks(H, 0.22);
  // 圈圈耳環
  for (const s of [1, -1]) H.add(torus(0.035, 0.007, 0xffcc33, s * 0.205, -0.08, 0.02, { outline: false, seg: 12 }));
  pose(h.armL, -1.25, 0, -0.1, 0.25); pose(h.armR, -1.25, 0, 0.1, 0.25);
  // 購物車
  const cart = G(); cart.position.set(0, 0, 0.5); g.add(cart);
  add(cart, box(0.52, 0.34, 0.5, MET, 0, 0.6, 0.12), box(0.46, 0.04, 0.44, 0x7d8792, 0, 0.77, 0.12, { outline: false }));
  for (const y of [0.52, 0.66]) cart.add(box(0.53, 0.01, 0.51, 0x9aa2ac, 0, y, 0.12, { outline: false }));
  for (const [a, b] of [[[0.22, 0.43, -0.13], [0.2, 0.08, -0.08]], [[-0.22, 0.43, -0.13], [-0.2, 0.08, -0.08]], [[0.22, 0.43, 0.36], [0.2, 0.08, 0.3]], [[-0.22, 0.43, 0.36], [-0.2, 0.08, 0.3]]]) cart.add(rod(a, b, 0.015, MET, { outline: false }));
  const wheels = [];
  for (const [x, z] of [[0.2, -0.08], [-0.2, -0.08], [0.2, 0.3], [-0.2, 0.3]]) { const w = R(cyl(0.05, 0.05, 0.04, INK, x, 0.05, z, { seg: 10, outline: false }), 0, 0, PI / 2); cart.add(w); wheels.push(w); }
  cart.add(rod([-0.28, 0.95, -0.22], [0.28, 0.95, -0.22], 0.025, 0xe5352a));
  add(cart, rod([0.25, 0.95, -0.22], [0.25, 0.75, -0.13], 0.015, MET, { outline: false }), rod([-0.25, 0.95, -0.22], [-0.25, 0.75, -0.13], 0.015, MET, { outline: false }));
  const tv = box(0.5, 0.36, 0.1, 0xc99a5e, 0, 0.98, 0.2); cart.add(tv);
  const tvl = txt('85"', 0.26, { color: '#1b1226', size: 60 }); tvl.position.set(0, 0.99, 0.26); cart.add(tvl);
  cart.add(box(0.22, 0.05, 0.005, 0xe5352a, 0, 1.1, 0.256, { outline: false }));
  for (const [x, z] of [[0.15, 0.0], [-0.15, 0.0], [0, 0.0]]) cart.add(cyl(0.065, 0.065, 0.16, 0xf6f6f6, x, 0.86, z, { seg: 10, outline: x === 0 }));
  cart.add(cyl(0.022, 0.022, 0.165, 0xb8a888, 0, 0.86, 0.0, { seg: 6, outline: false }));
  cart.add(R(txt('SALE', 0.16, { color: '#fff', bg: '#e5352a', size: 44 }), 0, PI / 2, 0)).children.at(-1).position.set(0.262, 0.62, 0.12);
  return fin(g, { ...P6(h), weapon: cart, eyes: E, mouth: M }, 1, t => {
    // 怒吼：嘴巴一張一合
    M.children[0].scale.y = 1 + Math.max(0, wave(t, 7, 0.45));
    for (const w of wheels) w.rotation.x = wave(t, 3, 0.2);
  });
}

// 插隊球鞋黃牛黨：反戴帽、反光墨鏡、金鍊、巨大老爹鞋，左手抱一疊限量鞋盒、右手拳擊手套
function reseller() {
  const HOOD = 0xff5a1f, SKN = 0xc68a5e;
  const h = humanoid({ hip: 0.74, th: 0.5, w: 0.44, d: 0.28, headR: 0.22, shirt: HOOD, pants: 0x6a6f7a, shoe: WHITE, sole: 0xff2f6a, shoeW: 0.24, shoeL: 0.4, shoeH: 0.16, legR: 0.09, armLen: 0.48, skin: SKN, cuffArm: 0xe24a10, cuff: 0x4a4f5a });
  const { g, body, H } = h;
  body.add(R(torus(0.16, 0.06, HOOD, 0, h.th + 0.02, -0.1), PI / 2 - 0.3));
  body.add(box(0.26, 0.12, 0.04, 0xe24a10, 0, 0.14, h.d / 2 + 0.01, { outline: false }));
  for (const s of [1, -1]) body.add(rod([s * 0.05, h.th - 0.02, h.d / 2 + 0.01], [s * 0.06, h.th - 0.18, h.d / 2 + 0.02], 0.008, WHITE, { outline: false }));
  // 金鍊＋$ 墜子
  body.add(R(torus(0.12, 0.018, 0xffcc33, 0, h.th - 0.05, 0.1), PI / 2 - 0.5));
  body.add(R(cyl(0.045, 0.045, 0.015, 0xffcc33, 0, h.th - 0.17, h.d / 2 + 0.03, { seg: 10 }), PI / 2));
  body.add(at(txt('$', 0.05, { color: '#7a5a00', size: 60 }), 0, h.th - 0.17, h.d / 2 + 0.04));
  // 口袋手機
  body.add(box(0.08, 0.13, 0.015, 0x1b1f2a, -0.16, -0.02, h.d / 2 + 0.01, { outline: false }));
  for (const [s, L] of [[1, h.legL], [-1, h.legR]]) {
    L.userData.pose.add(box(0.02, 0.06, 0.24, 0xff2f6a, s * 0.125, -0.74 + 0.08, 0.05, { outline: false }));
    L.userData.pose.add(box(0.12, 0.02, 0.1, 0xd8dde3, 0, -0.74 + 0.15, 0.14, { outline: false }));
  }
  // 頭：反戴帽、反光墨鏡、耳機、壞笑
  H.add(dome(0.235, 0x1fb5a8, 0, 0.02, 0, 0.98));
  H.add(box(0.26, 0.03, 0.2, 0x1fb5a8, 0, 0.04, -0.27));
  H.add(box(0.06, 0.04, 0.03, 0xffcc33, 0, 0.16, 0.2, { outline: false }));
  const shades = G(); H.add(shades);
  add(shades, box(0.34, 0.08, 0.06, INK, 0, 0.04, 0.19, { r: 0.025 }), box(0.12, 0.05, 0.03, 0x00e5ff, 0.08, 0.05, 0.225, { outline: false }));
  const glare = box(0.03, 0.06, 0.01, WHITE, -0.1, 0.05, 0.226, glow(WHITE)); shades.add(glare);
  // 墨鏡後的眼睛（只給眨眼用，平常看不到）
  const E = [G(), G()]; E[0].position.set(0.08, 0.04, 0.19); E[1].position.set(-0.08, 0.04, 0.19); H.add(E[0], E[1]);
  ears(H, 0.22, SKN);
  for (const s of [1, -1]) H.add(sphere(0.025, WHITE, s * 0.215, -0.02, 0.02, { seg: 8, outline: false }));
  nose(H, 0.22, 0.04, 0xa86a42, -0.04);
  const M = mouth(H, 0.22, 0.09, 0.03, -0.11, { teeth: true, tilt: -0.2, x: 0.02 });
  // 鞋盒堆（左手）＋拳擊手套（右手）
  pose(h.armL, -0.55, 0, 0.2, 0.9);
  const stack = G();
  [0xff7a1a, INK, 0xf2f2f2].forEach((c, i) => {
    stack.add(R(box(0.36, 0.13, 0.22, c, 0, 0.08 + i * 0.13, 0.04), 0, (i - 1) * 0.12));
    stack.add(R(box(0.37, 0.03, 0.225, i === 1 ? 0xff2f6a : 0x2a2a33, 0, 0.12 + i * 0.13, 0.04, { outline: false }), 0, (i - 1) * 0.12));
  });
  stack.add(at(txt('LTD', 0.12, { color: '#fff', size: 48 }), 0, 0.08, 0.152));
  hold(h.armL, stack, 0.06, -0.05, 0);
  pose(h.armR, -0.9, 0, 0.15, 0.6);
  const glove = G();
  add(glove, S(sphere(0.13, 0xe5352a, 0, 0, 0.02), 1, 1.1, 1.2), cyl(0.08, 0.09, 0.08, WHITE, 0, 0.12, -0.02), S(sphere(0.05, 0xe5352a, -0.1, 0.02, 0.06, { seg: 8 }), 1, 1.3, 1));
  hold(h.armR, glove);
  return fin(g, { ...P6(h), weapon: glove, eyes: E, mouth: M }, 1, t => {
    const k = (t * 0.4) % 1; glare.position.x = -0.14 + k * 0.32; glare.visible = k < 0.9;
  });
}

// 車頂條碼機狙擊手：店員背心、遮陽帽＋耳機麥克風，雙手端著巨型條碼掃描槍（紅色雷射會掃）
function scanner() {
  const VEST = 0x9ad61f;
  const h = humanoid({ hip: 0.74, th: 0.5, w: 0.42, d: 0.26, headR: 0.22, shirt: 0xf4f4f4, pants: 0xb59a6a, shoe: INK, sole: 0xf2efe6, armLen: 0.48 });
  const { g, body, H } = h;
  body.add(box(h.w + 0.03, h.th * 0.8, h.d + 0.03, VEST, 0, h.th * 0.46, 0));
  body.add(box(0.1, h.th * 0.78, 0.02, 0xf4f4f4, 0, h.th * 0.47, h.d / 2 + 0.02, { outline: false }));
  for (const s of [1, -1]) body.add(box(0.03, h.th * 0.78, 0.01, 0xd8ff8a, s * 0.08, h.th * 0.47, h.d / 2 + 0.025, { outline: false }));
  const tag = txt('ASK\nME!', 0.11, { color: '#1b1226', bg: '#ffe14a', size: 48 }); tag.position.set(0.14, 0.34, h.d / 2 + 0.025); body.add(tag);
  // 口袋原子筆、識別證掛繩
  for (const [x, c] of [[-0.15, 0x2f6ad4], [-0.12, 0xe5352a]]) body.add(cyl(0.008, 0.008, 0.08, c, x, 0.36, h.d / 2 + 0.03, { seg: 6, outline: false }));
  body.add(rod([-0.06, h.th, 0.08], [-0.05, 0.18, h.d / 2 + 0.03], 0.006, 0xe5352a, { outline: false }));
  body.add(box(0.07, 0.09, 0.01, WHITE, -0.05, 0.14, h.d / 2 + 0.03, { outline: false }));
  // 腰上的標價槍
  body.add(box(0.06, 0.1, 0.12, 0xff7a1a, -0.24, 0.05, 0.02));
  // 頭
  H.add(R(torus(0.22, 0.03, 0xe5352a, 0, 0.1, 0), PI / 2 - 0.1));
  H.add(R(box(0.3, 0.025, 0.18, 0xe5352a, 0, 0.1, 0.27, { r: 0.01 }), -0.1));
  H.add(dome(0.225, 0x5b3a1e, 0, 0.03, -0.01, 0.92));
  H.add(S(sphere(0.06, INK, 0.21, 0, 0), 0.6, 1, 1));
  H.add(S(sphere(0.06, INK, -0.21, 0, 0), 0.6, 1, 1));
  H.add(rod([0.22, -0.03, 0.02], [0.08, -0.12, 0.18], 0.01, INK, { outline: false }));
  H.add(sphere(0.022, INK, 0.08, -0.12, 0.19, { seg: 8 }));
  const E = eyes(H, 0.22, { r: 0.045, gap: 0.08, y: 0.02, look: 0, pr: 0.45, iris: 0x5a8ad4, brow: 0x5b3a1e, angry: 0.3, lid: SKIN, lidX: -0.2, lidZ: 0.1 });
  eyeScale(E[0], 1, 0.85);
  nose(H, 0.22, 0.04, 0xe8a888, -0.03);
  const M = mouth(H, 0.22, 0.08, 0.025, -0.1);
  // 條碼槍：雙手前端
  pose(h.armR, -1.0, 0, 0.25, 0); pose(h.armL, -0.95, 0, -0.55, 0.35);
  const gun = G();
  add(gun, box(0.08, 0.2, 0.1, 0x30343c, 0, 0.06, -0.02), box(0.16, 0.16, 0.36, 0x3a404a, 0, 0.18, 0.1), box(0.22, 0.2, 0.08, 0x30343c, 0, 0.2, 0.3));
  add(gun, box(0.16, 0.12, 0.02, 0xff2a2a, 0, 0.2, 0.345, { ...glow(0xff2a2a) }), box(0.04, 0.03, 0.06, 0xffcc33, 0, 0.27, 0.0, { outline: false }));
  const scope = R(cyl(0.035, 0.035, 0.18, 0x1b1f2a, 0, 0.3, 0.1, { seg: 10 }), PI / 2); gun.add(scope);
  const beam = cyl(0.008, 0.008, 1.2, 0xff2a2a, 0, 0, 0.6, { ...glow(0xff2a2a), seg: 6 }); R(beam, PI / 2);
  const beamP = G(); beamP.position.set(0, 0.2, 0.35); beamP.add(beam); gun.add(beamP);
  const fan = R(box(0.3, 0.004, 0.02, 0xff2a2a, 0, 0, 1.2, glow(0xff2a2a)), 0, 0, 0); beamP.add(fan);
  const bc = txt('|||| ||| ||', 0.14, { color: '#1b1226', bg: '#ffffff', size: 40 }); R(bc, 0, PI / 2); bc.position.set(0.082, 0.18, 0.08); gun.add(bc);
  hold(h.armR, gun, 0.02, 0, 0);
  return fin(g, { ...P6(h), weapon: gun, eyes: E, mouth: M }, 1, t => {
    // 雷射上下掃描＋閃爍
    beamP.rotation.x = wave(t, 2.2, 0.08);
    beam.visible = fan.visible = (t * 9) % 1 < 0.8;
    fan.scale.x = 0.6 + wave(t, 5, 0.4);
  });
}

// 平衡車商場保安隊長・保羅：雙輪平衡車、大肚腩、飛行員墨鏡、八字鬍、對講機、電擊槍（電弧亂跳）
function paul() {
  const SHIRT = 0x9fcdf0, NAVY = 0x23345a, GOLD = 0xffcc33;
  const y0 = 0.21;
  const h = humanoid({ y0, hip: 0.74, th: 0.62, w: 0.6, d: 0.36, headR: 0.25, shirt: SHIRT, pants: NAVY, shoe: INK, sole: 0x111111, belly: 0.33, legX: 0.15, legR: 0.1, armR: 0.085, armLen: 0.58, shoeL: 0.28, skin: 0xf0b896, cuffArm: SHIRT });
  const { g, body, H } = h;
  // 平衡車（輪子會轉、底盤燈）
  const seg = G(); g.add(seg);
  add(seg, box(0.62, 0.08, 0.34, 0x3a3f48, 0, 0.17, 0.02), box(0.5, 0.02, 0.26, 0x1c1f24, 0, 0.215, 0.02, { outline: false }));
  const wheels = [];
  for (const s of [1, -1]) {
    const w = G(); w.position.set(s * 0.37, 0.2, 0.02); seg.add(w); wheels.push(w);
    add(w, R(cyl(0.2, 0.2, 0.1, INK, 0, 0, 0, { seg: 18 }), 0, 0, PI / 2), R(cyl(0.1, 0.1, 0.11, 0xb8c2cc, 0, 0, 0, { seg: 12 }), 0, 0, PI / 2));
    for (let i = 0; i < 3; i++) w.add(R(box(0.112, 0.03, 0.17, 0x7d8792, 0, 0, 0, { outline: false }), i * PI / 3, 0, 0));
    seg.add(R(dome(0.22, 0x5a606a, s * 0.37, 0.2, 0.02, 0.6, { seg: 14 }), 0, 0, -s * 0.2));
  }
  const ledF = box(0.3, 0.025, 0.01, 0x7af7ff, 0, 0.17, 0.195, glow(0x7af7ff)); seg.add(ledF);
  seg.add(rod([0, 0.2, 0.17], [0, 1.12, 0.36], 0.035, 0x5a606a));
  seg.add(rod([-0.24, 1.14, 0.36], [0.24, 1.14, 0.36], 0.03, INK));
  for (const s of [1, -1]) seg.add(cyl(0.04, 0.04, 0.1, 0x2a2f38, s * 0.22, 1.14, 0.36, { seg: 8 })).children.at(-1).rotation.z = PI / 2;
  seg.add(box(0.12, 0.08, 0.06, 0x2a2f38, 0, 1.08, 0.37));
  seg.add(box(0.08, 0.04, 0.005, 0x9dff3a, 0, 1.09, 0.402, glow(0x9dff3a)));
  // 制服細節：領帶、警徽、口袋、肩章、腰帶與裝備
  body.add(box(0.07, 0.36, 0.03, INK, 0, h.th * 0.55, h.d / 2 + 0.1, { outline: false }));
  body.add(R(cyl(0.055, 0.055, 0.02, GOLD, 0.17, h.th * 0.78, h.d / 2 + 0.01, { seg: 6 }), PI / 2));
  body.add(R(cyl(0.025, 0.025, 0.022, 0xd99a0a, 0.17, h.th * 0.78, h.d / 2 + 0.015, { seg: 5, outline: false }), PI / 2));
  for (const s of [1, -1]) body.add(box(0.12, 0.1, 0.02, 0x8ab8dc, s * 0.15, h.th * 0.62, h.d / 2 + 0.005, { outline: false }));
  body.add(txt('SECURITY', 0.2, { color: '#ffffff', bg: '#23345a', size: 36 })).children.at(-1).position.set(-0.15, h.th * 0.82, h.d / 2 + 0.012);
  body.add(box(0.62, 0.08, 0.38, INK, 0, 0.08, 0.04, { outline: false }));
  body.add(R(cyl(0.05, 0.05, 0.03, GOLD, 0, 0.08, 0.235, { seg: 10, outline: false }), PI / 2));
  // 對講機＋閃燈
  body.add(box(0.08, 0.15, 0.06, 0x222222, -0.3, 0.06, 0.12));
  const radioLed = sphere(0.015, 0xff3a3a, -0.28, 0.15, 0.15, { seg: 6, mat: flat(0xff3a3a) }); body.add(radioLed);
  const radioAnt = pivot(body, -0.3, 0.13, 0.12, rod([-0.3, 0.13, 0.12], [-0.3, 0.32, 0.12], 0.01, INK, { outline: false }));
  // 手電筒、手銬
  body.add(R(cyl(0.03, 0.04, 0.2, 0x3a3f48, 0.3, 0.02, 0.1, { seg: 10 }), 0.15));
  body.add(R(torus(0.035, 0.008, 0xb8c2cc, 0.2, -0.02, 0.22, { outline: false, seg: 10 }), 0, 0.5, 0));
  for (const s of [1, -1]) {
    body.add(box(0.14, 0.05, 0.2, NAVY, s * 0.3, h.th - 0.02, 0, { outline: false }));
    body.add(box(0.03, 0.055, 0.2, GOLD, s * 0.36, h.th - 0.02, 0, { outline: false }));
  }
  // 頭：警帽、墨鏡、八字鬍、雙下巴
  ears(H, 0.25, 0xf0b896);
  H.add(S(sphere(0.18, 0xf0b896, 0, -0.17, 0.06, { seg: 12 }), 1.15, 0.6, 0.9));
  H.add(cyl(0.24, 0.22, 0.12, NAVY, 0, 0.17, -0.01, { seg: 16 }));
  H.add(cyl(0.27, 0.24, 0.05, NAVY, 0, 0.25, -0.01, { seg: 16 }));
  H.add(cyl(0.245, 0.245, 0.03, GOLD, 0, 0.12, -0.01, { seg: 16, outline: false }));
  H.add(R(box(0.3, 0.025, 0.16, INK, 0, 0.12, 0.2, { r: 0.01 }), 0.25));
  H.add(R(cyl(0.04, 0.04, 0.02, GOLD, 0, 0.18, 0.235, { seg: 8 }), PI / 2));
  const shades = G(); H.add(shades);
  for (const s of [1, -1]) shades.add(S(sphere(0.07, 0x1b1f2a, s * 0.085, 0.03, 0.2), 1.2, 0.85, 0.4));
  shades.add(box(0.06, 0.015, 0.02, GOLD, 0, 0.05, 0.23, { outline: false }));
  for (const s of [1, -1]) shades.add(S(sphere(0.02, 0x7af7ff, s * 0.085 + 0.02, 0.05, 0.226, { seg: 6, ...glow(0x9fe8ff) }), 1, 0.6, 0.3));
  const E = [G(), G()]; E[0].position.set(0.085, 0.03, 0.2); E[1].position.set(-0.085, 0.03, 0.2); H.add(E[0], E[1]);
  nose(H, 0.25, 0.055, 0xe89878, -0.04);
  const stache = G(); stache.position.set(0, -0.09, 0.225); H.add(stache);
  for (const s of [1, -1]) stache.add(R(capsule(0.035, 0.1, 0x5a3418, s * 0.06, 0, 0, { seg: 8 }), 0, 0, s * (PI / 2 + 0.25)));
  const M = mouth(H, 0.25, 0.07, 0.025, -0.14, { z: 0.2 });
  // 左手扶把手、右手電擊槍
  pose(h.armL, -0.95, 0, -0.2, 0.3);
  pose(h.armR, -1.15, 0, 0.1, 0.15);
  const taser = G();
  add(taser, box(0.07, 0.14, 0.08, 0x2a2a2a, 0, 0.04, 0), box(0.1, 0.1, 0.22, 0xffd21a, 0, 0.12, 0.07), box(0.102, 0.03, 0.12, INK, 0, 0.15, 0.04, { outline: false }));
  for (const s of [1, -1]) taser.add(rod([s * 0.03, 0.12, 0.18], [s * 0.03, 0.12, 0.24], 0.008, 0xb8c2cc, { outline: false }));
  const zapA = G(), zapB = G(); taser.add(zapA, zapB);
  const za = [[0, 0.12, 0.24], [0.05, 0.19, 0.28], [-0.04, 0.1, 0.32], [0.04, 0.2, 0.36]];
  const zb = [[0, 0.12, 0.24], [-0.05, 0.08, 0.29], [0.04, 0.17, 0.33], [-0.03, 0.1, 0.38]];
  for (let i = 0; i < 3; i++) { zapA.add(rod(za[i], za[i + 1], 0.012, 0x7af7ff, glow(0x9ffbff))); zapB.add(rod(zb[i], zb[i + 1], 0.01, 0xffffff, glow(0xd8f8ff))); }
  const spark = sphere(0.035, 0xffffff, 0, 0.12, 0.25, { seg: 8, mat: flat(0xd8f8ff) }); taser.add(spark);
  hold(h.armR, taser);
  return fin(g, { ...P6(h), weapon: taser, vehicle: seg, eyes: E, mouth: M, extra: [radioAnt, stache] }, 1.08, t => {
    // 平衡車前後微晃、輪子隨之滾動；電弧交替閃
    const r = wave(t, 1.6, 0.25); wheels[0].rotation.x = wheels[1].rotation.x = r * 4;
    const k = Math.floor(t * 14) % 3; zapA.visible = k !== 1; zapB.visible = k !== 0; spark.scale.setScalar(0.6 + (k * 0.3));
    radioLed.visible = (t * 1.5) % 1 < 0.2;
    ledF.scale.x = 0.7 + wave(t, 3, 0.3);
  });
}

// ── 第 3 關 ──────────────────────────────────────────
// 滑板塗鴉屁孩：超大毛帽與 T 恤、牙套奸笑、脖子掛耳機、膝蓋 OK 繃，手拿噴漆罐，踩在滑板上
function skater() {
  const y0 = 0.1, SHIRT = 0x9be22c;
  const h = humanoid({ y0, hip: 0.26, th: 0.24, w: 0.28, d: 0.18, headR: 0.145, shirt: SHIRT, pants: 0x3f6fb5, shorts: true, shoe: 0xe5352a, sole: WHITE, shoeL: 0.15, shoeH: 0.05, legR: 0.045, legX: 0.07, armR: 0.04, armLen: 0.24, shortSleeve: true, neck: 0.01, skin: 0xffd1a8, sock: WHITE });
  const { g, body, H } = h;
  body.add(cyl(0.16, 0.18, 0.12, SHIRT, 0, -0.02, 0, { seg: 12 }));
  for (const [x, y, c] of [[0.06, 0.15, 0xff2fd0], [-0.07, 0.07, 0x1fb5a8], [0.04, 0.04, 0xffe14a]]) body.add(S(sphere(0.035, c, x, y, h.d / 2 + 0.005, { outline: false, seg: 8 }), 1.2, 1, 0.3));
  // 耳機掛脖子
  body.add(R(arc(0.08, 0.012, PI, INK, { outline: false }), -PI / 2 + 0.3, 0, 0)).children.at(-1).position.set(0, h.th + 0.02, 0.02);
  for (const s of [1, -1]) body.add(R(cyl(0.035, 0.035, 0.025, 0xff2fd0, s * 0.08, h.th, 0.04, { seg: 10 }), 0, 0, PI / 2));
  // 膝蓋 OK 繃
  h.legL.userData.pose.add(R(box(0.05, 0.02, 0.01, 0xf2c48a, 0, -0.17, 0.04, { outline: false }), 0, 0, 0.5));
  // 滑板（輪子會轉）
  const board = G(); g.add(board);
  add(board, box(0.24, 0.03, 0.62, 0xff2fd0, 0, 0.085, 0, { r: 0.012 }), R(box(0.24, 0.03, 0.12, 0xff2fd0, 0, 0.105, -0.34, { r: 0.012 }), -0.4), R(box(0.24, 0.03, 0.12, 0xff2fd0, 0, 0.105, 0.34, { r: 0.012 }), 0.4));
  board.add(at(R(txt('RAD', 0.2, { color: '#ffe14a', stroke: '#1b1226', size: 56 }), -PI / 2, 0, PI / 2), 0, 0.102, 0));
  const wheels = [];
  for (const z of [0.2, -0.2]) {
    board.add(box(0.18, 0.025, 0.04, 0xb8c2cc, 0, 0.06, z, { outline: false }));
    for (const s of [1, -1]) { const w = R(cyl(0.035, 0.035, 0.04, 0xfff14a, s * 0.1, 0.035, z, { seg: 10 }), 0, 0, PI / 2); board.add(w); wheels.push(w); }
  }
  // 超大毛帽、雀斑、牙套奸笑
  H.add(dome(0.155, 0xe5352a, 0, 0.02, -0.01, 0.95));
  H.add(R(torus(0.145, 0.025, 0xc41f1f, 0, 0.03, -0.01), PI / 2));
  const pom = sphere(0.04, 0xfff14a, 0, 0.18, -0.01, { seg: 8 });
  const pomP = pivot(H, 0, 0.16, -0.01, pom);
  for (const s of [1, -1]) H.add(S(capsule(0.03, 0.06, 0x7a4a24, s * 0.12, 0.0, -0.02, { seg: 8, outline: false }), 1, 1, 0.8));
  const E = eyes(H, 0.145, { r: 0.034, gap: 0.05, y: 0.0, pr: 0.42, iris: 0x7a4a24, look: 0.008, brow: 0x5b3a1e, angry: 0.45, lid: 0xffd1a8, lidX: -0.6, lidZ: 0.6 });
  for (const s of [1, -1]) for (const dx of [0, 0.014]) H.add(sphere(0.005, 0xc8784a, s * (0.06 + dx), -0.045 + dx, 0.13, { seg: 4, outline: false }));
  nose(H, 0.145, 0.022, 0xf0a888, -0.025, { outline: false });
  const M = mouth(H, 0.145, 0.08, 0.035, -0.06, { teeth: true, tilt: 0.15, x: 0.01 });
  M.add(box(0.07, 0.008, 0.01, 0xb8c2cc, 0, 0.006, 0.03, { outline: false }));
  pose(h.armR, -1.6, 0, 0.3, 0.4);
  const can = G();
  add(can, cyl(0.035, 0.035, 0.14, 0x1fb5a8, 0, 0.05, 0.02), cyl(0.036, 0.036, 0.03, WHITE, 0, 0.02, 0.02, { outline: false }), cyl(0.02, 0.025, 0.03, WHITE, 0, 0.13, 0.02));
  const mist = sphere(0.05, 0x1fb5a8, 0, 0.15, 0.08, { transparent: true, opacity: 0.45, outline: false, shadow: false }); can.add(mist);
  const mist2 = sphere(0.035, 0xff2fd0, 0, 0.17, 0.14, { transparent: true, opacity: 0.4, outline: false, shadow: false }); can.add(mist2);
  hold(h.armR, can);
  pose(h.armL, 0.2, 0, 0.6, 0.3);
  return fin(g, { ...P6(h), weapon: can, vehicle: board, eyes: E, mouth: M, extra: [pomP] }, 1, t => {
    for (const w of wheels) w.rotation.x = t * 3;
    const k = (t * 1.6) % 1; mist.scale.setScalar(0.6 + k); mist.position.z = 0.08 + k * 0.08;
    const k2 = (t * 1.6 + 0.5) % 1; mist2.scale.setScalar(0.6 + k2); mist2.position.z = 0.1 + k2 * 0.1;
    board.rotation.x = wave(t, 2.3, 0.02);
  });
}

// 未牽繩狂暴比特犬「小公主」：寬胸肌肉狗、戽斗獠牙、口水，粉紅雙層蓬蓬裙＋蝴蝶結＋鉚釘項圈，斷掉的牽繩
function pitbull() {
  const COAT = 0x8a93a3, PINK = 0xff5fae, LIGHT = 0xeef0f4, DK = 0x6a7282;
  const g = G();
  const body = G(); body.position.y = 0.5; g.add(body);
  body.add(S(sphere(0.29, COAT, 0, 0.04, 0.14), 1.15, 1, 1.05));
  body.add(S(sphere(0.16, LIGHT, 0, -0.05, 0.3, { outline: false }), 1, 1.1, 0.6));
  for (const s of [1, -1]) body.add(S(sphere(0.13, COAT, s * 0.2, 0.0, 0.25, { seg: 10 }), 0.8, 1, 1));
  body.add(S(sphere(0.21, COAT, 0, 0.02, -0.22), 1, 0.95, 1));
  body.add(S(sphere(0.07, DK, 0.12, 0.17, -0.1, { outline: false, seg: 8 }), 1.2, 0.4, 1));
  // 雙層蓬蓬裙
  body.add(R(cone(0.3, 0.16, PINK, 0, 0.0, -0.18, { seg: 12 }), PI));
  body.add(R(cone(0.34, 0.12, 0xffa8d4, 0, -0.06, -0.18, { seg: 12, outline: false }), PI));
  const tail = pivot(body, 0, 0.1, -0.38, R(cyl(0.04, 0.02, 0.18, COAT, 0, 0.12, -0.42), -0.9));
  const leg = (x, z, r) => { const L = G(); L.position.set(x, 0.45, z); g.add(L); add(L, cyl(r, r * 0.85, 0.36, COAT, 0, -0.2, 0), S(sphere(r * 1.15, LIGHT, 0, -0.39, 0.03, { seg: 8 }), 1, 0.6, 1.3)); for (const s of [-1, 1]) L.add(sphere(r * 0.25, DK, s * r * 0.5, -0.415, r * 1.2, { seg: 4, outline: false })); return L; };
  const legL = leg(0.18, 0.22, 0.085), legR = leg(-0.18, 0.22, 0.085), bL = leg(0.14, -0.26, 0.07), bR = leg(-0.14, -0.26, 0.07);
  // 鉚釘項圈＋名牌＋斷掉的牽繩
  body.add(R(torus(0.2, 0.04, PINK, 0, 0.14, 0.38), PI / 2 - 0.5));
  for (const s of [-1, 0, 1]) body.add(R(cone(0.025, 0.06, 0xd8dde3, s * 0.17, 0.15 - Math.abs(s) * 0.02, 0.45 - Math.abs(s) * 0.08, { seg: 6, outline: false }), 0.9, 0, -s * 0.9));
  body.add(R(cyl(0.04, 0.04, 0.012, 0xffcc33, 0, 0.0, 0.53, { seg: 8 }), PI / 2.4));
  const leash = pivot(body, 0.05, 0.2, 0.35,
    rod([0.05, 0.2, 0.35], [0.22, 0.05, 0.05], 0.018, PINK, { outline: false }),
    rod([0.22, 0.05, 0.05], [0.26, -0.28, -0.1], 0.018, PINK, { outline: false }),
    S(sphere(0.022, PINK, 0.26, -0.29, -0.1, { seg: 6, outline: false }), 1, 0.5, 1));
  // 頭
  const N = G(); N.position.set(0, 0.18, 0.4); body.add(N);
  const H = G(); H.position.set(0, 0.06, 0.07); N.add(H);
  H.add(S(sphere(0.2, COAT), 1.25, 0.95, 1));
  H.add(S(sphere(0.14, LIGHT, 0, -0.07, 0.12), 1.3, 0.75, 0.9));
  H.add(S(sphere(0.06, LIGHT, 0, 0.06, 0.15, { outline: false, seg: 8 }), 0.6, 1.3, 0.5));
  H.add(S(sphere(0.045, INK, 0, -0.01, 0.24), 1.3, 0.8, 0.8));
  H.add(sphere(0.01, WHITE, 0.015, 0.005, 0.27, { seg: 4, ...glow(WHITE) }));
  // 戽斗下顎＋獠牙
  const M = G(); M.position.set(0, -0.13, 0.2); H.add(M);
  add(M, S(sphere(0.1, COAT, 0, -0.02, 0, { seg: 10 }), 1.25, 0.55, 0.9), box(0.22, 0.04, 0.05, 0x5a1020, 0, 0.0, 0.03, { r: 0.015 }));
  for (const s of [1, -1]) M.add(cone(0.022, 0.06, WHITE, s * 0.07, 0.03, 0.04, { seg: 6 }));
  for (const x of [-0.03, 0, 0.03]) M.add(cone(0.01, 0.025, WHITE, x, 0.02, 0.055, { seg: 4, outline: false }));
  const drool = S(sphere(0.018, 0xcff4ff, -0.09, -0.04, 0.05, { seg: 6, transparent: true, opacity: 0.8, outline: false }), 0.8, 1.6, 0.8); M.add(drool);
  const earsP = [1, -1].map(s => pivot(H, s * 0.13, 0.12, -0.02, R(cone(0.07, 0.11, COAT, s * 0.17, 0.12, -0.02), 0.6, 0, -s * 1.2)));
  const E = eyes(H, 0.2, { r: 0.04, gap: 0.09, y: 0.05, z: 0.19, pr: 0.55, pupil: 0xc01818, brow: 0x4a4f5a, angry: 0.55, lid: COAT, lidX: -0.5, lidZ: 0.55 });
  // 蝴蝶結＋小皇冠
  for (const s of [1, -1]) H.add(R(cone(0.06, 0.12, PINK, s * 0.06, 0.2, -0.02, { seg: 8 }), 0, 0, s * PI / 2));
  H.add(sphere(0.03, PINK, 0, 0.2, -0.02, { seg: 8 }));
  for (const x of [-0.05, 0, 0.05]) H.add(cone(0.014, 0.05, 0xffcc33, x + 0.12, 0.2, 0.06, { seg: 4, outline: false }));
  return fin(g, { body, head: N, legL, legR, tail, eyes: E, mouth: M, extra: [leash, ...earsP] }, 1, t => {
    trot(legL, legR, bL, bR);
    const k = (t * 0.5) % 1; drool.position.y = -0.04 - k * 0.12; drool.scale.set(0.8, 1.2 + k * 2, 0.8); drool.visible = k < 0.9;
    // 低吼：下顎抖動
    M.children[0].position.y = -0.02 + wave(t, 30, 0.004);
  });
}

// 惡作劇水球投擲手：螢光風衣、反戴帽、自拍棒＋手機錄影中（REC 閃爍）、腰間一排會晃的彩色水球
function balloon() {
  const JACKET = 0xffe600, SKN = 0xe8b48c;
  const h = humanoid({ hip: 0.74, th: 0.5, w: 0.44, d: 0.28, headR: 0.22, shirt: JACKET, pants: 0x2a2a33, shorts: true, shoe: 0xff2fd0, sole: WHITE, sock: WHITE, armLen: 0.48, skin: SKN, cuffArm: 0x2a2a33 });
  const { g, body, H } = h;
  body.add(box(0.03, h.th * 0.9, 0.02, 0x2a2a33, 0, h.th * 0.48, h.d / 2 + 0.01, { outline: false }));
  body.add(box(0.03, 0.06, 0.02, 0xb8c2cc, 0, h.th * 0.85, h.d / 2 + 0.02, { outline: false }));
  for (const s of [1, -1]) body.add(box(h.w * 0.46, 0.05, 0.01, 0x2fd4ff, s * h.w * 0.25, h.th * 0.4, h.d / 2 + 0.005, { outline: false }));
  body.add(R(torus(0.14, 0.04, JACKET, 0, h.th - 0.01, -0.02, { seg: 14 }), PI / 2));
  // 水球腰帶（晃動）
  const BAL = [0xff4fa3, 0x2fd4ff, 0x9dff3a, 0xff8a1a];
  body.add(box(h.w + 0.04, 0.04, h.d + 0.04, 0x5a3a1a, 0, 0.05, 0, { outline: false }));
  const bals = BAL.map((c, i) => { const a = -0.9 + i * 0.6; const x = Math.sin(a) * 0.27, z = Math.cos(a) * 0.2; return pivot(body, x, 0.06, z, S(sphere(0.07, c, x, -0.02, z, { seg: 12 }), 1, 1.15, 1), cone(0.018, 0.04, c, x, 0.06, z, { seg: 5, outline: false })); });
  H.add(dome(0.225, 0x2a2a33, 0, 0.09, -0.01, 0.7));
  H.add(box(0.24, 0.03, 0.2, 0x2a2a33, 0, 0.1, -0.26));
  H.add(box(0.08, 0.05, 0.02, 0xffe600, 0, 0.13, -0.21, { outline: false }));
  ears(H, 0.22, SKN);
  const E = eyes(H, 0.22, { r: 0.055, gap: 0.08, y: 0.04, pr: 0.45, iris: 0x4a8a3a, look: 0.02, brow: 0x3a2a1a, angry: -0.2, browY: 0.01 });
  nose(H, 0.22, 0.035, 0xd89878, -0.03);
  const M = mouth(H, 0.22, 0.13, 0.07, -0.1, { teeth: true, tongue: true });
  cheeks(H, 0.22, 0xff8a8a);
  // 自拍棒（左手高舉）＋手機 REC 閃爍
  pose(h.armL, -0.2, 0, 2.4, 0.3);
  const stick = G();
  stick.add(rod([0, 0, 0], [0.12, 0.42, 0.32], 0.015, 0x8a96a2));
  const phone = G(); phone.position.set(0.13, 0.47, 0.36); phone.rotation.set(0.3, PI + 0.5, 0); stick.add(phone);
  add(phone, box(0.13, 0.24, 0.02, 0x1b1f2a, 0, 0, 0));
  const scr = txt('● REC', 0.11, { color: '#ff2a2a', bg: '#1b1226', size: 44 }); scr.position.z = 0.012; phone.add(scr);
  const flash = sphere(0.015, WHITE, 0.04, 0.09, -0.012, { seg: 6, mat: flat(0xfff6c0) }); phone.add(flash);
  hold(h.armL, stick);
  // 右手水球
  pose(h.armR, -0.6, 0, 0.3, 0.6);
  const wb = G();
  add(wb, S(sphere(0.1, 0x2fd4ff, 0, 0.02, 0.06), 1, 1.15, 1), cone(0.025, 0.05, 0x2fd4ff, 0, 0.14, 0.06, { seg: 6 }), S(sphere(0.025, WHITE, 0.04, 0.07, 0.13, { seg: 6, outline: false }), 1, 1.4, 0.6));
  hold(h.armR, wb);
  return fin(g, { ...P6(h), weapon: wb, phone: stick, eyes: E, mouth: M, extra: bals }, 1, t => {
    scr.visible = (t * 1.5) % 1 < 0.6; flash.visible = (t * 0.4) % 1 < 0.05;
    wb.scale.set(1 + wave(t, 5, 0.04), 1 - wave(t, 5, 0.04), 1);
  });
}

// 凌晨六點吹葉機怪客：浴袍、毛腿＋襪子配毛拖鞋、隔音耳罩、護目鏡、捲髮器，背著會抖的吹葉機引擎、左手咖啡杯
function blower() {
  const ROBE = 0x8c2f39, SKN = 0xf0b896;
  const h = humanoid({ hip: 0.72, th: 0.52, w: 0.44, d: 0.28, headR: 0.22, shirt: ROBE, pants: ROBE, shorts: true, sock: WHITE, shoe: 0xff9fb8, sole: 0xd06a8a, shoeH: 0.07, armLen: 0.48, skin: SKN, cuffArm: 0xe8d6b8 });
  const { g, body, H } = h;
  body.add(cyl(0.27, 0.32, 0.38, ROBE, 0, -0.15, 0, { seg: 14 }));
  body.add(R(box(0.06, 0.6, 0.03, 0xe8d6b8, 0.03, h.th * 0.5, h.d / 2 + 0.01, { outline: false }), 0, 0, 0.25));
  body.add(box(h.w + 0.04, 0.06, h.d + 0.04, 0xe8d6b8, 0, 0.06, 0, { outline: false }));
  const belt = pivot(body, 0.12, 0.05, h.d / 2 + 0.02, box(0.03, 0.2, 0.02, 0xe8d6b8, 0.12, -0.05, h.d / 2 + 0.02, { outline: false }), box(0.03, 0.17, 0.02, 0xe8d6b8, 0.16, -0.04, h.d / 2 + 0.02, { outline: false }));
  // 胸毛
  for (const [x, y] of [[0.0, 0.42], [0.04, 0.38], [-0.03, 0.36]]) body.add(sphere(0.012, 0x5a3a1a, x, y, h.d / 2 + 0.005, { seg: 4, outline: false }));
  // 毛腿
  for (const L of [h.legL, h.legR]) for (const y of [-0.42, -0.5]) L.userData.pose.add(sphere(0.008, 0x5a3a1a, 0.02, y, 0.07, { seg: 4, outline: false }));
  // 背包式吹葉機引擎（會抖）
  const eng = G(); eng.position.set(0, h.th * 0.52, -h.d / 2 - 0.13); body.add(eng);
  add(eng, box(0.4, 0.42, 0.24, 0xff7a1a), R(cyl(0.12, 0.12, 0.2, 0x3a3f48, 0, -0.07, -0.14, { seg: 12 }), PI / 2), torus(0.09, 0.012, 0x6a7480, 0, -0.07, -0.245, { outline: false, seg: 12 }));
  add(eng, box(0.06, 0.12, 0.04, 0x2a2a2a, 0.14, 0.24, -0.02), cyl(0.04, 0.04, 0.08, 0x8a96a2, -0.12, 0.25, 0, { seg: 8 }));
  const pull = rod([0.14, 0.3, -0.02], [0.18, 0.4, 0.0], 0.006, INK, { outline: false }); eng.add(pull);
  const smoke = sphere(0.06, 0xd8d8d8, -0.12, 0.33, 0, { transparent: true, opacity: 0.5, outline: false, shadow: false }); eng.add(smoke);
  body.add(rod([-0.16, h.th * 0.25, -h.d / 2 - 0.2], [-0.3, 0.0, 0.05], 0.045, 0x4a4f5a));
  for (const s of [1, -1]) body.add(rod([s * 0.14, h.th + 0.02, -0.02], [s * 0.14, h.th * 0.2, -h.d / 2 - 0.03], 0.02, INK, { outline: false }));
  // 頭：禿頂兩撮白髮＋捲髮器、耳罩、護目鏡、鬍渣
  const tufts = [pivot(H, 0.05, 0.17, -0.03, sphere(0.07, 0xd8d8d8, 0.05, 0.2, -0.03, { seg: 8 })), pivot(H, -0.06, 0.18, -0.06, sphere(0.06, 0xd8d8d8, -0.06, 0.21, -0.06, { seg: 8 }))];
  H.add(R(cyl(0.025, 0.025, 0.08, 0x2fd4ff, 0.0, 0.2, -0.12, { seg: 8 }), 0, 0, PI / 2));
  H.add(at(arc(0.235, 0.025, PI, 0x2a2a2a), 0, 0.0, 0));
  for (const s of [1, -1]) { H.add(R(cyl(0.09, 0.09, 0.08, 0xff7a1a, s * 0.23, 0.0, 0, { seg: 12 }), 0, 0, PI / 2)); H.add(R(cyl(0.05, 0.05, 0.085, 0x2a2a2a, s * 0.235, 0, 0, { seg: 10, outline: false }), 0, 0, PI / 2)); }
  H.add(box(0.3, 0.1, 0.06, 0xffe14a, 0, 0.05, 0.19, { r: 0.03 }));
  H.add(box(0.26, 0.07, 0.02, 0xbff6ff, 0, 0.05, 0.222, { outline: false, transparent: true, opacity: 0.55 }));
  const E = [G(), G()];
  for (const [i, s] of [[0, 1], [1, -1]].values()) { E[i].position.set(s * 0.07, 0.05, 0.2); H.add(E[i]); E[i].add(sphere(0.028, WHITE, 0, 0, 0, { seg: 8, outline: false }), sphere(0.018, INK, 0, 0, 0.018, { seg: 6, outline: false })); }
  nose(H, 0.22, 0.04, 0xe89878, -0.03);
  H.add(S(sphere(0.12, 0x8a8a8a, 0, -0.1, 0.13, { outline: false, seg: 10 }), 1.1, 0.6, 0.6));
  const M = mouth(H, 0.22, 0.12, 0.03, -0.09, { teeth: true });
  // 吹葉機管＋飛葉（旋轉）
  pose(h.armR, -0.75, 0, 0.2, 0.2);
  const tube = G();
  tube.add(rod([0, 0, -0.05], [0, -0.2, 0.42], 0.05, 0x3a3f48));
  tube.add(R(cyl(0.065, 0.05, 0.1, 0xff7a1a, 0, -0.21, 0.45), PI / 2 - 0.4));
  tube.add(box(0.05, 0.1, 0.06, 0x2a2a2a, 0, -0.04, 0.02));
  const leaves = G(); leaves.position.set(0, -0.22, 0.62); tube.add(leaves);
  for (const [x, y, z, c] of [[0.08, 0.04, -0.06, 0xe08a1a], [-0.07, -0.04, -0.02, 0x7dbf3a], [0.03, 0.1, 0.02, 0xd9261c], [-0.04, 0.08, 0.1, 0xe0b81a]]) leaves.add(R(box(0.08, 0.01, 0.05, c, x, y, z, { outline: false }), x * 8, z * 3, y * 5));
  hold(h.armR, tube);
  // 左手咖啡杯
  pose(h.armL, -0.9, 0, -0.35, 0.6);
  const mug = G();
  add(mug, cyl(0.05, 0.045, 0.1, WHITE, 0, 0.04, 0.04, { seg: 10 }), R(arc(0.03, 0.01, PI, WHITE, { outline: false }), 0, PI / 2, -PI / 2), cyl(0.045, 0.045, 0.01, 0x5a3418, 0, 0.088, 0.04, { seg: 10, outline: false }));
  mug.children[1].position.set(0, 0.04, -0.01);
  const steam = sphere(0.025, WHITE, 0, 0.14, 0.04, { transparent: true, opacity: 0.4, outline: false, shadow: false }); mug.add(steam);
  hold(h.armL, mug);
  return fin(g, { ...P6(h), weapon: tube, eyes: E, mouth: M, extra: [...tufts, belt] }, 1, t => {
    eng.position.x = wave(t, 70, 0.006); eng.rotation.z = wave(t, 55, 0.02);
    leaves.rotation.z = t * 7; leaves.rotation.x = wave(t, 4, 0.4);
    const k = (t * 0.9) % 1; smoke.position.y = 0.33 + k * 0.25; smoke.scale.setScalar(0.5 + k * 1.2); smoke.visible = k < 0.85;
    const k2 = (t * 0.6) % 1; steam.position.y = 0.12 + k2 * 0.12; steam.scale.setScalar(0.6 + k2);
  });
}

// 車庫重金屬樂團主唱・扎克：甩動長髮、頭巾、皮背心鉚釘、刺環護腕、背著會震的音箱，抱著 V 字電吉他
function zack() {
  const LEATHER = 0x24242c, SKN = 0xe9b48e, HAIR = 0x2a1a12, STUD = 0xd8dde3;
  const h = humanoid({ hip: 0.95, th: 0.66, w: 0.56, d: 0.32, headR: 0.26, shirt: SKN, pants: 0x4c5a78, shoe: INK, sole: 0x5a5a66, shoeH: 0.16, shoeL: 0.34, legR: 0.11, legX: 0.15, armR: 0.09, armLen: 0.64, shortSleeve: true, sleeve: LEATHER, skin: SKN });
  const { g, body, H } = h;
  // 牛仔褲破洞
  for (const L of [h.legL, h.legR]) L.userData.pose.add(S(sphere(0.05, SKN, 0, -0.45, 0.09, { seg: 8, outline: false }), 1, 0.5, 0.4));
  // 胸肌＋刺青＋皮背心（鉚釘）
  for (const s of [1, -1]) body.add(S(sphere(0.12, SKN, s * 0.1, h.th * 0.68, h.d / 2 - 0.04, { seg: 10, outline: false }), 1.1, 0.7, 0.5));
  body.add(S(sphere(0.05, 0x2f6ad4, 0.03, h.th * 0.4, h.d / 2 + 0.005, { seg: 8, outline: false }), 1.2, 1, 0.2));
  for (const s of [1, -1]) {
    body.add(box(0.2, h.th * 0.95, h.d + 0.03, LEATHER, s * 0.19, h.th * 0.5, 0));
    for (const y of [0.2, 0.36, 0.52]) body.add(sphere(0.018, STUD, s * 0.12, y, h.d / 2 + 0.03, { seg: 6, outline: false }));
  }
  body.add(box(h.w + 0.03, h.th * 0.5, 0.06, LEATHER, 0, h.th * 0.5, -h.d / 2 - 0.01));
  body.add(box(h.w, 0.08, h.d + 0.04, 0x8a8a96, 0, 0.1, 0));
  body.add(box(0.1, 0.08, 0.03, 0xffcc33, 0, 0.1, h.d / 2 + 0.03, { outline: false }));
  body.add(rod([0.15, 0.06, h.d / 2 + 0.02], [0.25, -0.1, h.d / 2 - 0.05], 0.008, 0xb8c2cc, { outline: false }));
  // 音箱背包（喇叭會震、燈會閃）
  const amp = G(); amp.position.set(0, h.th * 0.55, -h.d / 2 - 0.18); body.add(amp);
  add(amp, box(0.56, 0.5, 0.3, INK), box(0.44, 0.34, 0.02, 0x5a5a66, 0, -0.03, -0.16, { outline: false }), box(0.56, 0.08, 0.31, 0x3a3a44, 0, 0.21, 0, { outline: false }));
  const cones = [];
  for (const y of [0.05, -0.12]) { const c = R(cyl(0.11, 0.06, 0.03, 0x2a2a33, 0, y, -0.175, { seg: 14, outline: false }), PI / 2); amp.add(c); cones.push(c); }
  const leds = [];
  for (let i = 0; i < 3; i++) { const l = sphere(0.022, 0xff3a3a, -0.15 + i * 0.15, 0.21, -0.16, { seg: 6, mat: flat(i === 1 ? 0x9dff3a : 0xff3a3a) }); amp.add(l); leds.push(l); }
  amp.add(at(txt('LOUD', 0.2, { color: '#ffcc33', size: 48 }), 0, 0.21, 0.158));
  amp.children.at(-1).rotation.y = PI;
  amp.children.at(-1).position.z = -0.158;
  // 護腕
  for (const A of [h.armL, h.armR]) {
    const F = A.userData.fore, fl = A.userData.foreLen;
    F.add(cyl(0.11, 0.11, 0.1, INK, 0, -fl * 0.65, 0, { seg: 10 }));
    for (let i = 0; i < 4; i++) { const a = i * PI / 2; F.add(R(cone(0.025, 0.07, STUD, Math.sin(a) * 0.12, -fl * 0.65, Math.cos(a) * 0.12, { seg: 6, outline: false }), Math.cos(a) * PI / 2, 0, -Math.sin(a) * PI / 2)); }
  }
  // 頭：甩動長髮（extra）、頭巾、吐舌嘶吼、骷髏耳環
  const hair = [];
  for (let i = 0; i < 5; i++) { const a = -1.1 + i * 0.55; const x = Math.sin(a) * 0.2, z = -0.14 + Math.cos(a) * 0.02; hair.push(pivot(H, x, 0.08, z - 0.02, R(capsule(0.07, 0.4, HAIR, x, -0.12, z), -0.25, 0, -Math.sin(a) * 0.35))); }
  H.add(dome(0.27, HAIR, 0, 0.02, -0.02, 0.9));
  H.add(R(torus(0.26, 0.035, 0xd9261c, 0, 0.07, 0), PI / 2 - 0.15));
  for (const [x, y] of [[0.12, 0.17], [-0.14, 0.15], [0.0, 0.2]]) H.add(sphere(0.012, WHITE, x, y, Math.sqrt(0.0729 - x * x - y * y) + 0.005, { seg: 4, outline: false }));
  const knot = pivot(H, 0.0, 0.07, -0.26, R(box(0.08, 0.16, 0.03, 0xd9261c, 0.05, 0.0, -0.27), 0, 0, 0.4), R(box(0.07, 0.14, 0.03, 0xd9261c, -0.05, -0.01, -0.27), 0, 0, -0.5));
  const E = eyes(H, 0.26, { r: 0.05, gap: 0.095, y: 0.05, pr: 0.4, iris: 0x6a8a3a, brow: HAIR, angry: 0.55, lid: SKN, lidX: -0.55, lidZ: 0.55 });
  nose(H, 0.26, 0.045, 0xd89878, -0.02);
  const M = mouth(H, 0.26, 0.13, 0.11, -0.12, { teeth: true, lower: true });
  const tongue = R(box(0.06, 0.012, 0.1, 0xff6a8a, 0, -0.04, 0.05, { outline: false, r: 0.005 }), 0.5); M.add(tongue);
  H.add(S(sphere(0.06, HAIR, 0, -0.24, 0.16, { seg: 8 }), 1, 1.3, 0.7));
  for (const s of [1, -1]) H.add(sphere(0.022, WHITE, s * 0.25, -0.08, 0.02, { seg: 6 }));
  // V 字電吉他（掛在胸前）＋背帶
  const gtr = G(); gtr.position.set(0, h.th * 0.35, h.d / 2 + 0.07); gtr.rotation.set(0, 0, 0.9); body.add(gtr);
  add(gtr, R(box(0.14, 0.52, 0.06, 0xe0201c, 0.12, -0.15, 0), 0, 0, 0.45), R(box(0.14, 0.52, 0.06, 0xe0201c, -0.12, -0.15, 0), 0, 0, -0.45));
  add(gtr, box(0.12, 0.18, 0.065, WHITE, 0, 0.0, 0.005, { outline: false }));
  for (const y of [-0.04, 0.05]) gtr.add(box(0.1, 0.025, 0.07, INK, 0, y, 0.01, { outline: false }));
  for (const [x, y] of [[0.14, -0.3], [-0.14, -0.3]]) gtr.add(R(cyl(0.018, 0.018, 0.03, 0xffcc33, x, y, 0.04, { seg: 6, outline: false }), PI / 2));
  add(gtr, box(0.06, 0.72, 0.04, 0x7a4b2a, 0, 0.42, 0), R(box(0.1, 0.16, 0.04, INK, 0.02, 0.84, 0), 0, 0, -0.3));
  for (const x of [-0.015, 0.015]) gtr.add(box(0.005, 0.9, 0.005, 0xd8dde3, x, 0.3, 0.035, { outline: false }));
  body.add(rod([0.22, h.th - 0.02, 0.12], [-0.2, 0.15, h.d / 2 + 0.06], 0.02, 0x5a3418, { outline: false }));
  pose(h.armR, -0.9, 0, 0.55, 0.5);
  pose(h.armL, -1.0, 0, -0.75, 0.6);
  return fin(g, { ...P6(h), weapon: gtr, eyes: E, mouth: M, extra: [...hair, knot] }, 1.05, t => {
    const b = 1 + Math.max(0, wave(t, 12, 0.18)); cones[0].scale.set(b, 1, b); cones[1].scale.set(2 - b * 0.5, 1, 2 - b * 0.5);
    const k = Math.floor(t * 6) % 3; leds[0].visible = k !== 0; leds[2].visible = k !== 2;
    tongue.rotation.x = 0.5 + wave(t, 9, 0.2);
  });
}

// ── 第 4 關 ──────────────────────────────────────────
// 彈弓紅脖子：卡車司機網帽、鯔魚頭、曬紅脖子、無袖格紋衫、牛仔褲＋大皮帶扣＋牛仔靴，叼麥稈、拉滿彈弓
function slingshot() {
  const RED = 0xd62b2b, SKN = 0xf09a7a, HAIR = 0x8a5a2a;
  const h = humanoid({ hip: 0.78, th: 0.52, w: 0.46, d: 0.28, headR: 0.22, shirt: RED, pants: 0x355a9a, shoe: 0x7a4b2a, sole: 0x3a2a1a, shoeH: 0.14, armLen: 0.5, shortSleeve: true, sleeve: RED, skin: SKN, neckColor: 0xe0604a });
  const { g, body, H } = h;
  for (let i = 0; i < 3; i++) body.add(box(h.w + 0.02, 0.035, h.d + 0.02, 0x3a1010, 0, 0.12 + i * 0.15, 0, { outline: false }));
  for (const x of [0.1, -0.1]) body.add(box(0.035, h.th * 0.95, h.d + 0.02, 0x3a1010, x, h.th * 0.5, 0, { outline: false }));
  // 撕掉的袖口、胸前口袋
  for (const s of [1, -1]) body.add(R(box(0.09, 0.04, h.d * 0.9, 0xe8d6b8, s * (h.w / 2 + 0.01), h.th - 0.04, 0, { outline: false }), 0, 0, s * 0.3));
  body.add(box(0.1, 0.09, 0.02, 0xa82020, -0.11, h.th * 0.7, h.d / 2 + 0.01, { outline: false }));
  // 大皮帶扣（星星）＋褲腰
  body.add(box(h.w * 0.96, 0.05, h.d * 1.04, 0x5a3418, 0, 0.08, 0, { outline: false }));
  body.add(box(0.16, 0.11, 0.04, 0xffcc33, 0, 0.06, h.d / 2 + 0.02));
  body.add(R(cone(0.04, 0.012, 0xb8860b, 0, 0.06, h.d / 2 + 0.045, { seg: 5, outline: false }), PI / 2));
  // 牛仔靴：鞋跟、靴筒
  for (const L of [h.legL, h.legR]) { const P = L.userData.pose; add(P, cyl(0.1, 0.095, 0.2, 0x7a4b2a, 0, -0.62, 0, { seg: 10 }), box(0.1, 0.06, 0.06, 0x3a2a1a, 0, -0.75, -0.06, { outline: false })); }
  // 頭：網帽、鯔魚頭（會晃）、鬍渣、叼麥稈
  H.add(dome(0.235, WHITE, 0, 0.04, -0.02, 0.85));
  H.add(R(box(0.28, 0.17, 0.05, RED, 0, 0.14, 0.17), -0.35));
  H.add(at(R(txt('YEE', 0.18, { color: '#ffffff', size: 48 }), -0.35, 0, 0), 0, 0.15, 0.198));
  H.add(R(box(0.28, 0.025, 0.18, RED, 0, 0.07, 0.29, { r: 0.01 }), -0.15));
  const mullet = pivot(H, 0, -0.05, -0.16, R(capsule(0.12, 0.18, HAIR, 0, -0.15, -0.14), 0.15));
  for (const s of [1, -1]) H.add(box(0.04, 0.1, 0.06, HAIR, s * 0.2, -0.04, 0.04, { outline: false }));
  ears(H, 0.22, SKN);
  const E = eyes(H, 0.22, { r: 0.045, gap: 0.08, y: 0.03, pr: 0.42, iris: 0x4a8ad4, look: -0.01, brow: 0x6a3a1a, angry: 0.1, lid: SKN, lidX: -0.15, lidZ: 0.05 });
  // 瞇一隻眼瞄準
  eyeScale(E[1], 1, 0.4);
  H.add(S(sphere(0.06, 0xd06a5a, 0, -0.02, 0.21, { outline: false }), 1, 0.8, 0.7));
  H.add(S(sphere(0.13, 0xc87a5a, 0, -0.12, 0.1, { outline: false, seg: 10 }), 1.1, 0.5, 0.7));
  const straw = rod([0.03, -0.11, 0.2], [0.17, -0.06, 0.27], 0.007, 0xffd43a, { outline: false });
  const strawP = pivot(H, 0.03, -0.11, 0.2, straw);
  const M = mouth(H, 0.22, 0.08, 0.025, -0.11, { teeth: true, tilt: 0.12 });
  // 彈弓（左手前伸，右手拉皮筋）
  pose(h.armL, -1.45, 0.2, -0.05, 0.05);
  const sl = G();
  const WOOD = 0x8a5a2a;
  add(sl, cyl(0.035, 0.035, 0.22, WOOD, 0, 0.0, 0), rod([0, 0.1, 0], [0.12, 0.3, 0], 0.03, WOOD), rod([0, 0.1, 0], [-0.12, 0.3, 0], 0.03, WOOD));
  add(sl, cyl(0.04, 0.04, 0.08, 0x2a2a33, 0, -0.03, 0, { seg: 8, outline: false }));
  const band = G(); sl.add(band);
  add(band, rod([0.12, 0.29, 0], [0.02, 0.2, -0.42], 0.011, 0xff4fa3, { outline: false }), rod([-0.12, 0.29, 0], [-0.02, 0.2, -0.42], 0.011, 0xff4fa3, { outline: false }));
  add(band, box(0.08, 0.06, 0.04, 0x5a3a1a, 0, 0.2, -0.43), sphere(0.035, 0xd8dde3, 0, 0.2, -0.41, { seg: 8 }));
  hold(h.armL, sl);
  pose(h.armR, -1.4, 0, 0.45, 0.9);
  body.add(box(0.12, 0.12, 0.08, 0x6a4a2a, -0.24, 0.02, 0.06));
  for (let i = 0; i < 3; i++) body.add(sphere(0.025, 0xb8c2cc, -0.27 + i * 0.03, 0.09, 0.07, { seg: 6, outline: false }));
  return fin(g, { ...P6(h), weapon: sl, eyes: E, mouth: M, extra: [mullet] }, 1, t => {
    // 拉緊／放鬆皮筋；麥稈上下晃
    band.scale.z = 1 + wave(t, 2.5, 0.08);
    strawP.rotation.z = wave(t, 3.3, 0.15);
  });
}

// 私酒投彈手：灰長鬍子、破草帽、吊帶褲不穿上衣（補丁）、腰掛小酒甕、玉米芯菸斗，高舉點燃的 XXX 私酒甕（火焰會跳）
function moonshine() {
  const DENIM = 0x4677b8, JUG = 0xeee2c4, SKN = 0xe6aa86, BEARD = 0xd6d6d6;
  const h = humanoid({ hip: 0.74, th: 0.5, w: 0.44, d: 0.28, headR: 0.22, shirt: SKN, pants: DENIM, shoe: 0x5a3a1a, sole: 0x3a2a1a, armLen: 0.5, skin: SKN, sleeve: SKN });
  const { g, body, H } = h;
  body.add(box(h.w * 0.8, h.th * 0.55, h.d + 0.03, DENIM, 0, h.th * 0.28, 0));
  body.add(box(0.2, 0.12, 0.02, DENIM, 0, h.th * 0.6, h.d / 2 + 0.06, { outline: false }));
  body.add(R(box(0.08, 0.07, 0.01, 0xd62b2b, 0.08, h.th * 0.18, h.d / 2 + 0.02, { outline: false }), 0, 0, 0.2));
  for (const s of [1, -1]) {
    body.add(box(0.05, h.th * 0.5, 0.02, DENIM, s * 0.13, h.th * 0.72, h.d / 2 + 0.03, { outline: false }));
    body.add(box(0.05, h.th * 0.5, 0.02, DENIM, s * 0.13, h.th * 0.72, -h.d / 2 - 0.01, { outline: false }));
    body.add(sphere(0.02, 0xffcc33, s * 0.13, h.th * 0.5, h.d / 2 + 0.05, { seg: 6, outline: false }));
  }
  // 褲腳捲起、腳踝
  for (const L of [h.legL, h.legR]) L.userData.pose.add(cyl(0.1, 0.1, 0.06, 0x8aa8d8, 0, -0.6, 0, { seg: 10, outline: false }));
  const jugs = [1, -1].map(s => pivot(body, s * 0.25, 0.08, 0.1, S(sphere(0.08, JUG, s * 0.25, 0, 0.1, { seg: 10 }), 1, 1.1, 1), cyl(0.03, 0.03, 0.05, 0x7a4b2a, s * 0.25, 0.09, 0.1, { seg: 8 })));
  // 頭：草帽（破洞＋稻草）、長鬍子（會晃）、紅鼻子、菸斗
  const beard = pivot(H, 0, -0.08, 0.15, R(cone(0.2, 0.42, BEARD, 0, -0.27, 0.12, { seg: 10 }), PI), S(sphere(0.12, BEARD, 0, -0.07, 0.15), 1.2, 0.8, 0.6));
  for (const s of [1, -1]) H.add(R(capsule(0.03, 0.1, BEARD, s * 0.07, -0.05, 0.2, { seg: 8 }), 0, 0, s * 1.3));
  H.add(cyl(0.38, 0.38, 0.025, 0xe8c66a, 0, 0.12, 0, { seg: 16 }));
  H.add(cyl(0.2, 0.22, 0.16, 0xe8c66a, 0, 0.2, 0, { seg: 12 }));
  H.add(cyl(0.205, 0.225, 0.04, 0x8a3a2a, 0, 0.15, 0, { seg: 12, outline: false }));
  H.add(cyl(0.06, 0.06, 0.03, 0x2a1a12, 0.25, 0.135, 0.1, { seg: 6, outline: false }));
  for (const a of [0.4, 1.9, 3.6]) H.add(R(box(0.01, 0.01, 0.1, 0xf0d890, Math.sin(a) * 0.38, 0.12, Math.cos(a) * 0.38, { outline: false }), 0, a, 0));
  ears(H, 0.22, SKN);
  const E = eyes(H, 0.22, { r: 0.04, gap: 0.08, y: 0.04, pr: 0.5, brow: BEARD, angry: -0.2, browH: 0.8, lid: SKN, lidX: 0.2, lidZ: -0.1 });
  H.add(sphere(0.045, 0xe0604a, 0, 0.0, 0.22, { seg: 8 }));
  const M = G(); M.position.set(0.06, -0.06, 0.2); H.add(M);
  add(M, box(0.05, 0.02, 0.02, 0x5a1020, 0, 0, 0, { outline: false }), R(cyl(0.008, 0.008, 0.1, 0x8a5a2a, 0.05, -0.01, 0.04, { seg: 6, outline: false }), PI / 2 - 0.3, 0, 0), cyl(0.025, 0.02, 0.05, 0xf0d890, 0.05, 0.0, 0.1, { seg: 8 }));
  const puff = sphere(0.02, 0xdddddd, 0.11, 0.06, 0.3, { transparent: true, opacity: 0.5, outline: false, shadow: false }); H.add(puff);
  // 點燃的私酒甕（右手高舉）
  pose(h.armR, -2.5, 0, -0.55, 0.2);
  const jug = G();
  add(jug, S(sphere(0.15, JUG, 0, 0.14, 0), 1, 1.15, 1), box(0.31, 0.08, 0.31, 0x7a4b2a, 0, 0.1, 0, { outline: false, r: 0.03 }), cyl(0.05, 0.06, 0.08, JUG, 0, 0.32, 0));
  jug.add(at(R(arc(0.07, 0.015, PI, JUG), 0, PI / 2, 0), 0.12, 0.26, 0));
  const xxx = txt('XXX', 0.18, { color: '#1b1226', size: 60 }); xxx.position.set(0, 0.1, 0.165); jug.add(xxx);
  jug.add(R(box(0.05, 0.1, 0.02, 0xf6f0e0, 0, 0.4, 0), 0, 0, 0.3));
  const fire = G(); fire.position.set(0.02, 0.45, 0); jug.add(fire);
  add(fire, cone(0.05, 0.14, 0xff8a1a, 0, 0.05, 0, { ...glow(0xff8a1a), seg: 8 }), cone(0.03, 0.08, 0xffe14a, 0, 0.03, 0.01, { ...glow(0xffe14a), seg: 8 }));
  const ember = sphere(0.012, 0xffe14a, 0.02, 0.15, 0, { seg: 4, ...glow(0xffcc33) }); fire.add(ember);
  hold(h.armR, jug);
  pose(h.armL, -0.3, 0, 0.2, 0.3);
  return fin(g, { ...P6(h), weapon: jug, eyes: E, mouth: M, extra: [beard, ...jugs] }, 1, t => {
    fire.scale.set(1 + wave(t, 13, 0.15), 1 + wave(t, 17, 0.25), 1); fire.rotation.z = wave(t, 7, 0.15);
    const k = (t * 1.3) % 1; ember.position.y = 0.12 + k * 0.2; ember.position.x = wave(t, 5, 0.04); ember.visible = k < 0.8;
    const k2 = (t * 0.5) % 1; puff.position.y = 0.06 + k2 * 0.2; puff.scale.setScalar(0.6 + k2 * 1.5); puff.visible = k2 < 0.8;
  });
}

// 扳手修車工狂徒：油污連身工作服＋名牌、反戴帽、大鬢角、後口袋抹布，扛著超大活動扳手（滴機油）
function mechanic() {
  const SUIT = 0x5b86b3, OIL = 0x2a2f38, SKN = 0xf2c29b;
  const h = humanoid({ hip: 0.78, th: 0.54, w: 0.48, d: 0.3, headR: 0.22, shirt: SUIT, pants: SUIT, shoe: INK, sole: 0x3a2a1a, shoeH: 0.13, armLen: 0.52, legR: 0.095, hand: 0x3a3f48, cuffArm: 0x4a74a0, cuff: 0x4a74a0 });
  const { g, body, H } = h;
  const name = txt('SKEETER', 0.16, { color: '#c4161c', bg: '#ffffff', size: 40 }); name.position.set(0.12, h.th * 0.75, h.d / 2 + 0.005); body.add(name);
  for (const [x, y] of [[-0.1, 0.25], [0.12, 0.1], [-0.05, 0.05]]) body.add(S(sphere(0.05, OIL, x, y, h.d / 2 + 0.005, { outline: false, seg: 8 }), 1.4, 1, 0.2));
  // 拉鍊、領口、胸前口袋插螺絲起子
  body.add(box(0.015, h.th * 0.8, 0.01, 0xb8c2cc, 0, h.th * 0.5, h.d / 2 + 0.005, { outline: false }));
  for (const s of [1, -1]) body.add(R(box(0.12, 0.08, 0.03, 0x4a74a0, s * 0.07, h.th - 0.02, h.d / 2 - 0.01), 0, 0, -s * 0.4));
  body.add(box(0.1, 0.1, 0.02, 0x4a74a0, -0.12, h.th * 0.68, h.d / 2 + 0.01, { outline: false }));
  body.add(cyl(0.01, 0.01, 0.1, 0xffcc33, -0.14, h.th * 0.78, h.d / 2 + 0.02, { seg: 6, outline: false }));
  body.add(box(h.w + 0.02, 0.06, h.d + 0.02, 0x3a4a5c, 0, 0.1, 0, { outline: false }));
  const rag = pivot(body, -0.15, 0.06, -h.d / 2 - 0.02, box(0.12, 0.18, 0.03, 0xd9261c, -0.15, -0.04, -h.d / 2 - 0.02));
  // 工具腰包
  body.add(box(0.12, 0.12, 0.08, 0x6a4a2a, 0.24, 0.02, 0.06));
  body.add(cyl(0.012, 0.012, 0.1, 0xb8c2cc, 0.22, 0.12, 0.07, { seg: 6, outline: false }));
  // 頭：反戴帽、大鬢角、髒臉、齜牙
  H.add(dome(0.235, OIL, 0, 0.03, 0, 0.93));
  H.add(box(0.24, 0.03, 0.2, OIL, 0, 0.05, -0.27));
  H.add(box(0.08, 0.05, 0.02, 0xff7a1a, 0, 0.14, -0.2, { outline: false }));
  for (const s of [1, -1]) H.add(box(0.05, 0.14, 0.08, 0x5a3418, s * 0.2, -0.05, 0.04, { outline: false }));
  ears(H, 0.22, SKN);
  const E = eyes(H, 0.22, { r: 0.048, gap: 0.08, y: 0.03, pr: 0.42, iris: 0x7a5a3a, brow: 0x3a2010, angry: 0.45, lid: SKN, lidX: -0.5, lidZ: 0.5 });
  nose(H, 0.22, 0.042, 0xe8a888, -0.03);
  H.add(S(sphere(0.05, OIL, -0.1, 0.1, 0.17, { outline: false }), 1.5, 0.6, 0.3));
  H.add(S(sphere(0.03, OIL, 0.12, -0.06, 0.17, { outline: false, seg: 8 }), 1.4, 0.8, 0.3));
  const M = mouth(H, 0.22, 0.1, 0.035, -0.1, { teeth: true, tilt: -0.2, x: 0.02 });
  // 巨型活動扳手（右手，斜扛）
  pose(h.armR, -1.0, 0, -0.05, 0.2);
  const wr = G(); wr.rotation.set(-2.2, 0, -0.3);
  const STEEL = 0xc8ccd2;
  add(wr, box(0.1, 0.06, 0.95, STEEL, 0, 0, 0.3), box(0.11, 0.075, 0.26, 0xd9261c, 0, 0, -0.08));
  add(wr, box(0.32, 0.08, 0.14, STEEL, 0, 0, 0.82), box(0.08, 0.08, 0.24, STEEL, 0.12, 0, 0.92), box(0.08, 0.08, 0.2, STEEL, -0.12, 0, 0.94));
  wr.add(R(cyl(0.035, 0.035, 0.16, 0x8a96a2, 0, 0, 0.7, { seg: 10 }), 0, 0, PI / 2));
  for (const z of [0.66, 0.7, 0.74]) wr.add(R(torus(0.036, 0.005, 0x6a7480, 0, 0, z, { seg: 8, outline: false }), 0, PI / 2, 0));
  wr.add(at(R(txt('42', 0.08, { color: '#1b1226', size: 40 }), -PI / 2, 0, 0), 0, 0.032, 0.4));
  const drip = S(sphere(0.02, 0x1b1226, 0.12, -0.04, 0.95, { seg: 6, outline: false }), 0.8, 1.5, 0.8); wr.add(drip);
  hold(h.armR, wr);
  pose(h.armL, -0.2, 0, 0.15, 0.4);
  return fin(g, { ...P6(h), weapon: wr, eyes: E, mouth: M, extra: [rag] }, 1, t => {
    const k = (t * 0.7) % 1; drip.position.y = -0.04 - k * 0.12; drip.scale.set(0.8, 1 + k, 0.8); drip.visible = k < 0.85;
  });
}

// 炸雞桶大胃王・食人魔巴霸：300 公斤食人魔、巨肚＋肚臍、圍兜、小頭獠牙、莫霍克短髮、赤腳腳趾，
// 揮舞巨型火雞腿，左手冒熱氣的炸雞桶
function bubba() {
  const OGRE = 0xe08a68, OGRE2 = 0xc8704e, BIB = 0xf2efe4;
  const h = humanoid({ hip: 0.78, th: 1.15, w: 1.05, d: 0.7, headR: 0.3, torso: false, shirt: BIB, pants: 0x6b4a2b, shoe: null, legR: 0.2, legX: 0.3, armR: 0.17, armLen: 0.92, skin: OGRE, shortSleeve: true, sleeve: BIB, neck: 0.0, headY: 1.42, handR: 0.22 });
  const { g, body, H } = h;
  body.add(S(sphere(0.78, BIB, 0, 0.52, 0.06, { seg: 22 }), 1.05, 0.95, 0.98));
  body.add(S(sphere(0.55, OGRE, 0, 1.0, -0.02, { seg: 18 }), 1.35, 0.7, 1.05));
  body.add(S(sphere(0.2, OGRE, 0, 0.12, 0.7, { outline: false }), 1.5, 0.6, 0.3));
  body.add(S(sphere(0.035, OGRE2, 0, 0.13, 0.76, { outline: false, seg: 8 }), 1, 1, 0.4));
  // 褲頭＋巨型皮帶扣
  body.add(cyl(0.72, 0.7, 0.14, 0x5a3a1a, 0, 0.0, 0.04, { seg: 20 }));
  body.add(box(0.26, 0.18, 0.05, 0xffcc33, 0, 0.0, 0.74));
  body.add(at(txt('#1', 0.16, { color: '#7a5a00', size: 60 }), 0, 0.0, 0.77));
  // 圍兜（含污漬）
  const bib = G(); bib.position.set(0, 0.62, 0.8); bib.rotation.x = -0.25; body.add(bib);
  add(bib, box(0.62, 0.55, 0.03, WHITE, 0, 0, 0, { r: 0.08 }));
  for (const s of [1, -1]) bib.add(box(0.03, 0.55, 0.035, 0xd9261c, s * 0.29, 0, 0, { outline: false }));
  const bt = txt('ALL U\nCAN EAT', 0.48, { color: '#d9261c', size: 60 }); bt.position.z = 0.02; bib.add(bt);
  for (const [x, y] of [[0.15, -0.18], [-0.2, 0.1], [0.05, -0.22]]) bib.add(at(S(sphere(0.05, 0xd98b3a, 0, 0, 0, { outline: false, seg: 8 }), 1.2, 1, 0.3), x, y, 0.025));
  body.add(R(torus(0.3, 0.035, WHITE, 0, 1.28, 0.16), PI / 2 + 0.3));
  // 赤腳（腳趾＋指甲）
  for (const L of [h.legL, h.legR]) {
    const P = L.userData.pose;
    P.add(S(sphere(0.2, OGRE, 0, -0.74, 0.08, { seg: 12 }), 1, 0.45, 1.4));
    for (const x of [-0.1, -0.03, 0.04, 0.11]) P.add(sphere(0.045, OGRE, x, -0.75, 0.33, { seg: 8, outline: x === 0.11 || x === -0.1 }));
    P.add(cyl(0.21, 0.21, 0.08, 0x5a3a1a, 0, -0.55, 0, { seg: 10, outline: false }));
  }
  // 手臂毛、護腕
  for (const A of [h.armL, h.armR]) A.userData.fore.add(cyl(0.17, 0.17, 0.1, 0x8a5a3a, 0, -A.userData.foreLen * 0.75, 0, { seg: 10 }));
  // 小頭：一字眉、豬鼻、獠牙、莫霍克短髮
  H.add(S(sphere(0.3, OGRE), 1.15, 0.9, 1));
  H.add(box(0.36, 0.06, 0.07, 0x5a2a12, 0, 0.1, 0.25, { r: 0.02 }));
  const E = eyes(H, 0.3, { r: 0.045, gap: 0.09, y: 0.04, z: 0.29, pr: 0.55, white: 0xffffcc, lid: OGRE2, lidX: -0.3, lidZ: 0.2 });
  H.add(S(sphere(0.07, OGRE2, 0, -0.02, 0.29), 1.2, 0.9, 0.8));
  for (const s of [1, -1]) H.add(sphere(0.014, 0x5a2a12, s * 0.03, -0.03, 0.35, { seg: 6, outline: false }));
  const M = mouth(H, 0.3, 0.26, 0.07, -0.14, { z: 0.27, teeth: true, tongue: true });
  for (const s of [1, -1]) {
    M.add(R(cone(0.04, 0.13, 0xfff6d8, s * 0.1, 0.06, 0.02, { seg: 8 }), 0.2, 0, -s * 0.2));
    H.add(R(cone(0.06, 0.16, 0xf4e6c0, s * 0.2, 0.25, 0.02), 0, 0, -s * 0.5));
    H.add(S(sphere(0.06, OGRE, s * 0.33, 0.0, -0.02, { seg: 8 }), 0.5, 1, 0.8));
  }
  const mohawk = pivot(H, 0, 0.24, -0.02, R(capsule(0.035, 0.1, 0x3a2a12, 0, 0.28, -0.05, { seg: 8 }), 0.4), R(capsule(0.03, 0.08, 0x3a2a12, 0, 0.27, -0.14, { seg: 8 }), 0.9));
  const crumbs = [];
  for (const [x, y] of [[0.1, -0.22], [-0.08, -0.25]]) { const c = sphere(0.018, 0xd99a3a, x, y, 0.26, { seg: 4, outline: false }); H.add(c); crumbs.push(c); }
  // 巨型火雞腿（右手）
  pose(h.armR, -0.7, 0, -0.2, 0.5);
  const leg = G(); leg.rotation.x = 0.15;
  add(leg, cyl(0.06, 0.06, 0.3, 0xfff6d8, 0, 0.0, 0), sphere(0.085, 0xfff6d8, 0.04, -0.17, 0, { seg: 10 }), sphere(0.085, 0xfff6d8, -0.04, -0.17, 0, { seg: 10 }));
  add(leg, S(sphere(0.3, 0xa85a1e, 0, 0.42, 0, { seg: 16 }), 1, 1.45, 1), S(sphere(0.12, 0xc8742e, 0.15, 0.48, 0.15, { outline: false }), 1, 1.4, 0.6));
  for (const [y, a] of [[0.3, 0.3], [0.5, -0.2], [0.65, 0.4]]) leg.add(R(box(0.2, 0.02, 0.02, 0x6a2a0a, 0, y, 0.29, { outline: false }), 0, 0, a));
  leg.add(S(sphere(0.1, 0x5a2a0a, -0.12, 0.62, -0.2, { outline: false, seg: 8 }), 1, 0.5, 0.5));
  hold(h.armR, leg);
  // 炸雞桶（左手，冒熱氣）
  pose(h.armL, -0.35, 0, 0.3, 0.5);
  const bucket = G();
  add(bucket, cyl(0.28, 0.21, 0.42, WHITE, 0, -0.08, 0.1, { seg: 16 }), torus(0.28, 0.02, 0xd9261c, 0, 0.13, 0.1, { outline: false, seg: 16 }));
  bucket.children[1].rotation.x = PI / 2;
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; bucket.add(R(box(0.1, 0.4, 0.02, 0x1fa596, Math.sin(a) * 0.25, -0.08, 0.1 + Math.cos(a) * 0.25, { outline: false }), -Math.cos(a) * 0.15, a, 0)); }
  for (const [x, z] of [[0.08, 0.1], [-0.08, 0.16], [0, 0.0]]) { bucket.add(S(sphere(0.1, 0xd99a3a, x, 0.18, z + 0.05, { seg: 10 }), 1, 1.3, 1)); }
  bucket.add(R(cyl(0.025, 0.025, 0.14, 0xfff6d8, 0.12, 0.27, 0.0, { seg: 6 }), 0, 0, -0.5));
  const steam = [0, 1].map(i => { const s = sphere(0.06, WHITE, -0.05 + i * 0.1, 0.35, 0.1, { transparent: true, opacity: 0.4, outline: false, shadow: false }); bucket.add(s); return s; });
  hold(h.armL, bucket);
  return fin(g, { ...P6(h), weapon: leg, eyes: E, mouth: M, extra: [mohawk] }, 1, t => {
    for (let i = 0; i < steam.length; i++) { const s = steam[i], k = (t * 0.6 + i * 0.5) % 1; s.position.y = 0.3 + k * 0.4; s.scale.setScalar(0.5 + k * 1.3); s.visible = k < 0.85; }
    // 咀嚼
    M.children[0].scale.y = 1 + Math.max(0, wave(t, 6, 0.6));
    crumbs[0].position.y = -0.22 - ((t * 0.8) % 1) * 0.3; crumbs[1].position.y = -0.25 - ((t * 0.8 + 0.5) % 1) * 0.3;
  });
}

// ── 第 5 關 ──────────────────────────────────────────
// 薯條護衛隊盾兵：炸籃頭盔＋薯條羽飾、芥末黃分段鎧甲、肩甲護手護脛，左手薯條紙盒盾、右手沾番茄醬（會滴）的薯條長矛
function fryguard() {
  const MUST = 0xf2b705, MUST2 = 0xd99a0a, CART = 0x1f8a4c, FRY = 0xffd43a, KETCH = 0xd9261c, STEEL = 0xb8c2cc;
  const h = humanoid({ hip: 0.78, th: 0.54, w: 0.48, d: 0.3, headR: 0.22, shirt: MUST, pants: 0x6b4a2b, shoe: INK, sole: 0x3a2a1a, shoeH: 0.14, armLen: 0.52, sleeve: MUST2, hand: 0x8a6a2a });
  const { g, body, H } = h;
  // 分段胸甲＋鉚釘
  body.add(box(h.w + 0.04, 0.22, h.d + 0.04, MUST2, 0, h.th * 0.72, 0));
  for (const y of [0.16, 0.26]) body.add(box(h.w + 0.03, 0.025, h.d + 0.03, 0xb88208, 0, y, 0, { outline: false }));
  for (const s of [1, -1]) body.add(sphere(0.018, STEEL, s * 0.18, h.th * 0.72, h.d / 2 + 0.03, { seg: 6, outline: false }));
  body.add(at(txt('M', 0.1, { color: '#d9261c', size: 60 }), 0, h.th * 0.74, h.d / 2 + 0.025));
  // 肩甲（雙層）
  for (const s of [1, -1]) { body.add(dome(0.13, MUST2, s * 0.3, h.th - 0.04, 0, 0.8)); body.add(dome(0.1, MUST, s * 0.33, h.th - 0.1, 0, 0.6, { outline: false })); }
  body.add(box(h.w + 0.03, 0.06, h.d + 0.03, 0x5a3a1a, 0, 0.1, 0, { outline: false }));
  // 腰甲裙片
  for (const x of [-0.14, 0, 0.14]) body.add(R(box(0.13, 0.16, 0.03, MUST2, x, -0.06, h.d / 2 + 0.02, { outline: x === 0 }), 0.12, 0, 0));
  // 護手、護脛
  for (const A of [h.armL, h.armR]) A.userData.fore.add(cyl(0.085, 0.075, 0.12, STEEL, 0, -A.userData.foreLen * 0.7, 0, { seg: 10 }));
  for (const L of [h.legL, h.legR]) L.userData.pose.add(box(0.12, 0.24, 0.05, STEEL, 0, -0.5, 0.08));
  // 炸籃頭盔（網格）＋把手＋薯條羽飾
  H.add(box(0.5, 0.2, 0.5, STEEL, 0, 0.15, -0.01, { r: 0.04 }));
  for (const x of [-0.15, -0.05, 0.05, 0.15]) H.add(box(0.012, 0.18, 0.012, 0x6a7480, x, 0.15, 0.26, { outline: false }));
  H.add(box(0.48, 0.012, 0.012, 0x6a7480, 0, 0.15, 0.26, { outline: false }));
  H.add(box(0.52, 0.03, 0.52, 0x8a96a2, 0, 0.06, -0.01, { outline: false }));
  const handle = pivot(H, 0, 0.15, -0.26, rod([0, 0.15, -0.26], [0, 0.22, -0.6], 0.025, INK), cyl(0.035, 0.035, 0.12, 0xd9261c, 0, 0.23, -0.62, { seg: 8, outline: false }));
  handle.children[1].rotation.x = 1.4;
  const plume = G(); plume.position.set(0, 0.25, -0.05); H.add(plume);
  for (let i = 0; i < 5; i++) plume.add(R(box(0.04, 0.24, 0.04, FRY, (i - 2) * 0.035, 0.12, 0, { outline: i === 2 }), 0, 0, (i - 2) * 0.18));
  const E = eyes(H, 0.22, { r: 0.045, gap: 0.08, y: 0.0, pr: 0.45, iris: 0x3a6a3a, brow: 0x3a2010, angry: 0.5, browY: -0.01, lid: SKIN, lidX: -0.5, lidZ: 0.5 });
  nose(H, 0.22, 0.04, 0xe8a888, -0.04);
  H.add(R(capsule(0.03, 0.14, 0x5a3418, 0, -0.08, 0.2), 0, 0, PI / 2));
  const M = mouth(H, 0.22, 0.08, 0.025, -0.13, { teeth: true });
  // 薯條盒盾（左手）
  pose(h.armL, -0.75, 0, -0.2, 0.5);
  const shield = G();
  add(shield, box(0.62, 0.6, 0.1, CART, 0.02, 0.0, 0.14, { r: 0.04 }), box(0.56, 0.07, 0.11, 0xf6f0e0, 0.02, -0.14, 0.145, { outline: false }));
  shield.add(box(0.64, 0.04, 0.11, 0xffcc33, 0.02, 0.29, 0.14, { outline: false }));
  const ft = txt('FRIES', 0.38, { color: '#ffffff', size: 60 }); ft.position.set(0.02, 0.08, 0.2); shield.add(ft);
  for (let i = 0; i < 8; i++) shield.add(R(box(0.055, 0.24 + (i * 37 % 5) * 0.035, 0.055, FRY, -0.25 + i * 0.07, 0.38, 0.12 + (i % 2) * 0.03, { outline: false }), 0, 0, (i - 3.5) * 0.06));
  hold(h.armL, shield, 0.08, 0, 0);
  // 薯條長矛（右手）＋番茄醬滴
  pose(h.armR, -0.35, 0, 0.12, 0.35);
  const spear = G();
  add(spear, box(0.07, 1.45, 0.07, FRY, 0, 0.35, 0), box(0.085, 0.26, 0.085, KETCH, 0, 0.97, 0, { r: 0.03 }), R(cone(0.06, 0.14, KETCH, 0, 1.15, 0, { seg: 4 }), 0, PI / 4, 0));
  for (const y of [-0.1, 0.0]) spear.add(box(0.08, 0.04, 0.08, 0x8a5a2a, 0, y, 0, { outline: false }));
  const drip = S(sphere(0.025, KETCH, 0.04, 0.84, 0, { seg: 6, outline: false }), 0.8, 1.4, 0.8); spear.add(drip);
  hold(h.armR, spear);
  return fin(g, { ...P6(h), weapon: shield, eyes: E, mouth: M, extra: [plume, handle] }, 1, t => {
    const k = (t * 0.8) % 1; drip.position.y = 0.84 - k * 0.3; drip.scale.set(0.8, 1.2 + k, 0.8); drip.visible = k < 0.8;
  });
}

// 冷凍肉排處刑者：黑頭套＋食安髮網、赤膊胸毛壯漢、刺青、沾醬圍裙、鐵鍊腰帶掛肉鉤，揮舞「冷凍肉排」大菜刀（結霜、冒寒氣）
function patty() {
  const SKN = 0xf0b090, APRON = 0xf4f4f0, ICE = 0xcff4ff;
  const h = humanoid({ hip: 0.8, th: 0.56, w: 0.54, d: 0.32, headR: 0.22, shirt: SKN, pants: INK, shoe: 0x3a2a1a, sole: 0x1b1226, shoeH: 0.14, armR: 0.1, armLen: 0.54, skin: SKN, belly: 0.22, legR: 0.1, hand: 0xffd84a });
  const { g, body, H } = h;
  // 胸肌、胸毛、刺青
  for (const s of [1, -1]) body.add(S(sphere(0.13, SKN, s * 0.12, h.th * 0.7, h.d / 2 - 0.05, { seg: 10, outline: false }), 1.1, 0.75, 0.5));
  for (const [x, y] of [[0.03, 0.42], [-0.03, 0.44], [0, 0.38]]) body.add(sphere(0.012, 0x3a2010, x, y, h.d / 2 + 0.03, { seg: 4, outline: false }));
  h.armL.userData.pose.add(S(sphere(0.045, 0xd9261c, 0.06, -0.12, 0.04, { seg: 8, outline: false }), 0.3, 1, 1));
  // 圍裙＋綁帶＋醬漬
  add(body, box(0.42, 0.72, 0.03, APRON, 0, 0.15, h.d / 2 + 0.11, { r: 0.04 }));
  body.add(box(0.2, 0.12, 0.02, 0xe8e8e0, 0, 0.0, h.d / 2 + 0.13, { outline: false }));
  for (const s of [1, -1]) body.add(rod([s * 0.18, 0.5, h.d / 2 + 0.11], [s * 0.1, h.th + 0.02, 0.0], 0.015, APRON, { outline: false }));
  for (const [x, y] of [[0.1, 0.3], [-0.12, 0.05], [0.05, -0.1], [-0.05, 0.4]]) body.add(S(sphere(0.06, 0xa8241c, x, y, h.d / 2 + 0.13, { outline: false, seg: 8 }), 1.2, 0.8, 0.2));
  body.add(box(h.w + 0.03, 0.08, h.d + 0.03, 0x5a3a1a, 0, 0.1, 0, { outline: false }));
  // 鐵鍊腰帶＋肉鉤（會晃）
  for (let i = 0; i < 6; i++) { const a = -1.3 + i * 0.52; body.add(R(torus(0.025, 0.007, 0x8a96a2, Math.sin(a) * 0.3, 0.02, Math.cos(a) * 0.2, { seg: 8, outline: false }), 0, a, i % 2 ? PI / 2 : 0)); }
  const hooks = [1, -1].map(s => pivot(body, s * 0.28, 0.0, 0.05, rod([s * 0.28, 0.0, 0.05], [s * 0.28, -0.14, 0.05], 0.01, 0x8a96a2, { outline: false }), R(arc(0.04, 0.01, PI * 1.3, 0xb8c2cc, { outline: false }), 0, PI / 2, PI)));
  hooks.forEach((p, i) => p.children[1].position.set(0, -0.17, 0));
  // 頭套（眼洞）＋髮網
  H.add(sphere(0.235, INK, 0, 0, 0, { seg: 16 }));
  H.add(cone(0.16, 0.2, INK, 0, 0.24, -0.02, { seg: 10 }));
  H.add(dome(0.255, 0xf4f4f8, 0, 0.03, 0, 0.8, { transparent: true, opacity: 0.5, outline: false }));
  H.add(R(torus(0.24, 0.015, WHITE, 0, 0.04, 0, { seg: 16 }), PI / 2));
  for (const s of [1, -1]) H.add(S(sphere(0.05, SKN, s * 0.08, 0.03, 0.2, { outline: false }), 1.3, 0.9, 0.4));
  const E = eyes(H, 0.22, { r: 0.035, gap: 0.08, y: 0.03, z: 0.235, pr: 0.6, pupil: 0xc01818, brow: INK, angry: 0.5 });
  H.add(S(sphere(0.06, SKN, 0, -0.12, 0.2, { outline: false, seg: 8 }), 1.4, 0.6, 0.4));
  const M = mouth(H, 0.22, 0.08, 0.03, -0.12, { z: 0.215, teeth: true, lower: true });
  // 冷凍肉排菜刀（右手高舉）
  pose(h.armR, -0.95, 0, -0.3, 0.6);
  const cl = G(); cl.rotation.set(-0.15, 0, 0.1);
  add(cl, cyl(0.04, 0.04, 0.28, 0x6a4a2a, 0, 0.0, 0), box(0.1, 0.06, 0.12, 0xb8c2cc, 0, 0.15, 0));
  for (const y of [-0.08, 0.0, 0.08]) cl.add(cyl(0.043, 0.043, 0.02, 0x3a2a1a, 0, y, 0, { seg: 10, outline: false }));
  // 刀身 = 一整塊結霜的冷凍肉排（鋼製刀背、烤痕、冰柱）
  const pt = G(); pt.position.set(-0.04, 0.44, 0); cl.add(pt);
  add(pt, box(0.48, 0.5, 0.07, 0x7a3626, 0, 0, 0, { r: 0.05 }), box(0.54, 0.56, 0.04, ICE, 0, 0, -0.025, { r: 0.04 }));
  add(pt, box(0.52, 0.07, 0.1, 0x9aa4ae, 0, 0.27, 0, { r: 0.02 }), sphere(0.03, 0xd8dde3, -0.18, 0.27, 0.05, { seg: 6, outline: false }));
  for (const y of [-0.14, 0.0, 0.14]) pt.add(R(box(0.36, 0.025, 0.01, 0x3a1810, 0, y, 0.04, { outline: false }), 0, 0, 0.35));
  for (const [x, y] of [[0.14, 0.12], [-0.12, -0.08], [0.06, -0.18]]) pt.add(S(sphere(0.045, 0xeafcff, x, y, 0.035, { outline: false, seg: 8 }), 1.3, 1, 0.3));
  for (const x of [-0.15, 0.0, 0.15]) pt.add(R(cone(0.03, 0.1, ICE, x, -0.3, 0, { seg: 6 }), PI));
  const spark = G(); spark.position.set(0.16, 0.16, 0.05); pt.add(spark);
  add(spark, box(0.09, 0.012, 0.005, WHITE, 0, 0, 0, glow(WHITE)), box(0.012, 0.09, 0.005, WHITE, 0, 0, 0, glow(WHITE)));
  const mist = sphere(0.1, ICE, 0, -0.32, 0, { transparent: true, opacity: 0.35, outline: false, shadow: false }); pt.add(mist);
  hold(h.armR, cl);
  pose(h.armL, -0.4, 0, 0.2, 0.5);
  return fin(g, { ...P6(h), weapon: cl, eyes: E, mouth: M, extra: hooks }, 1, t => {
    spark.rotation.z = t * 2; spark.scale.setScalar(0.4 + Math.abs(wave(t, 3, 0.8)));
    const k = (t * 0.5) % 1; mist.position.y = -0.3 - k * 0.3; mist.scale.setScalar(0.5 + k * 1.2); mist.visible = k < 0.85;
  });
}

// 糖分女祭司・芭芭拉：桃紅分層長袍＋金腰封、糖果項鍊、金色蓬蓬頭、紅唇藍綠眼影，
// 頭戴冒泡巨型汽水杯冠（吸管會晃），手持霜淇淋權杖，身邊繞著發光方糖
function priestess() {
  const ROBE = 0xff3d8b, ROBE2 = 0xd92a72, TEAL = 0x16b6a8, GOLD = 0xffcc33, HAIR = 0xffd76a, SKN = 0xf6c8a8;
  const h = humanoid({ hip: 0.82, th: 0.6, w: 0.46, d: 0.3, headR: 0.24, shirt: ROBE, pants: ROBE, shoe: GOLD, sole: 0xb8860b, shoeH: 0.08, armLen: 0.56, legR: 0.08, skin: SKN });
  const { g, body, H } = h;
  // 分層長袍
  body.add(cyl(0.25, 0.46, 0.8, ROBE, 0, -0.36, 0, { seg: 16 }));
  body.add(cyl(0.3, 0.5, 0.3, ROBE2, 0, -0.62, 0, { seg: 16, outline: false }));
  body.add(cyl(0.51, 0.51, 0.06, WHITE, 0, -0.76, 0, { seg: 16, outline: false }));
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; body.add(sphere(0.022, [0xff2f6a, 0x9dff3a, 0x2fd4ff, 0xffe14a][i % 4], Math.sin(a) * 0.5, -0.7, Math.cos(a) * 0.5, { seg: 6, outline: false })); }
  body.add(box(0.1, 1.2, 0.02, GOLD, 0, -0.02, h.d / 2 + 0.06, { outline: false }));
  body.add(cyl(0.27, 0.26, 0.1, GOLD, 0, 0.05, 0, { seg: 16 }));
  body.add(R(cyl(0.06, 0.06, 0.03, 0xff2f6a, 0, 0.05, h.d / 2 + 0.11, { seg: 10 }), PI / 2));
  // 喇叭袖
  for (const A of [h.armL, h.armR]) { const F = A.userData.fore; F.add(cyl(0.08, 0.14, 0.26, ROBE, 0, -A.userData.foreLen * 0.55, 0, { seg: 10 })); F.add(cyl(0.145, 0.145, 0.025, WHITE, 0, -A.userData.foreLen * 0.55 - 0.13, 0, { seg: 10, outline: false })); }
  // 糖果項鍊
  const BEADS = [0xff2f6a, 0x9dff3a, 0x2fd4ff, 0xffe14a, 0xff8a1a];
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; body.add(sphere(0.04, BEADS[i % 5], Math.sin(a) * 0.2, h.th - 0.07 - Math.cos(a) * 0.08, h.d / 2 + 0.02 - (1 - Math.cos(a)) * 0.05, { seg: 8 })); }
  // 背後披肩（擺動）
  const shawl = pivot(body, 0, h.th - 0.02, -h.d / 2, R(box(0.56, 0.9, 0.03, TEAL, 0, h.th - 0.45, -h.d / 2 - 0.04, { r: 0.015 }), 0.1), box(0.56, 0.04, 0.035, GOLD, 0, h.th - 0.9, -h.d / 2 - 0.085, { outline: false }));
  // 頭：金色蓬蓬頭、大紅唇、藍綠眼影、愛心耳環
  for (const [x, y, z, r] of [[0.15, 0.02, -0.06, 0.13], [-0.15, 0.02, -0.06, 0.13], [0, 0.05, -0.15, 0.17], [0.18, -0.14, -0.04, 0.09], [-0.18, -0.14, -0.04, 0.09], [0, -0.1, -0.18, 0.12]]) H.add(sphere(r, HAIR, x, y, z, { seg: 10 }));
  const curls = [1, -1].map(s => pivot(H, s * 0.2, -0.16, 0.02, S(sphere(0.05, HAIR, s * 0.21, -0.26, 0.04, { seg: 8 }), 0.9, 1.4, 0.9)));
  const E = eyes(H, 0.24, { r: 0.05, gap: 0.085, y: 0.03, pr: 0.42, iris: 0xd92a72, brow: 0x8a5a2a, angry: -0.15, browY: 0.005, lid: TEAL, lidX: -0.25, lidZ: -0.2 });
  for (const s of [1, -1]) for (const dx of [0, 0.02]) H.add(R(box(0.006, 0.03, 0.006, INK, s * (0.11 + dx), 0.08, 0.2, { outline: false }), 0, 0, -s * (0.5 + dx * 10)));
  nose(H, 0.24, 0.03, 0xf0a888, -0.04, { outline: false });
  const M = G(); M.position.set(0, -0.11, 0.21); H.add(M);
  M.add(S(sphere(0.05, 0xe0102a, 0, 0, 0), 1.3, 0.6, 0.6));
  M.add(box(0.05, 0.01, 0.01, 0x8a0018, 0, 0, 0.03, { outline: false }));
  cheeks(H, 0.24, 0xff7aa8);
  for (const s of [1, -1]) H.add(R(S(cone(0.03, 0.04, 0xff2f6a, s * 0.23, -0.12, 0.02, { seg: 4, outline: false }), 1, 1, 0.4), PI));
  // 汽水杯冠（氣泡上升、冰塊、吸管）
  const cup = G(); cup.position.y = 0.17; H.add(cup);
  add(cup, cyl(0.3, 0.22, 0.6, WHITE, 0, 0.3, 0, { seg: 18 }), cyl(0.285, 0.265, 0.18, TEAL, 0, 0.3, 0, { seg: 18 }));
  add(cup, cyl(0.32, 0.32, 0.05, TEAL, 0, 0.62, 0, { seg: 18 }), dome(0.3, 0xe8fbff, 0, 0.64, 0, 0.25, { transparent: true, opacity: 0.6, outline: false }));
  for (const s of [1, -1]) cup.add(R(box(0.08, 0.08, 0.08, 0xd8f8ff, s * 0.12, 0.68, 0.05 * s, { transparent: true, opacity: 0.7, outline: false }), 0.3, s * 0.4, 0));
  const dots = txt('XXXL', 0.3, { color: '#ff3d8b', size: 52 }); dots.position.set(0, 0.47, 0.29); dots.rotation.x = -0.13; cup.add(dots);
  for (const [y, a] of [[0.08, 0.6], [0.52, -0.9]]) cup.add(R(torus(0.25 + y * 0.12, 0.012, 0xff3d8b, 0, y, 0, { outline: false, seg: 18 }), PI / 2, 0, a));
  const straw = pivot(cup, 0.04, 0.62, 0.02, rod([0.04, 0.62, 0.02], [0.08, 1.0, 0.02], 0.025, 0xff2f6a), rod([0.08, 1.0, 0.02], [0.2, 1.08, 0.02], 0.025, 0xff2f6a));
  const bubbles = [0, 1, 2].map(i => { const b = sphere(0.025, 0xe8fbff, -0.1 + i * 0.09, 0.7, -0.05 + i * 0.04, { seg: 6, transparent: true, opacity: 0.7, outline: false, shadow: false }); cup.add(b); return b; });
  // 霜淇淋權杖（左手）：甜筒格紋、三層霜淇淋、彩色糖粒、櫻桃
  pose(h.armL, -0.45, 0, 0.45, 0.5);
  const staff = G();
  add(staff, cyl(0.03, 0.03, 1.85, GOLD, 0, 0.2, 0, { seg: 10 }), R(cone(0.14, 0.32, 0xd9a05a, 0, 1.25, 0, { seg: 10 }), PI));
  for (const y of [1.18, 1.28]) staff.add(R(torus(0.11 - (1.28 - y) * 0.25, 0.008, 0xa8743a, 0, y, 0, { outline: false, seg: 12 }), PI / 2));
  for (let i = 0; i < 3; i++) staff.add(R(torus(0.12 - i * 0.035, 0.06 - i * 0.012, 0xfff4f8, 0, 1.43 + i * 0.08, 0, { seg: 14 }), PI / 2));
  for (const [x, y, z, c] of [[0.1, 1.46, 0.06, 0xff2f6a], [-0.08, 1.5, 0.08, 0x2fd4ff], [0.04, 1.56, -0.08, 0x9dff3a], [-0.1, 1.44, -0.05, 0xffe14a]]) staff.add(R(box(0.03, 0.01, 0.01, c, x, y, z, { outline: false }), 0, x * 10, 0.5));
  add(staff, cone(0.04, 0.12, 0xfff4f8, 0, 1.68, 0, { seg: 8 }), sphere(0.035, 0xe0102a, 0.04, 1.73, 0, { seg: 8 }));
  staff.add(cyl(0.035, 0.035, 0.1, 0xff3d8b, 0, 0.0, 0, { seg: 8, outline: false }));
  hold(h.armL, staff);
  pose(h.armR, -0.5, 0, 0.55, 0.6);
  // 環繞的發光方糖
  const orbit = G(); orbit.position.y = 1.0; g.add(orbit);
  const cubes = [0, 1, 2].map(i => { const a = i * PI * 2 / 3; const c = R(box(0.08, 0.08, 0.08, WHITE, Math.sin(a) * 0.65, 0, Math.cos(a) * 0.65, { mat: flat(0xfff4fa), outline: true }), 0.6, a, 0.6); orbit.add(c); return c; });
  return fin(g, { ...P6(h), weapon: staff, eyes: E, mouth: M, extra: [straw, shawl, ...curls] }, 1, t => {
    orbit.rotation.y = t * 0.9;
    for (let i = 0; i < 3; i++) { const c = cubes[i]; c.position.y = wave(t, 2, 0.08, i * 2); c.rotation.x = t * 1.5 + i; }
    for (let i = 0; i < 3; i++) { const b = bubbles[i], k = (t * 0.7 + i / 3) % 1; b.position.y = 0.66 + k * 0.25; b.scale.setScalar(0.6 + k * 0.6); b.visible = k < 0.9; }
  });
}

// 速食帝國執行長・雙層漢堡督軍：2.8 m 西裝巨漢、漢堡麵包王冠（寶石脈動）、麵包肩甲＋生菜邊、分片酒紅披風（擺動），
// 金領帶、口袋巾、金戒指，左手垂著「隨時取消」條款長卷，右手黃金雙層漢堡戰錘（閃光），身邊繞著金幣
function warlord() {
  const SUIT = 0x2f3640, SUIT2 = 0x3c4552, GOLD = 0xffc531, DGOLD = 0xb8860b, CAPE = 0x7a1630, CAPE2 = 0xffd0a0, SKN = 0xe8b48c, BUN = 0xe08f3c;
  const h = humanoid({ hip: 0.98, th: 0.86, w: 0.88, d: 0.5, headR: 0.29, shirt: SUIT, pants: SUIT, shoe: INK, sole: 0x3a2a1a, shoeH: 0.16, shoeL: 0.42, shoeW: 0.26, legR: 0.15, legX: 0.24, armR: 0.13, armLen: 0.86, belly: 0.4, hand: SKN, skin: SKN, cuffArm: WHITE });
  const { g, body, H } = h;
  // 西裝：翻領、襯衫、金領帶、口袋巾、鈕扣
  body.add(R(cone(0.16, 0.36, WHITE, 0, h.th - 0.2, h.d / 2 + 0.005, { seg: 3, outline: false }), PI, 0, 0));
  for (const s of [1, -1]) body.add(R(box(0.14, 0.5, 0.03, SUIT2, s * 0.15, h.th - 0.28, h.d / 2 + 0.02), 0, 0, s * 0.3));
  body.add(box(0.09, 0.5, 0.03, GOLD, 0, h.th - 0.35, h.d / 2 + 0.05, { outline: false }));
  body.add(R(box(0.11, 0.1, 0.035, GOLD, 0, h.th - 0.12, h.d / 2 + 0.06, { outline: false }), 0, 0, PI / 4));
  body.add(R(cone(0.05, 0.08, 0xd9261c, 0.28, h.th - 0.2, h.d / 2 + 0.02, { seg: 3, outline: false }), 0, 0, 0));
  for (const y of [0.25, 0.4]) body.add(sphere(0.025, DGOLD, 0, y, h.d / 2 + 0.33, { seg: 6, outline: false }));
  body.add(box(h.w + 0.04, 0.1, h.d + 0.04, INK, 0, 0.1, 0, { outline: false }));
  add(body, R(cyl(0.11, 0.11, 0.06, GOLD, 0, 0.1, h.d / 2 + 0.05, { seg: 14 }), PI / 2), R(cyl(0.09, 0.09, 0.03, DGOLD, 0, 0.1, h.d / 2 + 0.085, { seg: 14, outline: false }), PI / 2));
  // 麵包肩甲（芝麻、肉排、生菜邊）
  for (const s of [1, -1]) {
    body.add(dome(0.26, BUN, s * 0.5, h.th - 0.04, 0, 0.75));
    body.add(cyl(0.27, 0.27, 0.06, 0x5b3320, s * 0.5, h.th - 0.06, 0, { seg: 14, outline: false }));
    body.add(cyl(0.29, 0.29, 0.03, 0x5bbf3a, s * 0.5, h.th - 0.1, 0, { seg: 9, outline: false }));
    for (const a of [0.4, 2.1, 3.8, 5.2]) body.add(S(sphere(0.025, 0xfff6e0, s * 0.5 + Math.sin(a) * 0.13, h.th + 0.13, Math.cos(a) * 0.13, { seg: 6, outline: false }), 1, 0.5, 1.6));
    body.add(capsule(0.03, 0.08, 0xffc21a, s * 0.5 + 0.1, h.th - 0.14, 0.18, { seg: 6, outline: false }));
  }
  // 分片披風（三片各自擺動）＋立領
  const capes = [-1, 0, 1].map(i => pivot(body, i * 0.36, h.th + 0.02, -h.d / 2 - 0.06,
    R(box(0.38, 1.75, 0.05, CAPE, i * 0.36, h.th - 0.86, -h.d / 2 - 0.08 - Math.abs(i) * 0.02, { r: 0.02 }), 0.12, 0, i * 0.04),
    R(box(0.36, 1.7, 0.02, CAPE2, i * 0.36, h.th - 0.86, -h.d / 2 - 0.04 - Math.abs(i) * 0.02, { r: 0.008, outline: false }), 0.12, 0, i * 0.04),
    box(0.38, 0.05, 0.06, GOLD, i * 0.36, h.th - 1.72, -h.d / 2 - 0.29, { outline: false })));
  body.add(R(box(0.95, 0.32, 0.05, CAPE, 0, h.th + 0.1, -h.d / 2 + 0.02), -0.3));
  body.add(box(0.95, 0.04, 0.06, GOLD, 0, h.th + 0.25, -h.d / 2 - 0.02, { outline: false }));
  for (const s of [1, -1]) body.add(R(cyl(0.06, 0.06, 0.03, GOLD, s * 0.4, h.th - 0.02, h.d / 2 - 0.02, { seg: 10 }), PI / 2));
  // 頭：油頭、山羊鬍、金牙奸笑、金色眼睛
  H.add(dome(0.3, 0x2a1a12, 0, 0.04, -0.03, 0.75));
  H.add(R(S(sphere(0.08, 0x2a1a12, 0.1, 0.2, 0.12, { seg: 8 }), 1.6, 0.5, 1), 0, 0, -0.3));
  ears(H, 0.29, SKN);
  const E = eyes(H, 0.29, { r: 0.05, gap: 0.1, y: 0.04, pr: 0.4, iris: GOLD, brow: 0x2a1a12, angry: 0.4, lid: SKN, lidX: -0.45, lidZ: 0.45 });
  nose(H, 0.29, 0.05, 0xd89878, -0.03);
  H.add(S(sphere(0.08, 0x2a1a12, 0, -0.22, 0.2), 0.8, 1.1, 0.7));
  for (const s of [1, -1]) H.add(R(capsule(0.02, 0.08, 0x2a1a12, s * 0.06, -0.09, 0.26, { seg: 6, outline: false }), 0, 0, s * 1.3));
  const M = mouth(H, 0.29, 0.16, 0.045, -0.12, { tilt: -0.12, teeth: true, x: 0.02 });
  M.add(box(0.03, 0.03, 0.02, GOLD, 0.04, 0.005, 0.03, { outline: false }));
  // 漢堡麵包王冠（中央寶石脈動）
  const crown = G(); crown.position.y = 0.2; H.add(crown);
  crown.add(R(torus(0.25, 0.04, GOLD, 0, 0, 0, { seg: 18 }), PI / 2));
  for (let i = 0; i < 5; i++) {
    const a = i * PI * 2 / 5, x = Math.sin(a) * 0.24, z = Math.cos(a) * 0.24;
    add(crown, cyl(0.075, 0.075, 0.04, 0x5b3320, x, 0.05, z, { seg: 10, outline: false }), dome(0.08, BUN, x, 0.07, z, 0.9, { seg: 10 }));
  }
  const gem = sphere(0.05, 0xe5352a, 0, 0.06, 0.27, { seg: 8, mat: flat(0xff3a4a) }); crown.add(gem);
  // 金戒指（雙手）
  for (const A of [h.armL, h.armR]) A.userData.fore.add(torus(0.05, 0.018, GOLD, 0, -A.userData.foreLen - 0.12, 0.1, { seg: 10, outline: false }));
  // 黃金雙層漢堡戰錘（右手）＋閃光
  pose(h.armR, -0.45, 0, -0.15, 0.5);
  const ham = G(); ham.rotation.x = 0.12;
  add(ham, cyl(0.045, 0.045, 1.5, DGOLD, 0, 0.35, 0, { seg: 10 }), sphere(0.07, GOLD, 0, -0.42, 0, { seg: 8 }));
  for (const y of [-0.15, -0.05, 0.05]) ham.add(cyl(0.052, 0.052, 0.04, CAPE, 0, y, 0, { seg: 10, outline: false }));
  const head = G(); head.position.y = 1.15; head.rotation.z = PI / 2; ham.add(head);
  add(head, cyl(0.25, 0.23, 0.12, GOLD, 0, -0.26, 0, { seg: 16 }), cyl(0.27, 0.27, 0.1, DGOLD, 0, -0.15, 0, { seg: 16 }));
  add(head, cyl(0.26, 0.26, 0.08, GOLD, 0, -0.06, 0, { seg: 16 }), cyl(0.27, 0.27, 0.1, DGOLD, 0, 0.03, 0, { seg: 16 }));
  add(head, cyl(0.29, 0.29, 0.03, 0xffe680, 0, 0.1, 0, { seg: 16, outline: false }), dome(0.26, GOLD, 0, 0.11, 0, 0.75, { seg: 16 }));
  for (const a of [0.5, 2.2, 4.0]) head.add(S(sphere(0.03, 0xfff6c0, Math.sin(a) * 0.15, 0.27, Math.cos(a) * 0.15, { seg: 6, outline: false }), 1, 0.5, 1.6));
  const gleam = G(); gleam.position.set(0.12, 0.18, 0.2); head.add(gleam);
  add(gleam, box(0.2, 0.025, 0.01, WHITE, 0, 0, 0, glow(0xfff6c0)), box(0.025, 0.2, 0.01, WHITE, 0, 0, 0, glow(0xfff6c0)));
  hold(h.armR, ham);
  // 左手：「隨時取消」條款長卷（垂到地上，會晃）
  pose(h.armL, -0.3, 0, 0.25, 0.7);
  const scroll = G();
  add(scroll, R(cyl(0.05, 0.05, 0.3, 0xf6f0e0, 0, 0, 0.05, { seg: 10 }), 0, 0, PI / 2));
  const paper = G(); paper.position.set(0, -0.02, 0.1); scroll.add(paper);
  paper.add(box(0.26, 0.8, 0.01, 0xfffaf0, 0, -0.4, 0, { r: 0.004 }));
  const terms = txt('TERMS\n& FEES\n…\nNO\nREFUNDS', 0.2, { color: '#5a1020', size: 40 }); terms.position.set(0, -0.36, 0.008); paper.add(terms);
  hold(h.armL, scroll);
  // 環繞金幣
  const orbit = G(); orbit.position.y = 1.9; g.add(orbit);
  const coins = [0, 1, 2, 3].map(i => { const a = i * PI / 2; const c = R(cyl(0.1, 0.1, 0.02, GOLD, Math.sin(a) * 1.05, 0, Math.cos(a) * 1.05, { seg: 14 }), PI / 2, a, 0); orbit.add(c); return c; });
  return fin(g, { ...P6(h), weapon: ham, eyes: E, mouth: M, extra: [...capes, paper] }, 1.1, t => {
    gem.scale.setScalar(1 + wave(t, 4, 0.2));
    const k = (t * 0.5) % 1; gleam.visible = k < 0.25; gleam.scale.setScalar(Math.sin(k * 4 * PI) * 1.2 + 0.1); gleam.rotation.z = k * 3;
    orbit.rotation.y = t * 0.7; for (let i = 0; i < 4; i++) { const c = coins[i]; c.position.y = wave(t, 2.2, 0.1, i * 1.6); c.rotation.z = t * 3 + i; }
  });
}

export const FOE1 = {
  chihuahua, raccoon, tinfoil, burger,
  auntie, reseller, scanner, paul,
  skater, pitbull, balloon, blower, zack,
  slingshot, moonshine, mechanic, bubba,
  fryguard, patty, priestess, warlord,
};
